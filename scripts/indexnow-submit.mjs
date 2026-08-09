#!/usr/bin/env node
// Submits URLs to IndexNow. Usage: node scripts/indexnow-submit.mjs [maxNameUrls]
// Reads INDEXNOW_KEY from wrangler.toml [vars].

import { readFileSync } from 'node:fs';

const ORIGIN = 'https://namechart.zalize.com';
const key = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8').match(/INDEXNOW_KEY = "([a-f0-9]+)"/)[1];
const maxNames = Number(process.argv[2] ?? 2000);

const urls = ['/', '/top/girls', '/top/boys', '/unisex', '/trending', '/browse', '/about'];
for (const s of ['vintage-girl-names', 'vintage-boy-names', 'timeless-girl-names', 'timeless-boy-names', 'new-girl-names', 'new-boy-names', 'short-girl-names', 'short-boy-names', 'long-girl-names', 'long-boy-names', 'nature-girl-names', 'nature-boy-names', 'celestial-girl-names', 'celestial-boy-names', 'royal-girl-names', 'royal-boy-names', 'virtue-girl-names', 'virtue-boy-names', 'warrior-girl-names', 'warrior-boy-names', 'divine-girl-names', 'divine-boy-names']) urls.push(`/list/${s}`);
for (const w of ['moon', 'light', 'star', 'love', 'strong', 'fire', 'peace', 'king', 'flower', 'sea', 'beautiful', 'brave', 'joy', 'grace', 'warrior', 'night',
  'bright', 'water', 'ruler', 'victory', 'noble', 'life', 'earth', 'heaven', 'rose', 'white', 'wolf', 'lion', 'queen', 'holy', 'river', 'stone', 'bear', 'honor',
  'sky', 'pearl', 'black', 'red', 'prince', 'beloved', 'gracious', 'glory', 'dark', 'song', 'dawn', 'forest', 'valley', 'meadow', 'bird', 'spring', 'crown', 'pure', 'deer', 'mountain']) urls.push(`/meaning/${w}`);
for (const ch of 'abcdefghijklmnopqrstuvwxyz') urls.push(`/letter/${ch}`);
for (let y = 1880; y <= 2025; y++) urls.push(`/year/${y}`);
for (let d = 1880; d <= 2020; d += 10) urls.push(`/decade/${d}s`);

// name pages from the live sitemap shards, offset by --skip to page through batches
const skip = Number(process.argv[3] ?? 0);
const names = [];
for (let sh = 0; names.length < skip + maxNames; sh++) {
  const res = await fetch(`${ORIGIN}/sitemaps/names-${sh}.xml`);
  if (!res.ok) break;
  names.push(...[...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
}
const batch = names.slice(skip, skip + maxNames);

const full = [...urls.map(u => ORIGIN + u), ...batch];
for (let i = 0; i < full.length; i += 10000) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'namechart.zalize.com', key, keyLocation: `${ORIGIN}/${key}.txt`, urlList: full.slice(i, i + 10000) }),
  });
  console.log(`batch ${i / 10000}: ${res.status}`);
}
console.log(`submitted ${full.length} urls`);
