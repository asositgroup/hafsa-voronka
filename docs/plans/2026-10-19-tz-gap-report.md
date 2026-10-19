# TZ gap report (§1–9 vs branch feat/messages-videos-reports)

Source TZ: [tz-bonus-dars-voronkasi.md](tz-bonus-dars-voronkasi.md). Checked against the code on 2026-10-19. Static check of the code only; nothing below was verified end-to-end in Telegram.

Legend: ✅ done · 🟡 partial · ❌ missing · ➖ not applicable

## §1. 24h link and reminders for people who haven't opened the video

| Requirement | Status | Notes |
|---|---|---|
| Link expires after 24h | ✅ | Default is now 24h, editable in Sozlamalar (90b5203). Production may still hold 72 until saved |
| Reminder schedule (1, 3, 5, 7, 9, 14, 19, 20–23h) | ✅ | Built in the constructor as "before expiry" messages; `pnpm --filter api seed:templates` loads the TZ texts as starting templates for segments A, B and C (empty segments only) |
| `[X] soat` remaining time | ✅ | `{qolgan_vaqt}` |
| Counted back from expiry, recalculated if expiry changes | ✅ | before_expiry is computed live from `link_expires_at` |
| Stops when the video is opened | ✅ | User moves to segment B |
| §1.1 rule 2: expiry falling at night is extended to 09:00 | ✅ | c2ba852 |
| §1.1 rule 3: night reminders collapse into **one** message at 07:30 with the real remaining time | ✅ | c2ba852 |
| §1.1 rule 4: drop the moved message if another is due within 1h | ✅ | c2ba852 |
| §1.1 rule 5: one 22:00 evening warning when the night swallows ≥2 reminders | ✅ | c2ba852; the night notice template must be created by an admin |
| §1.1 rule 6: someone registering at night gets nothing before 07:30 | ✅ | c2ba852 |

## §2. After expiry: the «afsus» second-chance flow

| Requirement | Status | Notes |
|---|---|---|
| «Afsus» message with Ha / Keyinroq | ✅ | At expiry the A/B chain ends and the «Qayta imkon» (D) run sends the afsus page (4d4baf0). The texts are written by an admin; none are seeded |
| "Ha" reopens the link once for 24h | ✅ | One reopening per offer, restarts the chain with the night rules and keeps progress (4d4baf0) |
| "Keyinroq" → choose a time (Bugun 20:00 / Ertaga 08:00 / Ertaga 20:00 / Boshqa vaqt: day + hour 07–22) | ✅ | Three quick slots plus day then hour (07–22), past slots hidden (e7dc16a) |
| Store `tanlangan_vaqt`, status `qayta_imkon_kutilmoqda` | ✅ | Stored as a pending appointment; the afsus chain waits while it is pending (e7dc16a) |
| Reminder 1h before; at the chosen time a new link and a restart of the §1 chain | ✅ | 1h-before reminder, then a new 24h link at the chosen time that restarts the chain; the reopen grant is offer-first for people who never saw the price (e7dc16a, f910800) |
| Repeat at most once a day, 7 times over 7 days; 7-day «afsus» text bank, no repeats | ✅ | At most once a day, 7 times in 7 days, day-k text (4d4baf0) |

## §3. People who stopped before the sales part

| Requirement | Status | Notes |
|---|---|---|
| Time marks per video, none hardcoded | ✅ | course start, price, optional intro end |
| Statuses `ko'rishni_boshladi` … `narxni_kurdi` | ✅ | The lesson start mark (default 5:00) now drives the boundary (5dcb166) |
| §3.4 a different text depending on where they stopped (0–5 / 5–15 / 15–price) | ✅ | Segment B templates target stop points with the «Kimga» filter (5dcb166) |
| Buttons: Davom ettirish / Faqat kurs haqidagi qism / Narx va shartlarni ko'rish | ✅ | `resume` / `offer` |
| §3.6 timings counted **from when they stopped** | ✅ | Counted from the last progress beat; nothing sent while watching (5dcb166) |
| At most 7 messages in this chain and at most 4 per day | ✅ | Per-audience caps in Sozlamalar; B defaults to 4 per day, 7 total (5dcb166) |
| Night messages move to 07:00–08:00 | ✅ | Now collapsed into one at 07:30 (c2ba852) |
| Stops on narxni_kurdi / adminga_yozdi / bloklagan | ✅ | |
| §3.8 different «afsus» text, and "Ha" first plays the short «Kurs haqida» video | ✅ | Text variant (4d4baf0); "Ha" and a timed reopen play the short clip first, falling back to the course start when the video has none (effcf0e, f910800) |
| §3.9 metrics | ✅ | `/admin/reports` |

## §4. Saw the price but didn't write (progrev)

| Requirement | Status | Notes |
|---|---|---|
| Messages at 10–15 min / 3h / next day / 2–3 days | ✅ | Segment C in the constructor; the seed command loads the TZ texts as starting templates |
| "Adminga yozish" with pre-filled text | ✅ | Needs `CHANNEL_URL` to be a `t.me/username` link |
| Admin marks "yozdi" by hand so progrev stops | ✅ | «Yozdi» lead-card button and "won" both stop reminders (90b5203) |

## §5. Statuses and storage

| Requirement | Status | Notes |
|---|---|---|
| link_berildi → ko'rdi → adminga_yozdi, plus the partial-viewer statuses | ✅ | |
| `qayta_imkon` statuses | ✅ | (4d4baf0) |
| Video sent by the bot with `protect_content`, deleted after 24h | ➖ | We use the Mini App, not a video message |
| Only one reminder in the chat; the previous one is deleted | ✅ | Plus the 47h cleanup sweep |
| On expiry, delete all reminders tied to that link | ✅ | Links are grants; that link's reminders are deleted at expiry (4d4baf0) |
| Separate text bank per day; never repeat a text to the same person | ✅ | Day-k afsus text per second chance, no repeats (4d4baf0) |
| Scheduler every minute; 403 marks the user blocked and stops | ✅ | |
| `tanlangan_vaqt` stored | ✅ | `watch_appointments` (e7dc16a) |

## §6. Resume in the Mini App

| Requirement | Status | Notes |
|---|---|---|
| Server stores lastPosition / maxPosition and resumes from them | ✅ | |
| Range / 206 | ✅ | R2; `scripts/check-range.sh` added (1c34aa1); Test 6 still to be run against prod |
| iOS: set the position again on `canplay` / first `play`, check again after 0.5s | ✅ | 1c34aa1 |
| Progress tick every 5s | ✅ | 1c34aa1 |
| Save on close (`pagehide`, Telegram `close`) | ✅ | 1c34aa1 |
| `Cache-Control: no-store` on `/app/session` | ✅ | 90b5203 |
| Anti-cheat: maxPosition can only grow with elapsed time | ✅ | Credit cap of elapsed × 2 × 1.1 + 2s |
| Backup copy in CloudStorage / localStorage | ✅ | 1c34aa1 |
| «Siz 5:12 da to'xtagan edingiz» screen with Davom ettirish (5s back) / Boshidan | ✅ | Resume overlay (1c34aa1) |
| Seek lock, toast, watched part shown in a different colour | 🟡 | Lock and toast exist; the bar colouring is not verified |
| Speeds 1× / 1.25× / 1.5× / 2× | 🟡 | A speed menu exists; the exact rates are not verified |
| Seek lock comes off **after the price point** as well | ✅ | 1c34aa1 |
| startapp resume / offer | ✅ | |

## §7–9. Constructor, video replacement, reports

| Requirement | Status | Notes |
|---|---|---|
| §7 7-day constructor | ✅ | Timeline view with the full Telegram-HTML editor; drag reorder replaced by time order |
| §7.3 rules | ✅ | Telegram's 48h delete limit covered by the 47h sweep |
| §8 Videos page, «Shu joyni belgilash», activate, archive | ✅ | Plus per-video unlock time and the player |
| §8 Google Drive / YouTube links | 🟡 | Google Drive import is done (1aaaf81): `/admin/videos` copies a Drive file to R2 through the Drive API. YouTube links are not supported |
| §8 short «Kurs haqida» video | ✅ | Uploaded per video on `/admin/videos` and played first on a second chance (effcf0e) |
| §8.2 replace the video from the bot (Test 1) | ✅ | Files over 20 MB need the local Bot API server, not yet tried on staging |
| §9 reports and Excel | ✅ | |

## Where the full TZ contradicts what is built

1. **The 5:00 status boundary**: the TZ fixes it at 5:00, but §8.3 forbids hardcoded times. Using the optional `asosiy_dars_boshlanishi` mark satisfies both.
2. **Daily cap**: 4 per day for §3 in the TZ; the cap is a per-audience panel setting (B defaults to 4 per day, 7 total).
3. **YouTube links** are not supported; only Drive import and direct upload.

## Remaining

1. Phase 7 acceptance: the whole TZ test list (including Test 6 against the production video URL) has not been run on real devices and in Telegram end-to-end
2. Content: admins must write the «Qayta imkon» afsus texts and create the night notice template. The new «Keyinroq» bot texts (picker, reminder, reopen) have defaults and can be edited in the bot texts page
