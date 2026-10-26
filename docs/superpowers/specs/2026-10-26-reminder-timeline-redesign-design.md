# Reminder timeline redesign

## Why

The sales team writes reminders in the admin «Eslatmalar» pages and expects them to go out on days 1–7. They don't. The lesson link closes after 24 hours (`LINK_TTL_HOURS`), the person is then moved to a separate «Qayta imkon» stage (segment D) with its own rules (one «afsus» offer per day, 7 occasions, own window, own variants), and every A/B reminder after day 1 is silently dropped. On top of that the admin page mixes three timing kinds, a night rule, an evening night-notice and a stage-specific page layout. The team reads it as "you can only write one message".

The goal is one simple, predictable model the team can reason about from the admin screen alone, and to delete the machinery that exists only to support the old model.

## Behaviour

### Stages

Three stages remain, each with its own 7-day reminder timeline:

- **A** — got the link, didn't open the video
- **B** — started watching, stopped before the price
- **C** — saw the price, didn't write to the admin

Moving into a stage (by watching progress, or by a restart, see below) starts that stage's timeline at day 1 from that moment. Existing stage-transition rules (A→B on play, B→C on reaching the price, writing to the admin stops everything) stay as they are.

Segment **D («Qayta imkon») is removed** as a stage. A person whose link has closed stays in A or B.

### Timeline and timing

- **Day 1:** each reminder is "+X after entering the stage" (minutes/hours, as today's "+1 soat"). For stage B, day 1 keeps today's anchor: "+X after the last pause" (`chainAnchor` / stop-anchoring), so nothing fires while they are watching.
- **Days 2–7:** each reminder is an exact Tashkent clock time on that day (e.g. 2-kun 10:00). Day N is the Nth Tashkent calendar day counting the stage-entry day as day 1, for every stage including B (entry, not last pause).
- Any number of reminders per day, ordered by time; same-time reminders keep a manual order (existing up/down reordering).
- After the last day-7 reminder the bot sends nothing more until the person interacts again.
- Two reminders close together both send (the current "drop if within 1 hour of another" rule goes).
- A reminder whose time has already passed when it would be planned (e.g. stage entered late) is skipped, not sent late. Existing grace behaviour for a slightly late dispatcher tick is fine to keep.

### Link and «afsus»

- The link still closes after `LINK_TTL_HOURS` (default 24h).
- **Day 2+ reminders while the link is still open (owner decision, A and B only):** a day 2–7 reminder whose time falls before the current link closes is not sent at its time. Among those reminders only the earliest (by time, then day, then manual order) is kept; it is sent when the link closes, so its «Ha, ko'raman» button is never removed by the expired-link cleanup. The other ones are skipped for good. If the link closes after the end of day 7, none of them is sent. Reminders timed at or after the link closes, day-1 reminders and stage C are unaffected. The admin editor says this under the day 2–7 time field.
- «Afsus» is no longer a mechanism; it is an ordinary reminder an admin writes (typically day 2), with the existing `again` («Ha, ko'raman») and `later` («Keyinroq») buttons available to any reminder.
- **«Ha»** reopens the lesson immediately with a fresh link. **«Keyinroq»** lets the person pick a time (existing picker flow) and reopens the lesson then.
- **Restart rule:** any reopen of a closed lesson issues a new link and restarts the person's current stage timeline at day 1. Reopen paths: «Ha» on any reminder, «Keyinroq» firing at the picked time, the reopen button on the mini-app "lesson closed" screen, and /start after the link has closed. This is deliberate: it keeps "lesson open" reminders on day 1 and "lesson closed" reminders on day 2+ always true.
- **No reopen limit (owner decision: the goal is to sell, don't block).** A «Ha» button on any old message, from any earlier round, reopens if the lesson is closed. `offerClosed` is no longer needed for staleness.
- **On a still-open link** (your call, see below): «Ha» just opens the video; «Keyinroq» keeps today's `remind` purpose (reminds at the picked time, no new link, no restart).
- **"Lesson closed" screen** in the mini-app always shows a reopen («Ha, ko'raman») button that triggers the restart rule. It no longer depends on an open D offer.
- **Where a reopened lesson starts:** unchanged from today. People in stage B open at the sales part (`offerFirst`), others resume as today.
- The 1-hour pre-reminder before a «Keyinroq» reopen, the reopen message and their bot-text cards (`reopenPreReminder`, `reopenNow`) stay.
- The link-expiry night extension (`linkExpiryFor` moving 23:00–07:00 expiries to 09:00) stays.

### Targeting options (kept)

- **"Qaysi havola"** (link attempt 1, 2, …): kept. Each reopen increments the attempt as today. Since reopens are unlimited, the options are 1…7 plus a last "8+" option meaning "8th link and later" (builder call).
- **B-stage status targeting** (stopped early / mid-lesson / before sales part): kept.
- **Per-stage caps** (`MESSAGE_CAPS`): daily and total both kept; the total resets on every restart (it counts per stage run, not per person lifetime).

### Removed

- Segment D, its occasions, its page, its offer table logic, the separate «no_price» afsus variant (A vs B stage already separates those audiences).
- The 22:00 night notice (`night_notice` timing).
- The 23:00–07:00 night rule and morning collapse (admins choose times; day-1 relative reminders that land at night still send — see open builder call below).
- The `before_expiry` timing.
- The `occasion` timing.
- Bot-text cards used only by D. `reopenPreReminder`, `reopenNow`, `laterAsk`/picker cards and `remindNow` stay (Keyinroq flow). `offerClosed` goes if nothing references it after staleness checks are removed.
- `MAX_LINK_ATTEMPTS` as a hard cap on reopens.

## Admin screen

Per-stage page (`/admin/messages?stage=A|B|C`):

- A row of day tabs «1-kun» … «7-kun», each showing a count of active reminders; empty days visibly 0.
- Selecting a tab lists that day's reminders sorted by time (time, text preview, button labels, active switch, reorder for same-time items) and a "+ N-kunga eslatma qo'shish" button.
- The editor's timing field is "+X soat/daqiqa" on day 1 and a clock time on days 2–7; the day is taken from the selected tab.
- The night-rules box, the evening-notice box and the "Jadvalni sinash" simulator are removed (simulator may come back later as a separate request).
- The stage overview page drops the «Qayta imkon» card.
- Mobile-first layout: tabs scroll horizontally on narrow screens.

Approved mockup: option A in `.superpowers/brainstorm/39601-1792995011/content/day-layout-v2.html`.

## Data migration (production)

One migration, run once, idempotent:

1. **D occasion templates → A/B day reminders.** For occasion N in 1…6: copy the `not_opened` page into stage A and stage B as day N+1 at 10:00; if a `no_price` page exists for that occasion, use it for stage B instead of the `not_opened` one. Keep text, media, buttons, active flag. Occasion 7 has no day 8 and is dropped; the migration logs which texts were dropped.
2. **Existing A/B/C templates:**
   - `after_entry` on day 1 → day-1 relative (unchanged meaning).
   - `after_entry` beyond day 1 → that day at the Tashkent clock time it would have landed on for someone entering at 00:00 (i.e. minute-of-day of the offset).
   - `day_time` → unchanged meaning (day N, clock time).
   - `before_expiry` → day-1 relative at `LINK_TTL_HOURS − X` (current TTL at migration time).
   - `night_notice` → deleted (soft-delete like other deletions).
3. **People currently in D:** end their D run and put them back by their watch status: A if they never opened the video, B if they stopped before the price, C if they already reached the price. The new run starts at the start of yesterday in Tashkent, so they are on day 2 at migration time and only see day 2+ reminders. Nothing is sent immediately and no new link is issued. Pending «Keyinroq» appointments stay valid.
4. Old D offer history is kept for reports; no new rows are written to it.

## Reports

- The per-message report already groups by stage/day; D rows disappear for new data. Historic D rows may stay visible under a "Qayta imkon (eski)" label or be hidden — builder's call, minimal effort.
- Lead card "🔁 Qayta imkon: x/7" line is removed or replaced by the link attempt count — builder's call.

## Constraints

- Uzbek admin copy, matching existing tone in `apps/web/lib/i18n/admin.ts`.
- No code comments (project owner rule).
- Instagram/mobile audience; admin is used on phones too.
- Keep `pnpm typecheck`, `pnpm lint`, `pnpm test` green; integration tests need `TEST_DATABASE_URL`.
- Rewrite or delete tests that encode removed behaviour rather than keeping dead code alive.

## Goals / non-goals / anti-goals

- **Goal:** what admins see in the day tabs is exactly what a person gets, with no hidden switching.
- **Goal:** less code: removing D, night rules and extra timing kinds should shrink the dispatcher and planner.
- **Non-goal:** new analytics, schedule simulator, A/B testing of texts.
- **Anti-goal:** any rule that silently drops or delays a reminder an admin wrote (other than "already passed", the daily cap, the person writing to the admin / blocking the bot, and the day 2+ while-the-link-is-open rule: the earliest one is delayed to the link closing and the rest are skipped).

## Calls made by the design author (not owner decisions)

- Ha/Keyinroq on a still-open link don't restart (see Link and «afsus»).
- B keeps opening at the sales part after reopen.
- 1-hour pre-reminder and night link-expiry extension stay.
- `before_expiry` migration measures against raw `LINK_TTL_HOURS`, ignoring the night extension.
- Occasion 7 «afsus» text is dropped in migration (no day 8).
- "Qaysi havola" gets an "8+" bucket.

## Left to the builder

- Exact data model changes (reuse `message_templates.day` + a single timing value per row is expected).
- Whether day-1 relative reminders that land at night still send immediately — default: send as scheduled; flag if this looks wrong in testing.
- How the migration is implemented (drizzle migration + TS backfill script, or SQL only).
