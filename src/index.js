import { Hono } from 'hono';
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

const cache = { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' };
const noStore = { 'Cache-Control': 'no-store' };
const html = (c, body, status = 200) => c.html(body, status, status === 200 ? cache : noStore);
const htmlPrivate = (c, body, status = 200) => c.html(body, status, noStore);

const SLUG_RE = /^[a-z][a-z'-]{0,39}$/;
const slugify = s => (s || '').toLowerCase().replace(/[^a-z'-]/g, '').slice(0, 40);

// Prefix search via index-friendly range scan (LIKE on a BINARY PK can't use the index
// and D1 rejects patterns >= 50 chars).
const NAME_COUNT = 105954; // rows in `names`; update when reimporting data
// '~' (0x7E) sorts after every character allowed in slugs (a-z, apostrophe, hyphen).
const prefixWhere = "slug >= ?1 AND slug < (?1 || '~')";

// Edge-cache successful HTML/XML GETs so repeat traffic doesn't hit D1.
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET') return next();
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api/') || url.pathname === '/search') return next();
  const key = new Request(url.origin + url.pathname, { method: 'GET' });
  const hit = await caches.default.match(key);
  if (hit) return new Response(hit.body, hit);
  await next();
  if (c.res.status === 200 && (c.res.headers.get('Cache-Control') || '').includes('s-maxage')) {
    c.executionCtx.waitUntil(caches.default.put(key, c.res.clone()));
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

// ---------- home ----------
app.get('/', async c => {
  const db = c.env.DB;
  const [girls, boys, popular] = await Promise.all([
    db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 10').bind(END_YEAR, 'F').all(),
    db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 10').bind(END_YEAR, 'M').all(),
    db.prepare('SELECT slug,name,total,f_total,m_total,first_year FROM names ORDER BY total DESC LIMIT 12').all(),
  ]);
  const body = `
<section class="text-center py-10">
  <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight">Every name tells a story.<br class="hidden sm:block"> <span class="text-indigo-600">See it in one chart.</span></h1>
  <p class="mt-4 text-slate-500 max-w-xl mx-auto">Free popularity charts, rankings and insights for ${fmt(NAME_COUNT)} names — from 146 years of official U.S. birth records. No ads, no paywall.</p>
  <form action="/search" method="get" class="mt-6 max-w-md mx-auto flex gap-2">
    <input name="q" placeholder="Try “Olivia”, “Theodore”, “Luna”…" autocomplete="off"
      class="flex-1 min-w-0 rounded-full border border-slate-300 bg-white px-4 sm:px-5 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
    <button class="shrink-0 rounded-full bg-indigo-600 text-white font-semibold px-4 sm:px-6 py-3 hover:bg-indigo-700">Search</button>
  </form>
</section>
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
<section class="mt-8 grid sm:grid-cols-3 gap-4 text-sm">
  <a href="/trending" class="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-400"><p class="font-semibold">📈 Rising &amp; falling</p><p class="text-slate-500 mt-1">Names climbing or crashing right now.</p></a>
  <a href="/browse" class="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-400"><p class="font-semibold">🗂 Browse everything</p><p class="text-slate-500 mt-1">A–Z, every year since 1880, decades, all 50 states.</p></a>
  <a href="/compare/olivia-vs-emma" class="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-400"><p class="font-semibold">⚔️ Compare names</p><p class="text-slate-500 mt-1">Two names, head-to-head on one chart.</p></a>
</section>
${emailForm()}`;
  return html(c, layout({
    title: `${SITE} — Baby Name Popularity Charts, 1880–${END_YEAR}`,
    desc: `Free interactive popularity charts and rankings for ${fmt(NAME_COUNT)} baby names from 146 years of official U.S. birth data. No ads, no paywall.`,
    path: '/',
    body,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: ORIGIN, potentialAction: { '@type': 'SearchAction', target: `${ORIGIN}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
  }));
});

// ---------- name page ----------
app.get('/name/:slug', async c => {
  const db = c.env.DB;
  const slug = slugify(c.req.param('slug'));
  const r = await getName(db, slug);
  if (!r) return html(c, layout({ title: 'Name not found — ' + SITE, desc: 'Name not found', path: '/name/', noindex: true, body: `<div class="text-center py-20"><h1 class="text-2xl font-bold">We don't have data for “${esc(cap(slug))}” yet</h1><p class="mt-2 text-slate-500">It may have fewer than 5 births in any year — the data source only includes names with 5+ births.</p><a href="/" class="inline-block mt-6 text-indigo-600 hover:underline">← Back to search</a></div>` }), 404);
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
  const similar = await similarNames(db, r);
  const stats = [
    ['Total babies', fmt(r.total)],
    ['Peak year', `${r.peak_year} (${fmt(r.peak_count)} babies)`],
    [`Rank in ${END_YEAR}`, rankBits.length ? rankBits.join(' · ') : 'Below top 1000'],
    ['First recorded', String(r.first_year)],
    ['10-year trend', trendPct === null ? 'New / returning' : `${trendPct > 0 ? '▲ +' : trendPct < 0 ? '▼ ' : ''}${trendPct}%`],
    ['Gender split', r.f_total && r.m_total ? `${girlPct}% girls / ${100 - girlPct}% boys` : (r.f_total ? 'All girls' : 'All boys')],
  ];
  const body = `
<nav class="text-sm text-slate-500 mb-4"><a href="/" class="hover:text-indigo-600">Home</a> › <a href="/letter/${slug[0]}" class="hover:text-indigo-600">Names starting with ${slug[0].toUpperCase()}</a> › <span>${esc(r.name)}</span></nav>
<div class="flex flex-wrap items-baseline gap-3">
  <h1 class="text-4xl font-extrabold tracking-tight">${esc(r.name)}</h1>
  ${unisex ? '<span class="text-sm rounded-full bg-purple-100 text-purple-700 px-3 py-1">Unisex</span>' : `<span class="text-sm rounded-full ${primary === 'girl' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'} px-3 py-1">${cap(primary)} name</span>`}
</div>
<p class="mt-2 text-slate-600 max-w-2xl">${esc(r.name)} has been given to <strong>${fmt(r.total)}</strong> babies in the U.S. since ${r.first_year}. It peaked in <strong>${r.peak_year}</strong>${rankBits.length ? ` and currently ranks <strong>${rankBits.join(' and ')}</strong> (${END_YEAR})` : ''}.</p>
<div class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6">
  <h2 class="font-bold mb-2">Popularity over time <span class="font-normal text-sm text-slate-400">births per year, 1880–${END_YEAR}</span></h2>
  ${chartSVG(series)}
  ${chartReadout(series)}
</div>
<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
  ${stats.map(([k, v]) => `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="text-xs uppercase tracking-wide text-slate-400">${k}</p><p class="font-semibold mt-1">${v}</p></div>`).join('')}
</div>
<div class="mt-6 flex flex-wrap gap-3">
  <form action="/compare" method="get" class="flex gap-2 items-center">
    <input type="hidden" name="a" value="${esc(r.name)}">
    <input name="b" required placeholder="Compare with…" class="rounded-full border border-slate-300 px-4 py-2 text-sm bg-white w-44">
    <button class="rounded-full border border-indigo-300 text-indigo-700 px-4 py-2 text-sm font-medium hover:bg-indigo-50">⚔️ Compare</button>
  </form>
  <button onclick="navigator.share?navigator.share({title:document.title,url:location.href}):navigator.clipboard.writeText(location.href).then(()=>this.textContent='✓ Link copied')" class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">↗ Share this chart</button>
</div>
${similar.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Names with a similar vibe</h2><p class="text-sm text-slate-500 -mt-2 mb-3">Same primary gender, peaked around the same years, and roughly as common as ${esc(r.name)}.</p><div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${similar.map(nameCard).join('')}</div></section>` : ''}
${emailForm()}`;
  return html(c, layout({
    title: `${r.name} — Name Popularity, Rank & Chart (1880–${END_YEAR}) | ${SITE}`,
    desc: `${r.name}: given to ${fmt(r.total)} U.S. babies since ${r.first_year}, peaked in ${r.peak_year}.${rankBits.length ? ` Ranked ${rankBits.join(', ')} in ${END_YEAR}.` : ''} Full 146-year popularity chart, free.`,
    path: `/name/${slug}`,
    body,
    jsonld: { '@context': 'https://schema.org', '@type': 'Dataset', name: `${r.name} name popularity 1880–${END_YEAR}`, description: `Births per year for the name ${r.name} in the United States.`, license: 'https://www.usa.gov/government-works', creator: { '@type': 'Organization', name: 'U.S. Social Security Administration' } },
  }));
});

// ---------- compare ----------
app.get('/compare/:pair', async c => {
  const db = c.env.DB;
  const mth = c.req.param('pair').toLowerCase().match(/^([a-z'-]+)-vs-([a-z'-]+)$/);
  if (!mth) return c.redirect('/');
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
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Comparison chart">
    ${[0.25, 0.5, 0.75, 1].map(t => `<line x1="${padL}" x2="${W - padR}" y1="${y(max * t)}" y2="${y(max * t)}" stroke="#e2e8f0"/>`).join('')}
    ${xTicks.map(yr => `<text x="${x(yr - START_YEAR)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#94a3b8">${yr}</text>`).join('')}
    <path d="${line(ta)}" fill="none" stroke="#4f46e5" stroke-width="2"/>
    <path d="${line(tb)}" fill="none" stroke="#f59e0b" stroke-width="2"/>
    <rect x="${padL}" y="${padT}" width="10" height="3" fill="#4f46e5"/><text x="${padL + 14}" y="${padT + 5}" font-size="11" fill="#475569">${esc(a.name)}</text>
    <rect x="${padL + 90}" y="${padT}" width="10" height="3" fill="#f59e0b"/><text x="${padL + 104}" y="${padT + 5}" font-size="11" fill="#475569">${esc(b.name)}</text>
  </svg>`;
  const winner = a.total >= b.total ? a : b;
  const body = `
<h1 class="text-3xl font-extrabold tracking-tight">${esc(a.name)} <span class="text-slate-400">vs</span> ${esc(b.name)}</h1>
<p class="mt-2 text-slate-600">All-time, <strong>${esc(winner.name)}</strong> leads: ${fmt(winner.total)} babies vs ${fmt(winner === a ? b.total : a.total)}.</p>
<div class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6">${svg}</div>
<div class="mt-6 grid grid-cols-2 gap-3">
  ${[a, b].map(r => `<a href="/name/${r.slug}" class="rounded-xl bg-white border border-slate-200 p-4 hover:border-indigo-400">
    <p class="font-bold">${esc(r.name)}</p>
    <p class="text-sm text-slate-500 mt-1">${fmt(r.total)} total · peak ${r.peak_year}${r.latest_rank_f && r.latest_rank_f <= 1000 ? ` · #${r.latest_rank_f} girls` : ''}${r.latest_rank_m && r.latest_rank_m <= 1000 ? ` · #${r.latest_rank_m} boys` : ''}</p>
  </a>`).join('')}
</div>
<form action="/compare" method="get" class="mt-8 flex flex-col sm:flex-row gap-2 max-w-lg">
  <input name="a" placeholder="First name" value="${esc(a.name)}" class="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm bg-white">
  <input name="b" placeholder="Second name" value="${esc(b.name)}" class="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm bg-white">
  <button class="rounded-full bg-indigo-600 text-white px-5 py-2 text-sm font-semibold hover:bg-indigo-700">Compare</button>
</form>
${emailForm()}`;
  return html(c, layout({
    title: `${a.name} vs ${b.name} — Which Name Is More Popular? | ${SITE}`,
    desc: `Head-to-head popularity chart: ${a.name} (${fmt(a.total)} babies) vs ${b.name} (${fmt(b.total)} babies), 1880–${END_YEAR}.`,
    path: `/compare/${a.slug}-vs-${b.slug}`,
    body,
  }));
});
app.get('/compare', c => {
  const a = slugify(c.req.query('a')), b = slugify(c.req.query('b'));
  return c.redirect(a && b ? `/compare/${a}-vs-${b}` : '/');
});

// ---------- search ----------
app.get('/search', async c => {
  const db = c.env.DB;
  const q = (c.req.query('q') || '').trim().slice(0, 60);
  const slug = slugify(q);
  if (slug) {
    const exact = await getName(db, slug);
    if (exact) return c.redirect(`/name/${slug}`);
  }
  const like = slug
    ? await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names WHERE ${prefixWhere} ORDER BY total DESC LIMIT 24`).bind(slug).all()
    : { results: [] };
  const body = `
<h1 class="text-2xl font-bold">Search results for “${esc(q)}”</h1>
${like.results.length
    ? `<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${like.results.map(nameCard).join('')}</div>`
    : `<p class="mt-4 text-slate-500">No names found. The data only includes names given to 5+ babies in a single year.</p>`}
${emailForm()}`;
  return htmlPrivate(c, layout({ title: `“${q}” — name search | ${SITE}`, desc: `Search results for ${q}`, path: '/search', noindex: true, body }));
});

// ---------- top lists ----------
async function topPage(c, sex, label) {
  const db = c.env.DB;
  const rows = await db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 1000').bind(END_YEAR, sex).all();
  const body = `
<h1 class="text-3xl font-extrabold">Top 1000 ${label} names (${END_YEAR})</h1>
<p class="mt-2 text-slate-600">Official ${END_YEAR} U.S. birth data. Click any name for its full 146-year chart.</p>
<div class="mt-6 rounded-2xl bg-white border border-slate-200 p-4">${rankTable(rows.results)}</div>
${emailForm()}`;
  return html(c, layout({
    title: `Top 1000 ${cap(label)} Names ${END_YEAR} — Official Rankings | ${SITE}`,
    desc: `The 1000 most popular ${label} names of ${END_YEAR} from official U.S. birth records, with free popularity charts for each.`,
    path: `/top/${label}s`, body,
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
<h1 class="text-3xl font-extrabold">100 truly unisex names</h1>
<p class="mt-2 text-slate-600">Names where at least 25% of babies are each gender, ranked by all-time popularity.</p>
<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${rows.results.map(nameCard).join('')}</div>
${emailForm()}`;
  return html(c, layout({ title: `100 Truly Unisex Baby Names, Ranked by Data | ${SITE}`, desc: 'Genuinely gender-neutral names — at least 25% girls and 25% boys — ranked by 146 years of U.S. birth data.', path: '/unisex', body }));
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
    <span class="text-sm font-semibold tabular-nums ${r.delta > 0 ? 'text-emerald-600' : 'text-rose-600'} w-14">${r.delta > 0 ? '▲ +' + r.delta : '▼ ' + r.delta}</span>
    <span class="font-medium flex-1">${esc(r.name)}</span>
    <span class="text-xs text-slate-400">${r.sex === 'F' ? 'girl' : 'boy'} · now #${r.rank}</span>
  </a></li>`).join('')}</ol>`;
  const body = `
<h1 class="text-3xl font-extrabold">Rising &amp; falling names</h1>
<p class="mt-2 text-slate-600">Biggest rank moves in the top 1000 between ${END_YEAR - 5} and ${END_YEAR}.</p>
<div class="mt-6 grid md:grid-cols-2 gap-6">
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2 text-emerald-700">📈 Fastest rising</h2>${list(rising)}</div>
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2 text-rose-700">📉 Fastest falling</h2>${list(falling)}</div>
</div>
${emailForm()}`;
  return html(c, layout({ title: `Rising & Falling Baby Names (${END_YEAR - 5}–${END_YEAR}) | ${SITE}`, desc: `The fastest rising and fastest falling baby names in the U.S. top 1000, ${END_YEAR - 5} to ${END_YEAR}.`, path: '/trending', body }));
});

// ---------- letter ----------
app.get('/letter/:l', async c => {
  const db = c.env.DB;
  const l = c.req.param('l').toLowerCase();
  if (!/^[a-z]$/.test(l)) return c.notFound();
  const rows = await db.prepare('SELECT slug,name,total,f_total,m_total,first_year FROM names WHERE slug LIKE ? ORDER BY total DESC LIMIT 200').bind(l + '%').all();
  const body = `
<h1 class="text-3xl font-extrabold">Names starting with ${l.toUpperCase()}</h1>
<p class="mt-2 text-slate-600">Top 200 by all-time popularity.</p>
<div class="mt-4 flex flex-wrap gap-1.5 text-sm">${'abcdefghijklmnopqrstuvwxyz'.split('').map(ch => `<a href="/letter/${ch}" class="w-8 h-8 grid place-items-center rounded-lg ${ch === l ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 hover:border-indigo-400'}">${ch.toUpperCase()}</a>`).join('')}</div>
<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${rows.results.map(nameCard).join('')}</div>
${emailForm()}`;
  return html(c, layout({ title: `Baby Names Starting With ${l.toUpperCase()} — Top 200 | ${SITE}`, desc: `The 200 most popular baby names starting with ${l.toUpperCase()}, ranked by 146 years of U.S. birth data.`, path: `/letter/${l}`, body }));
});

// ---------- year ----------
app.get('/year/:y', async c => {
  const db = c.env.DB;
  const y = Number(c.req.param('y'));
  if (!(y >= START_YEAR && y <= END_YEAR)) return c.notFound();
  const [g, b] = await Promise.all([
    db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 100').bind(y, 'F').all(),
    db.prepare('SELECT * FROM year_ranks WHERE year=? AND sex=? ORDER BY rank LIMIT 100').bind(y, 'M').all(),
  ]);
  const nav = `<div class="flex gap-2 text-sm mt-2">${y > START_YEAR ? `<a class="text-indigo-600 hover:underline" href="/year/${y - 1}">← ${y - 1}</a>` : ''}${y < END_YEAR ? `<a class="text-indigo-600 hover:underline" href="/year/${y + 1}">${y + 1} →</a>` : ''}</div>`;
  const body = `
<h1 class="text-3xl font-extrabold">Most popular names of ${y}</h1>${nav}
<div class="mt-6 grid md:grid-cols-2 gap-6">
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Girls</h2>${rankTable(g.results)}</div>
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Boys</h2>${rankTable(b.results)}</div>
</div>
${emailForm()}`;
  return html(c, layout({ title: `Top 100 Baby Names of ${y} (Girls & Boys) | ${SITE}`, desc: `The 100 most popular girl and boy names of ${y} from official U.S. birth records.`, path: `/year/${y}`, body }));
});

// ---------- decade ----------
app.get('/decade/:d', async c => {
  const db = c.env.DB;
  const mth = c.req.param('d').match(/^(\d{4})s$/);
  if (!mth) return c.notFound();
  const d = Number(mth[1]);
  if (d % 10 !== 0 || d < 1880 || d > 2020) return c.notFound();
  const [g, b] = await Promise.all([
    db.prepare('SELECT * FROM decade_ranks WHERE decade=? AND sex=? ORDER BY rank LIMIT 100').bind(d, 'F').all(),
    db.prepare('SELECT * FROM decade_ranks WHERE decade=? AND sex=? ORDER BY rank LIMIT 100').bind(d, 'M').all(),
  ]);
  const body = `
<h1 class="text-3xl font-extrabold">Most popular names of the ${d}s</h1>
<div class="mt-4 flex flex-wrap gap-1.5 text-sm">${Array.from({ length: 15 }, (_, i) => 1880 + i * 10).map(dd => `<a href="/decade/${dd}s" class="px-3 py-1.5 rounded-lg ${dd === d ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 hover:border-indigo-400'}">${dd}s</a>`).join('')}</div>
<div class="mt-6 grid md:grid-cols-2 gap-6">
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Girls</h2>${rankTable(g.results)}</div>
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Boys</h2>${rankTable(b.results)}</div>
</div>
${emailForm()}`;
  return html(c, layout({ title: `Top 100 Baby Names of the ${d}s | ${SITE}`, desc: `The 100 most popular girl and boy names of the ${d}s, from official U.S. birth records.`, path: `/decade/${d}s`, body }));
});

// ---------- state ----------
app.get('/state/:st', async c => {
  const db = c.env.DB;
  const st = c.req.param('st').toUpperCase();
  if (!STATES[st]) return c.notFound();
  const [g, b] = await Promise.all([
    db.prepare('SELECT * FROM state_ranks WHERE state=? AND sex=? ORDER BY rank LIMIT 100').bind(st, 'F').all(),
    db.prepare('SELECT * FROM state_ranks WHERE state=? AND sex=? ORDER BY rank LIMIT 100').bind(st, 'M').all(),
  ]);
  const body = `
<h1 class="text-3xl font-extrabold">Most popular names in ${STATES[st]} (${END_YEAR})</h1>
<div class="mt-4 flex flex-wrap gap-1.5 text-xs">${Object.keys(STATES).map(s => `<a href="/state/${s.toLowerCase()}" class="px-2 py-1 rounded ${s === st ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 hover:border-indigo-400'}">${s}</a>`).join('')}</div>
<div class="mt-6 grid md:grid-cols-2 gap-6">
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Girls</h2>${rankTable(g.results)}</div>
  <div class="rounded-2xl bg-white border border-slate-200 p-4"><h2 class="font-bold mb-2">Boys</h2>${rankTable(b.results)}</div>
</div>
${emailForm()}`;
  return html(c, layout({ title: `Top Baby Names in ${STATES[st]} ${END_YEAR} | ${SITE}`, desc: `The 100 most popular girl and boy names in ${STATES[st]} in ${END_YEAR}, from official state birth records.`, path: `/state/${st.toLowerCase()}`, body }));
});

// ---------- browse hub ----------
app.get('/browse', async c => {
  const decades = Array.from({ length: 15 }, (_, i) => 1880 + i * 10);
  const body = `
<h1 class="text-3xl font-extrabold">Browse all names</h1>
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

// ---------- about & privacy ----------
app.get('/about', c => html(c, layout({
  title: `About ${SITE} — Data Sources & Methodology`,
  desc: 'NameChart charts 146 years of official U.S. baby name data — free, no ads, no paywall. Data sources and methodology.',
  path: '/about',
  body: `<article class="prose-custom max-w-2xl">
<h1 class="text-3xl font-extrabold">About NameChart</h1>
<p class="mt-4">NameChart gives every name a free, complete popularity chart — no ads, no paywall, no signup. Other sites lock trend data behind subscriptions; we believe public-domain data should stay public.</p>
<h2 class="text-xl font-bold mt-8">Data sources</h2>
<p class="mt-2">All national data comes from the <a class="text-indigo-600 hover:underline" href="https://www.ssa.gov/oact/babynames/">U.S. Social Security Administration</a> baby names dataset (1880–${END_YEAR}), which is in the public domain. State rankings come from the SSA state-level dataset. Names given to fewer than 5 babies of a gender in a year are excluded at the source to protect privacy.</p>
<p class="mt-2">Note on wording: our &ldquo;Peak year&rdquo; is the year with the <em>most babies</em> given a name. SSA&rsquo;s &ldquo;most popular year&rdquo; refers to the year a name achieved its <em>highest rank</em>, so the two can differ. Data snapshot: SSA release covering births through ${END_YEAR}.</p>
<h2 class="text-xl font-bold mt-8">Methodology</h2>
<ul class="mt-2 list-disc pl-5 space-y-1">
<li>Charts show raw births per year, split by gender.</li>
<li>Ranks are computed per year per gender across all recorded names.</li>
<li>“Unisex” = at least 25% of all-time births are each gender.</li>
<li>Trend = rank change over the last 5 years (top-1000 names).</li>
</ul>
<h2 class="text-xl font-bold mt-8">Contact</h2>
<p class="mt-2">Feedback or data questions: hello@zalize.com</p>
</article>${emailForm()}`,
})));

app.get('/terms', c => html(c, layout({
  title: `Terms of Use | ${SITE}`,
  desc: 'NameChart terms of use: free informational service, data accuracy disclaimer, acceptable use, and no government affiliation.',
  path: '/terms',
  body: `<article class="max-w-2xl">
<h1 class="text-3xl font-extrabold">Terms of Use</h1>
<p class="mt-4 text-slate-600">Effective: August 2026 · Operator: Zalize (hello@zalize.com)</p>
<h2 class="text-xl font-bold mt-8">The service</h2>
<p class="mt-2 text-slate-700">NameChart is a free, informational website presenting statistics derived from public-domain U.S. Social Security Administration data. There is no paid plan, no account, and no purchase.</p>
<h2 class="text-xl font-bold mt-8">No affiliation with the government</h2>
<p class="mt-2 text-slate-700">NameChart is not affiliated with, endorsed by, or sponsored by the U.S. Social Security Administration or any other government agency. “Social Security Administration” is used only to identify the source of the underlying data.</p>
<h2 class="text-xl font-bold mt-8">Accuracy</h2>
<p class="mt-2 text-slate-700">Data is provided “as is” without warranty. The source data excludes names given to fewer than 5 babies of a gender in a year, is based on Social Security card applications rather than all births, and may contain source-side errors. Do not rely on it for legal, medical, or official purposes.</p>
<h2 class="text-xl font-bold mt-8">Acceptable use</h2>
<p class="mt-2 text-slate-700">You may read, link to, and share pages freely. Do not attempt to disrupt the service, bulk-scrape at a rate that degrades it, or submit email addresses you do not own.</p>
<h2 class="text-xl font-bold mt-8">Content reuse</h2>
<p class="mt-2 text-slate-700">The underlying SSA data is in the public domain. Our page text, design, and derived visualizations are © Zalize; you may quote them with attribution and a link.</p>
<h2 class="text-xl font-bold mt-8">Changes &amp; contact</h2>
<p class="mt-2 text-slate-700">These terms may be updated; the effective date above will change. Questions: hello@zalize.com</p>
</article>`,
})));

app.get('/privacy', c => html(c, layout({
  title: `Privacy Policy | ${SITE}`,
  desc: 'NameChart privacy policy: no cookies, no third-party trackers, first-party anonymous analytics only.',
  path: '/privacy',
  body: `<article class="max-w-2xl">
<h1 class="text-3xl font-extrabold">Privacy</h1>
<p class="mt-4 text-slate-600">Effective: August 2026</p>
<ul class="mt-4 list-disc pl-5 space-y-2 text-slate-700">
<li><strong>No cookies.</strong> We set no cookies and use no third-party trackers or ad networks.</li>
<li><strong>Anonymous analytics.</strong> We count page views (path + day only) via a first-party beacon. No IP addresses, fingerprints, or identifiers are stored. To limit abuse we hash your IP with the current date into a short-lived counter key; the raw IP is never written to storage.</li>
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
  body: `<div class="text-center py-20"><h1 class="text-2xl font-bold">${heading}</h1><p class="mt-2 text-slate-500">${sub}</p><a href="/" class="inline-block mt-6 text-indigo-600 hover:underline">← Back to NameChart</a></div>`,
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

app.post('/api/beacon', async c => {
  if (!sameOrigin(c)) return c.body(null, 204);
  try {
    const { p } = await c.req.json();
    if (typeof p === 'string' && p.length <= 100 && p.startsWith('/') && !(await overQuota(c, 'beacon', 300))) {
      const day = new Date().toISOString().slice(0, 10);
      await c.env.DB.prepare('INSERT INTO hits (day, path, count) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET count = count + 1')
        .bind(day, p).run();
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
    urls.push('/', '/top/girls', '/top/boys', '/unisex', '/trending', '/browse', '/about', '/privacy', '/terms');
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') urls.push(`/letter/${ch}`);
    for (let y = START_YEAR; y <= END_YEAR; y++) urls.push(`/year/${y}`);
    for (let d = 1880; d <= 2020; d += 10) urls.push(`/decade/${d}s`);
    for (const st of Object.keys(STATES)) urls.push(`/state/${st.toLowerCase()}`);
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

app.notFound(c => htmlPrivate(c, layout({ title: 'Page not found | ' + SITE, desc: 'Not found', path: '/404', noindex: true, body: `<div class="text-center py-20"><h1 class="text-3xl font-extrabold">404</h1><p class="mt-2 text-slate-500">That page doesn't exist.</p><a href="/" class="inline-block mt-6 text-indigo-600 hover:underline">← Back to NameChart</a></div>` }), 404));

export default app;
