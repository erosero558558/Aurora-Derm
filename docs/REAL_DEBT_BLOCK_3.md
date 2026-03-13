# Real Debt Block 3 - Governance, CLI, and Repo Surface Consolidation

Date: 2026-03-12  
Source audit: `docs/REAL_DEBT_AUDIT.md`  
Primary debt IDs: `D7`, `D9`  
Supporting debt IDs: `D10`  
Prerequisite blocks:

- `docs/REAL_DEBT_BLOCK_1.md`
- `docs/REAL_DEBT_BLOCK_2.md`

## Objective

Reduce the amount of repo-specific knowledge needed to operate governance, run the right checks, and navigate the repository safely. This block does not change the governance policy itself. It consolidates the CLI, script surface, root compatibility layers, and archive ergonomics so the existing policy is easier to execute and maintain.

## Why This Block Goes Next

- After delivery stabilization and queue decomposition, the next remaining large debt is cognitive load in governance and repo navigation.
- `agent-orchestrator.js` is already partially decomposed into `core`, `domain`, and `commands`, but the entrypoint, script aliases, and test surface are still broad enough to feel monolithic in practice.
- `package.json` currently exposes `32` `agent:*` scripts, plus additional deploy/public surfaces that overlap conceptually with the runbooks.
- The root still contains `98` tracked files, and the docs layer already spends significant space explaining what is or is not allowed to live there.

## Exit Criteria

This block is complete only when all of the following are true:

1. Governance command discovery is simpler than it is today, without breaking JSON or CLI contracts relied on by tests and automation.
2. `agent-orchestrator.js` acts as a thin entrypoint over a clearer command registry and smaller behavior units.
3. Root compatibility surfaces are reduced or better partitioned so daily navigation depends more on `docs/**` and less on exception memory.
4. Archive and legacy paths are easier to exclude from active work without losing rollback or historical context.
5. Existing governance validation remains green after consolidation.

## In Scope

- `agent-orchestrator.js`
- `tools/agent-orchestrator/**`
- governance CLI tests under `tests-node/**`
- `package.json` script surface for governance/discovery
- operational discovery docs:
    - `docs/AGENT_ORCHESTRATION_RUNBOOK.md`
    - `docs/OPERATIONS_INDEX.md`
    - `docs/ROOT_SURFACES.md`
    - `README.md` if needed for front-door cleanup
- root compatibility surface review
- archive/search ergonomics for active contributors

## Out of Scope

- changing governance policy rules in `AGENTS.md`
- changing board data or active tasks
- deploy/workflow refactors already covered by Block 1
- queue/turnero runtime decomposition from Block 2
- removing historical evidence required by policy or CI

## Current Tooling Shape

The block should build on the current structure, not ignore it:

- `agent-orchestrator.js` already delegates into `tools/agent-orchestrator/core/**`, `domain/**`, and `commands/**`.
- The practical debt is in the surface area around that decomposition:
    - one large CLI facade,
    - many script aliases,
    - broad fixture tests such as `tests-node/agent-orchestrator-cli.test.js`,
    - and human routing docs that compensate for command sprawl.
- `package.json` currently exposes:
    - `32` `agent:*` scripts
    - `17` deploy-oriented scripts
    - `33` public-oriented scripts
- `docs/ROOT_SURFACES.md` and `docs/OPERATIONS_INDEX.md` are already acting as navigational guardrails for root and command complexity.

## Workstreams

### G1 - Thin the governance entrypoint

Goal:

- Make `agent-orchestrator.js` mostly responsible for bootstrap and dispatch, not for carrying default behavior and cross-domain orchestration details directly.

Changes:

- Move remaining command routing and shared defaults toward a clearer command registry shape.
- Keep the top-level CLI readable enough that a contributor can see the command map quickly.
- Reduce unused helper noise and dead branching inside the entrypoint.

Acceptance:

- `agent-orchestrator.js` becomes easier to scan as a dispatch layer.
- Behavior lives primarily in named modules under `tools/agent-orchestrator/**`.

### G2 - Consolidate script discovery

Goal:

- Lower the number of commands a contributor must memorize to operate the repo safely.

Changes:

- Group governance commands around task-based entrypoints instead of a long flat script list where possible.
- Keep stable aliases only where automation or muscle memory clearly needs them.
- Prefer docs that explain "which workflow to run" over forcing contributors to browse `package.json`.

Acceptance:

- The repo exposes fewer conceptual command families, even if some compatibility aliases remain.
- A contributor can choose the right governance command path from one doc without reading the whole script table.

### G3 - Reduce root surface load

Goal:

- Make the root easier to reason about without breaking runtime entrypoints or required compatibility files.

Changes:

- Re-evaluate root markdowns, wrappers, and docs shims after Blocks 1 and 2.
- Keep only the root surfaces that must remain for runtime, policy, or explicit compatibility.
- Push discovery and explanatory material toward `docs/**`.

Acceptance:

- The root has fewer "read me before touching this" exceptions.
- `docs/ROOT_SURFACES.md` gets shorter or more obviously canonical.

### G4 - Improve archive and search ergonomics

Goal:

- Keep history available without letting it dominate active search and navigation.

Changes:

- Strengthen archive conventions and contributor guidance for active-vs-legacy search space.
- Add or document editor/search excludes where appropriate.
- Keep rollback or tombstone context available, but clearly separated from active implementation paths.

Acceptance:

- A contributor working on governance or queue tooling can avoid most archive noise by default.
- Legacy context stops competing with active code during routine exploration.

### G5 - Right-size governance test layers

Goal:

- Keep governance safe while reducing the maintenance burden of large CLI fixture tests.

Changes:

- Separate broad CLI contract coverage from narrower domain or serializer tests where possible.
- Keep one high-value integration path for end-to-end CLI behavior, but move many edge cases closer to the modules that own them.
- Review large tests such as `tests-node/agent-orchestrator-cli.test.js` for extraction opportunities.

Acceptance:

- Governance changes can usually be verified in smaller targeted tests before the broad CLI suite.
- The test surface mirrors the modular structure more closely.

## Implementation Order

### Phase 1 - Surface inventory

- Map the current governance script families and which docs point to them.
- Classify root files into:
    - required runtime entrypoints
    - canonical control files
    - compatibility wrappers
    - historical/tombstone surfaces

### Phase 2 - CLI and script consolidation

- Thin the top-level CLI dispatch.
- Consolidate script discovery and trim redundant human-facing command paths where safe.
- Keep backward-compatible aliases only when they are clearly justified.

### Phase 3 - Root and archive cleanup

- Move explanatory docs and routing material toward `docs/**`.
- Tighten archive/search guidance and contributor defaults.

### Phase 4 - Test layer cleanup

- Split oversized governance test responsibilities where possible.
- Preserve contract confidence while reducing fixture sprawl.

## Suggested File Targets

Primary likely touch points:

- `agent-orchestrator.js`
- `tools/agent-orchestrator/core/**`
- `tools/agent-orchestrator/commands/**`
- `tools/agent-orchestrator/domain/**`
- `tests-node/agent-orchestrator-cli.test.js`
- `tests-node/agent-orchestrator-json-contract.test.js`
- `tests-node/workspace-hygiene-contract.test.js`
- `package.json`
- `docs/AGENT_ORCHESTRATION_RUNBOOK.md`
- `docs/OPERATIONS_INDEX.md`
- `docs/ROOT_SURFACES.md`
- `README.md`

## Risks

- Over-consolidating scripts can break automation or habitual operator flows if compatibility is removed too quickly.
- Moving responsibility between CLI layers can create regressions in JSON output shape if contract tests are not kept front and center.
- Root cleanup can accidentally remove files that are still required by CI, hosting, or policy if the classification is sloppy.
- Archive exclusions can hide useful rollback context if they become too aggressive.

## Verification

Run these after implementation:

```powershell
npm run lint
npm run agent:test
npm run agent:status
npm run agent:board:doctor
npm run agent:summary:local
npm run agent:policy:lint
npm run agent:codex-check
node --test tests-node/workspace-hygiene-contract.test.js
```

If root surfaces or discovery docs change materially, also re-run the broader governance gate:

```powershell
npm run agent:gate
```

## Definition of Done

This block is done when governance feels like a maintainable system instead of a large set of repo rituals. That means a thinner CLI facade, fewer discovery hops, a cleaner root, and archive/history that stays available without crowding active work.
