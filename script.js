const e = localStorage.getItem('language'),
    t = (navigator.language || navigator.userLanguage || '').startsWith('en')
        ? 'en'
        : 'es';
let n = e || t,
    o = localStorage.getItem('themeMode') || 'system',
    i = null,
    a = { active: !1, completed: !1, startedAt: 0, service: '', doctor: '' },
    r = 0;
const s = new Map();
let c = [],
    l = {
        enabled: !1,
        provider: 'stripe',
        publishableKey: '',
        currency: 'USD',
    },
    u = !1,
    d = 0,
    g = null,
    h = !1,
    m = [];
function p() {
    return n;
}
function f() {
    return i;
}
function y(e) {
    i = e;
}
function w() {
    return c;
}
function b(e) {
    c = e;
}
function k() {
    return l;
}
function v(e) {
    l = e;
}
function P() {
    return u;
}
function E(e) {
    u = e;
}
function C() {
    return d;
}
function S(e) {
    d = e;
}
function M() {
    return g;
}
function A(e) {
    g = e;
}
function j() {
    return h;
}
function L(e) {
    h = e;
}
function _() {
    return m;
}
function T(e) {
    m = e;
}
function I() {
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
            p,
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
        currentAppointment: [f, y],
        checkoutSession: [
            function () {
                return a;
            },
            function (e) {
                a = e;
            },
        ],
        reviewsCache: [w, b],
        chatbotOpen: [j, L],
        conversationContext: [_, T],
    },
    R = new Proxy(
        { bookedSlotsCache: s },
        {
            get: (e, t, n) =>
                'chatHistory' === t
                    ? I()
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
    N = '/api.php',
    O = 'Dr. Cecilio Caiza e hijas, Quito, Ecuador',
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
    const i = document.createElement('div');
    i.className = `toast ${t}`;
    const a = {
            success: n || 'Exito',
            error: n || 'Error',
            warning: n || 'Advertencia',
            info: n || 'Informacion',
        },
        r = String(e)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    ((i.innerHTML = `\n        <i class="fas ${{ success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' }[t]} toast-icon"></i>\n        <div class="toast-content">\n            <div class="toast-title">${a[t]}</div>\n            <div class="toast-message">${r}</div>\n        </div>\n        <button type="button" class="toast-close" data-action="toast-close">\n            <i class="fas fa-times"></i>\n        </button>\n        <div class="toast-progress"></div>\n    `),
        o.appendChild(i),
        setTimeout(() => {
            i.parentElement &&
                ((i.style.animation = 'slideIn 0.3s ease reverse'),
                setTimeout(() => i.remove(), 300));
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
        resolveModule: i,
        isModuleReady: a = (e) => !!e,
        onModuleReady: r,
        missingApiError: s = 'Deferred module loaded without expected API',
        loadError: c = 'No se pudo cargar el modulo diferido',
        logLabel: l = '',
    } = e || {};
    if (!t || !n || !o || 'function' != typeof i)
        return Promise.reject(
            new Error('Invalid deferred module configuration')
        );
    const u = () => {
            const e = i();
            return a(e) ? ('function' == typeof r && r(e), e) : null;
        },
        d = u();
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
                    const n = u();
                    n ? e(n) : t(new Error(s));
                })();
            })
            .catch((e) => {
                t(new Error(c));
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
        skipOnConstrained: i = !0,
        constrainedDelay: a = o,
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
        ? !i && (setTimeout(e, a), !0)
        : ('function' == typeof window.requestIdleCallback
              ? window.requestIdleCallback(e, { timeout: n })
              : setTimeout(e, o),
          !0);
}
function X(e, t, n, o = !0) {
    const i = document.querySelector(e);
    return !!i && (i.addEventListener(t, n, { once: !0, passive: o }), !0);
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
    const { threshold: o = 0.05, rootMargin: i = '0px', onNoObserver: a } = n;
    if (!e) return !1;
    if (!('IntersectionObserver' in window))
        return ('function' == typeof a && a(), !1);
    const r = new IntersectionObserver(
        (e) => {
            e.forEach((e) => {
                e.isIntersecting && (t(e), r.disconnect());
            });
        },
        { threshold: o, rootMargin: i }
    );
    return (r.observe(e), !0);
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
const ie = $('/js/engines/ui-bundle.js'),
    ae = window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
function re() {
    return Q({
        cacheKey: 'theme-engine',
        src: ie,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.ThemeEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentThemeMode: () => R.currentThemeMode,
                setCurrentThemeMode: (e) => {
                    R.currentThemeMode = W.has(e) ? e : 'system';
                },
                themeStorageKey: 'themeMode',
                validThemeModes: Array.from(W),
                getSystemThemeQuery: () => ae,
            }),
        missingApiError: 'theme-engine loaded without API',
        loadError: 'No se pudo cargar theme-engine.js',
        logLabel: 'Theme engine',
    });
}
function se(e) {
    oe(re, (t) => t.setThemeMode(e));
}
let ce = null;
function le(e) {
    (ce || (ce = import('./js/chunks/engagement-CxyxLpwi.js')), ce)
        .then((t) => t.renderPublicReviews(e))
        .catch(() => {});
}
const ue = $('/js/engines/data-bundle.js?v=20260225-data-consolidation1');
function de() {
    return Q({
        cacheKey: 'i18n-engine',
        src: ue,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () =>
            (window.Piel && window.Piel.I18nEngine) || window.PielI18nEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => R.currentLang,
                setCurrentLang: (e) => {
                    R.currentLang = 'en' === e ? 'en' : 'es';
                },
                showToast: V,
                getReviewsCache: () => R.reviewsCache,
                renderPublicReviews: le,
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
async function he(e, t = {}) {
    const n = String(t.method || 'GET').toUpperCase(),
        o = new URLSearchParams({ resource: e });
    t.query &&
        'object' == typeof t.query &&
        Object.entries(t.query).forEach(([e, t]) => {
            null != t && '' !== t && o.set(e, String(t));
        });
    const i = `${N}?${o.toString()}`,
        a = {
            method: n,
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        };
    void 0 !== t.body &&
        ((a.headers['Content-Type'] = 'application/json'),
        (a.body = JSON.stringify(t.body)));
    const s = Number.isFinite(t.timeoutMs)
            ? Math.max(1500, Number(t.timeoutMs))
            : 9e3,
        c = Number.isInteger(t.retries)
            ? Math.max(0, Number(t.retries))
            : 'GET' === n
              ? 1
              : 0,
        l = !0 !== t.silentSlowNotice,
        u = new Set([408, 425, 429, 500, 502, 503, 504]);
    function d(e, t = 0, n = !1, o = '') {
        const i = new Error(e);
        return ((i.status = t), (i.retryable = n), (i.code = o), i);
    }
    let g = null;
    for (let e = 0; e <= c; e += 1) {
        const t = new AbortController(),
            n = setTimeout(() => t.abort(), s);
        let o = null;
        l &&
            (o = setTimeout(() => {
                const e = Date.now();
                e - r > 25e3 &&
                    ((r = e),
                    V(
                        'es' === R.currentLang
                            ? 'Conectando con el servidor...'
                            : 'Connecting to server...',
                        'info'
                    ));
            }, 1200));
        try {
            const e = await fetch(i, { ...a, signal: t.signal }),
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
                    u.has(e.status),
                    'http_error'
                );
            return o;
        } catch (t) {
            const n = (() =>
                t && 'AbortError' === t.name
                    ? d(
                          'es' === R.currentLang
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
            if (((g = n), !(e < c && !0 === n.retryable))) throw n;
            const o = 450 * (e + 1);
            await F(o);
        } finally {
            (clearTimeout(n), null !== o && clearTimeout(o));
        }
    }
    throw g || new Error('No se pudo completar la solicitud');
}
const me = $('/js/engines/booking-utils.js');
function pe() {
    return Q({
        cacheKey: 'booking-utils',
        src: me,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.PaymentGatewayEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                apiRequest: he,
                getCurrentLang: p,
                getPaymentConfig: k,
                setPaymentConfig: v,
                getPaymentConfigLoaded: P,
                setPaymentConfigLoaded: E,
                getPaymentConfigLoadedAt: C,
                setPaymentConfigLoadedAt: S,
                getStripeSdkPromise: M,
                setStripeSdkPromise: A,
                apiEndpoint: N,
                apiRequestTimeoutMs: 9e3,
            }),
        missingApiError: 'payment-gateway-engine loaded without API',
        loadError: 'No se pudo cargar payment-gateway-engine (booking-utils)',
        logLabel: 'Payment gateway engine',
    });
}
async function fe() {
    return oe(pe, (e) => e.loadPaymentConfig());
}
async function ye() {
    return oe(pe, (e) => e.loadStripeSdk());
}
async function we(e) {
    return oe(pe, (t) => t.createPaymentIntent(e));
}
async function be(e) {
    return oe(pe, (t) => t.verifyPaymentIntent(e));
}
let ke = null;
function ve() {
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
            if (ke) return ke;
            const e = ve();
            return e.provider && e.siteKey && e.scriptUrl
                ? ((ke = new Promise((t) => {
                      const n = document.createElement('script');
                      ((n.src = e.scriptUrl),
                          (n.async = !0),
                          (n.defer = !0),
                          (n.onload = () => t(e.provider)),
                          (n.onerror = () => t(null)),
                          document.head.appendChild(n));
                  })),
                  ke)
                : Promise.resolve(null);
        })();
        if (!e) return null;
        const n = ve().siteKey;
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
                    let i = null;
                    const a = () => {
                        try {
                            null !== i &&
                                window.turnstile &&
                                'function' == typeof window.turnstile.remove &&
                                window.turnstile.remove(i);
                        } catch (e) {}
                        e.remove();
                    };
                    try {
                        i = window.turnstile.render(e, {
                            sitekey: n,
                            action: t,
                            callback: (e) => {
                                (a(), o(e || null));
                            },
                            'error-callback': () => {
                                (a(), o(null));
                            },
                        });
                    } catch (e) {
                        (a(), o(null));
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
function Ce() {
    return Q({
        cacheKey: 'data-engine',
        src: Ee,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () => window.Piel && window.Piel.DataEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => R.currentLang,
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
    const e = ee(() => Ce(), { markWarmOnSuccess: !0 });
    (X('#appointmentForm', 'focusin', e, !1),
        X('#appointmentForm', 'pointerdown', e),
        X('#chatbotWidget .chatbot-toggle', 'pointerdown', e),
        te(document.getElementById('citas'), e, {
            threshold: 0.05,
            rootMargin: '260px 0px',
            onNoObserver: e,
        }),
        Y(e, { idleTimeout: 1800, fallbackDelay: 900 }));
}
async function Me(e, t = {}) {
    return ne(Ce, (n) => n.apiRequest(e, t));
}
function Ae(e = '', t = '', n = '') {
    window.Piel &&
    window.Piel.DataEngine &&
    'function' == typeof window.Piel.DataEngine.invalidateBookedSlotsCache
        ? window.Piel.DataEngine.invalidateBookedSlotsCache(e, t, n)
        : ne(Ce, (o) => o.invalidateBookedSlotsCache(e, t, n)).catch(() => {});
}
async function je(e = {}) {
    return ne(Ce, (t) => t.loadAvailabilityData(e));
}
async function Le(e, t = '', n = '') {
    return ne(Ce, (o) => o.getBookedSlots(e, t, n));
}
async function _e(e, t = {}) {
    return ne(Ce, (n) => n.createAppointmentRecord(e, t));
}
async function Te(e) {
    return ne(Ce, (t) => t.createCallbackRecord(e));
}
async function Ie(e) {
    return ne(Ce, (t) => t.createReviewRecord(e));
}
async function Be(e, t = {}) {
    return ne(Ce, (n) => n.uploadTransferProof(e, t));
}
let De = null;
function Re(e = {}) {
    return (De || (De = import('./js/chunks/engagement-CxyxLpwi.js')), De).then(
        (t) => t.loadPublicReviews(e)
    );
}
const Ne = $(
        '/js/engines/analytics-engine.js?v=figo-analytics-20260219-phase2-funnelstep1'
    ),
    Oe = '/api.php?resource=funnel-event',
    xe = new Set([
        'view_booking',
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
    const o = Ke(n.heroVariant, '');
    o &&
        !Object.prototype.hasOwnProperty.call(t, 'ab_variant') &&
        (t.ab_variant = o);
    const i = Ke(n.source, '');
    return (
        i &&
            !Object.prototype.hasOwnProperty.call(t, 'source') &&
            (t.source = i),
        t
    );
}
function Ke(e, t = 'unknown') {
    return null == e
        ? t
        : String(e)
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9_]+/g, '_')
              .replace(/^_+|_+$/g, '')
              .slice(0, 48) || t;
}
function ze(e, t = {}) {
    const n = Ke(e, '');
    if (!xe.has(n)) return;
    if ('file:' === window.location.protocol) return;
    const o = (function (e = {}) {
            const t = {
                source: Ke(
                    e && 'object' == typeof e ? e.source : void 0,
                    'unknown'
                ),
            };
            return e && 'object' == typeof e
                ? (qe.forEach((n) => {
                      'source' !== n &&
                          Object.prototype.hasOwnProperty.call(e, n) &&
                          (t[n] = Ke(e[n], 'unknown'));
                  }),
                  t)
                : t;
        })(We(t)),
        i = [
            n,
            o.step || '',
            o.payment_method || '',
            o.checkout_step || o.step || '',
            o.reason || '',
            o.source || '',
        ].join('|'),
        a = Date.now();
    if (a - (Ue.get(i) || 0) < 1200) return;
    Ue.set(i, a);
    const r = JSON.stringify({ event: n, params: o });
    try {
        if (navigator.sendBeacon) {
            const e = new Blob([r], { type: 'application/json' });
            if (navigator.sendBeacon(Oe, e)) return;
        }
    } catch (e) {}
    fetch(Oe, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: r,
        keepalive: !0,
        credentials: 'same-origin',
    }).catch(() => {});
}
function Fe() {
    return Q({
        cacheKey: 'analytics-engine',
        src: Ne,
        scriptDataAttribute: 'data-analytics-engine',
        resolveModule: () => window.Piel && window.Piel.AnalyticsEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                observeOnceWhenVisible: te,
                loadAvailabilityData: je,
                loadPublicReviews: Re,
                trackEventToServer: ze,
            }),
        missingApiError: 'analytics-engine loaded without API',
        loadError: 'No se pudo cargar analytics-engine.js',
        logLabel: 'Analytics engine',
    });
}
function $e(e, t = {}) {
    const n = We(t);
    (ze(e, n), oe(Fe, (t) => t.trackEvent(e, n)));
}
function Ve(e, t = 'unknown') {
    return null == e
        ? t
        : String(e)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '')
              .slice(0, 64) || t;
}
function Ge(e = 'unknown') {
    oe(Fe, (t) => t.markBookingViewed(e));
}
const He = $('/js/engines/booking-engine.js?v=figo-booking-20260219-mbfix1'),
    Je = $(
        '/js/engines/booking-ui.js?v=figo-booking-ui-20260222-slotservicefix1'
    ),
    Qe = $('/js/engines/booking-utils.js');
let Ye = null;
function Xe(e = !1) {
    (Ye || (Ye = import('./js/chunks/success-modal-0x3ehaiL.js')), Ye)
        .then((t) => t.showSuccessModal(e))
        .catch(() => V('No se pudo abrir la confirmacion de cita.', 'error'));
}
function Ze(e) {
    const t = { ...e };
    return (delete t.casePhotoFiles, delete t.casePhotoUploads, t);
}
async function et(e) {
    const t = Ze(e || {}),
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
            let i = 0;
            return (
                await Promise.all(
                    Array.from({ length: o }, () =>
                        (async () => {
                            for (; i < t.length; ) {
                                const e = i;
                                i += 1;
                                const o = t[e],
                                    a = await Be(o, { retries: 2 });
                                n[e] = {
                                    name: a.transferProofName || o.name || '',
                                    url: a.transferProofUrl || '',
                                    path: a.transferProofPath || '',
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
function tt() {
    return Q({
        cacheKey: 'booking-engine',
        src: He,
        scriptDataAttribute: 'data-booking-engine',
        resolveModule: () => window.Piel && window.Piel.BookingEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                getCurrentLang: () => R.currentLang,
                getCurrentAppointment: () => R.currentAppointment,
                setCurrentAppointment: (e) => {
                    R.currentAppointment = e;
                },
                getCheckoutSession: () => R.checkoutSession,
                setCheckoutSessionActive: (e) => {
                    R.checkoutSession.active = !0 === e;
                },
                startCheckoutSession: ot,
                setCheckoutStep: it,
                completeCheckoutSession: at,
                maybeTrackCheckoutAbandon: rt,
                loadPaymentConfig: fe,
                loadStripeSdk: ye,
                createPaymentIntent: we,
                verifyPaymentIntent: be,
                buildAppointmentPayload: et,
                stripTransientAppointmentFields: Ze,
                createAppointmentRecord: _e,
                uploadTransferProof: Be,
                getCaptchaToken: Pe,
                showSuccessModal: Xe,
                showToast: V,
                debugLog: K,
                trackEvent: $e,
                normalizeAnalyticsLabel: Ve,
            }),
        missingApiError: 'Booking engine loaded without API',
        loadError: 'No se pudo cargar booking-engine.js',
        logLabel: 'Booking engine',
    });
}
function nt() {
    const e = ee(() => tt(), { markWarmOnSuccess: !0 });
    ([
        '.nav-cta[href="#citas"]',
        '.quick-dock-item[href="#citas"]',
        '.hero-actions a[href="#citas"]',
    ].forEach((t) => {
        (X(t, 'mouseenter', e), X(t, 'focus', e, !1), X(t, 'touchstart', e));
    }),
        Y(e, { idleTimeout: 2500, fallbackDelay: 1100 }));
}
function ot(e, t = {}) {
    oe(Fe, (n) => n.startCheckoutSession(e, t));
}
function it(e, t = {}) {
    oe(Fe, (n) => n.setCheckoutStep(e, t));
}
function at(e) {
    oe(Fe, (t) => t.completeCheckoutSession(e));
}
function rt(e = 'unknown') {
    oe(Fe, (t) => t.maybeTrackCheckoutAbandon(e));
}
function st() {
    return Q({
        cacheKey: 'booking-utils-calendar',
        src: Qe,
        scriptDataAttribute: 'data-booking-utils',
        resolveModule: () => window.Piel && window.Piel.BookingCalendarEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.initCalendar),
        missingApiError: 'booking-calendar-engine loaded without API',
        loadError: 'No se pudo cargar booking-calendar-engine',
        logLabel: 'Booking Calendar engine',
    });
}
async function ct(e) {
    return oe(st, (t) => t.updateAvailableTimes(ut(), e));
}
function lt() {
    return ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
}
function ut() {
    return {
        loadAvailabilityData: je,
        getBookedSlots: Le,
        updateAvailableTimes: ct,
        getDefaultTimeSlots: lt,
        showToast: V,
        getCurrentLang: () => R.currentLang,
        getCasePhotoFiles: (e) => {
            const t = e?.querySelector('#casePhotos');
            return t && t.files ? Array.from(t.files) : [];
        },
        validateCasePhotoFiles: dt,
        markBookingViewed: Ge,
        startCheckoutSession: ot,
        setCheckoutStep: it,
        trackEvent: $e,
        normalizeAnalyticsLabel: Ve,
        openPaymentModal: ht,
        debugLog: K,
        setCurrentAppointment: y,
    };
}
function dt(e) {
    const t = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (Array.isArray(e) && 0 !== e.length) {
        if (e.length > 3)
            throw new Error(
                'es' === R.currentLang
                    ? 'Puedes subir máximo 3 fotos.'
                    : 'You can upload up to 3 photos.'
            );
        for (const n of e) {
            if (!n) continue;
            if (n.size > 5242880)
                throw new Error(
                    'es' === R.currentLang
                        ? `Cada foto debe pesar máximo ${Math.round(5)} MB.`
                        : `Each photo must be at most ${Math.round(5)} MB.`
                );
            const e = String(n.type || '').toLowerCase(),
                o = t.has(e),
                i = /\.(jpe?g|png|webp)$/i.test(String(n.name || ''));
            if (!o && !i)
                throw new Error(
                    'es' === R.currentLang
                        ? 'Solo se permiten imágenes JPG, PNG o WEBP.'
                        : 'Only JPG, PNG or WEBP images are allowed.'
                );
        }
    }
}
function gt() {
    const e = ee(() =>
            Q({
                cacheKey: 'booking-ui',
                src: Je,
                scriptDataAttribute: 'data-booking-ui',
                resolveModule: () => window.Piel && window.Piel.BookingUi,
                isModuleReady: (e) => !(!e || 'function' != typeof e.init),
                onModuleReady: (e) => {
                    (e.init(ut()), (window.PielBookingUiReady = !0));
                },
                missingApiError: 'booking-ui loaded without API',
                loadError: 'No se pudo cargar booking-ui.js',
                logLabel: 'Booking UI',
            })
        ),
        t = document.getElementById('citas');
    te(t, e, { threshold: 0.05, rootMargin: '320px 0px', onNoObserver: e });
    const n = document.getElementById('appointmentForm');
    (n &&
        (n.addEventListener('focusin', e, { once: !0 }),
        n.addEventListener('pointerdown', e, { once: !0, passive: !0 }),
        setTimeout(e, 120)),
        (t || n) && Y(e, { idleTimeout: 1800, fallbackDelay: 1100 }));
}
function ht(e) {
    oe(
        tt,
        (t) => t.openPaymentModal(e),
        (e) => {
            V('No se pudo abrir el modulo de pago.', 'error');
        }
    );
}
function mt(e = {}) {
    if (
        window.Piel &&
        window.Piel.BookingEngine &&
        'function' == typeof window.Piel.BookingEngine.closePaymentModal
    )
        return void window.Piel.BookingEngine.closePaymentModal(e);
    const t = e && !0 === e.skipAbandonTrack,
        n = e && 'string' == typeof e.reason ? e.reason : 'modal_close';
    (t || rt(n), (R.checkoutSession.active = !1));
    const o = document.getElementById('paymentModal');
    (o && o.classList.remove('active'), (document.body.style.overflow = ''));
}
async function pt() {
    return oe(
        tt,
        (e) => e.processPayment(),
        (e) => {
            V('No se pudo procesar el pago en este momento.', 'error');
        }
    );
}
let ft = null;
function yt() {
    return (ft || (ft = import('./js/chunks/ui-C4GEqQxn.js')), ft);
}
let wt = null;
function bt() {
    return (wt || (wt = import('./js/chunks/engagement-CxyxLpwi.js')), wt);
}
let kt = null,
    vt = null;
function Pt() {
    return (vt || (vt = import('./js/chunks/reschedule-CiSqh0C5.js')), vt);
}
function Et(e) {
    yt()
        .then((t) => t.toggleMobileMenu(e))
        .catch(() => {});
}
function Ct() {
    yt()
        .then((e) => e.startWebVideo())
        .catch(() => {});
}
function St() {
    yt()
        .then((e) => e.closeVideoModal())
        .catch(() => {});
}
function Mt() {
    bt()
        .then((e) => e.openReviewModal())
        .catch(() => {});
}
function At() {
    bt()
        .then((e) => e.closeReviewModal())
        .catch(() => {});
}
function jt() {
    (kt || (kt = import('./js/chunks/success-modal-0x3ehaiL.js')), kt)
        .then((e) => e.closeSuccessModal())
        .catch(() => {});
}
function Lt() {
    Pt()
        .then((e) => e.closeRescheduleModal())
        .catch(() => {});
}
function _t() {
    Pt()
        .then((e) => e.submitReschedule())
        .catch(() => {});
}
function Tt(e) {
    return async (...t) =>
        (await import('./js/chunks/shell-CjkQnRo5.js'))[e](...t);
}
const It = $('/js/engines/data-bundle.js?v=20260225-data-consolidation1');
function Bt(e) {
    const t = document.getElementById('serviceSelect');
    if (t) {
        ((t.value = e),
            t.dispatchEvent(new Event('change')),
            Ge('service_select'));
        const n = document.getElementById('citas');
        if (n) {
            const e = document.querySelector('.nav')?.offsetHeight || 80,
                t = n.offsetTop - e - 20;
            window.scrollTo({ top: t, behavior: 'smooth' });
        }
    }
}
function Dt() {
    return Q({
        cacheKey: 'action-router-engine',
        src: It,
        scriptDataAttribute: 'data-data-bundle',
        resolveModule: () =>
            (window.Piel && window.Piel.ActionRouterEngine) ||
            window.PielActionRouterEngine,
        isModuleReady: (e) => !(!e || 'function' != typeof e.init),
        onModuleReady: (e) =>
            e.init({
                setThemeMode: se,
                changeLanguage: ge,
                toggleMobileMenu: Et,
                startWebVideo: Ct,
                openReviewModal: Mt,
                closeReviewModal: At,
                closeVideoModal: St,
                closePaymentModal: mt,
                processPayment: pt,
                closeSuccessModal: jt,
                closeRescheduleModal: Lt,
                submitReschedule: _t,
                toggleChatbot: Tt('toggleChatbot'),
                sendChatMessage: Tt('sendChatMessage'),
                handleChatBookingSelection: Tt('handleChatBookingSelection'),
                sendQuickMessage: Tt('sendQuickMessage'),
                minimizeChatbot: Tt('minimizeChatbot'),
                startChatBooking: Tt('startChatBooking'),
                handleChatDateSelect: Tt('handleChatDateSelect'),
                selectService: Bt,
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
                getCurrentLang: () => R.currentLang,
                showToast: V,
                trackEvent: $e,
                cookieConsentKey: 'pa_cookie_consent_v1',
                gaMeasurementId: 'G-GYY8PE5M8W',
            }),
        missingApiError: 'consent-engine loaded without API',
        loadError: 'No se pudo cargar consent-engine.js',
        logLabel: 'Consent engine',
    });
}
let Ot = null,
    xt = null,
    qt = null;
function Ut() {
    return (qt || (qt = import('./js/chunks/shell-CjkQnRo5.js')), qt);
}
let Wt = null,
    Kt = null,
    zt = null,
    Ft = null,
    $t = null;
const Vt = import('./js/chunks/content-loader-BCpccN5h.js');
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
const Gt = 'pa_hero_variant_v1',
    Ht = 'control',
    Jt = 'focus_agenda',
    Qt = [Ht, Jt],
    Yt = {
        [Ht]: {
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
        [Jt]: {
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
let Xt = null,
    Zt = !1;
function en() {
    return (
        Xt ||
            (Xt =
                (function () {
                    try {
                        const e = (function (e) {
                            const t = String(e || '')
                                .trim()
                                .toLowerCase();
                            return Qt.includes(t) ? t : '';
                        })(localStorage.getItem(Gt));
                        if (Qt.includes(e)) return e;
                    } catch (e) {}
                    let e;
                    try {
                        const t = new Uint32Array(1);
                        (window.crypto &&
                        'function' == typeof window.crypto.getRandomValues
                            ? (window.crypto.getRandomValues(t),
                              (e = t[0] % 2 == 0 ? Ht : Jt))
                            : (e = Math.random() < 0.5 ? Ht : Jt),
                            localStorage.setItem(Gt, e));
                    } catch (t) {
                        e = Math.random() < 0.5 ? Ht : Jt;
                    }
                    return e || Ht;
                })() || Ht),
        Xt
    );
}
function tn() {
    const e = en(),
        t = 'en' === R.currentLang ? 'en' : 'es',
        n = Yt[e] || Yt[Ht],
        o = n[t] || n.es,
        i = document.querySelector('.hero-subtitle[data-i18n="hero_subtitle"]');
    i && o.subtitle && (i.textContent = o.subtitle);
    const a = document.querySelector(
        '.hero-actions .btn-primary[data-i18n="hero_cta_primary"]'
    );
    (a && o.primaryCta && (a.textContent = o.primaryCta),
        document.documentElement.setAttribute('data-hero-variant', e));
}
((window.Piel.getExperimentContext = function () {
    const e = en();
    return {
        heroVariant: e,
        source: `hero_${e}`,
        checkoutEntry: e === Ht ? 'booking_form' : `booking_form_${e}`,
    };
}),
    (async function () {
        return null !== Ot
            ? Ot
            : xt ||
                  ((xt = fetch('/api.php?action=features', {
                      method: 'GET',
                      headers: { 'Cache-Control': 'no-cache' },
                  })
                      .then((e) => (e.ok ? e.json() : null))
                      .then(
                          (e) => ((Ot = e && e.ok && e.data ? e.data : {}), Ot)
                      )
                      .catch(() => ((Ot = {}), Ot))),
                  xt);
    })().then((e) => {
        window.Piel.features = e;
    }),
    (window.Piel.isFeatureEnabled = function (e) {
        return !!Ot && Boolean(Ot[e]);
    }));
const nn = $('/styles-deferred.css?v=ui-20260221-deferred18-fullcssfix1');
let on = null,
    an = !1;
let rn = !1;
(document.addEventListener('DOMContentLoaded', function () {
    (document.querySelectorAll('a[href^="URL_"]').forEach((e) => {
        (e.removeAttribute('href'),
            e.setAttribute('aria-disabled', 'true'),
            e.classList.add('is-disabled-link'));
    }),
        Nt(),
        rn ||
            ((rn = !0),
            document.addEventListener('click', async function (e) {
                const t = e.target instanceof Element ? e.target : null;
                if (!t) return;
                const n = t.closest('[data-action]');
                if (!n) return;
                const o = String(n.getAttribute('data-action') || '').trim(),
                    i = n.getAttribute('data-value') || '';
                switch (o) {
                    case 'toggle-chatbot':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Ut()).toggleChatbot());
                        break;
                    case 'minimize-chat':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Ut()).minimizeChatbot());
                        break;
                    case 'send-chat-message':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Ut()).sendChatMessage());
                        break;
                    case 'quick-message':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Ut()).sendQuickMessage(i));
                        break;
                    case 'chat-booking':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Ut()).handleChatBookingSelection(i));
                        break;
                    case 'start-booking':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (await Ut()).startChatBooking());
                        break;
                    case 'select-service':
                        (e.preventDefault(),
                            e.stopImmediatePropagation(),
                            (function (e) {
                                const t =
                                    document.getElementById('serviceSelect');
                                if (t) {
                                    ((t.value = e),
                                        t.dispatchEvent(new Event('change')),
                                        Ge('service_select'));
                                    const n = document.getElementById('citas');
                                    if (n) {
                                        const e =
                                                document.querySelector('.nav')
                                                    ?.offsetHeight || 80,
                                            t = n.offsetTop - e - 20;
                                        window.scrollTo({
                                            top: t,
                                            behavior: 'smooth',
                                        });
                                    }
                                }
                            })(i));
                }
            }),
            document.addEventListener('change', async function (e) {
                const t = e.target instanceof Element ? e.target : null;
                t &&
                    t.closest('[data-action="chat-date-select"]') &&
                    (await Ut()).handleChatDateSelect(t.value);
            })),
        oe(
            Dt,
            () => {},
            (e) => {}
        ),
        an ||
            'file:' === window.location.protocol ||
            ((an = !0),
            Y(
                () => {
                    (document.querySelector(
                        'link[data-deferred-stylesheet="true"], link[rel="stylesheet"][href*="styles-deferred.css"]'
                    )
                        ? Promise.resolve(!0)
                        : on ||
                          ((on = new Promise((e, t) => {
                              const n = document.createElement('link');
                              ((n.rel = 'stylesheet'),
                                  (n.href = nn),
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
                              throw ((on = null), e);
                          })),
                          on)
                    ).catch(() => {});
                },
                {
                    idleTimeout: 1200,
                    fallbackDelay: 160,
                    skipOnConstrained: !1,
                    constrainedDelay: 900,
                }
            )),
        oe(re, (e) => e.initThemeMode()),
        ge(R.currentLang)
            .then(() => tn())
            .catch(() => tn()),
        en(),
        tn(),
        (function () {
            const e = (e, t) => {
                const n = document.querySelector(e);
                n &&
                    'true' !== n.dataset.heroExperimentBound &&
                    ((n.dataset.heroExperimentBound = 'true'),
                    n.addEventListener('click', () => {
                        $e('booking_step_completed', {
                            source: `hero_${en()}`,
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
                Zt ||
                    ((Zt = !0),
                    $e('booking_step_completed', {
                        source: `hero_${en()}`,
                        step: 'hero_variant_assigned',
                    })));
        })(),
        document.addEventListener('piel:language-changed', tn),
        oe(Nt, (e) => e.initGA4()),
        oe(Fe, (e) => e.initBookingFunnelObserver()),
        oe(Fe, (e) => e.initDeferredSectionPrefetch()),
        Vt.then(({ loadDeferredContent: e }) => e())
            .catch(() => !1)
            .then(() => {
                oe(Nt, (e) => e.initCookieBanner());
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
                            nt(),
                            gt(),
                            Ut()
                                .then((e) => {
                                    (e.initChatUiEngineWarmup(),
                                        e.initChatWidgetEngineWarmup());
                                })
                                .catch(() => {}));
                    }),
                    t = Z(() => {
                        ((Wt ||
                            (Wt = import('./js/chunks/engagement-CxyxLpwi.js')),
                        Wt)
                            .then((e) => {
                                (e.initReviewsEngineWarmup(),
                                    e.initEngagementFormsEngineWarmup());
                            })
                            .catch(() => {}),
                            (Kt ||
                                (Kt =
                                    import('./js/chunks/gallery-CbqHlD9_.js')),
                            Kt)
                                .then((e) => e.initGalleryInteractionsWarmup())
                                .catch(() => {}),
                            Ut()
                                .then((e) => {
                                    (e.initChatEngineWarmup(),
                                        e.initChatBookingEngineWarmup());
                                })
                                .catch(() => {}),
                            (zt || (zt = import('./js/chunks/ui-C4GEqQxn.js')),
                            zt)
                                .then((e) => {
                                    (e.initUiEffectsWarmup(),
                                        e.initModalUxEngineWarmup());
                                })
                                .catch(() => {}),
                            (Ft ||
                                (Ft =
                                    import('./js/chunks/reschedule-CiSqh0C5.js')),
                            Ft)
                                .then((e) => e.initRescheduleEngineWarmup())
                                .catch(() => {}),
                            ($t ||
                                ($t =
                                    import('./js/chunks/success-modal-0x3ehaiL.js')),
                            $t)
                                .then((e) => e.initSuccessModalEngineWarmup())
                                .catch(() => {}));
                    }),
                    n = Z(() => {
                        (e(), t(), gt());
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
                        (await Ut()).handleChatKeypress(e);
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
                                .querySelectorAll('a[href="#citas"]')
                                .forEach(function (t) {
                                    'booking-btn' !== t.id && e(t);
                                }));
                    })());
            }),
        window.addEventListener('pagehide', () => {
            !(function (e = 'unknown') {
                oe(Fe, (t) => t.maybeTrackCheckoutAbandon(e));
            })('page_hide');
        }));
    const e = document.querySelector('.nav');
    (document.addEventListener('click', function (t) {
        const n = t.target instanceof Element ? t.target : null;
        if (!n) return;
        const o = n.closest('a[href^="#"]');
        if (!o) return;
        const i = o.getAttribute('href');
        if (!i || '#' === i) return;
        const a = document.querySelector(i);
        if (!a) return;
        t.preventDefault();
        const r = e ? e.offsetHeight : 0,
            s = a.offsetTop - r - 20;
        ('#citas' === i && Ge(`cta_click_${en()}`),
            window.scrollTo({ top: s, behavior: 'smooth' }));
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
            ($e('whatsapp_click', { source: o }),
                (n.closest('#chatbotContainer') ||
                    n.closest('#chatbotWidget')) &&
                    $e('chat_handoff_whatsapp', { source: o }));
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
                            i = n.dataset.srcset;
                        (i && (n.srcset = i),
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
        (nt(), Se());
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
    ot as B,
    x as C,
    U as D,
    Le as E,
    je as F,
    te as G,
    b as H,
    w as I,
    Ie as J,
    Te as K,
    z as L,
    G as M,
    Me as N,
    mt as O,
    Ae as P,
    Y as a,
    X as b,
    ee as c,
    L as d,
    $ as e,
    q as f,
    j as g,
    O as h,
    B as i,
    I as j,
    f as k,
    Q as l,
    T as m,
    _ as n,
    K as o,
    R as p,
    y as q,
    oe as r,
    V as s,
    $e as t,
    p as u,
    ht as v,
    ne as w,
    Pe as x,
    _e as y,
    at as z,
};
