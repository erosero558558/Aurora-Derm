import { getStorageJson, setStorageJson } from '../../core/persistence.js';
import { EMPTY_FUNNEL_METRICS, LOCAL_DATA_KEYS } from './constants.js';

export function persistLocalAdminData(data) {
    setStorageJson(LOCAL_DATA_KEYS.appointments, data.appointments || []);
    setStorageJson(LOCAL_DATA_KEYS.callbacks, data.callbacks || []);
    setStorageJson(LOCAL_DATA_KEYS.reviews, data.reviews || []);
    setStorageJson(LOCAL_DATA_KEYS.availability, data.availability || {});
    setStorageJson(
        LOCAL_DATA_KEYS.availabilityMeta,
        data.availabilityMeta || {}
    );
    setStorageJson(LOCAL_DATA_KEYS.queueTickets, data.queueTickets || []);
    setStorageJson(LOCAL_DATA_KEYS.queueMeta, data.queueMeta || null);
    setStorageJson(LOCAL_DATA_KEYS.leadOpsMeta, data.leadOpsMeta || null);
    setStorageJson(
        LOCAL_DATA_KEYS.patientFlowMeta,
        data.patientFlowMeta || null
    );
    setStorageJson(
        LOCAL_DATA_KEYS.clinicalHistoryMeta,
        data.clinicalHistoryMeta || null
    );
    setStorageJson(LOCAL_DATA_KEYS.mediaFlowMeta, data.mediaFlowMeta || null);
    setStorageJson(
        LOCAL_DATA_KEYS.telemedicineMeta,
        data.telemedicineMeta || null
    );
    setStorageJson(
        LOCAL_DATA_KEYS.queueSurfaceStatus,
        data.queueSurfaceStatus || null
    );
    setStorageJson(LOCAL_DATA_KEYS.appDownloads, data.appDownloads || null);
    setStorageJson(
        LOCAL_DATA_KEYS.turneroClinicProfile,
        data.turneroClinicProfile || null
    );
    setStorageJson(
        LOCAL_DATA_KEYS.turneroClinicProfileMeta,
        data.turneroClinicProfileMeta || null
    );
    setStorageJson(
        LOCAL_DATA_KEYS.turneroClinicProfileCatalogStatus,
        data.turneroClinicProfileCatalogStatus || null
    );
    setStorageJson(
        LOCAL_DATA_KEYS.turneroOperatorAccessMeta,
        data.turneroOperatorAccessMeta || null
    );
    setStorageJson(
        LOCAL_DATA_KEYS.turneroV2Readiness,
        data.turneroV2Readiness || null
    );
    setStorageJson(
        LOCAL_DATA_KEYS.internalConsoleMeta,
        data.internalConsoleMeta || null
    );
    setStorageJson(LOCAL_DATA_KEYS.health, data.health || null);
}

export function loadLocalAdminFallback() {
    return {
        appointments: getStorageJson(LOCAL_DATA_KEYS.appointments, []),
        callbacks: getStorageJson(LOCAL_DATA_KEYS.callbacks, []),
        reviews: getStorageJson(LOCAL_DATA_KEYS.reviews, []),
        availability: getStorageJson(LOCAL_DATA_KEYS.availability, {}),
        availabilityMeta: getStorageJson(LOCAL_DATA_KEYS.availabilityMeta, {}),
        queueTickets: getStorageJson(LOCAL_DATA_KEYS.queueTickets, []),
        queueMeta: getStorageJson(LOCAL_DATA_KEYS.queueMeta, null),
        leadOpsMeta: getStorageJson(LOCAL_DATA_KEYS.leadOpsMeta, null),
        patientFlowMeta: getStorageJson(LOCAL_DATA_KEYS.patientFlowMeta, null),
        clinicalHistoryMeta: getStorageJson(
            LOCAL_DATA_KEYS.clinicalHistoryMeta,
            null
        ),
        mediaFlowMeta: getStorageJson(LOCAL_DATA_KEYS.mediaFlowMeta, null),
        telemedicineMeta: getStorageJson(
            LOCAL_DATA_KEYS.telemedicineMeta,
            null
        ),
        queueSurfaceStatus: getStorageJson(
            LOCAL_DATA_KEYS.queueSurfaceStatus,
            null
        ),
        appDownloads: getStorageJson(LOCAL_DATA_KEYS.appDownloads, null),
        turneroClinicProfile: getStorageJson(
            LOCAL_DATA_KEYS.turneroClinicProfile,
            null
        ),
        turneroClinicProfileMeta: getStorageJson(
            LOCAL_DATA_KEYS.turneroClinicProfileMeta,
            null
        ),
        turneroClinicProfileCatalogStatus: getStorageJson(
            LOCAL_DATA_KEYS.turneroClinicProfileCatalogStatus,
            null
        ),
        turneroOperatorAccessMeta: getStorageJson(
            LOCAL_DATA_KEYS.turneroOperatorAccessMeta,
            null
        ),
        turneroV2Readiness: getStorageJson(
            LOCAL_DATA_KEYS.turneroV2Readiness,
            null
        ),
        internalConsoleMeta: getStorageJson(
            LOCAL_DATA_KEYS.internalConsoleMeta,
            null
        ),
        health: getStorageJson(LOCAL_DATA_KEYS.health, null),
        funnelMetrics: EMPTY_FUNNEL_METRICS,
    };
}
