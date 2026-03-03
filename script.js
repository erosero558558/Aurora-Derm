const e = localStorage.getItem('language'),
    t = (navigator.language || navigator.userLanguage || '').startsWith('en')
        ? 'en'
        : 'es';
let n = e || t,
    o = localStorage.getItem('themeMode') || 'system',
    r = null,
    i = { active: !1, completed: !1, startedAt: 0, service: '', doctor: '' },
    a = 0;
const c = new Map();
let s = [],
    u = {
        enabled: !1,
        provider: 'stripe',
        publishableKey: '',
        currency: 'USD',
    },
    l = !1,
    d = 0,
    g = null,
    m = !1,
    p = [];
function f() {
    return n;
}
function h() {
    return r;
}
function y(e) {
    r = e;
}
function w() {
    return s;
}
function b(e) {
    s = e;
}
function v() {
    return u;
}
function k(e) {
    u = e;
}
function P() {
    return l;
}
function E(e) {
    l = e;
}
function _() {
    return d;
}
function S(e) {
    d = e;
}
function C() {
    return g;
}
function M(e) {
    g = e;
}
function A() {
    return m;
}
function j(e) {
    m = e;
}
function L() {
    return p;
}
function I(e) {
    p = e;
}
function T() {
    try {
        const e = localStorage.getItem('chatHistory'),
            t = e ? JSON.parse(e) : [],
            n = Date.now() - 864e5,
            o = t.filter((e) => e.time && new Date(e.time).getTime() > n);
        if (o.length !== t.length)
            try {
                localStorage.setItem('chatHistory', JSON.stringify(o));
            } catch {}
        return o;
    } catch {
        return [];
    }
}
function B(e) {
    try {
        localStorage.setItem('chatHistory', JSON.stringify(e));
    } catch {}
}
const D = {
        currentLang: [
            f,
            function (e) {
                n = e;
            },
        ],
        currentThemeMode: [
            function () {
                return o;
            },
            function (e) {
                o = e;
            },
        ],
        currentAppointment: [h, y],
        checkoutSession: [
            function () {
                return i;
            },
            function (e) {
                i = e;
            },
        ],
        reviewsCache: [w, b],
        chatbotOpen: [A, j],
        conversationContext: [L, I],
    },
    O = new Proxy(
        { bookedSlotsCache: c },
        {
            get: (e, t, n) =>
                'chatHistory' === t
                    ? T()
                    : Object.prototype.hasOwnProperty.call(D, t)
                      ? D[t][0]()
                      : Reflect.get(e, t, n),
            set: (e, t, n, o) =>
                'chatHistory' === t
                    ? (B(n), !0)
                    : 'bookedSlotsCache' !== t &&
                      (Object.prototype.hasOwnProperty.call(D, t)
                          ? (D[t][1](n), !0)
                          : Reflect.set(e, t, n, o)),
        }
    ),
    R = '/api.php',
    N = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador',
    x =
        'https://www.google.com/maps/place/Dr.+Cecilio+Caiza+e+hijas/@-0.1740225,-78.4865596,15z/data=!4m6!3m5!1s0x91d59b0024fc4507:0xdad3a4e6c831c417!8m2!3d-0.2165855!4d-78.4998702!16s%2Fg%2F11vpt0vjj1?entry=ttu&g_ep=EgoyMDI2MDIxMS4wIKXMDSoASAFQAw%3D%3D',
    q = '+593 98 786 6885',
    U = 'caro93narvaez@gmail.com',
    W = new Set(['light', 'dark', 'system']);
function K() {}
function z(e) {
    if (
        window.Piel &&
        window.Piel.ChatUiEngine &&
        'function' == typeof window.Piel.ChatUiEngine.escapeHtml
    )
        return window.Piel.ChatUiEngine.escapeHtml(e);
    const t = document.createElement('div');
    return ((t.textContent = String(e || '')), t.innerHTML);
}
function F(e) {
    return new Promise((t) => setTimeout(t, e));
}
function $(e) {
    const t = String(e || '').trim();
    if ('' === t) return t;
    const n = (window.Piel && window.Piel.deployVersion) || '';
    if (!n) return t;
    try {
        const e = new URL(t, window.location.origin);
        return (
            e.searchParams.set('cv', n),
            t.startsWith('/') ? e.pathname + e.search : e.toString()
        );
    } catch (e) {
        const o = t.indexOf('?') >= 0 ? '&' : '?';
        return t + o + 'cv=' + encodeURIComponent(n);
    }
}
function V(e, t = 'info', n = '') {
    let o = document.getElementById('toastContainer');
    o ||
        ((o = document.createElement('div')),
        (o.id = 'toastContainer'),
        (o.className = 'toast-container'),
        document.body.appendChild(o));
    const r = document.createElement('div');
    r.className = `toast ${t}`;
    const i = {
            success: n || 'Exito',
            error: n || 'Error',
            warning: n || 'Advertencia',
            info: n || 'Informacion',
        },
        a = String(e)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    ((r.innerHTML = `\n        <i class="fas ${{ success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' }[t]} toast-icon"></i>\n        <div class="toast-content">\n            <div class="toast-title">${i[t]}</div>\n            <div class="toast-message">${a}</div>\n        </div>\n        <button type="button" class="toast-close" data-action="toast-close">\n            <i class="fas fa-times"></i>\n        </button>\n        <div class="toast-progress"></div>\n    `),
        o.appendChild(r),
        setTimeout(() => {
            r.parentElement &&
                ((r.style.animation = 'slideIn 0.3s ease reverse'),
                setTimeout(() => r.remove(), 300));
        }, 5e3));
}
function G(e, t) {
    try {
        const n = JSON.parse(localStorage.getItem(e) || 'null');
        return null === n ? t : n;
    } catch (e) {
        return t;
    }
}
function H(e, t) {
    try {
        localStorage.setItem(e, JSON.stringify(t));
    } catch (e) {}
}
const J = new Map();
function Q(e) {
    const {
        cacheKey: t,
        src: n,
        scriptDataAttribute: o,
        resolveModule: r,
        isModuleReady: i = (e) => !!e,
        onModuleReady: a,
        missingApiError: c = 'Deferred module loaded without expected API',
        loadError: s = 'No se pudo cargar el modulo diferido',
        logLabel: u = '',
    } = e || {};
    if (!t || !n || !o || 'function' != typeof r)
        return Promise.reject(
            new Error('Invalid deferred module configuration')
        );
    const l = () => {
            const e = r();
            return i(e) ? ('function' == typeof a && a(e), e) : null;
        },
        d = l();
    if (d) return Promise.resolve(d);
    if (J.has(t)) return J.get(t);
    const g = new Promise((e, t) => {
        import(n)
            .then(() => {
                if (!document.querySelector('script[' + o + '="true"]')) {
                    const e = document.createElement('script');
                    (e.setAttribute(o, 'true'),
                        (e.dataset.dynamicImport = 'true'),
                        document.head.appendChild(e));
                }
                (() => {
                    const n = l();
                    n ? e(n) : t(new Error(c));
                })();
            })
            .catch((e) => {
                t(new Error(s));
            });
    }).catch((e) => {
        throw (J.delete(t), e);
    });
    return (J.set(t, g), g);
}
function Y(e, t = {}) {
    const {
        idleTimeout: n = 2e3,
        fallbackDelay: o = 1200,
        skipOnConstrained: r = !0,
        constrainedDelay: i = o,
    } = t;
    return (function () {
        const e =
            navigator.connection ||
            navigator.mozConnection ||
            navigator.webkitConnection;
        return !(
            !e ||
            (!0 !== e.saveData &&
                !/(^|[^0-9])2g/.test(String(e.effectiveType || '')))
        );
    })()
        ? !r && (setTimeout(e, i), !0)
        : ('function' == typeof window.requestIdleCallback
              ? window.requestIdleCallback(e, { timeout: n })
              : setTimeout(e, o),
          !0);
}
function X(e, t, n, o = !0) {
    const r = document.querySelector(e);
    return !!r && (r.addEventListener(t, n, { once: !0, passive: o }), !0);
}
function Z(e) {
    let t = !1;
    return function () {
        t || ((t = !0), e());
    };
}
function ee(e, t = {}) {
    const n = !0 === t.markWarmOnSuccess;
    let o = !1;
    return function () {
        o ||
            'file:' === window.location.protocol ||
            (n
                ? Promise.resolve(e())
                      .then(() => {
                          o = !0;
                      })
                      .catch(() => {})
                : ((o = !0),
                  Promise.resolve(e()).catch(() => {
                      o = !1;
                  })));
    };
}
function te(e, t, n = {}) {
    const { threshold: o = 0.05, rootMargin: r = '0px', onNoObserver: i } = n;
    if (!e) return !1;
    if (!('IntersectionObserver' in window))
        return ('function' == typeof i && i(), !1);
    const a = new IntersectionObserver(
        (e) => {
            e.forEach((e) => {
                e.isIntersecting && (t(e), a.disconnect());
            });
        },
        { threshold: o, rootMargin: r }
    );
    return (a.observe(e), !0);
}
function ne(e, t) {
    return Promise.resolve()
        .then(() => e())
        .then((e) => t(e));
}
function oe(e, t, n) {
    return ne(e, t).catch((e) => {
        if ('function' == typeof n) return n(e);
    });
}
const re = $('/js/engines/ui-bundle.js'),
    ie = window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
function ae() {
    return Q({
        cacheKey: 'theme-engine',
        src: re,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.ThemeEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentThemeMode: () => O.currentThemeMode,
                setCurrentThemeMode: (e) => {
                    O.currentThemeMode = W.has(e) ? e : 'system';
                },
                themeStorageKey: 'themeMode',
                validThemeModes: Array.from(W),
                getSystemThemeQuery: () => ie,
            }),
        missingApiError: 'theme-engine loaded without API',
        loadError: 'No se pudo cargar theme-engine.js',
        logLabel: 'Theme engine',
    });
}
function ce(e) {
    oe(ae, (t) => t.setThemeMode(e));
}
let se = null;
function ue(e) {
    (se || (se = import('./js/chunks/engagement-CxyxLpwi.js')), se)
        .then((t) => t.renderPublicReviews(e))
        .catch(() => {});
}
const le = $('/js/engines/data-bundle.js?v=20260225-data-consolidation1');
function de() {
    return Q({
        cacheKey: 'i18n-engine',
        src: le,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () =>
            (window.Piel && window.Piel.I18nEngine) || window.PielI18nEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => O.currentLang,
                setCurrentLang: (e) => {
                    O.currentLang = 'en' === e ? 'en' : 'es';
                },
                showToast: V,
                getReviewsCache: () => O.reviewsCache,
                renderPublicReviews: ue,
                debugLog: K,
            }),
        missingApiError: 'i18n-engine loaded without API',
        loadError: 'No se pudo cargar i18n-engine.js',
        logLabel: 'I18n engine',
    });
}
async function ge(e) {
    return ne(de, (t) => t.changeLanguage(e));
}
async function me(e, t = {}) {
    const n = String(t.method || 'GET').toUpperCase(),
        o = new URLSearchParams({ resource: e });
    t.query &&
        'object' == typeof t.query &&
        Object.entries(t.query).forEach(([e, t]) => {
            null != t && '' !== t && o.set(e, String(t));
        });
    const r = `${R}?${o.toString()}`,
        i = {
            method: n,
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        };
    void 0 !== t.body &&
        ((i.headers['Content-Type'] = 'application/json'),
        (i.body = JSON.stringify(t.body)));
    const c = Number.isFinite(t.timeoutMs)
            ? Math.max(1500, Number(t.timeoutMs))
            : 9e3,
        s = Number.isInteger(t.retries)
            ? Math.max(0, Number(t.retries))
            : 'GET' === n
              ? 1
              : 0,
        u = !0 !== t.silentSlowNotice,
        l = new Set([408, 425, 429, 500, 502, 503, 504]);
    function d(e, t = 0, n = !1, o = '') {
        const r = new Error(e);
        return ((r.status = t), (r.retryable = n), (r.code = o), r);
    }
    let g = null;
    for (let e = 0; e <= s; e += 1) {
        const t = new AbortController(),
            n = setTimeout(() => t.abort(), c);
        let o = null;
        u &&
            (o = setTimeout(() => {
                const e = Date.now();
                e - a > 25e3 &&
                    ((a = e),
                    V(
                        'es' === O.currentLang
                            ? 'Conectando con el servidor...'
                            : 'Connecting to server...',
                        'info'
                    ));
            }, 1200));
        try {
            const e = await fetch(r, { ...i, signal: t.signal }),
                n = await e.text();
            let o = {};
            try {
                o = n ? JSON.parse(n) : {};
            } catch (t) {
                throw d(
                    'Respuesta del servidor no es JSON valido',
                    e.status,
                    !1,
                    'invalid_json'
                );
            }
            if (!e.ok || !1 === o.ok)
                throw d(
                    o.error || `HTTP ${e.status}`,
                    e.status,
                    l.has(e.status),
                    'http_error'
                );
            return o;
        } catch (t) {
            const n = (() =>
                t && 'AbortError' === t.name
                    ? d(
                          'es' === O.currentLang
                              ? 'Tiempo de espera agotado con el servidor'
                              : 'Server request timed out',
                          0,
                          !0,
                          'timeout'
                      )
                    : t instanceof Error
                      ? ('boolean' != typeof t.retryable && (t.retryable = !1),
                        'number' != typeof t.status && (t.status = 0),
                        t)
                      : d(
                            'Error de conexion con el servidor',
                            0,
                            !0,
                            'network_error'
                        ))();
            if (((g = n), !(e < s && !0 === n.retryable))) throw n;
            const o = 450 * (e + 1);
            await F(o);
        } finally {
            (clearTimeout(n), null !== o && clearTimeout(o));
        }
    }
    throw g || new Error('No se pudo completar la solicitud');
}
const pe = $('/js/engines/booking-utils.js');
function fe() {
    return Q({
        cacheKey: 'booking-utils',
        src: pe,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.PaymentGatewayEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                apiRequest: me,
                getCurrentLang: f,
                getPaymentConfig: v,
                setPaymentConfig: k,
                getPaymentConfigLoaded: P,
                setPaymentConfigLoaded: E,
                getPaymentConfigLoadedAt: _,
                setPaymentConfigLoadedAt: S,
                getStripeSdkPromise: C,
                setStripeSdkPromise: M,
                apiEndpoint: R,
                apiRequestTimeoutMs: 9e3,
            }),
        missingApiError: 'payment-gateway-engine loaded without API',
        loadError: 'No se pudo cargar payment-gateway-engine (booking-utils)',
        logLabel: 'Payment gateway engine',
    });
}
async function he() {
    return oe(fe, (e) => e.loadPaymentConfig());
}
async function ye() {
    return oe(fe, (e) => e.loadStripeSdk());
}
async function we(e) {
    return oe(fe, (t) => t.createPaymentIntent(e));
}
async function be(e) {
    return oe(fe, (t) => t.verifyPaymentIntent(e));
}
let ve = null;
function ke() {
    const e = ((window.Piel || {}).config || {}).captcha || {};
    return {
        provider: String(e.provider || '')
            .trim()
            .toLowerCase(),
        siteKey: String(e.siteKey || '').trim(),
        scriptUrl: String(e.scriptUrl || '').trim(),
    };
}
async function Pe(e) {
    const t = String(e || '').trim() || 'submit';
    try {
        const e = await (function () {
            if (ve) return ve;
            const e = ke();
            return e.provider && e.siteKey && e.scriptUrl
                ? ((ve = new Promise((t) => {
                      const n = document.createElement('script');
                      ((n.src = e.scriptUrl),
                          (n.async = !0),
                          (n.defer = !0),
                          (n.onload = () => t(e.provider)),
                          (n.onerror = () => t(null)),
                          document.head.appendChild(n));
                  })),
                  ve)
                : Promise.resolve(null);
        })();
        if (!e) return null;
        const n = ke().siteKey;
        if ('recaptcha' === e)
            return window.grecaptcha &&
                'function' == typeof window.grecaptcha.ready
                ? new Promise((e) => {
                      window.grecaptcha.ready(async () => {
                          try {
                              const o = await window.grecaptcha.execute(n, {
                                  action: t,
                              });
                              e(o || null);
                          } catch (t) {
                              e(null);
                          }
                      });
                  })
                : null;
        if ('turnstile' === e) {
            if (
                !window.turnstile ||
                'function' != typeof window.turnstile.render
            )
                return null;
            const e = document.createElement('div');
            return (
                (e.style.display = 'none'),
                document.body.appendChild(e),
                new Promise((o) => {
                    let r = null;
                    const i = () => {
                        try {
                            null !== r &&
                                window.turnstile &&
                                'function' == typeof window.turnstile.remove &&
                                window.turnstile.remove(r);
                        } catch (e) {}
                        e.remove();
                    };
                    try {
                        r = window.turnstile.render(e, {
                            sitekey: n,
                            action: t,
                            callback: (e) => {
                                (i(), o(e || null));
                            },
                            'error-callback': () => {
                                (i(), o(null));
                            },
                        });
                    } catch (e) {
                        (i(), o(null));
                    }
                })
            );
        }
    } catch (e) {
        return null;
    }
    return null;
}
const Ee = $('/js/engines/data-bundle.js?v=20260225-data-consolidation1');
function _e() {
    return Q({
        cacheKey: 'data-engine',
        src: Ee,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () => window.Piel && window.Piel.DataEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => O.currentLang,
                getCaptchaToken: Pe,
                showToast: V,
                storageGetJSON: G,
                storageSetJSON: H,
            }),
        missingApiError: 'data-engine loaded without API',
        loadError: 'No se pudo cargar data-bundle.js (data-engine)',
        logLabel: 'Data engine',
    });
}
function Se() {
    const e = ee(() => _e(), { markWarmOnSuccess: !0 });
    (X('#v5-booking-form', 'focusin', e, !1),
        X('#v5-booking-form', 'pointerdown', e),
        X('#appointmentForm', 'focusin', e, !1),
        X('#appointmentForm', 'pointerdown', e),
        X('#chatbotWidget .chatbot-toggle', 'pointerdown', e),
        te(
            document.getElementById('v5-booking') ||
                document.getElementById('citas'),
            e,
            { threshold: 0.05, rootMargin: '260px 0px', onNoObserver: e }
        ),
        Y(e, { idleTimeout: 1800, fallbackDelay: 900 }));
}
async function Ce(e, t = {}) {
    return ne(_e, (n) => n.apiRequest(e, t));
}
function Me(e = '', t = '', n = '') {
    window.Piel &&
    window.Piel.DataEngine &&
    'function' == typeof window.Piel.DataEngine.invalidateBookedSlotsCache
        ? window.Piel.DataEngine.invalidateBookedSlotsCache(e, t, n)
        : ne(_e, (o) => o.invalidateBookedSlotsCache(e, t, n)).catch(() => {});
}
async function Ae(e = {}) {
    return ne(_e, (t) => t.loadAvailabilityData(e));
}
async function je(e, t = '', n = '') {
    return ne(_e, (o) => o.getBookedSlots(e, t, n));
}
async function Le(e, t = {}) {
    return ne(_e, (n) => n.createAppointmentRecord(e, t));
}
async function Ie(e) {
    return ne(_e, (t) => t.createCallbackRecord(e));
}
async function Te(e) {
    return ne(_e, (t) => t.createReviewRecord(e));
}
async function Be(e, t = {}) {
    return ne(_e, (n) => n.uploadTransferProof(e, t));
}
let De = null;
function Oe(e = {}) {
    return (De || (De = import('./js/chunks/engagement-CxyxLpwi.js')), De).then(
        (t) => t.loadPublicReviews(e)
    );
}
const Re = $(
        '/js/engines/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1'
    ),
    Ne = '/api.php?resource=funnel-event',
    xe = new Set([
        'view_booking',
        'view_service_category',
        'view_service_detail',
        'start_booking_from_service',
        'start_checkout',
        'payment_method_selected',
        'payment_success',
        'booking_confirmed',
        'checkout_abandon',
        'booking_step_completed',
        'booking_error',
        'checkout_error',
        'chat_started',
        'chat_handoff_whatsapp',
        'whatsapp_click',
    ]),
    qe = new Set([
        'source',
        'step',
        'payment_method',
        'checkout_entry',
        'checkout_step',
        'reason',
        'error_code',
        'service_slug',
        'service_category',
        'service_intent',
        'entry_point',
        'entry_surface',
        'route_profile',
        'route_id',
        'route_variant',
        'catalog_category',
        'catalog_intent',
        'booking_hint',
        'locale',
        'funnel_step',
        'intent',
        'public_surface',
    ]),
    Ue = new Map();
function We(e = {}) {
    const t = e && 'object' == typeof e ? { ...e } : {},
        n = (function () {
            if (
                !window.Piel ||
                'function' != typeof window.Piel.getExperimentContext
            )
                return null;
            try {
                const e = window.Piel.getExperimentContext();
                return e && 'object' == typeof e ? e : null;
            } catch (e) {
                return null;
            }
        })();
    if (!n) return t;
    const o = ze(n.heroVariant, '');
    o &&
        !Object.prototype.hasOwnProperty.call(t, 'ab_variant') &&
        (t.ab_variant = o);
    const r = ze(n.source, '');
    return (
        r &&
            !Object.prototype.hasOwnProperty.call(t, 'source') &&
            (t.source = r),
        t
    );
}
function Ke(e, t = {}) {
    const n = t && 'object' == typeof t ? { ...t } : {},
        o = (function () {
            const e = (() => {
                    const e = String(
                        ('undefined' != typeof document &&
                        document.documentElement
                            ? document.documentElement.lang
                            : '') || ''
                    )
                        .trim()
                        .toLowerCase();
                    return e.startsWith('en')
                        ? 'en'
                        : e.startsWith('es')
                          ? 'es'
                          : String(window.location.pathname || '').startsWith(
                                  '/en/'
                              )
                            ? 'en'
                            : 'es';
                })(),
                t = ze(
                    (function () {
                        const e = String('pa_public_surface').trim();
                        if (!e || 'undefined' == typeof document) return '';
                        const t = String(document.cookie || '');
                        if (!t) return '';
                        const n = t.split(';');
                        for (const t of n) {
                            const n = String(t || '').trim();
                            if (!n) continue;
                            const o = n.indexOf('=');
                            if ((o >= 0 ? n.slice(0, o).trim() : n) !== e)
                                continue;
                            const r = o >= 0 ? n.slice(o + 1).trim() : '';
                            try {
                                return decodeURIComponent(r);
                            } catch (e) {
                                return r;
                            }
                        }
                        return '';
                    })(),
                    ''
                );
            return {
                locale: e,
                publicSurface:
                    'legacy' === t || 'v4' === t
                        ? t
                        : (function (e) {
                              const t = String(e).trim().toLowerCase();
                              return '/legacy.php' === t || '/legacy' === t
                                  ? 'legacy'
                                  : 'v4';
                          })(window.location.pathname || '/'),
            };
        })();
    if (
        (Object.prototype.hasOwnProperty.call(n, 'locale') ||
            (n.locale = o.locale),
        Object.prototype.hasOwnProperty.call(n, 'public_surface') ||
            (n.public_surface = o.publicSurface),
        !Object.prototype.hasOwnProperty.call(n, 'entry_surface') &&
            Object.prototype.hasOwnProperty.call(n, 'entry_point') &&
            (n.entry_surface = n.entry_point),
        !Object.prototype.hasOwnProperty.call(n, 'entry_point') &&
            Object.prototype.hasOwnProperty.call(n, 'entry_surface') &&
            (n.entry_point = n.entry_surface),
        Object.prototype.hasOwnProperty.call(n, 'funnel_step') ||
            (n.funnel_step = (function (e, t = {}) {
                const n = ze(t.funnel_step, '');
                if (n) return n;
                const o = ze(e, '');
                switch (o) {
                    case 'view_booking':
                        return 'booking_view';
                    case 'view_service_category':
                        return 'service_category';
                    case 'view_service_detail':
                        return 'service_detail';
                    case 'start_booking_from_service':
                        return 'booking_intent';
                    case 'start_checkout':
                        return 'checkout_start';
                    case 'booking_confirmed':
                        return 'booking_confirmed';
                    case 'checkout_abandon':
                        return 'checkout_abandon';
                    case 'booking_step_completed':
                        return ze(t.step, 'booking_step');
                    case 'payment_method_selected':
                        return 'payment_method_selected';
                    case 'payment_success':
                        return 'payment_success';
                    case 'booking_error':
                    case 'checkout_error':
                        return o;
                    default:
                        return 'interaction';
                }
            })(e, n)),
        !Object.prototype.hasOwnProperty.call(n, 'intent'))
    ) {
        const e = (function (e = {}) {
            const t = ze(e.intent, '');
            if (t) return t;
            const n = ze(e.service_intent || e.catalog_intent, '');
            if (n) return n;
            const o = ze(e.route_profile, '');
            return 'remote' === o
                ? 'remote'
                : 'pediatric' === o
                  ? 'pediatric'
                  : 'diagnosis' === o
                    ? 'diagnosis'
                    : 'procedure' === o
                      ? 'procedures'
                      : '';
        })(n);
        e && (n.intent = e);
    }
    return n;
}
function ze(e, t = 'unknown') {
    return null == e
        ? t
        : String(e)
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9_]+/g, '_')
              .replace(/^_+|_+$/g, '')
              .slice(0, 48) || t;
}
function Fe(e, t = {}) {
    const n = ze(e, '');
    if (!xe.has(n)) return;
    if ('file:' === window.location.protocol) return;
    const o = (function (e = {}) {
            const t = {
                source: ze(
                    e && 'object' == typeof e ? e.source : void 0,
                    'unknown'
                ),
            };
            return e && 'object' == typeof e
                ? (qe.forEach((n) => {
                      'source' !== n &&
                          Object.prototype.hasOwnProperty.call(e, n) &&
                          (t[n] = ze(e[n], 'unknown'));
                  }),
                  t)
                : t;
        })(Ke(e, We(t))),
        r = [
            n,
            o.step || '',
            o.payment_method || '',
            o.checkout_step || o.step || '',
            o.reason || '',
            o.source || '',
            o.service_slug || '',
            o.entry_surface || o.entry_point || '',
            o.locale || '',
            o.public_surface || '',
        ].join('|'),
        i = Date.now();
    if (i - (Ue.get(r) || 0) < 1200) return;
    Ue.set(r, i);
    const a = JSON.stringify({ event: n, params: o });
    try {
        if (navigator.sendBeacon) {
            const e = new Blob([a], { type: 'application/json' });
            if (navigator.sendBeacon(Ne, e)) return;
        }
    } catch (e) {}
    fetch(Ne, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: a,
        keepalive: !0,
        credentials: 'same-origin',
    }).catch(() => {});
}
function $e() {
    return Q({
        cacheKey: 'analytics-engine',
        src: Re,
        scriptDataAttribute: 'data-analytics-engine',
        resolveModule: () => window.Piel && window.Piel.AnalyticsEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                observeOnceWhenVisible: te,
                loadAvailabilityData: Ae,
                loadPublicReviews: Oe,
                trackEventToServer: Fe,
            }),
        missingApiError: 'analytics-engine loaded without API',
        loadError: 'No se pudo cargar analytics-engine.js',
        logLabel: 'Analytics engine',
    });
}
function Ve(e, t = {}) {
    const n = We(t);
    (Fe(e, n), oe($e, (t) => t.trackEvent(e, n)));
}
function Ge(e, t = 'unknown') {
    return null == e
        ? t
        : String(e)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '')
              .slice(0, 64) || t;
}
function He(e = 'unknown') {
    oe($e, (t) => t.markBookingViewed(e));
}
const Je = $('/js/engines/booking-engine.js?v=figo-booking-20260219-mbfix1'),
    Qe = $(
        '/js/engines/booking-ui.js?v=figo-booking-ui-20260222-slotservicefix1'
    ),
    Ye = $('/js/engines/booking-utils.js');
let Xe = null;
function Ze(e = !1) {
    (Xe || (Xe = import('./js/chunks/success-modal-0x3ehaiL.js')), Xe)
        .then((t) => t.showSuccessModal(e))
        .catch(() => V('No se pudo abrir la confirmacion de cita.', 'error'));
}
function et(e) {
    const t = { ...e };
    return (delete t.casePhotoFiles, delete t.casePhotoUploads, t);
}
async function tt(e) {
    const t = et(e || {}),
        n = await (async function (e) {
            const t = Array.isArray(e?.casePhotoFiles) ? e.casePhotoFiles : [];
            if (0 === t.length) return { names: [], urls: [], paths: [] };
            if (
                Array.isArray(e.casePhotoUploads) &&
                e.casePhotoUploads.length > 0
            )
                return {
                    names: e.casePhotoUploads
                        .map((e) => String(e.name || ''))
                        .filter(Boolean),
                    urls: e.casePhotoUploads
                        .map((e) => String(e.url || ''))
                        .filter(Boolean),
                    paths: e.casePhotoUploads
                        .map((e) => String(e.path || ''))
                        .filter(Boolean),
                };
            const n = new Array(t.length),
                o = Math.max(1, Math.min(2, t.length));
            let r = 0;
            return (
                await Promise.all(
                    Array.from({ length: o }, () =>
                        (async () => {
                            for (; r < t.length; ) {
                                const e = r;
                                r += 1;
                                const o = t[e],
                                    i = await Be(o, { retries: 2 });
                                n[e] = {
                                    name: i.transferProofName || o.name || '',
                                    url: i.transferProofUrl || '',
                                    path: i.transferProofPath || '',
                                };
                            }
                        })()
                    )
                ),
                (e.casePhotoUploads = n),
                {
                    names: n.map((e) => String(e.name || '')).filter(Boolean),
                    urls: n.map((e) => String(e.url || '')).filter(Boolean),
                    paths: n.map((e) => String(e.path || '')).filter(Boolean),
                }
            );
        })(e || {});
    return (
        (t.casePhotoCount = n.urls.length),
        (t.casePhotoNames = n.names),
        (t.casePhotoUrls = n.urls),
        (t.casePhotoPaths = n.paths),
        t
    );
}
function nt() {
    return Q({
        cacheKey: 'booking-engine',
        src: Je,
        scriptDataAttribute: 'data-booking-engine',
        resolveModule: () => window.Piel && window.Piel.BookingEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => O.currentLang,
                getCurrentAppointment: () => O.currentAppointment,
                setCurrentAppointment: (e) => {
                    O.currentAppointment = e;
                },
                getCheckoutSession: () => O.checkoutSession,
                setCheckoutSessionActive: (e) => {
                    O.checkoutSession.active = !0 === e;
                },
                startCheckoutSession: rt,
                setCheckoutStep: it,
                completeCheckoutSession: at,
                maybeTrackCheckoutAbandon: ct,
                loadPaymentConfig: he,
                loadStripeSdk: ye,
                createPaymentIntent: we,
                verifyPaymentIntent: be,
                buildAppointmentPayload: tt,
                stripTransientAppointmentFields: et,
                createAppointmentRecord: Le,
                uploadTransferProof: Be,
                getCaptchaToken: Pe,
                showSuccessModal: Ze,
                showToast: V,
                debugLog: K,
                trackEvent: Ve,
                normalizeAnalyticsLabel: Ge,
            }),
        missingApiError: 'Booking engine loaded without API',
        loadError: 'No se pudo cargar booking-engine.js',
        logLabel: 'Booking engine',
    });
}
function ot() {
    const e = ee(() => nt(), { markWarmOnSuccess: !0 });
    ([
        '.nav-cta[href="#v5-booking"]',
        '.quick-dock-item[href="#v5-booking"]',
        '.hero-actions a[href="#v5-booking"]',
        '.nav-cta[href="#citas"]',
        '.quick-dock-item[href="#citas"]',
        '.hero-actions a[href="#citas"]',
    ].forEach((t) => {
        (X(t, 'mouseenter', e), X(t, 'focus', e, !1), X(t, 'touchstart', e));
    }),
        Y(e, { idleTimeout: 2500, fallbackDelay: 1100 }));
}
function rt(e, t = {}) {
    oe($e, (n) => n.startCheckoutSession(e, t));
}
function it(e, t = {}) {
    oe($e, (n) => n.setCheckoutStep(e, t));
}
function at(e) {
    oe($e, (t) => t.completeCheckoutSession(e));
}
function ct(e = 'unknown') {
    oe($e, (t) => t.maybeTrackCheckoutAbandon(e));
}
function st() {
    return Q({
        cacheKey: 'booking-utils-calendar',
        src: Ye,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.BookingCalendarEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.initCalendar),
        missingApiError: 'booking-calendar-engine loaded without API',
        loadError: 'No se pudo cargar booking-calendar-engine',
        logLabel: 'Booking Calendar engine',
    });
}
async function ut(e) {
    return oe(st, (t) => t.updateAvailableTimes(dt(), e));
}
function lt() {
    return ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
}
function dt() {
    return {
        loadAvailabilityData: Ae,
        getBookedSlots: je,
        updateAvailableTimes: ut,
        getDefaultTimeSlots: lt,
        showToast: V,
        getCurrentLang: () => O.currentLang,
        getCasePhotoFiles: (e) => {
            const t = e?.querySelector('#casePhotos');
            return t && t.files ? Array.from(t.files) : [];
        },
        validateCasePhotoFiles: gt,
        markBookingViewed: He,
        startCheckoutSession: rt,
        setCheckoutStep: it,
        trackEvent: Ve,
        normalizeAnalyticsLabel: Ge,
        openPaymentModal: pt,
        debugLog: K,
        setCurrentAppointment: y,
    };
}
function gt(e) {
    const t = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (Array.isArray(e) && 0 !== e.length) {
        if (e.length > 3)
            throw new Error(
                'es' === O.currentLang
                    ? 'Puedes subir máximo 3 fotos.'
                    : 'You can upload up to 3 photos.'
            );
        for (const n of e) {
            if (!n) continue;
            if (n.size > 5242880)
                throw new Error(
                    'es' === O.currentLang
                        ? `Cada foto debe pesar máximo ${Math.round(5)} MB.`
                        : `Each photo must be at most ${Math.round(5)} MB.`
                );
            const e = String(n.type || '').toLowerCase(),
                o = t.has(e),
                r = /\.(jpe?g|png|webp)$/i.test(String(n.name || ''));
            if (!o && !r)
                throw new Error(
                    'es' === O.currentLang
                        ? 'Solo se permiten imágenes JPG, PNG o WEBP.'
                        : 'Only JPG, PNG or WEBP images are allowed.'
                );
        }
    }
}
function mt() {
    const e = ee(() =>
            Q({
                cacheKey: 'booking-ui',
                src: Qe,
                scriptDataAttribute: 'data-booking-ui',
                resolveModule: () => window.Piel && window.Piel.BookingUi,
                isModuleReady: (e) => !(!e || 'function' != typeof e.init),
                onModuleReady: (e) => {
                    (e.init(dt()), (window.PielBookingUiReady = !0));
                },
                missingApiError: 'booking-ui loaded without API',
                loadError: 'No se pudo cargar booking-ui.js',
                logLabel: 'Booking UI',
            })
        ),
        t =
            document.getElementById('v5-booking') ||
            document.getElementById('citas');
    te(t, e, { threshold: 0.05, rootMargin: '320px 0px', onNoObserver: e });
    const n =
        document.getElementById('v5-booking-form') ||
        document.getElementById('appointmentForm');
    (n &&
        (n.addEventListener('focusin', e, { once: !0 }),
        n.addEventListener('pointerdown', e, { once: !0, passive: !0 }),
        setTimeout(e, 120)),
        (t || n) && Y(e, { idleTimeout: 1800, fallbackDelay: 1100 }));
}
function pt(e) {
    oe(
        nt,
        (t) => t.openPaymentModal(e),
        (e) => {
            V('No se pudo abrir el modulo de pago.', 'error');
        }
    );
}
function ft(e = {}) {
    if (
        window.Piel &&
        window.Piel.BookingEngine &&
        'function' == typeof window.Piel.BookingEngine.closePaymentModal
    )
        return void window.Piel.BookingEngine.closePaymentModal(e);
    const t = e && !0 === e.skipAbandonTrack,
        n = e && 'string' == typeof e.reason ? e.reason : 'modal_close';
    (t || ct(n), (O.checkoutSession.active = !1));
    const o =
        document.getElementById('v5-payment-modal') ||
        document.getElementById('paymentModal');
    (o && o.classList.remove('active'), (document.body.style.overflow = ''));
}
async function ht() {
    return oe(
        nt,
        (e) => e.processPayment(),
        (e) => {
            V('No se pudo procesar el pago en este momento.', 'error');
        }
    );
}
let yt = null;
function wt() {
    return (yt || (yt = import('./js/chunks/ui-C4GEqQxn.js')), yt);
}
let bt = null;
function vt() {
    return (bt || (bt = import('./js/chunks/engagement-CxyxLpwi.js')), bt);
}
let kt = null,
    Pt = null;
function Et() {
    return (Pt || (Pt = import('./js/chunks/reschedule-CiSqh0C5.js')), Pt);
}
function _t(e) {
    wt()
        .then((t) => t.toggleMobileMenu(e))
        .catch(() => {});
}
function St() {
    wt()
        .then((e) => e.startWebVideo())
        .catch(() => {});
}
function Ct() {
    wt()
        .then((e) => e.closeVideoModal())
        .catch(() => {});
}
function Mt() {
    vt()
        .then((e) => e.openReviewModal())
        .catch(() => {});
}
function At() {
    vt()
        .then((e) => e.closeReviewModal())
        .catch(() => {});
}
function jt() {
    (kt || (kt = import('./js/chunks/success-modal-0x3ehaiL.js')), kt)
        .then((e) => e.closeSuccessModal())
        .catch(() => {});
}
function Lt() {
    Et()
        .then((e) => e.closeRescheduleModal())
        .catch(() => {});
}
function It() {
    Et()
        .then((e) => e.submitReschedule())
        .catch(() => {});
}
function Tt(e) {
    return async (...t) =>
        (await import('./js/chunks/shell-CuA1ovOc.js'))[e](...t);
}
const Bt = $('/js/engines/data-bundle.js?v=20260225-data-consolidation1');
function Dt(e) {
    const t =
        document.getElementById('v5-service-select') ||
        document.getElementById('serviceSelect');
    if (t) {
        ((t.value = e),
            t.dispatchEvent(new Event('change')),
            He('service_select'));
        const n =
            document.getElementById('v5-booking') ||
            document.getElementById('citas');
        if (n) {
            const e = document.querySelector('.nav')?.offsetHeight || 80,
                t = n.offsetTop - e - 20;
            window.scrollTo({ top: t, behavior: 'smooth' });
        }
    }
}
function Ot() {
    return Q({
        cacheKey: 'action-router-engine',
        src: Bt,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () =>
            (window.Piel && window.Piel.ActionRouterEngine) ||
            window.PielActionRouterEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                setThemeMode: ce,
                changeLanguage: ge,
                toggleMobileMenu: _t,
                startWebVideo: St,
                openReviewModal: Mt,
                closeReviewModal: At,
                closeVideoModal: Ct,
                closePaymentModal: ft,
                processPayment: ht,
                closeSuccessModal: jt,
                closeRescheduleModal: Lt,
                submitReschedule: It,
                toggleChatbot: Tt('toggleChatbot'),
                sendChatMessage: Tt('sendChatMessage'),
                handleChatBookingSelection: Tt('handleChatBookingSelection'),
                sendQuickMessage: Tt('sendQuickMessage'),
                minimizeChatbot: Tt('minimizeChatbot'),
                startChatBooking: Tt('startChatBooking'),
                handleChatDateSelect: Tt('handleChatDateSelect'),
                selectService: Dt,
            }),
        missingApiError: 'action-router-engine loaded without API',
        loadError: 'No se pudo cargar action-router-engine.js',
        logLabel: 'Action router engine',
    });
}
const Rt = $('/js/engines/ui-bundle.js');
function Nt() {
    return Q({
        cacheKey: 'consent-engine',
        src: Rt,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.ConsentEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => O.currentLang,
                showToast: V,
                trackEvent: Ve,
                cookieConsentKey: 'pa_cookie_consent_v1',
                gaMeasurementId: 'G-GYY8PE5M8W',
            }),
        missingApiError: 'consent-engine loaded without API',
        loadError: 'No se pudo cargar consent-engine.js',
        logLabel: 'Consent engine',
    });
}
let xt = null,
    qt = null,
    Ut = null;
function Wt() {
    return (Ut || (Ut = import('./js/chunks/shell-CuA1ovOc.js')), Ut);
}
let Kt = null,
    zt = null,
    Ft = null,
    $t = null,
    Vt = null,
    Gt = !1;
const Ht = import('./js/chunks/content-loader-BCpccN5h.js');
((window.Piel = window.Piel || {}),
    (window.Piel.deployVersion =
        window.Piel.deployVersion ||
        (function () {
            try {
                if (
                    document.currentScript &&
                    'string' == typeof document.currentScript.src &&
                    '' !== document.currentScript.src
                ) {
                    const e = new URL(
                        document.currentScript.src,
                        window.location.href
                    ).searchParams.get('v');
                    if (e) return e;
                }
                const e = document.querySelector('script[src*="script.js"]');
                if (e && 'function' == typeof e.getAttribute) {
                    const t = e.getAttribute('src') || '';
                    if (t) {
                        const e = new URL(
                            t,
                            window.location.href
                        ).searchParams.get('v');
                        if (e) return e;
                    }
                }
            } catch (e) {
                return '';
            }
            return '';
        })()));
const Jt = 'pa_hero_variant_v1',
    Qt = 'control',
    Yt = 'focus_agenda',
    Xt = [Qt, Yt],
    Zt = {
        [Qt]: {
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
        [Yt]: {
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
let en = null,
    tn = !1;
function nn() {
    return (function () {
        try {
            return !!window.matchMedia('(prefers-reduced-motion: reduce)')
                .matches;
        } catch (e) {
            return !1;
        }
    })()
        ? 'auto'
        : 'smooth';
}
function on() {
    return (
        en ||
            (en =
                (function () {
                    try {
                        const e = (function (e) {
                            const t = String(e || '')
                                .trim()
                                .toLowerCase();
                            return Xt.includes(t) ? t : '';
                        })(localStorage.getItem(Jt));
                        if (Xt.includes(e)) return e;
                    } catch (e) {}
                    let e;
                    try {
                        const t = new Uint32Array(1);
                        (window.crypto &&
                        'function' == typeof window.crypto.getRandomValues
                            ? (window.crypto.getRandomValues(t),
                              (e = t[0] % 2 == 0 ? Qt : Yt))
                            : (e = Math.random() < 0.5 ? Qt : Yt),
                            localStorage.setItem(Jt, e));
                    } catch (t) {
                        e = Math.random() < 0.5 ? Qt : Yt;
                    }
                    return e || Qt;
                })() || Qt),
        en
    );
}
function rn() {
    const e = on(),
        t = 'en' === O.currentLang ? 'en' : 'es',
        n = Zt[e] || Zt[Qt],
        o = n[t] || n.es,
        r = document.querySelector('.hero-subtitle[data-i18n="hero_subtitle"]');
    r && o.subtitle && (r.textContent = o.subtitle);
    const i = document.querySelector(
        '.hero-actions .btn-primary[data-i18n="hero_cta_primary"]'
    );
    (i && o.primaryCta && (i.textContent = o.primaryCta),
        document.documentElement.setAttribute('data-hero-variant', e));
}
((window.Piel.getExperimentContext = function () {
    const e = on();
    return {
        heroVariant: e,
        source: `hero_${e}`,
        checkoutEntry: e === Qt ? 'booking_form' : `booking_form_${e}`,
    };
}),
    (async function () {
        return null !== xt
            ? xt
            : qt ||
                  ((qt = fetch('/api.php?action=features', {
                      method: 'GET',
                      headers: { 'Cache-Control': 'no-cache' },
                  })
                      .then((e) => (e.ok ? e.json() : null))
                      .then(
                          (e) => ((xt = e && e.ok && e.data ? e.data : {}), xt)
                      )
                      .catch(() => ((xt = {}), xt))),
                  qt);
    })().then((e) => {
        window.Piel.features = e;
    }),
    (window.Piel.isFeatureEnabled = function (e) {
        return !!xt && Boolean(xt[e]);
    }));
const an = $('/styles-deferred.css?v=ui-20260221-deferred18-fullcssfix1');
let cn = null,
    sn = !1;
let un = '',
    ln = null,
    dn = 0;
function gn(e) {
    const t = String(e || '').trim();
    if (!t) return !1;
    const n =
        document.getElementById('v5-service-select') ||
        document.getElementById('serviceSelect');
    return (
        !!n &&
        !!Array.from(n.options || []).some(function (e) {
            return String(e.value || '').trim() === t;
        }) &&
        (n.value !== t &&
            ((n.value = t),
            n.dispatchEvent(new Event('change', { bubbles: !0 })),
            He('service_select')),
        !0)
    );
}
function mn() {
    if (!un || null !== ln) return;
    const e = function () {
        if (((ln = null), un)) {
            if (((dn += 1), gn(un), dn >= 60))
                return (
                    (un = ''),
                    (dn = 0),
                    void (ln && (window.clearTimeout(ln), (ln = null)))
                );
            ln = window.setTimeout(e, 250);
        }
    };
    ln = window.setTimeout(e, 0);
}
let pn = !1;
(document.addEventListener('DOMContentLoaded', function () {
    (document.querySelectorAll('a[href^="URL_"]').forEach((e) => {
        (e.removeAttribute('href'),
            e.setAttribute('aria-disabled', 'true'),
            e.classList.add('is-disabled-link'));
    }),
        Nt(),
        pn ||
            ((pn = !0),
            document.addEventListener('click', async function (e) {
                const t = e.target instanceof Element ? e.target : null;
                if (!t) return;
                const n = t.closest('[data-action]');
                if (!n) return;
                const o = String(n.getAttribute('data-action') || '').trim(),
                    r = n.getAttribute('data-value') || '';
                switch (o) {
                    case 'toggle-chatbot':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Wt()).toggleChatbot());
                        break;
                    case 'minimize-chat':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Wt()).minimizeChatbot());
                        break;
                    case 'send-chat-message':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Wt()).sendChatMessage());
                        break;
                    case 'quick-message':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Wt()).sendQuickMessage(r));
                        break;
                    case 'chat-booking':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Wt()).handleChatBookingSelection(r));
                        break;
                    case 'start-booking':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Wt()).startChatBooking());
                        break;
                    case 'select-service':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (function (e) {
                                const t = String(e || '').trim();
                                (t && ((un = t), (dn = 0)),
                                    (function () {
                                        const e =
                                            document.getElementById(
                                                'v5-booking'
                                            ) ||
                                            document.getElementById('citas');
                                        if (!e) return;
                                        const t =
                                                document.querySelector('.nav')
                                                    ?.offsetHeight || 80,
                                            n = e.offsetTop - t - 20;
                                        window.scrollTo({
                                            top: n,
                                            behavior: nn(),
                                        });
                                    })(),
                                    gn(t),
                                    mn());
                            })(r));
                }
            }),
            document.addEventListener('change', async function (e) {
                const t = e.target instanceof Element ? e.target : null;
                t &&
                    t.closest('[data-action="chat-date-select"]') &&
                    (await Wt()).handleChatDateSelect(t.value);
            })),
        Gt ||
            ((Gt = !0),
            document.addEventListener('click', (e) => {
                const t = e.target instanceof Element ? e.target : null;
                if (!t) return;
                const n = t.closest('.theme-btn[data-theme-mode]');
                if (!n) return;
                const o =
                    n.getAttribute('data-theme-mode') ||
                    n.getAttribute('data-value') ||
                    'system';
                (e.preventDefault(), e.stopImmediatePropagation(), ce(o));
            })),
        oe(
            Ot,
            () => {},
            (e) => {}
        ),
        sn ||
            'file:' === window.location.protocol ||
            ((sn = !0),
            Y(
                () => {
                    (document.querySelector(
                        'link[data-deferred-stylesheet="true"], link[rel="stylesheet"][href*="styles-deferred.css"]'
                    )
                        ? Promise.resolve(!0)
                        : cn ||
                          ((cn = new Promise((e, t) => {
                              const n = document.createElement('link');
                              ((n.rel = 'stylesheet'),
                                  (n.href = an),
                                  (n.dataset.deferredStylesheet = 'true'),
                                  (n.onload = () => e(!0)),
                                  (n.onerror = () =>
                                      t(
                                          new Error(
                                              'No se pudo cargar styles-deferred.css'
                                          )
                                      )),
                                  document.head.appendChild(n));
                          }).catch((e) => {
                              throw ((cn = null), e);
                          })),
                          cn)
                    ).catch(() => {});
                },
                {
                    idleTimeout: 1200,
                    fallbackDelay: 160,
                    skipOnConstrained: !1,
                    constrainedDelay: 900,
                }
            )),
        oe(ae, (e) => e.initThemeMode()),
        ge(O.currentLang)
            .then(() => rn())
            .catch(() => rn()),
        on(),
        rn(),
        (function () {
            const e = (e, t) => {
                const n = document.querySelector(e);
                n &&
                    'true' !== n.dataset.heroExperimentBound &&
                    ((n.dataset.heroExperimentBound = 'true'),
                    n.addEventListener('click', () => {
                        Ve('booking_step_completed', {
                            source: `hero_${on()}`,
                            step: t,
                        });
                    }));
            };
            (e(
                '.hero-actions .btn-primary[data-i18n="hero_cta_primary"]',
                'hero_primary_cta_click'
            ),
                e(
                    '.hero-actions .btn-secondary[data-i18n="hero_cta_secondary"]',
                    'hero_secondary_cta_click'
                ),
                tn ||
                    ((tn = !0),
                    Ve('booking_step_completed', {
                        source: `hero_${on()}`,
                        step: 'hero_variant_assigned',
                    })));
        })(),
        document.addEventListener('piel:language-changed', rn),
        oe(Nt, (e) => e.initGA4()),
        oe($e, (e) => e.initBookingFunnelObserver()),
        oe($e, (e) => e.initDeferredSectionPrefetch()),
        Ht.then(({ loadDeferredContent: e }) => e())
            .catch(() => !1)
            .then(() => {
                (mn(), oe(Nt, (e) => e.initCookieBanner()));
                const e = Z(() => {
                        (!(function () {
                            const e = () => {
                                    ne(de, (e) =>
                                        e.ensureEnglishTranslations()
                                    ).catch(() => {});
                                },
                                t = document.querySelector(
                                    '.lang-btn[data-lang="en"]'
                                );
                            t &&
                                (t.addEventListener('mouseenter', e, {
                                    once: !0,
                                    passive: !0,
                                }),
                                t.addEventListener('touchstart', e, {
                                    once: !0,
                                    passive: !0,
                                }),
                                t.addEventListener('focus', e, { once: !0 }));
                        })(),
                            Se(),
                            ot(),
                            mt(),
                            Wt()
                                .then((e) => {
                                    (e.initChatUiEngineWarmup(),
                                        e.initChatWidgetEngineWarmup());
                                })
                                .catch(() => {}));
                    }),
                    t = Z(() => {
                        ((Kt ||
                            (Kt = import('./js/chunks/engagement-CxyxLpwi.js')),
                        Kt)
                            .then((e) => {
                                (e.initReviewsEngineWarmup(),
                                    e.initEngagementFormsEngineWarmup());
                            })
                            .catch(() => {}),
                            (zt ||
                                (zt =
                                    import('./js/chunks/gallery-CbqHlD9_.js')),
                            zt)
                                .then((e) => e.initGalleryInteractionsWarmup())
                                .catch(() => {}),
                            Wt()
                                .then((e) => {
                                    (e.initChatEngineWarmup(),
                                        e.initChatBookingEngineWarmup());
                                })
                                .catch(() => {}),
                            (Ft || (Ft = import('./js/chunks/ui-C4GEqQxn.js')),
                            Ft)
                                .then((e) => {
                                    (e.initUiEffectsWarmup(),
                                        e.initModalUxEngineWarmup());
                                })
                                .catch(() => {}),
                            ($t ||
                                ($t =
                                    import('./js/chunks/reschedule-CiSqh0C5.js')),
                            $t)
                                .then((e) => e.initRescheduleEngineWarmup())
                                .catch(() => {}),
                            (Vt ||
                                (Vt =
                                    import('./js/chunks/success-modal-0x3ehaiL.js')),
                            Vt)
                                .then((e) => e.initSuccessModalEngineWarmup())
                                .catch(() => {}));
                    }),
                    n = Z(() => {
                        (e(), t(), mt());
                    });
                (window.addEventListener('pointerdown', n, {
                    once: !0,
                    passive: !0,
                }),
                    window.addEventListener('keydown', n, { once: !0 }),
                    Y(e, {
                        idleTimeout: 1400,
                        fallbackDelay: 500,
                        skipOnConstrained: !1,
                        constrainedDelay: 900,
                    }));
                const o = document.getElementById('chatInput');
                (o &&
                    o.addEventListener('keypress', async (e) => {
                        (await Wt()).handleChatKeypress(e);
                    }),
                    (function () {
                        function e(e) {
                            e &&
                                e.addEventListener('click', function () {
                                    Q({
                                        cacheKey: 'booking-utils-calendar',
                                        src: $('/js/engines/booking-utils.js'),
                                        scriptDataAttribute:
                                            'data-booking-utils',
                                        resolveModule: () =>
                                            window.PielBookingCalendarEngine ||
                                            (window.Piel &&
                                                window.Piel
                                                    .BookingCalendarEngine),
                                    })
                                        .then(function (e) {
                                            e &&
                                                'function' ==
                                                    typeof e.initCalendar &&
                                                e.initCalendar();
                                        })
                                        .catch(function () {});
                                });
                        }
                        (e(document.getElementById('booking-btn')),
                            document
                                .querySelectorAll(
                                    'a[href="#v5-booking"], a[href="#citas"]'
                                )
                                .forEach(function (t) {
                                    'booking-btn' !== t.id && e(t);
                                }));
                    })());
            }),
        window.addEventListener('pagehide', () => {
            !(function (e = 'unknown') {
                oe($e, (t) => t.maybeTrackCheckoutAbandon(e));
            })('page_hide');
        }));
    const e = document.querySelector('.nav');
    (document.addEventListener('click', function (t) {
        const n = t.target instanceof Element ? t.target : null;
        if (!n) return;
        const o = n.closest('a[href^="#"]');
        if (!o) return;
        const r = o.getAttribute('href');
        if (!r || '#' === r) return;
        const i = document.querySelector(r);
        if (!i) return;
        t.preventDefault();
        const a = e ? e.offsetHeight : 0,
            c = i.offsetTop - a - 20;
        (('#v5-booking' !== r && '#citas' !== r) || He(`cta_click_${on()}`),
            window.scrollTo({ top: c, behavior: nn() }));
    }),
        document.addEventListener('click', function (e) {
            const t = e.target instanceof Element ? e.target : null;
            if (!t) return;
            const n = t.closest(
                'a[href*="wa.me"], a[href*="api.whatsapp.com"]'
            );
            if (!n) return;
            const o = (function (e) {
                if (!(e && e instanceof Element)) return 'unknown';
                if (e.closest('#chatbotContainer, #chatbotWidget'))
                    return 'chatbot';
                const t = e.closest(
                    'section[id], footer[id], footer, .quick-contact-dock'
                );
                return t
                    ? t.getAttribute('id') ||
                          (t.classList.contains('quick-contact-dock')
                              ? 'quick_dock'
                              : t.tagName &&
                                  'footer' === t.tagName.toLowerCase()
                                ? 'footer'
                                : 'unknown')
                    : 'unknown';
            })(n);
            (Ve('whatsapp_click', { source: o }),
                (n.closest('#chatbotContainer') ||
                    n.closest('#chatbotWidget')) &&
                    Ve('chat_handoff_whatsapp', { source: o }));
        }));
}),
    (function () {
        const e = document.querySelectorAll('.gallery-img[data-src]');
        if (!e.length) return;
        const t = new IntersectionObserver(
            (e) => {
                e.forEach((e) => {
                    if (e.isIntersecting) {
                        const n = e.target,
                            o = n.dataset.src,
                            r = n.dataset.srcset;
                        (r && (n.srcset = r),
                            (n.src = o),
                            n.classList.add('loaded'),
                            t.unobserve(n));
                    }
                });
            },
            { rootMargin: '200px' }
        );
        e.forEach((e) => {
            t.observe(e);
        });
    })(),
    window.addEventListener('online', () => {
        (ot(), Se());
    }),
    (window.subscribeToPushNotifications = async function () {
        if ('serviceWorker' in navigator && 'PushManager' in window)
            try {
                const e = await navigator.serviceWorker.ready,
                    t = 'B...';
                await e.pushManager.subscribe({
                    userVisibleOnly: !0,
                    applicationServerKey: t,
                });
            } catch (e) {}
    }));
export {
    it as A,
    rt as B,
    x as C,
    U as D,
    je as E,
    Ae as F,
    te as G,
    b as H,
    w as I,
    Te as J,
    Ie as K,
    z as L,
    G as M,
    Ce as N,
    ft as O,
    Me as P,
    Y as a,
    X as b,
    ee as c,
    j as d,
    $ as e,
    q as f,
    A as g,
    N as h,
    B as i,
    T as j,
    h as k,
    Q as l,
    I as m,
    L as n,
    K as o,
    O as p,
    y as q,
    oe as r,
    V as s,
    Ve as t,
    f as u,
    pt as v,
    ne as w,
    Pe as x,
    Le as y,
    at as z,
};
