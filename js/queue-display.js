!(function () {
    'use strict';
    const e = 'queueDisplayBellMuted',
        t = 'queueDisplayLastSnapshot',
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
            lastSnapshot: null,
            connectionState: 'paused',
        };
    function a(e) {
        return document.getElementById(e);
    }
    function o(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function i(e, t) {
        const o = a('displayConnectionState');
        if (!o) return;
        const i = String(e || 'live').toLowerCase(),
            l = {
                live: 'Conectado',
                reconnecting: 'Reconectando',
                offline: 'Sin conexion',
                paused: 'En pausa',
            };
        ((n.connectionState = i),
            (o.dataset.state = i),
            (o.textContent = String(t || '').trim() || l[i] || l.live));
    }
    function l() {
        let e = a('displayOpsHint');
        if (e) return e;
        const t = a('displayUpdatedAt');
        return t?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displayOpsHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function s(e) {
        const t = l();
        t && (t.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function r() {
        let e = a('displayManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = document.querySelector('.display-clock-wrap');
        return t
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
              t.appendChild(e),
              e)
            : null;
    }
    function c(e) {
        const t = r();
        t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e)),
            (t.textContent = e ? 'Refrescando...' : 'Refrescar panel'));
    }
    function d() {
        let e = a('displayBellToggleBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = document.querySelector('.display-clock-wrap');
        return t
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
              t.appendChild(e),
              e)
            : null;
    }
    function u() {
        const e = d();
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
    function p() {
        !(function (t, { announce: a = !1 } = {}) {
            ((n.bellMuted = Boolean(t)),
                localStorage.setItem(e, n.bellMuted ? '1' : '0'),
                u(),
                a &&
                    s(
                        n.bellMuted
                            ? 'Campanilla en silencio. Puedes reactivarla con Alt+Shift+M.'
                            : 'Campanilla activa para nuevos llamados.'
                    ));
        })(!n.bellMuted, { announce: !0 });
    }
    function f(e) {
        const t = e && 'object' == typeof e ? e : {};
        return {
            updatedAt: String(t.updatedAt || new Date().toISOString()),
            callingNow: Array.isArray(t.callingNow) ? t.callingNow : [],
            nextTickets: Array.isArray(t.nextTickets) ? t.nextTickets : [],
        };
    }
    function m(e, { mode: t = 'restore' } = {}) {
        if (!e?.data) return !1;
        b(e.data);
        const n = h(
            Math.max(0, Date.now() - Date.parse(String(e.savedAt || '')))
        );
        return (
            i('reconnecting', 'Respaldo local activo'),
            s(
                'startup' === t
                    ? `Mostrando respaldo local (${n}) mientras conecta.`
                    : `Sin backend. Mostrando ultimo estado local (${n}).`
            ),
            !0
        );
    }
    function y() {
        let e = a('displaySnapshotHint');
        if (e instanceof HTMLElement) return e;
        const t = l();
        return t?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displaySnapshotHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Respaldo: sin datos locales'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function g() {
        const e = y();
        if (!(e instanceof HTMLElement)) return;
        if (!n.lastSnapshot?.savedAt)
            return void (e.textContent = 'Respaldo: sin datos locales');
        const t = Date.parse(String(n.lastSnapshot.savedAt || ''));
        Number.isFinite(t)
            ? (e.textContent = `Respaldo: ${h(Date.now() - t)} de antiguedad`)
            : (e.textContent = 'Respaldo: sin datos locales');
    }
    function S({ announce: e = !1 } = {}) {
        n.lastSnapshot = null;
        try {
            localStorage.removeItem(t);
        } catch (e) {}
        (g(),
            'live' !== n.connectionState &&
                ((function (e = 'No hay turnos pendientes.') {
                    (C('displayConsultorio1', null, 'Consultorio 1'),
                        C('displayConsultorio2', null, 'Consultorio 2'));
                    const t = a('displayNextList');
                    t &&
                        (t.innerHTML = `<li class="display-empty">${o(e)}</li>`);
                })('Sin respaldo local disponible.'),
                !1 === navigator.onLine
                    ? i('offline', 'Sin conexion')
                    : i('reconnecting', 'Sin respaldo local')),
            e &&
                s(
                    'Respaldo local limpiado. Esperando datos en vivo del backend.'
                ));
    }
    function h(e) {
        const t = Math.max(0, Number(e || 0)),
            n = Math.round(t / 1e3);
        if (n < 60) return `${n}s`;
        const a = Math.floor(n / 60),
            o = n % 60;
        return o <= 0 ? `${a}m` : `${a}m ${o}s`;
    }
    function v() {
        return n.lastHealthySyncAt
            ? `hace ${h(Date.now() - n.lastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function C(e, t, n) {
        const i = a(e);
        i &&
            (i.innerHTML = t
                ? `\n        <article class="display-called-card">\n            <h3>${n}</h3>\n            <strong>${o(t.ticketCode || '--')}</strong>\n            <span>${o(t.patientInitials || '--')}</span>\n        </article>\n    `
                : `\n            <article class="display-called-card is-empty">\n                <h3>${n}</h3>\n                <p>Sin llamado activo</p>\n            </article>\n        `);
    }
    function b(e) {
        const t = Array.isArray(e?.callingNow) ? e.callingNow : [],
            i = { 1: null, 2: null };
        for (const e of t) {
            const t = Number(e?.assignedConsultorio || 0);
            (1 !== t && 2 !== t) || (i[t] = e);
        }
        (C('displayConsultorio1', i[1], 'Consultorio 1'),
            C('displayConsultorio2', i[2], 'Consultorio 2'),
            (function (e) {
                const t = a('displayNextList');
                t &&
                    (Array.isArray(e) && 0 !== e.length
                        ? (t.innerHTML = e
                              .slice(0, 8)
                              .map(
                                  (e) =>
                                      `\n                <li>\n                    <span class="next-code">${o(e.ticketCode || '--')}</span>\n                    <span class="next-initials">${o(e.patientInitials || '--')}</span>\n                    <span class="next-position">#${o(e.position || '-')}</span>\n                </li>\n            `
                              )
                              .join(''))
                        : (t.innerHTML =
                              '<li class="display-empty">No hay turnos pendientes.</li>'));
            })(e?.nextTickets || []),
            (function (e) {
                const t = a('displayUpdatedAt');
                if (!t) return;
                const n = Date.parse(String(e?.updatedAt || ''));
                Number.isFinite(n)
                    ? (t.textContent = `Actualizado ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
                    : (t.textContent = 'Actualizacion pendiente');
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
        })(t);
        (l &&
            l !== n.lastCalledSignature &&
            (function () {
                if (!n.bellMuted)
                    try {
                        n.audioContext ||
                            (n.audioContext = new (
                                window.AudioContext || window.webkitAudioContext
                            )());
                        const e = n.audioContext,
                            t = e.currentTime,
                            a = e.createOscillator(),
                            o = e.createGain();
                        ((a.type = 'sine'),
                            a.frequency.setValueAtTime(932, t),
                            o.gain.setValueAtTime(1e-4, t),
                            o.gain.exponentialRampToValueAtTime(0.16, t + 0.02),
                            o.gain.exponentialRampToValueAtTime(1e-4, t + 0.22),
                            a.connect(o),
                            o.connect(e.destination),
                            a.start(t),
                            a.stop(t + 0.24));
                    } catch (e) {}
            })(),
            (n.lastCalledSignature = l));
    }
    function w() {
        const e = Math.max(0, Number(n.failureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function x() {
        n.pollingId && (window.clearTimeout(n.pollingId), (n.pollingId = 0));
    }
    function M({ immediate: e = !1 } = {}) {
        if ((x(), !n.pollingEnabled)) return;
        const t = e ? 0 : w();
        n.pollingId = window.setTimeout(() => {
            k();
        }, t);
    }
    async function E() {
        if (n.refreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        n.refreshBusy = !0;
        try {
            const e =
                (
                    await (async function () {
                        const e = new URLSearchParams();
                        (e.set('resource', 'queue-state'),
                            e.set('t', String(Date.now())));
                        const t = await fetch(`/api.php?${e.toString()}`, {
                                method: 'GET',
                                credentials: 'same-origin',
                                headers: { Accept: 'application/json' },
                            }),
                            n = await t.text();
                        let a;
                        try {
                            a = n ? JSON.parse(n) : {};
                        } catch (e) {
                            throw new Error('Respuesta JSON invalida');
                        }
                        if (!t.ok || !1 === a.ok)
                            throw new Error(a.error || `HTTP ${t.status}`);
                        return a;
                    })()
                ).data || {};
            (b(e),
                (function (e) {
                    const a = f(e),
                        o = { savedAt: new Date().toISOString(), data: a };
                    n.lastSnapshot = o;
                    try {
                        localStorage.setItem(t, JSON.stringify(o));
                    } catch (e) {}
                    g();
                })(e));
            const a = (function (e) {
                const t = Date.parse(String(e?.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const n = Math.max(0, Date.now() - t);
                return { stale: n >= 3e4, missingTimestamp: !1, ageMs: n };
            })(e);
            return {
                ok: !0,
                stale: Boolean(a.stale),
                missingTimestamp: Boolean(a.missingTimestamp),
                ageMs: a.ageMs,
                usedSnapshot: !1,
            };
        } catch (e) {
            const t = m(n.lastSnapshot, { mode: 'restore' });
            if (!t) {
                const t = a('displayNextList');
                t &&
                    (t.innerHTML = `<li class="display-empty">Sin conexion: ${o(e.message)}</li>`);
            }
            return {
                ok: !1,
                stale: !1,
                reason: 'fetch_error',
                errorMessage: e.message,
                usedSnapshot: t,
            };
        } finally {
            n.refreshBusy = !1;
        }
    }
    async function k() {
        if (!n.pollingEnabled) return;
        if (document.hidden)
            return (
                i('paused', 'En pausa (pestana oculta)'),
                s('Pantalla en pausa por pestana oculta.'),
                void M()
            );
        if (!1 === navigator.onLine)
            return (
                (n.failureStreak += 1),
                m(n.lastSnapshot, { mode: 'restore' }) ||
                    (i('offline', 'Sin conexion'),
                    s(
                        'Sin conexion. Mantener llamado por voz desde recepcion hasta recuperar enlace.'
                    )),
                void M()
            );
        const e = await E();
        if (e.ok && !e.stale)
            ((n.failureStreak = 0),
                (n.lastHealthySyncAt = Date.now()),
                i('live', 'Conectado'),
                s(`Panel estable (${v()}).`));
        else if (e.ok && e.stale) {
            n.failureStreak += 1;
            const t = h(e.ageMs || 0);
            (i('reconnecting', `Watchdog: datos estancados ${t}`),
                s(`Datos estancados ${t}. Verifica fuente de cola.`));
        } else {
            if (((n.failureStreak += 1), e.usedSnapshot)) return void M();
            const t = Math.max(1, Math.ceil(w() / 1e3));
            (i('reconnecting', `Reconectando en ${t}s`),
                s(`Conexion inestable. Reintento automatico en ${t}s.`));
        }
        M();
    }
    async function A() {
        if (!n.manualRefreshBusy) {
            ((n.manualRefreshBusy = !0),
                c(!0),
                i('reconnecting', 'Refrescando panel...'));
            try {
                const e = await E();
                if (e.ok && !e.stale)
                    return (
                        (n.failureStreak = 0),
                        (n.lastHealthySyncAt = Date.now()),
                        i('live', 'Conectado'),
                        void s(`Sincronizacion manual exitosa (${v()}).`)
                    );
                if (e.ok && e.stale) {
                    const t = h(e.ageMs || 0);
                    return (
                        i('reconnecting', `Watchdog: datos estancados ${t}`),
                        void s(`Persisten datos estancados (${t}).`)
                    );
                }
                if (e.usedSnapshot) return;
                const t = Math.max(1, Math.ceil(w() / 1e3));
                (i(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion'
                        : `Reconectando en ${t}s`
                ),
                    s(
                        !1 === navigator.onLine
                            ? 'Sin internet. Llamado manual temporal.'
                            : `Refresh manual sin exito. Reintento automatico en ${t}s.`
                    ));
            } finally {
                ((n.manualRefreshBusy = !1), c(!1));
            }
        }
    }
    function L({ immediate: e = !0 } = {}) {
        if (((n.pollingEnabled = !0), e))
            return (i('live', 'Sincronizando...'), void k());
        M();
    }
    function T({ reason: e = 'paused' } = {}) {
        ((n.pollingEnabled = !1), (n.failureStreak = 0), x());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (i('offline', 'Sin conexion'),
              void s('Sin conexion. Mantener protocolo manual de llamados.'))
            : 'hidden' === t
              ? (i('paused', 'En pausa (pestana oculta)'),
                void s('Pantalla oculta. Reanuda al volver al frente.'))
              : (i('paused', 'En pausa'), void s('Sincronizacion pausada.'));
    }
    function $() {
        const e = a('displayClock');
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
            (function () {
                n.lastSnapshot = null;
                try {
                    const e = localStorage.getItem(t);
                    if (!e) return (g(), null);
                    const a = JSON.parse(e);
                    if (!a || 'object' != typeof a) return (g(), null);
                    const o = Date.parse(String(a.savedAt || ''));
                    if (!Number.isFinite(o)) return (g(), null);
                    if (Date.now() - o > 216e5) return (g(), null);
                    const i = f(a.data || {}),
                        l = { savedAt: new Date(o).toISOString(), data: i };
                    return ((n.lastSnapshot = l), g(), l);
                } catch (e) {
                    return (g(), null);
                }
            })(),
            $(),
            (n.clockId = window.setInterval($, 1e3)),
            l(),
            y());
        const o = r();
        o instanceof HTMLButtonElement &&
            o.addEventListener('click', () => {
                A();
            });
        const c = d();
        c instanceof HTMLButtonElement &&
            c.addEventListener('click', () => {
                p();
            });
        const h = (function () {
            let e = a('displaySnapshotClearBtn');
            if (e instanceof HTMLButtonElement) return e;
            const t = document.querySelector('.display-clock-wrap');
            return t
                ? ((e = document.createElement('button')),
                  (e.id = 'displaySnapshotClearBtn'),
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
                  (e.textContent = 'Limpiar respaldo'),
                  t.appendChild(e),
                  e)
                : null;
        })();
        (h instanceof HTMLButtonElement &&
            h.addEventListener('click', () => {
                S({ announce: !0 });
            }),
            u(),
            g(),
            i('paused', 'Sincronizacion lista'),
            m(n.lastSnapshot, { mode: 'startup' }) ||
                s('Esperando primera sincronizacion...'),
            L({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? T({ reason: 'hidden' })
                    : L({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                L({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                T({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                (T({ reason: 'paused' }),
                    n.clockId &&
                        (window.clearInterval(n.clockId), (n.clockId = 0)));
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const t = String(e.code || '').toLowerCase();
                return 'keyr' === t
                    ? (e.preventDefault(), void A())
                    : 'keym' === t
                      ? (e.preventDefault(), void p())
                      : void (
                            'keyx' === t &&
                            (e.preventDefault(), S({ announce: !0 }))
                        );
            }));
    });
})();
