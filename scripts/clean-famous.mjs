// One-off/repeatable cleanup: remove blocked figures from existing `famous` rows in D1.
// Usage: CF_TOKEN=... CF_ACCOUNT=... CF_DB=... node scripts/clean-famous.mjs
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

const rows = await d1('SELECT slug, people FROM famous');
console.log(`scanning ${rows.length} rows`);
const q = s => `'${String(s).replace(/'/g, "''")}'`;
let removedPeople = 0, changedRows = 0;
const stmts = [];
for (const row of rows) {
  let people;
  try { people = JSON.parse(row.people); } catch { continue; }
  const kept = people.filter(p => !isBlocked(p));
  if (kept.length === people.length) continue;
  changedRows++;
  removedPeople += people.length - kept.length;
  for (const p of people.filter(x => isBlocked(x))) console.log(`- ${row.slug}: ${p.n} (${p.d})`);
  stmts.push(kept.length
    ? `UPDATE famous SET people = ${q(JSON.stringify(kept))} WHERE slug = ${q(row.slug)};`
    : `DELETE FROM famous WHERE slug = ${q(row.slug)};`);
}
console.log(`${changedRows} rows changed, ${removedPeople} people removed`);
for (let i = 0; i < stmts.length; i += 50) await d1(stmts.slice(i, i + 50).join('\n'));
console.log('done');
