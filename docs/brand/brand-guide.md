# NameChart Brand Guide

Effective 2026-08 · Owner: Zalize · Applies to site copy, OG cards, marketing assets, and emails.

## 1. Story & positioning

**One-liner (for parents):** Every name tells a story — NameChart shows it in one chart.

**Positioning statement:** NameChart is the data-first baby name explorer for expectant parents. Where other name sites lead with opinion and ads, NameChart leads with 146 years of official U.S. birth records — every one of 105,000+ names gets a full popularity chart, meaning, famous namesakes, state map, and sibling/middle-name matching. No ads, no account, no paywall during Beta.

**Story:** Choosing a name is one of the first lasting decisions parents make. Most name sites bury the facts under listicles and ad walls. NameChart started from a simple idea: the story of a name *is* its data — when it rose, where it peaked, where it's loved today. We put that story on one page, free of clutter, so parents can decide with confidence and delight.

**Audience:** expectant parents (primary), name enthusiasts / writers / genealogists (secondary).

**Brand personality:** warm, trustworthy, quietly delightful. A knowledgeable friend with a spreadsheet — never a lecture, never a hard sell.

## 2. Naming & copy conventions

- Product name: **NameChart** — one word, camel case N and C. Never "Name Chart", "namechart" (except in URLs), "NameCharts".
- Operator attribution: "A Zalize project" (footer), contact `hello@zalize.com`.
- Feature names (title case, stable):
  - **Baby Name Generator** (`/generator`)
  - **Sibling & Middle Name Matcher**, short form "Matcher" (`/matcher`)
  - **My Shortlist** (`/favorites`); the saved list is a "shortlist", never "wishlist"/"favorites list" in copy
  - **Name of the day** (home)
  - Share links are "shared shortlists" (`/s/…`)
- Pricing wording: the product is **in Beta — free trial**. Never describe the product as simply "free"; always "free Beta" / "open during the Beta trial". Plans: Basic $0 / Plus $4 / Pro $9 (planned, not billed yet).
- Data claims style: always attributable ("146 years of official U.S. birth records", "105,954 names", "SSA data through 2025"). Never invent or round claims beyond the data.

### Tone of voice
- Warm and plain-spoken; second person ("your shortlist").
- Data-confident, not boastful: show numbers, don't shout adjectives.
- Playful in small doses (Name of the day, ♡), never gimmicky.
- No fear-based or judgmental copy about name choices — every name is someone's favorite.

### Banned / avoided words
- "free forever", "100% free" (Beta wording instead) · "best name" as an absolute · "guarantee" · "scientific" (we're statistical, not scientific) · exclamation-mark pileups · dark-pattern urgency ("only today!").

## 3. Visual identity

- **Logo:** rounded-square gradient mark (indigo #4f46e5 → violet #7c3aed → pink #db2777) with white chart-line glyph; wordmark "NameChart" in bold indigo-700. Source: `public/img/favicon.svg` (mark), header SVG in `src/html.js`. Don't recolor, stretch, or place the mark on low-contrast backgrounds.
- **Palette:** background warm white `#faf8f5`; ink slate-800; primary indigo-600 (interactive), secondary rose (affection/♡, girl accents), blue-700 (boy accents), amber (comparisons); text-secondary slate-600 minimum on warm backgrounds (contrast rule — never slate-500 on `#faf8f5`).
- **Typography:** display serif stack (`Iowan Old Style / Palatino / Georgia`) for h1/stat numbers via `font-display`; system sans for everything else. Serif italic for emotional emphasis.
- **Components:** pill buttons (rounded-full), rounded-2xl cards, chip/pill links for name lists, `card-lift` hover. Motion is CSS-only and restrained; everything degrades under `prefers-reduced-motion`.
- **OG cards:** gradient `linear-gradient(135deg,#312e81,#4f46e5 45%,#7c3aed 78%,#a21caf)`, name pills, footer "namechart.zalize.com · free during Beta". Generated per-page by `src/og.js`.
- Research provenance: `docs/visual-research.md`.

## 4. Boilerplate (for press/directories)

Short: "NameChart charts 146 years of official U.S. baby name data — popularity curves, meanings, famous namesakes and sibling-name matching for 105,000+ names. No ads, no account; free during Beta."

Long: see `docs/marketing/press-kit.md`.
