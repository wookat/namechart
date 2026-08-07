-- Expression index so the rhyme lookup (same last-3 slug chars) avoids a full table scan.
CREATE INDEX IF NOT EXISTS idx_names_end3 ON names(substr(slug,-3));
