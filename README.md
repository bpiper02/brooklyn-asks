# Brooklyn Asks

Brooklyn Asks is an independent public-interest tracker for Brooklyn Community Board budget requests, agency responses, and recurring neighborhood priorities.

## What it does

- Loads the current NYC Register of Community Board Budget Requests.
- Filters to Brooklyn’s 18 Community Boards.
- Preserves official tracking codes, source dates, and source links.
- Adds sourced historical records from official Community District Needs documents.
- Flags recurring themes conservatively across fiscal years.
- Provides archive, historical, and Community District map views.
- Includes public feedback, contribution, sharing, and legal/privacy surfaces.

## Data sources

Primary sources:

- NYC Open Data — Register of Community Board Budget Requests (`vn4m-mk4t`)
- NYC Department of City Planning — Community District boundaries (`5crt-au7u`)
- Official Brooklyn Community Board District Needs / Budget Request documents

City agencies remain the authoritative source for City data. Brooklyn Asks is an unofficial reading and research aid.

## Important methodology note

An agency response is not proof that a project was physically funded, built, or completed. Published response, derived classification, recurring-theme matching, and independently verified real-world outcome are treated as separate facts.

Historical coverage is growing and is not yet complete across every board and fiscal year.

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

The project is static and requires no paid database or build step.

## Contributing

Corrections and contributions are welcome. Please preserve source URLs, fiscal-year context, and provenance for factual records.

Open an issue or pull request: https://github.com/bpiper02/brooklyn-asks

## License

Application code is MIT licensed. Source data remains subject to the terms and ownership of its originating public agencies. See `public/legal.html` for project notices and source-use notes.
