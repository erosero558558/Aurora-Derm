#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${REPO:-/var/www/figo}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
REMOTE_REF="${REMOTE_REF:-main}"
LOCK_FILE="${LOCK_FILE:-/tmp/pielarmonia-public-deploy.lock}"
LOG_PATH="${LOG_PATH:-/var/log/pielarmonia-public-deploy.log}"
INSTALL_DEPS="${INSTALL_DEPS:-true}"
DISABLE_DESTRUCTIVE_SYNC_CRON="${DISABLE_DESTRUCTIVE_SYNC_CRON:-true}"
DEPLOY_TIMEOUT_SEC="${DEPLOY_TIMEOUT_SEC:-900}"

require_cmd() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Missing required command: $command_name" >&2
        exit 1
    fi
}

require_cmd git
require_cmd flock
require_cmd bash

if [ ! -d "$REPO/.git" ]; then
    echo "Repo path is not a git checkout: $REPO" >&2
    exit 1
fi

mkdir -p "$(dirname "$LOCK_FILE")"
mkdir -p "$(dirname "$LOG_PATH")"
touch "$LOG_PATH"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "Another deploy sync is already running. Skipping."
    exit 0
fi

cd "$REPO"

DEPLOY_SCRIPT=""
if [ -f "$REPO/bin/deploy-public-v3-live.sh" ]; then
    DEPLOY_SCRIPT="$REPO/bin/deploy-public-v3-live.sh"
elif [ -f "$REPO/bin/deploy-public-v2-live.sh" ]; then
    DEPLOY_SCRIPT="$REPO/bin/deploy-public-v2-live.sh"
else
    echo "No deploy script found in $REPO/bin" >&2
    exit 1
fi

{
    echo "[$(date -Is)] cron-sync start"

    current_head="$(git rev-parse HEAD)"
    git fetch "$REMOTE_NAME" --prune
    remote_head="$(git rev-parse "$REMOTE_NAME/$REMOTE_REF")"

    if [ -n "$(git status --porcelain)" ]; then
        echo "Working tree is dirty. Refusing to overwrite local changes."
        exit 1
    fi

    if [ "$current_head" = "$remote_head" ]; then
        echo "No remote changes detected at $REMOTE_NAME/$REMOTE_REF."
        exit 0
    fi

    echo "Deploying new commit ${remote_head:0:7} with $(basename "$DEPLOY_SCRIPT")"

    if command -v timeout >/dev/null 2>&1; then
        timeout "$DEPLOY_TIMEOUT_SEC" env \
            TARGET_COMMIT="$remote_head" \
            INSTALL_DEPS="$INSTALL_DEPS" \
            DISABLE_DESTRUCTIVE_SYNC_CRON="$DISABLE_DESTRUCTIVE_SYNC_CRON" \
            bash "$DEPLOY_SCRIPT"
    else
        env \
            TARGET_COMMIT="$remote_head" \
            INSTALL_DEPS="$INSTALL_DEPS" \
            DISABLE_DESTRUCTIVE_SYNC_CRON="$DISABLE_DESTRUCTIVE_SYNC_CRON" \
            bash "$DEPLOY_SCRIPT"
    fi

    echo "[$(date -Is)] cron-sync done at ${remote_head:0:7}"
} >>"$LOG_PATH" 2>&1
