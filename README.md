# Brooklyn Asks

Brooklyn Asks is an independent public-interest tracker for Brooklyn Community Board budget requests, agency responses, and recurring neighborhood priorities.

## What it does

- Loads the current NYC Register of Community Board Budget Requests.
- Filters to Brooklyn's 18 Community Boards.
- Preserves tracking codes, source dates, source links, board, agency, and priority.
- Reconstructs historical Community District Needs / Budget Request records from official sources.
- Flags recurring themes conservatively across fiscal years.
- Provides archive, history, map, sharing, feedback, contribution, and legal/privacy views.

## Historical coverage

Official source coverage is continuous from **FY2016 through FY2026**. Brooklyn Asks maintains a source manifest for all 11 fiscal years and links each year to the corresponding NYC Planning / Community District Needs archive.

Request-level normalization is still partial by year. FY2016-FY2019 and selected FY2025-FY2026 records are already extracted; FY2020-FY2024 source sets are indexed and queued for granular extraction. The interface distinguishes source coverage from extracted records so missing rows are never presented as missing public needs.

## Data sources

- NYC Open Data — Register of Community Board Budget Requests (`vn4m-mk4t`)
- NYC Department of City Planning — Community District boundaries (`5crt-au7u`)
- NYC Planning `labs-cd-needs-statements` historical archive
- Official Brooklyn Community Board District Needs / Budget Request documents

City agencies remain the authoritative source for City data. Brooklyn Asks is an unofficial reading and research aid.

## Methodology

An agency response is not proof that a project was physically funded, built, or completed. Published response, derived classification, recurring-theme matching, source coverage, and independently verified real-world outcome are separate facts.

## Run locally

```bash
cd public
python -m http.server 8788
```

Open `http://localhost:8788`.

## Deploy

```bash
npx wrangler pages deploy public --project-name brooklyn-asks
```

## Contributing

Corrections and contributions are welcome. Preserve source URLs, fiscal-year context, and provenance for factual records.

https://github.com/bpiper02/brooklyn-asks

## License

Application code is MIT licensed. Source data remains subject to the terms and ownership of its originating public agencies. See `public/legal.html` for notices and source-use notes.
