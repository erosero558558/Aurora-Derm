#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    LEGACY_GENERATED_ROOT_DIRECTORIES,
    LEGACY_GENERATED_ROOT_FILES,
    LEGACY_GENERATED_ROOT_IGNORE_PATTERNS,
    normalizeRelativePath,
} = require('./lib/generated-site-root.js');
const {
    buildIssueDiagnosis,
    buildIssueFromEntries,
    buildIssueFromPaths,
    formatIssueSummary,
    getFirstRemediationStep,
    LEGACY_GENERATED_ROOT_CATEGORY,
    LEGACY_GENERATED_ROOT_CONTRACT_PATHS,
    LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
    listTrackedLegacyGeneratedRootPaths,
    readDirtyEntries,
    summarizeDirtyEntries,
} = require('./lib/workspace-hygiene.js');

const DEFAULT_CHUNK_SIZE = 100;

function parseArgs(argv = []) {
    const options = {
        command: 'status',
        json: false,
        quiet: false,
        repoRoot: '',
        chunkSize: DEFAULT_CHUNK_SIZE,
    };
    const positionals = [];

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (!token) continue;

        if (token === '--json') {
            options.json = true;
            continue;
        }
        if (token === '--quiet') {
            options.quiet = true;
            continue;
        }
        if (token === '--repo-root') {
            options.repoRoot = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token.startsWith('--repo-root=')) {
            options.repoRoot = token.slice('--repo-root='.length).trim();
            continue;
        }
        if (token === '--chunk-size') {
            const parsed = Number.parseInt(
                String(argv[index + 1] || '').trim(),
                10
            );
            if (Number.isFinite(parsed) && parsed >= 1) {
                options.chunkSize = parsed;
            }
            index += 1;
            continue;
        }
        if (token.startsWith('--chunk-size=')) {
            const parsed = Number.parseInt(
                token.slice('--chunk-size='.length).trim(),
                10
            );
            if (Number.isFinite(parsed) && parsed >= 1) {
                options.chunkSize = parsed;
            }
            continue;
        }

        positionals.push(token);
    }

    if (positionals.length > 0) {
        options.command = positionals[0];
    }

    return options;
}

function runGit(repoRoot, args, capture = true) {
    return spawnSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
}

function ensureGitOk(result, label) {
    if (!result || result.status !== 0) {
        throw new Error(
            `${label} failed: ${
                result && result.error && result.error.message
                    ? String(result.error.message).trim()
                    : result && (result.stderr || result.stdout)
                      ? String(result.stderr || result.stdout).trim()
                      : 'unknown error'
            }`
        );
    }
}

function readDirtyLegacyGeneratedRootEntries(repoRoot) {
    const trackedPaths = listTrackedLegacyGeneratedRootPaths(repoRoot);
    return readDirtyEntries(repoRoot, {
        trackedLegacyPaths: trackedPaths,
    }).filter(
        (entry) =>
            entry.category === LEGACY_GENERATED_ROOT_CATEGORY ||
            entry.category === LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY
    );
}

function buildIgnoreCoverage(repoRoot) {
    const gitignorePath = path.resolve(repoRoot, '.gitignore');
    const gitignoreRaw = fs.existsSync(gitignorePath)
        ? fs.readFileSync(gitignorePath, 'utf8')
        : '';
    const presentPatterns = LEGACY_GENERATED_ROOT_IGNORE_PATTERNS.filter(
        (pattern) => gitignoreRaw.includes(pattern)
    );
    const missingPatterns = LEGACY_GENERATED_ROOT_IGNORE_PATTERNS.filter(
        (pattern) => !gitignoreRaw.includes(pattern)
    );

    return {
        path: '.gitignore',
        presentPatterns,
        missingPatterns,
        ok: missingPatterns.length === 0,
    };
}

function summarizeTrackedLegacyPaths(trackedPaths = []) {
    return {
        total: trackedPaths.length,
        directoriesPresent: LEGACY_GENERATED_ROOT_DIRECTORIES.filter(
            (relativePath) => {
                const target = normalizeRelativePath(relativePath);
                return trackedPaths.some(
                    (trackedPath) =>
                        trackedPath === target ||
                        trackedPath.startsWith(`${target}/`)
                );
            }
        ).sort(),
        filesPresent: LEGACY_GENERATED_ROOT_FILES.filter((relativePath) =>
            trackedPaths.includes(normalizeRelativePath(relativePath))
        ).sort(),
        topLevelRoots: Array.from(
            new Set(
                trackedPaths.map((trackedPath) => trackedPath.split('/')[0])
            )
        ).sort(),
    };
}

function buildLegacyIssues(trackedPaths = [], dirtyEntries = []) {
    const issues = [];
    if (Array.isArray(trackedPaths) && trackedPaths.length > 0) {
        issues.push(
            buildIssueFromPaths(LEGACY_GENERATED_ROOT_CATEGORY, trackedPaths, {
                count: trackedPaths.length,
            })
        );
    }

    const deindexedEntries = (
        Array.isArray(dirtyEntries) ? dirtyEntries : []
    ).filter(
        (entry) => entry.category === LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY
    );
    if (deindexedEntries.length > 0) {
        issues.push(
            buildIssueFromEntries(
                LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
                deindexedEntries
            )
        );
    }

    return issues;
}

function collectStatus(repoRoot) {
    const trackedPaths = listTrackedLegacyGeneratedRootPaths(repoRoot);
    const dirtyEntries = readDirtyLegacyGeneratedRootEntries(repoRoot);
    const legacyDiagnosis = buildIssueDiagnosis(dirtyEntries, {
        issues: buildLegacyIssues(trackedPaths, dirtyEntries),
    });
    return {
        version: 5,
        repoRoot,
        contractPaths: LEGACY_GENERATED_ROOT_CONTRACT_PATHS,
        trackedPaths,
        trackedSummary: summarizeTrackedLegacyPaths(trackedPaths),
        dirtyEntries,
        dirtySummary: summarizeDirtyEntries(dirtyEntries),
        overall_state: legacyDiagnosis.overall_state,
        dirty_total: legacyDiagnosis.dirty_total,
        issue_counts: legacyDiagnosis.issue_counts,
        scope_counts: legacyDiagnosis.scope_counts,
        strategy_counts: legacyDiagnosis.strategy_counts,
        lane_counts: legacyDiagnosis.lane_counts,
        scope_context: legacyDiagnosis.scope_context,
        strategy_context: legacyDiagnosis.strategy_context,
        lane_context: legacyDiagnosis.lane_context,
        candidate_tasks: legacyDiagnosis.candidate_tasks,
        split_plan: legacyDiagnosis.split_plan,
        issues: legacyDiagnosis.issues,
        remediation_plan: legacyDiagnosis.remediation_plan,
        next_command: legacyDiagnosis.next_command,
        ignoreCoverage: buildIgnoreCoverage(repoRoot),
        ok: trackedPaths.length === 0,
    };
}

function chunkPaths(paths, chunkSize = DEFAULT_CHUNK_SIZE) {
    const chunks = [];
    for (let index = 0; index < paths.length; index += chunkSize) {
        chunks.push(paths.slice(index, index + chunkSize));
    }
    return chunks;
}

function applyCleanup(repoRoot, options = {}) {
    const statusBefore = collectStatus(repoRoot);
    const trackedPaths = statusBefore.trackedPaths;
    const commands = [];

    for (const chunk of chunkPaths(
        trackedPaths,
        options.chunkSize || DEFAULT_CHUNK_SIZE
    )) {
        const args = [
            'rm',
            '--cached',
            '-f',
            '--ignore-unmatch',
            '--',
            ...chunk,
        ];
        const result = runGit(repoRoot, args, true);
        ensureGitOk(result, 'git rm --cached legacy generated root');
        commands.push(`git ${args.join(' ')}`);
    }

    const statusAfter = collectStatus(repoRoot);
    const preservedWorkingTreePaths = trackedPaths
        .filter((relativePath) =>
            fs.existsSync(path.resolve(repoRoot, relativePath))
        )
        .sort();

    return {
        ...statusAfter,
        command: 'apply',
        removedFromIndex: trackedPaths,
        removedCount: trackedPaths.length,
        preservedWorkingTreePaths,
        commands,
        ok:
            statusAfter.trackedPaths.length === 0 &&
            statusAfter.ignoreCoverage.ok,
    };
}

function renderStatus(payload) {
    const trackedSummary = payload.trackedSummary || {
        total: 0,
        directoriesPresent: [],
        filesPresent: [],
        topLevelRoots: [],
    };
    const dirtySummary = payload.dirtySummary || { total: 0, byCategory: {} };
    const dirtyCategories = Object.entries(dirtySummary.byCategory || {})
        .map(([category, count]) => `${category}=${count}`)
        .join(' ');
    const issues = formatIssueSummary(payload.issues || []);
    const firstStep = getFirstRemediationStep(payload);
    const lines = [
        `repo=${payload.repoRoot}`,
        `tracked=${trackedSummary.total}`,
        `dirty=${dirtySummary.total}${dirtyCategories ? ` ${dirtyCategories}` : ''}`,
        `overall_state=${payload.overall_state || 'clean'}`,
        `scope=${payload.scope_context?.resolution || 'none'}`,
        issues ? `issues=${issues}` : 'issues=(none)',
        `directories=${trackedSummary.directoriesPresent.join(', ') || '(none)'}`,
        `files=${trackedSummary.filesPresent.join(', ') || '(none)'}`,
        `gitignore_missing=${payload.ignoreCoverage.missingPatterns.join(', ') || '(none)'}`,
    ];

    if (firstStep) {
        lines.push(`first_step=${firstStep.id} -> ${firstStep.command}`);
    }

    if (payload.command === 'apply') {
        lines.push(`removed_from_index=${payload.removedCount}`);
        lines.push(
            `preserved_worktree=${payload.preservedWorkingTreePaths.length}`
        );
    }

    return lines.join('\n');
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const repoRoot = path.resolve(options.repoRoot || process.cwd());

    if (!['status', 'check', 'apply'].includes(options.command)) {
        throw new Error(
            'Uso: node bin/legacy-generated-root-cleanup.js <status|check|apply> [--json] [--repo-root <path>] [--chunk-size <n>]'
        );
    }

    const payload =
        options.command === 'apply'
            ? applyCleanup(repoRoot, options)
            : collectStatus(repoRoot);

    if (options.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else if (!options.quiet) {
        process.stdout.write(`${renderStatus(payload)}\n`);
    }

    if (
        options.command === 'check' &&
        (payload.trackedPaths.length > 0 || !payload.ignoreCoverage.ok)
    ) {
        process.exitCode = 1;
    }

    if (options.command === 'apply' && !payload.ok) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        process.stderr.write(
            `${error && error.message ? error.message : 'legacy generated root cleanup failed'}\n`
        );
        process.exit(1);
    }
}

module.exports = {
    DEFAULT_CHUNK_SIZE,
    LEGACY_GENERATED_ROOT_CONTRACT_PATHS,
    applyCleanup,
    buildIgnoreCoverage,
    buildLegacyIssues,
    chunkPaths,
    collectStatus,
    listTrackedLegacyGeneratedRootPaths,
    parseArgs,
    readDirtyLegacyGeneratedRootEntries,
    summarizeTrackedLegacyPaths,
};
