# Public Deploy Cron Install

Nota: el wrapper `deploy-public-v3-cron-sync.sh` conserva un nombre histórico. El cron publica el set actual de artefactos V6.

## Regla principal

El scheduler de verdad en producción es el cron ya existente con `JOB_ID=8d31e299-7e57-4959-80b5-aaa2d73e9674`.

No crear un segundo cron en el host validado si ya existe `/root/sync-pielarmonia.sh`.

## Host validado

- repo: `/var/www/figo`
- job key: `public_main_sync`
- job id: `8d31e299-7e57-4959-80b5-aaa2d73e9674`
- lock: `/tmp/sync-pielarmonia.lock`
- log: `/var/log/sync-pielarmonia.log`
- status runtime: `/var/lib/pielarmonia/public-sync-status.json`

Cron canónico:

```cron
* * * * * JOB_ID=8d31e299-7e57-4959-80b5-aaa2d73e9674 PUBLIC_SYNC_JOB_KEY=public_main_sync PUBLIC_SYNC_STATUS_PATH=/var/lib/pielarmonia/public-sync-status.json /usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh >> /var/log/sync-pielarmonia.log 2>&1
```

## Si el host no tiene `/root/sync-pielarmonia.sh`

Usar el wrapper del repo:

```bash
cd /var/www/figo
chmod +x bin/deploy-public-v3-cron-sync.sh
crontab -l 2>/dev/null | {
  cat
  echo '* * * * * JOB_ID=8d31e299-7e57-4959-80b5-aaa2d73e9674 PUBLIC_SYNC_JOB_KEY=public_main_sync PUBLIC_SYNC_STATUS_PATH=/var/lib/pielarmonia/public-sync-status.json /usr/bin/flock -n /tmp/sync-pielarmonia.lock /var/www/figo/bin/deploy-public-v3-cron-sync.sh >> /var/log/sync-pielarmonia.log 2>&1'
} | crontab -
```

## Verificación

```bash
crontab -l
tail -n 50 /var/log/sync-pielarmonia.log
cat /var/lib/pielarmonia/public-sync-status.json
curl -s https://pielarmonia.com/api.php?resource=health
```

El `health` público debe exponer `checks.publicSync.jobId=8d31e299-7e57-4959-80b5-aaa2d73e9674`.
