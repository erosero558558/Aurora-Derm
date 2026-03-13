# Real Debt Block 2 - Queue and Turnero Domain Decomposition

Date: 2026-03-12  
Source audit: `docs/REAL_DEBT_AUDIT.md`  
Primary debt IDs: `D2`, `D3`, `D4`  
Supporting debt IDs: `D6`, `D10`  
Prerequisite block: `docs/REAL_DEBT_BLOCK_1.md`

## Objective

Shrink the cost of changing the queue and turnero domain by separating domain contracts, admin composition, surface-specific adapters, and test layers. This block starts after delivery-surface stabilization because queue refactors will stay expensive while ops, artifact, and review noise remain unresolved.

## Why This Block Goes Next

- `D2`, `D3`, and `D4` are the next highest-ranked debts after the delivery-path issues.
- The queue/turnero domain is the heaviest active concentration of runtime, styling, shell, and test churn in the repo.
- `install-hub.js` is no longer the only problem. The deeper issue is that queue rules, shell behavior, install flows, and test setup are spread across too many runtime surfaces.
- A decomposition pass here will lower the cost of both feature work and incident response in the busiest operational area of the product.

## Exit Criteria

This block is complete only when all of the following are true:

1. The queue/turnero domain has one shared contract/read-model layer that surfaces consume instead of duplicating behavior rules.
2. `install-hub.js` is reduced to a composition/orchestration entrypoint rather than a domain monolith.
3. Web operator, kiosk, sala, and desktop shells consume stable domain adapters instead of embedding queue business rules directly.
4. Queue E2E coverage is split into smaller capability-based suites with reusable fixtures/builders.
5. The highest-noise queue Playwright suites reduce conditional test flow and timeout-based waiting.

## In Scope

- `src/apps/admin-v3/shared/modules/queue/**`
- `src/apps/queue-operator/**`
- `src/apps/turnero-desktop/**`
- queue-related root shells and styles:
    - `operador-turnos.html`
    - `kiosco-turnos.html`
    - `sala-turnos.html`
    - `queue-ops.css`
    - `queue-kiosk.css`
    - `queue-display.css`
- queue and turnero tests:
    - `tests/admin-queue.spec.js`
    - `tests/queue-integrated-flow.spec.js`
    - `tests/queue-operator.spec.js`
    - `tests/queue-kiosk.spec.js`
    - `tests/queue-display.spec.js`
    - `tests/turnero-desktop-boot.spec.js`
    - queue-related node/php contracts where needed

## Out of Scope

- deploy/workflow normalization from Block 1
- generated artifact policy changes from Block 1
- global governance CLI decomposition
- unrelated public-site refactors
- payment, calendar, or chat domain changes unless directly required by queue contracts

## Current Domain Shape

The decomposition has to respect the current reality:

- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js` is the large active hotspot and still absorbs broad orchestration behavior.
- The adjacent `install-hub/` tree already contains meaningful subdomains:
    - `alerts`
    - `checklist`
    - `configurator`
    - `contingency`
    - `focus-mode`
    - `manifest`
    - `pilot`
    - `playbook`
    - `quick-console`
    - `registry`
    - `telemetry`
- `src/apps/queue-operator/index.js` imports both queue runtime and shell/desktop heartbeat behavior, which shows the operator surface is acting as a mixed adapter.
- `src/apps/turnero-desktop/src/config/contracts.mjs` already exposes normalization/config helpers, which is a strong candidate for a shared consumer contract boundary.
- Queue coverage is concentrated in very large Playwright suites instead of smaller domain contracts plus narrower interaction suites.

## Target Architecture

### A1 - Shared queue domain contract

Goal:

- Define one stable queue/turnero read-model and action contract for all consumer surfaces.

Changes:

- Extract shared queue concepts into a contract layer with normalized inputs and outputs.
- Treat station, consultorio, locking, one-tap, active ticket, waiting queue, and heartbeat state as domain data, not per-surface behavior.
- Keep surface-specific rendering and environment hooks outside the contract layer.

Acceptance:

- Admin, operator web, kiosk/sala, and desktop code can all point to one domain model vocabulary.
- New queue features do not require rediscovering naming and state shape in each surface.

### A2 - `install-hub.js` becomes a composition root

Goal:

- Make the admin queue install hub assemble modules instead of owning their behavior.

Changes:

- Limit `install-hub.js` to module wiring, state handoff, and shell-level orchestration.
- Move remaining domain-specific logic into the existing subdomain modules where possible.
- Enforce a one-way structure:
    - domain model/helpers
    - module adapters
    - rendering/composition shell

Acceptance:

- `install-hub.js` stops growing as the default place for every new queue/turnero capability.
- Each install-hub subdomain can be tested or reviewed in isolation.

### A3 - Surface adapters instead of embedded rules

Goal:

- Keep each queue surface thin and environment-specific.

Changes:

- Make `src/apps/queue-operator/**` an operator adapter over the shared contract, not a domain owner.
- Make `src/apps/turnero-desktop/**` consume the same normalized route/config/state contract as the web shells.
- Keep desktop-only concerns isolated to:
    - window options
    - updater lifecycle
    - packaged-shell bridging
    - local persistence

Acceptance:

- Operator web and desktop shells differ mainly in environment hooks, not in queue rule interpretation.
- Surface boot files stay focused on bootstrapping and presentation.

### A4 - Split queue tests by capability layer

Goal:

- Replace test monoliths with layered validation that fails closer to the actual regression.

Changes:

- Split queue tests into:
    - domain/contract tests
    - shell boot tests
    - surface interaction tests
    - integrated end-to-end flows
- Extract builders/fixtures for queue state, help requests, consultorio state, and operator shell status.
- Move repeated API mocking and state-shaping helpers out of the huge E2E specs.

Acceptance:

- A queue regression can usually be caught in one smaller suite before the full integrated flow.
- `admin-queue.spec.js` and `queue-integrated-flow.spec.js` stop being default catch-all files.

### A5 - Reliability cleanup for queue Playwright suites

Goal:

- Raise trust in queue tests before tightening coverage gates.

Changes:

- Remove explicit timeout waits where an observable UI or network condition exists.
- Replace page-level selectors with locators/helpers.
- Reduce conditional assertions and skip logic in the busiest queue suites.

Acceptance:

- The queue-focused top-warning suites visibly reduce `prefer-locator`, `no-wait-for-timeout`, and conditional test warnings.
- Queue tests are easier to diagnose without reading thousands of lines first.

## Implementation Order

### Phase 1 - Domain inventory

- Catalog the domain state and actions currently duplicated across admin, operator web, kiosk/sala, and desktop.
- Identify which pieces are truly shared and which are surface-specific.
- Use `contracts.mjs`, `manifest.js`, `registry.js`, and queue selectors/state helpers as candidate contract anchors.

### Phase 2 - Contract extraction

- Extract the shared queue/turnero contract layer first.
- Add narrow compatibility adapters so existing surfaces can migrate incrementally.
- Avoid a flag day rewrite.

### Phase 3 - Admin composition cleanup

- Reduce `install-hub.js` to composition and orchestration.
- Move remaining behavior into the nearest existing subdomain module or a new domain helper when no stable home exists.

### Phase 4 - Surface adapter cleanup

- Refactor operator web and desktop shells to consume the shared contract.
- Keep shell-specific concerns in their own adapter/boot files.

### Phase 5 - Test decomposition

- Split the largest queue suites by capability.
- Introduce shared builders/fixtures and reduce reliability anti-patterns while moving cases.

## Suggested File Targets

Primary likely touch points:

- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/index.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/manifest.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/registry.js`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/alerts/**`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/configurator/**`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/pilot/**`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/playbook/**`
- `src/apps/admin-v3/shared/modules/queue/render/section/install-hub/telemetry/**`
- `src/apps/queue-operator/index.js`
- `src/apps/turnero-desktop/src/config/contracts.mjs`
- `src/apps/turnero-desktop/src/renderer/boot.js`
- queue shell styles and root html shells
- queue/turnero Playwright suites

## Risks

- Extracting contracts too aggressively can create a false abstraction that hides real surface differences.
- Moving queue behavior without layered tests can shift regressions from admin to operator or desktop surfaces.
- Test splitting can initially increase file count and fixture complexity before it reduces maintenance cost.
- If shell-specific behavior leaks back into the shared contract, the refactor will recreate the monolith in a different folder.

## Verification

Run these after implementation, adjusting suite names if files are split:

```powershell
npm run lint
npx playwright test tests/admin-queue.spec.js tests/queue-integrated-flow.spec.js tests/queue-operator.spec.js tests/queue-kiosk.spec.js tests/queue-display.spec.js tests/turnero-desktop-boot.spec.js --workers=1
npm run test:turnero:contracts
npm run test:turnero:ui
npm run test:turnero:php-contract
node --test tests-node/turnero-surface-registry.test.js
node --test tests-node/resolve-turnero-release-plan.test.js
node --test tests-node/app-downloads-catalog-registry-contract.test.js
```

If the queue state contract moves materially, also re-run the broader queue and admin checks tied to the active surface.

## Definition of Done

This block is done when queue work can be changed in one place without dragging the whole surface family with it. That means one shared contract language, thinner surface adapters, a smaller admin composition root, and tests that fail by capability instead of by monolith.
