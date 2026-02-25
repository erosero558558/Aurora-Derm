'use strict';

function createGitHubSignalsRuntime(options = {}) {
    const processObj = options.processObj || process;
    const execSync = options.execSyncImpl || require('child_process').execSync;
    const fetchImpl =
        options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
    const defaultRepository = String(options.defaultRepository || '').trim();

    function getTokenFromGhCli() {
        try {
            const token = String(
                execSync('gh auth token', {
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'ignore'],
                    timeout: 3000,
                }) || ''
            ).trim();
            return token || '';
        } catch (error) {
            return '';
        }
    }

    function getGitHubToken(flags = {}) {
        const envToken = String(
            flags.token ||
                processObj.env.GITHUB_TOKEN ||
                processObj.env.GH_TOKEN ||
                ''
        ).trim();
        if (envToken) return envToken;
        return getTokenFromGhCli();
    }

    function getGitHubRepository(flags = {}) {
        return String(flags.repo || defaultRepository).trim();
    }

    async function fetchGitHubJson(path, token) {
        if (!token) {
            throw new Error(
                'GITHUB_TOKEN/GH_TOKEN requerido para consultar GitHub API'
            );
        }
        if (typeof fetchImpl !== 'function') {
            throw new Error('fetch global no disponible para GitHub API');
        }
        const url = String(path || '').startsWith('http')
            ? String(path)
            : `https://api.github.com${path}`;
        const response = await fetchImpl(url, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'pielarmonia-agent-orchestrator',
            },
        });
        if (!response.ok) {
            throw new Error(
                `GitHub API ${response.status}: ${await response.text()}`
            );
        }
        return response.json();
    }

    function issueToSignal(issue) {
        const labels = Array.isArray(issue?.labels)
            ? issue.labels
                  .map((l) =>
                      typeof l === 'string' ? l : l?.name ? String(l.name) : ''
                  )
                  .filter(Boolean)
            : [];
        return {
            source: 'issue',
            source_ref: `issue#${issue.number}`,
            title: String(issue.title || `Issue ${issue.number}`),
            status: String(issue.state || 'open').toLowerCase(),
            url: String(issue.html_url || issue.url || ''),
            labels,
            critical:
                String(issue.title || '')
                    .toLowerCase()
                    .includes('[alerta prod]') ||
                labels.some((l) =>
                    ['prod-alert', 'critical', 'incident'].includes(
                        String(l).toLowerCase()
                    )
                ),
            detected_at: String(issue.created_at || ''),
            updated_at: String(issue.updated_at || issue.created_at || ''),
        };
    }

    function runToSignal(run) {
        const workflowLabel = String(
            run?.workflow_name || run?.name || 'workflow'
        ).trim();
        const branch = String(run?.head_branch || 'main').trim();
        const workflowSlug = workflowLabel
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const sourceRef = `workflow:${workflowSlug || 'workflow'}:${branch || 'main'}`;
        const critical =
            workflowLabel.toLowerCase().includes('post-deploy') ||
            workflowLabel.toLowerCase().includes('production monitor') ||
            workflowLabel.toLowerCase().includes('repair git sync');
        return {
            source: 'workflow',
            source_ref: sourceRef,
            fingerprint: sourceRef,
            title: `${workflowLabel}: ${String(run?.display_title || '').trim()}`.trim(),
            status:
                String(run.conclusion || '').toLowerCase() === 'failure'
                    ? 'failing'
                    : String(run.status || 'open').toLowerCase(),
            url: String(run.html_url || run.url || ''),
            labels: [`workflow:${workflowLabel}`],
            severity: critical ? 'high' : 'medium',
            critical,
            runtime_impact: critical ? 'high' : 'low',
            detected_at: String(run.created_at || ''),
            updated_at: String(run.updated_at || run.created_at || ''),
        };
    }

    async function collectGitHubSignals(flags = {}) {
        const token = getGitHubToken(flags);
        const repository = getGitHubRepository(flags);
        if (!token) {
            return {
                repository,
                issues: [],
                workflows: [],
                source: 'local_only',
            };
        }
        const [issuesPayload, runsPayload] = await Promise.all([
            fetchGitHubJson(
                `/repos/${repository}/issues?state=open&per_page=100`,
                token
            ),
            fetchGitHubJson(
                `/repos/${repository}/actions/runs?status=completed&per_page=50`,
                token
            ),
        ]);
        return {
            repository,
            source: 'github_api',
            issues: Array.isArray(issuesPayload)
                ? issuesPayload
                      .filter((i) => !i.pull_request)
                      .map(issueToSignal)
                : [],
            workflows: Array.isArray(runsPayload?.workflow_runs)
                ? runsPayload.workflow_runs
                      .filter(
                          (r) =>
                              String(r?.conclusion || '').toLowerCase() ===
                              'failure'
                      )
                      .slice(0, 25)
                      .map(runToSignal)
                : [],
        };
    }

    return {
        getGitHubToken,
        getGitHubRepository,
        fetchGitHubJson,
        issueToSignal,
        runToSignal,
        collectGitHubSignals,
    };
}

module.exports = {
    createGitHubSignalsRuntime,
};
