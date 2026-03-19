export function buildTurneroReleaseReadinessCertification(input = {}) {
    const stageGates = Array.isArray(input.stageGates) ? input.stageGates : [];
    const evidenceTotals = input.evidenceTotals || {};
    const exceptions = Array.isArray(input.exceptions) ? input.exceptions : [];

    const hasFail = stageGates.some((gate) => gate.state === 'fail');
    const hasWatch = stageGates.some((gate) => gate.state === 'watch');
    const openExceptions = exceptions.filter(
        (item) =>
            String(item?.status || '')
                .trim()
                .toLowerCase() !== 'closed'
    ).length;
    const status = hasFail
        ? 'not_certified'
        : hasWatch ||
            openExceptions > 0 ||
            Number(evidenceTotals.stale || 0) > 0
          ? 'conditional'
          : 'certified';

    const summary = [
        `Stage gates: ${stageGates.length}`,
        `Open policy exceptions: ${openExceptions}`,
        `Missing evidence: ${evidenceTotals.missing || 0}`,
        `Stale evidence: ${evidenceTotals.stale || 0}`,
    ];

    return {
        status,
        summary,
        issuedAt: new Date().toISOString(),
    };
}

export function readinessCertificationToMarkdown(cert = {}) {
    const lines = [
        '# Readiness Certification',
        '',
        `Status: ${cert.status || 'conditional'}`,
        '',
        ...(Array.isArray(cert.summary)
            ? cert.summary.map((item) => `- ${item}`)
            : []),
        '',
        `Issued at: ${cert.issuedAt || new Date().toISOString()}`,
    ];

    return lines.join('\n');
}
