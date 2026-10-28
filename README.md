# CSV Lens

A local-first CSV workspace. Upload a file, search and combine column filters, sort rows, build simple charts, and export the matching data. No accounts, backend, analytics, or external runtime dependencies.

## Run

Requires Node.js 20.19+ or 22.12+ (a current LTS release is recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The server only serves the frontend; CSV parsing, filtering, charting, and export all happen inside the browser.

For a production build:

```sh
npm run build
npm run preview
```

`dist/` is a static site and can be served by any static web server. Vite binds to loopback only by default.

`public/_headers` sets security and cache headers on Cloudflare Pages. On other hosts, configure the same headers on the server. The production build drops the dev-only WebSocket allowance from the Content Security Policy.

See [ROADMAP.md](ROADMAP.md) for planned work.

## Features

- CSV file picker and drag-and-drop, with a built-in fictional sales dataset.
- Parsing in a web worker, automatic comma/semicolon/tab detection, quoted and multiline fields, UTF-8/BOM support.
- Case-insensitive search across all columns.
- AND-combined text, blank-cell, and numeric filters.
- Three-state column sorting (ascending, descending, original order), with blanks last.
- Paginated table with 25 rows per page. Exports include **every** matching row in the selected sort order, not just the current page.
- Category counts and numeric sums in bar charts; numeric values in table order in line charts.
- Collapsible chart panel and responsive mobile layout.
- Clear validation errors that leave a previously loaded dataset intact.

## Privacy and data handling

- CSV contents stay in browser memory. No upload endpoint exists.
- No localStorage, sessionStorage, IndexedDB, cookies, or service worker is used.
- Refreshing, closing the page, replacing the dataset, or choosing Clear removes the old dataset from the active workspace. This is not a promise of forensic memory erasure.
- The loaded app can analyze data offline. It is not an installable offline PWA, and a new visit still needs a static server.
- Fonts, icons, charts, and sample data are bundled locally. Development hot reload uses a loopback WebSocket. The production build has a restrictive Content Security Policy.
- Downloads are normal files on your device and remain there until you remove them.
- Original cell strings, including leading zeros and large integers, are retained. Chart calculations use JavaScript numbers and may approximate high-precision values.
- Blank/duplicate headers receive unique names, shown in a warning and used for export.
- Exports use CRLF and a UTF-8 BOM. Formula-like text is prefixed with an apostrophe to reduce spreadsheet formula-injection risk. Ordinary negative numeric values stay numeric. This means potentially dangerous text is intentionally not exported byte-for-byte.

## Limits

- One UTF-8 `.csv` file at a time, up to 10 MiB and 50,000 nonblank data rows.
- The first nonblank record is the header. Data rows must have the same field count.
- Blank records are skipped. Decimal/scientific notation is numeric; currencies, thousands separators, and mixed text/numeric columns remain text.
- Bar charts show the top 20 categories by the selected measure. Line charts show the first 200 numeric matching rows in table order, skipping blank values. These limits never truncate the table or export.
- No spreadsheet editing, pivots, saved workspaces, accounts, or automatic date parsing.

## Tests

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

GitHub Actions runs all four on every push to `main` and on every pull request.

Unit tests cover parsing, row limits, filters, sorting, chart calculations, quoting, and spreadsheet-safe export.

Browser tests build and serve the production app, exercise real file uploads, combined filters, charts, sorting, downloads, privacy, offline analysis, malformed files, the 50,000-row boundary, and mobile layout. They use an installed Google Chrome on macOS when available. Otherwise install the test browser once with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Browser screenshots are saved under `artifacts/`; failure traces and screenshots are under `test-results/`. These are ignored by Git.

## Stack

React, TypeScript, Vite, Papa Parse, Recharts, Lucide icons, and plain CSS. Vitest and Playwright provide regression tests.

## Deploy (Cloudflare Pages)

The site deploys as static files to Cloudflare Pages. `public/_headers` sets the security and cache headers, and Pages serves `404.html` for unknown paths.

One-time setup in the Cloudflare dashboard:

1. Go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repository.
2. Build command: `npm run build`. Output directory: `dist`. Node version comes from `.nvmrc`.
3. Set the production branch to `main`. Every PR then gets a preview URL automatically.
4. Optional: add a custom domain under **Custom domains**. HTTPS is automatic.

Manual deploy from a machine logged in with `npx wrangler login`:

```sh
npm run build
npx wrangler pages deploy
```

## License

[MIT](LICENSE)
