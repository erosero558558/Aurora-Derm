# Public Deploy Cron Install

Use this only on the VPS/OpenClaw host when you want production to auto-publish the latest `origin/main` without running the manual deploy every time.

## Current production note

El servidor validado el `2026-03-02` ya tenia un sync operativo en `/root/sync-pielarmonia.sh`.

En ese servidor, la accion correcta fue:

1. corregir permisos de `bin/deploy-public-v3-live.sh`
2. ejecutar `/usr/bin/flock -n /tmp/sync-pielarmonia.lock /root/sync-pielarmonia.sh`
3. subir ese cron existente a `* * * * *`

No crear un segundo cron si el host ya tiene ese sync. Para ese caso, usar primero [PUBLIC_MAIN_UPDATE_RUNBOOK.md](./PUBLIC_MAIN_UPDATE_RUNBOOK.md).

## What this does

- runs every minute
- fetches `origin/main`
- skips when there is no new commit
- uses `flock` so two deploys cannot overlap
- refuses to deploy if the repo working tree is dirty
- calls `bin/deploy-public-v3-live.sh` when present, otherwise falls back to `bin/deploy-public-v2-live.sh`
- writes a persistent log

## Install the cron wrapper

Usa este wrapper solo si el servidor no tiene ya un sync productivo equivalente.

From the repo root on the server:

```bash
cd /var/www/figo
chmod +x bin/deploy-public-v3-cron-sync.sh
```

Install the cron entry:

```bash
crontab -l 2>/dev/null | { cat; echo '* * * * * REPO=/var/www/figo LOG_PATH=/var/log/pielarmonia-public-deploy.log /usr/bin/env bash /var/www/figo/bin/deploy-public-v3-cron-sync.sh'; } | crontab -
```

## Verify

```bash
crontab -l
tail -n 50 /var/log/pielarmonia-public-deploy.log
```

Expected idle log line:

```text
No remote changes detected at origin/main.
```

Expected deploy log line:

```text
Deploying new commit <sha> with deploy-public-v3-live.sh
```

## Remove it

```bash
crontab -l | grep -v 'deploy-public-v3-cron-sync.sh' | crontab -
```

## Important tradeoff

This reduces manual deploy friction, but it also means any new `origin/main` commit can reach production within one minute. Only use it if `main` is already treated as production-ready.
