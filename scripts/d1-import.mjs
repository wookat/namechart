#!/usr/bin/env node
// Imports a SQL file into a remote D1 database via the official import API.
// Usage: CF_TOKEN=... CF_ACCOUNT=... CF_DB=... node scripts/d1-import.mjs <file.sql>

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [file] = process.argv.slice(2);
const { CF_TOKEN, CF_ACCOUNT, CF_DB } = process.env;
if (!file || !CF_TOKEN || !CF_ACCOUNT || !CF_DB) { console.error('missing args/env'); process.exit(1); }

const base = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${CF_DB}/import`;
const hdrs = { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' };
const api = async body => {
  const r = await fetch(base, { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result;
};

const data = readFileSync(file);
const etag = createHash('md5').update(data).digest('hex');

const init = await api({ action: 'init', etag });
if (init.upload_url) {
  const up = await fetch(init.upload_url, { method: 'PUT', body: data });
  if (!up.ok) throw new Error('upload failed ' + up.status);
  const upEtag = (up.headers.get('etag') || '').replace(/"/g, '');
  if (upEtag !== etag) throw new Error(`etag mismatch ${upEtag} != ${etag}`);
  const ing = await api({ action: 'ingest', etag, filename: init.filename });
  globalThis.__bm = ing.at_bookmark ?? null;
}
let bookmark = globalThis.__bm ?? null;
for (;;) {
  const r = await api(bookmark ? { action: 'poll', current_bookmark: bookmark } : { action: 'poll' });
  bookmark = r.at_bookmark ?? bookmark;
  if (r.error) throw new Error(r.error);
  const st = r.status || (r.success && r.result?.final ? 'complete' : '');
  process.stdout.write(`\r${st || 'polling'} ${JSON.stringify(r.messages?.slice(-1) ?? '')}        `);
  if (st === 'complete' || r.result?.final || r.success && r.messages?.some(m => /finished/i.test(m))) break;
  await new Promise(res => setTimeout(res, 2000));
}
console.log('\nimport done:', file);
