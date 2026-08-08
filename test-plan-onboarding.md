# NameChart Onboarding Regression Plan (fe0a96a4 / d3ed575)

Target: https://namechart.zalize.com production. New-user perspective: clear localStorage (nc-favs, nc-share-link, nc-seen-matcher, nc-tip-fav) before recording. Record with annotations; update test-report.md.
Code evidence: src/index.js (homepage 3-step strip + tool cards L124+; search empty CTA L455; generator example pills L910; matcher "See it in action" L962), src/html.js L63 (#nc-new-dot in nav), public/js/app.js (seen/markSeen, #nc-tip logic).

## T1 Homepage new-user blocks
- Fresh state, open /. Pass: below hero stats, white card with 3 numbered steps (1 Search a name / 2 Read its 146-year story / 3 Shortlist & match, steps 1&3 contain links); below it 2 tool cards "Baby Name Generator" and "Sibling & Middle Name Matcher" with rose "New" badge on Matcher card. Nav "Matcher" shows rose "New" dot (fresh state only).

## T2 Nav New badge one-time
- From /, click nav "Matcher" → lands /matcher; navigate to any page (e.g. /) → nav "Matcher" no longer shows "New" dot. (localStorage nc-seen-matcher=1.)

## T3 Matcher empty-state examples
- /matcher fresh: "See it in action:" with 3 pills: "Try Luna & Leo", "Try Olivia", "Try Theodore & Eleanor". Click "Try Luna & Leo" → /matcher?names=luna&names=leo with "Sibling names for Luna & Leo" results. Pills absent in results state.

## T4 Name-page shortlist tip one-time
- Fresh nc-tip-fav: open /name/luna → pink tip bar "Tip: tap ♡ Save to shortlist…" visible below action buttons with × button.
- Click "♡ Save to shortlist" → tip disappears immediately; reload /name/luna and open /name/leo → tip does NOT reappear.
- (Also verify × path once via second fresh state or clearing key: click × hides tip; reload → still hidden.) 

## T5 Search & generator empty-state CTAs
- /search?q=zzzqqq → "No names found…" plus buttons "Get ideas from the generator →" (→ /generator) and "Browse by letter, year or state" (→ /browse). Click generator CTA.
- /generator (no params) → "Not sure where to start? Try one of these:" with 4 pills; click "Vintage girl names" → /generator?sex=girl&style=vintage shows result grid.

## T6 375px overflow
- Headless mobile emulation 375x812: / (new blocks) and /name/luna with tip visible (clear nc-tip-fav in that session). Pass: scrollWidth <= 375; screenshots saved.

## T7 axe-core
- / and /name/luna (tip visible state via seeded session). Pass: 0 serious/critical violations.

## T8 Restraint & no-JS
- No modals/popups appear anywhere during flow (visual). SSR HTML has `hidden` on #nc-tip and #nc-new-dot (curl check — no-JS users never see them). Blocks static, no animation dependency.

## T9 Smoke (Regression)
- /search?q=luna renders result cards; browser console shows no errors after the whole flow.
