# CSV Lens roadmap

CSV Lens is a local-first, browser-only CSV workspace. This roadmap takes it from a working prototype to a production website. Work ships in small iterations. Each iteration ends with a reviewed PR, a green CI run, and an update to the checklist below. After each iteration, review what was learned and reorder the next items.

## Principles

- Privacy stays the product: no uploads, no tracking, no cell data leaving the browser.
- Every change keeps `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e` green.
- Prefer small, reversible PRs over large rewrites.

## Iteration loop

1. Pick the highest-value unchecked items.
2. Implement them with tests.
3. Run the full check suite locally and in CI.
4. Open a PR, review, merge.
5. Re-assess: measure (bundle size, Lighthouse, test timings), note new problems, update this file.

## Phase 1: Deployable

- [x] Production CSP without the dev-only `ws://127.0.0.1` allowance
- [x] Security and cache headers for static hosts (`public/_headers`, Cloudflare Pages format)
- [x] `robots.txt`, Open Graph and Twitter meta tags, static 404 page
- [x] Host chosen: Cloudflare Pages (`wrangler.toml`, `.nvmrc`, deploy steps in README)
- [ ] Connect the repo in the Cloudflare dashboard, custom domain
- [ ] Social preview image (1200x630) and `og:image`
- [x] License: MIT

## Phase 2: CI and code quality

- [x] GitHub Actions: lint, type check, unit tests, build, browser tests on every push and PR
- [x] ESLint (TypeScript and React Hooks rules)
- [x] Dependabot for npm and GitHub Actions
- [ ] Deploy previews per PR (automatic once Cloudflare Pages is connected)
- [ ] Browser tests in Firefox and WebKit
- [ ] Bundle size budget enforced in CI

## Phase 3: Performance

- [x] Keep typing responsive on large files by deferring filter and sort work
- [ ] Move filtering and sorting into the worker for 50,000-row files
- [ ] Virtualize the table
- [ ] Stream-parse files to raise the 10 MB / 50,000-row limits safely
- [ ] Lighthouse CI with performance and accessibility thresholds

## Phase 4: Reliability and structure

- [x] Top-level error boundary with a recovery screen
- [ ] Split `App.tsx` into `UploadZone`, `FilterBar`, `DataTable`, `StatsGrid`
- [ ] Move workspace state into a reducer with unit tests
- [ ] Opt-in, privacy-safe error reporting (no cell data, no file names)

## Phase 5: Accessibility and UX

- [ ] Automated axe checks in Playwright
- [ ] Keyboard and screen reader pass on filters, sorting, and charts
- [ ] Dark mode that follows the system setting
- [ ] Helpful guidance when a file exceeds the limits

## Phase 6: Product features

- [ ] Installable offline app (PWA), keeping the "no storage" promise opt-in
- [ ] Filter and sort state in the URL for shareable views (no data in the URL)
- [ ] Date column detection and time-series charts
- [ ] TSV and Excel (`.xlsx`) import
- [ ] Opt-in saved workspaces in IndexedDB
