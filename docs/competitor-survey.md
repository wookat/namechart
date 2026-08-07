# Multi-Competitor Survey (Round 102, 2026-08-06)

Scope: 10 competitors, real-browser deep visits on a representative name page (Luna) plus tooling pages. Tech observed from public network/DOM behavior only; anti-bot walls respected (no bypass).

## Access matrix

| Site | Access | Tech (observed) | Notes |
|---|---|---|---|
| nameberry.com | OK | Next.js (next/static) + Astro islands; DM Sans body 20px, DM Serif Display 100px H1 | Richest editorial layer |
| thebump.com | 403 curl / OK browser | Mulish, 14px body, 900-weight 42px H1; React app | Registry-driven CTAs |
| behindthename.com | OK | Server HTML, Optima stack, lilac bg; minimal JS | Scholarly sourcing |
| momjunction.com | OK | WordPress + Astro; huge single-page article (~400KB) | Widest section inventory |
| names.org | 403 curl; JS-only shell in browser | — | Skipped (no content w/o interaction) |
| thinkbabynames.com | Cloudflare challenge | — | Respected, skipped |
| forebears.io | Cloudflare challenge (Vue behind) | — | International data direction noted |
| babynames.com | Blocked/redirect loop | — | Skipped |
| namerology.com | Robot challenge | — | Grapher tool inspiration only |
| nymbler.com | DNS dead | — | Defunct |

## Feature inventory (union of sections seen on name pages)

- Nameberry: About / Popularity & trends / **World rankings** / Similar names / Name on lists / Famous bearers / **Pop culture** / **Variations & nicknames** / Blog links / Community / Save.
- The Bump: **Common nicknames** / Popularity + **The Bump Ranking** / U.S. Births / **Yearly ranking change** / Similar names / "Parents also like" / Lists containing name / Sibling ideas / **Names with same meaning** / Search by facets.
- Behind the Name: Meaning & History (sourced) / Related names tree / Popularity / User ratings / **Name days** / **Sources & references** / Categories.
- MomJunction: Origin & history / **Pronunciation** / Notable people / US chart + rank over time / **Across the world** / State popularity / Fiction mentions / Similar sound / Sibling names / Same meaning / **Rhyming names** / Songs / Nicknames / Zodiac.

## Our coverage vs union

Already have: charts, ranks, milestones table, 1-in-N, similar names, spelling variants, compare, sibling ideas, famous people, meanings/origins, state ranks, lists, generator, shortlist, OG cards, structured data.

## Gap list (prioritized)

- P1-a: **Year-over-year rank change** on name page hero (The Bump) — DONE Round 103.
- P1-b: **"Names with the same meaning"** section on name pages (The Bump/MomJunction) — DONE Round 103.
- P1-c: **Design/typography uplift** (Nameberry) — DONE Round 104 (display-serif H1s, system stack, CSP-safe).
- P1-d: **Related-lists chips** on name pages (Nameberry "name on lists") — DONE Round 111.
- P2-a: Nicknames & diminutives — evaluated Round 110: only ~104 defensible Wiktionary relations; too thin, deferred pending a better public source.
- P2-b: Pronunciation (respell/IPA) — expanded Round 106: IPA coverage now 2,023 names (top-20k sweep).
- P2-c: Rhyming names — computable by ending; low value, later.
- P2-d: International rankings (forebears/Nameberry world) — needs non-US official sources; unchanged backlog.
- Skip: name days (no defensible source), zodiac/acrostic/QR (gimmick), community ratings (no-account positioning).

## Tech-stack assessment (Round 103 conclusion)

Competitors run Next.js/Astro/WordPress on heavier stacks with 180–400KB HTML. Our Workers+Hono+D1 SSR delivers 3–78KB HTML and 78–220ms TTFB — already best-in-class for this content type on the Cloudflare constraint. No framework migration warranted; adopt targeted design/typography improvements instead.
