// Fetch notable people per given name from Wikidata (CC0) and emit SQL for the
// `famous` table. Usage: CF_TOKEN=... CF_ACCOUNT=... CF_DB=... node scripts/fetch-famous.mjs [limit]
import { writeFile, mkdir } from 'node:fs/promises';

const LIMIT = Number(process.argv[2] || 1500);
const BATCH = 10;
const OUT = 'data/famous';
const UA = 'NameChartBot/1.0 (https://namechart.zalize.com; hello@zalize.com)';

async function d1(sql) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT}/d1/database/${process.env.CF_DB}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  const j = await res.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result[0].results;
}

async function sparql(query) {
  for (let a = 0; a < 4; a++) {
    const res = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), {
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
    });
    if (res.ok) return (await res.json()).results.bindings;
    await new Promise(r => setTimeout(r, 5000 * (a + 1)));
  }
  throw new Error('sparql failed');
}

const names = await d1(`SELECT slug, name FROM names ORDER BY total DESC LIMIT ${LIMIT}`);
console.log(`querying wikidata for ${names.length} names in batches of ${BATCH}`);

const bySlug = {};
for (let i = 0; i < names.length; i += BATCH) {
  const batch = names.slice(i, i + BATCH);
  const values = batch.map(n => `"${n.name.replace(/"/g, '')}"@en`).join(' ');
  const q = `SELECT ?gname ?personLabel ?desc ?links WHERE {
    VALUES ?gname { ${values} }
    ?gn rdfs:label ?gname . ?gn wdt:P31/wdt:P279* wd:Q202444 .
    ?person p:P735 ?st ; wikibase:sitelinks ?links .
    ?st ps:P735 ?gn .
    OPTIONAL { ?st pq:P1545 ?ord }
    FILTER(!BOUND(?ord) || ?ord = "1")
    FILTER(?links >= 25)
    OPTIONAL { ?person schema:description ?desc . FILTER(LANG(?desc) = "en") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY DESC(?links) LIMIT 300`;
  try {
    const rows = await sparql(q);
    for (const row of rows) {
      const gname = row.gname.value;
      const n = batch.find(b => b.name === gname);
      if (!n) continue;
      const arr = (bySlug[n.slug] ||= []);
      const label = row.personLabel?.value || '';
      if (!label || /^Q\d+$/.test(label) || arr.length >= 4 || arr.some(p => p.n === label)) continue;
      arr.push({ n: label, d: (row.desc?.value || '').slice(0, 120), l: Number(row.links.value) });
    }
    console.log(`${i + batch.length}/${names.length} — ${Object.keys(bySlug).length} names with people`);
  } catch (e) {
    console.error(`batch ${i}: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 1200));
}

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/raw.json`, JSON.stringify(bySlug, null, 1));
const q = s => `'${String(s).replace(/'/g, "''")}'`;
const lines = [
  'CREATE TABLE IF NOT EXISTS famous (slug TEXT PRIMARY KEY, people TEXT);',
  ...Object.entries(bySlug).map(([slug, people]) =>
    `INSERT OR REPLACE INTO famous (slug, people) VALUES (${q(slug)}, ${q(JSON.stringify(people))});`),
];
await writeFile(`${OUT}/famous.sql`, lines.join('\n') + '\n');
console.log(`wrote ${Object.keys(bySlug).length} rows to ${OUT}/famous.sql`);
