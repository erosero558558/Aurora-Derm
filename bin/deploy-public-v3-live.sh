#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${REPO:-/var/www/figo}"
TARGET_COMMIT="${TARGET_COMMIT:-$(git -C "$REPO" rev-parse --short origin/main 2>/dev/null || echo main)}"
SITE_PATH="${SITE_PATH:-/etc/nginx/sites-enabled/pielarmonia}"
NGINX_BIN="${NGINX_BIN:-/usr/sbin/nginx}"
INSTALL_DEPS="${INSTALL_DEPS:-true}"
DISABLE_DESTRUCTIVE_SYNC_CRON="${DISABLE_DESTRUCTIVE_SYNC_CRON:-true}"
LOCAL_VERIFY_BASE_URL="${LOCAL_VERIFY_BASE_URL:-http://127.0.0.1:8080}"
LOCAL_VERIFY_BASE_URL="${LOCAL_VERIFY_BASE_URL%/}"

require_cmd() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Missing required command: $command_name" >&2
        exit 1
    fi
}

require_cmd git
require_cmd curl
require_cmd perl
require_cmd systemctl
test -x "$NGINX_BIN"
test -d "$REPO"

collect_generated_vendor_metadata_files() {
    local generated_files=(
        "vendor/autoload.php"
        "vendor/composer/autoload_classmap.php"
        "vendor/composer/autoload_files.php"
        "vendor/composer/autoload_namespaces.php"
        "vendor/composer/autoload_psr4.php"
        "vendor/composer/autoload_real.php"
        "vendor/composer/autoload_static.php"
        "vendor/composer/installed.php"
        "vendor/composer/installed.json"
        "vendor/composer/InstalledVersions.php"
        "vendor/composer/platform_check.php"
    )
    local file
    for file in "${generated_files[@]}"; do
        if git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
            printf '%s\n' "$file"
        fi
    done

    git ls-files -- 'vendor/bin/*'
}

reset_generated_vendor_metadata() {
    local tracked_files=()
    local file

    while IFS= read -r file; do
        if [ -n "$file" ]; then
            tracked_files+=("$file")
        fi
    done < <(collect_generated_vendor_metadata_files)

    if [ "${#tracked_files[@]}" -gt 0 ]; then
        git checkout -- "${tracked_files[@]}"
        echo "Reset tracked Composer-generated metadata."
    fi
}

verify_canonical_public_artifacts() {
    local required_paths=(
        "es/index.html"
        "en/index.html"
        "_astro"
        "script.js"
        "styles.css"
        "styles-deferred.css"
        "js/chunks"
        "js/engines"
    )
    local required_path
    for required_path in "${required_paths[@]}"; do
        if [ ! -e "$REPO/$required_path" ]; then
            echo "Missing canonical public artifact: $REPO/$required_path" >&2
            exit 1
        fi
    done

    echo "Canonical public artifacts present in repo checkout."
}

cd "$REPO"

if [ "$DISABLE_DESTRUCTIVE_SYNC_CRON" = "true" ] && command -v crontab >/dev/null 2>&1; then
    echo "== Cron guard =="
    current_crontab="$(mktemp)"
    filtered_crontab="$(mktemp)"

    if crontab -l >"$current_crontab" 2>/dev/null; then
        awk -v repo="$REPO" '
            index($0, repo) && index($0, "git clean -fd") { next }
            { print }
        ' "$current_crontab" >"$filtered_crontab"

        if ! cmp -s "$current_crontab" "$filtered_crontab"; then
            crontab "$filtered_crontab"
            echo "Removed destructive cron entries targeting $REPO with git clean -fd."
        else
            echo "No destructive git clean cron entries found for $REPO."
        fi
    else
        echo "No user crontab present."
    fi

    rm -f "$current_crontab" "$filtered_crontab"
fi

echo "== Repo =="
git fetch origin --prune
git checkout -f main
git reset --hard "$TARGET_COMMIT"
git rev-parse --short HEAD

if [ "$INSTALL_DEPS" = "true" ]; then
    echo "== Dependencies =="
    if command -v composer >/dev/null 2>&1; then
        composer install --no-dev --optimize-autoloader --prefer-dist --no-progress
        reset_generated_vendor_metadata
    else
        echo "Composer not found; skipping composer install."
    fi
fi

echo "== Verify canonical public artifacts =="
verify_canonical_public_artifacts
ls -ld "$REPO/es" "$REPO/en" "$REPO/_astro" "$REPO/js/chunks" "$REPO/js/engines"

if [ -f "$SITE_PATH" ]; then
    echo "== Patch live Nginx redirect safety =="
    if ! grep -q "absolute_redirect off;" "$SITE_PATH"; then
        perl -0pi -e 's/index index\.php index\.html;/index index.php index.html;\n    absolute_redirect off;\n    port_in_redirect off;/' "$SITE_PATH"
    fi
    perl -0pi -e 's#location = / \{\s*return 301 .*?;\s*\}#location = / {\n        return 301 https://\$host/es/\$is_args\$args;\n    }#s;' "$SITE_PATH"
    perl -0pi -e 's#location = /index\.html \{\s*return 301 .*?;\s*\}#location = /index.html {\n        return 301 https://\$host/es/\$is_args\$args;\n    }#s;' "$SITE_PATH"
    perl -0pi -e 's{return 301 /es/}{return 301 https://\$host/es/}g; s{return 301 /en/}{return 301 https://\$host/en/}g;' "$SITE_PATH"
fi

echo "== Nginx test =="
"$NGINX_BIN" -t

echo "== Reload Nginx =="
systemctl reload nginx

echo "== Local verify =="
echo "Local verify target: $LOCAL_VERIFY_BASE_URL"
curl -I "$LOCAL_VERIFY_BASE_URL/"
curl -I "$LOCAL_VERIFY_BASE_URL/es/"
curl -I "$LOCAL_VERIFY_BASE_URL/en/"
curl -I "$LOCAL_VERIFY_BASE_URL/telemedicina.html"

echo "== Public verify =="
curl -I https://pielarmonia.com/
curl -I https://pielarmonia.com/es/
curl -I https://pielarmonia.com/en/
curl -I https://pielarmonia.com/telemedicina.html

echo "== Done =="
echo "Commit actual: $(git rev-parse --short HEAD)"
