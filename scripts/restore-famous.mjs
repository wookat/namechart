// Rebuild `famous` rows from data/famous/raw.json applying the current content-safety
// filter (used to restore rows after a filter refinement).
import { readFile } from 'node:fs/promises';
const NEGATIVE_FIGURE_RE = /serial killer|murder|assassin|criminal|\brapist|sex offender|p(?:a|ae)?edophile|terroris|nazi|dictator|kidnapp|cult leader|mobster|gangster|mob boss|crime boss|drug (?:lord|trafficker|kingpin)|fraudster|ponzi|molest|genocide|warlord|hijack|cannibal|bank robber|human traffick|poisoner|mass shooting|school shooter/i;
const BLOCKED_FAMOUS = new Set(['ted bundy', 'ted kaczynski', 'adolf hitler', 'jeffrey dahmer', 'charles manson', 'john wayne gacy', 'osama bin laden', 'joseph stalin', 'pol pot', 'harold shipman', 'anders behring breivik', 'timothy mcveigh', 'lee harvey oswald', 'aileen wuornos', 'richard ramirez', 'dennis rader', 'gary ridgway', 'david berkowitz']);
const FIGURE_EXCEPTION_RE = /anti-nazi|resistance|victim|survivor/i;
const isBlocked = p => (NEGATIVE_FIGURE_RE.test(p.d || '') && !FIGURE_EXCEPTION_RE.test(p.d || '')) || BLOCKED_FAMOUS.has((p.n || '').toLowerCase());

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

const slugs = process.argv.slice(2);
const raw = JSON.parse(await readFile('data/famous/raw.json', 'utf8'));
const q = s => `'${String(s).replace(/'/g, "''")}'`;
const stmts = [];
for (const slug of slugs) {
  const people = (raw[slug] || []).filter(p => !isBlocked(p));
  for (const p of (raw[slug] || []).filter(isBlocked)) console.log(`blocked ${slug}: ${p.n}`);
  stmts.push(people.length
    ? `INSERT OR REPLACE INTO famous (slug, people) VALUES (${q(slug)}, ${q(JSON.stringify(people))});`
    : `DELETE FROM famous WHERE slug = ${q(slug)};`);
}
for (let i = 0; i < stmts.length; i += 50) await d1(stmts.slice(i, i + 50).join('\n'));
console.log(`restored ${slugs.length} rows`);
