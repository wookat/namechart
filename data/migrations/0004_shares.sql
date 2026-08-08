-- Shared shortlists: anonymous, revocable via a creator-held token.
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  slugs TEXT NOT NULL,
  token TEXT NOT NULL,
  created TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
