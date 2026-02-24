#!/usr/bin/env node
/**
 * Jules Dispatch & Monitor
 * Usage:
 *   JULES_API_KEY=xxx node jules-dispatch.js status
 *   JULES_API_KEY=xxx node jules-dispatch.js dispatch
 *   JULES_API_KEY=xxx node jules-dispatch.js watch
 */

const API_BASE = 'https://jules.googleapis.com/v1alpha';
const SOURCE_ID = 'github/erosero558558/piel-en-armonia';

const API_KEY = process.env.JULES_API_KEY;
if (!API_KEY) {
    console.error('ERROR: Set JULES_API_KEY env var before running.');
    process.exit(1);
}

// ── Tasks to dispatch ────────────────────────────────────────────────────────
const TASKS = [
    {
        title: 'Add Jest tests for analytics engine',
        prompt: `Write automated tests for js/engines/analytics-engine.js using Jest.
The engine exposes window.PielAnalyticsEngine. Tests must run with
"npx jest" from the repo root. Requirements:
- Mock window.gtag and window.dataLayer
- Test: trackEvent sends correct gtag calls
- Test: gracefully handles missing gtag (no errors thrown)
- Test: no duplicate events fired on repeated calls
- Test: funnel step tracking sequence is correct
Create tests/js/analytics-engine.test.js and a jest.config.js if missing.
Add "test:js" script to package.json: "jest tests/js"`,
    },
    {
        title: 'Audit log: configurable retention and IP anonymization',
        prompt: `lib/audit.php stores audit logs but has no retention policy.
Add the following to lib/audit.php:
(a) A cleanup() function that deletes records older than N days (default 90,
    configurable via AUDIT_RETENTION_DAYS constant or config). Call it
    probabilistically at 1% chance per request, same pattern as lib/ratelimit.php.
(b) After 30 days, anonymize IP addresses: keep only the first 3 octets
    (e.g. 192.168.1.X -> 192.168.1.0). Run as part of cleanup().
(c) Add a DB index on created_at if not present (check before adding).
Write a test in tests/AuditLogTest.php covering retention and anonymization.`,
    },
    {
        title: 'Backup integrity verification and at-rest encryption',
        prompt: `backup-receiver.php accepts backup file uploads.
Add the following features:
(a) SHA-256 checksum verification: the sender must include an
    X-Backup-Checksum header with the hex SHA-256 of the file.
    The receiver verifies it before saving. Reject with 400 on mismatch.
(b) Encrypt backups at rest using OpenSSL AES-256-CBC. Read the encryption
    key from env var BACKUP_ENCRYPTION_KEY. Store encrypted files with
    .enc extension.
(c) Create a verify-backup.php CLI script that accepts a file path,
    decrypts it, and verifies the SHA-256 checksum.
(d) Auto-delete backup files older than 30 days during each upload request
    (probabilistic cleanup, 5% chance).
Write a test in tests/BackupReceiverTest.php.`,
    },
];

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'X-Goog-Api-Key': API_KEY,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jules API ${res.status}: ${text}`);
    }
    return res.json();
}

async function getSessions(pageSize = 30) {
    const data = await apiFetch(`/sessions?pageSize=${pageSize}`);
    return data.sessions || [];
}

async function createSession(task) {
    return apiFetch('/sessions', {
        method: 'POST',
        body: JSON.stringify({
            title: task.title,
            prompt: task.prompt,
            sourceContext: {
                source: `sources/${SOURCE_ID}`,
                githubRepoContext: { startingBranch: 'main' },
            },
            // automationMode: 'AUTO_CREATE_PR' — not yet supported in v1alpha
            requirePlanApproval: false,
        }),
    });
}

// ── Commands ──────────────────────────────────────────────────────────────────
async function cmdStatus() {
    const sessions = await getSessions();
    const byState = {};
    for (const s of sessions) {
        (byState[s.state] = byState[s.state] || []).push(s);
    }

    const stateLabel = {
        IN_PROGRESS: 'WORKING',
        COMPLETED: 'DONE   ',
        FAILED: 'FAILED ',
        AWAITING_PLAN_APPROVAL: 'WAITING',
    };

    console.log(`\n== Jules Sessions (${sessions.length} total) ==\n`);
    for (const [state, list] of Object.entries(byState)) {
        const label = stateLabel[state] || state;
        for (const s of list) {
            const title = (s.title || '').slice(0, 65).padEnd(65);
            const updated = (s.updateTime || '').slice(0, 19);
            console.log(`[${label}] ${title} | ${updated}`);
            if (s.url) console.log(`         ${s.url}`);
        }
        console.log();
    }
}

async function cmdDispatch() {
    const existing = await getSessions();
    const existingTitles = new Set(existing.map((s) => s.title.toLowerCase()));

    for (const task of TASKS) {
        if (existingTitles.has(task.title.toLowerCase())) {
            console.log(`SKIP (already exists): ${task.title}`);
            continue;
        }
        try {
            const session = await createSession(task);
            console.log(`DISPATCHED: ${task.title}`);
            console.log(`  URL: ${session.url}`);
            console.log(`  ID:  ${session.id}`);
        } catch (err) {
            console.error(`FAILED to dispatch "${task.title}": ${err.message}`);
        }
        console.log();
    }
}

async function cmdWatch(intervalSec = 60) {
    console.log(`Watching Jules sessions every ${intervalSec}s. Ctrl+C to stop.\n`);
    const seen = new Set();

    const poll = async () => {
        const sessions = await getSessions();
        for (const s of sessions) {
            const key = `${s.id}:${s.state}`;
            if (!seen.has(key)) {
                seen.add(key);
                const ts = new Date().toLocaleTimeString();
                if (s.state === 'COMPLETED') {
                    console.log(`[${ts}] DONE: ${s.title}`);
                    console.log(`        PR ready -> ${s.url}`);
                } else if (s.state === 'FAILED') {
                    console.log(`[${ts}] FAIL: ${s.title}`);
                    console.log(`        Check -> ${s.url}`);
                } else if (s.state === 'IN_PROGRESS') {
                    console.log(`[${ts}] WORKING: ${s.title}`);
                }
            }
        }
    };

    await poll();
    setInterval(poll, intervalSec * 1000);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const cmd = process.argv[2] || 'status';
const cmds = { status: cmdStatus, dispatch: cmdDispatch, watch: cmdWatch };

if (!cmds[cmd]) {
    console.error(`Unknown command: ${cmd}. Use: status | dispatch | watch`);
    process.exit(1);
}

cmds[cmd]().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
