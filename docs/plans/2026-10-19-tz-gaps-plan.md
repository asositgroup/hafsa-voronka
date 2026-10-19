# Plan: closing the TZ gaps (§1–6, §8 Drive)

Inputs: [TZ](tz-bonus-dars-voronkasi.md), [gap report](2026-10-19-tz-gap-report.md), [previous plan](2026-10-19-messages-videos-reports.md).
Every ❌ and 🟡 in the gap report is assigned to a phase below. Phases ship one at a time, each with its own migration, and each leaves the bot working.

Start this work only after the admin UI changes on `feat/messages-videos-reports` are committed. The next migration number is **0014**. The numbers below assume the phases merge in order; when phases run in parallel (6a ∥ 6b), number the migrations at merge time.

Rules for all phases: TDD (write the failing test first), **no code comments**, no hardcoded user-facing bot copy (Uzbek defaults go in the existing `defaultText` mechanism, and admins can override them), and Tashkent time stays a fixed UTC+5 (`TASHKENT_OFFSET_MS`).

## Architecture we keep

- The dispatcher computes due messages on every tick from `segment_runs` plus `message_templates`. There is no send queue. Edits apply to messages not yet sent.
- One open run per user (`segment_runs_one_open_idx`). A segment change ends the run, and the new segment starts at day 1.
- Funnel status comes from `watch_progress` against the user's video (`statusFor`) and is never stored.
- `sent_messages` is the log of what was sent, the delete-previous source, and the input for reports.
- Every scheduled send goes through `dispatchMessages`, which holds the advisory lock. New time-driven work (link expiry, appointments) runs inside that same locked tick, so it never races itself.

## Phase map

| # | Phase | Closes | Agent | Depends on |
|---|---|---|---|---|
| 1 | Quick wins: 24h default, manual «yozdi», `no-store` | §1 TTL, §4, §6.1-5 | fast-worker | – |
| 2 | Night planner (§1.1) and expiry extension | §1.1 rules 1–6, §3.6 night | deep-reasoner (planner and tests) → fast-worker (UI) | 1 |
| 3 | Segment B precision (§3) | §3.2 boundary, §3.4, §3.6 anchor, caps | deep-reasoner (anchor and caps) → fast-worker | 2 |
| 4 | Mini App resume reliability (§6) | all §6 🟡/❌ | fast-worker; deep-reasoner reviews the anti-cheat change | 1 (can run alongside 2–3) |
| 5 | Link grants, expiry → «afsus», «Ha» (§2, §5) | §2 afsus/Ha/bank/caps, §5 statuses, delete on expiry, no-repeat | deep-reasoner (state model) → fast-worker | 2, 3 |
| 6a | «Keyinroq» time picker and appointments (§2) | tanlangan_vaqt, 1h reminder, reopen at the chosen time | fast-worker (on 5's design) | 5 |
| 6b | §3.8 short «Kurs haqida» video | §3.8, §8 short video | fast-worker | 5 |
| 7 | Acceptance and docs | §6.3, rollout | fast-worker | all |
| 8 | Google Drive import (optional) | §8 Drive | fast-worker | – |

Order: 1 → (2 ∥ 4) → 3 → 5 → (6a ∥ 6b) → 7 → 8.

---

## Phase 1 — Quick wins

**Goal**: change the default link length, add a manual "wrote to admin" mark, and stop `/app/session` being cached.
**TZ**: §1 (24h), §4 («Admin … botga "yozdi" deb belgilashi kerak»), §6.1 cause 5.

### Decisions
- **Default `LINK_TTL_HOURS` = 24** (`DEFAULT_LINK_TTL_HOURS` in `settings/service.ts`). No migration is needed. Deploy checklist: if prod has a `settings` row set to 72, change it in Sozlamalar.
- **Add a new column `users.wrote_admin_at` instead of reusing `channel_click_at`.**
  - Why: `channel_click_at` is an analytics fact (the button was clicked) and feeds the §9 reports. A manual mark is a different fact. Writing both into one column would corrupt the click metrics.
  - `wrote_admin_at` becomes the single stop signal. Both a click (`recordChannelClick`) and a manual mark set it, so every check reads one column.
- `statusFor` returns `adminga_yozdi` when `wroteAdminAt !== null`. Every `channel_click_at is null` check in `dispatch.ts` (`loadCandidates`, the `sendOne` reserve) changes to `wrote_admin_at is null`.
- **Where the admin marks it**: a new lead card button «✍️ Yozdi» (`lead:wrote:<id>`) in the leads group. Any leads-chat member can press it; no claim is needed, because it records a fact, not an outcome. Pressing it again does nothing (idempotent). The card then shows `✍️ Adminga yozdi · <who> · <time>`.
  - A `won` outcome also sets `wrote_admin_at`, since a won lead clearly talked to an admin. `lost` does not.
  - The admin panel has no per-user page yet, so the lead card is the only place to mark. Undo is not offered (see open questions).
- `Cache-Control: no-store` on `/app/session` and `/app/progress` responses.

### Data model — `0014_wrote_admin.sql`
- `users.wrote_admin_at timestamptz`, `users.wrote_admin_by bigint` (the admin's telegram id; null when set by a click).
- Backfill: `update users set wrote_admin_at = channel_click_at where channel_click_at is not null`.
- Segment end reason `wrote_admin` already exists.

### API and bot
- New `markWroteAdmin(userId, actor | null, now)` in `funnel/channel.ts`, used by `recordChannelClick`, the lead action and `won`. It sets the column only when it is null, then calls `syncSegment` (the run ends with `wrote_admin`) and `refreshUserLeadCards`.
- `applyLeadAction` gets a `wrote` action. `renderLeadKeyboard` shows «✍️ Yozdi» while `wrote_admin_at` is null, even after an outcome has been set.

### Tests
- Unit: `statusFor` returns `adminga_yozdi` from `wroteAdminAt`. `renderLeadCard` and the keyboard show the mark.
- Integration: the lead `wrote` action ends the open run and the dispatcher sends nothing more. `won` also stops the chain. A click still records `channel_click_at`.
- Route: `/app/session` returns `cache-control: no-store`.

### Risks
- Leads that don't link to a `users` row (web-only leads): the button is hidden when `lead.userId` is null.

---

## Phase 2 — Night planner (§1.1) and expiry extension

**Goal**: implement §1.1 rules 1–6 exactly, for after-entry (a) and before-expiry (c) timings in every segment, and turn the TZ example table into a test.
**TZ**: §1, §1.1, §3.6 (night line), §7.2 («(a)/(c) tunga tushsa 1.1-band qoidasi ishlaydi»).

### Reconciling with the current 07:00 shift
§7.2 says (a)/(c) timings that fall at night follow §1.1. §3.6 says night messages move to «7:00–8:00» **and** follow §1.1, and the 07:30 collapse satisfies both. Day-time (b) timings can't be set at night.

**Decision: one night policy everywhere, §1.1. The per-message 07:00 shift (`shiftOutOfNight` in `dueAt`) and `carriedOverNight` are deleted.** Rule 5 (the 22:00 warning) applies only to runs tied to a link (A, B), and only on the night right before expiry. That is the only night where «ertaga soat HH:MM gacha» is true.

### Expiry extension (rule 2), stored
- Pure `linkExpiryFor(givenAt, ttlHours)` in `messages/plan.ts`: `raw = givenAt + ttl`. If `raw` falls in [23:00, 07:00) Tashkent time, the result is 09:00 of that morning.
- `markRegistered` stores the result in `users.link_expires_at`. Phase 5's link grants call the same function.
- Rule 1 already holds: before-expiry is computed live from the stored expiry.

### Planner (pure; `apps/api/src/messages/plan.ts`; replaces `dueAt`/`pendingSchedule`/`effectiveSchedule`)

```ts
type PlanInput = {
  templates: ScheduleTemplate[];
  anchorAt: Date;
  linkExpiresAt: Date | null;
  linkBound: boolean;
  nightNotice: ScheduleTemplate | null;
};
type PlanItem = { template: ScheduleTemplate; sendAt: Date; slot: string; kind: "regular" | "collapsed" | "night_notice" };
function planChain(input: PlanInput): PlanItem[];
```

Algorithm:
1. **Raw times**:
   - after_entry = `anchor + v`.
   - day_time = local day of the anchor + (day − 1) days + v. Drop it if earlier than the anchor.
   - before_expiry = `E − v`. Drop it if earlier than the anchor.
   - For every timing, drop the item if it is at or after `E` (when `linkBound`) or at or after `anchor + 7d`.
2. **Night windows**: each night is [23:00, 07:00). **Rule 6**: if the anchor itself falls at night, that night's window ends at **07:30** instead. An item whose raw time is inside a window is *swallowed* by that night. Every other item is a *day item* and is sent at its raw time.
3. For each night with swallowed set S (non-empty):
   - **Rule 3**: the collapse candidate is the item in S with the **latest** raw time (least time left; ties broken by position, then id). It is sent at **07:30** of that morning, and `{qolgan_vaqt}` is filled live at send time, as it is today.
   - Drop the candidate if 07:30 ≥ `E`.
   - **Rule 4**: drop the candidate if any day item is less than 60 minutes from 07:30, in either direction.
   - **Rule 5**: if `|S| ≥ 2`, the run is `linkBound`, `nightNotice` exists, the local date of `E` equals the date of that morning, and 22:00 of the evening before is at or after the anchor, add the night notice at 22:00 with `slot = <morning date>`.
4. Return day items, the kept collapse candidates and the night notices, sorted by send time.

The plan does not depend on what has already been sent. That keeps it stable: sending one item never changes which item gets collapsed or dropped. The sent set is subtracted afterwards, keyed by `(template_id, slot)`.

`pickNext(plan, sent, now, counters, caps)` returns the earliest unsent item with `sendAt ≤ now ≤ sendAt + GRACE`. It returns nothing at night or when a cap is hit. `nextPendingDue` (used by the 47h sweep) is built on the plan.

### The 22:00 warning text is admin-editable
**Decision: a constructor template with a new timing type `night_notice`, at most one per segment (partial unique index on `segment` where `timing_type = 'night_notice' and deleted_at is null`). Not a `bot_texts` key.**
- Why: it is a chain reminder. It needs delete-previous, `sent_messages` tracking, the per-message report, the active toggle, a test send, buttons and media. The constructor already has all of these; `bot_texts` has none of them.
- New variable `{link_tugash_soati}` (HH:MM of `E`), added to `templateVariables` and `TEMPLATE_VARIABLE_MAX_LENGTH` (5). The TZ text needs «ertaga soat [HH:MM] gacha», and the existing `{link_tugash_vaqti}` renders «21-oktabr, 10:00».

### Data model — `0015_night_rules.sql`
- `timingTypes` += `night_notice` (its value is ignored and stored as 0).
- `sent_messages.slot text not null default ''`. Replace the unique index `(segment_run_id, template_id)` with `(segment_run_id, template_id, slot)`, so a long TTL can carry a notice on each eligible night.
- Partial unique index for `night_notice` per segment.

### API
- `dispatch.ts`: `sendDue` and `nextDueForUser` call `planChain` with `anchorAt = run.enteredAt` (Phase 3 changes B), `linkBound = segment ∈ {A,B}`, and `nightNotice` = that segment's notice template. `sendOne` writes `slot`.
- `POST /admin/messages/preview-schedule {segment, linkGivenAt}` returns the plan for an imaginary user, for the admin simulator below.

### Admin UI
- In segments A and B, a pinned card «Tungi ogohlantirish (22:00)» at the top of the "before expiry" group. A help line explains rule 5, and the variable menu includes `{link_tugash_soati}`.
- A «Jadvalni sinash» (try the schedule) panel on the messages page: pick a "link given" time and see the TZ-style table (time · template preview · "collapsed" / "dropped" / "evening" tags) from the preview endpoint. It shows admins the night rules working on their own texts.

### Tests (TDD, write first) — `apps/api/src/messages/plan.test.ts`
- **TZ example table as fixtures**: segment A templates of 23, 21, 19, 17, 15, 10, 5, 4, 3, 2 and 1h before expiry, plus a night notice. TTL 24h.

| Link given | `linkExpiryFor` | Expected sends (template → time) |
|---|---|---|
| 10:00 | +1d 10:00 | 23h 11:00, 21h 13:00, 19h 15:00, 17h 17:00, 15h 19:00, notice 22:00, 3h +1d 07:00, 2h 08:00, 1h 09:00 (10h, 5h and 4h swallowed; 4h collapsed and then dropped by rule 4) |
| 22:30 | +1d 22:30 | 15h +1d 07:30, 10h 12:30, 5h 17:30, 4h 18:30, 3h 19:30, 2h 20:30, 1h 21:30 (23–17h swallowed, collapse dropped, no notice because 22:00 is before the link) |
| 02:00 | +1d **09:00** | 23h 10:00, 21h 12:00, 19h 14:00, 17h 16:00, 15h 18:00, notice 22:00, 2h +1d 07:00, 1h 08:00 |

  For each row, also assert the rendered `{qolgan_vaqt}` at send time («3 soat» at 07:00 in row 1), so the "X soat qoldi" column is checked too.
- Rule 6: someone registering at 02:00 with after_entry +60 gets it at 07:30; with an extra day item at 08:00 the collapse is dropped.
- Rule 2 boundaries: raw expiry at 22:59 → unchanged; 23:00 → 09:00 the next morning; 06:59 → 09:00 the same day; 07:00 → unchanged.
- Collapse at or after `E` is dropped (link given 07:10, expiry 07:10).
- Two nights in one run (link given 23:30, extended to +2d 09:00): rule 6 applies to night 1, and the notice goes only before night 2.
- The plan is identical whatever has been sent; the sent set only filters it.
- Integration (`dispatch.integration.test.ts`): replay row 1 with a fake clock ticking each minute. Exactly the expected messages are sent, and delete-previous leaves one message in the chat.

### Risks
- Users already mid-chain when this deploys keep their stored `link_expires_at`. Only new links are extended. This is acceptable.
- The behaviour change for templates admins already scheduled near the night: those messages are now collapsed or dropped instead of moved to 07:00. Call it out in the release note to the client.

---

## Phase 3 — Segment B precision (§3)

**Goal**: apply the TZ status boundary, send different texts for each sub-status, count timings from the moment the person stopped, and add per-chain caps.
**TZ**: §3.2, §3.4, §3.6, §8.3.

### Decisions
- **The 5:00 boundary comes from the video's `intro_end_sec`** (labelled «Asosiy dars boshlanishi» in the UI, as §8.1 names it). Nothing is hardcoded in the status logic.
  - New videos are prefilled with 5:00 (shared `DEFAULT_LESSON_START_SEC = 300`, used only to seed forms).
  - The §8.2 bot flow fills `min(300, course_start − 1)`.
  - The migration backfills null values the same way.
  - `statusFor` uses `introEndSec` directly. The midpoint fallback is kept only for legacy nulls that fail the check constraint.
  - Reports (`LEFT_EARLY_SEC = 300` in `shared/reports.ts`) switch to each video's `intro_end_sec`, so "left within 5 min" and `korishni_boshladi` always agree.
- **Sub-status targeting: a template field `statuses text[] null` (null = every status in the segment). Not sub-segments.**
  - Why: §3.6 says «bir odamga bir vaqtda bitta eslatma zanjiri». Sub-segments would end and restart the chain every time someone crosses 5:00 or 15:00. A filter keeps one run and its caps, and picks the text from the **current** status at send time.
  - The planner receives templates already filtered by the live status, so a status change between ticks re-plans automatically.
  - Allowed only in segment B (and D in Phase 5 for the §3.8 variant). Zod rejects it elsewhere.
- **"Stopped" = the last progress beat.** For B runs, `anchorAt = max(run.enteredAt, watch_progress.last_beat_at)`, for after_entry and for day_time days.
  - While someone watches, beats arrive every 5s, so the anchor keeps moving and «+30 min» only fires 30 minutes after the last beat.
  - If they come back and stop again, timings already sent stay sent (per-run dedupe), and the rest re-anchor to the new stop.
  - Before-expiry timings stay absolute.
  - No new column: `last_beat_at` already exists, and the pause beat or `pagehide` beacon from Phase 4 makes it accurate.
  - "Next morning 08:00" is a day_time on day 2, anchored to the day they stopped, which matches «Kecha … to'xtagan edingiz».
- **Active-watching guard** (all segments): nothing is sent while `playing = true` and `last_beat_at > now − 2 min`. The item stays due within its grace window. This stops before-expiry or C «10–15 min» messages arriving mid-playback.
- **Caps are per segment and set in Sozlamalar**:
  - `MESSAGE_CAPS` (JSON) holds `{A:{daily:10,total:null}, B:{daily:4,total:7}, C:{daily:10,total:null}}`. The global 10 per day (§7.3) stays a hard ceiling in code.
  - Daily = sends in this run today (Tashkent). Total = sends in this run, which matches «1-bo'limda yuborilganlar bilan birga sanalmaydi».
  - Why configurable: the settings plumbing already exists (one more card field), and §7 asks for no hardcoded operating numbers. D has no caps; its limits are §2 rules (Phase 5).

### Data model — `0016_segment_b.sql`
- `message_templates.statuses text[]`, with a check that the values are in the funnel statuses.
- Backfill `videos.intro_end_sec` as above.
- `settings` row `MESSAGE_CAPS` seeded with the defaults.

### API
- `loadCandidates` also selects `watch_progress.last_beat_at`, `playing`, `max_position`, the video marks and per-run counters (`sentTodayRun`, `sentTotalRun`). The status is computed with `statusFor` for the template filter.
- Admin messages API: `statuses` in the create and update schemas. `adminSettings` gets caps.

### Admin UI
- Segment B editor: a «Kimga» chip row with Hammasi / 0–{intro} / {intro}–{course} / {course}–narx. The labels show the active video's marks in MM:SS. Template cards show the chip.
- Sozlamalar: a «Xabar limitlari» card with daily and total per segment.
- Videos page: relabel `intro_end_sec`, prefill 5:00, and add a help line saying it is the boundary between `korishni_boshladi` and `dars_yarmida`.

### Tests
- Unit `statusFor`: boundaries at `intro_end_sec − 1`, `intro_end_sec`, course start and price.
- Unit plan for B: the anchor moves with `last_beat_at` (a +30m item is not due while beats keep coming, and is due 30 min after the last one); day 2 08:00 is anchored to the stop day; the statuses filter picks the matching variant; a status change switches the variant for items not yet sent.
- Unit `pickNext` caps: the 5th B send today is blocked, the 8th B send in the run is blocked, and the global 10 always applies.
- Integration: someone stops at 3:00 and gets the 0–5 text 30 min later; they watch on to 16:00, stop, and get the 15–price text and no 5–15 text; the guard holds a send while beats are fresh.

### Risks
- The anchor depends on beats arriving. If the client never sends pause or hide beats, the anchor is up to 5s stale, which is harmless.
- Admins must add variants: B templates with `statuses = null` still go to everyone in B, which is today's behaviour.

---

## Phase 4 — Mini App resume reliability (§6)

**Goal**: resume works on Android, iOS and Desktop, nothing more than 5s of progress is lost, the «Siz M:SS da to'xtagan edingiz» overlay appears, and the seek lock comes off after the price point.
**TZ**: §6.1 causes 1–5, §6.2, §6.3.

### Decisions
- **Resume overlay** when the start is `resume`/default and `lastPosition > 30`. It shows «Siz {M:SS} da to'xtagan edingiz» with «▶ Davom ettirish» (primary, seeks to `max(0, startAt − 5)`) and «↺ Boshidan» (seeks to 0; `maxPosition` is untouched, so the user can still move freely up to it).
  - No overlay for `offer` (it goes straight to `course_start_sec`) or when the video is completed.
  - Copy lives in `watchUz`. Mini App UI copy is not part of the bot-text system, which is consistent with today.
- **Position re-apply hook** `useResumeSeek(videoRef, target)`: set the position on `loadedmetadata`, `canplay` and the first `play`. 500 ms after each, if `currentTime < target − 2`, set it again. Stop once it is confirmed or the user seeks. The decision logic is pure `shouldReapply(current, target, userSeeked)`.
- **Tick every 5s** (the server already ignores ticks under 3s apart).
- **Save on close**: beacon a `pause` beat on `visibilitychange: hidden`, on `pagehide`, and on Telegram `WebApp.onEvent("deactivated")` (Bot API 8.0+; older clients only fire `pagehide`). Deduplicate within 1s.
- **Local backup**: write `{videoId, position, at}` to `localStorage` every tick, and to Telegram `CloudStorage` on pause or hide only (CloudStorage is async and rate-limited). On open: `resumeFrom = min(server.maxPosition, max(server.lastPosition, local.position))`, ignoring local data from a different `videoId`. Pure `mergeResume(server, local)`. Everything is wrapped in try/catch, and the app works without storage.
- **Seek lock off after the price point**: `seekLocked = config.seekLock && !completed && !(priceSec !== null && maxReached ≥ priceSec)`. The session exposes `priceSec`.
- **Server anti-cheat hardening** (deep-reasoner reviews):
  - Today a `play` beat at any position resets `lastPosition`, and later ticks earn credit from there. So a forged `play` at the price point plus ticks can reach `narxni_kurdi`, which breaks the §6.2 guarantee.
  - Change `applyBeat`: a beat whose position is beyond `max(maxPosition, courseStartSec) + 2` doesn't move the credit base (`lastPosition` keeps the last allowed position) and earns no credit.
  - Jumping to course start stays legal because `startapp=offer` needs it, and from there real-time watching earns credit up to the price as intended.
- **Watched part of the bar**: it already renders `maxReached` in `varaq/55`. Give it a clearly distinct tint and add a hatched locked area. Speeds `[1, 1.25, 1.5, 2]` are already exact (`PLAYBACK_RATES`), so mark that ✅.

### API
- `/app/session`: `no-store` (from Phase 1), plus `priceSec` and `videoId` in the payload (`SessionResponse` schema).
- `credit.ts` change as above.

### Tests
- Add vitest to `apps/web` (dev dependency only) for pure helpers: `mergeResume`, `shouldReapply`, overlay visibility, `seekLocked`.
- `credit.test.ts`: a forged `play` at the price point plus ticks doesn't raise `maxPosition` past the allowed base; a `play` at course start followed by real-time ticks reaches the price; existing cases stay green.
- Integration: §6.3 **Test 5** (progress kept when a new link is granted) is written now and runs against the link-grant code in Phase 5. **Test 3** (seek lock): a unit test of the `ProgressBar` blocked-seek decision. **Test 6**: `scripts/check-range.sh <url>` asserts `206` and `Accept-Ranges: bytes`, run in the deploy checklist.
- Tests 1, 2 and 4 are manual on devices; the checklist is in Phase 7.

### Risks
- iOS WebView quirks vary. The re-apply loop is bounded (3 attempts) so it can't fight the user.
- CloudStorage quota (1024 keys, 4 KB values): one key per user is fine.

---

## Phase 5 — Link grants, expiry → «afsus», «Ha» (§2, §3.8 text, §5)

**Goal**: when a link expires, the chain stops, the reminders for that link are deleted, and the «afsus» message goes out. «Ha» reopens the link for 24h once per offer. The 7-day afsus bank never repeats. Progress is kept. This phase also adds the `qayta_imkon` states.
**TZ**: §2, §3.8 (text variant), §5 (statuses, delete on expiry, no repeats), §6.2 (progress kept).

### State model (decisions)
- **Link grants become rows.** The table `link_grants(id, user_id, attempt, kind initial|again|scheduled, offer_first bool, given_at, expires_at)` is the TZ's `link_id`.
  - `users.link_id` points at the current grant. `link_given_at` and `link_expires_at` stay as a denormalized copy, because many readers use them.
  - Expiry comes from `linkExpiryFor`, so §1.1 rule 2 also covers reopened links.
  - `attempt` = 1 for the first link, 2+ for each reopen.
- **New segment D «Qayta imkon» for people whose link expired without reaching the price.**
  - `segmentFor` becomes `segmentFor(status, linkState)`:
    - A or B status with a live link → A/B.
    - A or B status with an expired link and offers not used up → **D**.
    - Offers used up → no chain (end reason `offers_exhausted`).
    - C ignores expiry.
  - Why a segment: "one chain per user" stays literally true, the D run is the stored meaning of the `qayta_imkon` status, stop conditions (yozdi, blocked) work unchanged, and reports split by segment for free.
  - New run end reasons: `expired`, `relinked`, `offers_exhausted`.
- **When the price is reached, expiry no longer applies (segment C).** The Mini App stays open for C, and `expired` in `/app/session` becomes `linkExpired && status ∉ {narxni_kurdi, adminga_yozdi}`.
  - Why: the C progrev runs 2–3 days and its buttons lead to the video and admin. Closing the video on people who are close to buying only costs conversions. (Open question 4.)
- **What happens at expiry today**: before-expiry items stop at `E` (already true), but after-entry ones keep going.
  - New behaviour: at `E` the A/B run **ends** (`expired`) and every not-yet-deleted `sent_messages` row with `link_id = expired grant` is deleted (§5), then D starts.
  - Expiry is detected by a new locked dispatcher step `expireLinks(now)`: open A/B runs whose user has `link_expires_at ≤ now` → `syncSegment`.
- **Second-chance offers** in table `second_chance_offers`:
  - Columns: `id`, `user_id`, `occasion 1..7`, `variant not_opened|no_price`, `expired_link_id`, `due_at`, `sent_message_id null`, `skipped bool`, `answer again|later null`, `answered_at`, `granted_link_id null`, `created_at`, plus `unique(user_id, occasion)`.
  - Pure `nextOffer(history, linkState, now)`:
    - Occasion 1 is due at the expiry that opened D.
    - After «Ha», the next occasion is due when the granted link expires (which re-opens D).
    - Unanswered: due `prev.due_at + 24h` (the TZ says «har kuni beriladi»; open question 3).
    - With a pending appointment (Phase 6a): wait.
    - A due time at night moves to 07:30.
    - Never two on one Tashkent day; if that would happen, move to 07:30 the next day.
    - Used up when `occasion > 7` or `due_at ≥ first.due_at + 7d`: the D run ends `offers_exhausted` and the bot stops offering.
- **The afsus bank is constructor templates in segment D.** Day page k = the k-th afsus (the 7 pages are the TZ's «1-kun … 7-kun» bank). The `statuses` filter picks the variant: `[link_berildi]` = never opened; B statuses = the §3.8 text.
  - Timing type `occasion` (value 0); the timing picker is hidden for D.
  - An empty page for the user's variant means that occasion is recorded as `skipped` and nothing is sent, following §7.3's empty-day rule. The next occasion comes 24h later.
  - Why templates and not `bot_texts`: the bank needs rich text, media, buttons, test send and the per-message report («qaysi matn ishlayotgani»).
- **No-repeat rule**:
  - Afsus texts: never repeated, structurally (occasion k → page k, each sent once by `unique(user_id, occasion)`).
  - A/B/C chain texts: never repeated within one link attempt (the existing per-run dedupe).
  - Across attempts the TZ conflicts with itself: §2 «zanjiri shu vaqtdan qaytadan boshlanadi» against §5 «matn ID larini … takrorlamaydi».
  - **Decision: a template filter `attempts smallint[] null` (null = every attempt).** Admins who want new wording for each second chance give variants attempts 2, 3, … and set the original to `[1]`. Sending the same text again on a reopened link is the default, so reopened links never go silent if admins don't write variants. (Open question 1.)
- **Button semantics, merged**:
  - New kind `again` («Ha, ko'raman») is a **web_app** button to `/app?start=again`. `/app/session` with `start=again` accepts the open offer inside a user row lock, idempotently: it creates an `again` grant (`offer_first` = variant `no_price`), runs `syncSegment` (D → A/B with attempt n+1, so the chain restarts at day 1 with the night rules), and returns a live session.
  - One tap goes straight to the video, which matters for a mobile Instagram audience. «Link 1 marta» holds because the offer's `answer` can only be set once.
  - Kind `later` («Keyinroq, ko'raman») opens the time picker (Phase 6a). Until 6a ships, `later` in D sends a `bot_texts` ack and records `answer = later`, and the next occasion comes 24h later.
  - Kind `when_menu` is **removed**. The migration rewrites `when_menu` → `later` in `message_templates.buttons`. `reminders.ts` maps the old `mt:w`/`mt:l` callbacks (still visible in chats for up to 48h) to the new handler, and that alias is dropped in Phase 7.
  - Per-segment allow-list in Zod: D allows `again`, `later`, `admin`, `link`. A/B/C allow `resume`, `offer`, `admin`, `link`, `later`.
- **Expired screen** (`LinkExpiredScreen`): if there is an open offer, show «Ha, ko'raman» (POST `/app/second-chance/accept`, the same service as `start=again`) and «Adminga yozish». Otherwise show today's screen.
- **Displayed statuses** (lead card, reports): a derived `linkStateFor(user)` returns `live`, `qayta_imkon` (D, offer unanswered), `qayta_imkon_kutilmoqda` (pending appointment, Phase 6a), `imkon_tugadi` or `bloklagan`. The lead card gets a line `🔁 Qayta imkon: 2/7 · …`.

### Data model — `0017_second_chance.sql`
- `link_grants`, plus a backfill of one `initial` grant per registered user. `users.link_id` FK.
- `segment_runs`: segment enum += `D`; end reasons += `expired`, `relinked`, `offers_exhausted`; `attempt smallint not null default 1`.
- `message_templates`: segment += `D`; timing += `occasion`; `attempts smallint[]`; the `when_menu` → `later` JSON rewrite.
- `sent_messages`:
  - `link_id bigint null` FK.
  - `template_id` becomes **nullable**, plus `bot_text_key text null` with a check that exactly one of the two is set. This lets Phase 6a's system messages (the 1h reminder, the reopen notice) take part in delete-previous and the 47h sweep.
  - Reports filter on `template_id is not null`.
- `second_chance_offers`.
- `startModes` += `again`; `eventTypes` += `second_chance_offer`, `second_chance_again`, `second_chance_later`.

### API and bot
- `links/service.ts`: `grantLink(userId, kind, now)` takes a row lock, inserts the grant, updates the users copy, then calls `syncSegment`.
- `dispatch.ts` tick order: `markInterrupted` → `expireLinks` → `sendOffers` (D runs: `nextOffer` → pick the template → send via the `sendOne` path with `occasion`) → `sendDue` → `sweep`.
- `syncSegment` reads the link state and the offer count.
- Lead card and reports: the derived link state.

### Admin UI
- `AudienceTabs`: a 4th tab «Qayta imkon». It shows 7 rows (1–7-imkon), each with two slots: «Ko'rmaganlar» and «Narxgacha yetmaganlar (3.8)». Timing is hidden.
- A/B editor: a «Qaysi link» chip row with Hammasi / 1 / 2 / … / 8.
- Reports: the per-message table already covers D templates. Add a small «Qayta imkon» funnel: offers sent → Ha → Keyinroq → reopened → then reached the price.

### Tests
- Unit `nextOffer`: occasion 1 at expiry; unanswered +24h; «Ha» → due at the new expiry; at most once per day; ends after occasion 7 or day 7; an empty page is skipped and the next one comes 24h later; night → 07:30.
- Unit `segmentFor` with link state: A/B expired → D; C expired → C; used up → null.
- Integration:
  - Expiry ends the A run, deletes that link's reminders (fake Api records `deleteMessage`), and sends afsus 1 with the variant matching the status.
  - `start=again` creates a grant (attempt 2), restarts the A chain from day 1 using the planner, and keeps `watch_progress` (**§6.3 Test 5**).
  - A second «Ha» on the same offer does nothing.
  - Seven ignored offers end in `offers_exhausted`.
  - Templates with `attempts=[1]` are not sent in attempt 2.

### Risks and rollout
- **Rollout**: users whose link expired in the last 7 days and whose status is A or B enter D on the first tick, so offer 1 goes out then (paced at 35 ms, daytime only). Older expiries don't get offers.
- `again` web_app opens can race with the dispatcher's `expireLinks`/`sendOffers`. Both take the user row lock (`for update`), the same pattern as `syncSegment`.
- Telegram only allows deleting messages under 48h old. Afsus messages older than that get `too_old`, as today.

---

## Phase 6a — «Keyinroq» time picker and appointments (§2)

**Goal**: «Keyinroq» asks when, stores `tanlangan_vaqt`, reminds 1h before, and at the chosen time grants a new 24h link and restarts the §1 chain.
**TZ**: §2 (time menu, storage, reminders 1 and 2).

### Decisions
- **Appointments table** `watch_appointments`:
  - Columns: `id`, `user_id`, `offer_id null`, `purpose reopen|remind`, `chosen_at`, `pre_sent_message_id`, `fired_at`, `fired_message_id`, `cancelled_at`, `created_at`.
  - Partial unique: one pending appointment per user.
  - `reopen` comes from `later` in D, which sets `answer = later` and gives the `qayta_imkon_kutilmoqda` state.
  - `remind` comes from `later` in A/B/C while the link is live. It replaces the old «Qachon ko'rasiz?» behaviour, which only logged the answer. At the chosen time it sends one reminder with a resume button and grants no link.
- **Picker** (`telegram/later.ts`, callbacks `lt:*`, all under 64 bytes):
  - Step 1 shows quick slots «Bugun kechqurun (20:00)», «Ertaga ertalab (08:00)», «Ertaga kechqurun (20:00)» and «Boshqa vaqt».
  - «Boshqa vaqt» → day (Bugun / Ertaga / Indinga) → hour 07:00–22:00 hourly.
  - **Times in the past are hidden**: a slot or hour is shown only if it is after now. For `remind`, it must also be earlier than `E − 1h`. If no slots are left, reply with `laterTooLate`.
  - The quick-slot hours (20, 8, 20) are constants in shared, because the TZ fixes them. Their labels are bot texts with a `{soat}` placeholder, so the label can't disagree with the actual slot.
  - Pressing again overwrites the pending appointment. «Ha» while an appointment is pending accepts now and cancels the appointment.
- **Dispatcher step** `processAppointments(now)`, inside the lock:
  - Pre-reminder at `chosen_at − 1h` if that is not at night and not in the past (choosing 07:00 means no pre-reminder).
  - At `chosen_at`, `reopen` → `grantLink(kind scheduled, offer_first by variant)` plus the `reopenNow` message with a web_app button (`resume`, or the short-video start for `no_price`). `remind` → the `remindNow` message, but only if the link is still live and the person hasn't started watching.
  - Missed (downtime) appointments still fire late; they are user-requested.
  - Both kinds are logged in `sent_messages` with `bot_text_key` (delete-previous applies) and are exempt from the per-segment caps.
- **Admin-editable copy → new `bot_texts` keys**, shown as a «Qayta imkon» scenario on the Bot page with chat preview.
  - Why `bot_texts`: these are fixed flow steps, not a chain. The Bot page already edits steps like these, with placeholder validation.
  - Messages: `laterAsk` (§2 «Yaxshi! Qachon ko'rishingiz qulay? …»), `laterPickDay`, `laterPickHour`, `laterConfirmed` `{vaqt}`, `laterTooLate` `{link_tugash_vaqti}`, `reopenPreReminder` (§2 «1 soatdan keyin … choy tayyorlab qo'ying 🙂»), `reopenNow`, `remindNow`, `offerClosed` (shown for stale buttons).
  - Buttons: `laterTonight` `{soat}`, `laterTomorrowMorning` `{soat}`, `laterTomorrowEvening` `{soat}`, `laterOther`, `dayToday`, `dayTomorrow`, `dayAfterTomorrow`, `reopenWatchButton`, `remindWatchButton`.
  - Defaults are the TZ wording.

### Data model — `0018_appointments.sql`
- `watch_appointments`. The bot text keys need no migration (they are code definitions plus optional `bot_texts` rows).

### Tests
- Unit `pickerSlots(now, purpose, E)`:
  - At 19:30, «Bugun 20:00» is shown; at 20:00 it is hidden.
  - «Indinga» offers 07–22.
  - For `remind`, hours at or after `E − 1h` are hidden.
  - Night hours are never offered.
  - Each label's `{soat}` matches its slot.
- Unit appointment timing: pre-reminder skipped when `chosen = 07:00`; skipped when chosen less than 1h ahead.
- Integration: Keyinroq → Ertaga 08:00 → pre-reminder at 07:00 → at 08:00 a new grant (attempt n+1), the A chain restarts, the reopen message has a web_app button, and the old afsus message is deleted. A re-pick overwrites the appointment. «Ha» cancels the pending appointment.

### Risks
- Callback buttons on old messages: every handler re-reads the offer and appointment state and answers `offerClosed` when stale.

---

## Phase 6b — §3.8 short «Kurs haqida» video

**Goal**: for someone who stopped before the price, «Ha» plays the short course video first.
**TZ**: §3.8, §8.1 «Qo'shimcha».

### Decisions
- Show the short-video upload again on the Videos page. Add `videos.short_offer_duration` (read automatically from player metadata, like the main video).
- The session gets `offerFirst: {url, duration} | null` when the current grant has `offer_first = true`, the video has a short video, and `users.offer_watched_at` is null. **Without a short video**, `offer_first` falls back to `startAt = course_start_sec` (the `offer` behaviour).
- Mini App `OfferFirstScreen`:
  - The short video plays without a seek lock.
  - Below it: «Adminga yozish» (the existing `ProceedButton`) and «To'liq darsni ko'rish», which switches to the main player and shows the Phase 4 resume overlay.
  - Light beats go to `/app/offer-progress`. The server accepts completion only if `now − first_play ≥ duration / 2.2` (the same anti-cheat factor as §6.2), then sets `users.offer_watched_at` and `unlocked_at`.
- **Watching the short video counts as `narxni_kurdi`**: `statusFor` checks `offerWatchedAt`, and the person moves to C (progrev).
  - Why: the short video exists to deliver the offer and price. This depends on the content, so it is open question 2, and the Videos page help text says «Qisqa videoda narx aytilishi kerak».

### Data model — `0019_short_offer.sql`
- `videos.short_offer_duration int`.
- `users.offer_watched_at timestamptz`.

### Tests
- Unit: `statusFor` returns `narxni_kurdi` with `offerWatchedAt`. The completion guard rejects a too-fast completion.
- Integration: a `no_price` offer → `start=again` → the session has `offerFirst`. Completion → C run starts. Without a short video, the session starts at `course_start_sec`.

### Risks
- Two players on one page on iOS: render only one `<video>` at a time.

---

## Phase 7 — Acceptance and docs

- §6.3 checklist in `docs/ACCEPTANCE.md`. Automated: Test 3, Test 5, Test 6 (script). Manual: Test 1 (Android), Test 2 (iPhone and Desktop), and Test 4 (airplane mode, force-close, check that less than 5s is lost by comparing the server `last_position` with the stop time).
- The §1.1 example replay (the Phase 2 integration test) runs in CI.
- Remove the `mt:w`/`mt:l` aliases.
- `docs/DEPLOY.md`: set the TTL row to 24, review `MESSAGE_CAPS`, and note the rollout of offers to users expired in the last 7 days.
- Update the gap report: every row ✅ or ➖.

---

## Phase 8 — Google Drive import (optional)

**Goal**: admins paste a Drive link instead of uploading.
**TZ**: §8.1.

- Uses the official Drive API v3 with the existing Sheets service account (`GOOGLE_SA_EMAIL`/`GOOGLE_SA_KEY`, with the `drive.readonly` scope added).
- The admin shares the file with the service account email, or sets it to "anyone with the link". The UI shows the email to share with.
- Flow:
  - Parse the file id.
  - `files.get(fields=name,size,mimeType,videoMediaMetadata)` to validate: mp4 only, size up to the R2 limit, duration from `durationMillis`.
  - A background job streams `alt=media` into an R2 multipart upload (reusing the bot-video upload worker and its claim/progress columns, generalized to a `video_imports` table), then creates the video draft.
- YouTube stays unsupported (no trackable player, and downloading breaks YouTube's ToS), as already decided.
- Tests: id parsing; the integration test mocks the Drive HTTP calls and asserts the draft and R2 upload calls.
- Risks: older files may need the `resourceKey` header; quota limits apply to large files; the service account must not get write scopes.

---

## Open questions for the client (only where the TZ is ambiguous)

1. On a reopened link, may the §1 reminders reuse the same texts, or must every second chance have new ones (§2 says the chain restarts, §5 says texts never repeat)? *Default: the same texts are allowed, and admins can target texts to a specific attempt.*
2. Does the short «Kurs haqida» video include the price, so that watching it counts as «narxni ko'rdi»? *Default: yes.*
3. If someone ignores the afsus message (presses nothing), should the next afsus come 24h later? *Default: yes, up to 7 times in 7 days.*
4. For someone who reached the price (progrev), should the video stay open after 24h? *Default: yes, expiry no longer applies to them.*
5. A link given between 07:00 and 07:29 expires before the 07:30 morning message. Should the extension to 09:00 cover expiries up to 07:30 as well? *Default: no, the TZ's 23:00–07:00 is followed literally; the 22:00 warning still goes out.*
