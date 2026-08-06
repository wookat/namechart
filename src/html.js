// Shared layout + components. All server-rendered, no client framework.

export const SITE = 'NameChart';
export const ORIGIN = 'https://namechart.zalize.com';
export const START_YEAR = 1880;
export const ASSET_VER = 5; // bump when styles.css or app.js change, to bust the long asset cache
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
<link rel="stylesheet" href="/styles.css?v=${ASSET_VER}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body class="min-h-screen bg-slate-50 text-slate-800 antialiased flex flex-col">
<header class="bg-white border-b border-slate-200 sticky top-0 z-20">
  <div class="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
    <a href="/" class="flex items-center gap-2 font-bold text-lg text-indigo-700 shrink-0">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 20 9 9l4 6 5-11 3 16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      NameChart
    </a>
    <form action="/search" method="get" class="flex-1 max-w-xs hidden sm:block" role="search">
      <input name="q" placeholder="Search any name…" autocomplete="off"
        class="w-full rounded-full border border-slate-300 bg-slate-50 px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
    </form>
    <nav aria-label="Primary" class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-medium text-slate-600">
      <a class="hover:text-indigo-700" href="/top/girls">Girls</a>
      <a class="hover:text-indigo-700" href="/top/boys">Boys</a>
      <a class="hover:text-indigo-700" href="/trending">Trending</a>
      <a class="hover:text-indigo-700" href="/browse">Browse</a>
    </nav>
  </div>
  <form action="/search" method="get" class="sm:hidden px-4 pb-3" role="search">
    <input name="q" placeholder="Search any name…" autocomplete="off"
      class="w-full rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
  </form>
</header>
<main class="flex-1 w-full max-w-5xl mx-auto px-4 py-6">${body}</main>
<footer class="bg-white border-t border-slate-200 mt-10">
  <div class="max-w-5xl mx-auto px-4 py-8 grid gap-8 sm:grid-cols-3 text-sm">
    <div>
      <p class="font-bold text-indigo-700 mb-2">NameChart</p>
      <p class="text-slate-500">146 years of baby name popularity, free forever. Data: U.S. Social Security Administration (public domain), 1880–2025.</p>
    </div>
    <div>
      <p class="font-semibold mb-2">Explore</p>
      <ul class="space-y-1 text-slate-500">
        <li><a class="hover:text-indigo-700" href="/top/girls">Top girl names</a></li>
        <li><a class="hover:text-indigo-700" href="/top/boys">Top boy names</a></li>
        <li><a class="hover:text-indigo-700" href="/unisex">Unisex names</a></li>
        <li><a class="hover:text-indigo-700" href="/trending">Rising &amp; falling</a></li>
        <li><a class="hover:text-indigo-700" href="/browse">Browse A–Z, years, decades, states</a></li>
        <li><a class="hover:text-indigo-700" href="/favorites">My shortlist</a></li>
        <li><a class="hover:text-indigo-700" href="/about">About &amp; data sources</a></li>
        <li><a class="hover:text-indigo-700" href="/privacy">Privacy</a></li>
        <li><a class="hover:text-indigo-700" href="/terms">Terms</a></li>
      </ul>
    </div>
    <div>
      <p class="font-semibold mb-2">More from Zalize</p>
      <ul class="space-y-1 text-slate-500">
        ${SISTER_SITES.map(([n, u, d]) => `<li><a class="hover:text-indigo-700" href="${u}" title="${esc(d)}">${n}</a> <span class="text-slate-500">— ${esc(d)}</span></li>`).join('')}
      </ul>
    </div>
  </div>
  <div class="border-t border-slate-100 py-4 px-4 text-center text-xs text-slate-500 space-y-1">
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
  return `<svg viewBox="0 0 ${width} ${height}" class="w-full h-auto" role="img" aria-label="Births per year chart">
  ${yTicks.map(v => `<g><line x1="${padL}" x2="${width - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0" stroke-width="1"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${v >= 1000 ? (v / 1000) + 'k' : v}</text></g>`).join('')}
  ${xTicks.map(yr => `<text x="${x(yr - START_YEAR)}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#94a3b8">${yr}</text>`).join('')}
  ${hasF ? `<path d="${line(f)}" fill="none" stroke="#db2777" stroke-width="2"/>` : ''}
  ${hasM ? `<path d="${line(m)}" fill="none" stroke="#2563eb" stroke-width="2"/>` : ''}
  ${hasF ? `<g><rect x="${padL}" y="${padT}" width="10" height="3" fill="#db2777"/><text x="${padL + 14}" y="${padT + 5}" font-size="11" fill="#475569">Girls</text></g>` : ''}
  ${hasM ? `<g><rect x="${padL + 60}" y="${padT}" width="10" height="3" fill="#2563eb"/><text x="${padL + 74}" y="${padT + 5}" font-size="11" fill="#475569">Boys</text></g>` : ''}
  <line id="nc-cursor" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" stroke="#6366f1" stroke-width="1" stroke-dasharray="3 3" style="display:none"/>
  <rect id="nc-hit" x="${padL}" y="${padT}" width="${iw}" height="${ih}" fill="transparent"/>
</svg>`;
}

// Hover/touch readout for the name chart. Values are rendered server-side into a data attribute.
export function chartReadout(series) {
  const { f, m } = expandSeries(series);
  const data = JSON.stringify({ s: series.s, f, m });
  return `<div id="nc-readout" class="mt-2 text-sm text-slate-500 tabular-nums" data-series='${esc(data)}'>Hover or tap the chart to read any year.</div>`;
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
  return `<a href="/name/${r.slug}" class="block rounded-xl bg-white border border-slate-200 p-4 hover:border-indigo-400 hover:shadow-sm transition">
    <div class="flex items-center justify-between gap-2"><span class="font-semibold">${esc(r.name)}</span>${sexBadge}</div>
    <p class="text-xs text-slate-500 mt-1">${fmt(r.total)} babies since ${r.first_year}</p>
  </a>`;
}

export function rankTable(rows, { showCount = true } = {}) {
  return `<ol class="divide-y divide-slate-100">
    ${rows.map(r => `<li><a href="/name/${r.name.toLowerCase()}" class="flex items-center gap-4 px-2 py-2.5 hover:bg-indigo-50 rounded-lg">
      <span class="w-8 text-right text-sm text-slate-500 tabular-nums">${r.rank}</span>
      <span class="font-medium flex-1">${esc(r.name)}</span>
      ${showCount ? `<span class="text-sm text-slate-500 tabular-nums">${fmt(r.count)}</span>` : ''}
    </a></li>`).join('')}
  </ol>`;
}
