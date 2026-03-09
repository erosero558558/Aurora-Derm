# Deployment Playbook

This document defines the current public deployment contract for Piel en Armonia.

## 1. Current model

The public web is now a V6 static surface generated from Astro.

Primary publish path:

1. Edit the V6 source.
2. Run `npm run build:public:v6`.
3. Run `npm run check:public:v6:artifacts`.
4. Commit generated `es/**`, `en/**` and `_astro/**`.
5. Push to `main`.
6. The production cron git-sync updates `/var/www/figo`.

GitHub Actions validate the release and can be used as a transport fallback, but they do not replace `main` as the source of truth.

Reference contract:

- [public-v6-canonical-source.md](./public-v6-canonical-source.md)
- [PUBLIC_MAIN_UPDATE_RUNBOOK.md](./PUBLIC_MAIN_UPDATE_RUNBOOK.md)

## 2. What is canonical

Public authoring source:

- `src/apps/astro/src/pages/**`
- `src/apps/astro/src/components/public-v6/**`
- `src/apps/astro/src/layouts/PublicShellV6.astro`
- `src/apps/astro/src/lib/public-v6.js`
- `src/apps/astro/src/styles/public-v6/**`
- `content/public-v6/**`
- `js/public-v6-shell.js`
- `images/optimized/**`

Generated deploy artifacts:

- `es/**`
- `en/**`
- `_astro/**`

Legacy public routes survive only as redirects:

- `/`
- `/index.html`
- `/telemedicina.html`
- `/servicios/*.html`
- `/ninos/*.html`

## 3. Automatic deploy

The workflow `.github/workflows/deploy-hosting.yml` can still:

1. Validate the repo.
2. Build public artifacts.
3. Publish through git-sync, FTP or SFTP depending on configuration.
4. Run public routing and conversion smoke checks.

Operational priority:

1. `main`
2. server cron git-sync
3. GitHub Actions as validation or manual fallback

## 4. Manual or emergency publish

If git-sync is stuck or the host is not receiving `origin/main`, use:

- [PUBLIC_MAIN_UPDATE_RUNBOOK.md](./PUBLIC_MAIN_UPDATE_RUNBOOK.md)
- [PUBLIC_V3_MANUAL_DEPLOY.md](./PUBLIC_V3_MANUAL_DEPLOY.md)

Important:

- `PUBLIC_V3_MANUAL_DEPLOY.md` keeps its historical name because the server wrapper still uses `deploy-public-v3-live.sh`.
- The current public source is V6, not V3.

## 5. Rollback

Preferred rollback:

1. Revert the bad commit on Git.
2. Push the revert to `main`.
3. Let git-sync publish the previous stable public artifacts.

If storage or operational data also require recovery, follow the runtime data restore runbook in `docs/RUNBOOKS.md`. Do not assume `store.json` is the canonical storage without checking the current environment.

## 6. Required validation

### Build and artifact contract

Run:

```bash
npm run build:public:v6
npm run check:public:v6:artifacts
```

### Public quality gate

Run:

```bash
npm run gate:public:v6:canonical-publish
```

This gate validates:

- public V6 build
- artifact drift
- V6 frontend QA
- copy audit
- visual contract
- Sony parity
- routing smoke
- conversion smoke
- single-source guardrail

## 7. Manual smoke checklist

1. [ ] `https://pielarmonia.com/` redirects to `/es/`.
2. [ ] `https://pielarmonia.com/index.html` redirects to `/es/`.
3. [ ] `https://pielarmonia.com/telemedicina.html` redirects to `/es/telemedicina/`.
4. [ ] `https://pielarmonia.com/es/` and `https://pielarmonia.com/en/` return `200`.
5. [ ] Home ES/EN render `data-v6-header`, `data-v6-hero`, `data-v6-news-strip`.
6. [ ] Home ES shows `Reserva online en mantenimiento`.
7. [ ] Home EN shows `Online booking under maintenance`.
8. [ ] Hub, service, telemedicine and legal routes return `200`.
9. [ ] No public route depends on `#citas`, `#appointmentForm` or `#serviceSelect`.
10. [ ] `admin.html` still resolves the correct admin variant.

## 8. Notes for production host

The validated host currently exposes:

- repo: `/var/www/figo`
- job key: `public_main_sync`
- status file: `/var/lib/pielarmonia/public-sync-status.json`
- log: `/var/log/sync-pielarmonia.log`

The public shell deployed by git-sync is the V6 artifact set stored in the repo root under `es/`, `en/` and `_astro/`.
