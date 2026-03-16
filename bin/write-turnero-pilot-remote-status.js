#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            throw new Error(`unexpected_argument:${token}`);
        }
        const key = token.slice(2);
        const next = argv[index + 1];
        if (next === undefined || next.startsWith('--')) {
            throw new Error(`missing_value:${token}`);
        }
        options[key] = next;
        index += 1;
    }
    return options;
}

function normalizeString(value, fallback = '') {
    const normalized = String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
    return normalized || fallback;
}

function writeSnapshot(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function appendGithubOutputs(snapshot) {
    const envPath = normalizeString(process.env.GITHUB_ENV);
    const outputPath = normalizeString(process.env.GITHUB_OUTPUT);
    const recoveryTargetsLabel =
        Array.isArray(snapshot.recovery_targets) &&
        snapshot.recovery_targets.length > 0
            ? snapshot.recovery_targets.join('|')
            : 'none';
    const envLines = [
        `TURNERO_PILOT_REMOTE_STATUS=${snapshot.status}`,
        `TURNERO_PILOT_REMOTE_REASON=${snapshot.reason}`,
        `TURNERO_PILOT_REMOTE_CLINIC_ID=${snapshot.clinic_id}`,
        `TURNERO_PILOT_REMOTE_PROFILE_FINGERPRINT=${snapshot.profile_fingerprint}`,
        `TURNERO_PILOT_REMOTE_CATALOG_READY=${snapshot.catalog_ready ? 'true' : 'false'}`,
        `TURNERO_PILOT_REMOTE_DEPLOYED_COMMIT=${snapshot.deployed_commit}`,
        `TURNERO_PILOT_REMOTE_VERIFIED=${snapshot.verified ? 'true' : 'false'}`,
        `TURNERO_PILOT_RECOVERY_TARGETS=${recoveryTargetsLabel}`,
        `TURNERO_PILOT_POSTDEPLOY_ALLOWED=${snapshot.postdeploy_allowed ? 'true' : 'false'}`,
    ];
    const outputLines = [
        `status=${snapshot.status}`,
        `reason=${snapshot.reason}`,
        `clinic_id=${snapshot.clinic_id}`,
        `profile_fingerprint=${snapshot.profile_fingerprint}`,
        `catalog_ready=${snapshot.catalog_ready ? 'true' : 'false'}`,
        `deployed_commit=${snapshot.deployed_commit}`,
        `verified=${snapshot.verified ? 'true' : 'false'}`,
        `recovery_targets=${recoveryTargetsLabel}`,
        `postdeploy_allowed=${snapshot.postdeploy_allowed ? 'true' : 'false'}`,
    ];

    if (envPath) {
        fs.appendFileSync(envPath, `${envLines.join('\n')}\n`, 'utf8');
    }
    if (outputPath) {
        fs.appendFileSync(outputPath, `${outputLines.join('\n')}\n`, 'utf8');
    }
}

function buildNotRequiredSnapshot() {
    const releaseMode = normalizeString(
        process.env.TURNERO_PILOT_RELEASE_MODE,
        'unknown'
    );
    const recoveryTargets = normalizeString(
        process.env.TURNERO_PILOT_RECOVERY_TARGETS
    )
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value) => value !== 'none');
    return {
        status: 'not_required',
        reason: `release_mode:${releaseMode}`,
        verified: false,
        postdeploy_allowed: true,
        release_mode: releaseMode,
        clinic_id: normalizeString(process.env.TURNERO_PILOT_CLINIC_ID),
        profile_fingerprint: normalizeString(
            process.env.TURNERO_PILOT_PROFILE_FINGERPRINT
        ),
        catalog_ready:
            normalizeString(process.env.TURNERO_PILOT_CATALOG_READY) === 'true',
        deployed_commit: '',
        recovery_targets: recoveryTargets,
        generated_at: new Date().toISOString(),
    };
}

function buildVerifiedSnapshot(options) {
    const verifyExit = Number.parseInt(options['verify-exit'] || '1', 10);
    const remotePath = normalizeString(options['remote-path']);
    const rawPath = normalizeString(options['raw-path']);

    let payload = null;
    let rawStderr = '';
    if (rawPath && fs.existsSync(rawPath)) {
        rawStderr = fs.readFileSync(rawPath, 'utf8').trim();
    }
    if (remotePath && fs.existsSync(remotePath)) {
        try {
            payload = JSON.parse(fs.readFileSync(remotePath, 'utf8'));
        } catch {
            payload = null;
        }
    }

    const remoteClinicId = normalizeString(payload?.turneroPilot?.clinicId);
    const remoteFingerprint = normalizeString(
        payload?.turneroPilot?.profileFingerprint
    );
    const remoteCatalogReady = payload?.turneroPilot?.catalogReady === true;
    const remoteDeployedCommit = normalizeString(
        payload?.publicSync?.deployedCommit
    );
    const publicHealthRedacted = payload?.publicHealthRedacted === true;
    const remoteResource = normalizeString(payload?.remoteResource, 'health');
    const remoteIdentityReady = Boolean(
        remoteClinicId && remoteFingerprint && remoteCatalogReady
    );
    const remoteDeployCommitReady = Boolean(remoteDeployedCommit);
    const recoveryTargets = normalizeString(
        process.env.TURNERO_PILOT_RECOVERY_TARGETS
    )
        .split('|')
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value) => value !== 'none');
    const verified =
        payload?.ok === true &&
        verifyExit === 0 &&
        !publicHealthRedacted &&
        remoteIdentityReady &&
        remoteDeployCommitReady;
    let reason = 'ok';
    if (!verified) {
        const payloadErrors =
            Array.isArray(payload?.errors) && payload.errors.length > 0
                ? payload.errors
                      .slice(0, 3)
                      .map((value) => normalizeString(value))
                : [];
        if (payloadErrors.length > 0) {
            reason = payloadErrors.join('; ');
        } else {
            const derivedReasons = [];
            if (verifyExit !== 0) {
                derivedReasons.push(`verify_remote_exit:${verifyExit}`);
            }
            if (publicHealthRedacted) {
                derivedReasons.push(`public_health_redacted:${remoteResource}`);
            }
            if (!remoteClinicId) {
                derivedReasons.push('remote_clinic_id_missing');
            }
            if (!remoteFingerprint) {
                derivedReasons.push('remote_profile_fingerprint_missing');
            }
            if (!remoteCatalogReady) {
                derivedReasons.push('remote_catalog_not_ready');
            }
            if (!remoteDeployCommitReady) {
                derivedReasons.push('remote_deployed_commit_missing');
            }
            reason = normalizeString(
                derivedReasons.filter(Boolean).join('; ') ||
                    rawStderr ||
                    `verify_remote_exit:${verifyExit}`,
                'verify_remote_failed'
            );
        }
    }

    return {
        status: verified ? 'ready' : 'blocked',
        reason,
        verified,
        postdeploy_allowed: verified,
        clinic_id: remoteClinicId,
        profile_fingerprint: remoteFingerprint,
        catalog_ready: remoteCatalogReady,
        deployed_commit: remoteDeployedCommit,
        recovery_targets: recoveryTargets,
        generated_at: new Date().toISOString(),
        result: payload,
        stderr: rawStderr || '',
    };
}

function main(argv) {
    const options = parseArgs(argv);
    const remotePath = normalizeString(options['remote-path']);
    if (!remotePath) {
        throw new Error('missing_remote_path');
    }

    const releaseMode = normalizeString(
        process.env.TURNERO_PILOT_RELEASE_MODE,
        'unknown'
    );
    const snapshot =
        !['web_pilot', 'suite_v2'].includes(releaseMode)
            ? buildNotRequiredSnapshot()
            : buildVerifiedSnapshot(options);

    writeSnapshot(remotePath, snapshot);
    appendGithubOutputs(snapshot);
}

if (require.main === module) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        const message =
            error && error.message ? error.message : 'unknown_error';
        console.error(`[write-turnero-pilot-remote-status] ${message}`);
        process.exit(1);
    }
}

module.exports = {
    appendGithubOutputs,
    buildNotRequiredSnapshot,
    buildVerifiedSnapshot,
    main,
    normalizeString,
    parseArgs,
    writeSnapshot,
};
