import { asObject, toArray, toText } from './turnero-release-control-center.js';

function normalizeVerdict(value) {
    const verdict = toText(value, 'review').toLowerCase();

    if (verdict === 'approve') {
        return 'approve';
    }

    if (verdict === 'reject') {
        return 'reject';
    }

    return 'review';
}

function renderRowLine(row, index, fallbackLabel = 'Row') {
    const label = toText(
        row.label || row.key || row.id,
        `${fallbackLabel} ${index + 1}`
    );
    const detail = [
        row.state || row.status,
        row.owner ? `owner:${row.owner}` : '',
        row.bundleStatus ? `bundle:${row.bundleStatus}` : '',
        row.blockerCount ? `blockers:${row.blockerCount}` : '',
    ]
        .filter(Boolean)
        .join(' · ');

    return `- ${label}${detail ? ` · ${detail}` : ''}`;
}

export function buildTurneroReleaseFinalAuditBinder(pack = {}) {
    const context = asObject(pack.context);
    const manifest = asObject(pack.manifest);
    const bundleRegistry = asObject(pack.bundleRegistry);
    const matrix = asObject(pack.matrix);
    const disposition = asObject(pack.disposition);
    const binderScore = asObject(pack.binderScore);
    const signoffs = toArray(pack.signoffs);
    const approvedCount = signoffs.filter(
        (item) => normalizeVerdict(item.verdict) === 'approve'
    ).length;
    const rejectedCount = signoffs.filter(
        (item) => normalizeVerdict(item.verdict) === 'reject'
    ).length;
    const reviewedCount = signoffs.length - approvedCount - rejectedCount;
    const generatedAt = toText(pack.generatedAt, new Date().toISOString());

    return {
        markdown: [
            '# Final Diagnosis Adjudication Binder',
            '',
            `Clinic: ${toText(
                context.clinicLabel ||
                    context.clinicShortName ||
                    context.clinicId,
                'Piel en Armonia'
            )}${context.clinicId ? ` (${context.clinicId})` : ''}`,
            `Scope: ${toText(context.scope || context.region, 'global')}`,
            `Platform: ${toText(context.detectedPlatform, 'unknown')}`,
            `Binder score: ${binderScore.score ?? 0} (${binderScore.band || 'blocked'})`,
            `Decision: ${binderScore.decision || 'hold-binder'}`,
            `Disposition: ${disposition.disposition || 'review'}`,
            `Manifest items: ${manifest.summary?.all ?? 0}`,
            `Evidence bundles ready: ${bundleRegistry.summary?.ready ?? 0}/${bundleRegistry.summary?.all ?? 0}`,
            `Adjudications supported: ${matrix.summary?.supported ?? 0}/${matrix.summary?.all ?? 0}`,
            `Matrix partial: ${matrix.summary?.partial ?? 0} · blocked: ${matrix.summary?.blocked ?? 0} · missing: ${matrix.summary?.missing ?? 0}`,
            `Panel approvals: ${approvedCount}/${signoffs.length}`,
            `Panel reviews: ${reviewedCount}`,
            `Panel rejections: ${rejectedCount}`,
            `Generated at: ${generatedAt}`,
            '',
            '## Evidence bundles',
            ...(toArray(bundleRegistry.rows).length > 0
                ? toArray(bundleRegistry.rows).map((row, index) =>
                      renderRowLine(row, index, 'Bundle')
                  )
                : ['- No evidence bundles']),
            '',
            '## Adjudication matrix',
            ...(toArray(matrix.rows).length > 0
                ? toArray(matrix.rows).map((row, index) =>
                      renderRowLine(row, index, 'Matrix row')
                  )
                : ['- No adjudication rows']),
            '',
            '## Signoffs',
            ...(signoffs.length > 0
                ? signoffs.map(
                      (row, index) =>
                          `- ${toText(row.reviewer, `Reviewer ${index + 1}`)} · ${normalizeVerdict(row.verdict)}${row.note ? ` · ${toText(row.note)}` : ''}`
                  )
                : ['- No review panel signoffs']),
        ].join('\n'),
        generatedAt,
    };
}

export default buildTurneroReleaseFinalAuditBinder;
