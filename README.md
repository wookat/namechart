# NameChart

Baby name popularity charts, rankings & insights from 146 years of official U.S. birth data (SSA, public domain). Free, no ads, no paywall.

Live: https://namechart.zalize.com

## Stack
- Cloudflare Workers (Hono, SSR) + D1 + static assets
- Tailwind CSS v4

## Develop
```bash
npm install
npm run build:css          # tailwind -> public/styles.css
npm run build:data         # SSA files -> data/seed/*.sql (needs ~/data/ssa-names + ~/data/ssa-states)
npx wrangler d1 execute namechart --local --file data/seed/schema.sql   # then each seed_*.sql
npm run dev
```

## Deploy
```bash
npm run deploy             # requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
```

Data source: https://www.ssa.gov/oact/babynames/ (names.zip, namesbystate.zip)
