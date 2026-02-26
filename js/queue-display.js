!(function () {
    'use strict';
    const n = {
        lastCalledSignature: '',
        audioContext: null,
        pollingId: 0,
        clockId: 0,
        pollingEnabled: !1,
        failureStreak: 0,
        refreshBusy: !1,
    };
    function e(n) {
        return document.getElementById(n);
    }
    function t(n) {
        return String(n || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function i(n, t) {
        const i = e('displayConnectionState');
        if (!i) return;
        const a = String(n || 'live').toLowerCase(),
            o = {
                live: 'Conectado',
                reconnecting: 'Reconectando',
                offline: 'Sin conexion',
                paused: 'En pausa',
            };
        ((i.dataset.state = a),
            (i.textContent = String(t || '').trim() || o[a] || o.live));
    }
    function a(n, i, a) {
        const o = e(n);
        o &&
            (o.innerHTML = i
                ? `\n        <article class="display-called-card">\n            <h3>${a}</h3>\n            <strong>${t(i.ticketCode || '--')}</strong>\n            <span>${t(i.patientInitials || '--')}</span>\n        </article>\n    `
                : `\n            <article class="display-called-card is-empty">\n                <h3>${a}</h3>\n                <p>Sin llamado activo</p>\n            </article>\n        `);
    }
    function o() {
        const e = Math.max(0, Number(n.failureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function s() {
        n.pollingId && (window.clearTimeout(n.pollingId), (n.pollingId = 0));
    }
    function r({ immediate: e = !1 } = {}) {
        if ((s(), !n.pollingEnabled)) return;
        const t = e ? 0 : o();
        n.pollingId = window.setTimeout(() => {
            c();
        }, t);
    }
    async function l() {
        if (n.refreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        n.refreshBusy = !0;
        try {
            const i =
                (
                    await (async function () {
                        const n = new URLSearchParams();
                        (n.set('resource', 'queue-state'),
                            n.set('t', String(Date.now())));
                        const e = await fetch(`/api.php?${n.toString()}`, {
                                method: 'GET',
                                credentials: 'same-origin',
                                headers: { Accept: 'application/json' },
                            }),
                            t = await e.text();
                        let i;
                        try {
                            i = t ? JSON.parse(t) : {};
                        } catch (n) {
                            throw new Error('Respuesta JSON invalida');
                        }
                        if (!e.ok || !1 === i.ok)
                            throw new Error(i.error || `HTTP ${e.status}`);
                        return i;
                    })()
                ).data || {};
            !(function (i) {
                const o = Array.isArray(i?.callingNow) ? i.callingNow : [],
                    s = { 1: null, 2: null };
                for (const n of o) {
                    const e = Number(n?.assignedConsultorio || 0);
                    (1 !== e && 2 !== e) || (s[e] = n);
                }
                (a('displayConsultorio1', s[1], 'Consultorio 1'),
                    a('displayConsultorio2', s[2], 'Consultorio 2'),
                    (function (n) {
                        const i = e('displayNextList');
                        i &&
                            (Array.isArray(n) && 0 !== n.length
                                ? (i.innerHTML = n
                                      .slice(0, 8)
                                      .map(
                                          (n) =>
                                              `\n                <li>\n                    <span class="next-code">${t(n.ticketCode || '--')}</span>\n                    <span class="next-initials">${t(n.patientInitials || '--')}</span>\n                    <span class="next-position">#${t(n.position || '-')}</span>\n                </li>\n            `
                                      )
                                      .join(''))
                                : (i.innerHTML =
                                      '<li class="display-empty">No hay turnos pendientes.</li>'));
                    })(i?.nextTickets || []),
                    (function (n) {
                        const t = e('displayUpdatedAt');
                        if (!t) return;
                        const i = Date.parse(String(n?.updatedAt || ''));
                        Number.isFinite(i)
                            ? (t.textContent = `Actualizado ${new Date(i).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
                            : (t.textContent = 'Actualizacion pendiente');
                    })(i));
                const r = (function (n) {
                    return Array.isArray(n) && 0 !== n.length
                        ? n
                              .map(
                                  (n) =>
                                      `${String(n.assignedConsultorio || '-')}:${String(n.ticketCode || '')}:${String(n.calledAt || '')}`
                              )
                              .sort()
                              .join('|')
                        : '';
                })(o);
                (r &&
                    r !== n.lastCalledSignature &&
                    (function () {
                        try {
                            n.audioContext ||
                                (n.audioContext = new (
                                    window.AudioContext ||
                                    window.webkitAudioContext
                                )());
                            const e = n.audioContext,
                                t = e.currentTime,
                                i = e.createOscillator(),
                                a = e.createGain();
                            ((i.type = 'sine'),
                                i.frequency.setValueAtTime(932, t),
                                a.gain.setValueAtTime(1e-4, t),
                                a.gain.exponentialRampToValueAtTime(
                                    0.16,
                                    t + 0.02
                                ),
                                a.gain.exponentialRampToValueAtTime(
                                    1e-4,
                                    t + 0.22
                                ),
                                i.connect(a),
                                a.connect(e.destination),
                                i.start(t),
                                i.stop(t + 0.24));
                        } catch (n) {}
                    })(),
                    (n.lastCalledSignature = r));
            })(i);
            const o = (function (n) {
                const e = Date.parse(String(n?.updatedAt || ''));
                if (!Number.isFinite(e))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const t = Math.max(0, Date.now() - e);
                return { stale: t >= 3e4, missingTimestamp: !1, ageMs: t };
            })(i);
            return {
                ok: !0,
                stale: Boolean(o.stale),
                missingTimestamp: Boolean(o.missingTimestamp),
                ageMs: o.ageMs,
            };
        } catch (n) {
            const i = e('displayNextList');
            return (
                i &&
                    (i.innerHTML = `<li class="display-empty">Sin conexion: ${t(n.message)}</li>`),
                {
                    ok: !1,
                    stale: !1,
                    reason: 'fetch_error',
                    errorMessage: n.message,
                }
            );
        } finally {
            n.refreshBusy = !1;
        }
    }
    async function c() {
        if (!n.pollingEnabled) return;
        if (document.hidden)
            return (i('paused', 'En pausa (pestana oculta)'), void r());
        if (!1 === navigator.onLine)
            return (
                (n.failureStreak += 1),
                i('offline', 'Sin conexion'),
                void r()
            );
        const e = await l();
        (e.ok && !e.stale
            ? ((n.failureStreak = 0), i('live', 'Conectado'))
            : e.ok && e.stale
              ? ((n.failureStreak += 1),
                i(
                    'reconnecting',
                    `Watchdog: datos estancados ${(function (n) {
                        const e = Math.max(0, Number(n || 0)),
                            t = Math.round(e / 1e3);
                        if (t < 60) return `${t}s`;
                        const i = Math.floor(t / 60),
                            a = t % 60;
                        return a <= 0 ? `${i}m` : `${i}m ${a}s`;
                    })(e.ageMs || 0)}`
                ))
              : ((n.failureStreak += 1),
                i(
                    'reconnecting',
                    `Reconectando en ${Math.max(1, Math.ceil(o() / 1e3))}s`
                )),
            r());
    }
    function d({ immediate: e = !0 } = {}) {
        if (((n.pollingEnabled = !0), e))
            return (i('live', 'Sincronizando...'), void c());
        r();
    }
    function u({ reason: e = 'paused' } = {}) {
        ((n.pollingEnabled = !1), (n.failureStreak = 0), s());
        const t = String(e || 'paused').toLowerCase();
        'offline' !== t
            ? i(
                  'paused',
                  'hidden' !== t ? 'En pausa' : 'En pausa (pestana oculta)'
              )
            : i('offline', 'Sin conexion');
    }
    function p() {
        const n = e('displayClock');
        n &&
            (n.textContent = new Date().toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
            }));
    }
    document.addEventListener('DOMContentLoaded', function () {
        (p(),
            (n.clockId = window.setInterval(p, 1e3)),
            i('paused', 'Sincronizacion lista'),
            d({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? u({ reason: 'hidden' })
                    : d({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                d({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                u({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                (u({ reason: 'paused' }),
                    n.clockId &&
                        (window.clearInterval(n.clockId), (n.clockId = 0)));
            }));
    });
})();
