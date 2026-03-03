#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${REPO:-/var/www/figo}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
REMOTE_REF="${REMOTE_REF:-main}"
JOB_ID="${JOB_ID:-8d31e299-7e57-4959-80b5-aaa2d73e9674}"
PUBLIC_SYNC_JOB_KEY="${PUBLIC_SYNC_JOB_KEY:-public_main_sync}"
PUBLIC_SYNC_STATUS_PATH="${PUBLIC_SYNC_STATUS_PATH:-/var/lib/pielarmonia/public-sync-status.json}"
LOCK_FILE="${LOCK_FILE:-/tmp/sync-pielarmonia.lock}"
LOG_PATH="${LOG_PATH:-/var/log/sync-pielarmonia.log}"
INSTALL_DEPS="${INSTALL_DEPS:-true}"
DISABLE_DESTRUCTIVE_SYNC_CRON="${DISABLE_DESTRUCTIVE_SYNC_CRON:-true}"
DEPLOY_TIMEOUT_SEC="${DEPLOY_TIMEOUT_SEC:-900}"
STATE="running"
STARTED_AT=""
FINISHED_AT=""
CHECKED_AT=""
LAST_SUCCESS_AT=""
LAST_ERROR_AT=""
LAST_ERROR_MESSAGE=""
CURRENT_HEAD=""
REMOTE_HEAD=""
DEPLOYED_COMMIT=""
PREV_LAST_SUCCESS_AT=""

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
require_cmd mktemp
require_cmd mv

iso_now() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

json_escape() {
    printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

read_previous_status_field() {
    local field="$1"
    if [ ! -f "$PUBLIC_SYNC_STATUS_PATH" ]; then
        return 0
    fi
    sed -n "s/.*\"${field}\":[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$PUBLIC_SYNC_STATUS_PATH" | head -n 1
}

write_status() {
    local state_value="$1"
    local error_message="${2:-}"
    local finished_value="${3:-}"
    local checked_value="${4:-}"
    local success_value="${5:-$LAST_SUCCESS_AT}"
    local error_at_value="${6:-$LAST_ERROR_AT}"
    local duration_ms=0
    if [ -n "$STARTED_AT" ]; then
        local started_epoch
        local checked_epoch
        started_epoch="$(date -u -d "$STARTED_AT" +%s 2>/dev/null || printf '0')"
        checked_epoch="$(date -u -d "${checked_value:-$STARTED_AT}" +%s 2>/dev/null || printf '0')"
        if [ "$started_epoch" -gt 0 ] && [ "$checked_epoch" -ge "$started_epoch" ]; then
            duration_ms="$(( (checked_epoch - started_epoch) * 1000 ))"
        fi
    fi

    mkdir -p "$(dirname "$PUBLIC_SYNC_STATUS_PATH")"
    local tmp_file
    tmp_file="$(mktemp "${PUBLIC_SYNC_STATUS_PATH}.tmp.XXXXXX")"
    cat >"$tmp_file" <<EOF
{
  "version": 1,
  "job_id": "$(json_escape "$JOB_ID")",
  "job_key": "$(json_escape "$PUBLIC_SYNC_JOB_KEY")",
  "state": "$(json_escape "$state_value")",
  "checked_at": "$(json_escape "${checked_value:-$CHECKED_AT}")",
  "started_at": "$(json_escape "$STARTED_AT")",
  "finished_at": "$(json_escape "$finished_value")",
  "last_success_at": "$(json_escape "$success_value")",
  "last_error_at": "$(json_escape "$error_at_value")",
  "last_error_message": "$(json_escape "$error_message")",
  "repo_path": "$(json_escape "$REPO")",
  "branch": "$(json_escape "$REMOTE_REF")",
  "current_head": "$(json_escape "$CURRENT_HEAD")",
  "remote_head": "$(json_escape "$REMOTE_HEAD")",
  "deployed_commit": "$(json_escape "$DEPLOYED_COMMIT")",
  "duration_ms": $duration_ms,
  "lock_file": "$(json_escape "$LOCK_FILE")",
  "log_path": "$(json_escape "$LOG_PATH")"
}
EOF
    chmod 0644 "$tmp_file"
    mv "$tmp_file" "$PUBLIC_SYNC_STATUS_PATH"
}

on_exit() {
    local code=$?
    if [ "$code" -ne 0 ]; then
        CHECKED_AT="$(iso_now)"
        FINISHED_AT="$CHECKED_AT"
        LAST_ERROR_AT="$CHECKED_AT"
        LAST_ERROR_MESSAGE="${LAST_ERROR_MESSAGE:-cron_sync_failed}"
        write_status "failed" "$LAST_ERROR_MESSAGE" "$FINISHED_AT" "$CHECKED_AT" "$LAST_SUCCESS_AT" "$LAST_ERROR_AT"
    fi
    exit "$code"
}

trap on_exit EXIT

if [ ! -d "$REPO/.git" ]; then
    echo "Repo path is not a git checkout: $REPO" >&2
    exit 1
fi

mkdir -p "$(dirname "$LOCK_FILE")"
mkdir -p "$(dirname "$LOG_PATH")"
touch "$LOG_PATH"
PREV_LAST_SUCCESS_AT="$(read_previous_status_field "last_success_at")"
LAST_SUCCESS_AT="$PREV_LAST_SUCCESS_AT"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "Another deploy sync is already running. Skipping."
    exit 0
fi

cd "$REPO"
STARTED_AT="$(iso_now)"
CHECKED_AT="$STARTED_AT"
write_status "running" "" "" "$CHECKED_AT" "$LAST_SUCCESS_AT" ""

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

    CURRENT_HEAD="$(git rev-parse HEAD)"
    git fetch "$REMOTE_NAME" --prune
    REMOTE_HEAD="$(git rev-parse "$REMOTE_NAME/$REMOTE_REF")"

    if [ "$CURRENT_HEAD" = "$REMOTE_HEAD" ]; then
        STATE="idle"
        DEPLOYED_COMMIT="$CURRENT_HEAD"
        CHECKED_AT="$(iso_now)"
        FINISHED_AT="$CHECKED_AT"
        write_status "$STATE" "" "$FINISHED_AT" "$CHECKED_AT" "$LAST_SUCCESS_AT" ""
        echo "No remote changes detected at $REMOTE_NAME/$REMOTE_REF."
        exit 0
    fi

    if [ -n "$(git status --porcelain)" ]; then
        LAST_ERROR_MESSAGE="working_tree_dirty"
        echo "Working tree is dirty. Refusing to overwrite local changes."
        git status --short || true
        exit 1
    fi

    echo "Deploying new commit ${REMOTE_HEAD:0:7} with $(basename "$DEPLOY_SCRIPT")"

    if command -v timeout >/dev/null 2>&1; then
        timeout "$DEPLOY_TIMEOUT_SEC" env \
            TARGET_COMMIT="$REMOTE_HEAD" \
            INSTALL_DEPS="$INSTALL_DEPS" \
            DISABLE_DESTRUCTIVE_SYNC_CRON="$DISABLE_DESTRUCTIVE_SYNC_CRON" \
            bash "$DEPLOY_SCRIPT"
    else
        env \
            TARGET_COMMIT="$REMOTE_HEAD" \
            INSTALL_DEPS="$INSTALL_DEPS" \
            DISABLE_DESTRUCTIVE_SYNC_CRON="$DISABLE_DESTRUCTIVE_SYNC_CRON" \
            bash "$DEPLOY_SCRIPT"
    fi

    DEPLOYED_COMMIT="$REMOTE_HEAD"
    LAST_SUCCESS_AT="$(iso_now)"
    CHECKED_AT="$LAST_SUCCESS_AT"
    FINISHED_AT="$LAST_SUCCESS_AT"
    STATE="ok"
    write_status "$STATE" "" "$FINISHED_AT" "$CHECKED_AT" "$LAST_SUCCESS_AT" ""
    echo "[$(date -Is)] cron-sync done at ${REMOTE_HEAD:0:7}"
} >>"$LOG_PATH" 2>&1
