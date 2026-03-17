# Runtime Artifact Policy

This document defines the source-vs-output boundary for versioned frontend
artifacts staged under `.generated/site-root/` and transported from
`_deploy_bundle/`.

## Rule

- Review source-of-truth files first.
- Treat generated runtime assets as outputs.
- Validate output drift with artifact checks before shipping.
- Do not hand-edit staged runtime bundles or deploy copies.

## Review Order

1. Review the authored source modules that own the behavior change.
2. Regenerate the affected bundles or page artifacts into `.generated/site-root/`.
3. Run the canonical output checks.
4. Inspect stage or bundle diffs only to confirm expected propagation.

## Public Web Families

### Public V6 source of truth

Authored source:

- `src/apps/astro/src/pages/**`
- `src/apps/astro/src/components/public-v6/**`
- `src/apps/astro/src/layouts/PublicShellV6.astro`
- `src/apps/astro/src/lib/public-v6.js`
- `src/apps/astro/src/styles/public-v6/**`
- `content/public-v6/**`
- `js/public-v6-shell.js`

Generated deploy outputs:

- `es/**`
- `en/**`
- `_astro/**`

These outputs are staged in `.generated/site-root/` and copied into
`_deploy_bundle/` for transport deploys.

Canonical validators:

- `npm run check:public:v6:artifacts`
- `npm run check:deploy:artifacts`

### Root public runtime source of truth

Authored source:

- `js/main.js`
- `src/apps/booking/**`
- `src/apps/chat/**`
- `src/apps/analytics/**`
- `src/bundles/**`

Generated runtime outputs:

- `script.js`
- `js/chunks/**`
- `js/engines/**`
- `js/booking-calendar.js`

For this migration pass, the generated runtime graph is written into
`.generated/site-root/`. The gateway support layer remains authored from the
repo root:

- `styles.css`
- `styles-deferred.css`
- `sw.js`

Canonical validators:

- `npm run check:public:runtime:artifacts`
- `npm run chunks:public:check`
- `npm run check:runtime:compat:versions`
- `npm run assets:versions:check`
- `npm run check:runtime:artifacts`

`check:runtime:compat:versions` is the canonical compatibility validator. If
legacy HTML bridge surfaces still exist, it keeps them aligned with the
versioned runtime; if they no longer exist, it still verifies that `sw.js`
pins explicit runtime versions. `assets:versions:check` remains as a
backwards-compatible alias for existing habits and scripts.

## Admin Runtime Family

Authored source:

- `src/apps/admin/index.js`
- `src/apps/admin-v3/**`

Generated runtime outputs:

- `admin.js`
- `js/admin-chunks/**`

These outputs are staged in `.generated/site-root/`. The compatibility/support
layer remains authored from the repo root:

- `js/admin-preboot-shortcuts.js`
- `js/admin-runtime.js`

Canonical validators:

- `npm run chunks:admin:check`
- `npm run test:admin:runtime-smoke`
- `npm run gate:admin:rollout`
- `npm run check:runtime:artifacts`

## Lint And Ownership Policy

- `eslint.config.js` excludes generated runtime bundles from authored-source
  lint so lint debt stays attached to source modules.
- Deploy safety does not depend on linting `admin.js`, `script.js`,
  `js/chunks/**`, `js/admin-chunks/**`, or `js/engines/**`.
- Deploy safety depends on the artifact contracts above plus the runtime smoke
  and gate flows that consume those outputs.
- `publish checkpoint` publishes source plus evidence and ignores stage/bundle
  hygiene noise; live confirmation belongs to deploy/post-deploy.

## Canonical Commands

- `npm run workspace:hygiene:doctor`
  Runs the V5 strategy-aware doctor across all worktrees and reports
  `overall_state`, `scope_context`, `strategy_context`, `lane_context`,
  `scope_counts`, aggregated `issues[]`, `candidate_tasks[]`, `split_plan[]`,
  and a phased `remediation_plan[]`.
- `npm run workspace:hygiene:doctor -- --include-entries`
  Expands the JSON output with `dirty_entries[]`; use `--include-entries` only
  when debugging needs the full path list.
- `npm run workspace:hygiene:doctor -- --task-id CDX-044 --show-candidates`
  Pins the doctor to an explicit task and expands the human output with
  suggested candidate tasks; use repeated `--scope-pattern <glob>` when a
  manual scope cut is safer than auto-detection.
- `npm run check:runtime:artifacts`
  Runs the shared validator for root public runtime outputs plus admin chunks
  and compatibility version pin checks.
- `npm run check:deploy:artifacts`
  Extends the runtime validator with `es/**`, `en/**`, and `_astro/**`
  verification for deploy-ready output review.
- `npm run bundle:deploy`
  Builds `_deploy_bundle/` from authored repo files plus the staged generated
  outputs in `.generated/site-root/`.
- `npm run legacy:generated-root:status`
  Reports tracked root copies that still belong to the generated-runtime
  contract and classifies them as `legacy_generated_root`.
- `npm run legacy:generated-root:check`
  Fails while tracked root copies still exist or if `.gitignore` is missing the
  canonical ignore patterns for those outputs.
- `npm run legacy:generated-root:apply`
  Runs `git rm --cached` only against the canonical legacy root output set and
  preserves local files in the working tree.

## Practical Rule

If a PR changes both source modules and generated assets, review the source
diff as the primary change. Use the generated diff only to confirm that the
checked staged outputs match the source and that chunk/hash churn is
intentional. Do not treat `public_main_sync` as the local publish gate for
frontend artifacts; it remains host-side telemetry only.

If `workspace:hygiene:doctor` reports `legacy_generated_root`, those paths are
still tracked migration debt in the repo root. They are not the canonical stage
or deploy source anymore, and `publish checkpoint` should keep treating them as
blocking drift until they are deindexed with the legacy cleanup flow above.

If `workspace:hygiene:doctor` reports `attention`, inspect `scope_context`,
`strategy_context`, `lane_context`, `scope_counts`, and the authored issue
disposition:
`in_scope` means expected task WIP, `out_of_scope` means drift that blocks
publish/sync, `unknown_scope` means the doctor could not map the authored
changes to a single active Codex task, `mixed_lane` means the worktree needs a
split, and `blocked_scope` / `outside_strategy` indicate drift against
`strategy.active`.

If `workspace:hygiene:doctor` reports `legacy_generated_root_deindexed`, the
deindexado already happened but the staged
deletions still need commit or stash before `publish checkpoint` or
`sync-main-safe` can proceed.
