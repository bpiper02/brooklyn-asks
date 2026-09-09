# Brooklyn Asks

Brooklyn Asks is an independent public-interest tracker for Brooklyn Community Board budget requests, agency responses, and recurring neighborhood priorities.

## What it does

- Loads the current NYC Register of Community Board Budget Requests.
- Filters to Brooklyn’s 18 Community Boards.
- Preserves tracking codes, source dates, source links, board, agency, and priority.
- Adds sourced historical records from official Community District Needs / Budget Request documents.
- Flags recurring themes conservatively across fiscal years.
- Provides archive, history, map, sharing, feedback, contribution, and legal/privacy views.

## Historical coverage

The archive currently includes curated sourced records from FY2016, FY2017, FY2018, FY2019, FY2025, and FY2026, with newer live records layered separately from NYC Open Data.

Coverage is intentionally incomplete while older board documents are ingested and QA’d. Missing records do not imply that a board made no request.

## Data sources

- NYC Open Data — Register of Community Board Budget Requests (`vn4m-mk4t`)
- NYC Department of City Planning — Community District boundaries (`5crt-au7u`)
- Official NYC Planning and Brooklyn Community Board District Needs / Budget Request documents

City agencies remain the authoritative source for City data. Brooklyn Asks is an unofficial reading and research aid.

## Methodology

An agency response is not proof that a project was physically funded, built, or completed. Published response, derived classification, recurring-theme matching, and independently verified real-world outcome are separate facts.

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
