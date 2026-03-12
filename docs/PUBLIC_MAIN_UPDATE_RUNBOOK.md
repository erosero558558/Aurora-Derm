# Public Main Update Runbook

Operational runbook to verify that a commit pushed to `main` becomes visible on the live public site.

Routine GitHub uploads should use a dedicated branch and the workflow documented in `docs/GITHUB_PUSH_WORKFLOW.md`. This runbook applies only when you intentionally promote a verified commit to `main` for live publication.

## Source of truth

- current public source: V6 Astro + `content/public-v6/**`
- generated artifacts committed to the repo: `es/**`, `en/**`, `_astro/**`
- generated runtime artifacts committed to the repo: `script.js`, `styles.css`, `styles-deferred.css`, `js/chunks/**`, `js/engines/**`
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

`build:public:v6` is the canonical public runner. It validates V6 content, builds Astro, syncs root artifacts, and writes `verification/public-v6-canonical/build-report.json`.

2. Push the verified commit to `main`.

3. Let the host sync promote the committed public artifacts.

The host sync now deploys the versioned public artifacts already committed in
`main`. It does not rebuild Astro on the VPS during cron sync.

4. If you need to force the host sync:

```bash
/usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh
```

If the repo is dirty only because of canonical generated public outputs left by
previous manual runs, the cron wrapper restores those paths from `HEAD` before
continuing. Any other dirty path still blocks the sync as a safety guard.

5. Verify host state:

```bash
cat /var/lib/pielarmonia/public-sync-status.json
tail -n 20 /var/log/sync-pielarmonia.log
curl -s https://pielarmonia.com/api.php?resource=health
```

Quick repo-side incident triage:

```powershell
pwsh -File scripts/ops/prod/MONITOR-PRODUCCION.ps1
```

`MONITOR-PRODUCCION.ps1` is the fast-fail entrypoint for `checks.publicSync`.
It should surface `jobId`, `failureReason`, `lastErrorMessage`,
`currentHead`, `remoteHead`, `headDrift`, `dirtyPathsCount`,
`dirtyPathsSample`, and `telemetryGap` before you intervene on the host.
If you need observation mode without hiding the incident, run it with
`-AllowDegradedPublicSync`.

Triage the canonical `publicSync` signals before touching the host:

- `failureReason=working_tree_dirty` is the canonical first-pass classification for tracked repo drift on the VPS.
- `headDrift=true` means `currentHead` and `remoteHead` diverge, so the host repo is behind or detached from the intended `main` commit.
- `telemetryGap=true` means the cron failed without exposing `currentHead`, `remoteHead`, or dirty tracked paths; treat it as incomplete host runtime telemetry until the updated wrapper is deployed.
- `failureReason=working_tree_dirty` with `telemetryGap=false` means the cron had enough telemetry and `dirtyPathsCount` / `dirtyPathsSample` should identify the tracked drift to clean up.

## Success criteria

- `checks.publicSync.configured=true`
- `checks.publicSync.jobId=8d31e299-7e57-4959-80b5-aaa2d73e9674`
- `checks.publicSync.healthy=true`
- `checks.publicSync.ageSeconds <= 120`
- `checks.publicSync.deployedCommit` matches the commit pushed to `main`
- `checks.publicSync.failureReason=""`
- `checks.publicSync.headDrift=false`
- `checks.publicSync.telemetryGap=false`

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

## Repair workflow escalation

If the GitHub runner cannot reach SSH/22 but the site is still serving traffic,
prefer the repair workflow first:

```bash
gh workflow run repair-git-sync.yml --ref main \
  -f dispatch_transport_fallback=true
```

`repair-git-sync.yml` now evaluates `verification/last-deploy-verify.json`
before escalating. It only dispatches `deploy-hosting.yml` automatically when
the pattern is consistent with a stale host rather than a total outage:

- `ssh_repair_outcome != success`
- `verify_after_repair_outcome = failure`
- `smoke_post_repair_outcome = success`
- the verify report includes stale-host signals such as `deploy-freshness`,
  `index-ref:*`, `index-asset-refs:*`,
  `health-public-sync-working-tree-dirty`, or
  `health-public-sync-telemetry-gap`

This keeps the emergency transport fallback conservative. Generic verify
failures without the stale-host signature do not auto-dispatch transport.

If you also want the repair workflow to try the Windows runner path, opt into
the self-hosted fallback from the same repair dispatch:

```bash
gh workflow run repair-git-sync.yml --ref main \
  -f dispatch_transport_fallback=true \
  -f dispatch_self_hosted_fallback=true
```

With that flag enabled, `repair-git-sync.yml` now does three things off the same
stale-host signature:

1. dispatches `diagnose-host-connectivity.yml`
2. dispatches `deploy-hosting.yml` transport fallback
3. dispatches `deploy-frontend-selfhosted.yml` and records its initial state

Read the repair summary before re-running anything manually:

- `connectivity_diagnose_run_status` tells you whether the network probe was observed.
- `self_hosted_fallback_state=queued` means the self-hosted runner is not available yet; the fallback is waiting for runner capacity, not blocked by repo logic.
- `self_hosted_fallback_state=started` means the Windows runner picked up the job.
- `self_hosted_fallback_state=dispatched_not_observed` means GitHub accepted the dispatch but the repair workflow could not observe the downstream run quickly enough.

`diagnose-host-connectivity.yml` now publishes both `connectivity-report.txt`
and `connectivity-report.json`. When every configured host origin finishes
without puertos abiertos, it raises
`[ALERTA PROD] Diagnose host connectivity sin ruta de deploy`; that incident
closes automatically once a later diagnose run observes any open target again.

If you need to skip repair and update the page immediately, dispatch
`deploy-hosting.yml` directly with the transport fallback command above.

If `deploy-hosting.yml` stops at `Preflight red (Prod)` and the summary reports
`transport_preflight_reason=runner_tcp_unreachable`, GitHub Actions cannot open
the selected transport port from the runner. Try both `ftps:21` and `sftp:22`;
if both report `runner_tcp_unreachable`, treat it as a runner-to-host network
block, not as a repo/build regression.

Early-failure transport runs should now still upload useful evidence:

- `.public-cutover/transport-preflight.json` with the effective protocol/port classification
- `verification/last-admin-ui-rollout-gate-deploy-hosting.json` as a placeholder report when the admin rollout gate never ran because transport failed first

If either artifact is missing after a fresh run from `main`, treat that as a
workflow regression rather than a host-network symptom.

`deploy-hosting.yml` now raises a dedicated issue,
`[ALERTA PROD] Deploy Hosting transporte bloqueado desde GitHub Runner`, when a
non-dry-run transport preflight ends in `runner_tcp_unreachable`. The incident
is keyed by `transport_preflight_target` and closes automatically after a later
transport preflight returns `transport_preflight_reason=ok`, even if the rest
of the workflow still needs separate follow-up.

When that transport preflight fails, `deploy-hosting.yml` now also dispatches
`diagnose-host-connectivity.yml` automatically and records
`connectivity_diagnose_run_status` plus `connectivity_diagnose_run_url` in both
the workflow summary and the transport incident. If the status stays
`dispatched_not_observed`, GitHub accepted the dispatch but the downstream
diagnostic run was not observable yet from the parent workflow.

If `deploy-frontend-selfhosted.yml` stays `queued`, the repo is ready but no
self-hosted Windows runner is online. Restoring that runner is a separate
infrastructure action from fixing the host network path.

`repair-git-sync.yml` now raises
`[ALERTA PROD] Repair git sync self-hosted fallback sin runner` when it
dispatches `deploy-frontend-selfhosted.yml` and the downstream run stays
`queued` or `dispatched_not_observed`. The incident closes automatically once
the self-hosted fallback is observed running/completed, or when repair no
longer recommends that fallback path.

In that case, inspect `.public-cutover/transport-preflight.json` from the run
artifact and move to a manual host-side publish path:

1. Publish from the server or hosting console, for example `bash ./bin/deploy-public-v3-live.sh` in `/var/www/figo`
2. Verify page freshness with `pwsh -File scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1`
3. Verify cron health with `node agent-orchestrator.js jobs verify public_main_sync --json`
4. Restore runner reachability to `:21` or `:22` before depending on `deploy-hosting.yml` again

After a transport fallback publish, verify both layers explicitly:

1. Page freshness via `pwsh -File scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1`
2. Host cron health via `node agent-orchestrator.js jobs verify public_main_sync --json`

The page can be current even while `public_main_sync` remains unhealthy. In
that case, the remaining debt is host-side cron/SSH recovery, not public asset
publication.

## Historical wrappers

The repo still contains `deploy-public-v3-live.sh` and `deploy-public-v3-cron-sync.sh` because the server wrapper naming is historical.

Those scripts deploy the current V6 artifact set. Their names are legacy only.

If the emergency VPS publish path needs a different Nginx-served local verify
host, use `LOCAL_VERIFY_BASE_URL=...` with `deploy-public-v3-live.sh`.
`TEST_BASE_URL` remains for local QA/audits and should not be mixed with the
VPS live verify target.
