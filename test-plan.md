# NameChart Production Regression Test Plan (d60dc217)

Target: https://namechart.zalize.com (production, no local server). Record full session with annotations. Produce test-report.md.
Red lines: no real email to /api/subscribe, no API hammering.

Code evidence: src/index.js L908-952 (/matcher), L955-985 (/s/:id + og), public/js/app.js L68-99 (share UI, localStorage nc-favs / nc-share-link), src/html.js L63 (nav Matcher, hidden md:inline), src/index.js L1046 (/browse matcher entry).

## T1 Matcher empty state
- Open /matcher via main nav "Matcher" link from homepage (desktop, maximized).
- Pass: H1 "Sibling & Middle Name Matcher"; 3 inputs (Name 1 required, Name 2/3 "(optional)"); 3 explainer cards: "Same era", "Same popularity tier", "Distinct sounds"; no results section.

## T2 Matcher single name (Luna)
- Type "Luna" in Name 1, click "Find matches".
- Pass: URL /matcher?names=Luna...; heading "Sibling names for Luna"; Sisters & Brothers card grids present; no card starts with L or ends "na"; "Middle names for Luna" pills like "Luna Grace"; explainer cards gone.
- Click one sibling card → lands on /name/<slug> with chart.

## T3 Matcher two names (Luna + Leo)
- Back to /matcher, enter Luna + Leo, submit.
- Pass: heading "Sibling names for Luna & Leo"; middle names section is "Middle names for Luna" (first name only).

## T4 Matcher unknown name
- Enter "Zzzqqqx" in Name 1, submit.
- Pass: rose text "Not in the data: zzzqqqx — check the spelling or try another name."; no sibling section.

## T5 Share flow end-to-end
- Visit /name/luna → click "♡ Save to shortlist"; repeat for /name/leo and /name/ivy.
- /favorites: 3 cards shown + "Share this list →" button (id nc-share-make).
- Click Share → indigo card appears with URL https://namechart.zalize.com/s/[a-z0-9]{8}, "Copy link" and "Delete link" buttons.
- Click "Copy link" → button text becomes "✓ Copied".
- Open the /s/xxxxxxxx URL in a new tab → 200 SSR page: H1 "A shared baby name shortlist", "3 names someone picked out...", cards Luna/Leo/Ivy.
- Back on /favorites click "Delete link" → share card replaced by "Share this list →" button.
- Reload the /s/xxxxxxxx tab → 404 "That page doesn't exist."

## T6 Mobile 375px overflow
- Set viewport 375px wide (device emulation). Check /matcher (with results), /favorites (with share card, before delete), /s/xxxxxxxx.
- Pass: document.documentElement.scrollWidth <= 375 (no horizontal overflow) on each, verified via console + visual screenshot.

## T7 axe-core
- Inject axe from CDN on /matcher (results state), /favorites (share card state), /s/xxxxxxxx.
- Pass: 0 violations with impact serious or critical on each page.

## T8 Nav & browse entries
- Desktop: nav "Matcher" link visible and navigates (covered in T1). /browse: button "Sibling & middle name matcher →" present and navigates to /matcher.

## T9 Smoke (Regression)
- Visit /, /name/luna, /top/girls, /generator, /pricing. Pass: each renders main content, no console errors on any page (check browser console log).
