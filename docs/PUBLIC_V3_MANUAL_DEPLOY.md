# Public V3 Manual Deploy

Use this runbook when `origin/main` already contains the target commit but GitHub-hosted deploy paths do not publish it to the live host.

## Target host

- Repo: `/var/www/figo`
- Docroot: `/var/www/figo`
- Nginx site: `/etc/nginx/sites-enabled/pielarmonia`
- Expected public commit for AG-117: `ba55460`

## When to use it

Use this path if any of these conditions is true:

- `Deploy Hosting (Canary Pipeline)` finishes green but production still serves the previous shell.
- `git-sync` on the hosting panel reports an older commit than `origin/main`.
- GitHub runners cannot reach the hosting FTP or SFTP ports.

## Publish steps

Run as `root` on the VPS or through OpenClaw:

```bash
cd /var/www/figo
bash ./bin/deploy-public-v3-live.sh
```

To publish a specific commit:

```bash
cd /var/www/figo
TARGET_COMMIT=ba55460 bash ./bin/deploy-public-v3-live.sh
```

## Verify generated routes

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

Expected results:

- `/` returns `301` to `/es/`
- `/index.html` returns `301` to `https://pielarmonia.com/es/`
- `/es/` returns `200`
- `/en/` returns `200`
- `/es/telemedicina/` returns `200`
- `/telemedicina.html` returns `301` to `/es/telemedicina/`

The script also patches the live Nginx site to:

- force `https://$host/es/` for `/` and `/index.html`
- force canonical legacy redirects like `/telemedicina.html` and `/servicios/*.html` to `https://$host/...`
- avoid leaking the internal `:8080` port behind Cloudflare
- use `/usr/sbin/nginx` directly so the shell `PATH` does not matter

## Compatibility alias

During migration, `bin/deploy-public-v2-live.sh` remains available as a shim and delegates to `deploy-public-v3-live.sh`.

## Rollback

If the new static shell must be reverted quickly:

```bash
cd /var/www/figo
git fetch origin --prune
git reset --hard <previous-stable-commit>
/usr/sbin/nginx -t && systemctl reload nginx
```
