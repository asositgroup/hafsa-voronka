# TZ gap report (§1–9 vs branch feat/messages-videos-reports)

Source TZ: [tz-bonus-dars-voronkasi.md](tz-bonus-dars-voronkasi.md). Checked against the code on 2026-10-19. Static check of the code only; nothing below was verified end-to-end in Telegram.

Legend: ✅ done · 🟡 partial · ❌ missing · ➖ not applicable

## §1. 24h link and reminders for people who haven't opened the video

| Requirement | Status | Notes |
|---|---|---|
| Link expires after 24h | 🟡 | Expiry is built; the default is **72h**, editable in Sozlamalar |
| Reminder schedule (1, 3, 5, 7, 9, 14, 19, 20–23h) | 🟡 | Can be built in the constructor as "before expiry" messages; the TZ texts are not entered |
| `[X] soat` remaining time | ✅ | `{qolgan_vaqt}` |
| Counted back from expiry, recalculated if expiry changes | ✅ | before_expiry is computed live from `link_expires_at` |
| Stops when the video is opened | ✅ | User moves to segment B |
| §1.1 rule 2: expiry falling at night is extended to 09:00 | ❌ | |
| §1.1 rule 3: night reminders collapse into **one** message at 07:30 with the real remaining time | ❌ | Each night reminder moves to 07:00 separately |
| §1.1 rule 4: drop the moved message if another is due within 1h | ❌ | |
| §1.1 rule 5: one 22:00 evening warning when the night swallows ≥2 reminders | ❌ | |
| §1.1 rule 6: someone registering at night gets nothing before 07:30 | 🟡 | We hold until 07:00 |

## §2. After expiry: the «afsus» second-chance flow

| Requirement | Status | Notes |
|---|---|---|
| «Afsus» message with Ha / Keyinroq | ❌ | The Mini App shows a "link expired, write to admin" screen; reminders keep running after expiry |
| "Ha" reopens the link once for 24h | ❌ | |
| "Keyinroq" → choose a time (Bugun 20:00 / Ertaga 08:00 / Ertaga 20:00 / Boshqa vaqt: day + hour 07–22) | ❌ | Existing «Qachon ko'rasiz?» menu (Bugun/Ertaga/Keyinroq) only logs the answer and replies |
| Store `tanlangan_vaqt`, status `qayta_imkon_kutilmoqda` | ❌ | |
| Reminder 1h before; at the chosen time a new link and a restart of the §1 chain | ❌ | |
| Repeat at most once a day, 7 times over 7 days; 7-day «afsus» text bank, no repeats | ❌ | |

## §3. People who stopped before the sales part

| Requirement | Status | Notes |
|---|---|---|
| Time marks per video, none hardcoded | ✅ | course start, price, optional intro end |
| Statuses `ko'rishni_boshladi` … `narxni_kurdi` | 🟡 | **The boundary differs**: the TZ splits `ko'rishni_boshladi` / `dars_yarmida` at **5:00**; we use the midpoint between intro end and course start |
| §3.4 a different text depending on where they stopped (0–5 / 5–15 / 15–price) | ❌ | Segment B is one list for all three sub-statuses |
| Buttons: Davom ettirish / Faqat kurs haqidagi qism / Narx va shartlarni ko'rish | ✅ | `resume` / `offer` |
| §3.6 timings counted **from when they stopped** | 🟡 | We count from when they first opened the video (entering B); "next morning 08:00" and "N hours before expiry" do work |
| At most 7 messages in this chain and at most 4 per day | 🟡 | Single global cap of 10 per day |
| Night messages move to 07:00–08:00 | ✅ | Moved to 07:00 |
| Stops on narxni_kurdi / adminga_yozdi / bloklagan | ✅ | |
| §3.8 different «afsus» text, and "Ha" first plays the short «Kurs haqida» video | ❌ | This is what the short offer video is for; its upload is built but hidden and nothing plays it |
| §3.9 metrics | ✅ | `/admin/reports` |

## §4. Saw the price but didn't write (progrev)

| Requirement | Status | Notes |
|---|---|---|
| Messages at 10–15 min / 3h / next day / 2–3 days | ✅ | Segment C in the constructor; the TZ texts are not entered |
| "Adminga yozish" with pre-filled text | ✅ | Needs `CHANNEL_URL` to be a `t.me/username` link |
| Admin marks "yozdi" by hand so progrev stops | ❌ | Only the button click counts; the lead card's Won/Lost buttons don't stop the chain |

## §5. Statuses and storage

| Requirement | Status | Notes |
|---|---|---|
| link_berildi → ko'rdi → adminga_yozdi, plus the partial-viewer statuses | ✅ | |
| `qayta_imkon` statuses | ❌ | Depends on §2 |
| Video sent by the bot with `protect_content`, deleted after 24h | ➖ | We use the Mini App, not a video message |
| Only one reminder in the chat; the previous one is deleted | ✅ | Plus the 47h cleanup sweep |
| On expiry, delete all reminders tied to that link | ❌ | |
| Separate text bank per day; never repeat a text to the same person | 🟡 | No repeats within one chain; no rule across second chances |
| Scheduler every minute; 403 marks the user blocked and stops | ✅ | |
| `tanlangan_vaqt` stored | ❌ | Depends on §2 |

## §6. Resume in the Mini App

| Requirement | Status | Notes |
|---|---|---|
| Server stores lastPosition / maxPosition and resumes from them | ✅ | |
| Range / 206 | ✅ | R2; Test 6 not yet run against prod |
| iOS: set the position again on `canplay` / first `play`, check again after 0.5s | ❌ | Only set on `loadedmetadata` |
| Progress tick every 5s | 🟡 | Every 10s |
| Save on close (`pagehide`, Telegram `close`) | 🟡 | Only on `visibilitychange` |
| `Cache-Control: no-store` on `/app/session` | ❌ | |
| Anti-cheat: maxPosition can only grow with elapsed time | ✅ | Credit cap of elapsed × 2 × 1.1 + 2s |
| Backup copy in CloudStorage / localStorage | ❌ | |
| «Siz 5:12 da to'xtagan edingiz» screen with Davom ettirish (5s back) / Boshidan | ❌ | Silently resumes at the last position |
| Seek lock, toast, watched part shown in a different colour | 🟡 | Lock and toast exist; the bar colouring is not verified |
| Speeds 1× / 1.25× / 1.5× / 2× | 🟡 | A speed menu exists; the exact rates are not verified |
| Seek lock comes off **after the price point** as well | 🟡 | Only after completion |
| startapp resume / offer | ✅ | |

## §7–9. Constructor, video replacement, reports

| Requirement | Status | Notes |
|---|---|---|
| §7 7-day constructor | ✅ | Timeline view with the full Telegram-HTML editor; drag reorder replaced by time order |
| §7.3 rules | ✅ | Telegram's 48h delete limit covered by the 47h sweep |
| §8 Videos page, «Shu joyni belgilash», activate, archive | ✅ | Plus per-video unlock time and the player |
| §8 Google Drive / YouTube links | ❌ | Deferred |
| §8 short «Kurs haqida» video | 🟡 | Upload is built but hidden; nothing uses it yet (see §3.8) |
| §8.2 replace the video from the bot (Test 1) | ✅ | Files over 20 MB need the local Bot API server, not yet tried on staging |
| §9 reports and Excel | ✅ | |

## Where the full TZ contradicts what is built

1. **Link length**: the TZ says 24h; the default is 72h.
2. **Chain start**: the TZ counts §3 timings from when the person **stopped**; we count from when they **entered the segment**.
3. **The 5:00 status boundary**: the TZ fixes it at 5:00, but §8.3 forbids hardcoded times. Using the optional `asosiy_dars_boshlanishi` mark satisfies both.
4. **Night handling**: the TZ wants the expiry extension, collapsing night reminders and a 22:00 evening warning; we shift each message to 07:00.
5. **After expiry**: the TZ wants the §2 «afsus» flow; we show an expired screen and reminders keep running.
6. **Daily cap**: 4 per day for §3 in the TZ; we have 10 per day globally.

## Biggest gaps

1. §2 second-chance flow, together with §3.8 and the short video
2. §1.1 night rules
3. §3.4 sub-status targeting and §3.6 timings counted from the stop
4. §6 resume reliability
5. Small items: admin marks "yozdi" by hand, 24h default, the 5:00 boundary, the 4-per-day cap for §3
