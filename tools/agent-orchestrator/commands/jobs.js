'use strict';

async function handleJobsCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseJobs,
        buildJobsSnapshot,
        findJobSnapshot,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
    } = ctx;
    const subcommand = String(args[0] || 'status')
        .trim()
        .toLowerCase();
    const wantsJson = args.includes('--json');
    const { positionals } = parseFlags(args.slice(1));

    if (!['status', 'verify'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js jobs <status|verify> [job_key] [--json]'
        );
    }

    const registry = parseJobs();
    const jobs = await buildJobsSnapshot(registry);

    if (subcommand === 'status') {
        const report = {
            version: 1,
            ok: true,
            command: 'jobs status',
            jobs,
        };
        if (wantsJson) {
            printJson(report);
            return report;
        }
        console.log('== Jobs Status ==');
        for (const job of jobs) {
            console.log(
                `- ${job.key}: healthy=${job.healthy} state=${job.state} source=${job.verification_source} age=${job.age_seconds ?? 'n/a'}s`
            );
        }
        return report;
    }

    const jobKey = String(positionals[0] || '').trim();
    if (!jobKey) {
        throw new Error('jobs verify requiere job_key');
    }
    const job = findJobSnapshot(jobs, jobKey);
    if (!job) {
        const error = new Error(`jobs verify: no existe job ${jobKey}`);
        error.code = 'job_not_found';
        error.error_code = 'job_not_found';
        throw error;
    }

    const report = {
        version: 1,
        ok: Boolean(job.verified && job.healthy),
        command: 'jobs verify',
        job,
    };
    if (wantsJson) {
        printJson(report);
        if (!report.ok) process.exitCode = 1;
        return report;
    }
    if (!report.ok) {
        throw new Error(
            `jobs verify fallo para ${job.key}: healthy=${job.healthy} source=${job.verification_source}`
        );
    }
    console.log(
        `OK: ${job.key} healthy=${job.healthy} age=${job.age_seconds ?? 'n/a'}s commit=${job.deployed_commit || 'n/a'}`
    );
    return report;
}

module.exports = {
    handleJobsCommand,
};
