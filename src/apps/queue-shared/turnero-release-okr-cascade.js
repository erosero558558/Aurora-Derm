import { asObject, toArray, toText } from './turnero-release-control-center.js';

function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeClinic(input = {}, index = 0) {
    const source = asObject(input);
    const adoptionRate = toNumber(
        source.adoptionRate ??
            source.adoptionPct ??
            source.adoption ??
            source.progressPct,
        72
    );
    const valueScore = toNumber(
        source.valueScore ??
            source.valuePct ??
            source.value ??
            source.valueRealization,
        76
    );

    return {
        clinicId: toText(
            source.clinicId ||
                source.clinic_id ||
                source.id ||
                `clinic-${index + 1}`,
            `clinic-${index + 1}`
        ),
        label: toText(
            source.label ||
                source.clinicName ||
                source.name ||
                source.branding?.name ||
                source.branding?.short_name ||
                `Clínica ${index + 1}`
        ),
        region: toText(source.region || source.zone || 'regional', 'regional'),
        status: toText(
            source.status || (source.ready === false ? 'watch' : 'active'),
            'active'
        ),
        adoptionRate: Math.max(0, Math.min(100, adoptionRate)),
        valueScore: Math.max(0, Math.min(100, valueScore)),
    };
}

function averageOf(values, fallback = 0) {
    const list = values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    if (!list.length) {
        return fallback;
    }

    return Number(
        (list.reduce((sum, value) => sum + value, 0) / list.length).toFixed(1)
    );
}

function buildKeyResult(key, label, value, target, unit = '%') {
    const numericValue = Number(value);
    const numericTarget = Number(target);
    const status =
        Number.isFinite(numericValue) && Number.isFinite(numericTarget)
            ? numericValue >= numericTarget
                ? 'ready'
                : numericValue >= numericTarget * 0.85
                  ? 'warning'
                  : 'alert'
            : 'info';

    return {
        key,
        label,
        value: numericValue,
        target: numericTarget,
        unit,
        status,
    };
}

export function buildTurneroReleaseOkrCascade(input = {}) {
    const clinics = toArray(input.clinics).map(normalizeClinic);
    const activeClinics = clinics.filter(
        (clinic) => clinic.status !== 'paused'
    ).length;
    const adoptionAvg = averageOf(
        clinics.map((clinic) => clinic.adoptionRate),
        72
    );
    const valueAvg = averageOf(
        clinics.map((clinic) => clinic.valueScore),
        76
    );
    const objective = toText(
        input.objective ||
            'Expandir el rollout turnero con control operativo, adopción sostenida y valor visible.'
    );

    return {
        objective,
        focusRegion: toText(
            input.region || clinics[0]?.region || 'regional',
            'regional'
        ),
        clinics,
        activeClinics,
        adoptionAvg,
        valueAvg,
        keyResults: [
            buildKeyResult(
                'kr1',
                'Clínicas activas',
                activeClinics,
                Math.max(activeClinics, clinics.length || 1),
                'clinics'
            ),
            buildKeyResult('kr2', 'Adopción promedio', adoptionAvg, 85),
            buildKeyResult('kr3', 'Value score promedio', valueAvg, 80),
        ],
        summary:
            input.summary ||
            `Adopción ${adoptionAvg}% · value ${valueAvg}% · ${activeClinics}/${Math.max(
                clinics.length,
                1
            )} clínicas activas`,
        generatedAt: new Date().toISOString(),
    };
}

export function okrCascadeToMarkdown(cascade = {}) {
    const keyResults = toArray(cascade.keyResults);

    return [
        '# OKR Cascade',
        '',
        `- Objective: ${toText(cascade.objective || '')}`,
        `- Region: ${toText(cascade.focusRegion || 'regional')}`,
        `- Summary: ${toText(cascade.summary || '')}`,
        '',
        '## Key results',
        ...(keyResults.length
            ? keyResults.map(
                  (kr) =>
                      `- ${toText(kr.label)}: ${Number(kr.value || 0)}${kr.unit || ''} / ${Number(
                          kr.target || 0
                      )}${kr.unit || ''} [${toText(kr.status || 'info')}]`
              )
            : ['- Sin key results.']),
        '',
        `Generated at: ${toText(cascade.generatedAt || new Date().toISOString())}`,
    ].join('\n');
}

export default buildTurneroReleaseOkrCascade;
