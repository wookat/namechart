-- Latest-year top-100 name rankings from official national statistics offices.
-- Sources & licences: docs/intl-data-sources.md. Same region×sex×year×rank shape as state_ranks.
CREATE TABLE IF NOT EXISTS intl_ranks (
  country TEXT NOT NULL,
  sex TEXT NOT NULL,
  year INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  births INTEGER,
  PRIMARY KEY (country, sex, year, rank, name)
);
CREATE INDEX IF NOT EXISTS idx_intl_slug ON intl_ranks (slug);
