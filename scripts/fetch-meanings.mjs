#!/usr/bin/env node
// Fetches etymology + pronunciation for the most popular names from English Wiktionary
// (CC BY-SA 4.0 — attribution and share-alike are rendered on every name page).
// Usage: CF=<token> node scripts/fetch-meanings.mjs [limit] [concurrency]
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';

const LIMIT = Number(process.argv[2] || 6000);
const CONC = Number(process.argv[3] || 8);
const OUT = new URL('../data/meanings/', import.meta.url).pathname;
const CACHE = OUT + 'raw.json';
mkdirSync(OUT, { recursive: true });

const ACCOUNT = 'ddff52d24ee44e21a021c15eaffcc86d';
const DB = '6f658ccd-7d51-4de7-8eb7-b643fc1a4e97';
const UA = 'NameChart/1.0 (https://namechart.zalize.com; hello@zalize.com)';

async function d1(sql) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CF}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result[0].results;
}

async function wikitext(name) {
  const u = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(name)}&prop=wikitext&format=json&formatversion=2&redirects=1`;
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (r.status === 429 || r.status >= 500) throw new Error('throttled ' + r.status);
  const j = await r.json();
  if (j?.error?.code === 'missingtitle') return null;
  if (j?.parse?.wikitext === undefined) throw new Error('bad response');
  return j.parse.wikitext;
}

// Renders a batch of wikitext snippets in one API call so template markup becomes prose.
async function expand(snippets) {
  const SEP = '\n@@@\n';
  const body = new URLSearchParams({
    action: 'expandtemplates', format: 'json', formatversion: '2', prop: 'wikitext',
    text: snippets.join(SEP),
  });
  const r = await fetch('https://en.wiktionary.org/w/api.php', {
    method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json();
  return (j?.expandtemplates?.wikitext || '').split('@@@').map(s => s.trim());
}

const stripWiki = s => s
  .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
  .replace(/'''?/g, '')
  .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function parseEnglish(wt) {
  const start = wt.indexOf('==English==');
  if (start < 0) return null;
  const rest = wt.slice(start + 11);
  const end = rest.search(/\n==[^=]/);
  const en = end < 0 ? rest : rest.slice(0, end);
  if (!/\{\{given name/.test(en)) return null; // only real given-name entries

  const ety = (en.match(/===+\s*Etymology[^=]*===+\n([\s\S]*?)(?=\n===|$)/) || [])[1] || '';
  const etyLines = ety
    .replace(/\[\[File:[\s\S]*?\]\]\s*/g, '')
    .split('\n')
    .filter(l => l.trim() && !/^\{\{(ety\||etymon|root|wikipedia|wp|rfe|attention|C\||cln|catlangname|topics|multiple image)/i.test(l.trim()))
    .join(' ')
    .replace(/\{\{(etymon|root)[^}]*\}\}\s*/gi, '');
  const ipa = (en.match(/\{\{IPA\|en\|(\/[^|}]+\/)/) || [])[1] || '';
  const gn = (en.match(/\{\{given name\|en\|([^}]*)\}\}/) || [])[1] || '';
  const genders = /female/.test(gn) && /male/.test(gn.replace('female', '')) ? 'unisex'
    : /female/.test(gn) ? 'female' : /male/.test(gn) ? 'male' : '';
  const from = (gn.match(/from=([^|}]+)/) || [])[1] || '';
  const dim = (gn.match(/dim(?:inutive)?=([^|}]+)/) || [])[1] || '';
  return { etyRaw: etyLines, ipa, genders, from, dim };
}

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

const names = await d1(`SELECT slug, name FROM names ORDER BY total DESC LIMIT ${LIMIT}`);
console.log(`candidates: ${names.length}, cached: ${Object.keys(cache).length}`);

const todo = names.filter(n => cache[n.slug] === undefined);
let done = 0;
async function worker(queue) {
  while (queue.length) {
    const n = queue.shift();
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const wt = await wikitext(n.name);
        cache[n.slug] = wt ? parseEnglish(wt) : null;
        ok = true;
      } catch { await new Promise(res => setTimeout(res, 1000 * (attempt + 1))); }
    }
    if (++done % 200 === 0) { console.log(`fetched ${done}/${todo.length}`); writeFileSync(CACHE, JSON.stringify(cache)); }
  }
}
await Promise.all(Array.from({ length: CONC }, () => worker(todo)));
writeFileSync(CACHE, JSON.stringify(cache));

// Expand templates in batches, then emit SQL.
const withEty = names.filter(n => cache[n.slug]?.etyRaw);
console.log(`entries with etymology: ${withEty.length}`);
const BATCH = 25;
for (let i = 0; i < withEty.length; i += BATCH) {
  const chunk = withEty.slice(i, i + BATCH).filter(n => cache[n.slug].ety === undefined);
  if (!chunk.length) continue;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const rendered = await expand(chunk.map(n => cache[n.slug].etyRaw));
      if (rendered.length === chunk.length) {
        chunk.forEach((n, k) => { cache[n.slug].ety = stripWiki(rendered[k] || '').slice(0, 600); });
      } else {
        for (const n of chunk) {
          const one = await expand([cache[n.slug].etyRaw]);
          cache[n.slug].ety = stripWiki(one[0] || '').slice(0, 600);
        }
      }
      break;
    } catch { await new Promise(res => setTimeout(res, 2000 * (attempt + 1))); }
  }
  if (i % 500 === 0) { console.log(`expanded ${i}/${withEty.length}`); writeFileSync(CACHE, JSON.stringify(cache)); }
}
writeFileSync(CACHE, JSON.stringify(cache));

const esc = s => `'${String(s).replace(/'/g, "''")}'`;
const rows = [];
for (const n of names) {
  const c = cache[n.slug];
  if (!c || (!c.ety && !c.ipa)) continue;
  rows.push(`(${esc(n.slug)},${esc(c.ety || '')},${esc(c.ipa || '')},${esc(c.genders || '')},${esc(c.from || '')},${esc(c.dim || '')})`);
}
const sql = ['CREATE TABLE IF NOT EXISTS meanings (slug TEXT PRIMARY KEY, etymology TEXT, ipa TEXT, wiktionary_gender TEXT, origin TEXT, diminutive_of TEXT);'];
for (let i = 0; i < rows.length; i += 200) {
  sql.push(`INSERT OR REPLACE INTO meanings (slug,etymology,ipa,wiktionary_gender,origin,diminutive_of) VALUES\n${rows.slice(i, i + 200).join(',\n')};`);
}
writeFileSync(OUT + 'meanings.sql', sql.join('\n'));
console.log(`wrote ${rows.length} meaning rows to data/meanings/meanings.sql`);
