# Runtime Artifact Policy

This document defines the source-vs-output boundary for versioned frontend
artifacts that stay committed because production publishes from git sync.

## Rule

- Review source-of-truth files first.
- Treat generated runtime assets as outputs.
- Validate output drift with artifact checks before shipping.
- Do not hand-edit committed runtime bundles.

## Review Order

1. Review the authored source modules that own the behavior change.
2. Regenerate the affected bundles or page artifacts.
3. Run the canonical output checks.
4. Inspect artifact diffs only to confirm expected propagation.

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

- `styles.css`
- `styles-deferred.css`
- `script.js`
- `js/chunks/**`
- `js/engines/**`
- `js/booking-calendar.js`

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
- `js/admin-preboot-shortcuts.js`
- `js/admin-runtime.js` as compatibility alias only

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

## Canonical Commands

- `npm run check:runtime:artifacts`
  Runs the shared validator for root public runtime outputs plus admin chunks
  and compatibility version pin checks.
- `npm run check:deploy:artifacts`
  Extends the runtime validator with `es/**`, `en/**`, and `_astro/**`
  verification for deploy-ready output review.

## Practical Rule

If a PR changes both source modules and generated assets, review the source
diff as the primary change. Use the generated diff only to confirm that the
checked outputs match the source and that chunk/hash churn is intentional.
