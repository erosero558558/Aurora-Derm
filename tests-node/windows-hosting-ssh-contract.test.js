#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const COMMON_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'windows-hosting-ssh-common.sh'
);
const DIAG_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'DIAGNOSTICAR-HOSTING-WINDOWS-SSH.sh'
);
const EXEC_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'EXECUTAR-HOSTING-WINDOWS-SSH.sh'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'setup', 'README.md');
const DOC_PATH = resolve(REPO_ROOT, 'docs', 'WINDOWS_HOSTING_REMOTE_SSH.md');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('helper SSH fija pin, target Windows y encoded command canonico', () => {
    const raw = load(COMMON_PATH);
    const requiredSnippets = [
        'WINDOWS_EXPECTED_COMMIT_FALLBACK="c7619c25ad5ad5ad0436b80d75d6effb7d9f1e8b"',
        "WINDOWS_MIRROR_PATH_DEFAULT='C:\\dev\\pielarmonia-clean-main'",
        "WINDOWS_ENV_PATH_DEFAULT='C:\\ProgramData\\Pielarmonia\\hosting\\env.php'",
        "WINDOWS_RELEASE_TARGET_PATH_DEFAULT='C:\\ProgramData\\Pielarmonia\\hosting\\release-target.json'",
        "WINDOWS_HOSTING_DIR_DEFAULT='C:\\ProgramData\\Pielarmonia\\hosting'",
        'windows_hosting_resolve_expected_commit()',
        'WINDOWS_EXPECTED_COMMIT no estaba definido; se usa origin/main=${WINDOWS_EXPECTED_COMMIT}',
        'SSH_HOST_ALIAS',
        'SSH_HOST',
        'SSH_USERNAME',
        'SSH_PORT',
        'SSH_IDENTITY_FILE',
        'StrictHostKeyChecking=${SSH_STRICT_HOST_KEY_CHECKING}',
        'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand',
        'git -C "${repo_root}" ls-remote origin refs/heads/main',
        'origin/main=${remote_head} no coincide con WINDOWS_EXPECTED_COMMIT=${WINDOWS_EXPECTED_COMMIT}',
        'El checkout local esta sucio; el wrapper no lo usa como fuente de deploy.',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(raw.includes(snippet), true, `falta snippet en helper SSH: ${snippet}`);
    }
});

test('wrapper diagnostico valida runtime fingerprint, auth local/publica y status files', () => {
    const raw = load(DIAG_PATH);
    const requiredSnippets = [
        'windows_hosting_resolve_expected_commit "${REPO_ROOT}"',
        'windows_hosting_verify_remote_main_pin',
        "__hosting/runtime",
        'admin-auth.php?action=status',
        'http://127.0.0.1/admin-auth.php?action=status',
        'https://{0}/admin-auth.php?action=status',
        "Join-Path $hostingDir 'repair-hosting-status.json'",
        "Join-Path $hostingDir 'main-sync-status.json'",
        "Join-Path $hostingDir 'hosting-supervisor-status.json'",
        'site_root_mismatch',
        'local_auth_contract_invalid',
        'public_auth_contract_invalid',
        'Write-Section -Name \'runtime_fingerprint\'',
        'Write-Section -Name \'diagnostic_summary\'',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(raw.includes(snippet), true, `falta snippet en diagnostico SSH: ${snippet}`);
    }
});

test('wrapper ejecucion remota aplica flujo canonico y evidencia final', () => {
    const raw = load(EXEC_PATH);
    const requiredSnippets = [
        'windows_hosting_resolve_expected_commit "${REPO_ROOT}"',
        'windows_hosting_verify_remote_main_pin',
        'git_fetch_origin',
        "Invoke-ExternalCommandSection -Name 'git_fetch_origin' -FilePath 'git' -Arguments @('fetch', 'origin')",
        "Invoke-ExternalCommandSection -Name 'git_reset_hard_origin_main' -FilePath 'git' -Arguments @('reset', '--hard', 'origin/main')",
        "Invoke-ExternalCommandSection -Name 'git_rev_parse_head' -FilePath 'git' -Arguments @('rev-parse', 'HEAD')",
        "Invoke-ScriptSection -Name 'start_hosting'",
        "-Arguments @('-StopLegacy', '-ExternalEnvPath', $envPath)",
        "Invoke-ScriptSection -Name 'repair_preflight'",
        "-Arguments @('-PromoteCurrentRemoteHead', '-PreflightOnly')",
        "Invoke-ScriptSection -Name 'repair_full'",
        "-Arguments @('-PromoteCurrentRemoteHead')",
        'runtime_fingerprint_pre_repair',
        'site_root_mismatch',
        'served_site_root_mismatch',
        'main_sync_not_ok',
        'main_sync_auth_contract_invalid',
        'supervisor_status_missing',
        'local_auth_contract_invalid',
        'public_auth_contract_invalid',
        'execution_summary',
        'http://127.0.0.1/__hosting/runtime',
        'http://127.0.0.1/admin-auth.php?action=status',
        'https://{0}/admin-auth.php?action=status',
        'current_commit_mismatch',
        'windows_hosting_ssh_execute_failed',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(raw.includes(snippet), true, `falta snippet en wrapper de ejecucion SSH: ${snippet}`);
    }
});

test('documentacion setup expone wrappers remotos y variables canonicas', () => {
    const combined = `${load(README_PATH)}\n${load(DOC_PATH)}`;
    const requiredSnippets = [
        'DIAGNOSTICAR-HOSTING-WINDOWS-SSH.sh',
        'EXECUTAR-HOSTING-WINDOWS-SSH.sh',
        'SSH_HOST',
        'SSH_PORT',
        'SSH_USERNAME',
        'SSH_IDENTITY_FILE',
        'SSH_HOST_ALIAS',
        'WINDOWS_MIRROR_PATH',
        'WINDOWS_ENV_PATH',
        'WINDOWS_EXPECTED_COMMIT',
        '__hosting/runtime',
        'C:\\dev\\pielarmonia-clean-main',
        '`origin/main` actual',
        'c7619c25ad5ad5ad0436b80d75d6effb7d9f1e8b',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(combined.includes(snippet), true, `falta snippet de documentacion SSH: ${snippet}`);
    }
});
