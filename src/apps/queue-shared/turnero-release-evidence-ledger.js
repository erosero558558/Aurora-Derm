export function buildTurneroReleaseEvidenceLedger(input = {}) {
    const evidence = Array.isArray(input.evidence) ? input.evidence : [];
    const fallbackClinicId =
        String(input.clinicId || 'regional').trim() || 'regional';
    const rows = evidence.map((item, index) => {
        const source = item && typeof item === 'object' ? item : {};
        const id =
            String(source.id || `evidence-${index + 1}`).trim() ||
            `evidence-${index + 1}`;
        const label =
            String(source.label || `Evidence ${index + 1}`).trim() ||
            `Evidence ${index + 1}`;
        const owner =
            String(source.owner || 'unassigned').trim() || 'unassigned';
        const kind = String(source.kind || 'snapshot').trim() || 'snapshot';
        const status = String(source.status || 'captured').trim() || 'captured';
        const clinicId =
            String(source.clinicId || fallbackClinicId).trim() ||
            fallbackClinicId;
        const capturedAt =
            String(source.capturedAt || new Date().toISOString()).trim() ||
            new Date().toISOString();

        return {
            id,
            label,
            owner,
            kind,
            status,
            clinicId,
            capturedAt,
        };
    });

    const totals = {
        all: rows.length,
        captured: rows.filter((row) => row.status === 'captured').length,
        missing: rows.filter((row) => row.status === 'missing').length,
        stale: rows.filter((row) => row.status === 'stale').length,
    };

    return {
        rows,
        totals,
        generatedAt: new Date().toISOString(),
    };
}
