# Landing page v2: implementation prompt

You are implementing a redesign of the landing page only. Work autonomously, then report. Another engineer reviews your PR.

## Context

- **Repo:** pnpm monorepo (pnpm 11, Node 24).
  - `apps/web` is Next.js 16.4 (App Router, Tailwind 4, `cacheComponents: true`) on Vercel.
  - `apps/api` is the backend. **Don't touch it.**
  - `packages/shared` holds shared code.
- **Next 16 has breaking changes.** Read `apps/web/AGENTS.md`, then the relevant guide in `apps/web/node_modules/next/dist/docs/` before writing layouts, images or metadata.
- **The product:** a free 17-minute Arabic video lesson by **Hafsa ustoza** (founder of IQRA Akademiyasi, 12+ years teaching Qur’an and Arabic). The audience is Uzbek women who want to start learning Arabic and read the Qur’an. They arrive from Instagram and Facebook ads **on phones**. The landing page's only job is a tap on a button that opens the Telegram bot with a tracked deep link.
- **What exists now:** a correct but plain landing page (`docs/design/landing-v2/reference/current-390.png`) built on the "Harakat" design system (tokens in `apps/web/app/globals.css`, signature component `components/brand/HarakatWord.tsx`).
- **The inspiration:** the client supplied a mockup (`reference/mockup-App.tsx`, `reference/mockup-style.css`, screenshots `reference/mockup-390.png`, `reference/mockup-1280.png`). It was reviewed. **Take its structure and pacing, not its surface.** Exactly what to keep and what to replace is specified below; follow this document, not the mockup, wherever they differ.

## Hard rules

1. **No code comments of any kind:** no docstrings, TODOs, section headers or JSX comments.
2. **Build this spec exactly. No additions, no "improvements".** Anything unspecified gets the most restrained option using only the tokens below; list each such choice under "Decisions" in your report.
3. **Scope:**
   - You may edit only `apps/web/app/(site)/page.tsx`, `apps/web/app/(site)/layout.tsx` (metadata only if needed), `apps/web/content/landing.ts`, `apps/web/components/landing/**`, `apps/web/app/globals.css` (adding the tokens listed here), and `apps/web/components/brand/**` (only to add a size or color prop if needed).
   - Don't touch the Mini App (`app/(miniapp)`, `components/miniapp|registration|watch`), admin, `apps/api`, `packages`, or `lib/tracking`/`lib/api`.
4. **Keep the tracking exactly as it works today:**
   - `LandingTracker`, `FacebookPixel`, and `CtaButton`'s `v_<visitor_id>` deep link and click beacon.
   - **Every button and every clickable visual on the page must be a `CtaButton`.** Add variants as needed; never a plain `<a href="#…">`. The mockup's anchor links (`#qanday-olish`, `#telegram`) are a bug: they cost conversions.
   - `StickyBottomCta` and its hide-while-the-hero-CTA-is-visible behavior (`components/landing/ids.ts`) stay.
5. **Real semantic HTML:** one `<h1>`, `<h2>` per section, `<h3>` per card. Never `div role="heading"`.
6. **No new dependencies.** Fonts stay Golos Text (`--font-sans`) and Scheherazade New (`--font-arabic`) via `next/font`. **Don't add Playfair, DM Sans or any other family.**
7. **Git:**
   - Create the branch `feat/landing-v2` from `main`.
   - Make small commits, each ending with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   - Push the branch and open a **draft PR** against `main`. The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
   - Never push to `main`.

## Keep from the mockup

1. **Section rhythm with alternating grounds:**
   1. ink hero
   2. paper "lesson"
   3. warm cream "audience"
   4. paper "teacher"
   5. ink "steps + final CTA"
   6. ink-deep footer
2. **A header bar over the hero:** brand on the left, a small gold CTA on the right.
3. **Hero composition:** copy on the left, a framed visual on the right, with an **arch** shape (round top, small bottom radius) and a circular "12+" badge overlapping the frame.
4. **The lesson section as 3 cards in one bordered row** on desktop, stacked on phones.
5. **The audience section as two columns:** intro on the left, a ruled list on the right, and a bordered closing row with a CTA.
6. **The teacher section:**
   - **Left:** an identity panel in an arch, sticky on desktop.
   - **Right:** the lead paragraph, the study-path rows, the ijaza line, and a dark "2014" card.
7. **A steps row and a large closing CTA card** inside the ink section, with the privacy line.
8. **Generous section padding and large display headings.** That scale contrast is what makes the page feel like an occasion.

## Replace (do not carry these over)

| Mockup | Do instead |
| --- | --- |
| Stock Unsplash photo of a woman in niqab | The **lesson poster** `public/landing/lesson-poster.webp` (1280×720), shown as the video with a play button (see Hero). Never a photo of a stranger. |
| A gold italic word in every heading | No italics, no single-word color accents in any heading. The only accent is the **gold-harakat اِقْرَأْ** (`<HarakatWord word="iqra" />`), once, in the hero visual. |
| Tracked-out ALL-CAPS eyebrow above every section | Remove eyebrows entirely. |
| Playfair Display, DM Sans, cream + tan gold palette | Existing fonts and tokens, plus the two new tokens below. |
| Faded random Arabic letters (ع, ض), diagonal line textures, radial glows, grid-paper background, conic "pattern" | Remove all of them. Flat grounds only. |
| Latin italic "H" monogram | `<HarakatWord word="hafsa" />` (calligraphic حفصة) in Varaq on Zumrad. |
| «طَلَبُ الْعِلْمِ — Ilm talab qilish…» quote | Remove (an unapproved religious text). |
| Check-mark icons on cards and list items | Cards: Arabic-Indic numerals ١ ٢ ٣. List items: qalam-rhombus markers. |
| Faded "01 02 03" big numbers | Arabic-Indic ١ ٢ ٣ in `font-arabic`, Zumrad, 44px, top-right of each card. |
| Arrow-in-circle pill buttons, hover lift | Our buttons: radius 14, 56px tall, no icon (except the Telegram icon where specified), no hover movement; hover only darkens the background slightly using `color-mix` on the token. |
| Pill with glowing dot; "BEPUL VIDEO DARS — 5 MUHIM QADAM — 17 DAQIQA" strip | One plain fact line (see Hero). No strip. |
| 8–13px text, faint white at 42–58% | Minimum 14px everywhere except the footer legal line (13px). Every text color must pass WCAG AA on its background (see Tokens). |
| Desktop-first CSS | Mobile-first. Design at 390px first, then enhance at `md` (768) and `lg` (1024). |

## Tokens

Use the existing tokens in `globals.css`: siyoh `#123B33`, siyoh-deep `#0C2C26`, zumrad `#1E5C4D`, oltin `#E2B04A`, varaq `#E8EEEA`, kumush `#A7C2B8`, qalam `#3E6359`, chiziq, chegara, chegara-tun, white.

Add only these:

| Token | Value | Use |
| --- | --- | --- |
| `--color-qumloq` | `#F2ECE1` | Ground of the audience section only. Siyoh on it is 10.5:1, Qalam 5.7:1. **Never gold on it (1.7:1).** Markers there are Zumrad. |
| `--color-telegram` | `#2AABEE` | The Telegram paper-plane icon only (4.8:1 on Siyoh). Never text. |

Text colors on ink: Varaq for primary, Kumush for secondary. Never white at reduced opacity.

## Type scale (Golos Text)

| Role | Phone | ≥1024px |
| --- | --- | --- |
| H1 | 40px / 1.05, 700, tracking -0.03em | 64px / 1.02 |
| H2 | 32px / 1.1, 700, tracking -0.02em | 48px |
| H3 (cards) | 20px / 1.25, 600 | 22px |
| Lead | 18px / 1.55 | 20px |
| Body | 16px / 1.6 | 17px |
| Small | 14px / 1.5 | 14px |
| Footer legal | 13px | 13px |
| Arabic numerals | 44px, `font-arabic`, line-height 1 | 52px |

Layout:
- Container `max-w-[1180px]`, side gutter 20px on phones and 32px from `md`.
- Section padding 72px top and bottom on phones, 112px from `lg`.
- Left-align all Uzbek text. Center only button labels.

## Sections, in order

Copy is in `docs/design/landing-v2/copy.md`. **Use it verbatim**, and move all landing copy into `content/landing.ts`.

### 0. Header (over the hero, not sticky)
- Absolutely positioned at the top of the hero, height 64px on phones and 84px from `lg`. A bottom hairline in Varaq at 14% opacity is the one allowed translucent line.
- **Left:** `<HarakatWord word="hafsa" />` at 28px height in Varaq, then "Hafsa ustoza" in 17px, weight 600.
- **Right:** a gold `CtaButton` variant `"header"`: 44px tall, radius 12, 15px, weight 600.
- No nav links.

### 1. Hero (Siyoh)
- **Padding:** top = header height + 28px on phones (+56px from `lg`); bottom 56px on phones, 96px from `lg`.
- **Phone order:** fact line → H1 → video visual → lead → CTA → Telegram note. This keeps the H1, the product and the CTA within the first 844px.
- **Desktop:** two columns, 1.05fr / 0.95fr, 64px gap, vertically centered. Left: fact line, H1, lead, second paragraph, CTA row (CTA + Telegram note side by side). Right: the visual.
- **Fact line:** an 8px gold rotated-square marker, then "17 daqiqalik bepul videodars" in 14px Kumush, weight 600. Plain text, no pill.
- **H1** per the type scale, Varaq. The lead is in Varaq; the second paragraph (desktop only, hidden on phones) in Kumush 16px.
- **CTA:** gold `CtaButton`, 56px, full width on phones, auto width from `md`.
- **Telegram note:** the Telegram icon (22px, `--color-telegram`) with "Telegram ichida ochiladi" (Varaq 14px, weight 600) over "Bir necha soniyada" (Kumush 14px).
- **The visual** (the one composed moment):
  - **Phones:** a 16:9 card, full container width, radius 18, showing the poster via `next/image` (`priority`, `sizes="(min-width:1024px) 480px, 100vw"`).
    - A 64px circular play button centered on it: Varaq fill at 92%, Siyoh play triangle.
    - The **whole card is a `CtaButton`** (variant `"visual"`) with `aria-label="Videoni Telegramda ko‘rish"`.
    - A "17:29" duration chip bottom-right: Siyoh-deep background, Varaq 13px tabular-nums, radius 8.
    - No arch on phones.
  - **≥1024px:** an **arch** container (width 100% up to 480px, aspect ratio 0.82, radius `240px 240px 24px 24px`, fill Zumrad, 1px Varaq border at 18% opacity).
    - In its upper third, `<HarakatWord word="iqra" />` at 150px height, right-aligned with 40px inset. This is the page's only gold-harakat moment.
    - In its lower half, the same 16:9 poster card (as above), overlapping the arch's bottom edge by 32px, with a `0 24px 48px rgba(0,0,0,.28)` shadow. **The only shadow on the page.**
    - **The 12+ badge:** a 128px circle in Varaq overlapping the arch's left edge at 40% height. "12+" in 40px weight 700 Siyoh, "yillik ta’lim tajribasi" in 14px Qalam, centered.
  - **Phones:** the 12+ badge becomes a 96px circle overlapping the poster card's top-left corner (36px font, label in 13px). That's the one place 13px is allowed besides the footer.

### 2. Lesson (Varaq)
- **H2** "Videodarsda nimalarni bilib olasiz?", then a 1-sentence intro in Qalam 16px, max 560px.
- **Phones:** 3 stacked cards, separated by hairlines, inside a white container with radius 18 and padding 24.
- **≥1024px:** 3 columns in one white container with radius 18 and vertical hairlines between columns, each 40px padding, min-height 320px.
- **Each card:** the Arabic numeral (Zumrad) top-right, H3, body in Qalam.
- **Below the cards,** left-aligned: a gold `CtaButton` "Bepul darsni ko‘rish".

### 3. Audience (Qumloq)
- **≥1024px:** two columns, 0.85fr / 1.15fr, 96px gap. **Phones:** stacked, 40px gap.
- **Left:** H2, then the intro paragraph in 17px Siyoh, then the lead-in "Videodars ayniqsa quyidagilar uchun foydali:" in 16px weight 600.
- **Right:** a ruled list (hairline on top and between rows, 1px Siyoh at 16%). Each row is min 64px: a 10px Zumrad rotated square, then the item in 17px weight 500.
- **Closing row, full width:** 1px Siyoh 18% border, radius 16, padding 24 (32 from `lg`), flex row from `md` (stacked on phones, 20px gap). The closing sentence in 18px weight 600, then a Siyoh `CtaButton` (variant `"ink"`).

### 4. Teacher (Varaq)
- **≥1024px:** two columns, 0.8fr / 1.2fr, 96px gap. The left column is `position: sticky; top: 32px`. **Phones:** stacked, left column not sticky.
- **Left:**
  - An **arch** (aspect ratio 0.85, radius `200px 200px 18px 18px`, Zumrad fill, max-width 380px). It holds `<HarakatWord word="hafsa" />` at 120px height, centered, letters in Varaq.
  - At the arch's bottom, an inner label bar (Siyoh-deep, radius 12, inset 16px): "IQRA Akademiyasi asoschisi" in Varaq 15px weight 600 on the left, "2014" in Kumush 15px on the right.
  - Below the arch: H2 "Hafsa ustoza" and the credential line in Qalam 16px.
- **Right:**
  - The lead paragraph in 20px / 1.55 Siyoh, weight 500, with 28px bottom padding and a hairline.
  - **Study path:** 4 rows separated by hairlines, 20px vertical padding.
    - **Phones:** the place in 16px weight 600 Zumrad, the detail in 15px Qalam below it.
    - **≥768px:** a 3-column grid of 150px / 1fr / auto: place, detail, and the **Arabic place name** in `font-arabic` 22px Zumrad, right-aligned. On phones the Arabic name sits right-aligned on the place's row.
  - The ijaza paragraph in 16px Qalam.
  - **The 2014 card:** Siyoh, radius 16, padding 28, a two-column grid of 96px / 1fr. "2014" in 40px weight 700 Oltin; the text in 16px Varaq with a left hairline in Varaq at 18% opacity. On phones it stacks with a top hairline.

### 5. Steps and final CTA (Siyoh)
- **H2** "Videoni qanday olasiz?" in Varaq.
- **Steps:** 3 steps in a row from `lg` (with a 64px hairline connector between steps); stacked on phones (with a 24px vertical hairline connector).
  - **Marker:** a 48px rotated square outlined 1.5px in Varaq at 40% opacity, holding the digit counter-rotated in Oltin, 20px weight 700. **Step 3's marker is filled Oltin with a Siyoh digit.**
  - Step title in 17px weight 600 Varaq; description in 15px Kumush.
- **Final card:** 56px top margin, Varaq ground, radius 20, padding 28 (44 from `lg`), flex row from `md`.
  - **Left:** "Birinchi qadamni bugun qo‘ying." in 32px weight 700 Siyoh (40px from `lg`), and the subline in 16px Qalam.
  - **Right:** a gold `CtaButton` with the Telegram icon (Siyoh) before its label.
- **Privacy line** below the card: 14px Kumush, left-aligned.

### 6. Footer (Siyoh-deep)
- 32px vertical padding. Flex row from `md`, stacked on phones.
- Brand (as in the header, 24px mark), the disclaimer in 13px Kumush, "© 2026 IQRA Akademiyasi" in 13px Kumush.
- Bottom padding on phones clears the sticky bar.

### Sticky bar
Unchanged behavior and style. Siyoh button on Varaq at 94% opacity, shown only after the hero CTA scrolls out of view, phones only.

## Metadata
Keep what's in `app/(site)/layout.tsx` (title, description, OG `/og.jpg`, `metadataBase` from `NEXT_PUBLIC_APP_URL`).

## Quality bar (report pass/fail for each, with values)

1. **No colors outside tokens.** `grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/components/landing apps/web/app/\(site\)/page.tsx` finds nothing. Use the token utilities. The single allowed shadow uses `rgba(0,0,0,.28)`.
2. **No italics, no ALL-CAPS text, no letter-spacing above 0** anywhere on the landing page.
3. **Minimum text size** 14px (13px only for the footer legal line and the phone badge label).
4. **Contrast:** every text/background pair is ≥4.5:1 (≥3:1 for 24px+). List each pair you used with its ratio.
5. **Only these fonts load:** Golos Text and Scheherazade New. No `@import` of Google Fonts.
6. **Semantics:** exactly one `h1`; one `h2` per section; card titles are `h3`. No `role="heading"`.
7. **Every interactive element is a `CtaButton`**, at least 44px tall, with visible focus: a 2px Oltin ring on ink, a 2px Siyoh ring on paper and cream.
8. **Layouts:** no horizontal scroll at 360, 390, 768, 1024 and 1280. On the phone first screen (390×844), the H1, the poster card and the hero CTA are visible without scrolling.
9. **Images:** the poster goes through `next/image` with `priority` and correct `sizes`. No external image hosts.
10. **Motion:** none, except the existing sticky-bar slide and hover color changes. `prefers-reduced-motion` is respected.
11. **Lighthouse mobile** on `next build && next start`: Performance ≥90, Accessibility ≥95, if Lighthouse can run in your environment; otherwise state "not run".
12. **Screenshots** at 390 (full page) and 1280 (full page), if a headless browser is available (`npx playwright install chromium` is fine; don't commit anything it generates). Attach them to the PR description or describe them if attaching isn't possible.

## Verification commands
```
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm --filter @funnel/web build
```
`pnpm test` needs no database for the web; the API integration tests are skipped without `TEST_DATABASE_URL`, which is fine.

## Report (PR description and final message)
1. Commits.
2. File-by-file summary.
3. Decisions you made for anything unspecified.
4. The quality bar table with values.
5. What you couldn't verify.
6. Anything in this spec you believe is wrong, stated but **not** acted on.
