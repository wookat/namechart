# NameChart Design-System Upgrade Regression Plan (cd04e930 / CACHE_VER 74 / ASSET_VER 13)

Target: https://namechart.zalize.com production. Code evidence: src/styles.css (Fraunces @font-face, :focus-visible, active scale, .hero-glow, .fade-up-2, .text-gradient, .nav-link, .stat-num, reduced-motion overrides), src/html.js (preload, ASSET_VER 13, nav-link classes, xl:max-w-6xl on header/main/footer), src/index.js (hero-glow div, text-gradient em, fade-up-2 subtitle, stats "why" lines L224-236).

## T1 Font: Fraunces self-hosted (desktop recording + shell)
- curl -I /fonts/fraunces-latin.woff2 → 200, content-type font/woff2, cache-control immutable. Home HTML contains `<link rel="preload" ... crossorigin>` and styles.css?v=13.
- In browser on /: `document.fonts.check('700 1em Fraunces')` === true and hero h1 computed font-family starts with "Fraunces"; h1 visibly serif (screenshot). No console errors.

## T2 Hero effects (recording)
- On /: "See it in one chart." renders as gradient text (indigo→purple→pink, not flat indigo). Hero background shows two soft pink/indigo glow blobs (top-left/bottom-right). Subtitle appears via staggered fade (fade-up-2). No layout breakage; glow does not intercept clicks (pointer-events none — click search input over hero works).

## T3 Component states (recording)
- Hover nav "Trending": underline animates in (scaleX 0→1) — screenshot mid-hover; nav link clickable area ≥44px tall (getBoundingClientRect().height ≥ 44 via console check, acceptable).
- Tab from address/hero: focused element shows 2px indigo outline (focus-visible), screenshot.
- Mouse-down (hold) on hero "Search" button: scale(.97) — capture while pressed (computed transform matrix ≈ 0.97).

## T4 /name/luna plain-language stat explanations (recording)
- Six stat cards each show a small grey explanation line under the value:
  - Total babies → "Every U.S. baby named Luna since {first_year}"
  - Peak year → "The single biggest year for Luna"
  - Rank in 2025 → per bestRank rule (prod data: #27 → expect "Popular but not everywhere"; NOTE brief said #12/"Very popular" — verify actual, report deviation)
  - First recorded → "First year Luna shows up in U.S. records"
  - 10-year trend → "On its way up — getting more common" (trend > +15%)
  - Gender split → unisex? Luna is ~all girls → "Share of all babies ever given this name" (or unisex text if flagged)
- /name/agnes: Rank explanation "Rare — a truly distinctive pick" (below top 1000). Values render escaped, no broken markup.

## T5 Wide screen 1440 (recording)
- Set window 1440px wide, visit / and /name/luna: header/main/footer content column widens (~1152px = max-w-6xl) and stays centered/aligned; no overlap or break.

## T6 Viewport sweep 375/768/1024/1440 (headless selenium)
- / and /name/luna at each width: document.documentElement.scrollWidth <= innerWidth (no horizontal overflow). Screenshots at 375 and 1440.

## T7 axe-core
- / and /name/luna: 0 serious/critical violations.

## T8 Reduced motion (headless, prefers-reduced-motion: reduce emulation)
- On /: computed animation-name of .hero-glow::before === 'none'; h1 .fade-up and subtitle .fade-up-2 animation 'none' with full opacity (visible); button:active transform none. Page content fully visible.

## T9 Console + smoke
- After the full desktop flow: browser console has zero errors. Font request in network = 200 (no FOIT: text visible immediately with swap — assert no invisible text at first paint screenshot).
