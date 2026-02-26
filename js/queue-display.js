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
        n.pollingId && (window.clearTimeout(n.pollingId), (n.pollingId = 0));
    }
    function l({ immediate: e = !1 } = {}) {
        if ((o(), !n.pollingEnabled)) return;
        const t = e
            ? 0
            : (function () {
                  const e = Math.max(0, Number(n.failureStreak || 0)),
                      t = 2500 * Math.pow(2, Math.min(e, 3));
                  return Math.min(15e3, t);
              })();
        n.pollingId = window.setTimeout(() => {
            s();
        }, t);
    }
    async function r() {
        if (n.refreshBusy) return !1;
        n.refreshBusy = !0;
        try {
            return (
                (function (i) {
                    const o = Array.isArray(i?.callingNow) ? i.callingNow : [],
                        l = { 1: null, 2: null };
                    for (const n of o) {
                        const e = Number(n?.assignedConsultorio || 0);
                        (1 !== e && 2 !== e) || (l[e] = n);
                    }
                    (a('displayConsultorio1', l[1], 'Consultorio 1'),
                        a('displayConsultorio2', l[2], 'Consultorio 2'),
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
                })(
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
                    ).data || {}
                ),
                n.pollingEnabled && i('live', 'Conectado'),
                !0
            );
        } catch (n) {
            const a = e('displayNextList');
            return (
                a &&
                    (a.innerHTML = `<li class="display-empty">Sin conexion: ${t(n.message)}</li>`),
                i(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine ? 'Sin conexion' : 'Reconectando...'
                ),
                !1
            );
        } finally {
            n.refreshBusy = !1;
        }
    }
    async function s() {
        if (n.pollingEnabled)
            return document.hidden
                ? (i('paused', 'En pausa (pestana oculta)'), void l())
                : !1 === navigator.onLine
                  ? ((n.failureStreak += 1),
                    i('offline', 'Sin conexion'),
                    void l())
                  : ((await r())
                        ? ((n.failureStreak = 0), i('live', 'Conectado'))
                        : (n.failureStreak += 1),
                    void l());
    }
    function c({ immediate: e = !0 } = {}) {
        if (((n.pollingEnabled = !0), e))
            return (i('live', 'Sincronizando...'), void s());
        l();
    }
    function d({ reason: e = 'paused' } = {}) {
        ((n.pollingEnabled = !1), (n.failureStreak = 0), o());
        const t = String(e || 'paused').toLowerCase();
        'offline' !== t
            ? i(
                  'paused',
                  'hidden' !== t ? 'En pausa' : 'En pausa (pestana oculta)'
              )
            : i('offline', 'Sin conexion');
    }
    function u() {
        const n = e('displayClock');
        n &&
            (n.textContent = new Date().toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
            }));
    }
    document.addEventListener('DOMContentLoaded', function () {
        (u(),
            (n.clockId = window.setInterval(u, 1e3)),
            i('paused', 'Sincronizacion lista'),
            c({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? d({ reason: 'hidden' })
                    : c({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                c({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                d({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                (d({ reason: 'paused' }),
                    n.clockId &&
                        (window.clearInterval(n.clockId), (n.clockId = 0)));
            }));
    });
})();
