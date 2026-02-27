!(function () {
    'use strict';
    const e = 'queueDisplayBellMuted',
        n = {
            lastCalledSignature: '',
            audioContext: null,
            pollingId: 0,
            clockId: 0,
            pollingEnabled: !1,
            failureStreak: 0,
            refreshBusy: !1,
            manualRefreshBusy: !1,
            lastHealthySyncAt: 0,
            bellMuted: !1,
        };
    function t(e) {
        return document.getElementById(e);
    }
    function a(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function i(e, n) {
        const a = t('displayConnectionState');
        if (!a) return;
        const i = String(e || 'live').toLowerCase(),
            o = {
                live: 'Conectado',
                reconnecting: 'Reconectando',
                offline: 'Sin conexion',
                paused: 'En pausa',
            };
        ((a.dataset.state = i),
            (a.textContent = String(n || '').trim() || o[i] || o.live));
    }
    function o() {
        let e = t('displayOpsHint');
        if (e) return e;
        const n = t('displayUpdatedAt');
        return n?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displayOpsHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function l(e) {
        const n = o();
        n && (n.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function s() {
        let e = t('displayManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const n = document.querySelector('.display-clock-wrap');
        return n
            ? ((e = document.createElement('button')),
              (e.id = 'displayManualRefreshBtn'),
              (e.type = 'button'),
              (e.textContent = 'Refrescar panel'),
              (e.style.justifySelf = 'end'),
              (e.style.border = '1px solid var(--border)'),
              (e.style.borderRadius = '0.6rem'),
              (e.style.padding = '0.34rem 0.55rem'),
              (e.style.background = 'rgb(24 39 67 / 64%)'),
              (e.style.color = 'var(--text)'),
              (e.style.cursor = 'pointer'),
              n.appendChild(e),
              e)
            : null;
    }
    function r(e) {
        const n = s();
        n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(e)),
            (n.textContent = e ? 'Refrescando...' : 'Refrescar panel'));
    }
    function c() {
        let e = t('displayBellToggleBtn');
        if (e instanceof HTMLButtonElement) return e;
        const n = document.querySelector('.display-clock-wrap');
        return n
            ? ((e = document.createElement('button')),
              (e.id = 'displayBellToggleBtn'),
              (e.type = 'button'),
              (e.style.justifySelf = 'end'),
              (e.style.border = '1px solid var(--border)'),
              (e.style.borderRadius = '0.6rem'),
              (e.style.padding = '0.34rem 0.55rem'),
              (e.style.background = 'rgb(24 39 67 / 64%)'),
              (e.style.color = 'var(--text)'),
              (e.style.cursor = 'pointer'),
              (e.style.fontSize = '0.8rem'),
              (e.style.fontWeight = '600'),
              n.appendChild(e),
              e)
            : null;
    }
    function d() {
        const e = c();
        e instanceof HTMLButtonElement &&
            ((e.textContent = n.bellMuted
                ? 'Campanilla: Off'
                : 'Campanilla: On'),
            (e.dataset.state = n.bellMuted ? 'muted' : 'enabled'),
            e.setAttribute('aria-pressed', String(n.bellMuted)),
            (e.title = n.bellMuted
                ? 'Campanilla en silencio'
                : 'Campanilla activa'));
    }
    function u() {
        !(function (t, { announce: a = !1 } = {}) {
            ((n.bellMuted = Boolean(t)),
                localStorage.setItem(e, n.bellMuted ? '1' : '0'),
                d(),
                a &&
                    l(
                        n.bellMuted
                            ? 'Campanilla en silencio. Puedes reactivarla con Alt+Shift+M.'
                            : 'Campanilla activa para nuevos llamados.'
                    ));
        })(!n.bellMuted, { announce: !0 });
    }
    function p(e) {
        const n = Math.max(0, Number(e || 0)),
            t = Math.round(n / 1e3);
        if (t < 60) return `${t}s`;
        const a = Math.floor(t / 60),
            i = t % 60;
        return i <= 0 ? `${a}m` : `${a}m ${i}s`;
    }
    function f() {
        return n.lastHealthySyncAt
            ? `hace ${p(Date.now() - n.lastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function m(e, n, i) {
        const o = t(e);
        o &&
            (o.innerHTML = n
                ? `\n        <article class="display-called-card">\n            <h3>${i}</h3>\n            <strong>${a(n.ticketCode || '--')}</strong>\n            <span>${a(n.patientInitials || '--')}</span>\n        </article>\n    `
                : `\n            <article class="display-called-card is-empty">\n                <h3>${i}</h3>\n                <p>Sin llamado activo</p>\n            </article>\n        `);
    }
    function y() {
        const e = Math.max(0, Number(n.failureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function g() {
        n.pollingId && (window.clearTimeout(n.pollingId), (n.pollingId = 0));
    }
    function h({ immediate: e = !1 } = {}) {
        if ((g(), !n.pollingEnabled)) return;
        const t = e ? 0 : y();
        n.pollingId = window.setTimeout(() => {
            w();
        }, t);
    }
    async function S() {
        if (n.refreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        n.refreshBusy = !0;
        try {
            const e =
                (
                    await (async function () {
                        const e = new URLSearchParams();
                        (e.set('resource', 'queue-state'),
                            e.set('t', String(Date.now())));
                        const n = await fetch(`/api.php?${e.toString()}`, {
                                method: 'GET',
                                credentials: 'same-origin',
                                headers: { Accept: 'application/json' },
                            }),
                            t = await n.text();
                        let a;
                        try {
                            a = t ? JSON.parse(t) : {};
                        } catch (e) {
                            throw new Error('Respuesta JSON invalida');
                        }
                        if (!n.ok || !1 === a.ok)
                            throw new Error(a.error || `HTTP ${n.status}`);
                        return a;
                    })()
                ).data || {};
            !(function (e) {
                const i = Array.isArray(e?.callingNow) ? e.callingNow : [],
                    o = { 1: null, 2: null };
                for (const e of i) {
                    const n = Number(e?.assignedConsultorio || 0);
                    (1 !== n && 2 !== n) || (o[n] = e);
                }
                (m('displayConsultorio1', o[1], 'Consultorio 1'),
                    m('displayConsultorio2', o[2], 'Consultorio 2'),
                    (function (e) {
                        const n = t('displayNextList');
                        n &&
                            (Array.isArray(e) && 0 !== e.length
                                ? (n.innerHTML = e
                                      .slice(0, 8)
                                      .map(
                                          (e) =>
                                              `\n                <li>\n                    <span class="next-code">${a(e.ticketCode || '--')}</span>\n                    <span class="next-initials">${a(e.patientInitials || '--')}</span>\n                    <span class="next-position">#${a(e.position || '-')}</span>\n                </li>\n            `
                                      )
                                      .join(''))
                                : (n.innerHTML =
                                      '<li class="display-empty">No hay turnos pendientes.</li>'));
                    })(e?.nextTickets || []),
                    (function (e) {
                        const n = t('displayUpdatedAt');
                        if (!n) return;
                        const a = Date.parse(String(e?.updatedAt || ''));
                        Number.isFinite(a)
                            ? (n.textContent = `Actualizado ${new Date(a).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
                            : (n.textContent = 'Actualizacion pendiente');
                    })(e));
                const l = (function (e) {
                    return Array.isArray(e) && 0 !== e.length
                        ? e
                              .map(
                                  (e) =>
                                      `${String(e.assignedConsultorio || '-')}:${String(e.ticketCode || '')}:${String(e.calledAt || '')}`
                              )
                              .sort()
                              .join('|')
                        : '';
                })(i);
                (l &&
                    l !== n.lastCalledSignature &&
                    (function () {
                        if (!n.bellMuted)
                            try {
                                n.audioContext ||
                                    (n.audioContext = new (
                                        window.AudioContext ||
                                        window.webkitAudioContext
                                    )());
                                const e = n.audioContext,
                                    t = e.currentTime,
                                    a = e.createOscillator(),
                                    i = e.createGain();
                                ((a.type = 'sine'),
                                    a.frequency.setValueAtTime(932, t),
                                    i.gain.setValueAtTime(1e-4, t),
                                    i.gain.exponentialRampToValueAtTime(
                                        0.16,
                                        t + 0.02
                                    ),
                                    i.gain.exponentialRampToValueAtTime(
                                        1e-4,
                                        t + 0.22
                                    ),
                                    a.connect(i),
                                    i.connect(e.destination),
                                    a.start(t),
                                    a.stop(t + 0.24));
                            } catch (e) {}
                    })(),
                    (n.lastCalledSignature = l));
            })(e);
            const i = (function (e) {
                const n = Date.parse(String(e?.updatedAt || ''));
                if (!Number.isFinite(n))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const t = Math.max(0, Date.now() - n);
                return { stale: t >= 3e4, missingTimestamp: !1, ageMs: t };
            })(e);
            return {
                ok: !0,
                stale: Boolean(i.stale),
                missingTimestamp: Boolean(i.missingTimestamp),
                ageMs: i.ageMs,
            };
        } catch (e) {
            const n = t('displayNextList');
            return (
                n &&
                    (n.innerHTML = `<li class="display-empty">Sin conexion: ${a(e.message)}</li>`),
                {
                    ok: !1,
                    stale: !1,
                    reason: 'fetch_error',
                    errorMessage: e.message,
                }
            );
        } finally {
            n.refreshBusy = !1;
        }
    }
    async function w() {
        if (!n.pollingEnabled) return;
        if (document.hidden)
            return (
                i('paused', 'En pausa (pestana oculta)'),
                l('Pantalla en pausa por pestana oculta.'),
                void h()
            );
        if (!1 === navigator.onLine)
            return (
                (n.failureStreak += 1),
                i('offline', 'Sin conexion'),
                l(
                    'Sin conexion. Mantener llamado por voz desde recepcion hasta recuperar enlace.'
                ),
                void h()
            );
        const e = await S();
        if (e.ok && !e.stale)
            ((n.failureStreak = 0),
                (n.lastHealthySyncAt = Date.now()),
                i('live', 'Conectado'),
                l(`Panel estable (${f()}).`));
        else if (e.ok && e.stale) {
            n.failureStreak += 1;
            const t = p(e.ageMs || 0);
            (i('reconnecting', `Watchdog: datos estancados ${t}`),
                l(`Datos estancados ${t}. Verifica fuente de cola.`));
        } else {
            n.failureStreak += 1;
            const e = Math.max(1, Math.ceil(y() / 1e3));
            (i('reconnecting', `Reconectando en ${e}s`),
                l(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        h();
    }
    async function v() {
        if (!n.manualRefreshBusy) {
            ((n.manualRefreshBusy = !0),
                r(!0),
                i('reconnecting', 'Refrescando panel...'));
            try {
                const e = await S();
                if (e.ok && !e.stale)
                    return (
                        (n.failureStreak = 0),
                        (n.lastHealthySyncAt = Date.now()),
                        i('live', 'Conectado'),
                        void l(`Sincronizacion manual exitosa (${f()}).`)
                    );
                if (e.ok && e.stale) {
                    const n = p(e.ageMs || 0);
                    return (
                        i('reconnecting', `Watchdog: datos estancados ${n}`),
                        void l(`Persisten datos estancados (${n}).`)
                    );
                }
                const t = Math.max(1, Math.ceil(y() / 1e3));
                (i(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion'
                        : `Reconectando en ${t}s`
                ),
                    l(
                        !1 === navigator.onLine
                            ? 'Sin internet. Llamado manual temporal.'
                            : `Refresh manual sin exito. Reintento automatico en ${t}s.`
                    ));
            } finally {
                ((n.manualRefreshBusy = !1), r(!1));
            }
        }
    }
    function C({ immediate: e = !0 } = {}) {
        if (((n.pollingEnabled = !0), e))
            return (i('live', 'Sincronizando...'), void w());
        h();
    }
    function M({ reason: e = 'paused' } = {}) {
        ((n.pollingEnabled = !1), (n.failureStreak = 0), g());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (i('offline', 'Sin conexion'),
              void l('Sin conexion. Mantener protocolo manual de llamados.'))
            : 'hidden' === t
              ? (i('paused', 'En pausa (pestana oculta)'),
                void l('Pantalla oculta. Reanuda al volver al frente.'))
              : (i('paused', 'En pausa'), void l('Sincronizacion pausada.'));
    }
    function b() {
        const e = t('displayClock');
        e &&
            (e.textContent = new Date().toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
            }));
    }
    document.addEventListener('DOMContentLoaded', function () {
        (!(function () {
            const t = localStorage.getItem(e);
            n.bellMuted = '1' === t;
        })(),
            b(),
            (n.clockId = window.setInterval(b, 1e3)),
            o());
        const t = s();
        t instanceof HTMLButtonElement &&
            t.addEventListener('click', () => {
                v();
            });
        const a = c();
        (a instanceof HTMLButtonElement &&
            a.addEventListener('click', () => {
                u();
            }),
            d(),
            i('paused', 'Sincronizacion lista'),
            l('Esperando primera sincronizacion...'),
            C({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? M({ reason: 'hidden' })
                    : C({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                C({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                M({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                (M({ reason: 'paused' }),
                    n.clockId &&
                        (window.clearInterval(n.clockId), (n.clockId = 0)));
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const n = String(e.code || '').toLowerCase();
                if ('keyr' === n) return (e.preventDefault(), void v());
                'keym' === n && (e.preventDefault(), u());
            }));
    });
})();
