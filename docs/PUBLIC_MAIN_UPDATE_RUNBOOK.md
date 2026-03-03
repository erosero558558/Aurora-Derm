# Public Main Update Runbook

Runbook operativo para que un checkpoint publicado a `main` quede visible en la web y verificable por `health`.

## Fuente de verdad

- cron real: `/root/sync-pielarmonia.sh`
- job key: `public_main_sync`
- job id: `8d31e299-7e57-4959-80b5-aaa2d73e9674`
- lock: `/tmp/sync-pielarmonia.lock`
- log: `/var/log/sync-pielarmonia.log`
- status: `/var/lib/pielarmonia/public-sync-status.json`

## Flujo corto recomendado

1. Publicar desde el repo:

```bash
node agent-orchestrator.js publish checkpoint CDX-006 --summary "..." --expect-rev <rev> --json
```

2. Si hay que forzar el sync en el host:

```bash
/usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh
```

3. Verificar:

```bash
cat /var/lib/pielarmonia/public-sync-status.json
tail -n 20 /var/log/sync-pielarmonia.log
curl -s https://pielarmonia.com/api.php?resource=health
```

## Fallback manual de deploy

Si `vars.DEPLOY_METHOD=git-sync` esta roto o el host no esta recogiendo `main`, usar el pipeline manual de deploy con upload directo:

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

Uso correcto del override:

- `force_transport_deploy=true` solo para destrabar `git-sync` roto o estancado.
- `skip_public_conversion_smoke=true` solo para cambios backend/ops donde el smoke de conversion no refleja el scope del cambio.
- Despues del deploy, volver a verificar `health` y reactivar gates normales en el siguiente corte estable.

## Criterio de éxito

- `checks.publicSync.configured=true`
- `checks.publicSync.jobId=8d31e299-7e57-4959-80b5-aaa2d73e9674`
- `checks.publicSync.healthy=true`
- `checks.publicSync.ageSeconds <= 120`
- `checks.publicSync.deployedCommit` coincide con el SHA publicado
