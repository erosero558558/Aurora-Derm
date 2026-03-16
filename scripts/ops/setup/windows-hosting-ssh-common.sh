#!/usr/bin/env bash
set -euo pipefail

WINDOWS_EXPECTED_COMMIT_DEFAULT="c7619c25ad5ad5ad0436b80d75d6effb7d9f1e8b"
WINDOWS_MIRROR_PATH_DEFAULT='C:\dev\pielarmonia-clean-main'
WINDOWS_ENV_PATH_DEFAULT='C:\ProgramData\Pielarmonia\hosting\env.php'
WINDOWS_RELEASE_TARGET_PATH_DEFAULT='C:\ProgramData\Pielarmonia\hosting\release-target.json'
WINDOWS_HOSTING_DIR_DEFAULT='C:\ProgramData\Pielarmonia\hosting'
WINDOWS_PUBLIC_DOMAIN_DEFAULT='pielarmonia.com'

windows_hosting_log() {
    printf '[windows-hosting-ssh] %s\n' "$*" >&2
}

windows_hosting_die() {
    windows_hosting_log "ERROR: $*"
    exit 1
}

windows_hosting_require_command() {
    local command_name="$1"
    command -v "$command_name" >/dev/null 2>&1 || windows_hosting_die "No existe el comando requerido: $command_name"
}

windows_hosting_init_env() {
    export WINDOWS_EXPECTED_COMMIT="${WINDOWS_EXPECTED_COMMIT:-$WINDOWS_EXPECTED_COMMIT_DEFAULT}"
    export WINDOWS_MIRROR_PATH="${WINDOWS_MIRROR_PATH:-$WINDOWS_MIRROR_PATH_DEFAULT}"
    export WINDOWS_ENV_PATH="${WINDOWS_ENV_PATH:-$WINDOWS_ENV_PATH_DEFAULT}"
    export WINDOWS_RELEASE_TARGET_PATH="${WINDOWS_RELEASE_TARGET_PATH:-$WINDOWS_RELEASE_TARGET_PATH_DEFAULT}"
    export WINDOWS_HOSTING_DIR="${WINDOWS_HOSTING_DIR:-$WINDOWS_HOSTING_DIR_DEFAULT}"
    export WINDOWS_PUBLIC_DOMAIN="${WINDOWS_PUBLIC_DOMAIN:-$WINDOWS_PUBLIC_DOMAIN_DEFAULT}"
    export SSH_PORT="${SSH_PORT:-22}"
    export SSH_CONNECT_TIMEOUT="${SSH_CONNECT_TIMEOUT:-20}"
    export SSH_SERVER_ALIVE_INTERVAL="${SSH_SERVER_ALIVE_INTERVAL:-15}"
    export SSH_SERVER_ALIVE_COUNT_MAX="${SSH_SERVER_ALIVE_COUNT_MAX:-4}"
    export SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"
}

windows_hosting_ps_literal() {
    printf "%s" "$1" | sed "s/'/''/g"
}

windows_hosting_prepare_ssh() {
    windows_hosting_require_command ssh
    windows_hosting_require_command git

    WINDOWS_SSH_CMD=(
        ssh
        -o BatchMode=yes
        -o "StrictHostKeyChecking=${SSH_STRICT_HOST_KEY_CHECKING}"
        -o "ConnectTimeout=${SSH_CONNECT_TIMEOUT}"
        -o "ServerAliveInterval=${SSH_SERVER_ALIVE_INTERVAL}"
        -o "ServerAliveCountMax=${SSH_SERVER_ALIVE_COUNT_MAX}"
    )

    if [[ -n "${SSH_IDENTITY_FILE:-}" ]]; then
        [[ -f "${SSH_IDENTITY_FILE}" ]] || windows_hosting_die "No existe SSH_IDENTITY_FILE=${SSH_IDENTITY_FILE}"
        WINDOWS_SSH_CMD+=(-i "${SSH_IDENTITY_FILE}")
    fi

    if [[ -n "${SSH_HOST_ALIAS:-}" ]]; then
        WINDOWS_SSH_TARGET="${SSH_HOST_ALIAS}"
        return
    fi

    [[ -n "${SSH_HOST:-}" ]] || windows_hosting_die "Define SSH_HOST o SSH_HOST_ALIAS"
    [[ -n "${SSH_USERNAME:-}" ]] || windows_hosting_die "Define SSH_USERNAME o SSH_HOST_ALIAS"
    WINDOWS_SSH_CMD+=(-p "${SSH_PORT}")
    WINDOWS_SSH_TARGET="${SSH_USERNAME}@${SSH_HOST}"
}

windows_hosting_encode_powershell() {
    if command -v python3 >/dev/null 2>&1; then
        python3 -c 'import base64, sys; data = sys.stdin.read().encode("utf-16le"); sys.stdout.write(base64.b64encode(data).decode())'
        return
    fi

    windows_hosting_require_command iconv
    windows_hosting_require_command base64
    iconv -f UTF-8 -t UTF-16LE | base64 | tr -d '\n'
}

windows_hosting_run_remote_powershell() {
    local label="$1"
    local script_text="$2"
    local encoded_script
    local stdout_file
    local stderr_file
    local exit_code

    encoded_script="$(printf '%s' "${script_text}" | windows_hosting_encode_powershell)"
    stdout_file="$(mktemp)"
    stderr_file="$(mktemp)"
    exit_code=0

    if ! "${WINDOWS_SSH_CMD[@]}" "${WINDOWS_SSH_TARGET}" \
        "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded_script}" \
        >"${stdout_file}" 2>"${stderr_file}"; then
        exit_code=$?
    fi

    windows_hosting_log "label=${label} target=${WINDOWS_SSH_TARGET} exit_code=${exit_code}"
    if [[ -s "${stdout_file}" ]]; then
        cat "${stdout_file}"
    fi
    if [[ -s "${stderr_file}" ]]; then
        cat "${stderr_file}" >&2
    fi

    rm -f "${stdout_file}" "${stderr_file}"
    return "${exit_code}"
}

windows_hosting_verify_remote_main_pin() {
    local repo_root="$1"
    local remote_head

    remote_head="$(git -C "${repo_root}" ls-remote origin refs/heads/main | awk '{print $1}')"
    [[ -n "${remote_head}" ]] || windows_hosting_die "No se pudo resolver origin/main desde el repo local"
    if [[ "${remote_head}" != "${WINDOWS_EXPECTED_COMMIT}" ]]; then
        windows_hosting_die "origin/main=${remote_head} no coincide con WINDOWS_EXPECTED_COMMIT=${WINDOWS_EXPECTED_COMMIT}"
    fi
}

windows_hosting_warn_local_dirty_tree() {
    local repo_root="$1"
    local dirty

    dirty="$(git -C "${repo_root}" status --porcelain 2>/dev/null || true)"
    if [[ -n "${dirty}" ]]; then
        windows_hosting_log "El checkout local esta sucio; el wrapper no lo usa como fuente de deploy. Solo se ejecuta origin/main@${WINDOWS_EXPECTED_COMMIT} en el host remoto."
    fi
}
