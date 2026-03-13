# Real Debt Audit

Date: 2026-03-12  
Scope: full repository  
Lens: balanced (`riesgo_prod`, `friccion_equipo`, `churn_actual`, `blast_radius`)  
Mode: read-only audit, no runtime changes

Companion execution blocks:

- `docs/REAL_DEBT_BLOCK_1.md`
- `docs/REAL_DEBT_BLOCK_2.md`
- `docs/REAL_DEBT_BLOCK_3.md`
- `docs/REAL_DEBT_BLOCK_4.md`

## Executive Summary

- The repo is not blocked by failing static validation today: `npm run lint` returns `0`, PHP syntax checks are green, and governance evidence alignment is healthy.
- The real debt has moved away from "missing process" and into "high-cost change surfaces": queue/admin runtime, queue tests, deploy/ops entrypoints, and generated artifacts.
- The heaviest concentration is the queue/turnero vertical. Current churn spans admin renderers, web operator shells, desktop shells, CSS, and large Playwright suites at the same time.
- The highest-risk debt is operational: deploy and verification paths are spread across GitHub Actions, `scripts/ops/**`, root PowerShell wrappers, and governance jobs that already emit yellow signals under branch heat.
- Generated artifacts are still versioned next to source-of-truth modules. That keeps runtime reproducible, but it also pollutes review, lint signal, and ownership boundaries.
- Test debt is real but not because coverage is missing. The issue is reliability style: skips, conditional assertions, page-level selectors, and explicit waits remain concentrated in critical Playwright suites.
- Quick wins exist in test hygiene, artifact policy, and deploy entrypoint normalization. Larger structural work should focus on decomposing the queue domain and reducing surface sprawl.

## Method

### Scoring Rubric

Each debt item uses the fixed rubric below:

| Field             | Range | Weight |
| ----------------- | ----- | ------ |
| `riesgo_prod`     | `0-3` | `x3`   |
| `friccion_equipo` | `0-3` | `x3`   |
| `churn_actual`    | `0-2` | `x2`   |
| `blast_radius`    | `0-2` | `x2`   |

Formula:

```text
score_total = riesgo_prod*3 + friccion_equipo*3 + churn_actual*2 + blast_radius*2
```

Tie-breaker:

1. Higher `riesgo_prod`
2. Higher `churn_actual`

### Inclusion Rules

Count as real debt:

- active files with extreme size or warning concentration;
- fragile test patterns in high-value suites;
- live warnings in deploy, monitoring, or governance flow;
- generated artifacts that obscure source ownership;
- compatibility layers that impose daily navigation cost.

Do not count by default:

- archived markdowns and tombstones with no effect on active tooling;
- evidence files already aligned with the board;
- warnings with no effect on ranking or maintenance burden.

## Baseline

| Metric                             |                                                               Value | Evidence                                             |
| ---------------------------------- | ------------------------------------------------------------------: | ---------------------------------------------------- | --- | ---------------- | ------------ | ---------- | --------------------------------- |
| Dirty working tree                 |                                                  `55` files changed | `git diff --shortstat`                               |
| Current batch size                 |                                 `6234` insertions / `325` deletions | `git diff --shortstat`                               |
| Tracked files                      |                                                              `2284` | `git ls-files`                                       |
| Test files                         |                                                               `308` | `Get-ChildItem -Recurse tests,tests-node -File`      |
| npm scripts                        |                                                               `140` | `package.json`                                       |
| Playwright scripts                 |                                                                `23` | `package.json`                                       |
| Node test scripts                  |                                                                `11` | `package.json`                                       |
| PowerShell npm scripts             |                                                                `13` | `package.json`                                       |
| ESLint findings                    |                       `269` warnings / `0` errors across `39` files | `npm run lint` + ESLint API summary                  |
| Skip/fixme/todo markers            |                                       `16` matches across `9` files | `git grep -n -E '(test                               | it  | describe)\\.skip | test\\.fixme | it\\.fixme | todo\\(' -- tests tests-node src` |
| Root files                         |                                                                `98` | `git ls-files` root-only count                       |
| Root markdown files                |                                                                `18` | `git ls-files` root-only count                       |
| Root PowerShell wrappers           |                                                                `11` | `git ls-files` root-only count                       |
| Versioned generated runtime assets |           `14` `js/engines`, `7` `js/chunks`, `1` `js/admin-chunks` | `git ls-files` grouped counts                        |
| Active tasks                       |                                                                 `1` | `node agent-orchestrator.js task ls --active --json` |
| Governance warnings                |                                                                 `3` | `node agent-orchestrator.js board doctor --json`     |
| Jobs warning                       | `public_main_sync` failed with `working_tree_dirty` + telemetry gap | `node agent-orchestrator.js status --json`           |

## Priority Table

| ID  | Debt                                                                   | Bucket             | Score | Effort |
| --- | ---------------------------------------------------------------------- | ------------------ | ----: | ------ |
| D1  | Deploy/ops execution path sprawl with live warning state               | ops/deploy         |  `26` | `L`    |
| D2  | `install-hub.js` monolith inside active admin queue runtime            | structural hotspot |  `23` | `L`    |
| D3  | Queue surface coupling across admin, operator, shell, CSS, and desktop | architecture       |  `23` | `L`    |
| D4  | Queue/admin E2E test monoliths                                         | tests              |  `23` | `M/L`  |
| D5  | Generated runtime/admin artifacts tracked beside source of truth       | artifacts          |  `23` | `M`    |
| D6  | Playwright reliability anti-patterns and skip debt                     | tests              |  `21` | `M`    |
| D7  | Governance/tooling monolith and command surface sprawl                 | governance/tooling |  `21` | `L`    |
| D8  | Branch batch-size debt across unrelated surfaces                       | process            |  `20` | `S/M`  |
| D9  | Root surface and compatibility shim sprawl                             | repo ergonomics    |  `18` | `M/L`  |
| D10 | Legacy/archive adjacency still taxes the active mental model           | repo ergonomics    |  `13` | `M`    |

## Top 10 Debt

### D1 - Deploy/ops execution path sprawl with live warning state

- Bucket: `ops/deploy`
- Score: `26/26` (`riesgo_prod=3`, `friccion_equipo=3`, `churn_actual=2`, `blast_radius=2`)
- Evidence:
    - `26` workflow files are tracked under `.github/workflows/**`.
    - `package.json` contains `13` PowerShell-backed scripts, and the repo root still exposes `11` `.ps1` wrappers.
    - `node agent-orchestrator.js status --json` reports `public_main_sync` as failed with `failure_reason=working_tree_dirty` and `telemetry_gap=true`.
    - `node agent-orchestrator.js board doctor --json` reports a stale heartbeat warning on `AG-219`.
- Impact:
    - Deploy, verify, monitor, and repair responsibilities are split across GitHub Actions, root wrappers, `scripts/ops/**`, and governance status commands.
    - When branch heat increases, the signal becomes noisier exactly where operators need clarity.
- Why now:
    - The current branch already touches workflows, PowerShell shared libraries, production scripts, and deploy docs in one batch.
- First move:
    - Normalize one canonical execution path under `scripts/ops/**`.
    - Make Actions and root wrappers delegate to the same entrypoints.
    - Separate "working tree hygiene" from "deployment health" in job status.
- Effort: `L`

### D2 - `install-hub.js` monolith inside active admin queue runtime

- Bucket: `structural hotspot`
- Score: `23/26` (`riesgo_prod=2`, `friccion_equipo=3`, `churn_actual=2`, `blast_radius=2`)
- Evidence:
    - `src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js` is about `17074` lines.
    - ESLint reports `26` warnings in that file.
    - Current diff adds roughly `439` lines to the same file.
    - The current branch also modifies related submodules: `manifest.js`, `registry.js`, `alerts/model.js`, `configurator/*`, and `pilot/*`.
- Impact:
    - Registry, alerts, configurator, pilot, reporting, and orchestration logic are still concentrated in one active runtime file.
    - Reviews are expensive, ownership is blurred, and small queue changes carry broad regression risk.
- Why now:
    - The file is still growing even while nearby helper modules already exist.
- First move:
    - Keep `install-hub.js` as a thin composition root only.
    - Move business subdomains into dedicated modules with a strict import boundary.
- Effort: `L`

### D3 - Queue surface coupling across admin, operator, shell, CSS, and desktop

- Bucket: `architecture`
- Score: `23/26` (`riesgo_prod=2`, `friccion_equipo=3`, `churn_actual=2`, `blast_radius=2`)
- Evidence:
    - Current diff includes `src/apps/queue-operator/index.js` (`+580`), `queue-ops.css` (`+199`), and `operador-turnos.html` (`+41`).
    - The same branch changes many admin queue renderer files and `12` files under `src/apps/turnero-desktop/**`.
    - `src/apps/turnero-desktop/package.json` adds a separate Electron build/release surface for operator and kiosk shells.
- Impact:
    - One queue capability currently crosses admin runtime, browser shells, desktop shells, styling, and release packaging.
    - That is architectural debt, not just feature work: the same domain rules are being carried through too many UI surfaces.
- Why now:
    - Turnero is expanding at the same time that queue admin internals are still being reshaped.
- First move:
    - Define one queue domain contract and shared read model.
    - Have admin, operator web, kiosk web, and desktop shells consume it instead of each embedding behavior details.
- Effort: `L`

### D4 - Queue/admin E2E test monoliths

- Bucket: `tests`
- Score: `23/26` (`riesgo_prod=2`, `friccion_equipo=3`, `churn_actual=2`, `blast_radius=2`)
- Evidence:
    - `tests/admin-queue.spec.js` is about `11071` lines and gained about `606` lines in the current diff.
    - `tests/queue-integrated-flow.spec.js` has the highest ESLint warning count in the repo (`36`).
    - `tests/queue-kiosk.spec.js` adds another `26` warnings.
- Impact:
    - Queue validation is concentrated in very large E2E files instead of smaller contract, fixture, and smoke layers.
    - Failures are harder to localize, refactors get slower, and test review cost grows with every queue change.
- Why now:
    - Queue work is one of the hottest areas in the current branch, and the test surface is expanding with it.
- First move:
    - Split queue tests by capability.
    - Extract shared fixtures/builders.
    - Separate smoke, contract, and full integrated flows so failures map to one concern.
- Effort: `M/L`

### D5 - Generated runtime/admin artifacts tracked beside source of truth

- Bucket: `artifacts`
- Score: `23/26` (`riesgo_prod=2`, `friccion_equipo=3`, `churn_actual=2`, `blast_radius=2`)
- Evidence:
    - `README.md` explicitly says not to edit `admin.js`, `script.js`, `js/engines/**`, `js/chunks/**`, and `js/admin-chunks/**` by hand.
    - Tracked generated assets include `14` files in `js/engines`, `7` in `js/chunks`, and `1` in `js/admin-chunks`.
    - Current diff includes `admin.js` plus an admin chunk replacement (`js/admin-chunks/index-BQcHDzsK.js` deleted, `js/admin-chunks/index-BD-XK-QW.js` added).
    - ESLint warnings are present in generated/minified runtime files such as `js/queue-kiosk.js` and `js/queue-display.js`.
- Impact:
    - Source review gets mixed with generated review.
    - Ownership boundaries blur because active source modules and derived outputs live side by side in git.
- Why now:
    - Generated admin/runtime assets are changing in the same branch as the source modules that produce them.
- First move:
    - Keep generated assets versioned only when required for deploy/runtime.
    - Review and lint source modules first, then validate outputs via contracts, hashes, and artifact checks.
- Effort: `M`

### D6 - Playwright reliability anti-patterns and skip debt

- Bucket: `tests`
- Score: `21/26` (`riesgo_prod=2`, `friccion_equipo=3`, `churn_actual=1`, `blast_radius=2`)
- Evidence:
    - `16` `skip/fixme/todo()` matches remain across `9` files.
    - Top skip concentration: `tests/calendar-google-write.spec.js` (`5`) and `tests/phase2-calendar-consistency.spec.js` (`3`).
    - ESLint rule totals include `71` `playwright/prefer-locator`, `35` `playwright/no-conditional-in-test`, `24` `playwright/no-conditional-expect`, and `18` `playwright/no-wait-for-timeout`.
- Impact:
    - Test suites still rely on conditional execution, page-level selectors, and explicit waiting.
    - That lowers trust in failure signal even when coverage count looks healthy.
- Why now:
    - `npm run lint` stays green because these are warnings, so the debt keeps accumulating quietly.
- First move:
    - Burn down the top five offending suites first.
    - Tighten changed-file policy on `no-wait-for-timeout` and conditional test patterns before raising repo-wide strictness.
- Effort: `M`

### D7 - Governance/tooling monolith and command surface sprawl

- Bucket: `governance/tooling`
- Score: `21/26` (`riesgo_prod=2`, `friccion_equipo=3`, `churn_actual=1`, `blast_radius=2`)
- Evidence:
    - `agent-orchestrator.js` is about `1971` lines and carries `17` ESLint warnings.
    - `package.json` exposes `140` scripts, including many governance-specific entrypoints.
    - `AGENT_BOARD.yaml` tracks `224` tasks, while daily status still depends on multiple command families (`status`, `board doctor`, `jobs`, `leases`, `metrics`).
- Impact:
    - Workflow knowledge is concentrated in one CLI and one large script surface.
    - Governance is now central to delivery, so its own complexity is becoming a delivery tax.
- Why now:
    - Governance is not a sidecar anymore; it is part of the deploy and coordination path.
- First move:
    - Split read-only diagnostics from mutating board commands.
    - Generate a thinner command map and smaller domain-specific entrypoints.
- Effort: `L`

### D8 - Branch batch-size debt across unrelated surfaces

- Bucket: `process`
- Score: `20/26` (`riesgo_prod=2`, `friccion_equipo=2`, `churn_actual=2`, `blast_radius=2`)
- Evidence:
    - Current diff spans `55` files.
    - Bucketed churn includes `37` frontend files, `9` ops files, `10` test files, `12` desktop files, `3` governance files, and only `1` backend file.
- Impact:
    - The branch blends queue UI, desktop runtime, workflows, production scripts, tests, and governance evidence in one review surface.
    - That increases attribution cost and makes rollback reasoning harder.
- Why now:
    - This debt is active, not historical. The current branch is already demonstrating the pattern.
- First move:
    - Enforce smaller themed slices for queue/admin, desktop, ops, and board evidence even when they belong to one initiative.
- Effort: `S/M`

### D9 - Root surface and compatibility shim sprawl

- Bucket: `repo ergonomics`
- Score: `18/26` (`riesgo_prod=1`, `friccion_equipo=3`, `churn_actual=1`, `blast_radius=2`)
- Evidence:
    - The repo root contains `98` tracked files.
    - Root counts include `18` markdown files, `11` PowerShell files, `17` PHP files, `11` CSS files, and `6` JS files.
    - `docs/ROOT_SURFACES.md` and `docs/OPERATIONS_INDEX.md` both spend significant space explaining why these root surfaces still exist.
- Impact:
    - Contributors must learn exception rules before they can navigate the repo confidently.
    - Compatibility shims are useful, but there are enough of them to become part of the cognitive load.
- Why now:
    - Root shims are still part of daily docs, deploy flow, and local operations.
- First move:
    - Keep only runtime entrypoints and a minimal compatibility layer in the root.
    - Push discovery and operations docs fully into `docs/**`.
- Effort: `M/L`

### D10 - Legacy/archive adjacency still taxes the active mental model

- Bucket: `repo ergonomics`
- Score: `13/26` (`riesgo_prod=1`, `friccion_equipo=2`, `churn_actual=0`, `blast_radius=2`)
- Evidence:
    - `84` archived files are still tracked under archive paths.
    - Large legacy queue/admin files remain searchable inside the tree:
        - `src/apps/archive/admin-legacy/legacy-index.js` (`4703` lines)
        - `src/apps/archive/admin-legacy/modules/queue.js` (`2917` lines)
        - `src/apps/archive/admin-v2/modules/queue.js` (`2006` lines)
    - `README.md` and `docs/OPERATIONS_INDEX.md` still need to explain legacy boundaries explicitly.
- Impact:
    - This is not live runtime risk, but it still competes for search results, ownership context, and onboarding attention.
- Why now:
    - Queue work is active, and the archive contains similar names and domain concepts.
- First move:
    - Strengthen archive path conventions and editor/search excludes.
    - Document one explicit rollback entrypoint instead of keeping legacy context distributed.
- Effort: `M`

## Quick Wins (1 week)

- Reduce Playwright debt in the top five offending files by replacing `page.*` access with locator-based helpers and removing explicit timeouts where possible.
- Stop linting generated/minified runtime outputs as if they were authored source, or at least separate their findings from source debt summaries.
- Normalize deploy and monitor entrypoints so Actions, root wrappers, and `scripts/ops/**` call the same underlying commands.
- Split `tests/admin-queue.spec.js` into smaller capability-focused files before it grows further.
- Turn `install-hub.js` into a thin composition root and move one subdomain out first (`registry`, `alerts`, or `pilot`) to establish the pattern.

## Structural Debt (2-6 weeks)

- Decompose the queue/turnero domain into a shared contract/read-model layer used by admin, web operator, kiosk, and desktop shells.
- Reshape artifact policy so build outputs are validated as outputs, not reviewed as primary source.
- Break `agent-orchestrator.js` into domain modules with a smaller CLI facade.
- Reduce root compatibility surfaces and move operational discovery fully into `docs/**`.
- Harden branch slicing rules so deploy, queue runtime, desktop, and governance evidence do not accumulate into one mixed review batch.

## Reproduction Commands

Run the commands below to refresh the audit:

```powershell
git status --short
git diff --stat
git diff --shortstat
node agent-orchestrator.js status --json
node agent-orchestrator.js task ls --active --json
node agent-orchestrator.js board doctor --json
npm run lint
git grep -n -E '(test|it|describe)\.skip|test\.fixme|it\.fixme|todo\(' -- tests tests-node src
```

For file concentration metrics, re-run the line-count and grouping commands used during the audit or an equivalent local script that reads `git ls-files` and aggregates:

- total tracked files
- root-only tracked files
- generated asset counts
- longest active source/test files

## Conclusion

The repo's biggest debt is not missing coverage or missing governance. It is the cost of changing a few hot domains that now span too many surfaces at once. The queue/turnero vertical and the deploy/ops path are the two places where structural cleanup will buy the most stability and speed.
