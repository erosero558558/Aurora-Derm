'use strict';

function parsePositiveInteger(value, fallback = null) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const parsed = Number.parseInt(String(value).trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleWorkspaceCommand(ctx) {
    const {
        args = [],
        parseFlags,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
        rootPath,
        getGovernancePolicy,
        normalizeWorkspaceSyncPolicy,
        runWorkspaceSync,
        buildBootstrapReport,
        loadWorkspaceSnapshot,
        installWorkspaceWatcherTask,
        repairWorkspace,
    } = ctx;
    const subcommand = String(args[0] || 'status')
        .trim()
        .toLowerCase();
    const wantsJson = args.includes('--json');
    const { flags, positionals } = parseFlags(args.slice(1));
    const governancePolicy =
        typeof getGovernancePolicy === 'function' ? getGovernancePolicy() : null;
    const workspacePolicy =
        typeof normalizeWorkspaceSyncPolicy === 'function'
            ? normalizeWorkspaceSyncPolicy(governancePolicy)
            : {
                  watcher_interval_seconds: 60,
              };

    if (!['bootstrap', 'sync', 'watch', 'status', 'repair'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js workspace <bootstrap|sync|watch|status|repair> [--json]'
        );
    }

    if (subcommand === 'bootstrap') {
        const report = buildBootstrapReport({
            cwd: rootPath,
            governancePolicy,
        });
        const installWatcher =
            !args.includes('--no-install-watcher') &&
            !Boolean(flags['no-install-watcher']) &&
            !Boolean(flags.no_install_watcher);
        const watcher = installWatcher
            ? installWorkspaceWatcherTask({
                  rootPath,
                  governancePolicy,
              })
            : {
                  installed: false,
                  skipped: true,
                  reason: 'disabled_by_flag',
              };
        const payload = {
            ...report,
            watcher,
        };
        if (wantsJson) {
            printJson(payload);
            if (!payload.ok) process.exitCode = 1;
            return payload;
        }
        console.log(
            `Workspace bootstrap ${payload.ok ? 'OK' : 'WARN'}: machine=${payload.machine_id} watcher=${watcher.installed ? 'installed' : watcher.reason || 'skipped'}`
        );
        return payload;
    }

    if (subcommand === 'sync') {
        const report = runWorkspaceSync({
            cwd: rootPath,
            governancePolicy,
        });
        const payload = {
            version: 1,
            ok: Boolean(report?.ok),
            command: 'workspace sync',
            once:
                args.includes('--once') ||
                Boolean(flags.once) ||
                Boolean(flags['once']),
            snapshot: report,
        };
        if (wantsJson) {
            printJson(payload);
            if (!payload.ok) process.exitCode = 1;
            return payload;
        }
        console.log(
            `Workspace sync ${payload.ok ? 'OK' : 'WARN'}: root=${report?.root?.sync_state || 'unknown'} task_worktrees=${report?.summary?.task_worktrees_total || 0}`
        );
        return payload;
    }

    if (subcommand === 'watch') {
        const iterations = parsePositiveInteger(
            flags.iterations ?? flags['iterations'],
            null
        );
        let completed = 0;
        while (iterations === null || completed < iterations) {
            const report = runWorkspaceSync({
                cwd: rootPath,
                governancePolicy,
            });
            completed += 1;
            if (wantsJson) {
                printJson({
                    version: 1,
                    ok: Boolean(report?.ok),
                    command: 'workspace watch',
                    iteration: completed,
                    snapshot: report,
                });
            } else {
                console.log(
                    `workspace watch iteration=${completed} root=${report?.root?.sync_state || 'unknown'} task_worktrees=${report?.summary?.task_worktrees_total || 0}`
                );
            }
            if (iterations !== null && completed >= iterations) {
                return {
                    version: 1,
                    ok: Boolean(report?.ok),
                    command: 'workspace watch',
                    iterations: completed,
                };
            }
            await delay(workspacePolicy.watcher_interval_seconds * 1000);
        }
        return {
            version: 1,
            ok: true,
            command: 'workspace watch',
            iterations: completed,
        };
    }

    if (subcommand === 'status') {
        const refresh =
            args.includes('--refresh') ||
            Boolean(flags.refresh) ||
            !loadWorkspaceSnapshot({
                cwd: rootPath,
                governancePolicy,
            })?.snapshot;
        const payload = refresh
            ? {
                  version: 1,
                  ok: true,
                  command: 'workspace status',
                  refreshed: true,
                  snapshot: runWorkspaceSync({
                      cwd: rootPath,
                      governancePolicy,
                  }),
              }
            : {
                  version: 1,
                  ok: true,
                  command: 'workspace status',
                  refreshed: false,
                  snapshot: loadWorkspaceSnapshot({
                      cwd: rootPath,
                      governancePolicy,
                  }).snapshot,
              };
        payload.ok = Boolean(payload.snapshot?.ok);
        if (wantsJson) {
            printJson(payload);
            if (!payload.ok) process.exitCode = 1;
            return payload;
        }
        console.log(
            `Workspace status ${payload.ok ? 'OK' : 'WARN'}: refreshed=${payload.refreshed ? 'yes' : 'no'} root=${payload.snapshot?.root?.sync_state || 'unknown'}`
        );
        return payload;
    }

    const taskId = String(positionals[0] || flags['task-id'] || flags.task_id || '')
        .trim();
    const payload = repairWorkspace({
        cwd: rootPath,
        governancePolicy,
        taskId,
    });
    if (wantsJson) {
        printJson(payload);
        if (!payload.ok) process.exitCode = 1;
        return payload;
    }
    console.log(
        `Workspace repair ${payload.ok ? 'OK' : 'WARN'}: path=${payload.path} state=${payload.diagnosis?.overall_state || 'unknown'}`
    );
    return payload;
}

module.exports = {
    handleWorkspaceCommand,
};
