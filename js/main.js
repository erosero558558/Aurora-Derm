import {
    createOnceTask,
    scheduleDeferredTask,
    loadDeferredModule,
} from './loader.js';
import {
    resolveDeployAssetVersion,
    withDeployAssetVersion,
    debugLog,
} from './utils.js';
import { initActionRouterEngine } from './router.js';
import { initThemeMode, setThemeMode } from './theme.js';
import { changeLanguage, initEnglishBundleWarmup } from './i18n.js';
import { state } from './state.js';
import { bootstrapConsent, showConsentBanner, initGA4 } from './cookies.js';
import {
    initBookingFunnelObserver,
    initDeferredSectionPrefetch,
    maybeTrackCheckoutAbandon,
    trackEvent,
} from './analytics.js';
import { initDataEngineWarmup } from './data.js';
import {
    initBookingEngineWarmup,
    initBookingUiWarmup,
    markBookingViewed,
} from './booking.js';
// Chat shell cargado bajo demanda (code splitting)
let chatShellPromise = null;
/**
 * Loads the Chat Shell module on demand.
 * @returns {Promise<Object>} A promise that resolves to the Chat Shell module.
 */
function loadChatShell() {
    if (!chatShellPromise) {
        chatShellPromise = import('../src/apps/chat/shell.js');
    }
    return chatShellPromise;
}

let engagementRuntimePromise = null;
function loadEngagementRuntime() {
    if (!engagementRuntimePromise) {
        engagementRuntimePromise = import('./engagement.js');
    }
    return engagementRuntimePromise;
}

let galleryRuntimePromise = null;
function loadGalleryRuntime() {
    if (!galleryRuntimePromise) {
        galleryRuntimePromise = import('./gallery.js');
    }
    return galleryRuntimePromise;
}

let uiRuntimePromise = null;
function loadUiRuntime() {
    if (!uiRuntimePromise) {
        uiRuntimePromise = import('./ui.js');
    }
    return uiRuntimePromise;
}

let rescheduleRuntimePromise = null;
function loadRescheduleRuntime() {
    if (!rescheduleRuntimePromise) {
        rescheduleRuntimePromise = import('./reschedule.js');
    }
    return rescheduleRuntimePromise;
}

let successModalRuntimePromise = null;
function loadSuccessModalRuntime() {
    if (!successModalRuntimePromise) {
        successModalRuntimePromise = import('./success-modal.js');
    }
    return successModalRuntimePromise;
}

let themeButtonFallbackBridgeBound = false;

function initThemeButtonFallbackBridge() {
    if (themeButtonFallbackBridgeBound) {
        return;
    }
    themeButtonFallbackBridgeBound = true;

    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const button = target.closest('.theme-btn[data-theme-mode]');
        if (!button) return;

        const mode =
            button.getAttribute('data-theme-mode') ||
            button.getAttribute('data-value') ||
            'system';

        // Theme buttons should work even if the deferred action-router engine
        // has not finished loading yet.
        event.preventDefault();
        event.stopImmediatePropagation();
        setThemeMode(mode);
    });
}

import { loadFeatureFlags, isFeatureEnabled } from './features.js';
// content-loader.js prefetch: empieza a descargar al instante (antes de DOMContentLoaded)
// para que cuando se necesite en el handler ya este en cache.
const _contentLoaderMod = import('./content-loader.js');

// Setup global version
window.Piel = window.Piel || {};
window.Piel.deployVersion =
    window.Piel.deployVersion || resolveDeployAssetVersion();

const HERO_EXPERIMENT_STORAGE_KEY = 'pa_hero_variant_v1';
const HERO_VARIANT_CONTROL = 'control';
const HERO_VARIANT_FOCUS_AGENDA = 'focus_agenda';
const HERO_VARIANTS = [HERO_VARIANT_CONTROL, HERO_VARIANT_FOCUS_AGENDA];

const HERO_COPY = {
    [HERO_VARIANT_CONTROL]: {
        es: {
            subtitle:
                'Dermatologia especializada con tecnologia de vanguardia. Tratamientos personalizados para que tu piel luzca saludable y radiante.',
            primaryCta: 'Reservar Consulta',
        },
        en: {
            subtitle:
                'Specialized dermatology with cutting-edge technology. Personalized treatments to keep your skin healthy and radiant.',
            primaryCta: 'Book Consultation',
        },
    },
    [HERO_VARIANT_FOCUS_AGENDA]: {
        es: {
            subtitle:
                'Agenda tu valoracion dermatologica en minutos, con atencion humana y seguimiento real.',
            primaryCta: 'Agenda tu cita hoy',
        },
        en: {
            subtitle:
                'Schedule your dermatology assessment in minutes with real specialist follow-up.',
            primaryCta: 'Book Your Visit Today',
        },
    },
};

let heroVariant = null;
let heroExperimentTracked = false;

function prefersReducedMotion() {
    try {
        return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_error) {
        return false;
    }
}

function getPreferredScrollBehavior() {
    return prefersReducedMotion() ? 'auto' : 'smooth';
}

function normalizeHeroVariant(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    return HERO_VARIANTS.includes(normalized) ? normalized : '';
}

function pickHeroVariant() {
    try {
        const saved = normalizeHeroVariant(
            localStorage.getItem(HERO_EXPERIMENT_STORAGE_KEY)
        );
        if (HERO_VARIANTS.includes(saved)) {
            return saved;
        }
    } catch (_error) {
        // no-op
    }

    let selected;
    try {
        const randomArray = new Uint32Array(1);
        if (
            window.crypto &&
            typeof window.crypto.getRandomValues === 'function'
        ) {
            window.crypto.getRandomValues(randomArray);
            selected =
                randomArray[0] % 2 === 0
                    ? HERO_VARIANT_CONTROL
                    : HERO_VARIANT_FOCUS_AGENDA;
        } else {
            selected =
                Math.random() < 0.5
                    ? HERO_VARIANT_CONTROL
                    : HERO_VARIANT_FOCUS_AGENDA;
        }
        localStorage.setItem(HERO_EXPERIMENT_STORAGE_KEY, selected);
    } catch (_error) {
        selected =
            Math.random() < 0.5
                ? HERO_VARIANT_CONTROL
                : HERO_VARIANT_FOCUS_AGENDA;
    }

    return selected || HERO_VARIANT_CONTROL;
}

function getHeroVariant() {
    if (!heroVariant) {
        heroVariant = pickHeroVariant() || HERO_VARIANT_CONTROL;
    }
    return heroVariant;
}

function getHeroExperimentContext() {
    const variant = getHeroVariant();
    return {
        heroVariant: variant,
        source: `hero_${variant}`,
        checkoutEntry:
            variant === HERO_VARIANT_CONTROL
                ? 'booking_form'
                : `booking_form_${variant}`,
    };
}

window.Piel.getExperimentContext = getHeroExperimentContext;

function applyHeroExperimentCopy() {
    const variant = getHeroVariant();
    const lang = state.currentLang === 'en' ? 'en' : 'es';
    const copyByVariant = HERO_COPY[variant] || HERO_COPY[HERO_VARIANT_CONTROL];
    const copy = copyByVariant[lang] || copyByVariant.es;

    const subtitleEl = document.querySelector(
        '.hero-subtitle[data-i18n="hero_subtitle"]'
    );
    if (subtitleEl && copy.subtitle) {
        subtitleEl.textContent = copy.subtitle;
    }

    const primaryCtaEl = document.querySelector(
        '.hero-actions .btn-primary[data-i18n="hero_cta_primary"]'
    );
    if (primaryCtaEl && copy.primaryCta) {
        primaryCtaEl.textContent = copy.primaryCta;
    }

    document.documentElement.setAttribute('data-hero-variant', variant);
}

function initHeroExperimentTracking() {
    const bindCtaEvent = (selector, step) => {
        const button = document.querySelector(selector);
        if (!button || button.dataset.heroExperimentBound === 'true') {
            return;
        }
        button.dataset.heroExperimentBound = 'true';
        button.addEventListener('click', () => {
            const variant = getHeroVariant();
            trackEvent('booking_step_completed', {
                source: `hero_${variant}`,
                step,
            });
        });
    };

    bindCtaEvent(
        '.hero-actions .btn-primary[data-i18n="hero_cta_primary"]',
        'hero_primary_cta_click'
    );
    bindCtaEvent(
        '.hero-actions .btn-secondary[data-i18n="hero_cta_secondary"]',
        'hero_secondary_cta_click'
    );

    if (!heroExperimentTracked) {
        heroExperimentTracked = true;
        trackEvent('booking_step_completed', {
            source: `hero_${getHeroVariant()}`,
            step: 'hero_variant_assigned',
        });
    }
}

function initHeroExperiment() {
    getHeroVariant();
    applyHeroExperimentCopy();
    initHeroExperimentTracking();
    document.addEventListener('piel:language-changed', applyHeroExperimentCopy);
}

// Feature flags: fetch early (non-blocking), expose on window.Piel
loadFeatureFlags().then((flags) => {
    window.Piel.features = flags;
});
window.Piel.isFeatureEnabled = isFeatureEnabled;

// Deferred Stylesheet
const DEFERRED_STYLESHEET_URL = withDeployAssetVersion(
    '/styles-deferred.css?v=ui-20260221-deferred18-fullcssfix1'
);
let deferredStylesheetPromise = null;
let deferredStylesheetInitDone = false;

/**
 * Loads the deferred stylesheet if it hasn't been loaded yet.
 * @returns {Promise<boolean>} A promise that resolves when the stylesheet is loaded.
 */
function loadDeferredStylesheet() {
    if (
        document.querySelector(
            'link[data-deferred-stylesheet="true"], link[rel="stylesheet"][href*="styles-deferred.css"]'
        )
    ) {
        return Promise.resolve(true);
    }
    if (deferredStylesheetPromise) {
        return deferredStylesheetPromise;
    }
    deferredStylesheetPromise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = DEFERRED_STYLESHEET_URL;
        link.dataset.deferredStylesheet = 'true';
        link.onload = () => resolve(true);
        link.onerror = () =>
            reject(new Error('No se pudo cargar styles-deferred.css'));
        document.head.appendChild(link);
    }).catch((error) => {
        deferredStylesheetPromise = null;
        debugLog('Deferred stylesheet load failed:', error);
        throw error;
    });
    return deferredStylesheetPromise;
}

/**
 * Initializes the loading of the deferred stylesheet with a delay.
 * Prevents multiple initializations.
 */
function initDeferredStylesheetLoading() {
    if (deferredStylesheetInitDone || window.location.protocol === 'file:') {
        return;
    }
    deferredStylesheetInitDone = true;
    const startLoad = () => {
        loadDeferredStylesheet().catch(() => undefined);
    };
    scheduleDeferredTask(startLoad, {
        idleTimeout: 1200,
        fallbackDelay: 160,
        skipOnConstrained: false,
        constrainedDelay: 900,
    });
}

/**
 * Disables placeholder external links (href starting with "URL_")
 * by removing the href attribute and adding a disabled class.
 */
function disablePlaceholderExternalLinks() {
    document.querySelectorAll('a[href^="URL_"]').forEach((anchor) => {
        anchor.removeAttribute('href');
        anchor.setAttribute('aria-disabled', 'true');
        anchor.classList.add('is-disabled-link');
    });
}

/**
 * Resolves the source context of a WhatsApp link click.
 * @param {Element} waLink - The WhatsApp link element that was clicked.
 * @returns {string} The source identifier ('chatbot', 'quick_dock', 'footer', or element ID).
 */
function resolveWhatsappSource(waLink) {
    if (!waLink || !(waLink instanceof Element)) return 'unknown';

    const chatContext = waLink.closest('#chatbotContainer, #chatbotWidget');
    if (chatContext) return 'chatbot';

    const section = waLink.closest(
        'section[id], footer[id], footer, .quick-contact-dock'
    );
    if (!section) return 'unknown';

    const sectionId = section.getAttribute('id') || '';
    if (sectionId) return sectionId;
    if (section.classList.contains('quick-contact-dock')) return 'quick_dock';
    if (section.tagName && section.tagName.toLowerCase() === 'footer')
        return 'footer';
    return 'unknown';
}

/**
 * Initializes lazy loading for the booking calendar engine when booking buttons are clicked.
 */
function initBookingCalendarLazyInit() {
    function wireBookingCalendarLazyLoad(element) {
        if (!element) {
            return;
        }

        element.addEventListener('click', function () {
            const BOOKING_UTILS_URL = withDeployAssetVersion(
                '/js/engines/booking-utils.js'
            );
            loadDeferredModule({
                cacheKey: 'booking-utils-calendar',
                src: BOOKING_UTILS_URL,
                scriptDataAttribute: 'data-booking-utils',
                resolveModule: () =>
                    window.PielBookingCalendarEngine ||
                    (window.Piel && window.Piel.BookingCalendarEngine),
            })
                .then(function (moduleRef) {
                    if (
                        moduleRef &&
                        typeof moduleRef.initCalendar === 'function'
                    ) {
                        moduleRef.initCalendar();
                    }
                })
                .catch(function () {
                    // noop
                });
        });
    }

    const bookingBtn = document.getElementById('booking-btn');
    wireBookingCalendarLazyLoad(bookingBtn);

    document
        .querySelectorAll('a[href="#v5-booking"], a[href="#citas"]')
        .forEach(function (button) {
            if (button.id !== 'booking-btn') {
                wireBookingCalendarLazyLoad(button);
            }
        });
}

let pendingBookingServiceSelection = '';
let pendingBookingServiceSelectionTimer = null;
let pendingBookingServiceSelectionAttempts = 0;

function clearPendingBookingServiceSelection() {
    pendingBookingServiceSelection = '';
    pendingBookingServiceSelectionAttempts = 0;
    if (pendingBookingServiceSelectionTimer) {
        window.clearTimeout(pendingBookingServiceSelectionTimer);
        pendingBookingServiceSelectionTimer = null;
    }
}

function scrollToBookingSection() {
    const appointmentSection =
        document.getElementById('v5-booking') ||
        document.getElementById('citas');
    if (!appointmentSection) {
        return;
    }

    const navHeight = document.querySelector('.nav')?.offsetHeight || 80;
    const targetPosition = appointmentSection.offsetTop - navHeight - 20;
    window.scrollTo({
        top: targetPosition,
        behavior: getPreferredScrollBehavior(),
    });
}

function applyBookingServiceSelection(value) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return false;
    }

    const select =
        document.getElementById('v5-service-select') ||
        document.getElementById('serviceSelect');
    if (!select) {
        return false;
    }

    const optionExists = Array.from(select.options || []).some(
        function (option) {
            return String(option.value || '').trim() === normalized;
        }
    );
    if (!optionExists) {
        return false;
    }

    if (select.value !== normalized) {
        select.value = normalized;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        markBookingViewed('service_select');
    }
    return true;
}

function schedulePendingBookingServiceSelection() {
    if (
        !pendingBookingServiceSelection ||
        pendingBookingServiceSelectionTimer !== null
    ) {
        return;
    }

    const runAttempt = function () {
        pendingBookingServiceSelectionTimer = null;

        if (!pendingBookingServiceSelection) {
            return;
        }

        pendingBookingServiceSelectionAttempts += 1;
        applyBookingServiceSelection(pendingBookingServiceSelection);

        if (pendingBookingServiceSelectionAttempts >= 60) {
            clearPendingBookingServiceSelection();
            return;
        }

        pendingBookingServiceSelectionTimer = window.setTimeout(
            runAttempt,
            250
        );
    };

    pendingBookingServiceSelectionTimer = window.setTimeout(runAttempt, 0);
}

/**
 * Selects a service in the booking form programmatically and scrolls to the appointment section.
 * Supports deferred booking content by queueing a short retry window.
 * @param {string} value - The value of the service to select.
 */
function fallbackSelectService(value) {
    const normalized = String(value || '').trim();
    if (normalized) {
        pendingBookingServiceSelection = normalized;
        pendingBookingServiceSelectionAttempts = 0;
    }

    scrollToBookingSection();
    applyBookingServiceSelection(normalized);
    schedulePendingBookingServiceSelection();
}

let chatActionFallbackBridgeBound = false;
/**
 * Initializes a bridge to handle chat-related actions triggered from the DOM
 * (e.g., buttons with `data-action` attributes).
 * Ensures handlers are bound only once.
 */
function initChatActionFallbackBridge() {
    if (chatActionFallbackBridgeBound) {
        return;
    }
    chatActionFallbackBridgeBound = true;

    document.addEventListener('click', async function (event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const actionEl = target.closest('[data-action]');
        if (!actionEl) return;

        const action = String(
            actionEl.getAttribute('data-action') || ''
        ).trim();
        const value = actionEl.getAttribute('data-value') || '';

        switch (action) {
            case 'toggle-chatbot':
                event.preventDefault();
                event.stopImmediatePropagation();
                (await loadChatShell()).toggleChatbot();
                break;
            case 'minimize-chat':
                event.preventDefault();
                event.stopImmediatePropagation();
                (await loadChatShell()).minimizeChatbot();
                break;
            case 'send-chat-message':
                event.preventDefault();
                event.stopImmediatePropagation();
                (await loadChatShell()).sendChatMessage();
                break;
            case 'quick-message':
                event.preventDefault();
                event.stopImmediatePropagation();
                (await loadChatShell()).sendQuickMessage(value);
                break;
            case 'chat-booking':
                event.preventDefault();
                event.stopImmediatePropagation();
                (await loadChatShell()).handleChatBookingSelection(value);
                break;
            case 'start-booking':
                event.preventDefault();
                event.stopImmediatePropagation();
                (await loadChatShell()).startChatBooking();
                break;
            case 'select-service':
                event.preventDefault();
                event.stopImmediatePropagation();
                fallbackSelectService(value);
                break;
            default:
                break;
        }
    });

    document.addEventListener('change', async function (event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest('[data-action="chat-date-select"]')) {
            (await loadChatShell()).handleChatDateSelect(target.value);
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    disablePlaceholderExternalLinks();
    bootstrapConsent();
    initChatActionFallbackBridge();
    initThemeButtonFallbackBridge();
    initActionRouterEngine();
    initDeferredStylesheetLoading();
    initThemeMode();
    changeLanguage(state.currentLang)
        .then(() => applyHeroExperimentCopy())
        .catch(() => applyHeroExperimentCopy());
    initHeroExperiment();
    initGA4();
    initBookingFunnelObserver();
    initDeferredSectionPrefetch();

    _contentLoaderMod
        .then(({ loadDeferredContent }) => loadDeferredContent())
        .catch(() => false)
        .then(() => {
            schedulePendingBookingServiceSelection();
            showConsentBanner();

            const initHighPriorityWarmups = createOnceTask(() => {
                initEnglishBundleWarmup();
                initDataEngineWarmup();
                initBookingEngineWarmup();
                initBookingUiWarmup();
                loadChatShell()
                    .then((shell) => {
                        shell.initChatUiEngineWarmup();
                        shell.initChatWidgetEngineWarmup();
                    })
                    .catch(() => undefined);
            });

            const initLowPriorityWarmups = createOnceTask(() => {
                loadEngagementRuntime()
                    .then((mod) => {
                        mod.initReviewsEngineWarmup();
                        mod.initEngagementFormsEngineWarmup();
                    })
                    .catch(() => undefined);
                loadGalleryRuntime()
                    .then((mod) => mod.initGalleryInteractionsWarmup())
                    .catch(() => undefined);
                loadChatShell()
                    .then((shell) => {
                        shell.initChatEngineWarmup();
                        shell.initChatBookingEngineWarmup();
                    })
                    .catch(() => undefined);
                loadUiRuntime()
                    .then((mod) => {
                        mod.initUiEffectsWarmup();
                        mod.initModalUxEngineWarmup();
                    })
                    .catch(() => undefined);
                loadRescheduleRuntime()
                    .then((mod) => mod.initRescheduleEngineWarmup())
                    .catch(() => undefined);
                loadSuccessModalRuntime()
                    .then((mod) => mod.initSuccessModalEngineWarmup())
                    .catch(() => undefined);
            });

            const initDeferredWarmups = createOnceTask(() => {
                initHighPriorityWarmups();
                initLowPriorityWarmups();
                initBookingUiWarmup();
            });

            window.addEventListener('pointerdown', initDeferredWarmups, {
                once: true,
                passive: true,
            });
            window.addEventListener('keydown', initDeferredWarmups, {
                once: true,
            });

            scheduleDeferredTask(initHighPriorityWarmups, {
                idleTimeout: 1400,
                fallbackDelay: 500,
                skipOnConstrained: false,
                constrainedDelay: 900,
            });

            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.addEventListener('keypress', async (e) => {
                    (await loadChatShell()).handleChatKeypress(e);
                });
            }

            // Gallery lazy load is already initialized below in the legacy fallback block.
            initBookingCalendarLazyInit();
        });

    window.addEventListener('pagehide', () => {
        maybeTrackCheckoutAbandon('page_hide');
    });

    const isServer = window.location.protocol !== 'file:';
    if (!isServer) {
        debugLog(
            'Chatbot en modo offline: abre el sitio desde servidor para usar IA real.'
        );
    }

    // Smooth Scroll
    const nav = document.querySelector('.nav');
    document.addEventListener('click', function (e) {
        const targetEl = e.target instanceof Element ? e.target : null;
        if (!targetEl) return;

        const anchor = targetEl.closest('a[href^="#"]');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href || href === '#') return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        const navHeight = nav ? nav.offsetHeight : 0;
        const targetPosition = target.offsetTop - navHeight - 20;

        if (href === '#v5-booking' || href === '#citas') {
            markBookingViewed(`cta_click_${getHeroVariant()}`);
        }

        window.scrollTo({
            top: targetPosition,
            behavior: getPreferredScrollBehavior(),
        });
    });

    // WhatsApp Analytics
    document.addEventListener('click', function (e) {
        const targetEl = e.target instanceof Element ? e.target : null;
        if (!targetEl) return;

        const waLink = targetEl.closest(
            'a[href*="wa.me"], a[href*="api.whatsapp.com"]'
        );
        if (!waLink) return;

        const source = resolveWhatsappSource(waLink);
        trackEvent('whatsapp_click', { source });

        const inChatContext =
            !!waLink.closest('#chatbotContainer') ||
            !!waLink.closest('#chatbotWidget');
        if (!inChatContext) return;

        trackEvent('chat_handoff_whatsapp', {
            source,
        });
    });
});

// Legacy: Gallery Lazy Loading
(function () {
    const lazyImages = document.querySelectorAll('.gallery-img[data-src]');
    if (!lazyImages.length) {
        return;
    }

    const galleryObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    const srcset = img.dataset.srcset;

                    if (srcset) img.srcset = srcset;
                    img.src = src;
                    img.classList.add('loaded');

                    galleryObserver.unobserve(img);
                }
            });
        },
        { rootMargin: '200px' }
    );

    lazyImages.forEach((img) => {
        galleryObserver.observe(img);
    });
})();

// Offline/Online Sync
window.addEventListener('online', () => {
    // Refresh availability when connection returns
    initBookingEngineWarmup();
    initDataEngineWarmup();
});

// Push Notifications (Stub)
window.subscribeToPushNotifications = async function () {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        debugLog('Push not supported');
        return;
    }
    try {
        const registration = await navigator.serviceWorker.ready;
        // VAPID public key required here
        const publicVapidKey = 'B...';
        const _subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicVapidKey,
        });
    } catch (error) {
        debugLog('Push subscription error:', error);
    }
};
