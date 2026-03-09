# Public Main Update Runbook

Operational runbook to verify that a commit pushed to `main` becomes visible on the live public site.

## Source of truth

- current public source: V6 Astro + `content/public-v6/**`
- generated artifacts committed to the repo: `es/**`, `en/**`, `_astro/**`
- production repo: `/var/www/figo`
- publish mechanism: git-sync cron
- job key: `public_main_sync`
- job id: `8d31e299-7e57-4959-80b5-aaa2d73e9674`
- lock: `/tmp/sync-pielarmonia.lock`
- log: `/var/log/sync-pielarmonia.log`
- status: `/var/lib/pielarmonia/public-sync-status.json`

## Recommended release flow

1. Build and verify locally:

```bash
npm run build:public:v6
npm run check:public:v6:artifacts
npm run gate:public:v6:canonical-publish
```

2. Push the verified commit to `main`.

3. If you need to force the host sync:

```bash
/usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh
```

4. Verify host state:

```bash
cat /var/lib/pielarmonia/public-sync-status.json
tail -n 20 /var/log/sync-pielarmonia.log
curl -s https://pielarmonia.com/api.php?resource=health
```

## Success criteria

- `checks.publicSync.configured=true`
- `checks.publicSync.jobId=8d31e299-7e57-4959-80b5-aaa2d73e9674`
- `checks.publicSync.healthy=true`
- `checks.publicSync.ageSeconds <= 120`
- `checks.publicSync.deployedCommit` matches the commit pushed to `main`

## Transport fallback

If git-sync is unhealthy or blocked, use the transport fallback workflow:

```bash
gh workflow run deploy-hosting.yml --ref main \
  -f force_transport_deploy=true \
  -f protocol=ftps \
  -f require_staging_canary=false \
  -f allow_prod_without_staging=true \
  -f run_postdeploy_fast=false \
  -f run_postdeploy_gate=false \
  -f skip_public_conversion_smoke=true
```

Use this only to unblock transport. It does not change the canonical public source model:

1. `main` stays canonical
2. V6 artifacts stay canonical
3. git-sync stays the preferred publish path

## Historical wrappers

The repo still contains `deploy-public-v3-live.sh` and `deploy-public-v3-cron-sync.sh` because the server wrapper naming is historical.

Those scripts deploy the current V6 artifact set. Their names are legacy only.
