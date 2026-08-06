-- Round 1 gate fixes: subscriber provenance, write rate limits, remove non-name source artifacts.
ALTER TABLE subscribers ADD COLUMN source TEXT;
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER DEFAULT 0);
DELETE FROM names WHERE slug IN ('unknown','unnamed','noname','notnamed','baby','babyboy','babygirl','infant','male','female','child','twin','twina','twinb');
DELETE FROM year_ranks WHERE name IN ('Unknown','Unnamed','Noname','Notnamed','Baby','Babyboy','Babygirl','Infant','Male','Female','Child','Twin','Twina','Twinb');
DELETE FROM decade_ranks WHERE name IN ('Unknown','Unnamed','Noname','Notnamed','Baby','Babyboy','Babygirl','Infant','Male','Female','Child','Twin','Twina','Twinb');
DELETE FROM state_ranks WHERE name IN ('Unknown','Unnamed','Noname','Notnamed','Baby','Babyboy','Babygirl','Infant','Male','Female','Child','Twin','Twina','Twinb');
-- Audit/QA test artifacts written during the gate reviews.
DELETE FROM subscribers WHERE email LIKE '%@example.com' OR email LIKE '%@example.invalid';
DELETE FROM hits WHERE path LIKE '/devin-audit%';
