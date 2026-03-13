# Real Debt Block 1 - Delivery Surface Stabilization

Date: 2026-03-12  
Source audit: `docs/REAL_DEBT_AUDIT.md`  
Primary debt IDs: `D1`, `D5`, `D8`  
Supporting debt IDs: `D9`

## Objective

Reduce the operational and review noise that currently sits in front of every larger refactor. This block goes first because queue/runtime decomposition will stay expensive while deploy paths, generated artifacts, and branch slicing remain mixed together.

## Why This Block Goes First

- `D1` is the highest-ranked debt in the audit and already emits live warning signals.
- `D5` keeps source review mixed with generated output review.
- `D8` shows that the current branch shape is already too broad to attribute safely.
- Cleaning these three first lowers the cost of later work on `install-hub.js`, queue surfaces, and queue tests.

## Exit Criteria

This block is complete only when all of the following are true:

1. GitHub Actions, `scripts/ops/**`, and root PowerShell wrappers use one canonical execution path per operation.
2. Job health no longer reports deploy/runtime health as failed solely because the tree is dirty.
3. Generated admin/public artifacts are reviewed as outputs, not as the primary source of truth.
4. Branch slicing guidance exists for deploy, queue runtime, desktop, tests, and governance evidence.
5. The verification commands in this document pass or have a documented, intentional exception.

## In Scope

- `.github/workflows/**`
- `scripts/ops/**`
- `bin/powershell/**`
- root `.ps1` wrappers
- `package.json` script surface related to deploy/ops/artifact checks
- docs that define operational entrypoints and root surface policy
- artifact validation policy for:
    - `admin.js`
    - `script.js`
    - `js/chunks/**`
    - `js/admin-chunks/**`
    - `js/engines/**`

## Out of Scope

- refactoring `install-hub.js`
- queue domain contract work
- queue/admin test decomposition
- Electron runtime behavior changes
- board mutations or task creation in `AGENT_BOARD.yaml`

## Workstreams

### W1 - Canonicalize ops entrypoints

Goal:

- Make every deploy, verify, smoke, monitor, and report action flow through one canonical script location.

Changes:

- Treat `scripts/ops/**` as the only implementation layer.
- Keep root `.ps1` files as thin compatibility wrappers only.
- Remove duplicated behavior from workflows where the same logic already exists in a script.
- Ensure docs point operators to the canonical entrypoints first, not the wrappers.

Acceptance:

- Each root `.ps1` involved in active operations is a pass-through wrapper or is removed from active docs.
- Each GitHub Action step for deploy/verify/monitor/report calls a canonical script path rather than embedding branch-specific logic inline.

### W2 - Separate health signal from tree hygiene

Goal:

- Stop mixing deploy health with local working tree cleanliness.

Changes:

- Split job status semantics so `working_tree_dirty` is reported as repo hygiene, not as deploy/runtime failure.
- Keep deploy health tied to the actual deploy/verify signal.
- Update job/readiness docs so operators know which warning is operational and which one is local state.

Acceptance:

- `public_main_sync` can represent tree dirtiness without collapsing into the same unhealthy status used for real runtime or sync failures.
- `board doctor` and `status` diagnostics remain consistent after the change.

### W3 - Harden source vs artifact boundaries

Goal:

- Reduce review and lint noise from generated assets without losing deploy safety.

Changes:

- Define generated assets as outputs that are validated by checks, contracts, and artifact drift tooling.
- Make source modules the primary review target.
- Tighten the docs around which files are hand-edited and which are regenerated.
- If lint still touches generated outputs, separate those findings from authored-source debt reporting.

Acceptance:

- The repo has one documented source-of-truth path for admin/public runtime assets.
- Artifact checks cover the generated outputs required for deploy.
- Contributors do not need to infer ownership from both source and generated files in the same review.

### W4 - Add branch slicing guardrails for mixed-surface work

Goal:

- Prevent future branches from mixing deploy, queue runtime, desktop, tests, and governance evidence in one batch unless explicitly required.

Changes:

- Add a documented slicing checklist for large initiatives.
- Define preferred branch/review slices by domain:
    - ops/deploy
    - queue runtime
    - desktop shells
    - tests
    - governance evidence
- Make the docs explicit about what can travel together and what should be isolated.

Acceptance:

- A contributor can open one doc and know how to split a large initiative into reviewable slices.
- The next queue/ops initiative can be planned without repeating the current branch shape.

## Implementation Order

### Phase 1 - Inventory and mapping

- Map each active root wrapper to its canonical script under `scripts/ops/**`.
- Map each workflow job to the script it should call.
- Map each generated asset family to the source files that own it.

### Phase 2 - Canonical path cleanup

- Normalize wrappers and workflow calls.
- Remove duplicated inline behavior from Actions where possible.
- Update the operational docs at the same time so runtime truth and docs move together.

### Phase 3 - Signal cleanup

- Separate `working_tree_dirty` from actual runtime/deploy health in status reporting.
- Re-check `status` and `board doctor` for consistent diagnostics.

### Phase 4 - Artifact and slicing policy

- Tighten artifact ownership docs and validation expectations.
- Add branch slicing guidance tied to the debt audit findings.

## Suggested File Targets

Primary likely touch points:

- `.github/workflows/deploy-hosting.yml`
- `.github/workflows/repair-git-sync.yml`
- `.github/workflows/diagnose-host-connectivity.yml`
- `scripts/ops/prod/**`
- `bin/powershell/**`
- root wrappers such as `VERIFICAR-DESPLIEGUE.ps1`, `MONITOR-PRODUCCION.ps1`, `REPORTE-SEMANAL-PRODUCCION.ps1`
- `package.json`
- `docs/OPERATIONS_INDEX.md`
- `docs/ROOT_SURFACES.md`
- `docs/DEPLOYMENT.md`
- artifact policy docs and checks tied to `admin.js`, `script.js`, `js/chunks/**`, `js/admin-chunks/**`, `js/engines/**`

## Risks

- Health signal changes can confuse operators if docs are not updated in the same patch.
- Wrapper cleanup can break muscle-memory commands if compatibility behavior changes silently.
- Artifact policy cleanup can create accidental drift if checks are weakened instead of clarified.

## Verification

Run these after implementation:

```powershell
git diff --stat
node agent-orchestrator.js status --json
node agent-orchestrator.js board doctor --json
npm run lint
npm run chunks:admin:check
npm run chunks:public:check
npm run assets:versions:check
node --test tests-node/deploy-hosting-workflow-contract.test.js
node --test tests-node/prod-monitor-public-sync-contract.test.js
node --test tests-node/prod-ops-public-sync-contract.test.js
node --test tests-node/weekly-report-script-contract.test.js
```

If status semantics change materially, also re-run:

```powershell
npm run agent:test
```

## Definition of Done

This block is done when the delivery path is easier to reason about than it is today. That means fewer duplicated entrypoints, cleaner health semantics, clearer artifact ownership, and a documented branch-splitting rule that reduces future mixed-surface churn.
