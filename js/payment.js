import { apiRequest } from './api.js';
import {
    getPaymentConfig,
    setPaymentConfig,
    getPaymentConfigLoaded,
    setPaymentConfigLoaded,
    getPaymentConfigLoadedAt,
    setPaymentConfigLoadedAt,
    getStripeSdkPromise,
    setStripeSdkPromise,
    getCurrentLang,
} from './state.js';
import { API_ENDPOINT, API_REQUEST_TIMEOUT_MS } from './config.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { withDeployAssetVersion } from '../src/apps/shared/utils.js';

const BOOKING_UTILS_URL = withDeployAssetVersion('/js/engines/booking-utils.js');

function getPaymentGatewayEngineDeps() {
    return {
        apiRequest,
        getCurrentLang,
        getPaymentConfig, setPaymentConfig,
        getPaymentConfigLoaded, setPaymentConfigLoaded,
        getPaymentConfigLoadedAt, setPaymentConfigLoadedAt,
        getStripeSdkPromise, setStripeSdkPromise,
        apiEndpoint: API_ENDPOINT,
        apiRequestTimeoutMs: API_REQUEST_TIMEOUT_MS
    };
}

export function loadPaymentGatewayEngine() {
    return loadDeferredModule({
        cacheKey: 'booking-utils',
        src: BOOKING_UTILS_URL,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.PaymentGatewayEngine,
        isModuleReady: (module) => !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getPaymentGatewayEngineDeps()),
        missingApiError: 'payment-gateway-engine loaded without API',
        loadError: 'No se pudo cargar payment-gateway-engine (booking-utils)',
        logLabel: 'Payment gateway engine'
    });
}

export async function loadPaymentConfig() {
    return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.loadPaymentConfig());
}

export async function loadStripeSdk() {
    return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.loadStripeSdk());
}

export async function createPaymentIntent(appointment) {
    return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.createPaymentIntent(appointment));
}

export async function verifyPaymentIntent(paymentIntentId) {
    return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.verifyPaymentIntent(paymentIntentId));
}

export async function uploadTransferProof(file) {
    return runDeferredModule(loadPaymentGatewayEngine, (engine) => engine.uploadTransferProof(file));
}
