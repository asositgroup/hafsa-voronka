# Release notes: TZ gaps, phases 1-4 (October 2026)

Covers commits 90b5203, c2ba852, 1c34aa1 and 5dcb166. The second-chance ("afsus") flow is not part of this release.

## For admins

### 24h links
- The default link lifetime is now 24 hours. If production still has 72 saved, set it to 24 in Sozlamalar.

### «Yozdi» and "won"
- Lead cards have a new «Yozdi» button. Press it when the person wrote to you.
- Marking a lead "won" does the same. Both stop all reminders for that person.
- Only the admin-button click inside the bot used to stop reminders. Now the button click, «Yozdi» and "won" all do. A plain channel click is only counted in reports.

### Night rules (TZ 1.1)
- Reminders that fall in the night (23:00 to 07:00) collapse into one message at 07:30, showing the real remaining time.
- If that morning message would come within 1 hour of another message or of the expiry, it is dropped.
- A link that would expire at night now expires at 09:00.
- Optional 22:00 warning ("night notice"): it goes out when the night would swallow 2 or more reminders. You must create this message yourself in the messages constructor (timing "night notice"); it is not created automatically.
- "Jadvalni sinash" in the messages page shows the resulting schedule for a test registration time, so you can check it without waiting.

### Messages for people who stopped watching (segment B)
- A message can target stop points with the new «Kimga» filter. The stop point is checked when the message is sent, not when it was scheduled.
- "After" timings now count from the last time the person watched, not from when they entered the segment. Nothing is sent while the person is watching.
- Caps are set in Sozlamalar per audience (A, B, C): daily and total. Defaults: A and C 10 per day, no total; B 4 per day and 7 in total.
- The lesson start mark (default 5:00) now decides the line between "just started" and "halfway", and the reports use it too.

## For users (Mini App)
- If you come back to a video you stopped, a screen asks: continue (5 seconds before where you stopped) or start from the beginning.
- Progress is saved every 5 seconds, and also when the app is closed.
- A backup of the position is kept on the phone, used if the server copy is missing.
- iOS: the position is set again after the video starts, so resume works on iPhones.
- After the price point the seek lock is off: people can scrub freely once they have seen the price.
- Anti-cheat: a forged far-ahead progress report no longer moves the credited position.
- The session reply is no-store, so the app never shows stale progress.

## Behaviour changes compared to before
- Night messages were each moved to 07:00. Now they collapse into one message at 07:30, and some are dropped.
- Expiry at night used to stay as is. Now it moves to 09:00.
- Segment B "after" timings used to count from entering the segment. Now they count from the stop.
- The daily limit for segment B was a single global 10. Now B has its own 4 per day and 7 total by default.
- The default link lifetime changes from 72h to 24h for new links; set it in Sozlamalar if production still has 72.

## Operator checklist
See "Release Checklist for This Branch" in `docs/DEPLOY.md`. Migrations 0014 to 0016 run at startup. Run `scripts/check-range.sh <video_url>` for TZ Test 6.
