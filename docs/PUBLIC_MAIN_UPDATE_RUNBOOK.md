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

## Criterio de éxito

- `checks.publicSync.configured=true`
- `checks.publicSync.jobId=8d31e299-7e57-4959-80b5-aaa2d73e9674`
- `checks.publicSync.healthy=true`
- `checks.publicSync.ageSeconds <= 120`
- `checks.publicSync.deployedCommit` coincide con el SHA publicado
