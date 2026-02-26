!(function () {
    'use strict';
    const e = 'kioskThemeMode',
        t = {
            queueState: null,
            chatHistory: [],
            assistantBusy: !1,
            queueTimerId: 0,
            queuePollingEnabled: !1,
            queueFailureStreak: 0,
            queueRefreshBusy: !1,
            themeMode: 'system',
            mediaQuery: null,
        };
    function n(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function i(e) {
        return document.getElementById(e);
    }
    async function a(e, { method: t = 'GET', body: n } = {}) {
        const i = new URLSearchParams();
        (i.set('resource', e), i.set('t', String(Date.now())));
        const a = await fetch(`/api.php?${i.toString()}`, {
                method: t,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    ...(void 0 !== n
                        ? { 'Content-Type': 'application/json' }
                        : {}),
                },
                body: void 0 !== n ? JSON.stringify(n) : void 0,
            }),
            o = await a.text();
        let s;
        try {
            s = o ? JSON.parse(o) : {};
        } catch (e) {
            throw new Error('Respuesta invalida del servidor');
        }
        if (!a.ok || !1 === s.ok)
            throw new Error(s.error || `HTTP ${a.status}`);
        return s;
    }
    function o(e, t = 'info') {
        const n = i('kioskStatus');
        n && ((n.textContent = e), (n.dataset.status = t));
    }
    function s(e, t) {
        const n = i('queueConnectionState');
        if (!n) return;
        const a = String(e || 'live').toLowerCase(),
            o = {
                live: 'Cola conectada',
                reconnecting: 'Reintentando conexion',
                offline: 'Sin conexion al backend',
                paused: 'Cola en pausa',
            };
        ((n.dataset.state = a),
            (n.textContent = String(t || '').trim() || o[a] || o.live));
    }
    function r(e) {
        const t = i('queueUpdatedAt');
        if (!t) return;
        const n = Date.parse(String(e || ''));
        Number.isFinite(n)
            ? (t.textContent = `Actualizado ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (t.textContent = 'Actualizacion pendiente');
    }
    function c() {
        const e = Math.max(0, Number(t.queueFailureStreak || 0)),
            n = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, n);
    }
    function u() {
        t.queueTimerId &&
            (window.clearTimeout(t.queueTimerId), (t.queueTimerId = 0));
    }
    async function l() {
        if (t.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        t.queueRefreshBusy = !0;
        try {
            const e = await a('queue-state');
            ((t.queueState = e.data || {}),
                (function (e) {
                    const t = i('queueWaitingCount'),
                        a = i('queueCalledCount'),
                        o = i('queueCallingNow'),
                        s = i('queueNextList');
                    if (
                        (t && (t.textContent = String(e?.waitingCount || 0)),
                        a && (a.textContent = String(e?.calledCount || 0)),
                        o)
                    ) {
                        const t = Array.isArray(e?.callingNow)
                            ? e.callingNow
                            : [];
                        0 === t.length
                            ? (o.innerHTML =
                                  '<p class="queue-empty">Sin llamados activos.</p>')
                            : (o.innerHTML = t
                                  .map(
                                      (e) =>
                                          `\n                        <article class="queue-called-card">\n                            <header>Consultorio ${n(e.assignedConsultorio)}</header>\n                            <strong>${n(e.ticketCode || '--')}</strong>\n                            <span>${n(e.patientInitials || '--')}</span>\n                        </article>\n                    `
                                  )
                                  .join(''));
                    }
                    if (s) {
                        const t = Array.isArray(e?.nextTickets)
                            ? e.nextTickets
                            : [];
                        0 === t.length
                            ? (s.innerHTML =
                                  '<li class="queue-empty">No hay turnos en espera.</li>')
                            : (s.innerHTML = t
                                  .map(
                                      (e) =>
                                          `\n                        <li>\n                            <span class="ticket-code">${n(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${n(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${n(e.position || '-')}</span>\n                        </li>\n                    `
                                  )
                                  .join(''));
                    }
                })(t.queueState),
                r(t.queueState?.updatedAt));
            const o = (function (e) {
                const t = Date.parse(String(e?.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const n = Math.max(0, Date.now() - t);
                return { stale: n >= 3e4, missingTimestamp: !1, ageMs: n };
            })(t.queueState);
            return {
                ok: !0,
                stale: Boolean(o.stale),
                missingTimestamp: Boolean(o.missingTimestamp),
                ageMs: o.ageMs,
            };
        } catch (e) {
            return {
                ok: !1,
                stale: !1,
                reason: 'fetch_error',
                errorMessage: e.message,
            };
        } finally {
            t.queueRefreshBusy = !1;
        }
    }
    function d(e, a) {
        const o = i('ticketResult');
        if (!o) return;
        const s = e?.data || {},
            r = e?.print || {},
            c = Array.isArray(t.queueState?.nextTickets)
                ? t.queueState.nextTickets
                : [],
            u = c.find((e) => Number(e.id) === Number(s.id))?.position || '-',
            l = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${n(r.message || 'sin detalle')})`;
        o.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${n(a)}</p>\n            <div class="ticket-result-main">\n                <strong>${n(s.ticketCode || '--')}</strong>\n                <span>${n(s.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${n(u)}</dd></div>\n                <div><dt>Tipo</dt><dd>${n(s.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${n(
            (function (e) {
                const t = Date.parse(String(e || ''));
                return Number.isFinite(t)
                    ? new Date(t).toLocaleString('es-EC', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                      })
                    : '--';
            })(s.createdAt)
        )}</dd></div>\n            </dl>\n            <p class="ticket-result-print">${l}</p>\n        </article>\n    `;
    }
    async function m(e) {
        if ((e.preventDefault(), !(e.currentTarget instanceof HTMLFormElement)))
            return;
        const n = i('checkinPhone'),
            r = i('checkinTime'),
            c = i('checkinDate'),
            u = i('checkinInitials'),
            m = i('checkinSubmit'),
            p = n instanceof HTMLInputElement ? n.value.trim() : '',
            f = r instanceof HTMLInputElement ? r.value.trim() : '',
            g = c instanceof HTMLInputElement ? c.value.trim() : '',
            h = u instanceof HTMLInputElement ? u.value.trim() : '';
        if (p && f && g) {
            m instanceof HTMLButtonElement && (m.disabled = !0);
            try {
                const e = await a('queue-checkin', {
                    method: 'POST',
                    body: {
                        telefono: p,
                        hora: f,
                        fecha: g,
                        patientInitials: h,
                    },
                });
                (o('Check-in registrado correctamente', 'success'),
                    d(
                        e,
                        e.replay ? 'Check-in ya existente' : 'Check-in de cita'
                    ),
                    (t.queueFailureStreak = 0),
                    (await l()).ok ||
                        s(
                            'reconnecting',
                            'Check-in registrado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                o(`No se pudo registrar el check-in: ${e.message}`, 'error');
            } finally {
                m instanceof HTMLButtonElement && (m.disabled = !1);
            }
        } else
            o('Telefono, fecha y hora son obligatorios para check-in', 'error');
    }
    async function p(e) {
        e.preventDefault();
        const n = i('walkinName'),
            r = i('walkinInitials'),
            c = i('walkinPhone'),
            u = i('walkinSubmit'),
            m = n instanceof HTMLInputElement ? n.value.trim() : '',
            p =
                (r instanceof HTMLInputElement ? r.value.trim() : '') ||
                (function (e) {
                    const t = String(e || '').trim();
                    if (!t) return '';
                    const n = t
                        .toUpperCase()
                        .split(/\s+/)
                        .map((e) => e.replace(/[^A-Z]/g, ''))
                        .filter(Boolean);
                    if (0 === n.length) return '';
                    let i = '';
                    for (const e of n)
                        if (((i += e.slice(0, 1)), i.length >= 3)) break;
                    return i.slice(0, 4);
                })(m),
            f = c instanceof HTMLInputElement ? c.value.trim() : '';
        if (p) {
            u instanceof HTMLButtonElement && (u.disabled = !0);
            try {
                const e = await a('queue-ticket', {
                    method: 'POST',
                    body: { patientInitials: p, name: m, phone: f },
                });
                (o('Turno walk-in registrado correctamente', 'success'),
                    d(e, 'Turno sin cita'),
                    (t.queueFailureStreak = 0),
                    (await l()).ok ||
                        s(
                            'reconnecting',
                            'Turno creado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                o(`No se pudo crear el turno: ${e.message}`, 'error');
            } finally {
                u instanceof HTMLButtonElement && (u.disabled = !1);
            }
        } else o('Ingresa iniciales o nombre para generar el turno', 'error');
    }
    function f(e, t) {
        const a = i('assistantMessages');
        if (!a) return;
        const o = document.createElement('article');
        ((o.className = `assistant-message assistant-message-${e}`),
            (o.innerHTML = `<p>${n(t)}</p>`),
            a.appendChild(o),
            (a.scrollTop = a.scrollHeight));
    }
    async function g(e) {
        if ((e.preventDefault(), t.assistantBusy)) return;
        const n = i('assistantInput'),
            a = i('assistantSend');
        if (!(n instanceof HTMLInputElement)) return;
        const o = n.value.trim();
        if (o) {
            (f('user', o),
                (n.value = ''),
                (t.assistantBusy = !0),
                a instanceof HTMLButtonElement && (a.disabled = !0));
            try {
                const e = [
                        {
                            role: 'system',
                            content:
                                'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                        },
                        ...t.chatHistory.slice(-6),
                        { role: 'user', content: o },
                    ],
                    n = await fetch(`/figo-chat.php?t=${Date.now()}`, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                        },
                        body: JSON.stringify({
                            model: 'figo-assistant',
                            source: 'kiosk_waiting_room',
                            messages: e,
                            max_tokens: 180,
                            temperature: 0.2,
                        }),
                    }),
                    i = await n.json(),
                    a = (function (e) {
                        const t = String(e || '')
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '');
                        if (
                            /(diagnost|medicacion|tratamiento medico|receta|dosis|enfermedad)/.test(
                                t
                            )
                        )
                            return 'En este kiosco solo puedo ayudarte con turnos y orientacion de sala. Para consulta medica, acude a recepcion.';
                        return (
                            String(e || '').trim() ||
                            'Puedo ayudarte con turnos, check-in y ubicacion de consultorios.'
                        );
                    })(String(i?.choices?.[0]?.message?.content || '').trim());
                (f('bot', a),
                    (t.chatHistory = [
                        ...t.chatHistory,
                        { role: 'user', content: o },
                        { role: 'assistant', content: a },
                    ].slice(-8)));
            } catch (e) {
                f(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                );
            } finally {
                ((t.assistantBusy = !1),
                    a instanceof HTMLButtonElement && (a.disabled = !1));
            }
        }
    }
    function h(e) {
        t.themeMode = e;
        const n = document.documentElement,
            i = t.mediaQuery instanceof MediaQueryList && t.mediaQuery.matches,
            a = 'system' === e ? (i ? 'dark' : 'light') : e;
        ((n.dataset.theme = a),
            document.querySelectorAll('[data-theme-mode]').forEach((t) => {
                const n = t.getAttribute('data-theme-mode');
                (t.classList.toggle('is-active', n === e),
                    t.setAttribute('aria-pressed', String(n === e)));
            }));
    }
    function y({ immediate: e = !1 } = {}) {
        if ((u(), !t.queuePollingEnabled)) return;
        const n = e ? 0 : c();
        t.queueTimerId = window.setTimeout(() => {
            k();
        }, n);
    }
    async function k() {
        if (!t.queuePollingEnabled) return;
        if (document.hidden)
            return (s('paused', 'Cola en pausa (pestana oculta)'), void y());
        if (!1 === navigator.onLine)
            return (
                (t.queueFailureStreak += 1),
                s('offline', 'Sin conexion al backend'),
                void y()
            );
        const e = await l();
        (e.ok && !e.stale
            ? ((t.queueFailureStreak = 0), s('live', 'Cola conectada'))
            : e.ok && e.stale
              ? ((t.queueFailureStreak += 1),
                s(
                    'reconnecting',
                    `Watchdog: cola estancada ${(function (e) {
                        const t = Math.max(0, Number(e || 0)),
                            n = Math.round(t / 1e3);
                        if (n < 60) return `${n}s`;
                        const i = Math.floor(n / 60),
                            a = n % 60;
                        return a <= 0 ? `${i}m` : `${i}m ${a}s`;
                    })(e.ageMs || 0)}`
                ))
              : ((t.queueFailureStreak += 1),
                s(
                    'reconnecting',
                    `Reintentando en ${Math.max(1, Math.ceil(c() / 1e3))}s`
                )),
            y());
    }
    function T({ immediate: e = !0 } = {}) {
        if (((t.queuePollingEnabled = !0), e))
            return (s('live', 'Sincronizando cola...'), void k());
        y();
    }
    function S({ reason: e = 'paused' } = {}) {
        ((t.queuePollingEnabled = !1), (t.queueFailureStreak = 0), u());
        const n = String(e || 'paused').toLowerCase();
        'offline' !== n
            ? s(
                  'paused',
                  'hidden' !== n
                      ? 'Cola en pausa'
                      : 'Cola en pausa (pestana oculta)'
              )
            : s('offline', 'Sin conexion al backend');
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((function () {
            const n = localStorage.getItem(e) || 'system';
            ((t.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')),
                t.mediaQuery.addEventListener('change', () => {
                    'system' === t.themeMode && h('system');
                }),
                document.querySelectorAll('[data-theme-mode]').forEach((t) => {
                    t.addEventListener('click', () => {
                        !(function (t) {
                            const n = ['light', 'dark', 'system'].includes(t)
                                ? t
                                : 'system';
                            (localStorage.setItem(e, n), h(n));
                        })(t.getAttribute('data-theme-mode') || 'system');
                    });
                }),
                h(n));
        })(),
            (function () {
                const e = i('checkinDate');
                e instanceof HTMLInputElement &&
                    !e.value &&
                    (e.value = new Date().toISOString().slice(0, 10));
            })());
        const n = i('checkinForm'),
            a = i('walkinForm'),
            o = i('assistantForm');
        (n instanceof HTMLFormElement && n.addEventListener('submit', m),
            a instanceof HTMLFormElement && a.addEventListener('submit', p),
            o instanceof HTMLFormElement && o.addEventListener('submit', g),
            f(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ),
            s('paused', 'Sincronizacion lista'),
            r(''),
            T({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? S({ reason: 'hidden' })
                    : T({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                T({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                S({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                S({ reason: 'paused' });
            }));
    });
})();
