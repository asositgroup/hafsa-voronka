# Telegram Video Lead Funnel

A high-converting video lead generation funnel built for Telegram, combining a Next.js 16 landing page and Telegram Mini App with a containerized Hono/grammY API, seek-locked video playback with server-side completion tracking, automated Google Sheets sync, Meta Conversions API (CAPI) attribution, and an administrative metrics dashboard.

---

## Architecture

```
                       [ User Mobile / Browser ]
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   [ Landing Page (Vercel) ]                 [ Telegram App ]
      https://yourdomain.uz                             │
              │ (CTA: t.me/bot?start=v_123)             ▼
              └──────────────────────────────► [ Telegram Bot ]
                                                        │
                                                        ▼
                                             [ Mini App (Vercel) ]
                                            https://yourdomain.uz/app
                                                        │
                         ┌──────────────────────────────┼──────────────────────────────┐
                         ▼                              ▼                              ▼
                 [ Video Stream ]                 [ Hono API ]                 [ Telegram Client ]
              (Cloudflare R2 CDN)            (Docker Compose VPS)            (WebApp SDK / initData)
             video.yourdomain.uz               api.yourdomain.uz
                                                        │
                                       ┌────────────────┼────────────────┐
                                       ▼                ▼                ▼
                                 [ PostgreSQL ]  [ Google Sheets ]  [ Meta CAPI ]
                                    (DB 17)        (Lead Sync)     (Events Manager)
```

### Components

- **`apps/web` (Next.js 16.4, React 19, Tailwind CSS 4):**
  Deployed to Vercel. Contains the public landing page, admin analytics dashboard, and the Telegram Mini App shell mounted at `/app`. Communicates with the API over HTTPS.
- **`apps/api` (Hono, grammY, Drizzle ORM, postgres.js):**
  Deployed with Docker Compose on a VPS. Handles webhook updates from Telegram, validates Telegram `initData` cryptographically, manages user progression and watch state, queues leads for Google Sheets sync, sends Meta Conversions API events, and serves admin API routes.
- **`packages/shared` (`@funnel/shared`):**
  Shared TypeScript zod schemas, phone normalization utilities, and shared constants.
- **Video Delivery (Cloudflare R2):**
  Static MP4 or multi-bitrate HLS streams served from Cloudflare R2 behind Cloudflare CDN caching on `video.yourdomain.uz`.

---

## Local Development Quick Start

### Prerequisites

- Node.js 24+
- pnpm 11+
- Docker (for local PostgreSQL 17)
- `ffmpeg` and `ffprobe` (for video encoding)
- `cloudflared` (for Telegram Mini App HTTPS tunneling)

### 1. Start Local Database

Start the PostgreSQL 17 container defined in `docker-compose.yml`:

```bash
docker compose up -d
```

### 2. Configure Environment Files

Create `apps/api/.env`:

```env
PORT=3001
BOT_TOKEN=123456789:TEST-token
BOT_USERNAME=your_test_bot
WEBHOOK_SECRET=local-webhook-secret-token-32-chars
API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
DATABASE_URL=postgres://funnel:funnel@localhost:5432/funnel
CHANNEL_URL=https://t.me/yourchannel
VIDEO_URL=https://video.yourdomain.uz/lesson-1/master.mp4
VIDEO_POSTER_URL=https://video.yourdomain.uz/lesson-1/poster.webp
VIDEO_DURATION_SEC=900
SEEK_LOCK=true
GATE_PROCEED=true
COMPLETE_THRESHOLD=0.95
CORS_ORIGINS=http://localhost:3000
SHEETS_ENABLED=false
LEADS_CHAT_ID=
LEADS_THREAD_ID=
```

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BOT_USERNAME=your_test_bot
```

### 3. Install Dependencies and Run Migrations

```bash
pnpm install
pnpm --filter @funnel/api db:migrate
```

### 4. Start Development Servers

Run all workspace applications in parallel:

```bash
pnpm dev
```

The web app is available at `http://localhost:3000` and the API at `http://localhost:3001`.

### 5. Expose Local Services via Tunnels

Telegram Mini Apps and Bot webhooks require publicly accessible HTTPS URLs:

Start the API tunnel:

```bash
cloudflared tunnel --url http://localhost:3001
```

Start the Web tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Update `API_URL` and `WEB_URL` in `apps/api/.env`, and `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` to point to the assigned tunnel URLs. Update your test bot's Web App URL in `@BotFather` to `https://<WEB_TUNNEL>.trycloudflare.com/app`.

Register your test bot webhook:

```bash
pnpm --filter @funnel/api set-webhook
```

---

## Lead Capture Flow

1. **Landing form.** Every CTA on the landing page opens a modal asking for name and phone. The form posts to `POST /leads` (rate limited per IP and visitor, with a honeypot field), which stores the lead in the `leads` table, logs a `lead_submitted` event, sends a Meta `Lead` event (deduplicated with the browser pixel via `event_id`), and appends a `sayt` row to Google Sheets when enabled. The visitor is then redirected to `t.me/<bot>?start=v_<visitorId>`.
2. **Bot registration.** `/start` asks the user to tap the «📱 Raqamni yuborish» button. Only a shared contact registers the user; typed numbers are refused. The name typed on the landing page is used when a web lead matches (by visitor id, then by phone). The Mini App shows a "register in the bot first" screen until registration is done, and `POST /app/register` returns `403`.
3. **Group alerts.** When `LEADS_CHAT_ID` is set, the bot posts one card per lead to that group and edits it as the lead progresses (web lead, then registered with Telegram handle and ID, then finished video). Finishing the video also posts a short reply under the card. Delivery runs in the background with retries (up to 10 attempts, leads from the last 3 days).
4. **Sales buttons.** Each card carries three buttons:
   - **🙋 Men olaman** binds the lead to whoever presses it first. Later presses only show who owns the lead; the button then shows the owner's name.
   - **✅ Muvaffaqiyatli** and **❌ Yo'qotildi** record the outcome. Only the salesman who claimed the lead can press them, and the outcome is final: the buttons disappear and the card shows the result.

   Buttons only work inside the group set in `LEADS_CHAT_ID`.

### Setting up the leads group

1. Add the bot to the group (or supergroup with topics).
2. Send `/chatid` in the group (or in the topic you want). The bot replies with `LEADS_CHAT_ID` (and `LEADS_THREAD_ID` for topics).
3. Put those values in `apps/api/.env` and restart the API.
4. Re-run `pnpm --filter @funnel/api set-webhook` so Telegram delivers button presses (`callback_query` updates).

---

## Available Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Run all workspace applications concurrently in development mode |
| `pnpm build` | Build all workspace applications for production |
| `pnpm test` | Run test suites across all packages |
| `pnpm typecheck` | Run TypeScript type checks across all packages |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm --filter @funnel/api db:migrate` | Apply database migrations |
| `pnpm --filter @funnel/api set-webhook` | Register Telegram webhook with Telegram Bot API |
| `pnpm --filter @funnel/api hash-password` | Generate bcrypt password hash for admin authentication |
| `scripts/encode-video.sh <input> <out_dir> [mp4\|hls]` | Encode video for R2 streaming and export WebP poster |

---

## Production Deployment

For complete end-to-end instructions on configuring Cloudflare DNS, the VPS API server, Cloudflare R2, Vercel, Telegram BotFather, Google Sheets, Meta CAPI, and rollback procedures, refer to the [Production Deployment Runbook](docs/DEPLOY.md).
