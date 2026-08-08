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
const slugify = s => (s || '').toLowerCase().replace(/[^a-z'-]/g, '').slice(0, 40);

// Prefix search via index-friendly range scan (LIKE on a BINARY PK can't use the index
// and D1 rejects patterns >= 50 chars).
const NAME_COUNT = 105954; // rows in `names`; update when reimporting data
const CACHE_VER = 68; // bump to invalidate the edge HTML cache on deploys that change rendering/data
// '~' (0x7E) sorts after every character allowed in slugs (a-z, apostrophe, hyphen).
const prefixWhere = "slug >= ?1 AND slug < (?1 || '~')";

// Edge-cache successful HTML/XML GETs so repeat traffic doesn't hit D1.
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET') return next();
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api/') || url.pathname === '/search') return next();
  const key = new Request(url.origin + '/__v' + CACHE_VER + url.pathname, { method: 'GET' });
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
  <h1 class="fade-up font-display text-4xl sm:text-6xl font-bold tracking-tight">Every name tells a story.<br class="hidden sm:block"> <em class="text-indigo-600">See it in one chart.</em></h1>
  <p class="mt-4 text-slate-600 max-w-xl mx-auto">Popularity charts, rankings and insights for ${fmt(NAME_COUNT)} names — from 146 years of official U.S. birth records. Every feature is open during our free Beta — <a class="text-indigo-600 underline" href="/pricing">see plans</a>.</p>
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
  if (slug && raw !== slug) return c.redirect(`/name/${slug}`, 301);
  const r = await getName(db, slug);
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
  const variants = (await fuzzyMatches(db, slug, 1)).filter(v => v.slug !== slug).slice(0, 6);
  const stats = [
    ['Total babies', fmt(r.total)],
    ['Peak year', `${r.peak_year} (${fmt(r.peak_count)} babies)`],
    [`Rank in ${END_YEAR}`, rankBits.length ? [
      r.latest_rank_f && r.latest_rank_f <= 1000 ? `#${fmt(r.latest_rank_f)} for girls${yoy('F')}` : null,
      r.latest_rank_m && r.latest_rank_m <= 1000 ? `#${fmt(r.latest_rank_m)} for boys${yoy('M')}` : null,
    ].filter(Boolean).join(' · ') : 'Below top 1000'],
    ['First recorded', String(r.first_year)],
    ['10-year trend', trendPct === null ? 'New / returning' : `${trendPct > 0 ? '▲ +' : trendPct < 0 ? '▼ ' : ''}${trendPct}%`],
    ['Gender split', r.f_total && r.m_total ? `${girlPct}% girls / ${100 - girlPct}% boys` : (r.f_total ? 'All girls' : 'All boys')],
  ];
  const body = `
<nav aria-label="Breadcrumb" class="text-sm text-slate-600 mb-4"><a href="/" class="hover:text-indigo-600">Home</a> › <a href="/letter/${slug[0]}" class="hover:text-indigo-600">Names starting with ${slug[0].toUpperCase()}</a> › <span>${esc(r.name)}</span></nav>
<div class="flex flex-wrap items-baseline gap-3">
  <h1 class="font-display text-4xl sm:text-5xl font-bold tracking-tight">${esc(r.name)}</h1>
  ${unisex ? '<span class="text-sm rounded-full bg-purple-100 text-purple-700 px-3 py-1">Unisex</span>' : `<span class="text-sm rounded-full ${primary === 'girl' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'} px-3 py-1">${cap(primary)} name</span>`}
</div>
<p class="mt-2 text-slate-600 max-w-2xl">${esc(r.name)} has been given to <strong>${fmt(r.total)}</strong> babies in the U.S. since ${r.first_year}. It peaked in <strong>${r.peak_year}</strong>${rankBits.length ? ` and currently ranks <strong>${rankBits.join(' and ')}</strong> (${END_YEAR})` : ''}.${(() => {
  if (!yearTot || !latest) return '';
  const denom = primary === 'girl' ? yearTot.f : yearTot.m;
  const sexLatest = primary === 'girl' ? f[f.length - 1] : m[m.length - 1];
  if (!sexLatest || !denom) return '';
  const oneIn = Math.round(denom / sexLatest);
  return ` In ${END_YEAR}, about <strong>1 in ${fmt(oneIn)}</strong> ${primary === 'girl' ? 'girls' : 'boys'} was named ${esc(r.name)}.`;
})()}</p>
${meaning && (meaning.etymology || meaning.ipa) ? `
<section class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6">
  <h2 class="font-bold mb-2">Meaning &amp; origin${meaning.ipa ? ` <span class="font-normal text-slate-600 text-base">${esc(meaning.ipa)}</span>` : ''}</h2>
  ${meaning.etymology ? `<p class="text-slate-700">${esc(meaning.etymology)}</p>` : ''}
  ${meaning.origin ? `<p class="mt-2 text-sm text-slate-600">Origin: ${esc(meaning.origin.replace(/,\s*/g, ', '))}${meaning.diminutive_of ? ` · Short form of ${esc(meaning.diminutive_of)}` : ''}</p>` : (meaning.diminutive_of ? `<p class="mt-2 text-sm text-slate-600">Short form of ${esc(meaning.diminutive_of)}</p>` : '')}
  ${(() => { const ws = meaning.etymology ? MEANING_WORDS.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(meaning.etymology)) : []; return ws.length ? `<div class="mt-3 flex flex-wrap gap-2 text-sm">${ws.map(w => `<a href="/meaning/${w}" class="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Names that mean ${w}</a>`).join('')}</div>` : ''; })()}
  <p class="mt-3 text-xs text-slate-600">Etymology adapted from <a class="underline hover:text-indigo-600" href="https://en.wiktionary.org/wiki/${encodeURIComponent(r.name)}" rel="license noopener">Wiktionary</a>, licensed <a class="underline hover:text-indigo-600" href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener">CC BY-SA 4.0</a>.</p>
</section>` : ''}
<div class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6">
  <h2 class="font-bold mb-2">Popularity over time <span class="font-normal text-sm text-slate-600">births per year, 1880–${END_YEAR}</span></h2>
  ${chartSVG(series)}
  ${chartReadout(series)}
</div>
<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
  ${stats.map(([k, v]) => `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="text-xs uppercase tracking-wide text-slate-600">${k}</p><p class="font-semibold mt-1">${v}</p></div>`).join('')}
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
${rankHist.results.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Rank through the decades</h2><p class="text-sm text-slate-600 -mt-2 mb-3">${esc(r.name)}'s rank among U.S. ${primary} names at 25-year milestones.</p><div class="rounded-2xl bg-white border border-slate-200 p-4 overflow-x-auto"><table class="text-sm w-full"><thead><tr class="text-left text-xs uppercase tracking-wide text-slate-600"><th class="py-1 pr-4">Year</th>${rankHist.results.some(x => x.sex === 'F') ? '<th class="py-1 pr-4">Girls rank</th>' : ''}${rankHist.results.some(x => x.sex === 'M') ? '<th class="py-1">Boys rank</th>' : ''}</tr></thead><tbody>${[...new Set(rankHist.results.map(x => x.year))].map(y => { const f = rankHist.results.find(x => x.year === y && x.sex === 'F'); const m = rankHist.results.find(x => x.year === y && x.sex === 'M'); return `<tr class="border-t border-slate-100"><td class="py-1.5 pr-4 font-medium">${y}</td>${rankHist.results.some(x => x.sex === 'F') ? `<td class="py-1.5 pr-4">${f ? '#' + fmt(f.rank) : '—'}</td>` : ''}${rankHist.results.some(x => x.sex === 'M') ? `<td class="py-1.5">${m ? '#' + fmt(m.rank) : '—'}</td>` : ''}</tr>`; }).join('')}</tbody></table></div><p class="mt-2 text-xs text-slate-600">— means outside the top 1000 that year.</p></section>` : ''}
${stateRows.results.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Where ${esc(r.name)} ranks highest (${END_YEAR})</h2><p class="text-sm text-slate-600 -mt-2 mb-3">States where ${esc(r.name)} places best in the state top 100.</p><div class="flex flex-wrap gap-2 text-sm">${stateRows.results.map(s => `<a href="/state/${s.state.toLowerCase()}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${STATES[s.state] || s.state} <span class="text-slate-600">#${s.rank} ${s.sex === 'F' ? 'girls' : 'boys'}</span></a>`).join('')}</div></section>` : ''}
${variants.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Spellings &amp; variants</h2><p class="text-sm text-slate-600 -mt-2 mb-3">Names one letter away from ${esc(r.name)} — alternate spellings parents actually use.</p><div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${variants.map(nameCard).join('')}</div></section>` : ''}
${famous.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Famous people named ${esc(r.name)}</h2><div class="grid sm:grid-cols-2 gap-3">${famous.map(p => `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold">${esc(p.n)}</p>${p.d ? `<p class="text-sm text-slate-600 mt-1">${esc(cap(p.d))}</p>` : ''}</div>`).join('')}</div><p class="mt-2 text-xs text-slate-600">Notability data from <a class="underline hover:text-indigo-600" href="https://www.wikidata.org/" rel="noopener">Wikidata</a> (CC0).</p></section>` : ''}
${similar.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Names with a similar vibe</h2><p class="text-sm text-slate-600 -mt-2 mb-3">Same primary gender, peaked around the same years, and roughly as common as ${esc(r.name)}.</p><div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${similar.map(nameCard).join('')}</div>
<div class="mt-4 flex flex-wrap gap-2 text-sm">${similar.slice(0, 4).map(s => { const pair = [slug, s.slug].sort(); return `<a href="/compare/${pair[0]}-vs-${pair[1]}" class="px-3 py-1 rounded-full bg-amber-50 text-amber-800 hover:bg-amber-100">${esc(r.name)} vs ${esc(s.name)} ⚖</a>`; }).join('')}</div></section>` : ''}
${sibs.girls.length || sibs.boys.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Sibling name ideas for ${esc(r.name)}</h2><p class="text-sm text-slate-600 -mt-2 mb-3">Same era and popularity as ${esc(r.name)}, avoiding matching initials or rhymes.</p><div class="grid sm:grid-cols-2 gap-3">${sibs.girls.length ? `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold text-sm text-pink-700 mb-2">Sisters</p><div class="flex flex-wrap gap-2 text-sm">${sibs.girls.map(s => `<a href="/name/${s.slug}" class="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:border-indigo-400">${esc(s.name)}</a>`).join('')}</div></div>` : ''}${sibs.boys.length ? `<div class="rounded-xl bg-white border border-slate-200 p-4"><p class="font-semibold text-sm text-blue-700 mb-2">Brothers</p><div class="flex flex-wrap gap-2 text-sm">${sibs.boys.map(s => `<a href="/name/${s.slug}" class="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:border-indigo-400">${esc(s.name)}</a>`).join('')}</div></div>` : ''}</div></section>` : ''}
${rhymes.results.length ? `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Names that rhyme with ${esc(r.name)}</h2><p class="text-sm text-slate-600 -mt-2 mb-3">Names sharing the same ending sound as ${esc(r.name)}, by all-time U.S. popularity.</p><div class="flex flex-wrap gap-2 text-sm">${rhymes.results.map(s => `<a href="/name/${s.slug}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${esc(s.name)}</a>`).join('')}</div></section>` : ''}
${(() => {
  const g = primary === 'girl' ? 'girl' : 'boy';
  const rank = primary === 'girl' ? r.latest_rank_f : r.latest_rank_m;
  const rels = [];
  if (r.name.length <= 4) rels.push([`short-${g}-names`, `Short ${g} names`]);
  if (r.name.length >= 9) rels.push([`long-${g}-names`, `Long ${g} names`]);
  if (r.first_year >= 1990) rels.push([`new-${g}-names`, `Modern ${g} names`]);
  if (r.peak_year < 1940 && rank && rank <= 500) rels.push([`vintage-${g}-names`, `Vintage ${g} names making a comeback`]);
  if (!rels.length) return '';
  return `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Explore related lists</h2><div class="flex flex-wrap gap-2 text-sm">${rels.map(([s, t]) => `<a href="/list/${s}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">${t} →</a>`).join('')}</div></section>`;
})()}
${(() => {
  if (!meaning || !meaning.etymology) return '';
  const ws = MEANING_WORDS.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(meaning.etymology));
  if (!ws.length) return '';
  return `<section class="mt-10"><h2 class="font-bold text-lg mb-3">Names with the same meaning</h2><p class="text-sm text-slate-600 -mt-2 mb-3">${esc(r.name)} relates to ${ws.map(w => `“${w}”`).join(', ')} — explore other names with documented ties to the same meaning.</p><div class="flex flex-wrap gap-2 text-sm">${ws.map(w => `<a href="/meaning/${w}" class="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-indigo-400">Names that mean ${w} →</a>`).join('')}</div></section>`;
})()}
<section class="mt-10"><h2 class="font-bold text-lg mb-3">FAQ</h2><div class="space-y-3">
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
<h1 class="font-display text-3xl sm:text-4xl font-bold tracking-tight">${esc(a.name)} <span class="text-slate-600">vs</span> ${esc(b.name)}</h1>
<p class="mt-2 text-slate-600">All-time, <strong>${esc(winner.name)}</strong> leads: ${fmt(winner.total)} babies vs ${fmt(winner === a ? b.total : a.total)}.</p>
<div class="mt-6 rounded-2xl bg-white border border-slate-200 p-4 sm:p-6">${svg}</div>
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
app.get('/compare', c => {
  const a = slugify(c.req.query('a')), b = slugify(c.req.query('b'));
  return c.redirect(a && b ? `/compare/${a}-vs-${b}` : '/');
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
  if (slug) {
    const exact = await getName(db, slug);
    if (exact) return c.redirect(`/name/${slug}`);
  }
  const like = slug
    ? await db.prepare(`SELECT slug,name,total,f_total,m_total,first_year FROM names WHERE ${prefixWhere} ORDER BY total DESC LIMIT 24`).bind(slug).all()
    : { results: [] };
  let didYouMean = [];
  if (!like.results.length && slug.length >= 3) didYouMean = await fuzzyMatches(db, slug);
  if (slug) {
    // Aggregate query counts (no user identifiers) to drive search-term analysis.
    c.executionCtx.waitUntil(db.prepare(
      'INSERT INTO searches (day, q, results) VALUES (?, ?, ?) ON CONFLICT(day, q) DO UPDATE SET count = count + 1'
    ).bind(new Date().toISOString().slice(0, 10), slug, like.results.length).run().catch(() => {}));
  }
  const body = `
<h1 class="text-2xl font-bold">Search results for “${esc(q)}”</h1>
${like.results.length
    ? `<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${like.results.map(nameCard).join('')}</div>`
    : `<p class="mt-4 text-slate-600">No names found. The data only includes names given to 5+ babies in a single year.</p>${didYouMean.length ? `<h2 class="mt-6 font-bold">Did you mean…</h2><div class="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${didYouMean.map(nameCard).join('')}</div>` : ''}`}
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
<div class="mt-6 rounded-2xl bg-white border border-slate-200 p-4">${rankTable(rows.results)}</div>
${emailForm()}`;
  return html(c, layout({
    title: `Top 1000 ${cap(label)} Names ${END_YEAR} — Official Rankings | ${SITE}`,
    desc: `The 1000 most popular ${label} names of ${END_YEAR} from official U.S. birth records, with full popularity charts for each.`,
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
<h1 class="font-display text-3xl sm:text-4xl font-bold">100 truly unisex names</h1>
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
  return html(c, layout({ title: `Rising & Falling Baby Names (${END_YEAR - 5}–${END_YEAR}) | ${SITE}`, desc: `The fastest rising and fastest falling baby names in the U.S. top 1000, ${END_YEAR - 5} to ${END_YEAR}.`, path: '/trending', body }));
});

// ---------- letter ----------
app.get('/letter/:l', async c => {
  const db = c.env.DB;
  const l = c.req.param('l').toLowerCase();
  if (!/^[a-z]$/.test(l)) return c.notFound();
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
  const st = c.req.param('st').toUpperCase();
  if (!STATES[st]) return c.notFound();
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
};

const NATURE_WORDS = ['flower', 'rose', 'river', 'forest', 'meadow', 'valley', 'mountain', 'sea', 'earth', 'bird', 'deer', 'wolf', 'bear', 'lion', 'spring', 'stone', 'water'];
const CELESTIAL_WORDS = ['moon', 'star', 'sky', 'light', 'dawn', 'heaven'];

// Names whose documented etymology matches any of the group's words (word-boundary checked in JS).
async function meaningGroupList(db, words, sex) {
  const cand = await db.prepare(`SELECT m.slug, m.etymology, n.name, n.total, n.f_total, n.m_total, n.first_year
      FROM meanings m JOIN names n ON n.slug = m.slug
      WHERE (${words.map(() => 'm.etymology LIKE ?').join(' OR ')}) ORDER BY n.total DESC LIMIT 500`)
    .bind(...words.map(w => `%${w}%`)).all();
  const res = words.map(w => new RegExp(`\\b${w}\\b`, 'i'));
  return cand.results
    .filter(r => res.some(re => re.test(r.etymology)))
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
  const letter = /^[a-z]$/.test(c.req.query('letter') || '') ? c.req.query('letter') : null;
  const style = ['popular', 'vintage', 'uncommon'].includes(c.req.query('style')) ? c.req.query('style') : 'popular';
  const mean = MEANING_WORDS.includes(c.req.query('mean')) ? c.req.query('mean') : null;
  const hasQuery = sexQ || letter || c.req.query('style') || mean;
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
    <button class="rounded-full bg-indigo-600 text-white px-6 py-2 text-sm font-semibold hover:bg-indigo-700">Generate names</button>
  </div>
</form>
${results.length ? `<div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${results.map(nameCard).join('')}</div>` : hasQuery ? '<p class="mt-6 text-slate-600">No matches — try a different letter or style.</p>' : ''}
${emailForm()}`;
  return htmlPrivate(c, layout({ title: `Baby Name Generator — Real Names from Real Data | ${SITE}`, desc: 'Generate baby name ideas by gender, style and first letter, drawn from 146 years of U.S. SSA data. No ads, open in Beta.', path: '/generator', body }));
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
  const rows = cand.results.filter(r => re.test(r.etymology)).slice(0, 48);
  const capWord = cap(word);
  const body = `
<h1 class="font-display text-3xl sm:text-4xl font-bold">Names That Mean ${capWord}</h1>
<p class="mt-2 text-slate-600 max-w-2xl">${rows.length} names whose etymology relates to “${word}” — drawn from documented origins, sorted by all-time U.S. popularity.</p>
<div class="mt-6 space-y-3">${rows.map(r => `<div class="rounded-xl bg-white border border-slate-200 p-4 flex flex-wrap items-baseline gap-x-4 gap-y-1"><a href="/name/${r.slug}" class="font-semibold text-indigo-700 hover:underline">${esc(r.name)}</a><span class="text-sm text-slate-600">${esc(r.etymology.length > 180 ? r.etymology.slice(0, 177) + '…' : r.etymology)}</span></div>`).join('')}</div>
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
<p class="mt-4"><a href="/generator" class="inline-block rounded-full bg-indigo-600 text-white px-5 py-2 text-sm font-semibold hover:bg-indigo-700">Try the baby name generator →</a></p>
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
<p class="mt-2">Feedback or data questions: hello@zalize.com</p>
</article>${emailForm()}`,
})));

app.get('/favorites', c => html(c, layout({
  title: `My Shortlist | ${SITE}`,
  desc: 'Your saved baby name shortlist — stored privately in your browser, no account needed.',
  path: '/favorites',
  noindex: true,
  body: `<h1 class="font-display text-3xl sm:text-4xl font-bold">My shortlist</h1>
<p class="mt-2 text-slate-600">Names you save are stored only in this browser — no account, nothing sent to us.</p>
<div id="nc-fav-list" class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"><p class="text-slate-600 col-span-full">Loading…</p></div>
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

app.post('/api/beacon', async c => {
  if (!sameOrigin(c)) return c.body(null, 204);
  try {
    const { p } = await c.req.json();
    // Only count paths that match a real route family, so forged beacons can't pollute analytics.
    const VALID_PATH = /^\/$|^\/(name|letter|year|state|compare|list|meaning|og\/name|og\/list|og\/meaning|og\/compare)\/[a-z0-9'.-]{1,60}$|^\/decade\/\d{4}s$|^\/(top\/girls|top\/boys|trending|unisex|browse|about|privacy|terms|favorites|search|generator|pricing)$/;
    if (typeof p === 'string' && p.length <= 100 && VALID_PATH.test(p) && !(await overQuota(c, 'beacon', 300))) {
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
    urls.push('/', '/top/girls', '/top/boys', '/unisex', '/trending', '/browse', '/generator', '/pricing', '/about', '/privacy', '/terms');
    for (const s of Object.keys(LISTS)) urls.push(`/list/${s}`);
    for (const w of MEANING_WORDS) urls.push(`/meaning/${w}`);
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

app.notFound(c => htmlPrivate(c, layout({ title: 'Page not found | ' + SITE, desc: 'Not found', path: '/404', noindex: true, body: `<div class="text-center py-20"><h1 class="font-display text-3xl sm:text-4xl font-bold">404</h1><p class="mt-2 text-slate-600">That page doesn't exist.</p><a href="/" class="inline-block mt-6 text-indigo-600 hover:underline">← Back to NameChart</a></div>` }), 404));

export default app;
