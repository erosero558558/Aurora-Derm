# Dead Code Audit - `js/engines`

Date: 2026-02-24
Scope: `js/engines/*.js` (13 files)

## Method

1. Enumerated engine files with `rg --files js/engines`.
2. Searched TODO/FIXME/HACK markers.
3. Searched debug/log paths (`debugLog`, `window.debugLog`, `console.*`).
4. Checked cross-references from `index.html`, `script.js`, `js/*`, `src/*`.

## Findings

### F1 - No explicit TODO/FIXME debt markers in engines

- Query: `rg -n "\\b(TODO|FIXME|XXX|HACK)\\b" js/engines`
- Result: no matches.
- Impact: low risk, but no inline traceability for pending cleanup inside generated engines.

### F2 - High volume of debug-only code paths

- Query: `rg -n "debugLog|console\\.(log|debug|warn|error)" js/engines`
- Result: 44 references.
- Hotspots:
  - `js/engines/chat-engine.js`
  - `js/engines/chat-ui-engine.js`
  - `js/engines/chat-widget-engine.js`
  - `js/engines/booking-engine.js`
  - `js/engines/booking-utils.js`
- Impact: medium. These branches are mostly no-op in production when no debug logger is injected, but they add runtime branching and bundle weight.

### F3 - Potential overlap between `data-engine` and `data-bundle`

- Both assets are actively referenced:
  - `index.html:1914`
  - `index.html:1918`
  - `script.js:724`
  - `script.js:975`
  - `script.js:2038`
  - `js/data.js:19`
  - `js/i18n.js:7`
  - `js/router.js:26`
- Impact: medium. This is not confirmed dead code, but it is a duplication risk and can hide stale paths after refactors.

### F4 - Version drift risk on equivalent assets

- `index.html` preloads `data-bundle.js` with `v=20260220-consolidated1`.
- `script.js` and runtime loaders use `v=20260221-api-fix`.
- Impact: medium. Mixed version strings can produce cache inconsistencies and false-positive hash gate failures.

### F5 - Bundle ownership is fragmented

- `engagement-bundle.js` references are concentrated in:
  - `script.js:831`
  - `js/engagement.js:24`
- Impact: low. Not dead code today, but ownership is narrow and should be validated when engagement flows are disabled or moved.

## Confirmed Dead Code

No hard-confirmed dead functions were identified with static grep-only analysis in this pass.

## Recommended Cleanup Order

1. Consolidate `data-engine` vs `data-bundle` responsibility into one runtime path.
2. Normalize engine version tokens in one source of truth to avoid cache/hash drift.
3. Gate debug logs behind a compile-time flag in source (`src/apps/*`) and regenerate engines.
4. Add a CI check that fails if engines contain TODO/FIXME without linked task id.

## Notes

- This report intentionally does not modify generated engine code.
- Any cleanup must be done in source modules (`js/*`, `src/apps/*`) and rebuilt with `npm run build`.
