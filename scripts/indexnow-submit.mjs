#!/usr/bin/env node
// Submits URLs to IndexNow. Usage: node scripts/indexnow-submit.mjs [maxNameUrls]
// Reads INDEXNOW_KEY from wrangler.toml [vars].

import { readFileSync } from 'node:fs';

const ORIGIN = 'https://namechart.zalize.com';
const key = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8').match(/INDEXNOW_KEY = "([a-f0-9]+)"/)[1];
const maxNames = Number(process.argv[2] ?? 2000);

const urls = ['/', '/top/girls', '/top/boys', '/unisex', '/trending', '/browse', '/about'];
for (const ch of 'abcdefghijklmnopqrstuvwxyz') urls.push(`/letter/${ch}`);
for (let y = 1880; y <= 2025; y++) urls.push(`/year/${y}`);
for (let d = 1880; d <= 2020; d += 10) urls.push(`/decade/${d}s`);

// top N name pages from the live sitemap shards
const shard = await (await fetch(`${ORIGIN}/sitemaps/names-0.xml`)).text();
const names = [...shard.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).slice(0, maxNames);

const full = [...urls.map(u => ORIGIN + u), ...names];
for (let i = 0; i < full.length; i += 10000) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'namechart.zalize.com', key, keyLocation: `${ORIGIN}/${key}.txt`, urlList: full.slice(i, i + 10000) }),
  });
  console.log(`batch ${i / 10000}: ${res.status}`);
}
console.log(`submitted ${full.length} urls`);
