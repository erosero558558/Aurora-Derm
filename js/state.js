// Prefer explicit user choice; fall back to browser language; default to Spanish.
const _savedLang = localStorage.getItem('language');
const _browserLang = (navigator.language || navigator.userLanguage || '').startsWith('en') ? 'en' : 'es';

const internalState = {
    currentLang: _savedLang || _browserLang,
    currentThemeMode: localStorage.getItem('themeMode') || 'system',
    currentAppointment: null,
    checkoutSession: {
        active: false,
        completed: false,
        startedAt: 0,
        service: '',
        doctor: '',
    },
    bookingViewTracked: false,
    chatStartedTracked: false,
    availabilityPrefetched: false,
    reviewsPrefetched: false,
    apiSlowNoticeLastAt: 0,
    availabilityCache: {},
    availabilityCacheLoadedAt: 0,
    availabilityCachePromise: null,
    bookedSlotsCache: new Map(),
    reviewsCache: [],
    paymentConfig: {
        enabled: false,
        provider: 'stripe',
        publishableKey: '',
        currency: 'USD',
    },
    paymentConfigLoaded: false,
    paymentConfigLoadedAt: 0,
    stripeSdkPromise: null,
    chatbotOpen: false,
    conversationContext: [],
    // chatHistory is virtual, handled by proxy
};

const handler = {
    get(target, prop, receiver) {
        if (prop === 'chatHistory') {
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
        return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
        if (prop === 'chatHistory') {
            try {
                localStorage.setItem('chatHistory', JSON.stringify(value));
            } catch {
                // noop
            }
            return true;
        }
        if (prop === 'bookedSlotsCache') {
            return false;
        }
        return Reflect.set(target, prop, value, receiver);
    }
};

export const state = new Proxy(internalState, handler);

// Compatibility exports
export const getCurrentLang = () => state.currentLang;
export const setCurrentLang = (val) => { state.currentLang = val; };

export const getCurrentThemeMode = () => state.currentThemeMode;
export const setCurrentThemeMode = (val) => { state.currentThemeMode = val; };

export const getCurrentAppointment = () => state.currentAppointment;
export const setCurrentAppointment = (val) => { state.currentAppointment = val; };

export const getCheckoutSession = () => state.checkoutSession;
export const setCheckoutSession = (val) => { state.checkoutSession = val; };
export const setCheckoutSessionActive = (active) => {
    if (state.checkoutSession) {
        state.checkoutSession.active = active === true;
    }
};

export const getBookingViewTracked = () => state.bookingViewTracked;
export const setBookingViewTracked = (val) => { state.bookingViewTracked = val; };

export const getChatStartedTracked = () => state.chatStartedTracked;
export const setChatStartedTracked = (val) => { state.chatStartedTracked = val; };

export const getAvailabilityPrefetched = () => state.availabilityPrefetched;
export const setAvailabilityPrefetched = (val) => { state.availabilityPrefetched = val; };

export const getReviewsPrefetched = () => state.reviewsPrefetched;
export const setReviewsPrefetched = (val) => { state.reviewsPrefetched = val; };

export const getApiSlowNoticeLastAt = () => state.apiSlowNoticeLastAt;
export const setApiSlowNoticeLastAt = (val) => { state.apiSlowNoticeLastAt = val; };

export const getAvailabilityCache = () => state.availabilityCache;
export const setAvailabilityCache = (val) => { state.availabilityCache = val; };

export const getAvailabilityCacheLoadedAt = () => state.availabilityCacheLoadedAt;
export const setAvailabilityCacheLoadedAt = (val) => { state.availabilityCacheLoadedAt = val; };

export const getAvailabilityCachePromise = () => state.availabilityCachePromise;
export const setAvailabilityCachePromise = (val) => { state.availabilityCachePromise = val; };

export const getBookedSlotsCache = () => state.bookedSlotsCache;

export const getReviewsCache = () => state.reviewsCache;
export const setReviewsCache = (val) => { state.reviewsCache = val; };

export const getPaymentConfig = () => state.paymentConfig;
export const setPaymentConfig = (val) => { state.paymentConfig = val; };

export const getPaymentConfigLoaded = () => state.paymentConfigLoaded;
export const setPaymentConfigLoaded = (val) => { state.paymentConfigLoaded = val; };

export const getPaymentConfigLoadedAt = () => state.paymentConfigLoadedAt;
export const setPaymentConfigLoadedAt = (val) => { state.paymentConfigLoadedAt = val; };

export const getStripeSdkPromise = () => state.stripeSdkPromise;
export const setStripeSdkPromise = (val) => { state.stripeSdkPromise = val; };

export const getChatbotOpen = () => state.chatbotOpen;
export const setChatbotOpen = (val) => { state.chatbotOpen = val; };

export const getConversationContext = () => state.conversationContext;
export const setConversationContext = (val) => { state.conversationContext = val; };

export const getChatHistory = () => state.chatHistory;
export const setChatHistory = (val) => { state.chatHistory = val; };
