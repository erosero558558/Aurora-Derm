# Branch Slicing Guardrails

This guide defines how to split large initiatives into reviewable slices before
the branch grows across unrelated surfaces.

## Rule

- One branch should answer one primary review question.
- Keep lane ownership and branch slicing separate:
    - `AGENTS.md` decides who owns the files.
    - `TRI_LANE_RUNTIME_RUNBOOK.md` decides which Codex lane executes.
    - This document decides how the initiative is cut for review and rollback.
- If a change touches more than one major slice, split it unless the coupling is
  explicit and unavoidable.

## Preferred Slices

### 1. Ops and deploy

Use one branch when the main change lives in:

- `.github/workflows/**`
- `scripts/ops/**`
- `bin/powershell/**`
- root PowerShell wrappers
- deploy and production runbooks

Keep here only the minimum docs and tests needed to prove the operational
change.

Suggested branch names:

- `ops/deploy-health-signals`
- `ops/postdeploy-entrypoints`

### 2. Queue runtime

Use one branch when the main change lives in:

- `src/apps/admin-v3/**/queue/**`
- `src/apps/queue-operator/**`
- queue shells such as `operador-turnos.html`
- queue-facing CSS and runtime glue

Generated outputs that belong to this slice can travel with the source diff, but
they do not justify bringing deploy or desktop work into the same branch.

Suggested branch names:

- `feature/queue-runtime-install-hub-registry`
- `feature/queue-runtime-operator-surface`

### 3. Desktop shells

Use one branch when the main change lives in:

- `src/apps/turnero-desktop/**`
- desktop packaging, release, or shell config
- app-download catalogs that exist only to ship the desktop shells

Do not bundle desktop packaging with admin queue refactors unless one change
cannot ship without the other in the same release cut.

Suggested branch names:

- `feature/desktop-shell-release-contract`
- `feature/desktop-shell-kiosk-sync`

### 4. Tests

Use one branch when the main change is test structure or reliability:

- `tests/**`
- `tests-node/**`
- shared fixtures, builders, helpers, or smoke harnesses

Rules:

- Keep capability tests with the runtime slice they validate if the test change
  is small and local.
- Move broad suite cleanup, fixture extraction, or reliability work into a
  dedicated `tests/*` branch.
- Do not hide a wide runtime refactor inside a "test cleanup" slice.

Suggested branch names:

- `tests/queue-fixtures-split`
- `tests/playwright-reliability-queue`

### 5. Governance evidence

Use one branch when the main change is coordination, policy, or evidence:

- `agent-orchestrator.js`
- `tools/agent-orchestrator/**`
- `AGENTS.md`
- `AGENT_BOARD.yaml`
- `AGENT_HANDOFFS.yaml`
- `verification/**`
- audit and rollout docs such as `docs/REAL_DEBT_*.md`

Keep governance evidence separate from runtime edits unless the same patch must
prove a governance rule introduced by that runtime change.

Suggested branch names:

- `docs/governance-runtime-artifact-policy`
- `chore/agent-summary-surface-cleanup`

## What Can Travel Together

- Source files and their generated runtime outputs can travel together.
- A small local test update can travel with the runtime slice it validates.
- A small doc change can travel with the slice it documents.
- A handoff or governance evidence update can travel with a runtime slice only
  when it is required to unblock that exact change.

## What Should Stay Separate

- `ops/deploy` from `queue runtime`
- `queue runtime` from `desktop shells`
- broad `tests` cleanup from feature delivery
- `governance evidence` from unrelated runtime work
- large artifact refreshes from source refactors unless the artifacts are the
  direct output of that source change

## Slicing Checklist

Before opening or growing a branch:

1. Name the dominant slice.
2. List the touched paths and mark which of the five slices they belong to.
3. If the branch crosses `ops/deploy`, `queue runtime`, `desktop shells`,
   `tests`, or `governance evidence`, split it unless the coupling is explicit.
4. Keep generated assets in the same slice as their source-of-truth modules.
5. If a cross-lane branch is unavoidable, open the handoff required by
   `AGENTS.md` and explain the coupling in the PR summary.
6. If rollback would require different owners or different validation commands,
   it should probably be more than one branch.

## Example

Bad mixed branch:

- queue admin refactor in `src/apps/admin-v3/**`
- operator shell tweaks in `src/apps/queue-operator/**`
- desktop packaging in `src/apps/turnero-desktop/**`
- production workflow edits in `.github/workflows/**`
- Playwright cleanup in `tests/admin-queue.spec.js`
- governance evidence refresh in `verification/**`

Better split:

1. `feature/queue-runtime-*`
2. `feature/desktop-shell-*`
3. `ops/*`
4. `tests/*`
5. `docs/*` or `chore/*` for governance evidence

## Practical Default

If you are unsure, start with the smallest branch that can pass its own
validation without borrowing deploy, desktop, governance, and broad test
changes from the rest of the initiative.
