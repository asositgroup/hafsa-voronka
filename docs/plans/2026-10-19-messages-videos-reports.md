# Plan: §7 message constructor, §8 video replacement, §9 reports

Source: client spec §7–9 (technical) and §9–11 (plain-language version of the same request).
Client sections 1–6 are treated as done, but these parts of them are not in the code. They are built here with the defaults below.

## Defaults

| Gap | Decision |
|---|---|
| Statuses | From `max_position` against the user's video: `link_berildi` (registered, no `video_start`), `korishni_boshladi` (watching, before the middle of the main lesson), `dars_yarmida` (past the middle, before `course_start_sec`), `sotuvda_toxtadi` (≥ `course_start_sec`, < `price_sec`), `narxni_kurdi` (≥ `price_sec`), `adminga_yozdi` (`channel_click`) |
| Segments | A = `link_berildi`; B = the three watching statuses; C = `narxni_kurdi`. Chain stops on `adminga_yozdi` or 403. Status changes inside B do not restart the chain |
| Link expiry | `users.link_expires_at` = time the link was given + `LINK_TTL_HOURS` (default 72, editable in the panel). After expiry the Mini App shows an "expired, write to admin" screen |
| Night rule (1.1) | Nothing sent 23:00–07:00 Asia/Tashkent; anything due then moves to 07:00 |
| Exact hour already passed | If the user entered the segment after 09:00, a day-1 "09:00" message is skipped |
| `startapp` | `resume` opens at `last_position`; `offer` opens at the video's `course_start_sec` |
| «Qachon ko'rasiz?» | Inline options (Bugun / Ertaga / Keyinroq): the answer is logged as an event and the bot replies with a short ack; the schedule is not changed. «Ha, ko'raman» opens `resume`; «Keyinroq» sends an ack |
| Bot upload over 20 MB | Self-hosted `telegram-bot-api` container in compose (2 GB limit); needs `api_id`/`api_hash`; webhook registered through the local server |
| YouTube links | Not supported: our player can't track a YouTube embed, and downloading breaks YouTube's ToS. Google Drive import is deferred (dropped from Phase 3) |
| Deleting the old reminder (client §7.3 «Eski xabarni o'chirish») | Delete the previous reminder before each send. Telegram only allows deleting messages under 48h old (verify on our bot), so add a 47h sweep: if a reminder is about 47h old and no new one is due before the 48h mark, delete it then. 403 / "message not found" count as success; other errors go to `sent_messages.delete_error` |
| «Menga sinab yuborish» | `ADMIN_TELEGRAM_IDS` env (shared with §8.2); the panel offers a dropdown of admins to send the test to |
| Button click tracking | URL buttons go through `/r/:sentMessageId` (logs the click, then redirects); callback and web_app buttons are logged directly |
| "After the message" window in reports | Until the next message in the chain is sent, at most 48h |
| Excel | `.xlsx` via `write-excel-file` (one small dependency, `fflate`; exceljs is 20+ MB with an aging tree) |

## Scope

The plain version (§9–11) is the agreed scope. The data model still covers the extras in the technical version (timing types a/c, 5 variables, video media), so they can be added later without a migration.

## Data model (drizzle migration 0006+)

- `videos`: id, title, file_url, duration, intro_end_sec, course_start_sec, price_sec, short_offer_video_url, is_active (one active, enforced by a partial unique index), archived_at, created_at
- `users`: add `video_id`, `link_given_at`, `link_expires_at`
- `segment_runs`: user_id, segment, entered_at, ended_at, end_reason. A partial unique index allows one open run per user
- `message_templates`: id, segment, day, order, text, media_file_id, media_type, timing_type, timing_value, buttons_json, is_active, deleted_at, updated_at
- `sent_messages`: id, user_id, template_id, segment_run_id, telegram_message_id, sent_at, deleted_at, delete_error, clicked_at
- `settings`: key/value (`LINK_TTL_HOURS` and the like)
- The migration seeds a video from the current `VIDEO_URL` / `VIDEO_DURATION_SEC` and assigns it to all users. Those env vars are then removed

There is no send queue table. The dispatcher computes due messages on each run from the open run's `entered_at` plus template timing, so text edits, new templates and `is_active` changes apply to unsent messages automatically.

Users keep the video they started on (`users.video_id` stays fixed); only new users get the newly active video. Archived videos stay playable. Deleting a video is blocked while any user is on it.

## Phases

| # | Phase | Agent | Depends on |
|---|---|---|---|
| 1 | Videos core: schema plus seed migration; `/app/session`, credit logic and completion read the user's video; new users get the active video, existing users keep theirs | deep-reasoner (design), fast-worker | – |
| 2 | Status and segment engine: pure `statusFor(progress, video)` and `segmentFor(status)`; transitions write `segment_runs`; stop on `adminga_yozdi` and on 403 (also sets `bot_blocked`); link expiry; `startapp` resume/offer | deep-reasoner | 1 |
| 3 | Videos admin page: presigned R2 multipart upload, duration from player metadata, «Shu joyni belgilash» button, validation (course < price < duration; no price means it can't be activated), activate, archive, delete with confirmation, short offer video | fast-worker | 1 |
| 4 | Message constructor UI and API: segment → 7 day tabs, dnd-kit reordering, timing a/b/c with the night block in the picker, 0–3 buttons, variable whitelist in `@funnel/shared` (zod rejects unknown `{x}`), media through the existing `bot_texts` media pipeline, `is_active`, test send | fast-worker; deep-reasoner for the timing validator | 2 |
| 5 | Dispatcher: 60s loop with an advisory lock (same pattern as `leads/notifier.ts`); due-time calculation, night shift, 10/day cap, delete previous then send, 47h delete sweep, record the send, redirect click logging. TDD on the timing logic, integration test on A→B→C | deep-reasoner (algorithm and tests first), fast-worker | 2, 4 |
| 6 | Bot video flow (§8.2): local Bot API container, `ADMIN_TELEGRAM_IDS` guard, conversation state machine (Ha/Yo'q → MM:SS → MM:SS → summary → Faol qilish), upload to R2 | fast-worker | 1, infra |
| 7 | Reports (§9): per video (given / opened / left within 5 min / reached course part / reached price / wrote to admin, as count and %); per message (sent / clicked / then reached price / then wrote to admin); date range filter; `.xlsx` export | fast-worker | 5 |
| 8 | Acceptance: Test 1 as an integration test (an admin can switch the video, a regular user gets no menu); manual smoke run; update the `docs/DEPLOY.md` env table | fast-worker | all |

Order: 1 → 2 → (3, 4, 6 in parallel) → 5 → 7 → 8.

## Infra to-dos

- `api_id` / `api_hash` from my.telegram.org for the local Bot API server
- R2 API keys with write access for presigned uploads (the current setup only reads)
- `ADMIN_TELEGRAM_IDS`
