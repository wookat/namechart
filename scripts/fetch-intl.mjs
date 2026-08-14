// Build data/intl.sql: latest-year top-100 baby name rankings from official
// national statistics offices. Sources, licences and口径: docs/intl-data-sources.md.
// Usage: node scripts/fetch-intl.mjs   (then: wrangler d1 execute namechart --remote --file=data/intl.sql)
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const YEAR = 2025;
const TOP = 100;
const slugify = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z'-]/g, '').slice(0, 40);
const titleCase = s => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const rows = []; // {country, sex, year, rank, name, births}

// ---- England & Wales: ONS xlsx (Table_1 = sheet4), OGL v3 ----
async function ons() {
  const files = {
    f: `https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/birthsdeathsandmarriages/livebirths/datasets/babynamesenglandandwalesbabynamesstatisticsgirls/${YEAR}/${YEAR}girlsbabynames.xlsx`,
    m: `https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/birthsdeathsandmarriages/livebirths/datasets/babynamesenglandandwalesbabynamesstatisticsboys/${YEAR}/${YEAR}boysbabynames.xlsx`,
  };
  const dir = mkdtempSync(join(tmpdir(), 'ons-'));
  for (const [sex, url] of Object.entries(files)) {
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const path = join(dir, sex + '.xlsx');
    writeFileSync(path, buf);
    const sst = [...execFileSync('unzip', ['-p', path, 'xl/sharedStrings.xml'], { maxBuffer: 1 << 26 }).toString()
      .matchAll(/<si>(.*?)<\/si>/gs)].map(m => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(t => t[1]).join(''));
    const sheet = execFileSync('unzip', ['-p', path, 'xl/worksheets/sheet4.xml'], { maxBuffer: 1 << 26 }).toString();
    for (const rm of sheet.matchAll(/<row [^>]*>(.*?)<\/row>/gs)) {
      const cells = {};
      for (const cm of rm[1].matchAll(/<c ([^>]*)>(?:<v>([^<]*)<\/v>)?<\/c>/g)) {
        const col = cm[1].match(/r="([A-Z]+)\d+"/)?.[1];
        if (col) cells[col] = /t="s"/.test(cm[1]) ? sst[Number(cm[2])] : cm[2];
      }
      const rank = Number(cells.A), name = cells.B, count = Number(cells.C);
      if (Number.isInteger(rank) && rank >= 1 && rank <= TOP && name && Number.isFinite(count))
        rows.push({ country: 'gb-ew', sex, year: YEAR, rank, name, births: count });
    }
  }
}

// ---- France: INSEE national CSV (sexe;prenom;periode;valeur;rang), Licence Ouverte ----
async function insee() {
  const zipBuf = Buffer.from(await (await fetch('https://www.insee.fr/fr/statistiques/fichier/8595130/prenoms-2025-nat_csv.zip')).arrayBuffer());
  const dir = mkdtempSync(join(tmpdir(), 'insee-'));
  writeFileSync(join(dir, 'fr.zip'), zipBuf);
  const csv = execFileSync('unzip', ['-p', join(dir, 'fr.zip')], { maxBuffer: 1 << 27 }).toString();
  for (const line of csv.split('\n').slice(1)) {
    const [sexe, prenom, periode, valeur, rang] = line.trim().split(';');
    if (Number(periode) !== YEAR || !prenom || prenom.startsWith('_')) continue;
    const rank = Number(rang);
    if (rank >= 1 && rank <= TOP)
      rows.push({ country: 'fr', sex: sexe === '2' ? 'f' : 'm', year: YEAR, rank, name: titleCase(prenom), births: Number(valeur) });
  }
}

// ---- Ireland: CSO PxStat JSON-stat (VSA50 boys / VSA60 girls, official rank statistic), CC BY 4.0 ----
async function cso() {
  for (const [sex, table] of [['m', 'VSA50'], ['f', 'VSA60']]) {
    const d = await (await fetch(`https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/${table}/JSON-stat/2.0/en`)).json();
    // category.index may be an array of keys or a key→position map; normalize to a map.
    const pos = cat => Array.isArray(cat.index) ? Object.fromEntries(cat.index.map((k, i) => [k, i])) : cat.index;
    const [statDim, timeDim, nameDim] = d.id;
    const stats = d.dimension[statDim].category, statPos = pos(stats);
    const rankStat = Object.keys(stats.label).find(k => /rank/i.test(stats.label[k]));
    const years = d.dimension[timeDim].category, yearPos = pos(years);
    const year = Math.max(...Object.keys(years.label).map(Number));
    const names = d.dimension[nameDim].category, namePos = pos(names);
    const nameKeys = Object.keys(namePos);
    const [, nYear, nName] = d.size;
    const iStat = statPos[rankStat], iYear = yearPos[String(year)];
    const countStat = Object.keys(stats.label).find(k => k !== rankStat);
    const iCount = statPos[countStat];
    for (const nk of nameKeys) {
      const iName = namePos[nk];
      const rank = d.value[(iStat * nYear + iYear) * nName + iName];
      if (rank >= 1 && rank <= TOP)
        rows.push({ country: 'ie', sex, year, rank, name: names.label[nk], births: d.value[(iCount * nYear + iYear) * nName + iName] ?? null });
    }
  }
}

// ---- Norway: SSB table 10467 JSON-stat2 (name code prefix 1=girls 2=boys), NLOD/CC BY ----
async function ssb() {
  const res = await fetch('https://data.ssb.no/api/v0/en/table/10467', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: [{ code: 'Fornavn', selection: { filter: 'all', values: ['*'] } }, { code: 'ContentsCode', selection: { filter: 'item', values: ['Personer'] } }, { code: 'Tid', selection: { filter: 'item', values: [String(YEAR)] } }], response: { format: 'json-stat2' } }),
  });
  const d = await res.json();
  const names = d.dimension.Fornavn.category;
  const bySex = { f: [], m: [] };
  for (const [code, idx] of Object.entries(names.index)) {
    const count = d.value[idx];
    if (count > 0) bySex[code.startsWith('1') ? 'f' : 'm'].push({ name: names.label[code], count });
  }
  for (const [sex, list] of Object.entries(bySex)) {
    list.sort((a, b) => b.count - a.count);
    let rank = 0, prev = -1;
    list.forEach((e, i) => {
      if (e.count !== prev) { rank = i + 1; prev = e.count; }
      if (rank <= TOP) rows.push({ country: 'no', sex, year: YEAR, rank, name: e.name, births: e.count });
    });
  }
}

await Promise.all([ons(), insee(), cso(), ssb()]);
const q = s => `'${String(s).replace(/'/g, "''")}'`;
const sql = ['DELETE FROM intl_ranks;'];
for (const r of rows.sort((a, b) => a.country.localeCompare(b.country) || a.sex.localeCompare(b.sex) || a.rank - b.rank))
  sql.push(`INSERT INTO intl_ranks (country,sex,year,rank,name,slug,births) VALUES (${q(r.country)},${q(r.sex)},${r.year},${r.rank},${q(r.name)},${q(slugify(r.name))},${r.births ?? 'NULL'});`);
writeFileSync('data/intl.sql', sql.join('\n') + '\n');
const summary = {};
for (const r of rows) summary[r.country + '/' + r.sex] = (summary[r.country + '/' + r.sex] || 0) + 1;
console.log(summary, 'total', rows.length);
