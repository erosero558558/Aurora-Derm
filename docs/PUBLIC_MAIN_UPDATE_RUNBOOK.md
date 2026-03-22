# Public Main Update Runbook

Operational runbook to verify that a commit pushed to `main` becomes visible on the live public site.

Routine GitHub uploads should use a dedicated branch and the workflow documented in `docs/GITHUB_PUSH_WORKFLOW.md`. This runbook applies only when you intentionally promote a verified commit to `main` for live publication.

## Source of truth

- current public source: V6 Astro + `content/public-v6/**`
- generated deploy artifacts staged in `.generated/site-root/`: `es/**`, `en/**`, `_astro/**`
- generated runtime graph staged in `.generated/site-root/`: `script.js`, `js/chunks/**`, `js/engines/**`
- authored support layer that still lives in repo root: `styles.css`, `styles-deferred.css`, `sw.js`
- transport bundle: `_deploy_bundle/`
- production repo: `/var/www/figo`
- publish mechanism: `close` for Codex closeout, `publish checkpoint` only for manual exceptions, plus deploy/post-deploy
- host-side legacy telemetry/fallback: git-sync cron
- cron install / host wrapper: `docs/PUBLIC_V3_CRON_INSTALL.md`
- job key: `public_main_sync`
- job id: `8d31e299-7e57-4959-80b5-aaa2d73e9674`
- lock: `/tmp/sync-pielarmonia.lock`
- log: `/var/log/sync-pielarmonia.log`
- status: `/var/lib/pielarmonia/public-sync-status.json`
- canonical workspace truth: `node agent-orchestrator.js status --json`, `board doctor --json`, `board reconcile --json`

## Recommended release flow

1. Build and verify locally:

```bash
npm run build:public:v6
npm run check:public:v6:artifacts
npm run gate:public:v6:canonical-publish
```

`build:public:v6` is the canonical public runner. It validates V6 content,
builds Astro, stages generated artifacts into `.generated/site-root/`, and
writes `verification/public-v6-canonical/build-report.json`.

2. Close out and publish source, or build the deploy bundle:

```bash
node agent-orchestrator.js close <AG-ID|CDX-ID> --evidence verification/agent-runs/<task_id>.md --expect-rev <rev> --json
# manual/exception path
node agent-orchestrator.js task start <AG-ID|CDX-ID> --release-publish --expect-rev <rev> --json
node agent-orchestrator.js publish checkpoint <AG-ID|CDX-ID> --summary "release-publish ..." --expect-rev <rev> --json
# or
npm run bundle:deploy
```

`close` es la ruta canónica para tareas `executor=codex`: exige evidencia,
crea el commit final con board + evidencia + cambios in-scope, publica a
`origin/main`, refresca `origin/main` local y falla si la rama actual no queda
alineada (`ahead=0`, `behind=0`). `publish checkpoint` no espera a
`public_main_sync` y queda como ruta manual/de excepción. Si el push ya entró
a `main` pero la telemetría todavía no confirma deploy, cualquiera de las dos
rutas puede devolver `live_status=pending` con
`warning_code=publish_live_verification_pending` sin revertir el publish.
`bundle:deploy` es la ruta canónica del paquete de transporte.

Antes de `close` o `publish checkpoint`, el workspace debe quedar sin fork de
board entre worktrees. Si `workspace_truth.ok=false`, o si `main` conserva
authored `mixed_lane`, authored fuera de scope o un board paralelo activo,
el publish queda bloqueado hasta reconciliar con `node agent-orchestrator.js board reconcile --json`.

3. Let deploy/post-deploy confirm the live state. Use `public_main_sync` only
   as host-side telemetry or when you intentionally need the legacy git-sync
   fallback path.

4. If you intentionally need to force the legacy host sync:

```bash
/usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh
```

If the repo is dirty only because of canonical generated public outputs left by
previous manual runs, the cron wrapper restores those paths from `HEAD` before
continuing. Any other dirty path still blocks the sync as a safety guard.

To verify the host wrapper matches the canonical script before touching the
repo, compare both files directly:

```bash
sha256sum /root/sync-pielarmonia.sh /var/www/figo/bin/deploy-public-v3-cron-sync.sh
```

For the same host-side triage, the canonical checklist now snapshots
`.generated/site-root/` and `_deploy_bundle/` together with
`public-sync-status.json`, so generated staging noise is not mistaken for
authored repo drift.

```bash
pwsh -File scripts/ops/prod/CHECKLIST-HOST-PUBLIC-SYNC.ps1
```

Use that checklist as the host-side closure contract too:
`checks.storage.storeEncryptionCompliant=true`.

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
`currentHead`, `remoteHead`, `headDrift`, `repoHygieneIssue`, `dirtyPathsCount`,
`dirtyPathsSample`, and `telemetryGap` before you intervene on the host.
If you need observation mode without hiding the incident, run it with
`-AllowDegradedPublicSync`.
Use `health-diagnostics` as the canonical rich runtime surface for that triage,
not the public `health` payload alone.

When `content/turnero/clinic-profile.json` is in `release.mode=web_pilot`,
that same monitor now runs
`node bin/turnero-clinic-profile.js verify-remote --base-url <domain> --json`
and raises `turneroPilot` in the triage if the live host exposes another
`clinic_id`, another `profileFingerprint`, or a pilot catalog/canon mismatch.

The same monitor now also resolves open GitHub `production-alert` issues for
`deploy-hosting`, `diagnose-host-connectivity`, `repair-git-sync`, and
`self-hosted-runner`. Expect a `github.deployAlerts` line with live issue
numbers whenever the deploy path is blocked outside the host itself.
When `public_main_sync` is healthy again with matching heads and
`dirtyPathsCount=0`, `prod-monitor.yml` now closes stale deploy-route alerts
for `deploy-hosting`, `diagnose-host-connectivity`, and the
`repair-git-sync` self-hosted fallback. You can wait for the scheduled monitor
or dispatch `prod-monitor.yml` manually against the default production domain.
The first recovery pass may still fail while those issues are open, but it
should close them so the next pass sees `github.deployAlerts relevantCount=0`.

`VERIFICAR-DESPLIEGUE.ps1 -RequireCronReady` and
`SMOKE-PRODUCCION.ps1 -RequireCronReady` now resolve the same GitHub deploy
alerts and fail by default while those incidents remain open. Use
`-AllowOpenGitHubDeployAlerts` only for observation runs where you need the
rest of the runtime evidence without muting the live GitHub incident.
`SMOKE-PRODUCCION.ps1` now also prints `turneroPilot recoveryTargets`, so the
manual lane shows the same hosting/self-hosted closure context as monitor,
verify, and the workflow artifacts.

For the web pilot, `SMOKE-PRODUCCION.ps1` now also runs
`node bin/turnero-clinic-profile.js verify-remote --base-url <domain> --json`
whenever the active profile is `release.mode=web_pilot`, and fails if the live
host exposes another `clinic_id`, another `profileFingerprint`, or another
pilot catalog/canon than the local release.

`GATE-POSTDEPLOY.ps1` now does the local half first: it resolves
`content/turnero/clinic-profile.json`, confirms catalog alignment, and only
then spends the full `verify + smoke + bench` run. That keeps broken pilot
profiles from looking like generic runtime failures later in the gate.

When the active `content/turnero/clinic-profile.json` is in `release.mode=web_pilot`,
`VERIFICAR-DESPLIEGUE.ps1` also runs
`node bin/turnero-clinic-profile.js verify-remote --base-url <domain> --json`
and fails with `turnero-pilot-profile-status` or `turnero-pilot-remote-verify`
if the live host exposes a different `clinic_id`, `profileFingerprint`, catalog
status, or pilot canon than the local release.
`verification/last-deploy-verify.json` now persists that snapshot as
`turneroPilot`, and both `post-deploy-fast.yml` and `post-deploy-gate.yml`
surface `Turnero pilot` lines in `GITHUB_STEP_SUMMARY` and incident bodies.
Those summaries now also expose `statusResolved`, `verifyRemoteRequired`, and
`releaseMode`, and now also `recoveryTargets`, so ops can see whether the pilot was truly blocked or simply
`not_required` for a non-`web_pilot` release without opening the raw JSON.
Both lanes now also emit standalone workflow artifacts
`verification/last-turnero-pilot-fast.json` and
`verification/last-turnero-pilot-gate.json`, so the pilot verdict survives even
when you only need the workflow evidence and not the full verify report. Those
artifacts now also persist the `recoveryTargets` carried by the web-pilot lane.
The same verification lane also keeps storage posture visible through
`storeEncryptionStatus`, `storeEncryptionRequired`, and
`storeEncryptionCompliant`, so a healthy publish never hides storage drift in
the same pass.
`repair-git-sync.yml` now emits the same verdict after self-heal as
`verification/last-turnero-pilot-repair.json` plus the artifact
`repair-turnero-pilot-report`, so ops can distinguish a repaired host from a
host that remained on the wrong clinic/fingerprint after the git reset.
`deploy-hosting.yml` now does the same on the local side: it resolves the
active `clinic-profile` before publish, writes
`.public-cutover/turnero-pilot-status.json`, and exposes that status in the
deploy summary before dispatching the post-deploy workflows.
After publish, `deploy-hosting.yml` also runs
`node bin/turnero-clinic-profile.js verify-remote --base-url <domain> --json`,
writes `.public-cutover/turnero-pilot-remote.json`, blocks the dispatch of
`post-deploy-fast.yml` / `post-deploy-gate.yml` if the live host no longer
matches the staged pilot profile, and fails the workflow with the remote
reason in the summary.
If that remote verify stays blocked, `deploy-hosting.yml` now raises
`[ALERTA PROD] Deploy Hosting turneroPilot bloqueado` and closes it only when
the next successful publish verifies the live clinic/fingerprint again.
The manual Windows fallback `deploy-frontend-selfhosted.yml` now enforces the
same pilot contract before the clinic can be opened: it resolves the active
`clinic-profile`, writes `.selfhosted-cutover/turnero-pilot-status.json`,
runs `node bin/turnero-clinic-profile.js verify-remote --base-url <domain> --json`
after publish, writes `.selfhosted-cutover/turnero-pilot-remote.json`, uploads
`verification/last-turnero-pilot-selfhosted.json`, and raises
`[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado` if the live
host no longer matches the expected clinic/fingerprint.
That same manual lane now also raises
`[ALERTA PROD] Deploy Frontend Self-Hosted ruta bloqueada` when the fallback
itself fails during `build`, `deploy` or `validate`, so a broken Windows/manual
publish path no longer looks like a silent operator-only failure.
If a later `repair-git-sync.yml` run still leaves the pilot blocked, it now
raises `[ALERTA PROD] Repair git sync turneroPilot bloqueado` and closes it
only when repair returns the host to `ready` or `not_required`.

Triage the canonical `publicSync` signals before touching the host:

- `verificationSource=health_url` with `failureReason=health_missing_public_sync` means the host answered `health`, but it is still serving a stale public contract without `checks.publicSync`. Fix that rollout before classifying the incident as repo drift.
- `verificationSource=health_url` with `failureReason=health_http_502` or another `health_http_*` means the public `health` route answered with an HTTP failure. Treat that first as backend/edge rollout breakage and recover the route before debugging repo drift or cron internals.
- `verificationSource=registry_only` with `failureReason=unverified` means `node agent-orchestrator.js jobs verify public_main_sync --json` could only confirm the registry entry and could not fetch live host telemetry. Treat that first as missing or unreachable runtime evidence from `health` / `health-diagnostics` or the VPS status file, not as repo drift.
- `failureReason=working_tree_dirty` is the canonical first-pass classification for tracked repo drift on the VPS.
- `headDrift=true` means `currentHead` and `remoteHead` diverge, so the host repo is behind or detached from the intended `main` commit.
- `telemetryGap=true` means the cron failed without exposing `currentHead`, `remoteHead`, or dirty tracked paths; treat it first as incomplete host runtime telemetry from a stale `/root/sync-pielarmonia.sh` wrapper or other legacy host entrypoint until the updated wrapper is deployed.
- `failureReason=working_tree_dirty` with `telemetryGap=false` means the cron had enough telemetry and `dirtyPathsCount` / `dirtyPathsSample` should identify the tracked drift to clean up.

When `health_missing_public_sync` or `registry_only/unverified` appears, keep the first verification pass narrow:

1. `curl -s https://pielarmonia.com/api.php?resource=health`
2. `curl -s https://pielarmonia.com/api.php?resource=health-diagnostics`
3. `cat /var/lib/pielarmonia/public-sync-status.json`
4. confirm the host wrapper is the canonical `/root/sync-pielarmonia.sh` / `bin/deploy-public-v3-cron-sync.sh` pair

If the public `health` payload still does not expose `checks.publicSync.jobId`,
assume the live host has not picked up the updated `controllers/HealthController.php`
yet. Fix that rollout first; otherwise `jobs verify public_main_sync --json`
will keep failing with `failureReason=health_missing_public_sync` or, if the
endpoint becomes unreachable, fall back to `verificationSource=registry_only`
even when the cron exists and the VPS status file is healthy.

For the host-side command checklist, use:

```powershell
pwsh -File scripts/ops/prod/CHECKLIST-HOST-PUBLIC-SYNC.ps1
```

The checklist closes only when `checks.publicSync.jobId` is visible in public
`health` and `storeEncryptionCompliant=true` remains true in
`health-diagnostics`.

Only after those checks should you classify the incident as `headDrift`, `working_tree_dirty`, or a transport/runtime failure deeper in the host.

Triage the GitHub-side deploy corroboration in the same pass:

- `github.deployAlerts transport blocked` maps to the open incident created by `deploy-hosting.yml` when the GitHub-hosted runner cannot open the transport port.
- `github.deployAlerts deploy connectivity blocked` maps to `diagnose-host-connectivity.yml` proving that no configured target is reachable from GitHub-hosted infrastructure.
- `github.deployAlerts self-hosted runner blocked` means the Windows fallback path is queued or otherwise unavailable, so the repo-side fallback is waiting on runner capacity.
- `github.deployAlerts self-hosted deploy blocked` means `deploy-frontend-selfhosted.yml` ran but the manual Windows fallback itself failed during `build`, `deploy` or `validate`, so the lane exists but did not close the publish.
- `github.deployAlerts repair git sync blocked` means repair still recommends the self-hosted fallback path and the incident remains open.
- `github.deployAlerts turnero pilot blocked` means `deploy-hosting.yml` published a host that no longer matches the staged `clinic-profile` (`clinic_id`, `profileFingerprint` or catalog/canon drift), so the pilot must not be opened yet.
- `diagnose-host-connectivity.yml` now enriches that same transport triage with the local `turneroPilot` identity (`clinicId`, `profileFingerprint`, `catalogReady`, `releaseMode`) inside `connectivity-report.json/.txt` and the connectivity incident body, so a blocked route can still be tied to the clinic that was about to go live.
- That same connectivity diagnose now also publishes `turnero_pilot_recovery_targets`, so the route report keeps the same hosting/self-hosted closure context as the rest of the web-pilot lane.
- When `deploy-hosting.yml` dispatches `diagnose-host-connectivity.yml`, it now also passes the expected pilot identity (`clinicId`, `profileFingerprint`, `releaseMode`), and the connectivity report records `turnero_pilot_expected_match` / `turnero_pilot_expected_reason` to expose any drift between the deploy attempt and the profile resolved by the diagnostic run.
- `deploy-hosting.yml` and `deploy-frontend-selfhosted.yml` now also persist `turneroPilot.recoveryTargets` in their own manifests/reports and incident bodies, so the deploy lane itself speaks the same recovery language as `post-deploy`, `repair`, `monitor`, and weekly reporting.
- That same deploy lane now also mirrors `turnero_pilot_recovery_targets` in the transport/self-hosted-route incidents, so a blocked path still carries the expected pilot recovery context instead of only clinic/fingerprint metadata.
- `REPORTE-SEMANAL-PRODUCCION.ps1` persists the same GitHub deploy alert state in markdown/JSON as `githubDeployAlerts`, with warning codes `github_deploy_*`, and now also exposes `turneroPilot.recoveryTargets` so the weekly triage keeps the same closure context as the monitor/workflows.
- `prod-monitor.yml` can close that same `turnero pilot blocked` incident later, but only after rerunning `verify-remote` and confirming the live host matches the active pilot profile again. That recovery now applies to both `Deploy Hosting turneroPilot bloqueado` and `Deploy Frontend Self-Hosted turneroPilot bloqueado`.
- `repair-git-sync.yml` now keeps those same `recoveryTargets` in `verification/last-turnero-pilot-repair.json` and in its step summary, so repair evidence also says which pilot incidents a healthy recovery covers.
- `prod-monitor.yml` now also closes `[ALERTA PROD] Deploy Frontend Self-Hosted ruta bloqueada` once `public_main_sync` is healthy again, so a recovered site does not keep a stale manual-fallback incident open.
- That same `prod-monitor.yml` recovery now writes `.public-cutover-monitor/turnero-pilot-recovery.json` and uploads `prod-monitor-turnero-pilot-recovery`, including the `recoveryTargets` array for the hosting/self-hosted turneroPilot incidents it is allowed to close, so the closing `verify-remote` evidence survives beyond the issue comment and step summary.
- `VERIFICAR-DESPLIEGUE.ps1` persists the same incident state as failed assets `github-deploy-*`, so `verification/last-deploy-verify.json` now captures deploy-route blockers outside the host too.
- `VERIFICAR-DESPLIEGUE.ps1` now also persists `turneroPilot.recoveryTargets`, so the verify snapshot says which hosting/self-hosted pilot incidents can be closed by the same healthy `verify-remote`.
- `MONITOR-PRODUCCION.ps1` mirrors that context live in the console by printing `turneroPilot recoveryTargets` and appending them to the `github.deployAlerts turnero pilot blocked` failure line.

## Success criteria

- `checks.publicSync.configured=true`
- `checks.publicSync.jobId=8d31e299-7e57-4959-80b5-aaa2d73e9674`
- `checks.publicSync.healthy=true`
- `checks.publicSync.ageSeconds <= 120`
- `checks.publicSync.deployedCommit` matches the commit pushed to `main`
- `checks.publicSync.failureReason=""`
- `checks.publicSync.headDrift=false`
- `checks.publicSync.telemetryGap=false`
- `github.deployAlerts relevantCount=0`

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
before escalating. Once the pattern is consistent with a stale host rather than
a total outage, it always dispatches `diagnose-host-connectivity.yml` and then
keeps the actual deploy fallbacks conservative:

- `ssh_repair_outcome != success`
- `verify_after_repair_outcome = failure`
- `smoke_post_repair_outcome = success`
- the verify report includes stale-host signals such as `deploy-freshness`,
  `index-ref:*`, `index-asset-refs:*`,
  `health-public-sync-working-tree-dirty`, or
  `health-public-sync-telemetry-gap`

Generic verify failures without the stale-host signature do not dispatch the
connectivity diagnose or the deploy fallbacks.

During a successful SSH repair, the workflow now also re-installs the canonical
host wrapper:

```bash
install -m 0755 /var/www/figo/bin/deploy-public-v3-cron-sync.sh /root/sync-pielarmonia.sh
```

Read the repair summary for `host_cron_wrapper_sync_state`,
`host_cron_wrapper_sync_reason`, `host_cron_wrapper_path`, and
`host_cron_wrapper_source` before assuming the cron is still running the latest
wrapper.

If you also want the repair workflow to try the Windows runner path, opt into
the self-hosted fallback from the same repair dispatch:

```bash
gh workflow run repair-git-sync.yml --ref main \
  -f dispatch_transport_fallback=true \
  -f dispatch_self_hosted_fallback=true
```

With the same stale-host signature, `repair-git-sync.yml` now behaves like this:

1. It always dispatches `diagnose-host-connectivity.yml`.
2. It dispatches `deploy-hosting.yml` only if `dispatch_transport_fallback=true` or the repo automation enables that fallback.
3. It dispatches `deploy-frontend-selfhosted.yml` only if `dispatch_self_hosted_fallback=true` or the repo automation enables that fallback.

Read the repair summary before re-running anything manually:

- `connectivity_diagnose_dispatch_mode=diagnose_only` means repair only escalated the network probe and left deploy fallbacks untouched.
- `connectivity_diagnose_dispatch_mode=with_fallback` means the same repair run also requested at least one deploy fallback path.
- `connectivity_diagnose_run_status` tells you whether the network probe was observed; repair now retries that lookup once more before writing the final summary and prefers the same `headSha` while still falling back to the closest dispatch-window run if `main` advanced in the meantime.
- If the status still ends as `dispatched_not_observed`, the parent log now includes `recent_runs=...` with the latest child candidates that GitHub exposed during the retry window.
- `self_hosted_fallback_state=queued` means the self-hosted runner is not available yet; the fallback is waiting for runner capacity, not blocked by repo logic.
- `self_hosted_fallback_state=started` means the Windows runner picked up the job.
- `self_hosted_fallback_state=dispatched_not_observed` means GitHub accepted the dispatch but the repair workflow could not observe the downstream run quickly enough.

`diagnose-host-connectivity.yml` now publishes both `connectivity-report.txt`
and `connectivity-report.json`. When every configured host origin finishes
without puertos abiertos, it raises
`[ALERTA PROD] Diagnose host connectivity sin ruta de deploy`; that incident
closes automatically once a later diagnose run observes any open target again.
The workflow now manages that incident with shell + native Node fetch instead
of `actions/github-script`, so the diagnostic run no longer depends on
downloading that action before the job can even start.

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
the workflow summary and the transport incident. `deploy-hosting.yml` now also
retries that lookup once before the final summary, preferring the same
`headSha` but falling back to the closest dispatch-window run if `main`
advanced; if the status still ends as
`dispatched_not_observed`, GitHub accepted the dispatch but the downstream
diagnostic run never became observable during the parent workflow retry window;
the unresolved log now also prints `recent_runs=...` for faster triage.

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
