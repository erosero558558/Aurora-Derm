## FE-V6-R7 Summary

- Date: `2026-03-09`
- Workspace commit: `a25ab7e`
- Scope: public V6 canonical source, artifact sync, redirect-only legacy routes, V6 conversion smoke

## Canonical Source Contract

- Authoring source of truth:
  - `src/apps/astro/src/pages/**`
  - `src/apps/astro/src/components/public-v6/**`
  - `src/apps/astro/src/layouts/PublicShellV6.astro`
  - `src/apps/astro/src/lib/public-v6.js`
  - `src/apps/astro/src/styles/public-v6/**`
  - `content/public-v6/**`
  - `js/public-v6-shell.js`
  - `images/optimized/**`
- Deploy artifacts kept in git for `git-sync`:
  - `es/**`
  - `en/**`
  - `_astro/**`
- Legacy authoring chain removed from the public canonical path:
  - `bin/build-html.js`
  - `servicios/build-service-pages.js`
  - `templates/index.template.html`
  - `templates/telemedicina.template.html`
  - `src/apps/astro/scripts/serve-public-v3.mjs`
  - legacy public `.html` entrypoints under repo root, `servicios/**` and `ninos/**`

## Commands Run

1. `npm run build:public:v6`
   - Result: `PASS`
2. `npm run check:public:v6:artifacts`
   - Result: `PASS`
   - Drift: `0`
3. `npm run smoke:public:routing`
   - Result: `PASS`
4. `npm run smoke:public:conversion`
   - Result: `PASS`
5. `npm run audit:public:v6:copy`
   - Result: `PASS`
   - Findings: `0`
6. `npm run audit:public:v6:visual-contract`
   - Result: `PASS`
   - Checkpoints: `104/104`
7. `npm run audit:public:v6:sony-parity`
   - Result: `PASS`
   - Points: `50/50`
8. `npm run test:frontend:qa:v6`
   - Result: `PASS`
   - Playwright specs: `32`
   - Copy contract tests: `4`
9. `npm run gate:public:v6:canonical-publish`
   - Result: `PASS`

## Functional Outcome

- Public V6 can now be built without `build-html` or `services:build`.
- `es/**`, `en/**` and `_astro/**` are explicitly treated as generated deploy artifacts.
- Legacy URLs remain available as redirects only.
- Public conversion smoke no longer depends on `#citas`, `#appointmentForm` or `#serviceSelect`.
- Booking state for V6 remains frozen and explicit:
  - ES: `Reserva online en mantenimiento`
  - EN: `Online booking under maintenance`

## Evidence Files

- `verification/public-v6-canonical/artifact-drift.json`
- `verification/public-v6-canonical/routes.json`
- `verification/public-v6-canonical/publish-contract.json`
- `verification/public-v6-audit/sony-parity-50.json`
- `verification/public-v6-audit/sony-parity-50.md`

