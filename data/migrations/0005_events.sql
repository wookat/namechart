-- Day-level event counts (no user identifiers), e.g. visit_new / visit_returning.
CREATE TABLE IF NOT EXISTS events (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (day, event)
);
