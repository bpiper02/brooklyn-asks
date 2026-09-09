# Brooklyn Asks

A $0-first public-interest reading aid for Brooklyn Community Board budget requests.

## Design direction

V0.2 deliberately avoids generic SaaS / "AI app" styling. It uses a Brooklyn civic-newspaper / municipal-record visual language with modern interaction underneath:

- system serif/sans/monospace fonts only
- square controls, rules, dense archive rows, minimal decorative cards
- provenance/tracking codes treated as first-class UI
- Archive view for serious reading
- Map view for board-level spatial exploration
- no claim that an agency response equals real-world delivery

## What V0.2 does

- Loads NYC's official **Register of Community Board Budget Requests** directly from NYC Open Data.
- Filters to Brooklyn's 18 community boards.
- Shows request, agency, priority, latest published response, publication date, and official tracking code.
- Classifies response language without claiming that an agency response equals project delivery.
- Adds a small sourced historical seed to demonstrate recurring-theme / repeated-project logic across fiscal years.
- Adds a board-level map using NYC Department of City Planning Community District boundaries.
- Map shading reflects the number of records matching the current filters; it is **not** a severity score.
- Runs entirely as a static Cloudflare Pages site.

## Important limitation

A request being `supported`, `funded`, or `completed` in a published response is **not independently verified physical delivery**. The next dataset join should link capital requests to the NYC Capital Projects Dashboard / commitment data and other outcome evidence.

## Run locally

Any static server works:

```bash
cd public
python -m http.server 8788
```

Then open `http://localhost:8788`.

The live records and Community District boundaries require an internet connection in the browser. If those sources fail, the historical seed/archive still provides a limited preview.

## Deploy to Cloudflare Pages

With Wrangler installed/authenticated:

```bash
npx wrangler pages deploy public --project-name brooklyn-asks
```

No build step and no paid database required.

## Sources

- NYC Open Data dataset `vn4m-mk4t` — Register of Community Board Budget Requests.
- NYC Open Data dataset `5crt-au7u` — Community District boundaries, provided by NYC Department of City Planning.

The historical seed currently includes selected records from official Brooklyn CB1, CB9, CB13 district-needs documents plus current response records surfaced from CityScroll's sourced reading aid. Replace/expand this with the automated historical ingest before making longitudinal claims borough-wide.

## Next data step

1. Download FY24–FY27 adopted registers / district-needs records.
2. Normalize each request into `board + fiscal_year + tracking_code + request_type + detail + location + agency + response + source_date`.
3. Use conservative entity matching to separate a **recurring theme** from an **exact repeated project**.
4. Link candidate capital requests to capital-project / commitment-plan datasets.
5. Preserve source URL, source date, and matching confidence on every derived relationship.

## Optional reproducible snapshot

Run:

```bash
npm run snapshot
```

This writes a normalized copy of the current NYC Open Data rows to `public/data/official-snapshot.json`. The live site does not require this file; it is useful for reproducibility, GitHub releases, and later longitudinal analysis.
