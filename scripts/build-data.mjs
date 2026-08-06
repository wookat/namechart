#!/usr/bin/env node
// Builds D1 seed SQL from SSA baby-name data.
// Inputs:  DATA_DIR (default ~/data/ssa-names)  — yobYYYY.txt files: Name,Sex,Count
//          STATE_DIR (default ~/data/ssa-states) — XX.TXT files: State,Sex,Year,Name,Count
// Output:  data/seed/*.sql  (schema + batched inserts)

import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DATA_DIR = process.env.DATA_DIR || join(homedir(), 'data/ssa-names');
const STATE_DIR = process.env.STATE_DIR || join(homedir(), 'data/ssa-states');
const OUT_DIR = new URL('../data/seed/', import.meta.url).pathname;
mkdirSync(OUT_DIR, { recursive: true });

// Source artifacts that are not real names.
const NOT_NAMES = new Set(['Unknown', 'Unnamed', 'Noname', 'Notnamed', 'Baby', 'Babyboy', 'Babygirl', 'Infant', 'Male', 'Female', 'Child', 'Twin', 'Twina', 'Twinb']);

const yobFiles = readdirSync(DATA_DIR).filter(f => /^yob\d{4}\.txt$/.test(f)).sort();
const years = yobFiles.map(f => Number(f.slice(3, 7)));
const START = years[0], END = years[years.length - 1];
const NY = END - START + 1;
console.log(`Years ${START}-${END}`);

// name -> { f: Int32Array, m: Int32Array }
const names = new Map();
for (const f of yobFiles) {
  const year = Number(f.slice(3, 7));
  const idx = year - START;
  for (const line of readFileSync(join(DATA_DIR, f), 'utf8').split('\n')) {
    if (!line) continue;
    const [name, sex, cnt] = line.trim().split(',');
    if (!name || !sex || !cnt || NOT_NAMES.has(name)) continue;
    let rec = names.get(name);
    if (!rec) { rec = { f: new Int32Array(NY), m: new Int32Array(NY) }; names.set(name, rec); }
    rec[sex === 'F' ? 'f' : 'm'][idx] += Number(cnt);
  }
}
console.log(`Unique names: ${names.size}`);

// per-year ranks (full, for name pages we store latest ranks; year_ranks table keeps top 1000)
const yearRanks = new Map(); // `${year}|${sex}` -> [ [name,count], ... ] sorted
for (let y = START; y <= END; y++) {
  const idx = y - START;
  for (const sex of ['f', 'm']) {
    const arr = [];
    for (const [name, rec] of names) { const c = rec[sex][idx]; if (c > 0) arr.push([name, c]); }
    arr.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    yearRanks.set(`${y}|${sex}`, arr);
  }
}

// rank lookup for latest year and peak
function rankOf(year, sex, name) {
  const arr = yearRanks.get(`${year}|${sex}`);
  for (let i = 0; i < arr.length; i++) if (arr[i][0] === name) return i + 1;
  return null;
}
// build rank maps for latest year only (fast)
const latestRank = { f: new Map(), m: new Map() };
for (const sex of ['f', 'm']) {
  const arr = yearRanks.get(`${END}|${sex}`);
  arr.forEach(([n], i) => latestRank[sex].set(n, i + 1));
}

const esc = s => `'${String(s).replace(/'/g, "''")}'`;
const trim = a => { // trim trailing zeros run-length: store as JSON array from first_year
  let lo = 0, hi = a.length - 1;
  while (lo <= hi && a[lo] === 0) lo++;
  while (hi >= lo && a[hi] === 0) hi--;
  return { off: lo, arr: Array.from(a.slice(lo, hi + 1)) };
};

const files = [];
let buf = [`PRAGMA defer_foreign_keys=on;`];
let fileNo = 0, stmts = 0;
function flush(force = false) {
  if (buf.length > 1 && (force || buf.length >= 400)) {
    const p = join(OUT_DIR, `seed_${String(fileNo).padStart(3, '0')}.sql`);
    writeFileSync(p, buf.join('\n'));
    files.push(p); fileNo++; buf = [];
  }
}

writeFileSync(join(OUT_DIR, 'schema.sql'), `
DROP TABLE IF EXISTS names;
CREATE TABLE names (
  slug TEXT PRIMARY KEY, name TEXT NOT NULL, total INTEGER, f_total INTEGER, m_total INTEGER,
  first_year INTEGER, last_year INTEGER, peak_year INTEGER, peak_count INTEGER,
  latest_rank_f INTEGER, latest_rank_m INTEGER, series TEXT
);
CREATE INDEX idx_names_total ON names(total DESC);
DROP TABLE IF EXISTS year_ranks;
CREATE TABLE year_ranks (year INTEGER, sex TEXT, rank INTEGER, name TEXT, count INTEGER, PRIMARY KEY(year,sex,rank));
DROP TABLE IF EXISTS decade_ranks;
CREATE TABLE decade_ranks (decade INTEGER, sex TEXT, rank INTEGER, name TEXT, count INTEGER, PRIMARY KEY(decade,sex,rank));
DROP TABLE IF EXISTS state_ranks;
CREATE TABLE state_ranks (state TEXT, sex TEXT, rank INTEGER, name TEXT, count INTEGER, PRIMARY KEY(state,sex,rank));
CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')), source TEXT);
CREATE TABLE IF NOT EXISTS hits (day TEXT, path TEXT, count INTEGER DEFAULT 0, PRIMARY KEY(day,path));
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER DEFAULT 0);
`);

let rows = [];
for (const [name, rec] of names) {
  const fT = rec.f.reduce((a, b) => a + b, 0), mT = rec.m.reduce((a, b) => a + b, 0);
  const total = fT + mT;
  const comb = rec.f.map((v, i) => v + rec.m[i]);
  let peakIdx = 0; comb.forEach((v, i) => { if (v > comb[peakIdx]) peakIdx = i; });
  let first = comb.findIndex(v => v > 0), last = comb.length - 1;
  while (last > 0 && comb[last] === 0) last--;
  const sf = trim(rec.f), sm = trim(rec.m);
  const series = JSON.stringify({ s: START, f: [sf.off, sf.arr], m: [sm.off, sm.arr] });
  const slug = name.toLowerCase();
  rows.push(`(${esc(slug)},${esc(name)},${total},${fT},${mT},${START + first},${START + last},${START + peakIdx},${comb[peakIdx]},${latestRank.f.get(name) ?? 'NULL'},${latestRank.m.get(name) ?? 'NULL'},${esc(series)})`);
  if (rows.length === 50) {
    buf.push(`INSERT OR REPLACE INTO names VALUES ${rows.join(',')};`); rows = []; stmts++; flush();
  }
}
if (rows.length) buf.push(`INSERT OR REPLACE INTO names VALUES ${rows.join(',')};`);

// year_ranks top 1000
rows = [];
for (let y = START; y <= END; y++) for (const sex of ['f', 'm']) {
  const arr = yearRanks.get(`${y}|${sex}`).slice(0, 1000);
  arr.forEach(([n, c], i) => {
    rows.push(`(${y},${esc(sex.toUpperCase())},${i + 1},${esc(n)},${c})`);
    if (rows.length === 100) { buf.push(`INSERT OR REPLACE INTO year_ranks VALUES ${rows.join(',')};`); rows = []; flush(); }
  });
}
if (rows.length) { buf.push(`INSERT OR REPLACE INTO year_ranks VALUES ${rows.join(',')};`); rows = []; }

// decade_ranks top 200
for (let d = Math.floor(START / 10) * 10; d <= END; d += 10) {
  for (const sex of ['f', 'm']) {
    const agg = new Map();
    for (let y = Math.max(d, START); y <= Math.min(d + 9, END); y++) {
      for (const [n, c] of yearRanks.get(`${y}|${sex}`)) agg.set(n, (agg.get(n) || 0) + c);
    }
    const arr = [...agg].sort((a, b) => b[1] - a[1]).slice(0, 200);
    arr.forEach(([n, c], i) => {
      rows.push(`(${d},${esc(sex.toUpperCase())},${i + 1},${esc(n)},${c})`);
      if (rows.length === 100) { buf.push(`INSERT OR REPLACE INTO decade_ranks VALUES ${rows.join(',')};`); rows = []; flush(); }
    });
  }
}
if (rows.length) { buf.push(`INSERT OR REPLACE INTO decade_ranks VALUES ${rows.join(',')};`); rows = []; }

// state_ranks: latest year top 100 per state per sex
try {
  for (const f of readdirSync(STATE_DIR).filter(f => /^[A-Z]{2}\.TXT$/.test(f))) {
    const state = f.slice(0, 2);
    const bySex = { F: [], M: [] };
    for (const line of readFileSync(join(STATE_DIR, f), 'utf8').split('\n')) {
      if (!line) continue;
      const [st, sex, year, name, cnt] = line.trim().split(',');
      if (Number(year) === END) bySex[sex]?.push([name, Number(cnt)]);
    }
    for (const sex of ['F', 'M']) {
      bySex[sex].sort((a, b) => b[1] - a[1]);
      bySex[sex].slice(0, 100).forEach(([n, c], i) => {
        rows.push(`(${esc(state)},${esc(sex)},${i + 1},${esc(n)},${c})`);
        if (rows.length === 100) { buf.push(`INSERT OR REPLACE INTO state_ranks VALUES ${rows.join(',')};`); rows = []; flush(); }
      });
    }
  }
} catch (e) { console.warn('state data skipped:', e.message); }
if (rows.length) buf.push(`INSERT OR REPLACE INTO state_ranks VALUES ${rows.join(',')};`);
flush(true);
console.log(`Wrote ${files.length + 1} SQL files to ${OUT_DIR}`);
