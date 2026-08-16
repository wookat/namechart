// Shared layout + components. All server-rendered, no client framework.

export const SITE = 'NameChart';
export const ORIGIN = 'https://namechart.zalize.com';
export const START_YEAR = 1880;
export const ASSET_VER = 23; // bump when styles.css or app.js change, to bust the long asset cache
export const END_YEAR = 2025;

export const SISTER_SITES = [
  ['AstroSage', 'https://astrosage.zalize.com', 'Zi Wei Dou Shu astrology readings'],
  ['SubSleuth', 'https://subsleuth.zalize.com', 'Find & cancel unused subscriptions'],
  ['HonestCV', 'https://cv.zalize.com', 'Honest resume feedback'],
  ['WatchDeck', 'https://watchdeck.zalize.com', 'Track your TV shows'],
  ['MealLoop', 'https://mealloop.zalize.com', 'Weekly meal planning'],
  ['Shelfmark', 'https://shelfmark.zalize.com', 'Book series reading order'],
];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const fmt = n => Number(n ?? 0).toLocaleString('en-US');
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

export function layout({ title, desc, path, body, jsonld, noindex, ogImage }) {
  const canonical = ORIGIN + path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage || ORIGIN + '/img/og-default.png')}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css?v=${ASSET_VER}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body class="min-h-screen bg-[#faf8f5] text-slate-800 antialiased flex flex-col">
<header class="bg-white border-b border-slate-200 sticky top-0 z-20">
  <div class="max-w-5xl xl:max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
    <a href="/" class="flex items-center gap-2 font-bold text-lg text-indigo-700 shrink-0">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4f46e5"/><stop offset="0.7" stop-color="#7c3aed"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#lg)"/><path d="M4 18 9 8l4 5 4-9 3 14" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
      NameChart <span class="hidden sm:inline align-middle ml-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">Beta</span>
    </a>
    <form action="/search" method="get" class="flex-1 max-w-xs hidden sm:block" role="search">
      <input name="q" placeholder="Search any name…" autocomplete="off"
        class="w-full rounded-full border border-slate-300 bg-slate-50 px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
    </form>
    <nav aria-label="Primary" class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-medium text-slate-600">
      <a class="nav-link hover:text-indigo-700" href="/top/girls">Girls</a>
      <a class="nav-link hover:text-indigo-700" href="/top/boys">Boys</a>
      <a class="nav-link hover:text-indigo-700" href="/trending">Trending</a>
      <a class="nav-link hover:text-indigo-700 hidden sm:inline" href="/generator">Generator</a>
      <a class="nav-link hover:text-indigo-700 hidden md:inline" href="/matcher" id="nc-nav-matcher">Matcher<span id="nc-new-dot" hidden class="ml-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">New</span></a>
      <a class="nav-link hover:text-indigo-700" href="/browse">Browse</a>
      <a class="nav-link hover:text-indigo-700 hidden md:inline" href="/compare">Compare</a>
      <a class="nav-link hover:text-indigo-700 hidden sm:inline" href="/pricing">Pricing</a>
      <details class="relative md:hidden">
        <summary class="nav-link list-none cursor-pointer hover:text-indigo-700 select-none" aria-label="More pages">More ▾</summary>
        <div class="absolute right-0 mt-2 w-44 max-w-[calc(100vw-1.5rem)] rounded-xl bg-white border border-slate-200 shadow-lg py-2 text-sm z-30">
          <a class="block px-4 py-2.5 hover:bg-indigo-50 sm:hidden" href="/generator">Generator</a>
          <a class="block px-4 py-2.5 hover:bg-indigo-50" href="/matcher">Sibling matcher</a>
          <a class="block px-4 py-2.5 hover:bg-indigo-50" href="/compare">Compare names</a>
          <a class="block px-4 py-2.5 hover:bg-indigo-50" href="/favorites">My shortlist ♡</a>
          <a class="block px-4 py-2.5 hover:bg-indigo-50 sm:hidden" href="/pricing">Pricing</a>
        </div>
      </details>
    </nav>
  </div>
  <form action="/search" method="get" class="sm:hidden px-4 pb-3" role="search">
    <input name="q" placeholder="Search any name…" autocomplete="off"
      class="w-full rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
  </form>
</header>
<main class="flex-1 w-full max-w-5xl xl:max-w-6xl mx-auto px-4 py-6">${body}</main>
<footer class="bg-white border-t border-slate-200 mt-10">
  <div class="max-w-5xl xl:max-w-6xl mx-auto px-4 py-8 grid gap-8 sm:grid-cols-3 text-sm">
    <div>
      <p class="font-bold text-indigo-700 mb-2">NameChart</p>
      <p class="text-slate-600">146 years of baby name popularity. All features free during Beta. Data: U.S. Social Security Administration (public domain), 1880–2025.</p>
    </div>
    <div>
      <p class="font-semibold mb-2">Explore</p>
      <ul class="space-y-1 text-slate-600">
        <li><a class="hover:text-indigo-700" href="/top/girls">Top girl names</a></li>
        <li><a class="hover:text-indigo-700" href="/top/boys">Top boy names</a></li>
        <li><a class="hover:text-indigo-700" href="/unisex">Unisex names</a></li>
        <li><a class="hover:text-indigo-700" href="/trending">Rising &amp; falling</a></li>
        <li><a class="hover:text-indigo-700" href="/browse">Browse A–Z, years, decades, states</a></li>
        <li><a class="hover:text-indigo-700" href="/compare">Compare two names</a></li>
        <li><a class="hover:text-indigo-700" href="/international">International top 100s</a></li>
        <li><a class="hover:text-indigo-700" href="/favorites">My shortlist</a></li>
        <li><a class="hover:text-indigo-700" href="/pricing">Pricing</a></li>
        <li><a class="hover:text-indigo-700" href="/about">About &amp; data sources</a></li>
        <li><a class="hover:text-indigo-700" href="/press">Press &amp; brand</a></li>
        <li><a class="hover:text-indigo-700" href="/privacy">Privacy</a></li>
        <li><a class="hover:text-indigo-700" href="/terms">Terms</a></li>
      </ul>
    </div>
    <div>
      <p class="font-semibold mb-2">More from Zalize</p>
      <ul class="space-y-1 text-slate-600">
        ${SISTER_SITES.map(([n, u, d]) => `<li><a class="hover:text-indigo-700" href="${u}" title="${esc(d)}">${n}</a> <span class="text-slate-600">— ${esc(d)}</span></li>`).join('')}
      </ul>
    </div>
  </div>
  <div class="border-t border-slate-100 py-4 px-4 text-center text-xs text-slate-600 space-y-1">
    <p>© ${new Date().getFullYear()} NameChart · A Zalize project · hello@zalize.com</p>
    <p>NameChart is not affiliated with, endorsed by, or sponsored by the U.S. Social Security Administration or any government agency.</p>
  </div>
</footer>
<script src="/js/app.js?v=${ASSET_VER}" defer></script>
</body>
</html>`;
}

// series: {s:startYear, f:[offset,[counts...]], m:[offset,[counts...]]}
export function expandSeries(series) {
  const n = END_YEAR - series.s + 1;
  const out = { f: new Array(n).fill(0), m: new Array(n).fill(0) };
  for (const sex of ['f', 'm']) {
    const [off, arr] = series[sex];
    arr.forEach((v, i) => { out[sex][off + i] = v; });
  }
  return out;
}

export function chartSVG(series, { width = 800, height = 280 } = {}) {
  const { f, m } = expandSeries(series);
  const n = f.length;
  const max = Math.max(1, ...f, ...m);
  const padL = 44, padR = 12, padT = 12, padB = 26;
  const iw = width - padL - padR, ih = height - padT - padB;
  const x = i => padL + (i / (n - 1)) * iw;
  const y = v => padT + ih - (v / max) * ih;
  const line = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const hasF = f.some(v => v > 0), hasM = m.some(v => v > 0);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(max * t));
  const xTicks = [];
  for (let yr = Math.ceil(START_YEAR / 20) * 20; yr <= END_YEAR; yr += 20) xTicks.push(yr);
  return `<svg viewBox="0 0 ${width} ${height}" class="w-full h-auto chart-draw" role="img" aria-label="Births per year chart">
  ${yTicks.map(v => `<g><line x1="${padL}" x2="${width - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0" stroke-width="1"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${v >= 1000 ? (v / 1000) + 'k' : v}</text></g>`).join('')}
  ${xTicks.map(yr => `<text x="${x(yr - START_YEAR)}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#94a3b8">${yr}</text>`).join('')}
  ${hasF ? `<path d="${line(f)}" fill="none" stroke="#db2777" stroke-width="2"/>` : ''}
  ${hasM ? `<path d="${line(m)}" fill="none" stroke="#2563eb" stroke-width="2"/>` : ''}
  ${hasF ? `<g><rect x="${padL}" y="${padT}" width="10" height="3" fill="#db2777"/><text x="${padL + 14}" y="${padT + 5}" font-size="11" fill="#475569">Girls</text></g>` : ''}
  ${hasM ? `<g><rect x="${padL + 60}" y="${padT}" width="10" height="3" fill="#2563eb"/><text x="${padL + 74}" y="${padT + 5}" font-size="11" fill="#475569">Boys</text></g>` : ''}
  ${(() => {
    // Static end-point anchors: dot + latest-year value for each visible line (labels dodge each other).
    const ends = [[f, '#db2777', hasF, 'girls'], [m, '#2563eb', hasM, 'boys']].filter(([arr, , has]) => has && arr[n - 1] > 0);
    const close = ends.length === 2 && Math.abs(y(ends[0][0][n - 1]) - y(ends[1][0][n - 1])) < 16;
    return ends.map(([arr, color, , label], i) => {
      const v = arr[n - 1], px = x(n - 1), py = y(v);
      const ty = close && i === 1 ? py + 16 : py - 8;
      return `<g><circle cx="${px}" cy="${py}" r="4" fill="${color}" stroke="#fff" stroke-width="1.5"/><text x="${px - 8}" y="${ty}" text-anchor="end" font-size="11" font-weight="600" fill="${color}" stroke="#fff" stroke-width="3" paint-order="stroke">${END_YEAR}: ${v.toLocaleString('en-US')} ${label}</text></g>`;
    }).join('');
  })()}
  <line id="nc-cursor" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" stroke="#6366f1" stroke-width="1" stroke-dasharray="3 3" style="display:none"/>
  <circle id="nc-dot-f" r="3.5" fill="#db2777" stroke="#fff" stroke-width="1.5" style="display:none"/>
  <circle id="nc-dot-m" r="3.5" fill="#2563eb" stroke="#fff" stroke-width="1.5" style="display:none"/>
  <g id="nc-chart-tip" style="display:none"><rect rx="6" fill="#1e293b" opacity="0.92"/><text font-size="11" fill="#fff"></text></g>
  <rect id="nc-hit" x="${padL}" y="${padT}" width="${iw}" height="${ih}" fill="transparent"/>
</svg>`;
}

// Hover/touch readout for the name chart. Values are rendered server-side into a data attribute.
export function chartReadout(series) {
  const { f, m } = expandSeries(series);
  const max = Math.max(1, ...f, ...m);
  const data = JSON.stringify({ s: series.s, f, m, max, padT: 12, ih: 280 - 12 - 26, la: 'girls', lb: 'boys' });
  return `<div id="nc-readout" class="mt-2 text-sm text-slate-600 tabular-nums" data-series='${esc(data)}'>Hover or tap the chart to read any year.</div>`;
}

export function emailForm() {
  return `<section class="mt-10 rounded-2xl bg-indigo-600 text-white p-6 sm:p-8">
  <h2 class="text-xl font-bold">Get new name insights first</h2>
  <p class="mt-1 text-indigo-100 text-sm">Occasional updates when we add new data &amp; tools. No spam, unsubscribe anytime by replying to any email or writing to hello@zalize.com.</p>
  <form action="/api/subscribe" method="post" class="mt-4 flex flex-col sm:flex-row gap-2 max-w-md">
    <input type="email" name="email" required placeholder="you@example.com"
      class="flex-1 rounded-full px-4 py-2 text-slate-800 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-white">
    <button class="rounded-full bg-white text-indigo-700 font-semibold px-5 py-2 text-sm hover:bg-indigo-50">Notify me</button>
  </form>
  <p class="mt-3 text-xs text-indigo-100">By subscribing you agree to our <a class="underline" href="/privacy">privacy policy</a>. We store only your email address and the date you signed up.</p>
</section>`;
}

// Shared gender classification: unisex only when the minority gender is >= 20% of all-time births.
export function genderOf(r) {
  const total = r.total || (r.f_total + r.m_total);
  if (r.f_total > 0 && r.m_total > 0 && Math.min(r.f_total, r.m_total) / total >= 0.2) return 'unisex';
  return r.f_total >= r.m_total ? 'girl' : 'boy';
}

export function nameCard(r) {
  const g = genderOf(r);
  const sexBadge = g === 'unisex'
    ? '<span class="text-xs rounded-full bg-purple-100 text-purple-700 px-2 py-0.5">unisex</span>'
    : g === 'girl'
      ? '<span class="text-xs rounded-full bg-pink-100 text-pink-700 px-2 py-0.5">girl</span>'
      : '<span class="text-xs rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">boy</span>';
  const hook = r.peak_year
    ? `<p class="text-xs mt-1 ${r.peak_year >= END_YEAR - 5 ? 'text-emerald-700' : 'text-slate-600'}">${r.peak_year >= END_YEAR - 5 ? '↗ At its peak right now' : r.peak_year >= END_YEAR - 30 ? `Modern favorite · peaked ${r.peak_year}` : r.peak_year <= END_YEAR - 70 ? `Vintage classic · peaked ${r.peak_year}` : `Mid-century pick · peaked ${r.peak_year}`}</p>`
    : '';
  return `<div class="relative">
    <a href="/name/${r.slug}" class="card-lift block rounded-xl bg-white border border-slate-200 p-4 hover:border-indigo-300">
      <div class="flex items-center justify-between gap-2"><span class="font-semibold">${esc(r.name)}</span>${sexBadge}</div>
      <p class="text-xs text-slate-600 mt-1">${fmt(r.total)} babies since ${r.first_year}</p>${hook}
    </a>
    <button type="button" class="nc-card-fav absolute -top-2 -right-2 w-8 h-8 grid place-items-center rounded-full bg-white border border-slate-200 text-rose-600 shadow-sm hover:border-rose-300" data-slug="${r.slug}" data-name="${esc(r.name)}" aria-label="Save ${esc(r.name)} to shortlist" hidden>♡</button>
  </div>`;
}

export function rankTable(rows, { showCount = true, columns = false } = {}) {
  return `<ol class="${columns ? 'md:columns-2 xl:columns-3 md:gap-8' : 'divide-y divide-slate-100'}">
    ${rows.map(r => `<li class="${columns ? 'break-inside-avoid border-b border-slate-100' : ''}"><a href="/name/${r.name.toLowerCase()}" class="flex items-center gap-4 px-2 py-2.5 hover:bg-indigo-50 rounded-lg">
      <span class="w-8 text-right text-sm text-slate-600 tabular-nums">${r.rank}</span>
      <span class="font-medium flex-1">${esc(r.name)}</span>
      ${showCount ? `<span class="text-sm text-slate-600 tabular-nums">${fmt(r.count)}</span>` : ''}
    </a></li>`).join('')}
  </ol>`;
}
