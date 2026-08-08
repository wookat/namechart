---
name: testing-namechart
description: How to run UI regression, 375px mobile, and axe-core accessibility tests against the NameChart production site (namechart.zalize.com)
---

# Testing NameChart (namechart.zalize.com)

- Pure production testing; no local server needed. Repo: /home/ubuntu/repos/namechart (Cloudflare Worker, `src/index.js` routes, `public/js/app.js` client JS, `src/html.js` layout/nav).
- Key features/state:
  - Favorites: localStorage `nc-favs` (array of {slug,name}); share link: localStorage `nc-share-link` ({id,token,url}). Share APIs: POST /api/share, POST /api/share/revoke. Short link route: /s/:id (8-char [a-z0-9]).
  - Matcher: GET /matcher?names=X&names=Y (up to 3 names, sanitized to a-z'-). Nav "Matcher" link is `hidden md:inline` (desktop only).
  - Onboarding (one-time hints, since d3ed575): nav Matcher "New" badge `#nc-new-dot` (localStorage `nc-seen-matcher`, marked seen on /matcher visit or nav click); name-page shortlist tip `#nc-tip` with close `#nc-tip-x` (localStorage `nc-tip-fav`, also set by clicking `#nc-fav`). Both SSR `hidden`, un-hidden by public/js/app.js — for "new user" tests clear ALL keys (nc-favs, nc-share-link, nc-seen-matcher, nc-tip-fav) first.
  - /search with an exact name match 301-redirects to /name/<slug> (src/index.js ~L441) — expected, not a bug.
- CSP is strict (`script-src 'self'; connect-src 'self'`), so you CANNOT inject axe-core from a CDN inside the live browser. Instead:
  - `npx @axe-core/cli <url> --chromedriver-path=...` for stateless pages.
  - For localStorage-dependent states (e.g. /favorites with share card), use a selenium-webdriver + @axe-core/webdriverjs Node script that seeds localStorage then reloads (see pattern in past sessions).
- ChromeDriver is NOT preinstalled; the installed browser is Chrome for Testing (check `google-chrome --version`) — download matching chromedriver from storage.googleapis.com/chrome-for-testing-public/<version>/linux64/chromedriver-linux64.zip.
- Desktop Chrome window can't shrink below ~500px CSS width; for 375px checks use headless Chrome with `setMobileEmulation({deviceMetrics:{width:375,height:812,pixelRatio:2}})` and assert `document.documentElement.scrollWidth <= innerWidth`.
- Red lines: never submit real emails to /api/subscribe; keep API traffic to normal UI-driven volume.
- Watch out: the browser profile may carry leftover `nc-favs` entries from earlier sessions — clear or remove extras before shortlist tests.
- Design system (since cd04e930): self-hosted Fraunces at /fonts/fraunces-latin.woff2 (preload + font-display:swap; assert `document.fonts.check('700 1em Fraunces')`); hero `.hero-glow` (pointer-events:none), `.text-gradient` em, `.fade-up-2` subtitle; `.nav-link` hover underline; global `:focus-visible` indigo outline; `button:active` scale(.97) (assert computed transform matrix(0.97,…) while mouse held). Containers are `max-w-5xl xl:max-w-6xl` → expect 1152px main width at ≥1280px viewports.
- Reduced-motion: use headless Chrome flag `--force-prefers-reduced-motion` and assert animationName === 'none' on `.hero-glow::before/::after`, `.fade-up*`, plus opacity 1 (content visible).
- Headless Chrome `--window-size` won't go below ~500px width; for true 375px always use setMobileEmulation (see above).
- Name-page anatomy (since 38aa617e): fact chip row under h1 (Origin / Meaning "word" linking /meaning/<word> / Say it IPA / `${END_YEAR} rank #N` — indigo-600 white if rank ≤100 "· Top 100", light indigo if 101–1000 "· Top 1000", omitted below 1000); attribution line linking /about; `nav[aria-label="On this page"]` TOC with conditional anchors (#meaning/#popularity/#recent/#states/#famous/#similar/#siblings/#faq); `#recent` = last-12-years table (gender columns only where data exists). CSS: `html{scroll-behavior:smooth}` (auto under reduced motion), `[id]{scroll-margin-top:4.5rem}` — assert anchor landing via headerBottom < sectionTop after clicking a TOC link.
- Cache gotcha: after a deploy the desktop browser's disk cache may still show the OLD page even though edge cache was busted (CACHE_VER) — always Ctrl+Shift+R on each page before asserting new features.
- The desktop VNC screen is 1600x1200 real pixels (tool space 1024x768) — a maximized browser gives a 1600px CSS viewport, enough to demonstrate xl: wide layouts on recording.
