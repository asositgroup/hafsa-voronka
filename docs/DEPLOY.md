# Deployment Runbook

Complete step-by-step production deployment guide for the Telegram Video Funnel.

Official documentation links for reference:
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Coolify Documentation](https://coolify.io/docs/)
- [Oracle Cloud Always Free Documentation](https://www.oracle.com/cloud/free/)
- [Telegram Bot API & Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [Vercel Deployment Documentation](https://vercel.com/docs)

---

## 1. Cloudflare DNS Configuration

The apex domain and DNS management reside on Cloudflare.

### DNS Records

| Type | Name | Content / Target | Proxy Status | Purpose |
| --- | --- | --- | --- | --- |
| CNAME | `yourdomain.uz` | `cname.vercel-dns.com` | DNS only (Grey cloud) | Web frontend on Vercel |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only (Grey cloud) | Web frontend alternative |
| A | `api` | `<ORACLE_VPS_PUBLIC_IP>` | DNS only (Grey cloud) | Backend API on Coolify |
| CNAME | `video` | `<BUCKET_NAME>.r2.cloudflarestorage.com` | Proxied (Orange cloud) | Video CDN on Cloudflare R2 |

### API TLS Trade-Off: Proxied vs DNS-Only

Coolify uses Traefik as its reverse proxy to manage automatic Let's Encrypt TLS certificates.

- **DNS-Only (Grey cloud - Recommended for initial setup):**
  Traefik terminates TLS directly by responding to Let's Encrypt HTTP-01 challenges. There is no double-proxying, webhook delivery from Telegram arrives directly, and WebSocket connections work without Cloudflare buffer interference.
- **Proxied (Orange cloud):**
  Provides Cloudflare DDoS protection, WAF rules, and edge IP masking. If proxying is enabled, Cloudflare SSL/TLS encryption mode **must** be set to **Full (Strict)**. If set to Flexible or Full, Traefik and Cloudflare can trigger infinite redirect loops or 525 SSL Handshake errors. In addition, Let's Encrypt HTTP-01 challenges through Cloudflare may fail unless Traefik is configured with a Cloudflare DNS-01 API token.
- **Recommendation:** Keep `api.yourdomain.uz` as DNS-only during setup and verification. If DDoS mitigation is needed later, switch Cloudflare SSL/TLS to Full (Strict) before enabling the proxy.

---

## 2. Oracle Cloud Infrastructure (OCI) Setup

The backend API, Telegram bot, and PostgreSQL run on an Oracle Cloud Always Free ARM VM.

### Upgrade to Pay As You Go (PAYG)

Oracle automatically reclaims Always Free compute instances that are classified as idle (low CPU or network utilization). Upgrading the tenancy to Pay As You Go exempts instances from idle reclamation. The Always Free resource allowances (up to 4 ARM Ampere A1 OCPUs, 24 GB RAM, 200 GB block storage) remain free ($0/month) as long as usage remains within the free tier thresholds.

### Architecture

The instance runs on an **ARM (aarch64)** host (Ampere A1). All Docker images must support `linux/arm64`. The provided `apps/api/Dockerfile` uses `node:24-alpine`, which provides native multi-arch ARM support.

### Open Firewall Ports (80 and 443)

Traffic must pass both the OCI Virtual Cloud Network (VCN) security list and the OS-level iptables.

#### VCN Security List

1. Open OCI Console -> Networking -> Virtual Cloud Networks -> Select your VCN.
2. Select Security Lists -> Default Security List -> Add Ingress Rules.
3. Configure ingress rule:
   - Source Type: `CIDR`
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Source Port Range: All
   - Destination Port Range: `80,443`
4. Save the rule.

#### Ubuntu Host iptables

Oracle Ubuntu images contain default iptables rules that reject incoming traffic on ports other than 22. Run the following commands on the VPS:

```bash
sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo apt-get update && sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

Verify the open rules:

```bash
sudo iptables -L INPUT -n --line-numbers
```

---

## 3. Cloudflare R2 Video Hosting & CDN

Video assets and posters are served from a Cloudflare R2 bucket mapped to `video.yourdomain.uz`.

### Create Bucket and Connect Domain

1. In Cloudflare Dashboard, navigate to R2 -> Create Bucket -> Name: `funnel-video`.
2. Go to bucket Settings -> Custom Domains -> Connect Domain.
3. Enter `video.yourdomain.uz` and confirm domain connection (label may differ). Cloudflare will create the managed DNS record and issue the TLS certificate automatically.

### Cache Rule

Video chunks and posters are immutable. Configure aggressive edge caching:

1. In Cloudflare Dashboard, go to Rules -> Cache Rules -> Create Rule.
2. Rule name: `Cache Video Delivery`
3. Expression: `(http.host eq "video.yourdomain.uz")`
4. Configuration:
   - Cache Eligibility: `Eligible for cache`
   - Edge Cache TTL: `Ignore origin and set edge TTL: 30 days`
   - Browser Cache TTL: `Respect origin`

### CORS Policy

The video player fetches HLS segments (`.ts`) and metadata via XHR/fetch, which requires CORS headers. Under bucket Settings -> CORS Policy, enter:

```json
[
  {
    "AllowedOrigins": [
      "https://yourdomain.uz",
      "https://api.yourdomain.uz",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "Content-Length",
      "Content-Range",
      "ETag"
    ],
    "MaxAgeSeconds": 86400
  }
]
```

### rclone Remote Configuration

Create an R2 API token under Cloudflare Dashboard -> R2 -> Manage R2 API Tokens with Object Read & Write permissions.

Add the configuration to `~/.config/rclone/rclone.conf`:

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = <R2_ACCESS_KEY_ID>
secret_access_key = <R2_SECRET_ACCESS_KEY>
endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
acl = private
```

### Encoding and Uploading Video

Encode source video using `scripts/encode-video.sh`:

```bash
./scripts/encode-video.sh /path/to/raw-video.mov ./dist/lesson-1 hls
```

Upload the encoded directory:

```bash
rclone copy ./dist/lesson-1 r2:funnel-video/lesson-1 --progress
```

### Verify Cache Status

Run two consecutive curl requests to ensure Cloudflare edge cache HIT:

```bash
curl -I https://video.yourdomain.uz/lesson-1/poster.webp
curl -I https://video.yourdomain.uz/lesson-1/poster.webp
```

The second request must return:

```http
cf-cache-status: HIT
```

---

## 4. Coolify Setup (Postgres & API)

Log in to the Coolify dashboard on the Oracle VM (`http://<ORACLE_VPS_PUBLIC_IP>:8000`).

### PostgreSQL 17 Resource

1. Navigate to Projects -> Default -> New Resource -> Database -> PostgreSQL.
2. Settings:
   - Image: `postgres:17-alpine`
   - Database Name: `funnel`
   - Database User: `funnel`
   - Database Password: `<SECURE_PASSWORD>`
3. Note the internal container service name (e.g., `postgresql` or resource UUID).

### Scheduled Backups to R2

1. In the PostgreSQL resource, go to Backups (label may differ).
2. Configure S3-compatible storage:
   - Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - Bucket: `funnel-backups`
   - Access Key ID: `<R2_ACCESS_KEY_ID>`
   - Secret Access Key: `<R2_SECRET_ACCESS_KEY>`
   - Region: `auto`
   - Schedule: Daily at 03:00 UTC (`0 3 * * *`)
3. Test backup execution to verify the dump upload to R2.

### Restore Drill

To restore PostgreSQL from an R2 backup dump:

```bash
rclone copy r2:funnel-backups/latest.sql ./latest.sql
docker exec -i <COOLIFY_POSTGRES_CONTAINER_ID> psql -U funnel -d funnel < ./latest.sql
```

### API Application Settings

1. Navigate to New Resource -> Application -> Git Repository (select repository).
2. General Settings:
   - Branch: `main`
   - Build Pack: `Dockerfile`
   - Base Directory: `/`
   - Dockerfile Path: `apps/api/Dockerfile`
   - Port: `3001`
   - Domain: `https://api.yourdomain.uz`
   - Healthcheck Path: `/health` (interval: 30s)
   - Auto-deploy: Enabled (deploy on git push)
3. Connect Database:
   Set `DATABASE_URL` using the internal container network address:
   ```
   DATABASE_URL=postgres://funnel:<SECURE_PASSWORD>@<INTERNAL_POSTGRES_HOST>:5432/funnel
   ```
4. Set all API environment variables (reference Section 13).
5. Trigger initial deployment. Migrations run automatically on container startup.

---

## 5. Vercel Web App Deployment

The Next.js 16 web app is deployed on Vercel.

1. In Vercel, import the repository.
2. In Project Settings:
   - Framework Preset: `Next.js`
   - Root Directory: `apps/web`
3. Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://api.yourdomain.uz`
   - `NEXT_PUBLIC_BOT_USERNAME`: `your_bot`
4. Domains:
   - Add `yourdomain.uz` and `www.yourdomain.uz`.
   - Ensure Cloudflare DNS points `yourdomain.uz` CNAME to `cname.vercel-dns.com`.
5. Deploy the application.

---

## 6. Telegram BotFather Configuration & Webhook Setup

### Test Bot vs Production Bot

Always maintain two distinct Telegram bots:
- **Test Bot:** used exclusively with local tunnels and staging deploys.
- **Production Bot:** dedicated exclusively to `https://api.yourdomain.uz`.

Never point production webhook or bot credentials to local development tunnels.

### Register Mini App in BotFather

1. Open Telegram and message `@BotFather`.
2. Send `/newapp`.
3. Select your production bot.
4. Provide title and description.
5. Upload a 640x360 image/animation when prompted.
6. Provide Web App URL: `https://yourdomain.uz/app`
7. Set Short Name: `app` (this enables links like `t.me/your_bot/app`).

### Bot Profile Customization

Send the following commands in `@BotFather`:
- `/setdescription`: Enter text displayed on the empty chat screen before pressing Start.
- `/setabouttext`: Enter short bio displayed on the bot's user profile page.
- `/setuserpic`: Upload bot profile photo.

### Set Production Webhook

Run the webhook setup script from the repo using production environment variables:

```bash
BOT_TOKEN="<PRODUCTION_BOT_TOKEN>" \
API_URL="https://api.yourdomain.uz" \
WEBHOOK_SECRET="<PRODUCTION_WEBHOOK_SECRET>" \
pnpm --filter @funnel/api set-webhook
```

Alternatively, configure the webhook using curl:

```bash
curl -F "url=https://api.yourdomain.uz/bot" \
     -F "secret_token=<PRODUCTION_WEBHOOK_SECRET>" \
     https://api.telegram.org/bot<PRODUCTION_BOT_TOKEN>/setWebhook
```

Verify webhook status:

```bash
curl https://api.telegram.org/bot<PRODUCTION_BOT_TOKEN>/getWebhookInfo
```

---

## 7. Google Sheets Lead Synchronization

Leads are queued in Postgres and synced to Google Sheets in-process.

### Google Cloud Service Account

1. In Google Cloud Console, create a new project (e.g., `funnel-leads`).
2. Navigate to APIs & Services -> Enable APIs and Services -> Enable **Google Sheets API**.
3. Navigate to IAM & Admin -> Service Accounts -> Create Service Account.
4. Under Keys -> Add Key -> Create new key -> Select `JSON`. Download the file.

### Environment Variables

From the downloaded JSON key file:
- `client_email` -> Set as `GOOGLE_SA_EMAIL`.
- `private_key` -> Set as `GOOGLE_SA_KEY`.

#### Pasting Multiline Key into Coolify

In Coolify's environment variable interface:
- You can paste the complete multiline PEM string directly (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`).
- Or paste the single-line string with literal `\n`. The API (`apps/api/src/env.ts`) automatically transforms `\n` substrings into real newlines.

### Google Spreadsheet Configuration

1. Create a Google Spreadsheet.
2. Rename the active sheet tab to exactly: `Leads`
3. In Row 1, add the header columns:
   - `Date`
   - `Name`
   - `Phone`
   - `Phone Verified`
   - `Username`
   - `Telegram ID`
   - `UTM Source`
   - `UTM Campaign`
   - `UTM Content`
4. Click Share -> Add the `GOOGLE_SA_EMAIL` address -> Grant **Editor** role.
5. Extract the Sheet ID from the browser URL:
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit` -> set as `SHEET_ID`.

---

## 8. Meta Pixel & Conversions API (CAPI) Integration

### Meta Events Manager Configuration

1. In Meta Business Manager, navigate to Events Manager -> Data Sources.
2. Select your Pixel / Dataset -> Settings:
   - Copy Dataset ID -> Set as `FB_PIXEL_ID`.
3. Under Conversions API -> Set up manually -> Generate Access Token:
   - Copy token -> Set as `FB_CAPI_TOKEN`.
4. Go to the Test Events tab:
   - Select Server -> Copy Test Event Code (e.g., `TEST12345`).
   - Set as `FB_TEST_EVENT_CODE` on the API service.

### Verification

1. Submit a registration via the Mini App.
2. In Meta Events Manager -> Test Events, confirm that the `CompleteRegistration` event is received in real time.
3. Verify event parameters: hashed phone, browser IP, user agent, event ID, and match quality rating.
4. Remove `FB_TEST_EVENT_CODE` from the production environment after verification.

---

## 9. Admin Security & Credentials

### Password Hash Generation

Generate a secure hash for the admin dashboard password:

```bash
pnpm --filter @funnel/api hash-password
```

Set the output hash as `ADMIN_PASSWORD_HASH` on Coolify.

### Session Secret Generation

Generate a cryptographically secure random session secret (minimum 32 characters):

```bash
openssl rand -base64 48
```

Set the generated string as `SESSION_SECRET` on Coolify.

---

## 10. Local Development with Cloudflare Tunnels

Telegram Mini Apps require valid HTTPS to load inside Telegram mobile clients.

### Run Tunnels

In separate terminal windows, start Cloudflare tunnels:

```bash
cloudflared tunnel --url http://localhost:3001
```

```bash
cloudflared tunnel --url http://localhost:3000
```

Note the assigned tunnel URLs:
- API tunnel: `https://<API_TUNNEL>.trycloudflare.com`
- Web tunnel: `https://<WEB_TUNNEL>.trycloudflare.com`

### Configure Local Environment

In `apps/api/.env`:

```env
API_URL=https://<API_TUNNEL>.trycloudflare.com
WEB_URL=https://<WEB_TUNNEL>.trycloudflare.com
```

In `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://<API_TUNNEL>.trycloudflare.com
NEXT_PUBLIC_BOT_USERNAME=your_test_bot
```

### Point Test Bot to Tunnels

1. In `@BotFather`, update the test bot's Mini App URL to `https://<WEB_TUNNEL>.trycloudflare.com/app`.
2. Register the webhook pointing to the API tunnel:

```bash
curl -F "url=https://<API_TUNNEL>.trycloudflare.com/bot" \
     -F "secret_token=<TEST_WEBHOOK_SECRET>" \
     https://api.telegram.org/bot<TEST_BOT_TOKEN>/setWebhook
```

---

## 11. Smoke Test & Launch Checklist

Execute the complete end-to-end user journey:

1. Open `https://yourdomain.uz?utm_source=test&utm_campaign=qa` on a mobile device.
2. Tap CTA button -> redirects to Telegram bot with start param `v_<visitor_id>`.
3. Press Start in bot -> bot replies with welcome message and Mini App button.
4. Tap button -> Mini App opens inside Telegram.
5. Verify user prefill and submit registration with contact share.
6. Verify lead appears in Postgres database and Google Sheets `Leads` tab within 60 seconds.
7. Verify video playback begins with poster image displayed first.
8. Attempt forward seeking on video scrubber -> verify seek lock prevents skipping.
9. Watch through completion threshold (95%).
10. Verify Proceed button unlocks and opens channel link.
11. Confirm CAPI `CompleteRegistration` in Meta Events Manager.
12. Access `https://yourdomain.uz/admin`, authenticate with password, inspect funnel metrics, and export CSV.

### Launch Verification Checklist

- [ ] Landing loads in < 2.5 s on mobile 4G; Pixel `PageView` visible in Events Manager
- [ ] CTA opens the bot with the `v_` start parameter; `bot_start` is linked to the landing visit
- [ ] Registration works with contact share and with manual phone entry
- [ ] Lead appears in Postgres and in Google Sheets within a minute
- [ ] CAPI `CompleteRegistration` received with match quality >= "Good"
- [ ] Seeking ahead is blocked on iOS and Android; rewinding works
- [ ] Proceed button appears only after the full watch; dev-tools tampering doesn't unlock it
- [ ] Channel link opens inside Telegram; `channel_click` recorded
- [ ] Stats funnel numbers match a manual count from one test run
- [ ] Admin page requires login; CSV export works

---

## 12. Disaster Recovery & Rollback Runbook

### Coolify API Rollback

1. In Coolify dashboard, navigate to the API Application -> Deployments (label may differ).
2. Locate the previous stable build.
3. Click Redeploy on the selected commit to revert the container image immediately.

### Vercel Instant Rollback

1. In Vercel Project Dashboard, navigate to Deployments.
2. Find the previous stable production deployment.
3. Click `...` -> Instant Rollback (or Promote to Production).

### Database Restore from R2 Backup

To restore the PostgreSQL database from a scheduled dump:

1. Pull the backup file from Cloudflare R2:
   ```bash
   rclone copy r2:funnel-backups/latest.sql ./latest.sql
   ```
2. Restore the database inside the PostgreSQL container:
   ```bash
   docker exec -i <COOLIFY_POSTGRES_CONTAINER_ID> psql -U funnel -d funnel < ./latest.sql
   ```
3. Restart the API container in Coolify to clear in-memory caches and run any pending startup checks.

---

## 13. Environment Variables Reference Table

Comprehensive reference for all environment variables used by the API and Web applications.

| Variable Name | App / Service | Required / Optional | Default / Example Value | Description |
| --- | --- | --- | --- | --- |
| `PORT` | API (`apps/api`) | Optional | `3001` (default: `3001`) | HTTP port the API server listens on |
| `BOT_TOKEN` | API (`apps/api`) | Required | `123456789:ABCdefGhIJKlmNoPQRstuv` | Telegram Bot API token from BotFather |
| `BOT_USERNAME` | API (`apps/api`) | Required | `your_bot` | Telegram bot username (without @) |
| `WEBHOOK_SECRET` | API (`apps/api`) | Required | `secret-token-32-chars-long` | Secret token (16-256 chars) to validate Telegram webhooks |
| `API_URL` | API (`apps/api`) | Required | `https://api.yourdomain.uz` | Public HTTPS base URL of the API |
| `WEB_URL` | API (`apps/api`) | Required | `https://yourdomain.uz` | Public HTTPS base URL of the Web app |
| `DATABASE_URL` | API (`apps/api`) | Required | `postgres://funnel:pwd@postgresql:5432/funnel` | PostgreSQL 17 connection string |
| `CHANNEL_URL` | API (`apps/api`) | Required | `https://t.me/yourchannel` | Destination Telegram channel URL after completion |
| `VIDEO_URL` | API (`apps/api`) | Required | `https://video.yourdomain.uz/lesson-1/master.mp4` | URL to master video file (MP4 or HLS master.m3u8) |
| `VIDEO_POSTER_URL` | API (`apps/api`) | Required | `https://video.yourdomain.uz/lesson-1/poster.webp` | URL to video poster image |
| `VIDEO_DURATION_SEC` | API (`apps/api`) | Required | `900` | Duration of the video in whole seconds |
| `SEEK_LOCK` | API (`apps/api`) | Optional | `true` (default: `true`) | Lock player forward seeking |
| `GATE_PROCEED` | API (`apps/api`) | Optional | `true` (default: `true`) | Lock Proceed button until completion threshold reached |
| `COMPLETE_THRESHOLD` | API (`apps/api`) | Optional | `0.95` (default: `0.95`) | Proportion required for completion (0.5 to 1.0) |
| `CORS_ORIGINS` | API (`apps/api`) | Optional | `https://yourdomain.uz,http://localhost:3000` | Comma-separated allowed CORS origins |
| `SHEETS_ENABLED` | API (`apps/api`) | Optional | `false` (default: `false`) | Enable Google Sheets sync queue and background retry |
| `GOOGLE_SA_EMAIL` | API (`apps/api`) | Required if `SHEETS_ENABLED=true` | `sa@project.iam.gserviceaccount.com` | Google Cloud Service Account client email |
| `GOOGLE_SA_KEY` | API (`apps/api`) | Required if `SHEETS_ENABLED=true` | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----` | Service Account private key PEM (multiline or escaped `\n`) |
| `SHEET_ID` | API (`apps/api`) | Required if `SHEETS_ENABLED=true` | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` | ID of target Google Spreadsheet from its URL |
| `FB_PIXEL_ID` | API (`apps/api`) | Optional | `123456789012345` | Meta Pixel dataset / pixel identifier |
| `FB_CAPI_TOKEN` | API (`apps/api`) | Optional | `EAAG...` | Meta Conversions API system user access token |
| `FB_TEST_EVENT_CODE` | API (`apps/api`) | Optional | `TEST12345` | Meta test code for server-side event verification |
| `ADMIN_PASSWORD_HASH` | API (`apps/api`) | Optional | `$2a$10$...` | Hash generated via `pnpm --filter @funnel/api hash-password` |
| `SESSION_SECRET` | API (`apps/api`) | Optional | `openssl rand -base64 48` string | Secret key for signing admin session cookies (min 32 chars) |
| `NEXT_PUBLIC_API_URL` | Web (`apps/web`) | Required | `https://api.yourdomain.uz` | Public API URL accessible from browser/Mini App |
| `NEXT_PUBLIC_BOT_USERNAME` | Web (`apps/web`) | Required | `your_bot` | Telegram bot username (without @) for deep linking |
| `TEST_DATABASE_URL` | Test Runner | Optional (CI / Tests) | `postgres://funnel:funnel@localhost:5432/funnel_test` | Isolated database URL for running integration tests |
