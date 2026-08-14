import { Hono } from 'hono';
import { ogImage, ogList, ogCompare } from './og.js';
import {
  layout, esc, fmt, cap, chartSVG, chartReadout, emailForm, nameCard, rankTable,
  expandSeries, genderOf, SITE, ORIGIN, START_YEAR, END_YEAR,
} from './html.js';

const app = new Hono();

const STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if ((c.res.headers.get('Content-Type') || '').includes('text/html')) {
    c.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
});

// s-maxage capped at 1h: the zone edge cache sits in front of the Worker and can't
// see CACHE_VER, so this bounds how long stale HTML survives a deploy.
const cache = { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' };
const noStore = { 'Cache-Control': 'no-store' };
const html = (c, body, status = 200) => c.html(body, status, status === 200 ? cache : noStore);
const htmlPrivate = (c, body, status = 200) => c.html(body, status, noStore);

const SLUG_RE = /^[a-z][a-z'-]{0,39}$/;
const slugify = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z'-]/g, '').slice(0, 40);

// Prefix search via index-friendly range scan (LIKE on a BINARY PK can't use the index
// and D1 rejects patterns >= 50 chars).
const NAME_COUNT = 105954; // rows in `names`; update when reimporting data
const CACHE_VER = 95; // bump to invalidate the edge HTML cache on deploys that change rendering/data
// '~' (0x7E) sorts after every character allowed in slugs (a-z, apostrophe, hyphen).
const prefixWhere = "slug >= ?1 AND slug < (?1 || '~')";

// Content safety: famous namesakes shown to expecting parents must never include
// violent criminals or perpetrators of atrocities. Filter by Wikidata description
// keywords plus an explicit name blocklist (kept in sync with scripts/fetch-famous.mjs).
const NEGATIVE_FIGURE_RE = /serial killer|murder|assassin|criminal|\brapist|sex offender|p(?:a|ae)?edophile|terroris|nazi|dictator|kidnapp|cult leader|mobster|gangster|mob boss|crime boss|drug (?:lord|trafficker|kingpin)|fraudster|ponzi|molest|genocide|warlord|hijack|cannibal|bank robber|human traffick|poisoner|mass shooting|school shooter/i;
const FIGURE_EXCEPTION_RE = /anti-nazi|resistance|victim|survivor/i;
const BLOCKED_FAMOUS = new Set(['ted bundy', 'ted kaczynski', 'adolf hitler', 'jeffrey dahmer', 'charles manson', 'john wayne gacy', 'osama bin laden', 'joseph stalin', 'pol pot', 'harold shipman', 'anders behring breivik', 'timothy mcveigh', 'lee harvey oswald', 'aileen wuornos', 'richard ramirez', 'dennis rader', 'gary ridgway', 'david berkowitz']);

// Unified QA-traffic convention: internal test tooling appends "DevinQA" to its
// User-Agent; such requests are served normally but excluded from analytics writes.
const isQA = c => (c.req.header('User-Agent') || '').includes('DevinQA');
// Analytics writes also skip obvious non-browser agents; counts stay best-effort, not tamper-proof.
const BOT_UA = /bot|crawl|spider|curl|wget|python|httpx|libwww|scrapy|headless/i;
const skipAnalytics = c => isQA(c) || BOT_UA.test(c.req.header('User-Agent') || '');

const etagOf = async buf => {
  const d = await crypto.subtle.digest('SHA-1', buf);
  return '"' + [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('') + '"';
};
const notModified = res => {
  const h = new Headers();
  for (const k of ['ETag', 'Cache-Control']) if (res.headers.get(k)) h.set(k, res.headers.get(k));
  return new Response(null, { status: 304, headers: h });
};

// Edge-cache successful HTML/XML GETs so repeat traffic doesn't hit D1.
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET') return next();
  const url = new URL(c.req.url);
  // Query-string requests are never cached (the key is path-only), so don't serve them from cache either.
  if (url.pathname.startsWith('/api/') || url.pathname === '/search' || url.search) return next();
  const inm = c.req.header('If-None-Match');
  const key = new Request(url.origin + '/__v' + CACHE_VER + url.pathname, { method: 'GET' });
  const hit = await caches.default.match(key);
  if (hit) {
    if (inm && inm === hit.headers.get('ETag')) return notModified(hit);
    return new Response(hit.body, hit);
  }
  await next();
  if (c.res.status === 200 && (c.res.headers.get('Cache-Control') || '').includes('s-maxage')) {
    const buf = await c.res.arrayBuffer();
    const res = new Response(buf, c.res);
    res.headers.set('ETag', await etagOf(buf));
    c.executionCtx.waitUntil(caches.default.put(key, res.clone()));
    c.res = inm && inm === res.headers.get('ETag') ? notModified(res) : res;
  }
});

async function getName(db, slug) {
  if (!SLUG_RE.test(slug)) return null;
  return db.prepare('SELECT * FROM names WHERE slug = ?').bind(slug).first();
}

// Names similar in era + popularity + gender, which is what parents actually shortlist against.
async function similarNames(db, r) {
  const g = genderOf(r);
  const sexCol = g === 'boy' ? 'm_total' : 'f_total';
  const rows = await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
      WHERE slug != ? AND ${sexCol} * 1.0 / total > 0.5
        AND peak_year BETWEEN ? AND ?
        AND total BETWEEN ? AND ?
      ORDER BY ABS(total - ?) LIMIT 8`)
    .bind(r.slug, r.peak_year - 6, r.peak_year + 6, Math.round(r.total * 0.45), Math.round(r.total * 2.2), r.total).all();
  return rows.results;
}

// Sibling-name ideas: same era and popularity band, both genders, skipping names that
// share an initial or rhyme with the base name (classic sibling-set advice).
async function siblingNames(db, r) {
  const rows = await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
      WHERE slug != ? AND peak_year BETWEEN ? AND ? AND total BETWEEN ? AND ?
      ORDER BY ABS(total - ?) LIMIT 30`)
    .bind(r.slug, r.peak_year - 8, r.peak_year + 8, Math.round(r.total * 0.35), Math.round(r.total * 2.8), r.total).all();
  const tail = r.slug.slice(-2);
  const picks = rows.results.filter(s => s.slug[0] !== r.slug[0] && s.slug.slice(-2) !== tail);
  const girls = picks.filter(s => s.f_total > s.m_total).slice(0, 4);
  const boys = picks.filter(s => s.m_total > s.f_total).slice(0, 4);
  return { girls, boys };
}

// ---------- home ----------
app.get('/', async c => {
  const db = c.env.DB;
  // Deterministic daily pick from the all-time top 2000 so every visitor sees the same name each day.
  const today = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (const ch of today) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const [girls, boys, popular, notd] = await Promise.all([
    db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 10').bind(END_YEAR, 'F').all(),
    db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 10').bind(END_YEAR, 'M').all(),
    db.prepare('SELECT slug,name,total,f_total,m_total,first_year FROM names ORDER BY total DESC LIMIT 12').all(),
    db.prepare('SELECT slug,name,total,f_total,m_total,first_year,peak_year FROM names ORDER BY total DESC LIMIT 1 OFFSET ?').bind(seed % 2000).first(),
  ]);
  const body = `
<section class="relative text-center py-12 sm:py-16 -mx-4 px-4 overflow-hidden">
  <div aria-hidden="true" class="absolute inset-0 -z-10 bg-gradient-to-br from-rose-50 via-indigo-50/60 to-amber-50"></div>
  <div class="hero-glow" aria-hidden="true"></div>
  <h1 class="fade-up font-display text-4xl sm:text-6xl font-bold tracking-tight">Every name tells a story.<br class="hidden sm:block"> <em class="text-gradient">See it in one chart.</em></h1>
  <p class="fade-up-2 mt-4 text-slate-600 max-w-xl mx-auto">Popularity charts, rankings and insights for ${fmt(NAME_COUNT)} names — from 146 years of official U.S. birth records.</p>
  <p class="fade-up-2 mt-3"><a href="/pricing" class="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 text-sm text-indigo-700 hover:border-indigo-400"><span class="rounded-full bg-indigo-600 text-white text-xs font-semibold px-2 py-0.5">Beta</span>All features free during Beta — see plans →</a></p>
  <form action="/search" method="get" class="mt-6 max-w-md mx-auto flex gap-2">
    <input name="q" placeholder="Try “Olivia”, “Theodore”, “Luna”…" autocomplete="off"
      class="flex-1 min-w-0 rounded-full border border-slate-300 bg-white px-4 sm:px-5 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
    <button class="shrink-0 rounded-full bg-indigo-600 text-white font-semibold px-4 sm:px-6 py-3 hover:bg-indigo-700">Search</button>
  </form>
  <dl class="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-4">
    <div><dt class="sr-only">Names</dt><dd class="font-display text-2xl font-bold">${fmt(NAME_COUNT)}</dd><dd class="text-xs uppercase tracking-wide text-slate-600">names</dd></div>
    <div><dt class="sr-only">Years of data</dt><dd class="font-display text-2xl font-bold">146</dd><dd class="text-xs uppercase tracking-wide text-slate-600">years of data</dd></div>
    <div><dt class="sr-only">States</dt><dd class="font-display text-2xl font-bold">51</dd><dd class="text-xs uppercase tracking-wide text-slate-600">states &amp; DC</dd></div>
    <div><dt class="sr-only">Cost during Beta</dt><dd class="font-display text-2xl font-bold">$0</dd><dd class="text-xs uppercase tracking-wide text-slate-600">during beta</dd></div>
  </dl>
</section>
<section aria-label="How it works" class="mb-8 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
  <h2 class="sr-only">How NameChart works</h2>
  <ol class="grid sm:grid-cols-3 gap-4 text-sm">
    ${[['1', 'Search a name', 'Type any name above — or start from the <a href="/top/girls" class="text-indigo-600 underline">top charts</a>.', ''], ['2', 'Read its 146-year story', 'Every name page has the full popularity curve, meaning, famous namesakes and state map.', ''], ['3', 'Shortlist &amp; match', 'Tap ♡ to build a shareable shortlist, then find <a href="/matcher" class="text-indigo-600 underline">sibling &amp; middle names</a> that fit.', '']].map(([n, t, d]) => `<li class="flex gap-3"><span aria-hidden="true" class="shrink-0 w-7 h-7 grid place-items-center rounded-full bg-indigo-600 text-white font-bold">${n}</span><div><p class="font-semibold">${t}</p><p class="mt-0.5 text-slate-600">${d}</p></div></li>`).join('')}
  </ol>
</section>
<section aria-label="Tools" class="mb-8 grid sm:grid-cols-2 gap-4">
  <a href="/generator" class="card-lift block rounded-2xl bg-white border border-slate-200 p-5 hover:border-indigo-300"><p class="font-bold">Baby Name Generator</p><p class="mt-1 text-sm text-slate-600">Fresh ideas by gender, style, letter and meaning — from real data.</p></a>
  <a href="/matcher" class="card-lift block rounded-2xl bg-white border border-slate-200 p-5 hover:border-indigo-300"><p class="font-bold">Sibling &amp; Middle Name Matcher <span class="align-middle ml-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">New</span></p><p class="mt-1 text-sm text-slate-600">Enter names you love, get sibling names and middle names that fit.</p></a>
</section>
${notd ? `<section class="mb-8 rounded-2xl bg-indigo-700 text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
  <div><p class="text-indigo-200 text-xs font-semibold uppercase tracking-wide">Name of the day · ${today}</p>
  <p class="mt-1 text-2xl font-extrabold">${esc(notd.name)}</p>
  <p class="mt-1 text-indigo-100 text-sm">${fmt(notd.total)} babies since ${notd.first_year} · peaked in ${notd.peak_year}</p></div>
  <a href="/name/${notd.slug}" class="rounded-full bg-white text-indigo-700 font-semibold px-5 py-2 text-sm hover:bg-indigo-50">See the chart →</a>
</section>` : ''}
<section class="grid sm:grid-cols-2 gap-6">
  <div class="rounded-2xl bg-white border border-slate-200 p-5">
    <div class="flex items-baseline justify-between"><h2 class="font-bold text-lg">Top girl names ${END_YEAR}</h2><a href="/top/girls" class="text-sm text-indigo-600 hover:underline">All 1000 →</a></div>
    ${rankTable(girls.results)}
  </div>
  <div class="rounded-2xl bg-white border border-slate-200 p-5">
    <div class="flex items-baseline justify-between"><h2 class="font-bold text-lg">Top boy names ${END_YEAR}</h2><a href="/top/boys" class="text-sm text-indigo-600 hover:underline">All 1000 →</a></div>
    ${rankTable(boys.results)}
  </div>
</section>
<section class="mt-8">
  <h2 class="font-bold text-lg mb-3">All-time favorites</h2>
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${popular.results.map(nameCard).join('')}</div>
</section>
<section class="mt-8">
  <h2 class="font-bold text-lg mb-3">Curated lists</h2>
  <div class="flex flex-wrap gap-2 text-sm">${Object.entries(LISTS).map(([s, d]) => `<a href="/list/${s}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${d.title}</a>`).join('')}<a href="/generator" class="px-3 py-1.5 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Baby name generator →</a></div>
</section>
<section class="mt-8 grid sm:grid-cols-3 gap-4 text-sm">
  <a href="/trending" class="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-400"><p class="font-semibold">📈 Rising &amp; falling</p><p class="text-slate-600 mt-1">Names climbing or crashing right now.</p></a>
  <a href="/browse" class="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-400"><p class="font-semibold">🗂 Browse everything</p><p class="text-slate-600 mt-1">A–Z, every year since 1880, decades, all 50 states.</p></a>
  <a href="/compare/emma-vs-olivia" class="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-400"><p class="font-semibold">⚔️ Compare names</p><p class="text-slate-600 mt-1">Two names, head-to-head on one chart.</p></a>
</section>
${emailForm()}`;
  return html(c, layout({
    title: `${SITE} — Baby Name Popularity Charts, 1880–${END_YEAR}`,
    desc: `Interactive popularity charts and rankings for ${fmt(NAME_COUNT)} baby names from 146 years of official U.S. birth data. All features open during the free Beta.`,
    path: '/',
    body,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: ORIGIN, potentialAction: { '@type': 'SearchAction', target: `${ORIGIN}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
  }));
});

// ---------- name page ----------
app.get('/name/:slug', async c => {
  const db = c.env.DB;
  const raw = c.req.param('slug');
  const slug = slugify(raw);
  const r = await getName(db, slug);
  if (r && raw !== slug) return c.redirect(`/name/${slug}`, 301);
  if (!r) {
    const near = slug ? (await fuzzyMatches(db, slug, 2)).slice(0, 6) : [];
    return html(c, layout({ title: 'Name not found — ' + SITE, desc: 'Name not found', path: '/name/', noindex: true, body: `<div class="text-center py-20"><h1 class="text-2xl font-bold">We don't have data for “${esc(cap(slug))}” yet</h1><p class="mt-2 text-slate-600">It may have fewer than 5 births in any year — the data source only includes names with 5+ births.</p>${near.length ? `<p class="mt-6 font-semibold">Did you mean:</p><div class="mt-3 flex flex-wrap justify-center gap-2 text-sm">${near.map(v => `<a href="/name/${v.slug}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${esc(v.name)}</a>`).join('')}</div>` : ''}<a href="/" class="inline-block mt-6 text-indigo-600 hover:underline">← Back to search</a></div>` }), 404);
  }
  const series = JSON.parse(r.series);
  const { f, m } = expandSeries(series);
  const latest = f[f.length - 1] + m[m.length - 1];
  const tenAgo = (f[f.length - 11] ?? 0) + (m[m.length - 11] ?? 0);
  const trendPct = tenAgo > 0 ? Math.round(((latest - tenAgo) / tenAgo) * 100) : null;
  const girlPct = r.total ? Math.round((r.f_total / r.total) * 100) : 0;
  const gender = genderOf(r);
  const unisex = gender === 'unisex';
  const primary = gender === 'unisex' ? (r.f_total >= r.m_total ? 'girl' : 'boy') : gender;
  const rankBits = [];
  if (r.latest_rank_f && r.latest_rank_f <= 1000) rankBits.push(`#${fmt(r.latest_rank_f)} for girls`);
  if (r.latest_rank_m && r.latest_rank_m <= 1000) rankBits.push(`#${fmt(r.latest_rank_m)} for boys`);
  const [similar, sibs, meaning, famousRow, rankHist, yearTot, stateRows, prevRanks, rhymes] = await Promise.all([
    similarNames(db, r),
    siblingNames(db, r),
    db.prepare('SELECT * FROM meanings WHERE slug = ?').bind(slug).first().catch(() => null),
    db.prepare('SELECT people FROM famous WHERE slug = ?').bind(slug).first().catch(() => null),
    db.prepare('SELECT year, sex, rank FROM year_ranks WHERE name = ? AND (year % 25 = 0 OR year = ' + END_YEAR + ') ORDER BY year').bind(r.name).all().catch(() => ({ results: [] })),
    db.prepare('SELECT f, m FROM year_totals WHERE year = ?').bind(END_YEAR).first().catch(() => null),
    db.prepare('SELECT state, sex, rank FROM state_ranks WHERE name = ? ORDER BY rank LIMIT 10').bind(r.name).all().catch(() => ({ results: [] })),
    db.prepare('SELECT sex, rank FROM year_ranks WHERE name = ? AND year = ?').bind(r.name, END_YEAR - 1).all().catch(() => ({ results: [] })),
    slug.length >= 4
      ? db.prepare('SELECT slug,name,total,f_total,m_total,first_year FROM names WHERE substr(slug,-3) = substr(?1,-3) AND slug != ?1 ORDER BY total DESC LIMIT 8').bind(slug).all().catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] }),
  ]);
  const [recentRanks, recentTotals] = await Promise.all([
    db.prepare('SELECT year, sex, rank FROM year_ranks WHERE name = ? AND year >= ? ORDER BY year DESC').bind(r.name, END_YEAR - 11).all().catch(() => ({ results: [] })),
    db.prepare('SELECT year, f, m FROM year_totals WHERE year >= ? ORDER BY year DESC').bind(END_YEAR - 11).all().catch(() => ({ results: [] })),
  ]);
  const yoy = sex => {
    const cur = sex === 'F' ? r.latest_rank_f : r.latest_rank_m;
    const prev = prevRanks.results.find(x => x.sex === sex)?.rank;
    if (!cur || cur > 1000 || !prev || prev > 1000) return '';
    const d = prev - cur;
    if (d === 0) return ` <span class="text-slate-600">(= vs ${END_YEAR - 1})</span>`;
    return d > 0 ? ` <span class="text-emerald-700">(▲ ${d} vs ${END_YEAR - 1})</span>` : ` <span class="text-rose-700">(▼ ${-d} vs ${END_YEAR - 1})</span>`;
  };
  let famous = [];
  try { famous = famousRow ? JSON.parse(famousRow.people) : []; } catch { famous = []; }
  famous = famous.filter(p => !((NEGATIVE_FIGURE_RE.test(p.d || '') && !FIGURE_EXCEPTION_RE.test(p.d || '')) || BLOCKED_FAMOUS.has((p.n || '').toLowerCase())));
  const variants = (await fuzzyMatches(db, slug, 1)).filter(v => v.slug !== slug).slice(0, 6);
  const bestRank = Math.min(r.latest_rank_f || 9999, r.latest_rank_m || 9999);
  const stats = [
    ['Total babies', fmt(r.total), `Every U.S. baby named ${r.name} since ${r.first_year}`],
    ['Peak year', `${r.peak_year} (${fmt(r.peak_count)} babies)`, `The single biggest year for ${r.name}`],
    [`Rank in ${END_YEAR}`, rankBits.length ? [
      r.latest_rank_f && r.latest_rank_f <= 1000 ? `#${fmt(r.latest_rank_f)} for girls${yoy('F')}` : null,
      r.latest_rank_m && r.latest_rank_m <= 1000 ? `#${fmt(r.latest_rank_m)} for boys${yoy('M')}` : null,
    ].filter(Boolean).join(' · ') : 'Below top 1000',
    rankBits.length ? (bestRank <= 25 ? 'Very popular — expect classmates who share it' : bestRank <= 200 ? 'Popular but not everywhere' : 'Familiar yet uncommon') : 'Rare — a truly distinctive pick'],
    ['First recorded', String(r.first_year), `First year ${r.name} shows up in U.S. records`],
    ['10-year trend', trendPct === null ? 'New / returning' : `${trendPct > 0 ? '▲ +' : trendPct < 0 ? '▼ ' : ''}${trendPct}%`, trendPct === null ? 'Too new (or newly back) to compare' : trendPct > 15 ? 'On its way up — getting more common' : trendPct < -15 ? 'Fading — feels more distinctive each year' : 'Holding steady vs. 10 years ago'],
    ['Gender split', r.f_total && r.m_total ? `${girlPct}% girls / ${100 - girlPct}% boys` : (r.f_total ? 'All girls' : 'All boys'), unisex ? 'Genuinely used for both — a true unisex name' : 'Share of all babies ever given this name'],
  ];
  const body = `
<nav aria-label="Breadcrumb" class="text-sm text-slate-600 mb-4"><a href="/" class="hover:text-indigo-600">Home</a> › <a href="/letter/${slug[0]}" class="hover:text-indigo-600">Names starting with ${slug[0].toUpperCase()}</a> › <span>${esc(r.name)}</span></nav>
<div class="flex flex-wrap items-baseline gap-3">
  <h1 class="font-display text-4xl sm:text-5xl font-bold tracking-tight">${esc(r.name)}</h1>
  ${unisex ? '<span class="text-sm rounded-full bg-purple-100 text-purple-700 px-3 py-1">Unisex</span>' : `<span class="text-sm rounded-full ${primary === 'girl' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'} px-3 py-1">${cap(primary)} name</span>`}
</div>
${(() => {
  const chips = [];
  const bits = [];
  if (meaning?.origin) chips.push(`<span class="px-3 py-1 rounded-full bg-white border border-slate-200"><span class="text-slate-600">Origin</span> <strong>${esc(meaning.origin.split(',')[0])}</strong></span>`);
  const mw = meaning?.etymology ? MEANING_WORDS.find(w => new RegExp(`\\b${w}\\b`, 'i').test(meaning.etymology)) : null;
  if (mw) chips.push(`<a href="/meaning/${mw}" class="px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-indigo-400"><span class="text-slate-600">Meaning</span> <strong>“${mw}”</strong></a>`);
  if (meaning?.ipa) chips.push(`<span class="px-3 py-1 rounded-full bg-white border border-slate-200"><span class="text-slate-600">Say it</span> <strong>${esc(meaning.ipa)}</strong></span>`);
  if (bestRank <= 1000) chips.push(`<span class="px-3 py-1 rounded-full ${bestRank <= 100 ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}"><span class="${bestRank <= 100 ? 'text-indigo-100' : 'text-slate-600'}">${END_YEAR} rank</span> <strong>#${fmt(bestRank)}</strong>${bestRank <= 100 ? ' · Top 100' : ' · Top 1000'}</span>`);
  return chips.length ? `<div class="mt-3 flex flex-wrap gap-2 text-sm">${chips.join('')}${bits.join('')}</div>` : '';
})()}
<p class="mt-2 text-slate-600 max-w-2xl">${esc(r.name)} has been given to <strong>${fmt(r.total)}</strong> babies in the U.S. since ${r.first_year}. It peaked in <strong>${r.peak_year}</strong>${rankBits.length ? ` and currently ranks <strong>${rankBits.join(' and ')}</strong> (${END_YEAR})` : ''}.${(() => {
  if (!yearTot || !latest) return '';
  const denom = primary === 'girl' ? yearTot.f : yearTot.m;
  const sexLatest = primary === 'girl' ? f[f.length - 1] : m[m.length - 1];
  if (!sexLatest || !denom) return '';
  const oneIn = Math.round(denom / sexLatest);
  return ` In ${END_YEAR}, about <strong>1 in ${fmt(oneIn)}</strong> ${primary === 'girl' ? 'girls' : 'boys'} was named ${esc(r.name)}.`;
})()}</p>
<p class="mt-2 text-xs text-slate-600">Data: official U.S. Social Security records, 1880–${END_YEAR} · <a class="underline hover:text-indigo-600" href="/about">sources &amp; methodology</a> · <a class="underline hover:text-indigo-600" href="/search?q=${slug}&list=1">see all names matching “${esc(r.name)}”</a></p>
<div id="nc-search-note" hidden class="mt-3 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-2.5 text-sm text-slate-700">Looking for every name starting with “${esc(r.name)}”? <a href="/search?q=${slug}&list=1" class="text-indigo-700 font-medium hover:underline">See the full match list →</a></div>
<nav aria-label="On this page" class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-indigo-700"><span class="text-slate-600">On this page:</span>${[
  meaning && (meaning.etymology || meaning.ipa) ? ['#meaning', 'Meaning'] : null,
  ['#popularity', 'Popularity'],
  recentRanks.results.length ? ['#recent', 'Recent years'] : null,
  stateRows.results.length ? ['#states', 'By state'] : null,
  famous.length ? ['#famous', 'Famous'] : null,
  similar.length ? ['#similar', 'Similar names'] : null,
  sibs.girls.length || sibs.boys.length ? ['#siblings', 'Siblings'] : null,
  ['#faq', 'FAQ'],
].filter(Boolean).map(([h, t]) => `<a class="hover:underline" href="${h}">${t}</a>`).join('')}</nav>
${meaning && (meaning.etymology || meaning.ipa) ? `
<section id="meaning" class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6">
  <h2 class="font-bold mb-2">Meaning &amp; origin${meaning.ipa ? ` <span class="font-normal text-slate-600 text-base">${esc(meaning.ipa)}</span>` : ''}</h2>
  ${meaning.etymology ? `<p class="text-slate-700">${esc(meaning.etymology)}</p>` : ''}
  ${meaning.origin ? `<p class="mt-2 text-sm text-slate-600">Origin: ${esc(meaning.origin.replace(/,\s*/g, ', '))}${meaning.diminutive_of ? ` · Short form of ${esc(meaning.diminutive_of)}` : ''}</p>` : (meaning.diminutive_of ? `<p class="mt-2 text-sm text-slate-600">Short form of ${esc(meaning.diminutive_of)}</p>` : '')}
  ${(() => { const ws = meaning.etymology ? MEANING_WORDS.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(meaning.etymology)) : []; return ws.length ? `<div class="mt-3 flex flex-wrap gap-2 text-sm">${ws.map(w => `<a href="/meaning/${w}" class="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Names that mean ${w}</a>`).join('')}</div>` : ''; })()}
  <p class="mt-3 text-xs text-slate-600">Etymology adapted from <a class="underline hover:text-indigo-600" href="https://en.wiktionary.org/wiki/${encodeURIComponent(r.name)}" rel="license noopener">Wiktionary</a>, licensed <a class="underline hover:text-indigo-600" href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener">CC BY-SA 4.0</a>.</p>
</section>` : ''}
<div id="popularity" class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6">
  <h2 class="font-bold mb-2">Popularity over time <span class="font-normal text-sm text-slate-600">births per year, 1880–${END_YEAR}</span></h2>
  ${chartSVG(series)}
  ${chartReadout(series)}
</div>
<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
  ${stats.map(([k, v, why]) => `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="text-xs uppercase tracking-wide text-slate-600">${k}</p><p class="font-semibold mt-1 stat-num">${v}</p>${why ? `<p class="text-xs text-slate-600 mt-1">${why}</p>` : ''}</div>`).join('')}
</div>
<div class="mt-6 flex flex-wrap gap-3">
  <form action="/compare" method="get" class="flex gap-2 items-center">
    <input type="hidden" name="a" value="${esc(r.name)}">
    <input name="b" required placeholder="Compare with…" class="rounded-full border border-slate-300 px-4 py-2 text-sm bg-white w-44">
    <button class="rounded-full border border-indigo-300 text-indigo-700 px-4 py-2 text-sm font-medium hover:bg-indigo-50">⚔️ Compare</button>
  </form>
  <button id="nc-share" class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">↗ Share this chart</button>
  <button id="nc-fav" data-slug="${slug}" data-name="${esc(r.name)}" class="rounded-full border border-rose-200 text-rose-700 px-4 py-2 text-sm font-medium hover:bg-rose-50">♡ Save to shortlist</button>
</div>
<div id="nc-tip" hidden class="mt-3 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-slate-700 flex items-start justify-between gap-3"><span>Tip: tap <strong>♡ Save to shortlist</strong> to collect names you like — you can compare and share the list later.</span><button id="nc-tip-x" aria-label="Dismiss tip" class="shrink-0 text-slate-500 hover:text-slate-800 px-1 font-bold">×</button></div>
${rankHist.results.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Rank through the decades</h2><p class="text-sm text-slate-600 -mt-2 mb-3">${esc(r.name)}'s rank among U.S. ${primary} names at 25-year milestones.</p><div class="rounded-2xl bg-white border border-slate-200 p-4 overflow-x-auto"><table class="text-sm w-full"><thead><tr class="text-left text-xs uppercase tracking-wide text-slate-600"><th class="py-1 pr-4">Year</th>${rankHist.results.some(x => x.sex === 'F') ? '<th class="py-1 pr-4">Girls rank</th>' : ''}${rankHist.results.some(x => x.sex === 'M') ? '<th class="py-1">Boys rank</th>' : ''}</tr></thead><tbody>${[...new Set(rankHist.results.map(x => x.year))].map(y => { const f = rankHist.results.find(x => x.year === y && x.sex === 'F'); const m = rankHist.results.find(x => x.year === y && x.sex === 'M'); return `<tr class="border-t border-slate-100"><td class="py-1.5 pr-4 font-medium">${y}</td>${rankHist.results.some(x => x.sex === 'F') ? `<td class="py-1.5 pr-4">${f ? '#' + fmt(f.rank) : '—'}</td>` : ''}${rankHist.results.some(x => x.sex === 'M') ? `<td class="py-1.5">${m ? '#' + fmt(m.rank) : '—'}</td>` : ''}</tr>`; }).join('')}</tbody></table></div><p class="mt-2 text-xs text-slate-600">— means outside the top 1000 that year.</p></section>` : ''}
${recentRanks.results.length ? (() => {
  const years = [...new Set(recentRanks.results.map(x => x.year))];
  const hasF = recentRanks.results.some(x => x.sex === 'F'), hasM = recentRanks.results.some(x => x.sex === 'M');
  const rows = years.map(y => {
    const rf = recentRanks.results.find(x => x.year === y && x.sex === 'F');
    const rm = recentRanks.results.find(x => x.year === y && x.sex === 'M');
    const idx = y - series.s;
    const births = (f[idx] ?? 0) + (m[idx] ?? 0);
    const tot = recentTotals.results.find(t => t.year === y);
    const sexBirths = primary === 'girl' ? (f[idx] ?? 0) : (m[idx] ?? 0);
    const denom = tot ? (primary === 'girl' ? tot.f : tot.m) : 0;
    const oneIn = sexBirths && denom ? Math.round(denom / sexBirths) : null;
    return `<tr class="border-t border-slate-100"><td class="py-1.5 pr-4 font-medium">${y}</td>${hasF ? `<td class="py-1.5 pr-4 stat-num">${rf ? '#' + fmt(rf.rank) : '—'}</td>` : ''}${hasM ? `<td class="py-1.5 pr-4 stat-num">${rm ? '#' + fmt(rm.rank) : '—'}</td>` : ''}<td class="py-1.5 pr-4 stat-num">${fmt(births)}</td><td class="py-1.5 stat-num">${oneIn ? `1 in ${fmt(oneIn)}` : '—'}</td></tr>`;
  }).join('');
  return `<section id="recent" class="mt-10"><h2 class="font-bold text-lg mb-3">Recent years</h2><p class="text-sm text-slate-600 -mt-2 mb-3">Year-by-year rank and births for ${esc(r.name)} — “1 in N” shows how many U.S. ${primary === 'girl' ? 'girls' : 'boys'} born that year got the name.</p><div class="rounded-2xl bg-white border border-slate-200 p-4 overflow-x-auto"><table class="text-sm w-full"><thead><tr class="text-left text-xs uppercase tracking-wide text-slate-600"><th class="py-1 pr-4">Year</th>${hasF ? '<th class="py-1 pr-4">Girls rank</th>' : ''}${hasM ? '<th class="py-1 pr-4">Boys rank</th>' : ''}<th class="py-1 pr-4">Births</th><th class="py-1">1 in N ${primary === 'girl' ? 'girls' : 'boys'}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
})() : ''}
${stateRows.results.length ? `<section id="states" class="mt-10"><h2 class="font-bold text-lg mb-3">Where ${esc(r.name)} ranks highest (${END_YEAR})</h2><p class="text-sm text-slate-600 -mt-2 mb-3">States where ${esc(r.name)} places best in the state top 100.</p><div class="flex flex-wrap gap-2 text-sm">${stateRows.results.map(s => `<a href="/state/${s.state.toLowerCase()}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${STATES[s.state] || s.state} <span class="text-slate-600">#${s.rank} ${s.sex === 'F' ? 'girls' : 'boys'}</span></a>`).join('')}</div></section>` : ''}
${variants.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Spellings &amp; variants</h2><p class="text-sm text-slate-600 -mt-2 mb-3">Names one letter away from ${esc(r.name)} — alternate spellings parents actually use.</p><div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${variants.map(nameCard).join('')}</div></section>` : ''}
${famous.length ? `<section id="famous" class="mt-10"><h2 class="font-bold text-lg mb-3">Famous people named ${esc(r.name)}</h2><div class="grid sm:grid-cols-2 gap-3">${famous.map(p => `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold">${esc(p.n)}</p>${p.d ? `<p class="text-sm text-slate-600 mt-1">${esc(cap(p.d))}</p>` : ''}</div>`).join('')}</div><p class="mt-2 text-xs text-slate-600">Notability data from <a class="underline hover:text-indigo-600" href="https://www.wikidata.org/" rel="noopener">Wikidata</a> (CC0).</p></section>` : ''}
${similar.length ? `<section id="similar" class="mt-10"><h2 class="font-bold text-lg mb-3">Names with a similar vibe</h2><p class="text-sm text-slate-600 -mt-2 mb-3">Same primary gender, peaked around the same years, and roughly as common as ${esc(r.name)}.</p><div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${similar.map(nameCard).join('')}</div>
<div class="mt-4 flex flex-wrap gap-2 text-sm">${similar.slice(0, 4).map(s => { const pair = [slug, s.slug].sort(); return `<a href="/compare/${pair[0]}-vs-${pair[1]}" class="px-3 py-1 rounded-full bg-amber-50 text-amber-800 hover:bg-amber-100">${esc(r.name)} vs ${esc(s.name)} ⚖</a>`; }).join('')}</div></section>` : ''}
${sibs.girls.length || sibs.boys.length ? `<section id="siblings" class="mt-10"><h2 class="font-bold text-lg mb-3">Sibling name ideas for ${esc(r.name)}</h2><p class="text-sm text-slate-600 -mt-2 mb-3">Same era and popularity as ${esc(r.name)}, avoiding matching initials or rhymes.</p><div class="grid sm:grid-cols-2 gap-3">${sibs.girls.length ? `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold text-sm text-pink-700 mb-2">Sisters</p><div class="flex flex-wrap gap-2 text-sm">${sibs.girls.map(s => `<a href="/name/${s.slug}" class="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:border-indigo-400">${esc(s.name)}</a>`).join('')}</div></div>` : ''}${sibs.boys.length ? `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold text-sm text-blue-700 mb-2">Brothers</p><div class="flex flex-wrap gap-2 text-sm">${sibs.boys.map(s => `<a href="/name/${s.slug}" class="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:border-indigo-400">${esc(s.name)}</a>`).join('')}</div></div>` : ''}</div></section>` : ''}
${rhymes.results.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Names that rhyme with ${esc(r.name)}</h2><p class="text-sm text-slate-600 -mt-2 mb-3">Names sharing the same ending sound as ${esc(r.name)}, by all-time U.S. popularity.</p><div class="flex flex-wrap gap-2 text-sm">${rhymes.results.map(s => `<a href="/name/${s.slug}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${esc(s.name)}</a>`).join('')}</div></section>` : ''}
${(() => {
  const g = primary === 'girl' ? 'girl' : 'boy';
  const rank = primary === 'girl' ? r.latest_rank_f : r.latest_rank_m;
  const rels = [];
  if (r.name.length <= 4) rels.push([`short-${g}-names`, `Short ${g} names`]);
  if (r.name.length >= 9) rels.push([`long-${g}-names`, `Long ${g} names`]);
  if (r.first_year >= 1990) rels.push([`new-${g}-names`, `Modern ${g} names`]);
  if (r.peak_year < 1940 && rank && rank <= 500) rels.push([`vintage-${g}-names`, `Vintage ${g} names making a comeback`]);
  const etymClean = meaning?.etymology ? stripUsageNotes(meaning.etymology) : '';
  if (etymClean) {
    if (NATURE_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(etymClean))) rels.push([`nature-${g}-names`, `Nature ${g} names`]);
    if (CELESTIAL_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(etymClean))) rels.push([`celestial-${g}-names`, `Celestial ${g} names`]);
    if (ROYAL_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(etymClean))) rels.push([`royal-${g}-names`, `Royal ${g} names`]);
    if (VIRTUE_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(etymClean))) rels.push([`virtue-${g}-names`, `Virtue ${g} names`]);
    if (WARRIOR_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(etymClean))) rels.push([`warrior-${g}-names`, `Warrior ${g} names`]);
    if (DIVINE_WORDS.some(w => new RegExp(`\\b${w}\\b`, 'i').test(etymClean))) rels.push([`divine-${g}-names`, `Divine ${g} names`]);
  }
  if (!rels.length) return '';
  return `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Explore related lists</h2><div class="flex flex-wrap gap-2 text-sm">${rels.map(([s, t]) => `<a href="/list/${s}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${t} →</a>`).join('')}</div></section>`;
})()}
${(() => {
  if (!meaning || !meaning.etymology) return '';
  const ws = MEANING_WORDS.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(stripUsageNotes(meaning.etymology)));
  if (!ws.length) return '';
  return `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Names with the same meaning</h2><p class="text-sm text-slate-600 -mt-2 mb-3">${esc(r.name)} relates to ${ws.map(w => `“${w}”`).join(', ')} — explore other names with documented ties to the same meaning.</p><div class="flex flex-wrap gap-2 text-sm">${ws.map(w => `<a href="/meaning/${w}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">Names that mean ${w} →</a>`).join('')}</div></section>`;
})()}
<section id="faq" class="mt-10"><h2 class="font-bold text-lg mb-3">FAQ</h2><div class="space-y-3">
  <div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold">How popular is the name ${esc(r.name)}?</p><p class="text-sm text-slate-600 mt-1">${esc(r.name)} has been given to ${fmt(r.total)} babies in the U.S. since ${r.first_year}.${rankBits.length ? ` In ${END_YEAR} it ranked ${rankBits.join(' and ')}.` : ` It ranked below the top 1000 in ${END_YEAR}.`}</p></div>
  <div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold">When did the name ${esc(r.name)} peak?</p><p class="text-sm text-slate-600 mt-1">${esc(r.name)} peaked in ${r.peak_year}, when ${fmt(r.peak_count)} babies were given the name.</p></div>
  <div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold">Is ${esc(r.name)} a girl or boy name?</p><p class="text-sm text-slate-600 mt-1">${unisex ? `${esc(r.name)} is a unisex name, used for both girls and boys.` : `${esc(r.name)} is primarily a ${primary} name (${primary === 'girl' ? girlPct : 100 - girlPct}% of babies named ${esc(r.name)} are ${primary}s).`}</p></div>
</div></section>
${emailForm()}`;
  return html(c, layout({
    title: `${r.name} — Name Popularity, Rank & Chart (1880–${END_YEAR}) | ${SITE}`,
    desc: `${r.name}: given to ${fmt(r.total)} U.S. babies since ${r.first_year}, peaked in ${r.peak_year}.${rankBits.length ? ` Ranked ${rankBits.join(', ')} in ${END_YEAR}.` : ''} Full 146-year popularity chart.`,
    path: `/name/${slug}`,
    ogImage: `${ORIGIN}/og/name/${slug}.png`,
    body,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Dataset', name: `${r.name} name popularity 1880–${END_YEAR}`, description: `Births per year for the name ${r.name} in the United States.`, license: 'https://www.usa.gov/government-works', creator: { '@type': 'Organization', name: 'U.S. Social Security Administration' } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: `Names starting with ${slug[0].toUpperCase()}`, item: `${ORIGIN}/letter/${slug[0]}` },
        { '@type': 'ListItem', position: 3, name: r.name, item: `${ORIGIN}/name/${slug}` },
      ] },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
        { '@type': 'Question', name: `How popular is the name ${r.name}?`, acceptedAnswer: { '@type': 'Answer', text: `${r.name} has been given to ${fmt(r.total)} babies in the U.S. since ${r.first_year}.${rankBits.length ? ` In ${END_YEAR} it ranked ${rankBits.join(' and ')}.` : ` It ranked below the top 1000 in ${END_YEAR}.`}` } },
        { '@type': 'Question', name: `When did the name ${r.name} peak?`, acceptedAnswer: { '@type': 'Answer', text: `${r.name} peaked in ${r.peak_year}, when ${fmt(r.peak_count)} babies were given the name.` } },
        { '@type': 'Question', name: `Is ${r.name} a girl or boy name?`, acceptedAnswer: { '@type': 'Answer', text: unisex ? `${r.name} is a unisex name, used for both girls and boys.` : `${r.name} is primarily a ${primary} name (${primary === 'girl' ? girlPct : 100 - girlPct}% of babies named ${r.name} are ${primary}s).` } },
      ] },
    ],
  }));
});

// ---------- og image ----------
app.get('/og/name/:file', async c => {
  const mth = c.req.param('file').match(/^([a-z'-]{1,40})\.png$/);
  const r = mth && await getName(c.env.DB, mth[1]);
  if (!r) return c.notFound();
  const res = await ogImage(c, r);
  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res;
});

// ---------- compare ----------
const compact = v => v >= 1e6 ? `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(Math.round(v));
app.get('/compare/:pair', async c => {
  const db = c.env.DB;
  const mth = c.req.param('pair').toLowerCase().match(/^([a-z'-]+)-vs-([a-z'-]+)$/);
  if (!mth) return c.redirect('/');
  if (mth[1] === mth[2]) return c.redirect(`/name/${mth[1]}`);
  // Canonical order is alphabetical so a-vs-b and b-vs-a don't index as duplicates.
  if (mth[1] > mth[2]) return c.redirect(`/compare/${mth[2]}-vs-${mth[1]}`, 301);
  const [a, b] = await Promise.all([getName(db, mth[1]), getName(db, mth[2])]);
  if (!a || !b) return c.redirect(a ? `/name/${mth[1]}` : b ? `/name/${mth[2]}` : '/');
  const sa = expandSeries(JSON.parse(a.series)), sb = expandSeries(JSON.parse(b.series));
  const ta = sa.f.map((v, i) => v + sa.m[i]), tb = sb.f.map((v, i) => v + sb.m[i]);
  const n = ta.length, max = Math.max(1, ...ta, ...tb);
  const W = 800, H = 280, padL = 44, padR = 12, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = i => padL + (i / (n - 1)) * iw, y = v => padT + ih - (v / max) * ih;
  const line = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const xTicks = []; for (let yr = 1900; yr <= END_YEAR; yr += 20) xTicks.push(yr);
  // Current leader and the year the lead last changed hands.
  let lastFlip = -1, prevSign = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.sign(ta[i] - tb[i]);
    if (s !== 0) {
      if (prevSign !== 0 && s !== prevSign) lastFlip = i;
      prevSign = s;
    }
  }
  const flipX = lastFlip > 0 ? x(lastFlip) : 0;
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Comparison chart">
    ${[0.25, 0.5, 0.75, 1].map(t => `<line x1="${padL}" x2="${W - padR}" y1="${y(max * t)}" y2="${y(max * t)}" stroke="#e2e8f0"/><text x="${padL - 6}" y="${y(max * t) + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${compact(max * t)}</text>`).join('')}
    ${xTicks.map(yr => `<text x="${x(yr - START_YEAR)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#94a3b8">${yr}</text>`).join('')}
    <path d="${line(ta)}" fill="none" stroke="#4f46e5" stroke-width="2"/>
    <path d="${line(tb)}" fill="none" stroke="#f59e0b" stroke-width="2"/>
    ${lastFlip > 0 ? `<line x1="${flipX.toFixed(1)}" x2="${flipX.toFixed(1)}" y1="${padT}" y2="${padT + ih}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/><text x="${(flipX + (flipX > W / 2 ? -5 : 5)).toFixed(1)}" y="${padT + 26}" text-anchor="${flipX > W / 2 ? 'end' : 'start'}" font-size="10" fill="#64748b" stroke="#ffffff" stroke-width="3" paint-order="stroke">lead changed ${START_YEAR + lastFlip}</text>` : ''}
    <rect x="${padL}" y="${padT}" width="10" height="3" fill="#4f46e5"/><text x="${padL + 14}" y="${padT + 5}" font-size="11" fill="#475569">${esc(a.name)}</text>
    <rect x="${padL + 90}" y="${padT}" width="10" height="3" fill="#f59e0b"/><text x="${padL + 104}" y="${padT + 5}" font-size="11" fill="#475569">${esc(b.name)}</text>
    <line id="nc-cursor" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" stroke="#6366f1" stroke-width="1" stroke-dasharray="3 3" style="display:none"/>
    <circle id="nc-dot-f" r="3.5" fill="#4f46e5" stroke="#fff" stroke-width="1.5" style="display:none"/>
    <circle id="nc-dot-m" r="3.5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" style="display:none"/>
    <g id="nc-chart-tip" style="display:none"><rect rx="6" fill="#1e293b" opacity="0.92"/><text font-size="11" fill="#fff"></text></g>
    <rect id="nc-hit" x="${padL}" y="${padT}" width="${iw}" height="${ih}" fill="transparent"/>
  </svg>`;
  const winner = a.total >= b.total ? a : b;
  const sims = await similarNames(db, a);
  const pairSlug = (x, y) => (x < y ? `${x}-vs-${y}` : `${y}-vs-${x}`);
  const moreCompares = sims.filter(s => s.slug !== b.slug).slice(0, 6)
    .map(s => [pairSlug(a.slug, s.slug), `${esc(a.name)} vs ${esc(s.name)}`]);
  const nowLeader = ta[n - 1] >= tb[n - 1] ? a : b;
  const leadNote = ta[n - 1] === tb[n - 1] ? ''
    : lastFlip === -1
      ? `${esc(nowLeader.name)} has led every year on record.`
      : `${esc(nowLeader.name)} has led since ${START_YEAR + lastFlip} — before that, ${esc(nowLeader === a ? b.name : a.name)} was ahead.`;
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold tracking-tight">${esc(a.name)} <span class="text-slate-600">vs</span> ${esc(b.name)}</h1>
<p class="mt-2 text-slate-600">All-time, <strong>${esc(winner.name)}</strong> leads: ${fmt(winner.total)} babies vs ${fmt(winner === a ? b.total : a.total)}.${leadNote ? ` ${leadNote}` : ''}</p>
<div class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6">${svg}<div id="nc-readout" class="mt-2 text-sm text-slate-600 tabular-nums" data-series='${esc(JSON.stringify({ s: START_YEAR, f: ta, m: tb, max, padT, ih, la: a.name, lb: b.name, fl: lastFlip > 0 ? lastFlip : 0 }))}'>Hover or tap the chart to read any year.</div></div>
<div class="mt-6 grid grid-cols-2 gap-3">
  ${[a, b].map(r => `<a href="/name/${r.slug}" class="rounded-xl bg-white border border-slate-200 p-4 hover:border-indigo-400">
    <p class="font-bold">${esc(r.name)}</p>
    <p class="text-sm text-slate-600 mt-1">${fmt(r.total)} total · peak ${r.peak_year}${r.latest_rank_f && r.latest_rank_f <= 1000 ? ` · #${r.latest_rank_f} girls` : ''}${r.latest_rank_m && r.latest_rank_m <= 1000 ? ` · #${r.latest_rank_m} boys` : ''}</p>
  </a>`).join('')}
</div>
<form action="/compare" method="get" class="mt-8 flex flex-col sm:flex-row gap-2 max-w-lg">
  <input name="a" placeholder="First name" value="${esc(a.name)}" class="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm bg-white">
  <input name="b" placeholder="Second name" value="${esc(b.name)}" class="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm bg-white">
  <button class="rounded-full bg-indigo-600 text-white px-5 py-2 text-sm font-semibold hover:bg-indigo-700">Compare</button>
</form>
${moreCompares.length ? `<section class="mt-8"><h2 class="font-bold text-lg mb-2">More comparisons</h2><div class="flex flex-wrap gap-2 text-sm">${moreCompares.map(([slug, label]) => `<a href="/compare/${slug}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${label}</a>`).join('')}</div></section>` : ''}
${emailForm()}`;
  return html(c, layout({
    title: `${a.name} vs ${b.name} — Which Name Is More Popular? | ${SITE}`,
    desc: `Head-to-head popularity chart: ${a.name} (${fmt(a.total)} babies) vs ${b.name} (${fmt(b.total)} babies), 1880–${END_YEAR}.`,
    path: `/compare/${a.slug}-vs-${b.slug}`,
    ogImage: `${ORIGIN}/og/compare/${a.slug}-vs-${b.slug}.png`,
    body,
  }));
});

app.get('/og/compare/:file', async c => {
  const mth = c.req.param('file').toLowerCase().match(/^([a-z'-]{1,40})-vs-([a-z'-]{1,40})\.png$/);
  if (!mth || mth[1] === mth[2]) return c.notFound();
  const [a, b] = await Promise.all([getName(c.env.DB, mth[1]), getName(c.env.DB, mth[2])]);
  if (!a || !b) return c.notFound();
  const res = await ogCompare(c, a, b);
  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res;
});
app.get('/compare', async c => {
  const a = slugify(c.req.query('a')), b = slugify(c.req.query('b'));
  if (a && b) return c.redirect(`/compare/${a}-vs-${b}`);
  const top = await c.env.DB.prepare('SELECT name FROM year_ranks WHERE year=? AND rank<=6 ORDER BY sex, rank').bind(END_YEAR).all();
  const girls = top.results.slice(0, 6).map(r => r.name), boys = top.results.slice(6).map(r => r.name);
  const pair = (x, y) => { const p = [x.toLowerCase(), y.toLowerCase()].sort(); return `${p[0]}-vs-${p[1]}`; };
  const examples = [];
  for (let i = 0; i + 1 < girls.length; i += 2) examples.push([girls[i], girls[i + 1]]);
  for (let i = 0; i + 1 < boys.length; i += 2) examples.push([boys[i], boys[i + 1]]);
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold tracking-tight">Compare two names</h1>
<p class="mt-2 text-slate-600">Put any two names head-to-head on one 146-year popularity chart — see who leads, when the lead changed, and how they rank today.</p>
<form action="/compare" method="get" class="mt-6 flex flex-col sm:flex-row gap-2 max-w-lg">
  <input name="a" required placeholder="First name" class="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm bg-white">
  <input name="b" required placeholder="Second name" class="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm bg-white">
  <button class="rounded-full bg-indigo-600 text-white px-5 py-2 text-sm font-semibold hover:bg-indigo-700">Compare</button>
</form>
<section class="mt-8"><h2 class="font-bold text-lg mb-2">Popular matchups (${END_YEAR} top names)</h2><div class="flex flex-wrap gap-2 text-sm">${examples.map(([x, y]) => `<a href="/compare/${pair(x, y)}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${esc(x)} vs ${esc(y)}</a>`).join('')}</div></section>
${emailForm()}`;
  return html(c, layout({
    title: `Compare Baby Names Head-to-Head, 1880–${END_YEAR} | ${SITE}`,
    desc: `Compare any two baby names on one chart: 146 years of official U.S. popularity data, head-to-head.`,
    path: '/compare', body,
  }));
});

// Edit-distance ≤2 suggestions for misspelled searches, over a popularity-capped candidate set.
function editDist(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

async function fuzzyMatches(db, slug, maxDist = 2) {
  const rows = await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
      WHERE length(slug) BETWEEN ? AND ? ORDER BY total DESC LIMIT 3000`)
    .bind(slug.length - maxDist, slug.length + maxDist).all();
  return rows.results
    .map(r => ({ r, d: editDist(slug, r.slug) }))
    .filter(x => x.d <= maxDist)
    .sort((a, b) => a.d - b.d || b.r.total - a.r.total)
    .slice(0, 8)
    .map(x => x.r);
}

// ---------- search ----------
app.get('/search', async c => {
  const db = c.env.DB;
  const q = (c.req.query('q') || '').trim().slice(0, 60);
  const slug = slugify(q);
  // list=1 keeps the user on the prefix-match list instead of jumping to an exact match.
  if (slug && c.req.query('list') !== '1') {
    const exact = await getName(db, slug);
    // The #from-search fragment lets the name page offer a way back to the full match list.
    if (exact) return c.redirect(`/name/${slug}#from-search`);
  }
  const sort = c.req.query('sort') === 'vintage' ? 'vintage' : 'popular';
  const orderBy = sort === 'vintage' ? 'peak_year ASC, total DESC' : 'total DESC';
  const like = slug
    ? await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names WHERE ${prefixWhere}${sort === 'vintage' ? ' AND total >= 500' : ''} ORDER BY ${orderBy} LIMIT 24`).bind(slug).all()
    : { results: [] };
  let didYouMean = [];
  if (!like.results.length && slug.length >= 3) didYouMean = await fuzzyMatches(db, slug);
  let letterPicks = [];
  if (!like.results.length && !didYouMean.length && /^[a-z]/.test(slug)) {
    letterPicks = (await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names WHERE slug LIKE ? ORDER BY total DESC LIMIT 8`).bind(slug[0] + '%').all()).results;
  }
  if (slug && !skipAnalytics(c)) {
    // Aggregate query counts (no user identifiers) to drive search-term analysis.
    c.executionCtx.waitUntil(db.prepare(
      'INSERT INTO searches (day, q, results) VALUES (?, ?, ?) ON CONFLICT(day, q) DO UPDATE SET count = count + 1'
    ).bind(new Date().toISOString().slice(0, 10), slug, like.results.length).run().catch(() => {}));
  }
  const body = `
<h1 class="text-2xl font-bold">Search results for “${esc(q)}”</h1>
${like.results.length
    ? `<div class="mt-4 flex flex-wrap gap-2 text-sm" role="group" aria-label="Sort results">${[['popular', 'Most popular'], ['vintage', 'Vintage first']].map(([v, t]) => v === sort ? `<span class="px-3 py-1.5 rounded-full bg-indigo-600 text-white font-medium" aria-current="true">${t}</span>` : `<a href="/search?q=${encodeURIComponent(q)}&list=1${v === 'vintage' ? '&sort=vintage' : ''}" class="px-3 py-1.5 rounded-full bg-white border border-slate-300 text-slate-700 hover:border-indigo-400">${t}</a>`).join('')}</div><div class="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${like.results.map(nameCard).join('')}</div>`
    : `<p class="mt-4 text-slate-600">No names found. The data only includes names given to 5+ babies in a single year.</p>${didYouMean.length ? `<h2 class="mt-6 font-bold">Did you mean…</h2><div class="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${didYouMean.map(nameCard).join('')}</div>` : ''}${letterPicks.length ? `<h2 class="mt-6 font-bold">Popular “${slug[0].toUpperCase()}” names to explore</h2><div class="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${letterPicks.map(nameCard).join('')}</div><p class="mt-3 text-sm"><a href="/letter/${slug[0]}" class="text-indigo-600 hover:underline">See all names starting with ${slug[0].toUpperCase()} →</a></p>` : ''}<div class="mt-8 flex flex-wrap gap-2 text-sm"><a href="/generator" class="rounded-full bg-indigo-600 text-white px-4 py-2 font-semibold hover:bg-indigo-700">Get ideas from the generator →</a><a href="/browse" class="rounded-full bg-white border border-slate-300 px-4 py-2 text-slate-700 hover:border-indigo-400">Browse by letter, year or state</a></div>`}
${emailForm()}`;
  return htmlPrivate(c, layout({ title: `“${q}” — name search | ${SITE}`, desc: `Search results for ${q}`, path: '/search', noindex: true, body }));
});

// ---------- top lists ----------
async function topPage(c, sex, label) {
  const db = c.env.DB;
  const rows = await db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 1000').bind(END_YEAR, sex).all();
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Top 1000 ${label} names (${END_YEAR})</h1>
<p class="mt-2 text-slate-600">Official ${END_YEAR} U.S. birth data. Click any name for its full 146-year chart.</p>
<div class="mt-6 rounded-2xl bg-white border border-slate-200 p-4">${rankTable(rows.results, { columns: true })}</div>
${emailForm()}`;
  return html(c, layout({
    title: `Top 1000 ${cap(label)} Names ${END_YEAR} — Official Rankings | ${SITE}`,
    desc: `The 1000 most popular ${label} names of ${END_YEAR} from official U.S. birth records, with full popularity charts for each.`,
    path: `/top/${label}s`, body,
    jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: `Top ${label} names ${END_YEAR}`, itemListElement: rows.results.slice(0, 100).map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: `${ORIGIN}/name/${r.name.toLowerCase()}` })) },
  }));
}
app.get('/top/girls', c => topPage(c, 'F', 'girl'));
app.get('/top/boys', c => topPage(c, 'M', 'boy'));

// ---------- unisex ----------
app.get('/unisex', async c => {
  const db = c.env.DB;
  const rows = await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
    WHERE f_total > 0 AND m_total > 0 AND MIN(f_total, m_total) * 1.0 / total > 0.25
    ORDER BY total DESC LIMIT 100`).all();
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">100 truly unisex names</h1>
<p class="mt-2 text-slate-600">Names where at least 25% of babies are each gender, ranked by all-time popularity.</p>
<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${rows.results.map(nameCard).join('')}</div>
${emailForm()}`;
  return html(c, layout({
    title: `100 Truly Unisex Baby Names, Ranked by Data | ${SITE}`,
    desc: 'Genuinely gender-neutral names — at least 25% girls and 25% boys — ranked by 146 years of U.S. birth data.',
    path: '/unisex', body,
    jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Truly unisex baby names', itemListElement: rows.results.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: `${ORIGIN}/name/${r.slug}` })) },
  }));
});

// ---------- trending ----------
app.get('/trending', async c => {
  const db = c.env.DB;
  const [nowRows, prevRows] = await Promise.all([
    db.prepare('SELECT * FROM year_ranks WHERE year=? ORDER BY rank').bind(END_YEAR).all(),
    db.prepare('SELECT * FROM year_ranks WHERE year=? ORDER BY rank').bind(END_YEAR - 5).all(),
  ]);
  const prev = new Map(prevRows.results.map(r => [r.sex + '|' + r.name, r.rank]));
  const moves = nowRows.results.map(r => {
    const p = prev.get(r.sex + '|' + r.name);
    return { ...r, delta: p ? p - r.rank : null };
  }).filter(r => r.delta !== null);
  const rising = moves.filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 30);
  const falling = moves.filter(r => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 30);
  const list = rows => `<ol class="divide-y divide-slate-100">${rows.map(r => `<li><a href="/name/${r.name.toLowerCase()}" class="flex items-center gap-3 px-2 py-2.5 hover:bg-indigo-50 rounded-lg">
    <span class="text-sm font-semibold tabular-nums ${r.delta > 0 ? 'text-emerald-700' : 'text-rose-700'} w-14">${r.delta > 0 ? '▲ +' + r.delta : '▼ ' + r.delta}</span>
    <span class="font-medium flex-1">${esc(r.name)}</span>
    <span class="text-xs text-slate-600">${r.sex === 'F' ? 'girl' : 'boy'} · now #${r.rank}</span>
  </a></li>`).join('')}</ol>`;
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Rising &amp; falling names</h1>
<p class="mt-2 text-slate-600">Biggest rank moves in the top 1000 between ${END_YEAR - 5} and ${END_YEAR}.</p>
<div class="mt-6 grid md:grid-cols-2 gap-6">
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2 text-emerald-700">📈 Fastest rising</h2>${list(rising)}</div>
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2 text-rose-700">📉 Fastest falling</h2>${list(falling)}</div>
</div>
${emailForm()}`;
  return html(c, layout({
    title: `Rising & Falling Baby Names (${END_YEAR - 5}–${END_YEAR}) | ${SITE}`,
    desc: `The fastest rising and fastest falling baby names in the U.S. top 1000, ${END_YEAR - 5} to ${END_YEAR}.`,
    path: '/trending', body,
    jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: `Fastest rising baby names ${END_YEAR - 5}–${END_YEAR}`, itemListElement: rising.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: `${ORIGIN}/name/${r.name.toLowerCase()}` })) },
  }));
});

// ---------- letter ----------
app.get('/letter/:l', async c => {
  const db = c.env.DB;
  const l = slugify(c.req.param('l'));
  if (!/^[a-z]$/.test(l)) return c.notFound();
  if (l !== c.req.param('l')) return c.redirect(`/letter/${l}`, 301);
  const [rows, stats] = await Promise.all([
    db.prepare('SELECT slug,name,total,f_total,m_total,first_year FROM names WHERE slug LIKE ? ORDER BY total DESC LIMIT 200').bind(l + '%').all(),
    db.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN f_total > m_total THEN 1 ELSE 0 END) girls FROM names WHERE ${prefixWhere}`).bind(l).first(),
  ]);
  const topG = rows.results.find(r => r.f_total > r.m_total), topB = rows.results.find(r => r.m_total > r.f_total);
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Names starting with ${l.toUpperCase()}</h1>
<p class="mt-2 text-slate-600">${fmt(stats.n)} recorded U.S. names begin with ${l.toUpperCase()} — ${fmt(stats.girls)} mostly given to girls, ${fmt(stats.n - stats.girls)} to boys.${topG ? ` The all-time favorites: <a class="text-indigo-600 underline" href="/name/${topG.slug}">${esc(topG.name)}</a>${topB ? ` and <a class="text-indigo-600 underline" href="/name/${topB.slug}">${esc(topB.name)}</a>` : ''}.` : ''} Showing the top 200 by all-time popularity.</p>
<div class="mt-4 flex flex-wrap gap-1.5 text-sm">${'abcdefghijklmnopqrstuvwxyz'.split('').map(ch => `<a href="/letter/${ch}" class="w-8 h-8 grid place-items-center rounded-lg ${ch === l ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 hover:border-indigo-400'}">${ch.toUpperCase()}</a>`).join('')}</div>
<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${rows.results.map(nameCard).join('')}</div>
${emailForm()}`;
  return html(c, layout({ title: `Baby Names Starting With ${l.toUpperCase()} — Top 200 | ${SITE}`, desc: `The 200 most popular baby names starting with ${l.toUpperCase()}, ranked by 146 years of U.S. birth data.`, path: `/letter/${l}`, ogImage: `${ORIGIN}/og/letter/${l}.png`, body }));
});

app.get('/og/letter/:file', async c => {
  const mth = c.req.param('file').match(/^([a-z])\.png$/);
  if (!mth) return c.notFound();
  const l = mth[1];
  const rows = await c.env.DB.prepare('SELECT name FROM names WHERE slug >= ? AND slug < ? ORDER BY total DESC LIMIT 12').bind(l, String.fromCharCode(l.charCodeAt(0) + 1)).all();
  const res = await ogList(c, `Names Starting With ${l.toUpperCase()}`, rows.results.map(r => r.name));
  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res;
});

// ---------- year ----------
app.get('/year/:y', async c => {
  const db = c.env.DB;
  const y = Number(c.req.param('y'));
  if (!(y >= START_YEAR && y <= END_YEAR)) return c.notFound();
  const [g, b, prev] = await Promise.all([
    db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 100').bind(y, 'F').all(),
    db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 100').bind(y, 'M').all(),
    y > START_YEAR ? db.prepare('SELECT name, sex FROM year_ranks WHERE year=? AND rank<=100').bind(y - 1).all() : Promise.resolve({ results: [] }),
  ]);
  const prevSet = new Set(prev.results.map(r => r.sex + '|' + r.name));
  const entrants = [...g.results, ...b.results].filter(r => prev.results.length && !prevSet.has(r.sex + '|' + r.name));
  const nav = `<div class="flex gap-2 text-sm mt-2">${y > START_YEAR ? `<a class="text-indigo-600 hover:underline" href="/year/${y - 1}">← ${y - 1}</a>` : ''}${y < END_YEAR ? `<a class="text-indigo-600 hover:underline" href="/year/${y + 1}">${y + 1} →</a>` : ''}</div>`;
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Most popular names of ${y}</h1>${nav}
<div class="mt-6 grid md:grid-cols-2 gap-6">
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Girls</h2>${rankTable(g.results)}</div>
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Boys</h2>${rankTable(b.results)}</div>
</div>
${entrants.length ? `<section class="mt-8"><h2 class="font-bold text-lg mb-2">New to the top 100 in ${y}</h2><p class="text-sm text-slate-600 mb-3">Names that entered the top 100 this year after ranking below it in ${y - 1}.</p><div class="flex flex-wrap gap-2 text-sm">${entrants.map(r => `<a href="/name/${r.name.toLowerCase()}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${esc(r.name)} <span class="text-slate-600">#${r.rank} ${r.sex === 'F' ? 'girls' : 'boys'}</span></a>`).join('')}</div></section>` : ''}
${emailForm()}`;
  return html(c, layout({ title: `Top 100 Baby Names of ${y} (Girls & Boys) | ${SITE}`, desc: `The 100 most popular girl and boy names of ${y} from official U.S. birth records.`, path: `/year/${y}`, ogImage: `${ORIGIN}/og/year/${y}.png`, body, jsonld: {
    '@context': 'https://schema.org', '@type': 'ItemList', name: `Top Baby Names of ${y}`,
    itemListElement: [...g.results.slice(0, 10), ...b.results.slice(0, 10)].map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: `${ORIGIN}/name/${r.name.toLowerCase()}` })),
  } }));
});

// ---------- decade ----------
app.get('/decade/:d', async c => {
  const db = c.env.DB;
  const mth = c.req.param('d').match(/^(\d{4})s$/);
  if (!mth) return c.notFound();
  const d = Number(mth[1]);
  if (d % 10 !== 0 || d < 1880 || d > 2020) return c.notFound();
  const [g, b, peaked] = await Promise.all([
    db.prepare('SELECT * FROM decade_ranks WHERE decade=? AND sex=? ORDER BY rank LIMIT 100').bind(d, 'F').all(),
    db.prepare('SELECT * FROM decade_ranks WHERE decade=? AND sex=? ORDER BY rank LIMIT 100').bind(d, 'M').all(),
    db.prepare('SELECT slug,name,peak_year,peak_count FROM names WHERE peak_year BETWEEN ? AND ? ORDER BY peak_count DESC LIMIT 12').bind(d, d + 9).all(),
  ]);
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Most popular names of the ${d}s</h1>
<div class="mt-4 flex flex-wrap gap-1.5 text-sm">${Array.from({ length: 15 }, (_, i) => 1880 + i * 10).map(dd => `<a href="/decade/${dd}s" class="px-3 py-1.5 rounded-lg ${dd === d ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 hover:border-indigo-400'}">${dd}s</a>`).join('')}</div>
<div class="mt-6 grid md:grid-cols-2 gap-6">
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Girls</h2>${rankTable(g.results)}</div>
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Boys</h2>${rankTable(b.results)}</div>
</div>
${peaked.results.length ? `<section class="mt-8"><h2 class="font-bold text-lg mb-2">Names that peaked in the ${d}s</h2><p class="text-sm text-slate-600 mb-3">These names hit their all-time high during this decade — the sound of the era.</p><div class="flex flex-wrap gap-2 text-sm">${peaked.results.map(r => `<a href="/name/${r.slug}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${esc(r.name)} <span class="text-slate-600">peak ${r.peak_year}</span></a>`).join('')}</div></section>` : ''}
${emailForm()}`;
  return html(c, layout({ title: `Top 100 Baby Names of the ${d}s | ${SITE}`, desc: `The 100 most popular girl and boy names of the ${d}s, from official U.S. birth records.`, path: `/decade/${d}s`, ogImage: `${ORIGIN}/og/year/${d}s.png`, body, jsonld: {
    '@context': 'https://schema.org', '@type': 'ItemList', name: `Top Baby Names of the ${d}s`,
    itemListElement: [...g.results.slice(0, 10), ...b.results.slice(0, 10)].map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: `${ORIGIN}/name/${r.name.toLowerCase()}` })),
  } }));
});

// ---------- state ----------
app.get('/state/:st', async c => {
  const db = c.env.DB;
  let st = c.req.param('st').toUpperCase();
  if (!STATES[st]) {
    const full = Object.keys(STATES).find(k => STATES[k].toLowerCase().replace(/[^a-z]/g, '') === c.req.param('st').toLowerCase().replace(/[^a-z]/g, ''));
    if (full) return c.redirect(`/state/${full.toLowerCase()}`, 301);
    return c.notFound();
  }
  if (c.req.param('st') !== st.toLowerCase()) return c.redirect(`/state/${st.toLowerCase()}`, 301);
  const [g, b, nat] = await Promise.all([
    db.prepare('SELECT * FROM state_ranks WHERE state=? AND sex=? ORDER BY rank LIMIT 100').bind(st, 'F').all(),
    db.prepare('SELECT * FROM state_ranks WHERE state=? AND sex=? ORDER BY rank LIMIT 100').bind(st, 'M').all(),
    db.prepare('SELECT name, sex FROM year_ranks WHERE year=? AND rank<=100').bind(END_YEAR).all(),
  ]);
  const natSet = new Set(nat.results.map(r => r.sex + '|' + r.name));
  const local = [...g.results, ...b.results].filter(r => !natSet.has(r.sex + '|' + r.name)).sort((x, y) => x.rank - y.rank).slice(0, 12);
  const intro = g.results[0] && b.results[0]
    ? `<p class="mt-2 text-slate-600">${STATES[st]}'s favorites in ${END_YEAR}: <a class="text-indigo-600 underline" href="/name/${g.results[0].name.toLowerCase()}">${esc(g.results[0].name)}</a> for girls and <a class="text-indigo-600 underline" href="/name/${b.results[0].name.toLowerCase()}">${esc(b.results[0].name)}</a> for boys.</p>` : '';
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Most popular names in ${STATES[st]} (${END_YEAR})</h1>${intro}
<div class="mt-4 flex flex-wrap gap-1.5 text-xs">${Object.keys(STATES).map(s => `<a href="/state/${s.toLowerCase()}" class="px-2 py-1 rounded ${s === st ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 hover:border-indigo-400'}">${s}</a>`).join('')}</div>
<div class="mt-6 grid md:grid-cols-2 gap-6">
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Girls</h2>${rankTable(g.results)}</div>
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Boys</h2>${rankTable(b.results)}</div>
</div>
${local.length ? `<section class="mt-8"><h2 class="font-bold text-lg mb-2">Local favorites</h2><p class="text-sm text-slate-600 mb-3">In the ${STATES[st]} top 100 but outside the national top 100 in ${END_YEAR}.</p><div class="flex flex-wrap gap-2 text-sm">${local.map(r => `<a href="/name/${r.name.toLowerCase()}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${esc(r.name)} <span class="text-slate-600">#${r.rank} ${r.sex === 'F' ? 'girls' : 'boys'}</span></a>`).join('')}</div></section>` : ''}
${emailForm()}`;
  return html(c, layout({ title: `Top Baby Names in ${STATES[st]} ${END_YEAR} | ${SITE}`, desc: `The 100 most popular girl and boy names in ${STATES[st]} in ${END_YEAR}, from official state birth records.`, path: `/state/${st.toLowerCase()}`, ogImage: `${ORIGIN}/og/state/${st.toLowerCase()}.png`, body, jsonld: {
    '@context': 'https://schema.org', '@type': 'ItemList', name: `Top Baby Names in ${STATES[st]} (${END_YEAR})`,
    itemListElement: [...g.results.slice(0, 10), ...b.results.slice(0, 10)].map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: `${ORIGIN}/name/${r.name.toLowerCase()}` })),
  } }));
});

app.get('/og/state/:file', async c => {
  const mth = c.req.param('file').match(/^([a-z]{2})\.png$/);
  const st = mth && mth[1].toUpperCase();
  if (!st || !STATES[st]) return c.notFound();
  const rows = await c.env.DB.prepare('SELECT name FROM state_ranks WHERE state=? AND rank<=6 ORDER BY sex, rank').bind(st).all();
  const res = await ogList(c, `Top Names in ${STATES[st]}`, rows.results.map(r => r.name));
  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res;
});

// ---------- curated lists ----------
async function namesBySlugs(db, slugs) {
  if (!slugs.length) return [];
  const bySlug = new Map();
  for (let i = 0; i < slugs.length; i += 90) { // D1 caps bound params at 100 per statement
    const chunk = slugs.slice(i, i + 90);
    const rows = await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year,peak_year FROM names
        WHERE slug IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all();
    for (const r of rows.results) bySlug.set(r.slug, r);
  }
  return slugs.map(s => bySlug.get(s)).filter(Boolean);
}

// Rank-driven lists are computed from year_ranks (indexed by year) plus a slug
// lookup, because unindexed name joins exceed the Worker D1 scan budget.
async function rankList(db, sex, opts) {
  const now = await db.prepare('SELECT name, rank FROM year_ranks WHERE year=? AND sex=? ORDER BY rank').bind(END_YEAR, sex).all();
  let candidates = now.results;
  if (opts.alsoTopIn) {
    const past = await db.prepare('SELECT name FROM year_ranks WHERE year=? AND sex=? AND rank<=?').bind(opts.alsoTopIn.year, sex, opts.alsoTopIn.rank).all();
    const pastSet = new Set(past.results.map(r => r.name));
    candidates = candidates.filter(r => r.rank <= opts.alsoTopIn.rank && pastSet.has(r.name));
  }
  if (opts.maxRank) candidates = candidates.filter(r => r.rank <= opts.maxRank);
  let rows = await namesBySlugs(db, candidates.map(r => r.name.toLowerCase()));
  if (opts.peakBefore) rows = rows.filter(r => r.peak_year < opts.peakBefore);
  if (opts.primary) rows = rows.filter(r => (opts.primary === 'F' ? r.f_total > r.m_total : r.m_total > r.f_total));
  return rows.slice(0, 40);
}

const LISTS = {
  'vintage-girl-names': {
    title: 'Vintage Girl Names Making a Comeback',
    desc: 'Girl names that peaked before 1940 and are back in the current U.S. top 500 — antique charm with modern momentum.',
    intro: 'These girl names peaked before 1940, faded, and are back in the current U.S. top 500.',
    rows: db => rankList(db, 'F', { maxRank: 500, peakBefore: 1940, primary: 'F' }),
  },
  'vintage-boy-names': {
    title: 'Vintage Boy Names Making a Comeback',
    desc: 'Boy names that peaked before 1940 and are back in the current top 500.',
    intro: 'These boy names peaked before 1940 and are back in the current U.S. top 500.',
    rows: db => rankList(db, 'M', { maxRank: 500, peakBefore: 1940, primary: 'M' }),
  },
  'timeless-girl-names': {
    title: 'Timeless Girl Names',
    desc: 'Girl names in the U.S. top 300 both 100 years ago and today — proven for over a century.',
    intro: `These girl names ranked in the top 300 in both ${END_YEAR - 100} and ${END_YEAR} — a full century of staying power.`,
    rows: db => rankList(db, 'F', { alsoTopIn: { year: END_YEAR - 100, rank: 300 } }),
  },
  'timeless-boy-names': {
    title: 'Timeless Boy Names',
    desc: 'Boy names in the U.S. top 300 both 100 years ago and today.',
    intro: `These boy names ranked in the top 300 in both ${END_YEAR - 100} and ${END_YEAR} — a full century of staying power.`,
    rows: db => rankList(db, 'M', { alsoTopIn: { year: END_YEAR - 100, rank: 300 } }),
  },
  'new-girl-names': {
    title: 'Modern Girl Names (First Recorded Since 1990)',
    desc: 'Girl names that first appeared in U.S. records after 1990 and took off.',
    intro: 'The most popular girl names that first entered U.S. records after 1990.',
    rows: db => db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
          WHERE first_year >= 1990 AND f_total > m_total ORDER BY total DESC LIMIT 40`).all().then(r => r.results),
  },
  'new-boy-names': {
    title: 'Modern Boy Names (First Recorded Since 1990)',
    desc: 'Boy names that first appeared in U.S. records after 1990 and took off.',
    intro: 'The most popular boy names that first entered U.S. records after 1990.',
    rows: db => db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
          WHERE first_year >= 1990 AND m_total > f_total ORDER BY total DESC LIMIT 40`).all().then(r => r.results),
  },
  'short-girl-names': {
    title: 'Short Girl Names (4 Letters or Fewer)',
    desc: 'The most popular short girl names in U.S. history — 4 letters or fewer, big impact.',
    intro: 'The most-given girl names with 4 letters or fewer, ranked by all-time U.S. births.',
    rows: db => db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
          WHERE LENGTH(name) <= 4 AND f_total > m_total ORDER BY total DESC LIMIT 40`).all().then(r => r.results),
  },
  'short-boy-names': {
    title: 'Short Boy Names (4 Letters or Fewer)',
    desc: 'The most popular short boy names in U.S. history — 4 letters or fewer.',
    intro: 'The most-given boy names with 4 letters or fewer, ranked by all-time U.S. births.',
    rows: db => db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
          WHERE LENGTH(name) <= 4 AND m_total > f_total ORDER BY total DESC LIMIT 40`).all().then(r => r.results),
  },
  'long-girl-names': {
    title: 'Long & Elegant Girl Names (9+ Letters)',
    desc: 'Popular long girl names with 9 or more letters — elegant, formal, nickname-rich.',
    intro: 'The most-given girl names with 9 or more letters, ranked by all-time U.S. births.',
    rows: db => db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
          WHERE LENGTH(name) >= 9 AND f_total > m_total ORDER BY total DESC LIMIT 40`).all().then(r => r.results),
  },
  'long-boy-names': {
    title: 'Long & Distinguished Boy Names (9+ Letters)',
    desc: 'Popular long boy names with 9 or more letters — classic, formal, nickname-rich.',
    intro: 'The most-given boy names with 9 or more letters, ranked by all-time U.S. births.',
    rows: db => db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
          WHERE LENGTH(name) >= 9 AND m_total > f_total ORDER BY total DESC LIMIT 40`).all().then(r => r.results),
  },
  'nature-girl-names': {
    title: 'Nature Girl Names with Documented Meanings',
    desc: 'Girl names whose documented etymology ties to nature — flowers, rivers, forests, mountains and wildlife.',
    intro: 'Girl names with a documented etymological link to the natural world, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, NATURE_WORDS, 'F'),
  },
  'nature-boy-names': {
    title: 'Nature Boy Names with Documented Meanings',
    desc: 'Boy names whose documented etymology ties to nature — rivers, forests, mountains and wildlife.',
    intro: 'Boy names with a documented etymological link to the natural world, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, NATURE_WORDS, 'M'),
  },
  'celestial-girl-names': {
    title: 'Celestial Girl Names — Moon, Star & Sky Meanings',
    desc: 'Girl names whose documented etymology relates to the moon, stars, sky, light or dawn.',
    intro: 'Girl names with a documented etymological link to the heavens — moon, stars, sky, light and dawn.',
    rows: db => meaningGroupList(db, CELESTIAL_WORDS, 'F'),
  },
  'celestial-boy-names': {
    title: 'Celestial Boy Names — Star, Sky & Light Meanings',
    desc: 'Boy names whose documented etymology relates to the moon, stars, sky, light or dawn.',
    intro: 'Boy names with a documented etymological link to the heavens — moon, stars, sky, light and dawn.',
    rows: db => meaningGroupList(db, CELESTIAL_WORDS, 'M'),
  },
  'royal-girl-names': {
    title: 'Royal Girl Names — Queen, Ruler & Noble Meanings',
    desc: 'Girl names whose documented etymology relates to royalty — queens, rulers, crowns and nobility.',
    intro: 'Girl names with a documented etymological link to royalty and nobility, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, ROYAL_WORDS, 'F'),
  },
  'royal-boy-names': {
    title: 'Royal Boy Names — King, Ruler & Noble Meanings',
    desc: 'Boy names whose documented etymology relates to royalty — kings, rulers, crowns and nobility.',
    intro: 'Boy names with a documented etymological link to royalty and nobility, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, ROYAL_WORDS, 'M'),
  },
  'virtue-girl-names': {
    title: 'Virtue Girl Names — Grace, Joy & Honor Meanings',
    desc: 'Girl names whose documented etymology relates to virtues — grace, joy, peace, honor and courage.',
    intro: 'Girl names with a documented etymological link to a virtue, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, VIRTUE_WORDS, 'F'),
  },
  'virtue-boy-names': {
    title: 'Virtue Boy Names — Honor, Courage & Peace Meanings',
    desc: 'Boy names whose documented etymology relates to virtues — honor, courage, peace, wisdom and strength.',
    intro: 'Boy names with a documented etymological link to a virtue, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, VIRTUE_WORDS, 'M'),
  },
  'warrior-girl-names': {
    title: 'Warrior Girl Names — Battle & Protector Meanings',
    desc: 'Girl names whose documented etymology relates to warriors, battle, protectors and defenders.',
    intro: 'Girl names with a documented etymological link to warriors, battle and protection, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, WARRIOR_WORDS, 'F'),
  },
  'warrior-boy-names': {
    title: 'Warrior Boy Names — Battle & Protector Meanings',
    desc: 'Boy names whose documented etymology relates to warriors, battle, protectors and defenders.',
    intro: 'Boy names with a documented etymological link to warriors, battle and protection, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, WARRIOR_WORDS, 'M'),
  },
  'divine-girl-names': {
    title: 'Divine Girl Names — God & Goddess Meanings',
    desc: 'Girl names whose documented etymology relates to God, goddesses or the divine.',
    intro: 'Girl names with a documented etymological link to God, a goddess or the divine, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, DIVINE_WORDS, 'F'),
  },
  'divine-boy-names': {
    title: 'Divine Boy Names — God & Divine Meanings',
    desc: 'Boy names whose documented etymology relates to God or the divine.',
    intro: 'Boy names with a documented etymological link to God or the divine, ranked by all-time U.S. births.',
    rows: db => meaningGroupList(db, DIVINE_WORDS, 'M'),
  },
};

const NATURE_WORDS = ['flower', 'rose', 'river', 'forest', 'meadow', 'valley', 'mountain', 'sea', 'earth', 'bird', 'deer', 'wolf', 'bear', 'lion', 'spring', 'stone', 'water'];
const CELESTIAL_WORDS = ['moon', 'star', 'sky', 'light', 'dawn', 'heaven'];
const ROYAL_WORDS = ['king', 'queen', 'prince', 'ruler', 'crown', 'noble'];
const VIRTUE_WORDS = ['grace', 'joy', 'peace', 'honor', 'brave', 'strong', 'pure', 'gracious', 'glory', 'victory'];
const WARRIOR_WORDS = ['warrior', 'battle', 'protector', 'defender', 'army', 'war'];
const DIVINE_WORDS = ['god', 'goddess', 'divine'];

// Astronomy/usage asides (e.g. "(moon of Uranus)", "The moon is named for the character")
// mention a word without the name actually meaning it — strip them before matching.
const stripUsageNotes = e => (e || '').replace(/\(moons? of [^)]+\)/gi, '').replace(/[^.;*]*\bmoons?\s+(?:is|are|was|were)\s+named[^.;*]*/gi, '');

// Names whose documented etymology matches any of the group's words (word-boundary checked in JS).
async function meaningGroupList(db, words, sex) {
  const cand = await db.prepare(`SELECT m.slug, m.etymology, n.name, n.total, n.f_total, n.m_total, n.first_year
      FROM meanings m JOIN names n ON n.slug = m.slug
      WHERE (${words.map(() => 'm.etymology LIKE ?').join(' OR ')}) ORDER BY n.total DESC LIMIT 500`)
    .bind(...words.map(w => `%${w}%`)).all();
  const res = words.map(w => new RegExp(`\\b${w}\\b`, 'i'));
  return cand.results
    .filter(r => { const e = stripUsageNotes(r.etymology); return res.some(re => re.test(e)); })
    .filter(r => (sex === 'F' ? r.f_total > r.m_total : r.m_total > r.f_total))
    .slice(0, 40);
}

app.get('/list/:slug', async c => {
  const def = LISTS[c.req.param('slug')];
  if (!def) return c.notFound();
  const results = await def.rows(c.env.DB);
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">${def.title}</h1>
<p class="mt-2 text-slate-600 max-w-2xl">${def.intro}</p>
<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${results.map(nameCard).join('')}</div>
<section class="mt-10"><h2 class="font-bold mb-2">More lists</h2><div class="flex flex-wrap gap-2 text-sm">${Object.entries(LISTS).filter(([s]) => s !== c.req.param('slug')).map(([s, d]) => `<a href="/list/${s}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${d.title}</a>`).join('')}</div></section>
${emailForm()}`;
  return html(c, layout({ title: `${def.title} | ${SITE}`, desc: def.desc, path: `/list/${c.req.param('slug')}`, ogImage: `${ORIGIN}/og/list/${c.req.param('slug')}.png`, body, jsonld: {
    '@context': 'https://schema.org', '@type': 'ItemList', name: def.title, description: def.desc,
    itemListElement: results.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: `${ORIGIN}/name/${r.slug}` })),
  } }));
});

// OG cards for year and decade pages (share card: top names of the year/decade).
app.get('/og/year/:file', async c => {
  const mth = c.req.param('file').match(/^(\d{4})(s?)\.png$/);
  if (!mth) return c.notFound();
  const n = Number(mth[1]);
  const isDecade = mth[2] === 's';
  if (isDecade ? (n % 10 !== 0 || n < 1880 || n > 2020) : (n < START_YEAR || n > END_YEAR)) return c.notFound();
  const rows = await c.env.DB.prepare(isDecade
    ? 'SELECT name FROM decade_ranks WHERE decade=? AND rank<=6 ORDER BY sex, rank'
    : 'SELECT name FROM year_ranks WHERE year=? AND rank<=6 ORDER BY sex, rank').bind(n).all();
  const res = await ogList(c, `Top Names of ${isDecade ? `the ${n}s` : n}`, rows.results.map(r => r.name));
  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res;
});

// ---------- name generator ----------
app.get('/generator', async c => {
  const db = c.env.DB;
  const sexQ = c.req.query('sex') === 'boy' ? 'M' : c.req.query('sex') === 'girl' ? 'F' : null;
  const letter = /^[a-z]$/.test(slugify(c.req.query('letter'))) ? slugify(c.req.query('letter')) : null;
  const style = ['popular', 'vintage', 'uncommon'].includes(c.req.query('style')) ? c.req.query('style') : 'popular';
  const mean = MEANING_WORDS.includes(c.req.query('mean')) ? c.req.query('mean') : null;
  const ends = /^[a-z]{1,4}$/.test((c.req.query('ends') || '').toLowerCase()) ? c.req.query('ends').toLowerCase() : null;
  const has = /^[a-z]{2,8}$/.test((c.req.query('has') || '').toLowerCase()) ? c.req.query('has').toLowerCase() : null;
  const hasQuery = sexQ || letter || c.req.query('style') || mean || ends || has;
  let results = [];
  if (hasQuery) {
    let slugs;
    if (mean) {
      // Meaning names are often outside the current top ranks, so draw from the whole
      // meanings table instead of the rank-capped pool.
      const cand = await db.prepare(`SELECT m.slug, m.etymology, n.f_total, n.m_total FROM meanings m
          JOIN names n ON n.slug = m.slug WHERE m.etymology LIKE ? ORDER BY n.total DESC LIMIT 400`).bind(`%${mean}%`).all();
      const re = new RegExp(`\\b${mean}\\b`, 'i');
      slugs = cand.results
        .filter(r => re.test(r.etymology))
        .filter(r => !sexQ || (sexQ === 'F' ? r.f_total > r.m_total : r.m_total > r.f_total))
        .map(r => r.slug);
      if (letter) slugs = slugs.filter(s => s.startsWith(letter));
      if (ends) slugs = slugs.filter(s => s.endsWith(ends));
      if (has) slugs = slugs.filter(s => s.includes(has));
    } else {
      const rankCap = style === 'popular' ? 200 : style === 'vintage' ? 500 : 1000;
      const yr = style === 'vintage' ? END_YEAR - 100 : END_YEAR;
      const sexes = sexQ ? [sexQ] : ['F', 'M'];
      const cands = [];
      for (const s of sexes) {
        const rows = await db.prepare('SELECT name, rank FROM year_ranks WHERE year=? AND sex=? AND rank<=? ORDER BY rank').bind(yr, s, rankCap).all();
        cands.push(...rows.results.map(r => r.name));
      }
      slugs = [...new Set(cands.map(n => n.toLowerCase()))];
      if (letter) slugs = slugs.filter(s => s.startsWith(letter));
      if (ends) slugs = slugs.filter(s => s.endsWith(ends));
      if (has) slugs = slugs.filter(s => s.includes(has));
      if (style === 'uncommon') slugs = slugs.slice(Math.floor(slugs.length / 2));
    }
    // Fisher-Yates shuffle for a fresh set on every visit
    for (let i = slugs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [slugs[i], slugs[j]] = [slugs[j], slugs[i]]; }
    results = await namesBySlugs(db, slugs.slice(0, 12));
  }
  const sel = (v, cur) => v === cur ? ' checked' : '';
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Baby Name Generator</h1>
<p class="mt-2 text-slate-600 max-w-2xl">Pick a style and get 12 real names drawn from 146 years of U.S. birth data — hit generate again for a fresh batch.</p>
<form method="get" action="/generator" class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 space-y-4">
  <fieldset><legend class="font-semibold text-sm mb-1.5">Gender</legend>
    <div class="flex flex-wrap gap-2 text-sm">
      <label class="px-3 py-1.5 rounded-full border border-slate-300 has-checked:bg-indigo-600 has-checked:text-white has-checked:border-indigo-600 cursor-pointer"><input class="sr-only" type="radio" name="sex" value=""${sel('', c.req.query('sex') || '')}>Any</label>
      <label class="px-3 py-1.5 rounded-full border border-slate-300 has-checked:bg-indigo-600 has-checked:text-white has-checked:border-indigo-600 cursor-pointer"><input class="sr-only" type="radio" name="sex" value="girl"${sel('girl', c.req.query('sex'))}>Girl</label>
      <label class="px-3 py-1.5 rounded-full border border-slate-300 has-checked:bg-indigo-600 has-checked:text-white has-checked:border-indigo-600 cursor-pointer"><input class="sr-only" type="radio" name="sex" value="boy"${sel('boy', c.req.query('sex'))}>Boy</label>
    </div></fieldset>
  <fieldset><legend class="font-semibold text-sm mb-1.5">Style</legend>
    <div class="flex flex-wrap gap-2 text-sm">
      <label class="px-3 py-1.5 rounded-full border border-slate-300 has-checked:bg-indigo-600 has-checked:text-white has-checked:border-indigo-600 cursor-pointer"><input class="sr-only" type="radio" name="style" value="popular"${sel('popular', style)}>Popular now</label>
      <label class="px-3 py-1.5 rounded-full border border-slate-300 has-checked:bg-indigo-600 has-checked:text-white has-checked:border-indigo-600 cursor-pointer"><input class="sr-only" type="radio" name="style" value="vintage"${sel('vintage', style)}>Vintage (top ${END_YEAR - 100})</label>
      <label class="px-3 py-1.5 rounded-full border border-slate-300 has-checked:bg-indigo-600 has-checked:text-white has-checked:border-indigo-600 cursor-pointer"><input class="sr-only" type="radio" name="style" value="uncommon"${sel('uncommon', style)}>Less common</label>
    </div></fieldset>
  <div class="flex flex-wrap items-center gap-3">
    <label class="text-sm font-semibold" for="gen-letter">Starts with</label>
    <select id="gen-letter" name="letter" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white">
      <option value="">Any letter</option>
      ${'abcdefghijklmnopqrstuvwxyz'.split('').map(ch => `<option value="${ch}"${ch === letter ? ' selected' : ''}>${ch.toUpperCase()}</option>`).join('')}
    </select>
    <label class="text-sm font-semibold" for="gen-mean">Meaning</label>
    <select id="gen-mean" name="mean" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white">
      <option value="">Any meaning</option>
      ${[...MEANING_WORDS].sort().map(w => `<option value="${w}"${w === mean ? ' selected' : ''}>${cap(w)}</option>`).join('')}
    </select>
  </div>
  <div class="flex flex-wrap items-center gap-3">
    <label class="text-sm font-semibold" for="gen-ends">Ends with</label>
    <input id="gen-ends" name="ends" value="${esc(ends || '')}" maxlength="4" pattern="[A-Za-z]{1,4}" placeholder="e.g. a" class="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white">
    <label class="text-sm font-semibold" for="gen-has">Contains</label>
    <input id="gen-has" name="has" value="${esc(has || '')}" maxlength="8" pattern="[A-Za-z]{2,8}" placeholder="e.g. ell" class="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white">
    <button class="rounded-full bg-indigo-600 text-white px-6 py-2 text-sm font-semibold hover:bg-indigo-700">Generate names</button>
  </div>
</form>
${results.length ? `<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${results.map(nameCard).join('')}</div>` : hasQuery ? '<p class="mt-6 text-slate-600">No matches — try a different letter or style.</p>' : `<div class="mt-6"><p class="text-sm font-semibold text-slate-700">Not sure where to start? Try one of these:</p><div class="mt-2 flex flex-wrap gap-2 text-sm">${[['?sex=girl&style=vintage', 'Vintage girl names'], ['?sex=boy&letter=a', 'Boy names starting with A'], ['?mean=moon', 'Names that mean “moon”'], ['?sex=girl&style=uncommon', 'Less common girl names']].map(([q, t]) => `<a href="/generator${q}" class="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 hover:border-indigo-400">${t}</a>`).join('')}</div></div>`}
${emailForm()}`;
  return htmlPrivate(c, layout({ title: `Baby Name Generator — Real Names from Real Data | ${SITE}`, desc: 'Generate baby name ideas by gender, style and first letter, drawn from 146 years of U.S. SSA data. No ads, open in Beta.', path: '/generator', body }));
});

// ---------- sibling & middle name matcher ----------
app.get('/matcher', async c => {
  const db = c.env.DB;
  const inputsRaw = (c.req.queries('names') || []).join(',').toLowerCase();
  const inputs = [...new Set(inputsRaw.split(',').map(s => slugify(s.trim())).filter(s => s.length >= 2 && s.length <= 40))].slice(0, 3);
  const rows = inputs.length ? await namesBySlugs(db, inputs) : [];
  const missing = inputs.filter(s => !rows.some(r => r.slug === s));
  let sibs = null, mids = null;
  if (rows.length) {
    const avgPeak = Math.round(rows.reduce((a, r) => a + r.peak_year, 0) / rows.length);
    const totals = rows.map(r => r.total).sort((a, b) => a - b);
    const med = totals[Math.floor(totals.length / 2)];
    const firsts = new Set(rows.map(r => r.slug[0]));
    const tails = new Set(rows.map(r => r.slug.slice(-2)));
    const cand = await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
        WHERE peak_year BETWEEN ? AND ? AND total BETWEEN ? AND ? AND slug NOT IN (${rows.map(() => '?').join(',')})
        ORDER BY ABS(total - ?) LIMIT 200`)
      .bind(avgPeak - 10, avgPeak + 10, Math.round(totals[0] * 0.3), Math.round(totals[totals.length - 1] * 3), ...rows.map(r => r.slug), med).all();
    const picks = cand.results.filter(s => !firsts.has(s.slug[0]) && !tails.has(s.slug.slice(-2)));
    sibs = { girls: picks.filter(s => s.f_total > s.m_total).slice(0, 8), boys: picks.filter(s => s.m_total > s.f_total).slice(0, 8) };
    const first = rows[0];
    const wantShort = first.name.length >= 6;
    const midCand = await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names
        WHERE first_year <= 1900 AND length(name) ${wantShort ? 'BETWEEN 3 AND 5' : 'BETWEEN 6 AND 9'} AND slug != ? ORDER BY total DESC LIMIT 120`)
      .bind(first.slug).all();
    const mpicks = midCand.results.filter(s => s.slug[0] !== first.slug[0] && s.slug.slice(-2) !== first.slug.slice(-2));
    const firstIsGirl = first.f_total > first.m_total;
    mids = {
      first,
      girls: firstIsGirl ? mpicks.filter(s => s.f_total > s.m_total).slice(0, 12) : [],
      boys: firstIsGirl ? [] : mpicks.filter(s => s.m_total > s.f_total).slice(0, 12),
    };
  }
  const val = i => { const s = inputs[i]; if (!s) return ''; const r = rows.find(x => x.slug === s); return esc(r ? r.name : cap(s)); };
  const group = (title, arr) => arr.length ? `<div><h3 class="font-semibold text-sm text-slate-600 mb-2">${title}</h3><div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${arr.map(nameCard).join('')}</div></div>` : '';
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Sibling &amp; Middle Name Matcher</h1>
<p class="mt-2 text-slate-600 max-w-2xl">Enter the names you already love (or already have) and get sibling names from the same era and popularity tier, plus middle names that flow — all drawn from 146 years of U.S. birth data.</p>
<form method="get" action="/matcher" class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6">
  <div class="flex flex-wrap gap-3">
    ${[0, 1, 2].map(i => `<label class="text-sm"><span class="font-semibold block mb-1">${i === 0 ? 'Name 1' : `Name ${i + 1} <span class=\"font-normal text-slate-500\">(optional)</span>`}</span><input name="names" value="${val(i)}" ${i === 0 ? 'required' : ''} maxlength="40" autocomplete="off" placeholder="e.g. ${['Luna', 'Leo', 'Ivy'][i]}" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-36"></label>`).join('')}
    <button class="self-end rounded-full bg-indigo-600 text-white px-6 py-2 text-sm font-semibold hover:bg-indigo-700">Find matches</button>
  </div>
</form>
${missing.length ? `<p class="mt-4 text-sm text-rose-700">Not in the data: ${missing.map(esc).join(', ')} — check the spelling or try another name.</p>` : ''}
${sibs ? `<section class="mt-8"><h2 class="font-bold text-xl mb-1">Sibling names for ${rows.map(r => esc(r.name)).join(' &amp; ')}</h2><p class="text-sm text-slate-600 mb-4">Same era (peaked within 10 years) and a similar popularity tier, with different first letters and endings so the set doesn't blur together.</p><div class="space-y-6">${group('Sisters', sibs.girls)}${group('Brothers', sibs.boys)}</div>${!sibs.girls.length && !sibs.boys.length ? '<p class="text-slate-600">No close matches — try a more common name.</p>' : ''}</section>` : ''}
${mids && (mids.girls.length || mids.boys.length) ? `<section class="mt-10"><h2 class="font-bold text-xl mb-1">Middle names for ${esc(mids.first.name)}</h2><p class="text-sm text-slate-600 mb-4">Enduring classics (in use since before 1900) with a ${mids.first.name.length >= 6 ? 'shorter' : 'longer'} shape that balances ${esc(mids.first.name)}.</p><div class="flex flex-wrap gap-2 text-sm">${[...mids.girls, ...mids.boys].map(s => `<a href="/name/${s.slug}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${esc(mids.first.name)} <strong>${esc(s.name)}</strong></a>`).join('')}</div></section>` : ''}
${!rows.length && !missing.length ? `<div class="mt-4"><p class="text-sm font-semibold text-slate-700">See it in action:</p><div class="mt-2 flex flex-wrap gap-2 text-sm">${[['?names=luna&names=leo', 'Try Luna &amp; Leo'], ['?names=olivia', 'Try Olivia'], ['?names=theodore&names=eleanor', 'Try Theodore &amp; Eleanor']].map(([q, t]) => `<a href="/matcher${q}" class="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 hover:border-indigo-400">${t}</a>`).join('')}</div></div>` : ''}
${!rows.length ? `<section class="mt-8 grid sm:grid-cols-3 gap-4 text-sm">${[['Same era', 'Siblings\u2019 names usually come from the same generation — we match on when each name peaked.'], ['Same popularity tier', 'A very common name next to a very rare one can feel mismatched — we match on how many babies ever got each name.'], ['Distinct sounds', 'We skip names sharing a first letter or ending with yours, so every child keeps their own sound.']].map(([t, d]) => `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold">${t}</p><p class="mt-1 text-slate-600">${d}</p></div>`).join('')}</section>` : ''}
${emailForm()}`;
  return htmlPrivate(c, layout({ title: `Sibling & Middle Name Matcher | ${SITE}`, desc: 'Enter names you love and get matching sibling names from the same era and popularity tier, plus middle names that flow — from 146 years of U.S. data.', path: '/matcher', body }));
});

// ---------- shared shortlists ----------
app.get('/s/:id', async c => {
  const id = c.req.param('id');
  if (!/^[a-z0-9]{8}$/.test(id)) return c.notFound();
  const row = await c.env.DB.prepare('SELECT slugs, created FROM shares WHERE id = ? AND revoked = 0').bind(id).first();
  if (!row) return c.notFound();
  let slugs = [];
  try { slugs = JSON.parse(row.slugs); } catch { /* treat as empty */ }
  const rows = await namesBySlugs(c.env.DB, slugs);
  if (!rows.length) return c.notFound();
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">A shared baby name shortlist</h1>
<p class="mt-2 text-slate-600">${rows.length} name${rows.length > 1 ? 's' : ''} someone picked out and shared — tap any name for its full 146-year chart.</p>
<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${rows.map(nameCard).join('')}</div>
<p class="mt-8 text-sm text-slate-600">Make your own: save names with ♡ on any name page, then share from <a href="/favorites" class="text-indigo-600 underline">your shortlist</a>.</p>
${emailForm()}`;
  return htmlPrivate(c, layout({ title: `A Shared Baby Name Shortlist (${rows.length} names) | ${SITE}`, desc: `A shared shortlist of ${rows.length} baby names, with popularity charts and meanings for each.`, path: `/s/${id}`, noindex: true, ogImage: `${ORIGIN}/og/share/${id}.png`, body }));
});

app.get('/og/share/:file', async c => {
  const mth = c.req.param('file').match(/^([a-z0-9]{8})\.png$/);
  if (!mth) return c.notFound();
  const row = await c.env.DB.prepare('SELECT slugs FROM shares WHERE id = ? AND revoked = 0').bind(mth[1]).first();
  if (!row) return c.notFound();
  let slugs = [];
  try { slugs = JSON.parse(row.slugs); } catch { /* treat as empty */ }
  const rows = await namesBySlugs(c.env.DB, slugs.slice(0, 6));
  if (!rows.length) return c.notFound();
  const res = await ogList(c, 'A Baby Name Shortlist', rows.map(r => r.name));
  res.headers.set('Cache-Control', 'public, max-age=3600');
  return res;
});

// ---------- names by meaning ----------
const MEANING_WORDS = ['moon', 'light', 'star', 'love', 'strong', 'fire', 'peace', 'king', 'flower', 'sea', 'beautiful', 'brave', 'joy', 'grace', 'warrior', 'night',
  'bright', 'water', 'ruler', 'victory', 'noble', 'life', 'earth', 'heaven', 'rose', 'white', 'wolf', 'lion', 'queen', 'holy', 'river', 'stone', 'bear', 'honor',
  'sky', 'pearl', 'black', 'red', 'prince', 'beloved', 'gracious', 'glory', 'dark', 'song', 'dawn', 'forest', 'valley', 'meadow', 'bird', 'spring', 'crown', 'pure', 'deer', 'mountain'];

app.get('/meaning/:word', async c => {
  const word = c.req.param('word').toLowerCase();
  if (!MEANING_WORDS.includes(word)) return c.notFound();
  const cand = await c.env.DB.prepare(`SELECT m.slug, m.etymology, n.name, n.total, n.f_total, n.m_total, n.first_year
      FROM meanings m JOIN names n ON n.slug = m.slug
      WHERE m.etymology LIKE ? ORDER BY n.total DESC LIMIT 200`).bind(`%${word}%`).all();
  const re = new RegExp(`\\b${word}\\b`, 'i');
  const rows = cand.results.filter(r => re.test(stripUsageNotes(r.etymology))).slice(0, 48);
  const capWord = cap(word);
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Names That Mean ${capWord}</h1>
<p class="mt-2 text-slate-600 max-w-2xl">${rows.length} names whose etymology relates to “${word}” — drawn from documented origins, sorted by all-time U.S. popularity.</p>
<div class="mt-6 space-y-3">${rows.map(r => `<div class="rounded-xl bg-white border border-slate-200 p-4"><div class="flex flex-wrap items-baseline gap-x-3 gap-y-1"><a href="/name/${r.slug}" class="font-semibold text-indigo-700 hover:underline">${esc(r.name)}</a><span class="text-xs rounded-full ${r.f_total > r.m_total ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'} px-2 py-0.5">${r.f_total > r.m_total ? 'girl' : 'boy'}</span><span class="text-xs text-slate-500 tabular-nums">${fmt(r.total)} babies since ${r.first_year}</span></div><p class="mt-1 text-sm text-slate-600">${esc(r.etymology.length > 180 ? r.etymology.slice(0, 177) + '…' : r.etymology)}</p></div>`).join('')}</div>
<section class="mt-10"><h2 class="font-bold mb-2">More meanings</h2><div class="flex flex-wrap gap-2 text-sm">${MEANING_WORDS.filter(w => w !== word).map(w => `<a href="/meaning/${w}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${cap(w)}</a>`).join('')}</div></section>
<p class="mt-6 text-xs text-slate-600">Etymologies adapted from <a class="underline hover:text-indigo-600" href="https://en.wiktionary.org" rel="license noopener">Wiktionary</a>, licensed <a class="underline hover:text-indigo-600" href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener">CC BY-SA 4.0</a>.</p>
${emailForm()}`;
  return html(c, layout({ title: `Names That Mean ${capWord} — ${rows.length} Names with Origins | ${SITE}`, desc: `${rows.length} baby names that mean or relate to “${word}”, with documented etymologies and U.S. popularity data.`, path: `/meaning/${word}`, ogImage: `${ORIGIN}/og/meaning/${word}.png`, body, jsonld: {
    '@context': 'https://schema.org', '@type': 'ItemList', name: `Names That Mean ${capWord}`,
    itemListElement: rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: `${ORIGIN}/name/${r.slug}` })),
  } }));
});

app.get('/og/list/:file', async c => {
  const mth = c.req.param('file').match(/^([a-z-]{1,40})\.png$/);
  const def = mth && LISTS[mth[1]];
  if (!def) return c.notFound();
  const rows = await def.rows(c.env.DB);
  const res = await ogList(c, def.title, rows.map(r => r.name));
  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res;
});

app.get('/og/meaning/:file', async c => {
  const mth = c.req.param('file').match(/^([a-z]{1,20})\.png$/);
  const word = mth && mth[1];
  if (!word || !MEANING_WORDS.includes(word)) return c.notFound();
  const cand = await c.env.DB.prepare(`SELECT m.etymology, n.name FROM meanings m JOIN names n ON n.slug = m.slug
      WHERE m.etymology LIKE ? ORDER BY n.total DESC LIMIT 60`).bind(`%${word}%`).all();
  const re = new RegExp(`\\b${word}\\b`, 'i');
  const names = cand.results.filter(r => re.test(r.etymology)).map(r => r.name);
  const res = await ogList(c, `Names That Mean ${cap(word)}`, names);
  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res;
});

// ---------- browse hub ----------
app.get('/browse', async c => {
  const decades = Array.from({ length: 15 }, (_, i) => 1880 + i * 10);
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Browse all names</h1>
<section class="mt-6"><h2 class="font-bold mb-2">Quick picks</h2>
<div class="flex flex-wrap gap-1.5 text-sm">${[['/top/girls', `Top girl names ${END_YEAR}`], ['/top/boys', `Top boy names ${END_YEAR}`], ['/trending', 'Trending names'], ['/unisex', 'Unisex names']].map(([h, t]) => `<a href="${h}" class="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 hover:border-indigo-400">${t}</a>`).join('')}</div></section>
<section class="mt-6"><h2 class="font-bold mb-2">Curated lists</h2>
<div class="flex flex-wrap gap-1.5 text-sm">${Object.entries(LISTS).map(([s, d]) => `<a href="/list/${s}" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400">${d.title}</a>`).join('')}</div></section>
<p class="mt-4 flex flex-wrap gap-2"><a href="/generator" class="inline-block rounded-full bg-indigo-600 text-white px-5 py-2 text-sm font-semibold hover:bg-indigo-700">Try the baby name generator →</a><a href="/matcher" class="inline-block rounded-full bg-white border border-indigo-300 text-indigo-700 px-5 py-2 text-sm font-semibold hover:bg-indigo-50">Sibling &amp; middle name matcher →</a></p>
<section class="mt-6"><h2 class="font-bold mb-2">By meaning</h2>
<div class="flex flex-wrap gap-1.5 text-sm">${MEANING_WORDS.map(w => `<a href="/meaning/${w}" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400">${cap(w)}</a>`).join('')}</div></section>
<section class="mt-6"><h2 class="font-bold mb-2">By first letter</h2>
<div class="flex flex-wrap gap-1.5">${'abcdefghijklmnopqrstuvwxyz'.split('').map(ch => `<a href="/letter/${ch}" class="w-9 h-9 grid place-items-center rounded-lg bg-white border border-slate-200 hover:border-indigo-400">${ch.toUpperCase()}</a>`).join('')}</div></section>
<section class="mt-6"><h2 class="font-bold mb-2">By decade</h2>
<div class="flex flex-wrap gap-1.5">${decades.map(d => `<a href="/decade/${d}s" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-sm">${d}s</a>`).join('')}</div></section>
<section class="mt-6"><h2 class="font-bold mb-2">By year</h2>
<div class="flex flex-wrap gap-1.5 text-xs">${Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i).map(y => `<a href="/year/${y}" class="px-2 py-1 rounded bg-white border border-slate-200 hover:border-indigo-400">${y}</a>`).join('')}</div></section>
<section class="mt-6"><h2 class="font-bold mb-2">By state (${END_YEAR})</h2>
<div class="flex flex-wrap gap-1.5 text-sm">${Object.entries(STATES).map(([s, n]) => `<a href="/state/${s.toLowerCase()}" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400">${n}</a>`).join('')}</div></section>
${emailForm()}`;
  return html(c, layout({ title: `Browse Baby Names: A–Z, Years, Decades, States | ${SITE}`, desc: 'Browse 105,000+ baby names by first letter, every year since 1880, every decade, and all 50 U.S. states.', path: '/browse', body }));
});

// ---------- pricing ----------
app.get('/pricing', c => {
  const tier = (name, price, per, tagline, feats, highlight) => `
  <div class="rounded-2xl border ${highlight ? 'border-indigo-400 ring-2 ring-indigo-100 bg-white' : 'border-slate-200 bg-white'} p-6 flex flex-col">
    <p class="font-bold text-lg">${name}</p>
    <p class="mt-1 text-sm text-slate-600">${tagline}</p>
    <p class="mt-4"><span class="text-3xl font-extrabold">${price}</span><span class="text-slate-600 text-sm"> ${per}</span></p>
    <ul class="mt-4 space-y-2 text-sm text-slate-700 flex-1">${feats.map(f => `<li class="flex gap-2"><span aria-hidden="true" class="text-indigo-600">✓</span>${f}</li>`).join('')}</ul>
    <span class="mt-6 inline-block text-center rounded-full ${highlight ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'} font-semibold px-5 py-2.5 text-sm">Included in the Beta trial</span>
  </div>`;
  return html(c, layout({
    title: `Pricing | ${SITE}`,
    desc: `NameChart pricing: planned Plus and Pro plans, all currently open as a free Beta trial. No payment is collected during the Beta.`,
    path: '/pricing',
    body: `<div class="max-w-3xl mx-auto text-center">
<h1 class="font-display text-3xl sm:text-4xl font-bold">Pricing</h1>
<p class="mt-3 text-slate-600">NameChart is in <strong>Beta</strong>. Everything below — including every planned paid feature — is open to everyone as a <strong>free trial</strong>. We don't collect payment yet, and we'll announce clearly before billing ever begins.</p>
</div>
<div class="mt-8 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
${tier('Basic', '$0', 'forever', 'The essentials, always free', ['Name search &amp; full 146-year charts', 'Top 1000 rankings by year', 'Meanings, origins &amp; famous namesakes', 'Private in-browser shortlist'])}
${tier('Plus', '$4', '/ month', 'For active name hunters', ['Everything in Basic', 'Name generator with style &amp; meaning filters', 'Head-to-head name comparisons', 'State-by-state popularity maps', 'Sibling name suggestions'], true)}
${tier('Pro', '$9', '/ month', 'For pros &amp; data lovers', ['Everything in Plus', 'Decade &amp; trend deep-dives', 'Curated &amp; themed name lists', 'Early access to new tools', 'Priority email support'])}
</div>
<p class="mt-8 text-center text-sm text-slate-600 max-w-2xl mx-auto">During the Beta free trial there is no account, no credit card, and no feature gate. Prices shown are our planned plans and may change before launch.</p>
${emailForm()}`,
  }));
});

// ---------- about & privacy ----------
app.get('/about', c => html(c, layout({
  title: `About ${SITE} — Data Sources & Methodology`,
  desc: 'NameChart charts 146 years of official U.S. baby name data — no ads, all features open during the free Beta. Data sources and methodology.',
  path: '/about',
  body: `<article class="prose-custom max-w-2xl">
<h1 class="font-display text-3xl sm:text-4xl font-bold">About NameChart</h1>
<p class="mt-4">NameChart gives every name a complete popularity chart — no ads, no signup. We're currently in Beta: every feature, including everything in our planned paid plans, is open as a free trial. See <a class="text-indigo-600 underline" href="/pricing">pricing</a> for what's planned.</p>
<h2 class="text-xl font-bold mt-8">Data sources</h2>
<p class="mt-2">All national data comes from the <a class="text-indigo-600 underline" href="https://www.ssa.gov/oact/babynames/">U.S. Social Security Administration</a> baby names dataset (1880–${END_YEAR}), which is in the public domain. State rankings come from the SSA state-level dataset. Names given to fewer than 5 babies of a gender in a year are excluded at the source to protect privacy.</p>
<p class="mt-2">Note on wording: our &ldquo;Peak year&rdquo; is the year with the <em>most babies</em> given a name. SSA&rsquo;s &ldquo;most popular year&rdquo; refers to the year a name achieved its <em>highest rank</em>, so the two can differ. Data snapshot: SSA release covering births through ${END_YEAR}.</p>
<h2 class="text-xl font-bold mt-8">Methodology</h2>
<ul class="mt-2 list-disc pl-5 space-y-1">
<li>Charts show raw births per year, split by gender.</li>
<li>Ranks are computed per year per gender across all recorded names.</li>
<li>“Unisex” = at least 25% of all-time births are each gender.</li>
<li>Trend = rank change over the last 5 years (top-1000 names).</li>
</ul>
<h2 class="text-xl font-bold mt-8">Contact</h2>
<p class="mt-2">Feedback or data questions: hello@zalize.com · Writing about us? See the <a class="text-indigo-600 underline" href="/press">press kit</a>.</p>
</article>${emailForm()}`,
})));

app.get('/press', c => html(c, layout({
  title: `Press & Brand Assets | ${SITE}`,
  desc: 'NameChart press kit: boilerplate, key facts, logo downloads and screenshots for journalists and directories.',
  path: '/press',
  body: `<article class="max-w-2xl">
<h1 class="font-display text-3xl sm:text-4xl font-bold">Press &amp; brand assets</h1>
<p class="mt-4 text-slate-600">Everything you need to write about NameChart. Questions or interview requests: hello@zalize.com</p>
<h2 class="text-xl font-bold mt-8">Boilerplate</h2>
<p class="mt-2 text-slate-700">NameChart charts 146 years of official U.S. baby name data — full popularity curves, meanings, famous namesakes, state rankings and sibling-name matching for 105,000+ names. No ads, no account required; every feature is open during the free Beta. NameChart is a Zalize project.</p>
<h2 class="text-xl font-bold mt-8">Key facts</h2>
<ul class="mt-2 list-disc pl-5 space-y-1 text-slate-700">
<li>${fmt(NAME_COUNT)} names, each with a full 1880–${END_YEAR} popularity chart</li>
<li>Data: U.S. Social Security Administration public dataset (national + state)</li>
<li>Meanings &amp; pronunciations adapted from Wiktionary (CC BY-SA); famous namesakes from Wikidata (CC0)</li>
<li>Tools: Baby Name Generator, Sibling &amp; Middle Name Matcher, head-to-head comparisons, shareable shortlists</li>
<li>Privacy: no cookies, no trackers, first-party anonymous analytics only</li>
<li>Status: free Beta trial; planned plans published on the <a class="text-indigo-600 underline" href="/pricing">pricing page</a></li>
</ul>
<h2 class="text-xl font-bold mt-8">Logo</h2>
<p class="mt-2 text-slate-700">Rounded-square gradient mark with a white chart line. Please don't recolor or stretch it.</p>
<p class="mt-3 flex items-center gap-4"><img src="/img/favicon.svg" alt="NameChart logo" width="64" height="64"><a class="text-indigo-600 underline" href="/img/favicon.svg" download="namechart-logo.svg">Download SVG</a></p>
<h2 class="text-xl font-bold mt-8">Screenshots &amp; share cards</h2>
<p class="mt-2 text-slate-700">Every major page has a generated share card you may reuse in coverage, e.g. <a class="text-indigo-600 underline" href="/og/name/luna.png">a name card</a> or <a class="text-indigo-600 underline" href="/og/list/vintage-girl-names.png">a list card</a>. Screenshots of any page may be used with attribution and a link.</p>
<h2 class="text-xl font-bold mt-8">Attribution</h2>
<p class="mt-2 text-slate-700">Please credit "NameChart (namechart.zalize.com)". Underlying SSA data is public domain; our visualizations and text are © Zalize.</p>
</article>`,
})));

app.get('/favorites', c => html(c, layout({
  title: `My Shortlist | ${SITE}`,
  desc: 'Your saved baby name shortlist — stored privately in your browser, no account needed.',
  path: '/favorites',
  noindex: true,
  body: `<h1 class="font-display text-3xl sm:text-4xl font-bold">My shortlist</h1>
<p class="mt-2 text-slate-600">Names you save are stored only in this browser — no account needed. Nothing leaves your device unless you create a share link below.</p>
<div id="nc-fav-list" class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"><p class="text-slate-600 col-span-full">Loading…</p></div>
<div id="nc-fav-actions" class="mt-6"></div>
<div id="nc-fav-share" class="mt-6"></div>
<p class="mt-6 text-sm text-slate-600">Tip: open any <a href="/top/girls" class="text-indigo-600 underline">name page</a> and tap “♡ Save to shortlist”.</p>`,
})));

app.get('/terms', c => html(c, layout({
  title: `Terms of Use | ${SITE}`,
  desc: 'NameChart terms of use: informational service, Beta trial terms, data accuracy disclaimer, acceptable use, and no government affiliation.',
  path: '/terms',
  body: `<article class="max-w-2xl">
<h1 class="font-display text-3xl sm:text-4xl font-bold">Terms of Use</h1>
<p class="mt-4 text-slate-600">Effective: August 2026 · Operator: Zalize (hello@zalize.com)</p>
<h2 class="text-xl font-bold mt-8">The service</h2>
<p class="mt-2 text-slate-700">NameChart is an informational website presenting statistics derived from public-domain U.S. Social Security Administration data. The service is currently in Beta: all features are available as a free trial, no account is required, and no payment is collected. Paid plans are published on the <a class="text-indigo-600 underline" href="/pricing">pricing page</a> but are not yet for sale; we will announce clearly before any billing begins.</p>
<h2 class="text-xl font-bold mt-8">No affiliation with the government</h2>
<p class="mt-2 text-slate-700">NameChart is not affiliated with, endorsed by, or sponsored by the U.S. Social Security Administration or any other government agency. “Social Security Administration” is used only to identify the source of the underlying data.</p>
<h2 class="text-xl font-bold mt-8">Accuracy</h2>
<p class="mt-2 text-slate-700">Data is provided “as is” without warranty. The source data excludes names given to fewer than 5 babies of a gender in a year, is based on Social Security card applications rather than all births, and may contain source-side errors. Do not rely on it for legal, medical, or official purposes.</p>
<h2 class="text-xl font-bold mt-8">Acceptable use</h2>
<p class="mt-2 text-slate-700">You may read, link to, and share pages freely. Do not attempt to disrupt the service, bulk-scrape at a rate that degrades it, or submit email addresses you do not own.</p>
<h2 class="text-xl font-bold mt-8">Content reuse</h2>
<p class="mt-2 text-slate-700">The underlying SSA data is in the public domain. Etymology text in the “Meaning &amp; origin” sections is adapted from <a class="text-indigo-600 underline" href="https://en.wiktionary.org/">Wiktionary</a> and is available under <a class="text-indigo-600 underline" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>; if you reuse it, the same license applies. Our other page text, design, and derived visualizations are © Zalize; you may quote them with attribution and a link.</p>
<h2 class="text-xl font-bold mt-8">Changes &amp; contact</h2>
<p class="mt-2 text-slate-700">These terms may be updated; the effective date above will change. Questions: hello@zalize.com</p>
</article>`,
})));

app.get('/privacy', c => html(c, layout({
  title: `Privacy Policy | ${SITE}`,
  desc: 'NameChart privacy policy: no cookies, no third-party trackers, first-party anonymous analytics only.',
  path: '/privacy',
  body: `<article class="max-w-2xl">
<h1 class="font-display text-3xl sm:text-4xl font-bold">Privacy</h1>
<p class="mt-4 text-slate-600">Effective: August 2026</p>
<ul class="mt-4 list-disc pl-5 space-y-2 text-slate-700">
<li><strong>No cookies.</strong> We set no cookies and use no third-party trackers or ad networks.</li>
<li><strong>Anonymous analytics.</strong> We count page views (path + day only) via a first-party beacon, and keep daily aggregate counts of search terms (the normalized query + day only). No IP addresses, fingerprints, or identifiers are stored with either. To limit abuse we hash your IP with the current date into a short-lived counter key; the raw IP is never written to storage.</li>
<li><strong>Shared shortlists.</strong> If you tap “Share this list” we store only the name list itself and the creation date — no account, email, or identifier is attached. You can delete the link at any time from the same browser, which disables it for everyone.</li>
<li><strong>Email.</strong> If you subscribe for updates we store your email address, the date, and the page you signed up from, used solely for product updates. Unsubscribe anytime by replying to any email or writing to hello@zalize.com.</li>
<li><strong>Processors.</strong> The site runs on Cloudflare (Workers, D1, DNS/CDN). Cloudflare processes connection data, including IP addresses, at its edge for delivery, caching, and security, and may transfer it internationally under its own terms; Cloudflare also collects network error reports (NEL) for our domain. Cloudflare&rsquo;s cookieless Web Analytics script is enabled at the zalize.com zone level, but our Content-Security-Policy blocks it from loading on NameChart. We use no ad networks, no cross-site trackers, and no third-party marketing tools.</li>
<li><strong>Controller &amp; rights.</strong> Controller: Zalize (hello@zalize.com). Legal basis for the email list is your consent; for anonymous counts, legitimate interest. Email addresses are kept until you unsubscribe; anonymous page counts are aggregate and retained indefinitely. You may request access, correction, or deletion — including under GDPR and CCPA — at hello@zalize.com.</li>
<li><strong>Children.</strong> NameChart is aimed at adults choosing names and is not directed to children under 13. We do not knowingly collect personal information from children.</li>
</ul>
</article>`,
})));

// ---------- APIs ----------
// Same-origin only: blocks cross-site form/beacon abuse without needing cookies or tokens.
function sameOrigin(c) {
  const src = c.req.header('Origin') || c.req.header('Referer');
  if (!src) return false;
  try { return new URL(src).host === new URL(c.req.url).host; } catch { return false; }
}

// Per-day, per-client write budget stored in D1 (no cookies, IP is hashed and never persisted raw).
async function overQuota(c, kind, limit) {
  const ip = c.req.header('CF-Connecting-IP') || '0.0.0.0';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kind + '|' + ip + '|' + new Date().toISOString().slice(0, 10)));
  const key = [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
  const row = await c.env.DB.prepare('INSERT INTO rate_limits (key, count) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count')
    .bind(key).first();
  return (row?.count ?? 0) > limit;
}

const subscribePage = (c, title, heading, sub, status) => htmlPrivate(c, layout({
  title: `${title} | ${SITE}`, desc: '', path: '/subscribe', noindex: true,
  body: `<div class="text-center py-20"><h1 class="text-2xl font-bold">${heading}</h1><p class="mt-2 text-slate-600">${sub}</p><a href="/" class="inline-block mt-6 text-indigo-600 hover:underline">← Back to NameChart</a></div>`,
}), status);

app.post('/api/subscribe', async c => {
  if (!sameOrigin(c)) return subscribePage(c, 'Blocked', 'Request blocked', 'Subscriptions can only be submitted from namechart.zalize.com.', 403);
  const form = await c.req.formData().catch(() => null);
  const email = (form?.get('email') || '').toString().trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return subscribePage(c, 'Invalid email', "That email doesn't look right", 'Please go back and check the address.', 400);
  }
  if (await overQuota(c, 'sub', 5)) return subscribePage(c, 'Too many requests', 'Too many sign-ups', 'Please try again tomorrow.', 429);
  await c.env.DB.prepare('INSERT OR IGNORE INTO subscribers (email, source) VALUES (?, ?)')
    .bind(email, (c.req.header('Referer') || '').slice(0, 200)).run();
  return subscribePage(c, 'Subscribed', "🎉 You're on the list", "We'll email you when new data and tools land. Unsubscribe anytime via hello@zalize.com.");
});

const rand = n => { const b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map(x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''); };

app.post('/api/share', async c => {
  if (!sameOrigin(c)) return c.json({ error: 'forbidden' }, 403);
  if (await overQuota(c, 'share', 20)) return c.json({ error: 'Too many shared lists today — try again tomorrow.' }, 429);
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'bad request' }, 400); }
  const slugs = Array.isArray(body?.slugs)
    ? [...new Set(body.slugs.filter(s => typeof s === 'string' && /^[a-z'-]{2,40}$/.test(s)))].slice(0, 60)
    : [];
  if (!slugs.length) return c.json({ error: 'empty list' }, 400);
  const rows = await namesBySlugs(c.env.DB, slugs);
  if (!rows.length) return c.json({ error: 'no valid names' }, 400);
  const id = rand(8), token = rand(24);
  await c.env.DB.prepare('INSERT INTO shares (id, slugs, token, created, revoked) VALUES (?, ?, ?, ?, 0)')
    .bind(id, JSON.stringify(rows.map(r => r.slug)), token, new Date().toISOString().slice(0, 10)).run();
  return c.json({ id, token, url: `${ORIGIN}/s/${id}` });
});

app.post('/api/share/revoke', async c => {
  if (!sameOrigin(c)) return c.json({ error: 'forbidden' }, 403);
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'bad request' }, 400); }
  if (typeof body?.id !== 'string' || typeof body?.token !== 'string') return c.json({ error: 'bad request' }, 400);
  const r = await c.env.DB.prepare('UPDATE shares SET revoked = 1 WHERE id = ? AND token = ?').bind(body.id, body.token).run();
  return c.json({ ok: (r.meta?.changes ?? 0) > 0 });
});

const EVENTS = new Set(['visit_new', 'visit_returning']);
app.post('/api/beacon', async c => {
  // Beacons come only from our own pages: require browser fetch-metadata to say same-origin.
  if (!sameOrigin(c) || skipAnalytics(c) || c.req.header('Sec-Fetch-Site') !== 'same-origin') return c.body(null, 204);
  try {
    const { p, e } = await c.req.json();
    // Only count paths that match a real route family, so forged beacons can't pollute analytics.
    const VALID_PATH = /^\/$|^\/(name|letter|year|state|compare|list|meaning|og\/name|og\/list|og\/meaning|og\/compare)\/[a-z0-9'.-]{1,60}$|^\/decade\/\d{4}s$|^\/s\/[a-z0-9]{8}$|^\/og\/share\/[a-z0-9.]{1,20}$|^\/(top\/girls|top\/boys|trending|unisex|browse|about|privacy|terms|favorites|search|generator|pricing|matcher|press)$/;
    if (typeof p === 'string' && p.length <= 100 && VALID_PATH.test(p) && !(await overQuota(c, 'beacon', 300))) {
      const day = new Date().toISOString().slice(0, 10);
      await c.env.DB.prepare('INSERT INTO hits (day, path, count) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET count = count + 1')
        .bind(day, p).run();
      if (typeof e === 'string' && EVENTS.has(e)) {
        await c.env.DB.prepare('INSERT INTO events (day, event, count) VALUES (?, ?, 1) ON CONFLICT(day, event) DO UPDATE SET count = count + 1')
          .bind(day, e).run();
      }
    }
  } catch { /* ignore */ }
  return c.body(null, 204);
});

app.get('/api/search', async c => {
  const q = slugify(c.req.query('q'));
  if (!q) return c.json({ results: [] }, 200, noStore);
  const rows = await c.env.DB.prepare(`SELECT slug,name,total FROM names WHERE ${prefixWhere} ORDER BY total DESC LIMIT 8`).bind(q).all();
  return c.json({ results: rows.results }, 200, cache);
});

// ---------- SEO plumbing ----------
app.get('/robots.txt', c => c.text(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /search\nSitemap: ${ORIGIN}/sitemap.xml\n`, 200, cache));

const SM_PAGE = 5000;
app.get('/sitemap.xml', c => {
  const nameShards = Math.ceil(NAME_COUNT / SM_PAGE);
  const shards = ['static', ...Array.from({ length: nameShards }, (_, i) => `names-${i}`)];
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${shards.map(s => `<sitemap><loc>${ORIGIN}/sitemaps/${s}.xml</loc></sitemap>`).join('\n')}
</sitemapindex>`, 200, { 'Content-Type': 'application/xml', ...cache });
});

app.get('/sitemaps/:shard{.+\\.xml}', async c => {
  const shard = c.req.param('shard').replace(/\.xml$/, '');
  const urls = [];
  if (shard === 'static') {
    urls.push(...staticPaths());
  } else {
    const mth = shard.match(/^names-(\d+)$/);
    if (!mth) return c.notFound();
    const rows = await c.env.DB.prepare('SELECT slug FROM names ORDER BY total DESC LIMIT ? OFFSET ?')
      .bind(SM_PAGE, Number(mth[1]) * SM_PAGE).all();
    if (!rows.results.length) return c.notFound();
    for (const r of rows.results) urls.push(`/name/${r.slug}`);
  }
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${ORIGIN}${encodeURI(u)}</loc></url>`).join('\n')}
</urlset>`, 200, { 'Content-Type': 'application/xml', ...cache });
});

app.get('/:key{[a-f0-9]{32}\\.txt}', c => {
  const key = c.req.param('key').replace(/\.txt$/, '');
  return c.env.INDEXNOW_KEY === key ? c.text(key) : c.notFound();
});

app.notFound(c => htmlPrivate(c, layout({ title: 'Page not found | ' + SITE, desc: 'Not found', path: '/404', noindex: true, body: `<div class="text-center py-20"><h1 class="font-display text-3xl sm:text-4xl font-bold">404</h1><p class="mt-2 text-slate-600">That page doesn't exist.</p><a href="/" class="inline-block mt-6 text-indigo-600 hover:underline">← Back to NameChart</a></div>` }), 404));

function staticPaths() {
  const urls = ['/', '/top/girls', '/top/boys', '/unisex', '/trending', '/browse', '/generator', '/matcher', '/compare', '/pricing', '/about', '/press', '/privacy', '/terms'];
  for (const s of Object.keys(LISTS)) urls.push(`/list/${s}`);
  for (const w of MEANING_WORDS) urls.push(`/meaning/${w}`);
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') urls.push(`/letter/${ch}`);
  for (let y = START_YEAR; y <= END_YEAR; y++) urls.push(`/year/${y}`);
  for (let d = 1880; d <= 2020; d += 10) urls.push(`/decade/${d}s`);
  for (const st of Object.keys(STATES)) urls.push(`/state/${st.toLowerCase()}`);
  return urls;
}

// Weekly IndexNow push: static routes plus every name page, in 10k-URL batches.
async function runIndexNow(env) {
  const urls = staticPaths().map(u => ORIGIN + u);
  for (let off = 0; ; off += 10000) {
    const rows = await env.DB.prepare('SELECT slug FROM names ORDER BY slug LIMIT 10000 OFFSET ?').bind(off).all();
    if (!rows.results.length) break;
    for (const r of rows.results) urls.push(`${ORIGIN}/name/${r.slug}`);
    if (rows.results.length < 10000) break;
  }
  const host = new URL(ORIGIN).host;
  for (let i = 0; i < urls.length; i += 10000) {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: env.INDEXNOW_KEY, keyLocation: `${ORIGIN}/${env.INDEXNOW_KEY}.txt`, urlList: urls.slice(i, i + 10000) }),
    });
    console.log(`indexnow batch ${i / 10000}: ${res.status}`);
  }
}

export default {
  fetch: app.fetch,
  scheduled: (event, env, ctx) => ctx.waitUntil(runIndexNow(env)),
};
