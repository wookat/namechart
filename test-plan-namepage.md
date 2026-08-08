# NameChart 名字页 Nameberry 基准打磨回归计划 (38aa617e / CACHE_VER 76 / ASSET_VER 15)

Target: https://namechart.zalize.com production. Code evidence: src/index.js L244-252 (fact chips), L265 (data attribution), L266-276 (On this page nav), L300-315 (Recent years #recent), section ids meaning/popularity/states/famous/similar/siblings/faq; src/styles.css (html scroll-behavior:smooth, reduced-motion auto, [id]{scroll-margin-top:4.5rem}).

## T1 /name/luna fact chips (recording)
- Below h1: chips row shows: Origin **Latin**; Meaning **"moon"** (link → /meaning/moon); Say it **/ˈluːnə/**; 2025 rank **#27 · Top 100** on solid indigo-600 bg with white text. Click Meaning chip → lands /meaning/moon.
- Attribution line under intro: "Data: official U.S. Social Security records, 1880–2025 · sources & methodology" with link → /about.

## T2 "On this page" TOC anchors (recording)
- Luna TOC shows: Meaning, Popularity, Recent years, By state, Famous, Similar names, Siblings, FAQ (all 8; Luna has all data).
- Click "Recent years" → viewport scrolls smoothly; "Recent years" heading fully visible BELOW the sticky header (not covered; scroll-margin 4.5rem). Click "FAQ" → FAQ heading visible below header. Click "Meaning" similarly.

## T3 Recent years table (recording)
- id=recent: 12 rows (2014–2025), columns Year / Girls rank / Births / "1 in N girls" (girls-only for Luna, no Boys column). Values: 2025 #27, 6,085 births, 1 in 265; 2024 #13 (per brief); 2023 #10, 7,862, 1 in 204. NOTE: brief said 2025 births 6,076 — prod HTML shows 6,085; report actual.

## T4 Conditional rendering (recording or curl+screenshot)
- /name/agnes: chips show Origin Ancient Greek + Say it, NO rank chip (below top 1000); TOC omits "Recent years" and "By state" (no data), includes Meaning/Popularity/Famous/Similar/…/FAQ; no #recent section.
- /name/theodore: rank chip "#4 · Top 100" (indigo bg), Recent years table has Boys rank column only.

## T5 375px overflow (headless mobile emulation)
- /name/luna: scrollWidth <= 375; chips wrap; Recent years table container overflow-x-auto works. Screenshot.

## T6 axe (headless)
- /name/luna: 0 serious/critical (watch color-contrast on new chips: indigo-600/white and indigo-50/indigo-700).

## T7 Reduced motion (headless --force-prefers-reduced-motion)
- Computed style html scroll-behavior === 'auto' (vs 'smooth' normally).

## T8 Console
- Zero console errors after the full Luna walkthrough.
