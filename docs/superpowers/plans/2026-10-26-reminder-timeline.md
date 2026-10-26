# Reminder Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace segment D («Qayta imkon»), the night rules and the extra timing kinds with three stages (A/B/C) that each have a 7-day reminder timeline, plus one restart rule: any reopen of a closed lesson issues a new link and restarts the current stage at day 1.

**Architecture:** A template's `day` plus one `timing_value` (minutes, 0–1439) is the whole timing model: on day 1 it is an offset after stage entry (B: after the last pause), on days 2–7 it is a Tashkent clock time on the Nth calendar day after entry. Reopening goes through one service (`reopenLesson` / `reopenWithin` in `apps/api/src/links/service.ts`). It issues a new link grant, and the existing attempt check in `syncSegment` then ends the run (`relinked`) and opens a fresh one, which is what restarts the timeline and the per-run caps. One drizzle migration converts the templates, copies D pages into A/B and moves people out of D.

**Tech Stack:** pnpm monorepo. `apps/api`: Hono, grammy, drizzle-orm 0.45 on Postgres, vitest. `apps/web`: Next.js 16 admin and mini-app. `packages/shared`: zod schemas and pure helpers.

**Spec:** `docs/superpowers/specs/2026-10-26-reminder-timeline-redesign-design.md`

## Global Constraints

- No code comments of any kind in new or edited code: no what/why comments, no TODOs, no section headers, no docstrings.
- Match the surrounding style. Admin copy is Uzbek in the tone of `apps/web/lib/i18n/admin.ts` (typographic `‘`, «guillemets»).
- Mobile-first admin: it has to work at 375px wide with no horizontal page scroll. Day tabs scroll horizontally.
- `pnpm typecheck`, `pnpm lint` (web) and `pnpm test` stay green after every task. Integration tests need `TEST_DATABASE_URL`. Use a throwaway container: `docker run -d --rm --name vf-test-pg -e POSTGRES_PASSWORD=postgres -p 5440:5432 postgres:17-alpine`, then `export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5440/postgres`. Never point tests or `db:migrate` at the dev DB `vf-dev-pg` (port 5434).
- Single test file: `pnpm --filter @funnel/api exec vitest run <path relative to apps/api>`.
- Rewrite or delete tests that encode removed behaviour. Do not keep dead code alive for tests.
- `LINK_TTL_HOURS` default stays 24. `linkExpiryFor` (23:00–07:00 expiries move to 09:00) stays. `GRACE_MS` stays 60 minutes. The 1-hour pre-reminder (`LATER_PRE_REMINDER_MINUTES = 60`) stays.
- Tasks 2–4 leave legacy timing rows (`before_expiry`, `night_notice`, `occasion`) mis-planned until Task 5's migration. Do not deploy from the middle of the plan.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Builder decisions (spec "Left to the builder" and gaps)

1. **Data model:** drop `message_templates.timing_type`. Keep the `timing_value` column (drizzle `timingValue`). The shared/API field is `minute: number`. Day 1 means minutes after entry, days 2–7 mean minute of the Tashkent day, and both ranges are 0–1439. The `sent_messages.slot` column stays and is always `''`.
2. **Day-1 reminders that land at night** are sent as scheduled. `pickNext` no longer checks the night.
3. **Migration** is SQL only, appended to the one generated drizzle migration (`0024_reminder_timeline`). Dropped texts are logged with `RAISE INFO`, and `runMigrations` forwards INFO notices to `console.info`.
4. **Legacy `day_time` on day 1** (it can no longer exist) moves to day 2 at the same clock time and is logged with `RAISE INFO`. Flagged for the owner.
5. **«Qaysi havola»:** options 1…8, where 8 is shown as «8+» and matches attempt ≥ 8 (`LINK_ATTEMPT_OPTIONS = 8`, `attemptBucket`). The DB check `<@ array[1..8]` is unchanged.
6. **Every button kind is allowed in every stage.** The default new button is `resume`. `buttonKindsFor`/`defaultButtonFor` are deleted.
7. **«Lesson closed»** reuses the mini-app `expired` predicate as `isLessonClosed`: registered, link expired, not completed, status not `narxni_kurdi`/`adminga_yozdi`. Reopen is possible only then. Otherwise «Ha» just opens the video and «Keyinroq» uses `remind`. For `remind`, `expiresAt` is `null` once the link has already passed, so C people with an old link get the full picker.
8. **Reopen events:** a new event type `lesson_reopened` with `meta.source` ∈ `again | screen | start`. Scheduled reopens keep `later_reopened`. Grant kind is `again` for immediate reopens and `scheduled` for appointments. Old `second_chance_*` event types stay in `eventTypes` for history.
9. **`offerClosed` stays.** `later.ts` still sends it to users who are not registered, wrote to the admin or are blocked. Its admin `when` copy is reworded. No bot-text key is deleted, because none was D-only.
10. **Caps:** `DEFAULT_MESSAGE_CAPS.B.total` in `packages/shared/src/adminSettings.ts` changes from `7` to `null` (owner decision 2026-10-26: a 7-day timeline must not be cut by a default total; admins can still set one in Settings). Stored `MESSAGE_CAPS` settings are left untouched. Otherwise no code change. `runToday`/`runTotal` are already counted per segment run, so a restart (new run) resets both. The person-wide `DAILY_CAP = 10` does not reset.
11. **Link-expiry chat sweep stays, guarded.** It deletes only reminders sent while that link was open (`sent_at < link_grants.expires_at`). Without the guard every day-2+ reminder (sent on the already-expired link) would be deleted within a minute.
12. **Reports:** per-message rows are limited to segments A–C (historic D rows are hidden). The aggregate «Qayta imkon» section stays as «Qayta imkon (eski)» over the kept `second_chance_offers` history.
13. **Lead card:** «🔁 Qayta imkon: x/7» becomes `🔁 Dars qayta ochildi: {attempt − 1} marta` (shown when the latest attempt is ≥ 2). «⏰ Tanlangan vaqt» stays.
14. **Migrated D people** get `end_reason = 'relinked'` on the D run. The new run's segment mirrors `statusFor`: C if `offer_watched_at` is set or `max_position >= price_sec`, A if never played, else B. Its attempt is the current grant's attempt.
15. **Old segment end reasons** `expired`/`offers_exhausted` and the `second_chance_offers` table and its `offerVariants`/`offerAnswers` enums stay, for history only.
16. **Mid-plan migration fold:** Task 1 generates a temporary migration that drops `watch_appointments_offer_shape`. Task 5 deletes it and regenerates one combined `0024_reminder_timeline`.

## Review Focus

- **Double tap on «Ha» / the closed-screen button** (two concurrent reopen calls): exactly one new link and one restart. Pinned in Task 1 (`reopen.integration.test.ts`, "reopens once under concurrent taps").
- **Stage entered just before Tashkent midnight**: day 2 is the next calendar day, minutes later, so a day-2 00:30 reminder goes out 40 minutes after a 23:50 entry. Pinned in Task 3 (`plan.test.ts`, "starts day 2 at the next Tashkent midnight").
- **Admin adds a reminder for a day/time that has already passed in someone's run**: it is never sent late. Pinned in Task 3 (`dispatch.integration.test.ts`, "never sends a reminder added after its time passed").
- **«Keyinroq» picked while the link is open, and the link then closes before the chosen time**: the appointment is cancelled, nothing reopens and nothing restarts. Pinned in Task 1 (`appointments.integration.test.ts`, "cancels a remind appointment when the lesson closes first").
- **Migration onto days that already hold reminders, with inactive or media-bearing D pages**: the copies append after the existing positions and keep media, buttons and the active flag. Pinned in Task 5 (`reminderTimeline.migration.integration.test.ts`, "appends copies after existing reminders and keeps media, buttons and the active flag").

---

### Task 1: Reopen service and the four reopen paths

**Files:**
- Modify: `apps/api/src/funnel/status.ts` (add `isLessonClosed`)
- Modify: `apps/api/src/links/service.ts` (replace `openOffer`/`acceptSecondChance` with `lessonState`/`reopenWithin`/`reopenLesson`; `answerLater` stays until Task 2)
- Modify: `apps/api/src/links/appointments.ts` (`laterContextFor`, `scheduleAppointment`)
- Modify: `apps/api/src/messages/dispatch.ts` (`appointmentStillValid`, `fireReopen`, `processAppointments` drop the offer join)
- Modify: `apps/api/src/routes/miniapp.ts` (session `start=again`, `POST /reopen` replaces `POST /second-chance/accept`, `expired` via `isLessonClosed`, `secondChance` removed)
- Modify: `apps/api/src/telegram/bot.ts` (`/start` reopens a closed lesson before the welcome)
- Modify: `apps/api/src/db/schema.ts` (remove check `watch_appointments_offer_shape`), then `pnpm --filter @funnel/api db:generate --name reopen_appointments`
- Modify: `packages/shared/src/schemas.ts` (remove `secondChance` from `sessionResponseSchema`), `packages/shared/src/index.ts` (add `"lesson_reopened"` to `eventTypes`)
- Modify: `apps/web/components/watch/LinkExpiredScreen.tsx`, `apps/web/lib/i18n/watch.ts`
- Create: `apps/api/src/links/reopen.integration.test.ts` (built from the still-valid parts of `secondChance.integration.test.ts`)
- Modify: `apps/api/src/links/secondChance.integration.test.ts` (delete the tests now covered by the new file: «Ha» once, 409 without offer, restart chain, offerFirst on «Ha»; also drop its `acceptSecondChance` import, because that function is deleted in this task)
- Modify: `apps/api/src/links/appointments.integration.test.ts`

**Interfaces:**
- Produces:
  - `isLessonClosed(user: Pick<User, "registeredAt" | "linkExpiresAt" | "completedAt">, status: FunnelStatus | null, now: Date): boolean` in `funnel/status.ts`
  - `type LessonState = { status: FunnelStatus | null; closed: boolean }`
  - `lessonState(executor: Reader, user: User, now: Date): Promise<LessonState>` (it reads `watch_progress` + the user's `videos` row and uses `statusFor`)
  - `type ReopenResult = "reopened" | "open" | "closed"`, `type ReopenSource = "again" | "screen" | "start"`
  - `reopenWithin(tx: Tx, userId: number, kind: "again" | "scheduled", now: Date, ttlHours: number): Promise<ReopenResult>`. It locks the user `FOR UPDATE`. It returns `closed` if the user is unregistered, wrote to the admin or is blocked, and `open` if `!isLessonClosed`. Otherwise it calls `insertGrant(tx, userId, { kind, offerFirst: segmentFor(status) === "B", now, ttlHours })`. It does not sync and does not cancel appointments.
  - `reopenLesson(userId: number, source: ReopenSource, now = new Date()): Promise<ReopenResult>`. It runs a transaction with `reopenWithin(tx, …, "again", …)` and, on `reopened`, `cancelPendingAppointments(tx, userId, now, ["reopen"])`. After commit it runs `syncSegment`, `logEvent("lesson_reopened", { userId, meta: { source } })` and `refreshUserLeadCards`.
  - `type LaterContext = { purpose: "reopen"; expiresAt: null } | { purpose: "remind"; expiresAt: Date | null }`. `laterContextFor(executor: Reader, user: User, now: Date): Promise<LaterContext | null>` returns `null` if unregistered, wrote to the admin or blocked. It returns `reopen` if the lesson is closed. Otherwise it returns `remind` with `expiresAt = linkExpiresAt > now ? linkExpiresAt : null`.
  - `POST /app/reopen` returns `{ ok: true, result: "reopened" | "open" }`, or `409 { error: "reopen_closed" }`.
- Consumes: `insertGrant`, `syncSegment`, `cancelPendingAppointments`, `statusFor`, `segmentFor` (existing).

- [ ] **Step 1: Write the failing tests** in `apps/api/src/links/reopen.integration.test.ts`. Use the harness of `secondChance.integration.test.ts`: isolated DB `vf_reopen`, `session()` helper, a test bot recording API calls. Close the lesson by setting `users.linkExpiresAt` to the past.
  - "reopens a closed lesson on «Ha» with a fresh link and restarts the stage at day 1": session `{ reason: "open", start: "again" }`. Assert: there are 2 `link_grants`, the second is `{ attempt: 2, kind: "again" }`, `users.linkExpiresAt` equals `linkExpiryFor(now, 24)`, the old run has `endReason: "relinked"`, the open run is `{ segment: "A", attempt: 2, enteredAt: now }`, and the response has `expired: false`. One `lesson_reopened` event with `meta.source = "again"`.
  - "opens a still-open lesson on «Ha» without a new link or restart": the grant count stays 1 and the open run id is unchanged.
  - "reopens from the lesson-closed screen": `POST /app/reopen` returns 200 `{ ok: true, result: "reopened" }`, and a second call returns `{ ok: true, result: "open" }`.
  - "answers 409 on the closed screen for a user who wrote to the admin": `{ error: "reopen_closed" }`, no new grant.
  - "reopens on /start after the link closed and still sends the welcome": a `/start` update leads to grant attempt 2 and `sendMessage` with the `welcome` text, and `meta.source = "start"`.
  - "has no reopen limit": 9 cycles of expire + «Ha» end at attempt 10.
  - "starts B at the sales part after a reopen": user at `dars_yarmida`, closed; the new grant has `offerFirst: true` and the session returns `offerFirst` set (or `startsAtCourse: true` when the video has no short clip).
  - "resets the stage total cap after a reopen": B cap `{ daily: 10, total: 2 }` with three day-1 templates. After two sends the third is held. After a reopen the new run receives the first template again.
  - "reopens once under concurrent taps": `Promise.all([reopenLesson(id, "again"), reopenLesson(id, "screen")])` gives results sorted `["open", "reopened"]` and one new grant.
  - The session response parses with `sessionResponseSchema`, and the `secondChance` key is absent.
- [ ] **Step 2: Update `appointments.integration.test.ts`.** Get to the picker through a `later` button on an ordinary A reminder whose lesson is closed (not an «afsus» offer). Change these:
  - "reminds an hour before, reopens at the chosen time and restarts the chain": the appointment has `purpose: "reopen"` and `offerId: null`. At the chosen time there is a new grant `{ kind: "scheduled", attempt: 2 }`, a new A run starting at `chosenAt`, and a `reopenNow` message.
  - Add "keeps a pending reopen appointment made under the old offer valid": insert a `second_chance_offers` row plus an appointment with that `offerId`. It fires and reopens.
  - Add "cancels a remind appointment when the lesson closes first": the link is open, so the picker gives `remind`. Expire the link before `chosenAt`, tick at `chosenAt`, and assert `cancelledAt` is set, no new grant, no message.
  - "cancels the appointment when «Ha» reopens the lesson now" stays and uses `reopenLesson`.
- [ ] **Step 3: Run the tests and confirm they fail.** Run: `pnpm --filter @funnel/api exec vitest run src/links/reopen.integration.test.ts src/links/appointments.integration.test.ts`. Expected: FAIL (`/app/reopen` 404, the `secondChance` key is still present, `reopenLesson` is undefined).
- [ ] **Step 4: Implement the Interfaces above.**
  - `miniapp.ts`: if `reason === "open" && start === "again"` and `reopenLesson(user.id, "again", now)` returns `"reopened"`, reload the user. `expired = isLessonClosed(user, status, now)`.
  - `bot.ts` `/start`: for registered users, `await reopenLesson(user.id, "start").catch(log)` before sending the welcome.
  - `dispatch.ts`: `AppointmentRow` loses `offer` and gains `state: LessonState` (from `lessonState(db(), user, now)` per row). `appointmentStillValid`: if blocked, wrote to the admin or admin → false; `reopen` → `state.closed`; `remind` → `!state.closed && !(lastBeatAt > appointment.createdAt)`. `fireReopen` runs in one transaction: lock the open appointment, set `firedAt`, then `reopenWithin(tx, userId, "scheduled", now, ttl) === "reopened"`, otherwise roll back and return false. Remove the `secondChanceOffers` update and the `offerId` join.
  - `scheduleAppointment` inserts `offerId: null`. Delete `openOffer` and `acceptSecondChance`.
  - `LinkExpiredScreen`: always render the reopen button. It posts `/app/reopen`. On 409 it shows `watchUz.reopenClosed`; on other failures it shows `watchUz.reopenFailed`.
  - `watch.ts`: `expiredTitle: "Afsus, bonus dars o‘chib ketdi"`, `expiredBody:` the current `secondChanceBody` text, `reopenButton: "Ha, ko‘raman"`, `reopenOpening: "Ochilmoqda…"`, `reopenClosed: "Darsni qayta ochib bo‘lmadi. Savolingiz bo‘lsa, adminga yozing."`, `reopenFailed:` the current `secondChanceFailed` text. Delete the `secondChance*` keys.
- [ ] **Step 5: Generate the temporary migration.** Run: `pnpm --filter @funnel/api db:generate --name reopen_appointments`. Expected: `drizzle/0024_reopen_appointments.sql` containing only `DROP CONSTRAINT "watch_appointments_offer_shape"`.
- [ ] **Step 6: Run the tests and confirm they pass.** Run the two files from Step 3, then `pnpm typecheck && pnpm lint && pnpm test`. Expected: all PASS.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat(links): reopen a closed lesson from any «Ha», the closed screen, /start and «Keyinroq»"`

### Task 2: Remove segment D from the runtime

**Files:**
- Modify: `apps/api/src/funnel/status.ts` (delete `LinkState` and `linkBound`; `segmentFor(status)`; `endReasonFor`)
- Modify: `apps/api/src/funnel/segments.ts` (delete `linkStateOf`; cancel pending appointments only when `target === null`)
- Modify: `apps/api/src/messages/dispatch.ts` (delete `sendOffers`, `settleOffer` and the sync loop in `expireLinks`; rename what remains `sweepExpiredLinkMessages`; drop the `SECOND_CHANCE_SEGMENT` checks in `sendDue`/`nextDueForUser`)
- Modify: `apps/api/src/telegram/reminders.ts` (`recordLater` without `answerLater`)
- Modify: `apps/api/src/links/service.ts` (delete `answerLater`)
- Modify: `apps/api/src/messages/plan.ts` (delete `outOfNight` and `isSameTashkentDay`)
- Modify: `apps/api/src/leads/card.ts`, `apps/api/src/leads/notifier.ts`, `apps/api/src/leads/card.test.ts`
- Delete: `apps/api/src/funnel/secondChance.ts`, `apps/api/src/funnel/secondChance.test.ts`, `apps/api/src/links/offers.ts`, `apps/api/src/links/secondChance.integration.test.ts` (move "deletes that link's reminders at expiry" and "keeps people who reached the price in the chain after expiry" into `dispatch.integration.test.ts` first)
- Modify: `apps/api/src/funnel/status.test.ts`, `apps/api/src/funnel/segments.integration.test.ts`, `apps/api/src/links/appointments.integration.test.ts` (delete the «afsus» cadence tests), `apps/api/src/messages/dispatch.integration.test.ts`

**Interfaces:**
- Produces:
  - `segmentFor(status: FunnelStatus | null): FunnelSegment | null`
  - `endReasonFor(open: FunnelSegment, target: FunnelSegment | null, user: { botBlocked: boolean; wroteAdmin: boolean }): SegmentEndReason` gives `bot_blocked` / `wrote_admin` when the target is null, `relinked` when open equals target, else `advanced`
  - `CardUser = Pick<User, …> & { watchedPercent?: number; linkAttempt?: number | null; appointmentAt?: Date | null }`. `SecondChanceSummary` is deleted.
- Consumes: Task 1 `reopenLesson` (no service function references `secondChanceOffers` any more).

- [ ] **Step 1: Write the failing tests.**
  - `status.test.ts`: "maps every status" (`link_berildi→A`, the three B statuses `→B`, `narxni_kurdi→C`, `adminga_yozdi`/`null→null`). Delete the D test. "names each transition" covers `advanced`, `relinked`, `wrote_admin`, `bot_blocked`.
  - `segments.integration.test.ts`: "keeps the A run open after the link expires": set expiry in the past, run `syncSegment`, and the same open run id remains with `segment: "A"`.
  - `dispatch.integration.test.ts`: "deletes reminders sent while the link was open once it closes, and keeps later ones". Use two `sent_messages`, with `sentAt` before and after `link_grants.expiresAt`. After the tick, `deleteMessage` is called only for the first.
  - `card.test.ts` replaces the "second chance line" block with: "shows how many times the lesson was reopened" (`linkAttempt: 3` gives the line `🔁 Dars qayta ochildi: 2 marta`), "shows the chosen time while an appointment is pending" (`⏰ Tanlangan vaqt: …`), "shows nothing before the first reopen" (`linkAttempt: 1` gives no 🔁 line).
- [ ] **Step 2: Run the tests and confirm they fail.** Run: `pnpm --filter @funnel/api exec vitest run src/funnel/status.test.ts src/leads/card.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The sweep keeps today's query plus `lt(sentMessages.sentAt, linkGrants.expiresAt)`.
  - `notifier.ts` replaces `offered`/`lastAnswer`/`exhausted` with `linkAttempt: sql<number | null>`(select max(g.attempt) from link_grants g where g.user_id = ${leads.userId})``.
  - `recordLater(userId, visitorId, ref, op)` logs `reminder_later` and records the click unless `op === "wa"`.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `pnpm typecheck && pnpm test`. Expected: PASS. Then `rg -n "secondChanceOffers|offerHistor|nextOffer|linkStateFor|answerLater" apps/api/src` matches only `db/schema.ts` and `reports/queries.ts`.
- [ ] **Step 5: Commit.** `git commit -am "refactor(funnel): drop the «Qayta imkon» stage from the runtime"`

### Task 3: Seven-day planner

**Files:**
- Modify: `apps/api/src/messages/plan.ts`
- Modify: `apps/api/src/messages/plan.test.ts` (rewrite: keep `tashkentDayStart`, `isNightAt` and `linkExpiryFor`, delete every collapse, night-notice and expiry test)
- Modify: `apps/api/src/messages/dispatch.ts` (`Candidate.sentKeys` becomes `sentTemplateIds: number[]`; `chainFor`; `sendOne` insert without `slot`)
- Modify: `apps/api/src/routes/adminMessages.ts` (delete `POST /preview-schedule` and `remainingAt`)
- Modify: `packages/shared/src/messages.ts` (delete `schedulePreviewRequestSchema`, `schedulePreviewKinds`, `schedulePreviewSchema` and their types), `packages/shared/src/messages.ts` (delete `MORNING_SEND_MINUTE`)
- Delete: `apps/web/components/admin/messages/ScheduleSimulator.tsx`. Modify `apps/web/components/admin/messages/ReminderChain.tsx` (drop its usage), `apps/web/lib/admin/messages.ts` (delete `previewSchedule`), `apps/web/lib/i18n/admin.ts` (delete `messages.simulator`)
- Modify: `apps/api/src/messages/dispatch.integration.test.ts`, `apps/api/src/messages/messages.integration.test.ts` (delete `describe("schedule preview")`)

**Interfaces:**
- Produces (`plan.ts`):
  - `type ScheduleTemplate = { id: number; day: number; position: number; timingValue: number; statuses?: readonly FunnelStatus[] | null; attempts?: readonly number[] | null }`
  - `type PlanItem<T extends ScheduleTemplate = ScheduleTemplate> = { template: T; sendAt: Date }`
  - `type PlanInput<T> = { templates: T[]; enteredAt: Date; anchorAt: Date }`
  - `planChain<T>(input: PlanInput<T>): PlanItem<T>[]`. Day 1: `anchorAt + timingValue min`. Day N ≥ 2: `tashkentDayStart(enteredAt) + (N−1)·DAY_MS + timingValue min`. Sorted by `sendAt`, then `day`, `position`, `id`. No link, night or spacing filters.
  - `segmentChainInput<T>(templates: T[], run: { segment: FunnelSegment; enteredAt: Date; status?: FunnelStatus | null; watch?: WatchSnapshot | null; attempt?: number }): PlanInput<T>` (the attempt and status filters as today; `anchorAt = chainAnchor(run, watch)`)
  - `pickNext<T>(plan: PlanItem<T>[], sent: ReadonlySet<number>, now: Date, usage: SendUsage, cap?: SegmentCap): PlanItem<T> | null` (no night check)
  - `nextPendingDue<T>(plan: PlanItem<T>[], sent: ReadonlySet<number>, now: Date): Date | null`
  - Kept unchanged: `tashkentDayStart`, `tashkentMinuteOfDay`, `isNightAt`, `linkExpiryFor`, `chainAnchor`, `isWatchingNow`, `templatesForStatus`, `capReached`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS`, `CHAIN_MS`, `GRACE_MS`, `DAILY_CAP`.
  - Deleted: `previewChain`, `PlanKind`, `SkippedItem`, `planKey`, `outOfNight`, the collapse logic, `nightNotice`, `linkBound`, `linkExpiresAt` in `PlanInput`.

- [ ] **Step 1: Write the failing tests in `plan.test.ts`** (`T(local)` is a Tashkent-local helper):
  - "times day 1 from the stage entry": A entered `T("2026-10-20 10:00")`, `{ day: 1, timingValue: 60 }` gives `T("2026-10-20 11:00")`.
  - "times B day 1 from the last pause": entered 10:00, `lastBeatAt` 12:00, value 30 gives 12:30.
  - "puts day N at the clock time of the Nth Tashkent day from entry": entered `T("2026-10-20 15:00")`, `{ day: 3, timingValue: 600 }` gives `T("2026-10-22 10:00")`.
  - "counts B days from entry, not from the last pause": entered `T("2026-10-20 10:00")`, `lastBeatAt` `T("2026-10-21 09:00")`, `{ day: 2, timingValue: 600 }` gives `T("2026-10-21 10:00")`.
  - "starts day 2 at the next Tashkent midnight": entered `T("2026-10-20 23:50")`, `{ day: 2, timingValue: 30 }` gives `T("2026-10-21 00:30")`.
  - "sends day-1 reminders that land at night as scheduled": entered 22:30, value 60. `pickNext` at `T(23:30)` returns it.
  - "keeps two reminders a minute apart": day 2 at 600 and 601. Both are planned; `pickNext` at 10:00 returns the first, and with that id in `sent` it returns the second at 10:01.
  - "orders same-time reminders by position, then id".
  - "pickNext gives up after the grace period" (61 min late gives `null`), "stops at the daily cap", "skips sent ids", and `nextPendingDue` "finds the next pending send".
- [ ] **Step 2: Rewrite `dispatch.integration.test.ts`.** Delete "collapses a night message into 07:30", "does not carry a message due just before 23:00…" and "replays the TZ 10:00 row…". Set every `makeTemplate` `timingValue` under the new meaning. Add:
  - "sends day-2 clock reminders after the link has closed": A run, link expired after 24h, `{ day: 2, timingValue: 600 }` is sent at day-2 10:00 and the run stays A.
  - "sends a day-1 reminder at night as scheduled".
  - "never sends a reminder added after its time passed": run entered 2 days ago, create `{ day: 2, timingValue: 600 }` now (day 3 12:00), tick, nothing is sent.
- [ ] **Step 3: Run the tests and confirm they fail.** Run: `pnpm --filter @funnel/api exec vitest run src/messages/plan.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement the Interfaces above.** In `loadCandidates`, `sentTemplateIds` is ``coalesce(array_agg(sent_messages.template_id) filter (where template_id is not null), '{}')::bigint[]``, mapped to `number[]`.
- [ ] **Step 5: Run the tests and confirm they pass.** Run: `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS.
- [ ] **Step 6: Commit.** `git commit -am "feat(messages): plan reminders on a 7-day timeline without night rules"`

### Task 4: Remove D from shared types, the admin UI and reports; «8+» link option

**Files:**
- Modify: `packages/shared/src/funnel.ts`:
  - `funnelSegments = ["A", "B", "C"]`
  - delete `chainSegments`, `SECOND_CHANCE_OCCASIONS`, `SECOND_CHANCE_WINDOW_DAYS`, `SECOND_CHANCE_INTERVAL_HOURS`, `MAX_LINK_ATTEMPTS`, `offerVariantStatuses`, `offerVariantFor`, `offerVariantOf`
  - add `LINK_ATTEMPT_OPTIONS = 8`
  - keep `offerVariants`, `offerAnswers`, `OfferAnswer` for the history table
- Modify: `packages/shared/src/messages.ts`:
  - delete `SECOND_CHANCE_SEGMENT`, the D entry in `segmentStatuses`, the D branches in `normalizeStatuses`/`statusesError`, `buttonKindsFor`, `defaultButtonFor`, `secondChanceButtonKinds`, `chainButtonKinds`, `"occasion"` from `timingTypes`, the `occasion_only` check and error
  - `linkAttempts = 1…LINK_ATTEMPT_OPTIONS`
  - `attempts` schema `.max(LINK_ATTEMPT_OPTIONS)`
  - add `attemptBucket`; `templatesForAttempt` matches `attemptBucket(attempt)`
  - `validateTemplateInput` checks buttons against `templateButtonKinds`
- Modify: `packages/shared/src/adminSettings.ts`: `DEFAULT_MESSAGE_CAPS.B` becomes `{ daily: 4, total: null }` (Builder decision 10); update any test asserting the old default
- Modify: `apps/api/src/messages/repo.ts` (remove `"occasion_exists"` from `TemplateConflict`), `apps/api/src/messages/seed.ts` (`SeedSegment = FunnelSegment`)
- Modify: `apps/api/src/reports/queries.ts` (per-message query `AND t.segment IN ('A', 'B', 'C')`)
- Delete: `apps/web/components/admin/messages/SecondChancePages.tsx`
- Modify web:
  - `apps/web/app/(site)/admin/(panel)/messages/page.tsx`: remove the D branch
  - `apps/web/components/admin/messages/StageOverview.tsx`: remove the D status
  - `MessageEditor.tsx`: remove `sheetTitle`'s variant, the `secondChance` flag and the `SECOND_CHANCE_SEGMENT` branch in `usesExtras`
  - `ButtonsEditor.tsx`: use `templateButtonKinds` and default `{ kind: "resume", text: buttonPresets.resume }`
  - `TimingPicker.tsx`: remove the `"occasion"` filter and the `D` entry in `stageTimingTypes`
  - `AttemptPicker.tsx`: «8+» label
  - `MessageCapsCard.tsx`: use `funnelSegments`
  - `components/admin/reports/MessageReportTable.tsx`: drop the D title
  - `components/admin/bot/scenarios.ts`: `ScenarioId` `"secondChance"` becomes `"later"`
  - `lib/i18n/admin.ts`
- Modify tests: `apps/api/src/messages/schema.test.ts`, `apps/api/src/messages/messages.integration.test.ts` (delete `describe("second chance pages")`), `apps/api/src/messages/timing.test.ts` (drop occasion cases)

**Interfaces:**
- Produces:
  - `LINK_ATTEMPT_OPTIONS = 8`
  - `attemptBucket(attempt: number): number` (= `Math.min(attempt, LINK_ATTEMPT_OPTIONS)`)
  - `templatesForAttempt<T>(templates: T[], attempt: number): T[]`
  - `attemptLabel(attempt: number): string` in `AttemptPicker.tsx` (`8` gives `"8+"`)
  - `FunnelSegment = "A" | "B" | "C"`
- i18n (exact copy):
  - delete `segments.D`, `messages.stages.titles.D`, `messages.stages.occasionsFilled`, `messages.secondChance`, `messages.timing.after_entry.D`, `editor.timingTypes.after_entry.D`, `editor.timingTypes.occasion`, `editor.timingExamples.after_entry.D`, `editor.timingExamples.occasion`, `errors.occasion_only`, `errors.occasion_exists`, `reports.messages.rowTitleOccasion`
  - `editor.buttonKinds.again: "Ha, ko‘raman (yopilgan darsni qayta ochadi)"`
  - `attempts.hint: "1 — birinchi berilgan havola. Dars har safar qayta ochilganda raqam bittaga oshadi. «8+» — 8-havola va undan keyingilari."`
  - `reports.secondChance.title: "Qayta imkon (eski)"`, `reports.secondChance.subtitle: "Eski «Qayta imkon» bosqichidagi «afsus» xabarlari. Yangi ma’lumot qo‘shilmaydi."`
  - `botTexts.tabs.later: "Keyinroq va qayta ochish"` replaces `tabs.secondChance`
  - `botTexts.items.offerClosed.when: "Ro‘yxatdan o‘tmagan yoki adminga yozgan odam eslatmadagi tugmani bosganda"`
  - `botTexts.items.reopenNow.when: "Tanlangan vaqtda, yangi link bilan. Bosqich eslatmalari 1-kundan qayta boshlanadi"`

- [ ] **Step 1: Write the failing tests.**
  - `schema.test.ts`: "allows «Ha» and «Keyinroq» in every stage" (segments A, B, C with buttons `again` + `later` give `validateTemplateInput(...) === null`); "rejects segment D" (`messageTemplateBaseSchema.safeParse({ ...valid, segment: "D" }).success === false`); "accepts link 8 as 8 and later" (attempts `[8]` are valid; `templatesForAttempt([{ attempts: [8] }], 9)` has length 1, and with `[7]` it has length 0).
  - `messages.integration.test.ts`: "rejects the removed stage D": `GET /admin/messages?segment=D` gives 400.
- [ ] **Step 2: Run the tests and confirm they fail.** Run: `pnpm --filter @funnel/api exec vitest run src/messages/schema.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Make the edits listed under Files.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS. `rg -n "SECOND_CHANCE|offerVariantOf|offerVariantFor|chainSegments|MAX_LINK_ATTEMPTS|SecondChancePages" apps packages --glob '!**/node_modules/**'` is empty.
- [ ] **Step 5: Commit.** `git commit -am "refactor: remove the «Qayta imkon» stage from types, admin and reports"`

### Task 5: Single-value timing model and the production migration

**Files:**
- Modify: `packages/shared/src/messages.ts`:
  - delete `timingTypes`, `TimingType`, `TemplateTiming`, `isNightMinute`'s use in `validateTiming`, `dayForTiming`, `isExpiryTiming`, `EXPIRY_TIMELINE_GROUP`, `TimelineGroupKey`, `TimelineEntry`, `timelineGroupKey`, `timelineSortKey`, `NIGHT_NOTICE_MINUTE`, `linked_only`/`night`/`outside_day` errors, the `night_notice` check in `validateTemplateInput`, `templateTimingSchema`
  - replace `timing` with `minute` in `messageTemplateBaseSchema`
  - keep `NIGHT` and `isNightMinute` (picker and `linkExpiryFor`)
- Modify: `apps/api/src/db/schema.ts`:
  - remove `timingType` and the checks `message_templates_timing_type_values`, `_occasion_shape`, `_night_notice_shape`, `_day_time_range`
  - remove the indexes `message_templates_occasion_slot_idx` and `_night_notice_idx`
  - add check `message_templates_timing_value_range`: `${t.timingValue} between 0 and 1439`
  - change `message_templates_segment_values` to `${t.segment} in ('A', 'B', 'C') or ${t.deletedAt} is not null`
  - drop the `timingTypes` import
- Delete: `apps/api/drizzle/0024_reopen_appointments.sql`, its `meta/0024_snapshot.json` and its `_journal.json` entry. Then run `pnpm --filter @funnel/api db:generate --name reminder_timeline` and append the data SQL to `apps/api/drizzle/0024_reminder_timeline.sql`.
- Modify: `apps/api/src/db/migrate.ts` (`onnotice` forwards `severity === "INFO"` to `console.info`)
- Modify: `apps/api/src/messages/repo.ts`:
  - `toTemplate` maps `minute: row.timingValue`
  - `columns` writes `timingValue: input.minute`
  - delete `templateConflict`, `TemplateConflict`, `constraintOf`
- Modify: `apps/api/src/routes/adminMessages.ts` (delete `saveTemplate`; create and update call the repo directly)
- Modify: `apps/api/src/messages/seed.ts`:
  - `SeedTemplate = { day; minute; text; buttons; statuses? }`
  - `hoursBeforeExpiry(h)` becomes `afterEntry((24 − h) · 60)`
  - delete `NIGHT_NOTICE` and its two rows
  - `dayAt(h)` becomes `h · 60`
- Modify web:
  - `TimingPicker.tsx`: rewrite
  - `MessageCard.tsx`: label
  - `MessageEditor.tsx`: `minute`, payload without `dayForTiming`, `MessagePreset = { day: number; minute: number; text?: string; statuses?: FunnelStatus[] | null; buttons?: TemplateButton[] }`
  - `ReminderChain.tsx`: group by `day` with `compareTimeline`; remove `NightRules` and the expiry group
  - `StageOverview.tsx`: count `items.length`; delete `chainItems`
  - `page.tsx`: editor `key`
  - `lib/i18n/admin.ts`
- Delete: `apps/web/components/admin/messages/NightRules.tsx`
- Create: `apps/api/src/db/reminderTimeline.migration.integration.test.ts`
- Modify tests that build templates with `timingType`/`timing`: `timing.test.ts` (rewrite), `schema.test.ts`, `messages.integration.test.ts`, `dispatch.integration.test.ts`, `appointments.integration.test.ts`, `reopen.integration.test.ts`, `reports/reports.integration.test.ts`, `telegram/adminHome.integration.test.ts`, `seed.test.ts`

**Interfaces:**
- Produces (shared):
  - `MessageTemplateInput = { segment; day; text; media; minute: number; buttons; isActive; statuses; attempts }`
  - `TimingError = "out_of_range"`
  - `validateTiming(day: number, minute: number): TimingError | null` (integer 0–1439 for every day 1–7)
  - `TemplateValidationIssue` path `"minute"`, and the zod issue path `["minute"]`
  - `defaultMinute(day: number): number` (day 1 gives 60, else 600)
  - `compareTimeline(a: Pick<MessageTemplate, "day" | "minute" | "position" | "id">, b: same): number` (sorts by day, minute, position, id)
  - `isSameMoment(a, b): boolean` (same day and minute)
- Produces (web `TimingPicker.tsx`):
  - `timelineLabel(day: number, minute: number): string` (day 1 gives `"+1 soat 30 daqiqa"`, else `"10:00"`)
  - `timingSummary(segment: FunnelSegment, day: number, minute: number): string`
  - `TimingPicker({ segment, day, minute, onChange: (minute: number) => void, error: TimingError | null })`. Day 1 has two number inputs (soat 0–23, daqiqa 0–59). Days 2–7 have `TimePicker` with no `isDisabled`. There is no day selector.
- i18n (exact):
  - `messages.timing = { afterEntry: { A: "Havolani olganidan {time} keyin", B: "To‘xtaganidan {time} keyin", C: "Narxni ko‘rganidan {time} keyin" }, clock: "{n}-kun, soat {time}" }`
  - `editor.timingHints = { A: "Masalan: havolani olganidan 1 soat o‘tib", B: "Videoni to‘xtatganidan keyin hisoblanadi. Yana ko‘rib, yana to‘xtasa, vaqt qaytadan hisoblanadi", C: "Masalan: narxni ko‘rganidan 1 soat o‘tib", clock: "Toshkent vaqti bilan" }`
  - delete `editor.timingKind`, `customTiming`, `standardTiming`, `timingTypes`, `timingExamples`, `days`, `before`, `hoursBefore`, `messages.expiryGroup`, `messages.nightNotice`, `errors.outside_day`, `errors.night`, `errors.linked_only`, `errors.night_notice_exists`

Migration data block, inserted after the generated `DROP CONSTRAINT`/`DROP INDEX` lines and before `ALTER TABLE "message_templates" DROP COLUMN "timing_type"`. Statements are separated by `--> statement-breakpoint`, in this order:
1. `ttl` = `coalesce((select value::int from settings where key = 'LINK_TTL_HOURS' and value ~ '^[0-9]+$' and value::int > 0), 24)`. Inline it as a subquery wherever it is used.
2. `DO $$ … RAISE INFO 'reminder-timeline: dropped occasion 7 text #%: %', id, left(text, 120)` for each live D template with `day = 7`. Do the same with `'reminder-timeline: day-1 clock reminder #% moved to day 2'` for each live `day_time` template with `day = 1`.
3. Copy into A: each live D template with `statuses = array['link_berildi']` and `day <= 6` becomes `segment 'A'`, `day = day + 1`, `timing_type 'day_time'`, `timing_value 600`, `statuses null`, `attempts null`, and the same `text`, `media_type`, `media_file_id`, `buttons`, `is_active`. `position` = `coalesce(max(position), -1) + 1` over live rows of that segment/day.
4. Copy into B: the same, but per day 1–6 take the live D page containing `'korishni_boshladi'` if there is one, else the `link_berildi` page (`DISTINCT ON (day)` ordered by that preference).
5. Convert every row, deleted ones included:
   - `after_entry`: `day = timing_value / 1440 + 1`, `timing_value = timing_value % 1440`
   - `before_expiry`: `day = 1`, `timing_value = greatest(0, least(1439, ttl*60 - timing_value))`
   - `day_time` with `day = 1`: `day = 2`
   - `night_notice` and `occasion`: `deleted_at = coalesce(deleted_at, now())`, `timing_value = 0`
6. End D runs: `update segment_runs set ended_at = now(), end_reason = 'relinked' where segment = 'D' and ended_at is null`.
7. Insert one run per user ended in step 6 (`end_reason = 'relinked' and segment = 'D' and ended_at = now()`) with no other open run, whose user is not blocked and has not written to the admin. Set `entered_at` to the start of the previous Tashkent day (`date_trunc('day', now() at time zone 'Asia/Tashkent') - interval '1 day'` converted back to timestamptz), so today is their day 2 and they get the «afsus» reminders, not day-1 "lesson open" texts (owner decision 2026-10-26), and `attempt = coalesce(link_grants.attempt, ended.attempt)` via `users.link_id`. The segment is `'C'` if `offer_watched_at is not null` or `max_position >= videos.price_sec`; `'A'` if there is no `watch_progress` row or (`started_at is null and max_position = 0`); else `'B'`.
   Steps 3–4 read only live D rows and steps 6–7 read only open D runs, so a re-run inserts nothing twice.

- [ ] **Step 1: Write the failing unit tests.** In `timing.test.ts`: `validateTiming(1, 0)`, `(1, 1439)`, `(3, 30)` (night allowed) and `(7, 1439)` are `null`; `(1, 1440)`, `(2, -1)` and `(2, 1.5)` are `"out_of_range"`; `defaultMinute(1) === 60`, `defaultMinute(4) === 600`; `compareTimeline` orders `[{day:2,minute:600,position:1,id:9},{day:1,minute:900,…},{day:2,minute:600,position:0,id:12}]` as day 1, then position 0, then position 1; `isSameMoment` is true only for the same day and minute. In `schema.test.ts`: "accepts a night clock time" (`{ day: 3, minute: 30 }` is valid).
- [ ] **Step 2: Write the failing migration test** `reminderTimeline.migration.integration.test.ts`. Use isolated DB `vf_migration`. Copy `apps/api/drizzle` to a temp dir with `_journal.json` truncated to entries ≤ `0023`, migrate there, insert legacy rows with raw SQL, then call `runMigrations(url)`. Tests:
  - "copies D occasions 1–6 into A and B day N+1 at 10:00": occasion 1 has both pages, occasion 2 has `not_opened` only. A day 2 holds the occasion 1 `not_opened` text, B day 2 holds the `no_price` text, and B day 3 falls back to the occasion 2 `not_opened` text. All have `timing_value 600` and `statuses null`.
  - "drops occasion 7 and soft-deletes every D template": no live `segment = 'D'` rows remain.
  - "appends copies after existing reminders and keeps media, buttons and the active flag": A day 2 already has position 0. The copy gets position 1 and keeps `media_type='photo'`, `buttons` and `is_active=false`.
  - "converts legacy timings": `after_entry` `2*1440+75` on day 3 becomes day 3 minute 75. `after_entry` 90 stays day 1 minute 90. `before_expiry` 180 without a TTL setting becomes day 1 minute 1260. `before_expiry` 180 with `LINK_TTL_HOURS=48` becomes 1439. `day_time` 540 on day 1 becomes day 2 minute 540. `night_notice` is soft-deleted.
  - "moves open D runs back to A or B without sending or relinking": a D user with no progress ends with D `relinked` and a new open A run whose `attempt` equals their grant's attempt and whose `entered_at` is the start of yesterday in Tashkent; a played user gets B. `link_grants` and `users.link_expires_at` are unchanged, and `sent_messages` is empty.
  - "keeps pending «Keyinroq» appointments": a pending appointment with `offer_id` is still pending.
- [ ] **Step 3: Run the tests and confirm they fail.** Run: `pnpm --filter @funnel/api exec vitest run src/messages/timing.test.ts src/db/reminderTimeline.migration.integration.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement** the shared, schema, repo, route, seed and web changes listed under Files and Interfaces. Then delete the Task 1 migration, generate `0024_reminder_timeline`, and add the data block. Check the generated SQL: it must drop `watch_appointments_offer_shape`, the four `message_templates` checks and the two indexes, drop the column, and add the two new checks.
- [ ] **Step 5: Run the tests and confirm they pass.** Run: `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS. Then `pnpm --filter @funnel/api exec vitest run src/messages/seed.test.ts src/messages/seed.integration.test.ts` passes with the converted seed.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(messages): one timing value per reminder and migrate D, night notices and expiry timings"`

### Task 6: Admin day tabs

**Files:**
- Create: `apps/web/components/admin/messages/DayTimeline.tsx`
- Delete: `apps/web/components/admin/messages/ReminderChain.tsx`
- Modify: `apps/web/app/(site)/admin/(panel)/messages/page.tsx` (selected day state, `onAdd(day)`, editor preset)
- Modify: `apps/web/components/admin/messages/MessageCard.tsx` (show button labels instead of the count)
- Modify: `apps/web/components/admin/ui/Segmented.tsx` (optional `scroll?: boolean` prop that swaps `inline-flex max-w-full` for `flex w-max` and stops items shrinking)
- Modify: `apps/web/lib/i18n/admin.ts`

**Interfaces:**
- Produces:
  - `dayCounts(items: MessageTemplate[]): number[]` (length `TEMPLATE_DAYS`, active items only)
  - `DayTimeline({ segment, items, videoMarks, day, onDayChange: (day: number) => void, onAdd: (day: number) => void, onEdit, onToggle, onMove })`. Tabs come from `Segmented` with `role="tablist"`, `scroll`, labels `copy.dayLabel` and `sub` = count, inside `div.-mx-4.overflow-x-auto.px-4`. Below the tabs: `copy.restartNote`, the day's list sorted by `compareTimeline` (`onMoveUp`/`onMoveDown` only between `isSameMoment` neighbours), `copy.emptyDay` when the day is empty, and a secondary button `copy.addForDay` that calls `onAdd(day)`.
  - Page: `const [day, setDay] = useState(1)`, reset to 1 on stage change. New-item preset is `{ day, minute: defaultMinute(day) }`. Editor `key` is `item?.id ?? \`new-${segment}-${day}\``.
- Consumes: `compareTimeline`, `isSameMoment`, `defaultMinute`, `timelineLabel`, `MessagePreset` (Task 5).
- i18n (exact):
  - `messages.dayTabs: "Kunlar"`
  - `messages.addForDay: "{n}-kunga eslatma qo‘shish"`
  - `messages.emptyDay: "Bu kunga hali eslatma yozilmagan"`
  - `messages.restartNote: "Dars qayta ochilsa («Ha, ko‘raman», «Keyinroq» yoki /start), bosqich 1-kundan qayta boshlanadi."`
  - `segments.A.explanation: "Havolani olgan, lekin videoni hali ochmagan odamlar. 1-kun eslatmalari bosqichga kirgandan keyin o‘tgan vaqt bilan, 2–7-kunlar belgilangan soatda boradi. Videoni ochishi bilan «Ko‘rib to‘xtaganlar» xabarlari boshlanadi."`
  - `segments.B.explanation: "Videoni ochgan, lekin narx aytiladigan joyga yetmagan odamlar. 1-kunda vaqt videoni oxirgi to‘xtatgan paytdan hisoblanadi, ko‘rib turgan paytda xabar bormaydi. 2–7-kunlar belgilangan soatda. Narxni eshitishi bilan «Narxni ko‘rib, yozmaganlar» xabarlari boshlanadi."`
  - delete `messages.addMessage`, `emptyTitle`, `emptyHint`, `writeFirst`

- [ ] **Step 1: Implement.** Build `DayTimeline`, wire the page, update `MessageCard` (button texts joined by `" · "` after `ButtonsIcon`) and make the i18n changes.
- [ ] **Step 2: Verify the build.** Run: `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS.
- [ ] **Step 3: Verify in the browser** (use the `run` skill against a local API on the test container, not `vf-dev-pg`). At 375×812 on `/admin/messages?stage=A`:
  - seven tabs «1-kun»…«7-kun», each with a count and 0 shown for empty days; tabs scroll horizontally and the page does not
  - selecting «2-kun» lists only day-2 items sorted by time
  - «2-kunga eslatma qo‘shish» opens the editor with a clock picker at 10:00, and «1-kun» opens it with «+1 soat»
  - same-time items show up/down
  - the overview has three stage cards and no «Qayta imkon»
- [ ] **Step 4: Commit.** `git add -A && git commit -m "feat(admin): edit each stage's reminders by day tabs"`

### Task 7: Dead-code sweep and full verification

**Files:**
- Modify: whatever the greps below find. Expected leftovers: unused i18n keys in `apps/web/lib/i18n/admin.ts`, `linkBoundSegments` vs `attemptTargetSegments` (keep both; they are used), unused exports in `packages/shared/src/messages.ts` (`TimelineEntry`, `MORNING_SEND_MINUTE` if left).

- [ ] **Step 1: Grep gate.** Run: `rg -n "SECOND_CHANCE|secondChance|second-chance|night_notice|nightNotice|before_expiry|occasion|MORNING_SEND|NIGHT_NOTICE|previewChain|schedulePreview|timingType|TemplateTiming|offerVariantFor|linkStateFor|dayForTiming|ScheduleSimulator|NightRules|ReminderChain" apps packages --glob '!**/node_modules/**' --glob '!apps/api/drizzle/**'`. Expected: matches only in `apps/api/src/db/schema.ts` (`secondChanceOffers` table), `apps/api/src/reports/queries.ts` and `packages/shared/src/reports.ts` (the legacy report), `apps/web/components/admin/reports/SecondChanceReport.tsx`, the reports page and `reports.secondChance` i18n, `packages/shared/src/index.ts` (`second_chance_*` event names) and the migration test. Remove anything else.
- [ ] **Step 2: Unused i18n.** For every key under `adminUz.messages` and `watchUz`, `rg` its usage in `apps/web`. Delete the unused ones.
- [ ] **Step 3: Full verification.** Run: `pnpm typecheck && pnpm lint && pnpm test` with `TEST_DATABASE_URL` set. Expected: all PASS with no skipped integration suites (check the vitest summary).
- [ ] **Step 4: Fresh-DB migration check.** Run: `DATABASE_URL=$TEST_DATABASE_URL pnpm --filter @funnel/api db:migrate` against a new empty database on the test container, then `pnpm --filter @funnel/api seed:templates`. Expected: both succeed, and A/B/C have only day/minute rows with no `timing_type` column.
- [ ] **Step 5: Commit.** `git commit -am "chore: remove leftovers of the old reminder model"`
