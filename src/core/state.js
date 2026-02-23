let currentLang = localStorage.getItem('language') || 'es';
let currentThemeMode = localStorage.getItem('themeMode') || 'system';
let currentAppointment = null;
let checkoutSession = {
    active: false,
    completed: false,
    startedAt: 0,
    service: '',
    doctor: '',
};
let bookingViewTracked = false;
let chatStartedTracked = false;
let availabilityPrefetched = false;
let reviewsPrefetched = false;
let apiSlowNoticeLastAt = 0;
let availabilityCache = {};
let availabilityCacheLoadedAt = 0;
let availabilityCachePromise = null;
const bookedSlotsCache = new Map();
let reviewsCache = [];
let paymentConfig = {
    enabled: false,
    provider: 'stripe',
    publishableKey: '',
    currency: 'USD',
};
let paymentConfigLoaded = false;
let paymentConfigLoadedAt = 0;
let stripeSdkPromise = null;
let chatbotOpen = false;
let conversationContext = [];

export function getCurrentLang() {
    return currentLang;
}
export function setCurrentLang(lang) {
    currentLang = lang;
}

export function getCurrentThemeMode() {
    return currentThemeMode;
}
export function setCurrentThemeMode(mode) {
    currentThemeMode = mode;
}

export function getCurrentAppointment() {
    return currentAppointment;
}
export function setCurrentAppointment(appt) {
    currentAppointment = appt;
}

export function getCheckoutSession() {
    return checkoutSession;
}
export function setCheckoutSession(session) {
    checkoutSession = session;
}
export function setCheckoutSessionActive(active) {
    checkoutSession.active = active === true;
}

export function getBookingViewTracked() {
    return bookingViewTracked;
}
export function setBookingViewTracked(val) {
    bookingViewTracked = val;
}

export function getChatStartedTracked() {
    return chatStartedTracked;
}
export function setChatStartedTracked(val) {
    chatStartedTracked = val;
}

export function getAvailabilityPrefetched() {
    return availabilityPrefetched;
}
export function setAvailabilityPrefetched(val) {
    availabilityPrefetched = val;
}

export function getReviewsPrefetched() {
    return reviewsPrefetched;
}
export function setReviewsPrefetched(val) {
    reviewsPrefetched = val;
}

export function getApiSlowNoticeLastAt() {
    return apiSlowNoticeLastAt;
}
export function setApiSlowNoticeLastAt(val) {
    apiSlowNoticeLastAt = val;
}

export function getAvailabilityCache() {
    return availabilityCache;
}
export function setAvailabilityCache(val) {
    availabilityCache = val;
}

export function getAvailabilityCacheLoadedAt() {
    return availabilityCacheLoadedAt;
}
export function setAvailabilityCacheLoadedAt(val) {
    availabilityCacheLoadedAt = val;
}

export function getAvailabilityCachePromise() {
    return availabilityCachePromise;
}
export function setAvailabilityCachePromise(val) {
    availabilityCachePromise = val;
}

export function getBookedSlotsCache() {
    return bookedSlotsCache;
}

export function getReviewsCache() {
    return reviewsCache;
}
export function setReviewsCache(val) {
    reviewsCache = val;
}

export function getPaymentConfig() {
    return paymentConfig;
}
export function setPaymentConfig(val) {
    paymentConfig = val;
}

export function getPaymentConfigLoaded() {
    return paymentConfigLoaded;
}
export function setPaymentConfigLoaded(val) {
    paymentConfigLoaded = val;
}

export function getPaymentConfigLoadedAt() {
    return paymentConfigLoadedAt;
}
export function setPaymentConfigLoadedAt(val) {
    paymentConfigLoadedAt = val;
}

export function getStripeSdkPromise() {
    return stripeSdkPromise;
}
export function setStripeSdkPromise(val) {
    stripeSdkPromise = val;
}

export function getChatbotOpen() {
    return chatbotOpen;
}
export function setChatbotOpen(val) {
    chatbotOpen = val;
}

export function getConversationContext() {
    return conversationContext;
}
export function setConversationContext(val) {
    conversationContext = val;
}

export function getChatHistory() {
    try {
        const raw = localStorage.getItem('chatHistory');
        const saved = raw ? JSON.parse(raw) : [];
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const valid = saved.filter(
            (m) => m.time && new Date(m.time).getTime() > cutoff
        );
        if (valid.length !== saved.length) {
            try {
                localStorage.setItem('chatHistory', JSON.stringify(valid));
            } catch {
                // noop
            }
        }
        return valid;
    } catch {
        return [];
    }
}
export function setChatHistory(history) {
    try {
        localStorage.setItem('chatHistory', JSON.stringify(history));
    } catch {
        // noop
    }
}

const stateAccessors = {
    currentLang: [getCurrentLang, setCurrentLang],
    currentThemeMode: [getCurrentThemeMode, setCurrentThemeMode],
    currentAppointment: [getCurrentAppointment, setCurrentAppointment],
    checkoutSession: [getCheckoutSession, setCheckoutSession],
    reviewsCache: [getReviewsCache, setReviewsCache],
    chatbotOpen: [getChatbotOpen, setChatbotOpen],
    conversationContext: [getConversationContext, setConversationContext],
};

const internalState = {
    bookedSlotsCache,
};

const handler = {
    get(target, prop, receiver) {
        if (prop === 'chatHistory') {
            return getChatHistory();
        }
        if (Object.prototype.hasOwnProperty.call(stateAccessors, prop)) {
            return stateAccessors[prop][0]();
        }
        return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
        if (prop === 'chatHistory') {
            setChatHistory(value);
            return true;
        }
        if (prop === 'bookedSlotsCache') {
            return false;
        }
        if (Object.prototype.hasOwnProperty.call(stateAccessors, prop)) {
            stateAccessors[prop][1](value);
            return true;
        }
        return Reflect.set(target, prop, value, receiver);
    },
};

export const state = new Proxy(internalState, handler);
