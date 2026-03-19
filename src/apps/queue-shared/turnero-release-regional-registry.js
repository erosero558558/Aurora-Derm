import {
    asObject,
    inferOwnerFromText,
    normalizeOwner,
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';

const STORAGE_KEY_PREFIX = 'turnero-release-regional-registry';

function nowIso() {
    return new Date().toISOString();
}

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, safeNumber(value, min)));
}

function getStorage(preferred) {
    if (preferred && typeof preferred.getItem === 'function') {
        return preferred;
    }

    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function safeJsonParse(value, fallback = {}) {
    if (!value) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_error) {
        return fallback;
    }
}

function resolveClinicProfiles(input = {}) {
    const source = asObject(input);
    const registry = asObject(source.registry);
    const candidates = [
        source.clinicProfiles,
        source.turneroClinicProfiles,
        registry.clinicProfiles,
        registry.items,
        registry.clinics,
    ].filter(Array.isArray);

    if (candidates.length > 0) {
        return candidates.flat().filter(Boolean);
    }

    const fallback = [
        source.clinicProfile,
        source.turneroClinicProfile,
        source.profile,
    ].find(Boolean);

    return fallback ? [fallback] : [];
}

function normalizeTags(value) {
    return toArray(value)
        .map((entry) => toText(entry))
        .filter(Boolean);
}

function normalizeTier(value, fallback = 3) {
    const tier = Math.trunc(safeNumber(value, fallback));
    if (!Number.isFinite(tier) || tier < 1) {
        return fallback;
    }

    return tier;
}

function normalizeRegion(profile, override = {}) {
    return toText(
        override.region ||
            profile.region ||
            profile.geography?.region ||
            profile.branding?.region ||
            profile.release?.region ||
            profile.metadata?.region ||
            'nacional'
    );
}

function normalizeProvince(profile, override = {}) {
    return toText(
        override.province ||
            profile.province ||
            profile.geography?.province ||
            profile.branding?.province ||
            profile.metadata?.province ||
            ''
    );
}

function normalizeCluster(profile, override = {}) {
    return toText(
        override.cluster ||
            profile.cluster ||
            profile.group ||
            profile.geography?.cluster ||
            profile.metadata?.cluster ||
            ''
    );
}

function normalizeOwnerTeam(profile, override = {}) {
    return normalizeOwner(
        override.ownerTeam ||
            profile.ownerTeam ||
            profile.owner ||
            profile.branding?.ownerTeam ||
            profile.release?.ownerTeam ||
            inferOwnerFromText(
                `${profile.branding?.name || ''} ${profile.region || ''}`
            )
    );
}

function safeSurfaceCount(profile) {
    return toArray(profile.surfaces).length;
}

function safeConsultorioCount(profile) {
    return toArray(profile.consultorios).length;
}

function countSeverity(value) {
    return normalizeSeverity(value) === 'alert'
        ? 'alert'
        : normalizeSeverity(value) === 'warning'
          ? 'warning'
          : 'info';
}

function computeReadinessScore(profile, override = {}) {
    const explicitScore = safeNumber(
        override.readinessScore ||
            profile.readinessScore ||
            profile.release?.readinessScore,
        Number.NaN
    );

    if (Number.isFinite(explicitScore)) {
        return clamp(explicitScore, 0, 100);
    }

    const surfaceCount = safeSurfaceCount(profile);
    const consultorioCount = safeConsultorioCount(profile);
    const blockingCount = safeNumber(
        override.blockingCount ||
            profile.blockingCount ||
            profile.release?.blockingCount ||
            (profile.release?.native_apps_blocking ? 1 : 0),
        0
    );
    const warningCount = safeNumber(
        override.warningCount ||
            profile.warningCount ||
            profile.release?.warningCount ||
            0,
        0
    );
    const modeBonus = profile.release?.mode ? 8 : 0;
    const deployBonus = profile.release?.separate_deploy ? 4 : 0;
    const surfaceBonus = Math.min(surfaceCount * 5, 25);
    const consultorioBonus = Math.min(consultorioCount * 4, 20);
    const penalty = blockingCount * 14 + warningCount * 4;

    return clamp(
        45 +
            modeBonus +
            deployBonus +
            surfaceBonus +
            consultorioBonus -
            penalty,
        0,
        100
    );
}

function computeRiskScore(profile, override = {}, readinessScore = 0) {
    const explicitScore = safeNumber(
        override.riskScore || profile.riskScore || profile.release?.riskScore,
        Number.NaN
    );

    if (Number.isFinite(explicitScore)) {
        return clamp(explicitScore, 0, 100);
    }

    const blockingCount = safeNumber(
        override.blockingCount ||
            profile.blockingCount ||
            profile.release?.blockingCount ||
            (profile.release?.native_apps_blocking ? 1 : 0),
        0
    );
    const warningCount = safeNumber(
        override.warningCount ||
            profile.warningCount ||
            profile.release?.warningCount ||
            0,
        0
    );

    return clamp(
        100 - readinessScore + blockingCount * 15 + warningCount * 5,
        0,
        100
    );
}

function normalizeDecision(profile, readinessScore, riskScore, override = {}) {
    const explicit = toText(
        override.decision || profile.decision || profile.release?.decision
    ).toLowerCase();

    if (['promote', 'review', 'hold'].includes(explicit)) {
        return explicit;
    }

    if (riskScore >= 70 || countSeverity(profile.release?.tone) === 'alert') {
        return 'hold';
    }

    if (readinessScore >= 75) {
        return 'promote';
    }

    if (readinessScore >= 55) {
        return 'review';
    }

    return 'hold';
}

function normalizeClinicProfile(profile, index = 0, override = {}) {
    const source = asObject(profile);
    const baseId = toText(
        override.clinicId ||
            source.clinic_id ||
            source.clinicId ||
            source.id ||
            source.branding?.id ||
            `clinic-${index + 1}`
    );
    const clinicLabel = toText(
        override.clinicLabel ||
            source.clinicLabel ||
            source.branding?.name ||
            source.branding?.short_name ||
            baseId
    );
    const region = normalizeRegion(source, override);
    const province = normalizeProvince(source, override);
    const cluster = normalizeCluster(source, override);
    const ownerTeam = normalizeOwnerTeam(source, override);
    const priorityTier = normalizeTier(
        override.priorityTier ||
            source.priorityTier ||
            source.release?.priorityTier ||
            source.release?.priority ||
            source.rank,
        3
    );
    const tags = normalizeTags(
        override.tags || source.tags || source.labels || source.release?.tags
    );
    const blockingCount = safeNumber(
        override.blockingCount ||
            source.blockingCount ||
            source.release?.blockingCount ||
            (source.release?.native_apps_blocking ? 1 : 0),
        0
    );
    const warningCount = safeNumber(
        override.warningCount ||
            source.warningCount ||
            source.release?.warningCount ||
            0,
        0
    );
    const readinessScore = computeReadinessScore(source, override);
    const riskScore = computeRiskScore(source, override, readinessScore);
    const decision = normalizeDecision(
        source,
        readinessScore,
        riskScore,
        override
    );

    return {
        clinicId: baseId,
        clinicLabel,
        clinicName: clinicLabel,
        region,
        province,
        cluster,
        ownerTeam,
        priorityTier,
        tags,
        blockingCount,
        warningCount,
        readinessScore,
        riskScore,
        decision,
        state:
            decision === 'promote'
                ? 'ready'
                : decision === 'review'
                  ? 'warning'
                  : 'alert',
        releaseMode: toText(
            override.releaseMode ||
                source.release?.mode ||
                source.releaseMode ||
                'suite_v2'
        ),
        profileFingerprint: toText(
            override.profileFingerprint ||
                source.runtime_meta?.profileFingerprint ||
                source.profileFingerprint ||
                ''
        ),
        consultorioCount: safeConsultorioCount(source),
        surfaceCount: safeSurfaceCount(source),
        sourceProfile: source,
        override: asObject(override),
    };
}

function compareClinics(left, right) {
    if (left.priorityTier !== right.priorityTier) {
        return left.priorityTier - right.priorityTier;
    }

    if (right.readinessScore !== left.readinessScore) {
        return right.readinessScore - left.readinessScore;
    }

    return toText(left.clinicLabel).localeCompare(toText(right.clinicLabel));
}

function buildRegions(clinics) {
    const byRegion = new Map();

    for (const clinic of clinics) {
        const key = clinic.region || 'nacional';
        const current = byRegion.get(key) || {
            region: key,
            clinics: [],
            readinessSum: 0,
            riskSum: 0,
            blockingCount: 0,
            warningCount: 0,
        };

        current.clinics.push(clinic);
        current.readinessSum += safeNumber(clinic.readinessScore, 0);
        current.riskSum += safeNumber(clinic.riskScore, 0);
        current.blockingCount += safeNumber(clinic.blockingCount, 0);
        current.warningCount += safeNumber(clinic.warningCount, 0);
        byRegion.set(key, current);
    }

    return Array.from(byRegion.values())
        .map((entry) => {
            const clinicCount = entry.clinics.length;
            const averageReadiness = clinicCount
                ? Math.round(entry.readinessSum / clinicCount)
                : 0;
            const averageRisk = clinicCount
                ? Math.round(entry.riskSum / clinicCount)
                : 0;
            const bestClinic =
                entry.clinics.slice().sort(compareClinics)[0] || null;

            return {
                region: entry.region,
                clinicCount,
                averageReadiness,
                averageRisk,
                blockingCount: entry.blockingCount,
                warningCount: entry.warningCount,
                bestClinic,
                tone:
                    entry.blockingCount > 0 || averageRisk >= 70
                        ? 'alert'
                        : averageRisk >= 45
                          ? 'warning'
                          : 'ready',
            };
        })
        .sort((left, right) => {
            if (right.averageRisk !== left.averageRisk) {
                return right.averageRisk - left.averageRisk;
            }
            return toText(left.region).localeCompare(toText(right.region));
        });
}

function readOverrides(storage, storageKey) {
    const fallback = {};
    if (!storage || typeof storage.getItem !== 'function') {
        return fallback;
    }

    const payload = safeJsonParse(storage.getItem(storageKey), {});
    return payload && typeof payload === 'object' ? payload : fallback;
}

function writeOverrides(storage, storageKey, overrides) {
    if (!storage || typeof storage.setItem !== 'function') {
        return false;
    }

    storage.setItem(storageKey, JSON.stringify(overrides || {}, null, 2));
    return true;
}

function sanitizeOverride(override = {}) {
    const value = asObject(override);

    return {
        clinicId: toText(value.clinicId),
        clinicLabel: toText(value.clinicLabel),
        region: toText(value.region),
        province: toText(value.province),
        cluster: toText(value.cluster),
        ownerTeam: toText(value.ownerTeam),
        priorityTier: normalizeTier(value.priorityTier, 3),
        tags: normalizeTags(value.tags),
        readinessScore: safeNumber(value.readinessScore, Number.NaN),
        riskScore: safeNumber(value.riskScore, Number.NaN),
        blockingCount: safeNumber(value.blockingCount, Number.NaN),
        warningCount: safeNumber(value.warningCount, Number.NaN),
        decision: toText(value.decision),
        releaseMode: toText(value.releaseMode),
        profileFingerprint: toText(value.profileFingerprint),
    };
}

export function buildMultiClinicRegionalRegistry(input = {}, options = {}) {
    const source = asObject(input);
    const scope = toText(source.scope || options.scope || 'turnero');
    const storage = getStorage(source.storage || options.storage);
    const storageKey = `${STORAGE_KEY_PREFIX}:${scope}`;
    const registryOverrides = readOverrides(storage, storageKey);
    const clinics = resolveClinicProfiles(source)
        .map((profile, index) => {
            const sourceId = toText(
                profile?.clinic_id || profile?.clinicId || profile?.id || ''
            );
            const override =
                registryOverrides[sourceId] ||
                registryOverrides[toText(profile?.branding?.name)] ||
                registryOverrides[`clinic-${index + 1}`] ||
                {};

            return normalizeClinicProfile(profile, index, override);
        })
        .sort(compareClinics);

    const byId = Object.fromEntries(
        clinics.map((clinic) => [clinic.clinicId, clinic])
    );
    const regions = buildRegions(clinics);
    const selectedClinicId = toText(
        source.selectedClinicId || source.clinicId || options.selectedClinicId
    );
    const selectedClinic = byId[selectedClinicId] || clinics[0] || null;
    const averageReadiness = clinics.length
        ? Math.round(
              clinics.reduce(
                  (accumulator, clinic) =>
                      accumulator + safeNumber(clinic.readinessScore, 0),
                  0
              ) / clinics.length
          )
        : 0;
    const averageRisk = clinics.length
        ? Math.round(
              clinics.reduce(
                  (accumulator, clinic) =>
                      accumulator + safeNumber(clinic.riskScore, 0),
                  0
              ) / clinics.length
          )
        : 0;

    function saveOverride(clinicId, override = {}) {
        const targetId = toText(clinicId);
        if (!targetId) {
            return null;
        }

        const nextOverrides = {
            ...registryOverrides,
            [targetId]: sanitizeOverride({
                clinicId: targetId,
                ...asObject(registryOverrides[targetId]),
                ...sanitizeOverride(override),
            }),
        };

        writeOverrides(storage, storageKey, nextOverrides);
        return nextOverrides[targetId];
    }

    function removeOverride(clinicId) {
        const targetId = toText(clinicId);
        if (!targetId) {
            return false;
        }

        if (!registryOverrides[targetId]) {
            return true;
        }

        const nextOverrides = { ...registryOverrides };
        delete nextOverrides[targetId];
        writeOverrides(storage, storageKey, nextOverrides);
        return true;
    }

    return {
        scope,
        generatedAt: nowIso(),
        storageKey,
        storageAvailable: Boolean(storage),
        clinics,
        byId,
        regions,
        selectedClinicId: selectedClinic?.clinicId || '',
        selectedClinic,
        overrides: registryOverrides,
        summary: clinics.length
            ? `Registro regional ${clinics.length} clínica(s) · ${regions.length} región(es) · promedio ${averageReadiness}/100 · riesgo ${averageRisk}/100.`
            : 'Registro regional vacío.',
        metrics: {
            totalClinics: clinics.length,
            regionCount: regions.length,
            averageReadiness,
            averageRisk,
        },
        saveOverride,
        removeOverride,
        getClinic(clinicId) {
            return byId[toText(clinicId)] || null;
        },
        toJSON() {
            return {
                scope,
                generatedAt: nowIso(),
                storageKey,
                storageAvailable: Boolean(storage),
                clinics,
                regions,
                selectedClinicId: selectedClinic?.clinicId || '',
                summary: clinics.length
                    ? `Registro regional ${clinics.length} clínica(s).`
                    : 'Registro regional vacío.',
                metrics: {
                    totalClinics: clinics.length,
                    regionCount: regions.length,
                    averageReadiness,
                    averageRisk,
                },
            };
        },
    };
}

export { compareClinics, normalizeClinicProfile, resolveClinicProfiles };

export default buildMultiClinicRegionalRegistry;
