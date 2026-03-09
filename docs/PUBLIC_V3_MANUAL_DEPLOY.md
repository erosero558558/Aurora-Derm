# Public Deploy Wrapper (Legacy Name)

This runbook keeps its historical filename because the VPS wrapper is still named `deploy-public-v3-live.sh`.

Current reality:

- the current public source is V6
- the deploy script publishes V6 artifacts from `main`
- `es/**`, `en/**` and `_astro/**` are the only public artifacts expected in the repo root

## Target host

- repo: `/var/www/figo`
- docroot: `/var/www/figo`
- nginx site: `/etc/nginx/sites-enabled/pielarmonia`

## When to use it

Use this only if:

- `origin/main` already contains the target commit
- the server cron git-sync did not materialize the new commit
- you need an emergency publish path on the VPS

## Publish

Run as `root` on the VPS or through OpenClaw:

```bash
cd /var/www/figo
bash ./bin/deploy-public-v3-live.sh
```

To publish a specific commit:

```bash
cd /var/www/figo
TARGET_COMMIT=<commit-sha> bash ./bin/deploy-public-v3-live.sh
```

## Verify artifacts

```bash
cd /var/www/figo
test -f es/index.html && echo ES_OK
test -f en/index.html && echo EN_OK
test -d _astro && echo ASTRO_OK
ls -ld es en _astro
```

## Verify live routing

```bash
curl -I https://pielarmonia.com/
curl -I https://pielarmonia.com/index.html
curl -I https://pielarmonia.com/es/
curl -I https://pielarmonia.com/en/
curl -I https://pielarmonia.com/es/telemedicina/
curl -I https://pielarmonia.com/telemedicina.html
```

Expected:

- `/` returns `301` to `/es/`
- `/index.html` returns `301` to `/es/`
- `/telemedicina.html` returns `301` to `/es/telemedicina/`
- `/es/` returns `200`
- `/en/` returns `200`

## Notes

- The wrapper name is legacy.
- The public artifact set is V6.
- Legacy public HTML files such as root `index.html`, `telemedicina.html`, `servicios/**/*.html` and `ninos/**/*.html` are redirect-only and should not exist as authoring source anymore.
