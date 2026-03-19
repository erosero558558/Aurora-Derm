import { toArray } from './turnero-release-control-center.js';

function sensitivityForClassification(classification) {
    const normalized = String(classification || '')
        .trim()
        .toLowerCase();
    if (normalized === 'clinical-sensitive') {
        return 95;
    }
    if (normalized === 'personal-operational') {
        return 75;
    }
    if (normalized === 'operational') {
        return 45;
    }
    return 15;
}

function stateForSensitivity(sensitivity) {
    if (sensitivity >= 85) {
        return 'high';
    }
    if (sensitivity >= 60) {
        return 'watch';
    }
    return 'normal';
}

export function buildTurneroReleaseSensitiveSurfaceMap(input = {}) {
    const matrixRows = toArray(input.matrixRows);
    const rows = matrixRows.map((row) => {
        const sensitivity = sensitivityForClassification(row.classification);

        return {
            id: String(row.id || '').trim(),
            label: String(row.label || row.flow || row.id || '').trim(),
            flow: String(row.flow || '').trim(),
            classification: String(row.classification || '').trim(),
            exposure: String(row.exposure || '').trim(),
            sensitivity,
            state: stateForSensitivity(sensitivity),
            note: String(row.note || '').trim(),
        };
    });

    const summary = {
        all: rows.length,
        high: rows.filter((row) => row.state === 'high').length,
        watch: rows.filter((row) => row.state === 'watch').length,
        normal: rows.filter((row) => row.state === 'normal').length,
    };

    return {
        rows,
        summary,
        generatedAt: new Date().toISOString(),
    };
}
