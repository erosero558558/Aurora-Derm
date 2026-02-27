!(function () {
    'use strict';
    const e = 'kioskThemeMode',
        t = 9e5,
        n = {
            queueState: null,
            chatHistory: [],
            assistantBusy: !1,
            queueTimerId: 0,
            queuePollingEnabled: !1,
            queueFailureStreak: 0,
            queueRefreshBusy: !1,
            queueManualRefreshBusy: !1,
            queueLastHealthySyncAt: 0,
            themeMode: 'system',
            mediaQuery: null,
            idleTimerId: 0,
            idleTickId: 0,
            idleDeadlineTs: 0,
            idleResetMs: 9e4,
        };
    function a(e) {
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
    async function o(e, { method: t = 'GET', body: n } = {}) {
        const a = new URLSearchParams();
        (a.set('resource', e), a.set('t', String(Date.now())));
        const i = await fetch(`/api.php?${a.toString()}`, {
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
            o = await i.text();
        let s;
        try {
            s = o ? JSON.parse(o) : {};
        } catch (e) {
            throw new Error('Respuesta invalida del servidor');
        }
        if (!i.ok || !1 === s.ok)
            throw new Error(s.error || `HTTP ${i.status}`);
        return s;
    }
    function s(e, t = 'info') {
        const n = i('kioskStatus');
        n && ((n.textContent = e), (n.dataset.status = t));
    }
    function r(e, t) {
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
    function c() {
        const e = i('kioskSessionCountdown');
        if (!(e instanceof HTMLElement)) return;
        if (!n.idleDeadlineTs)
            return (
                (e.textContent = 'Privacidad auto: --:--'),
                (e.dataset.state = 'normal'),
                (e.style.color = 'var(--muted)'),
                void (e.style.borderColor = 'var(--border)')
            );
        const t = Math.max(0, n.idleDeadlineTs - Date.now());
        e.textContent = `Privacidad auto: ${(function (e) {
            const t = Math.max(0, Number(e || 0)),
                n = Math.ceil(t / 1e3);
            return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
        })(t)}`;
        const a = t <= 2e4;
        ((e.dataset.state = a ? 'warning' : 'normal'),
            (e.style.color = a ? 'var(--danger)' : 'var(--muted)'),
            (e.style.borderColor = a ? 'var(--danger)' : 'var(--border)'));
    }
    function u() {
        const e = i('ticketResult');
        e &&
            (e.innerHTML =
                '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>');
    }
    function l() {
        const e = i('assistantMessages');
        (e && (e.innerHTML = ''),
            (n.chatHistory = []),
            q(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ));
        const t = i('assistantInput');
        t instanceof HTMLInputElement && (t.value = '');
    }
    function d({ durationMs: e = null } = {}) {
        const a = Math.min(
            t,
            Math.max(
                5e3,
                Math.round(
                    Number.isFinite(Number(e)) ? Number(e) : n.idleResetMs
                )
            )
        );
        (n.idleTimerId &&
            (window.clearTimeout(n.idleTimerId), (n.idleTimerId = 0)),
            n.idleTickId &&
                (window.clearInterval(n.idleTickId), (n.idleTickId = 0)),
            (n.idleDeadlineTs = Date.now() + a),
            c(),
            (n.idleTickId = window.setInterval(() => {
                c();
            }, 1e3)),
            (n.idleTimerId = window.setTimeout(() => {
                if (n.assistantBusy || n.queueManualRefreshBusy)
                    return (
                        s(
                            'Sesion activa. Reprogramando limpieza automatica.',
                            'info'
                        ),
                        void d({ durationMs: 15e3 })
                    );
                p({ reason: 'idle_timeout' });
            }, a)));
    }
    function m() {
        d();
    }
    function p({ reason: e = 'manual' } = {}) {
        (!(function () {
            const e = i('checkinForm'),
                t = i('walkinForm');
            (e instanceof HTMLFormElement && e.reset(),
                t instanceof HTMLFormElement && t.reset(),
                x());
        })(),
            l(),
            u(),
            s(
                'idle_timeout' === e
                    ? 'Sesion reiniciada por inactividad para proteger privacidad.'
                    : 'Pantalla limpiada. Lista para el siguiente paciente.',
                'info'
            ),
            d());
    }
    function f() {
        let e = i('queueOpsHint');
        if (e) return e;
        const t = document.querySelector('.kiosk-side .kiosk-card'),
            n = i('queueUpdatedAt');
        return t && n
            ? ((e = document.createElement('p')),
              (e.id = 'queueOpsHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function y(e) {
        const t = f();
        t && (t.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function g() {
        let e = i('queueManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = i('queueUpdatedAt');
        return t?.parentElement
            ? ((e = document.createElement('button')),
              (e.id = 'queueManualRefreshBtn'),
              (e.type = 'button'),
              (e.textContent = 'Reintentar sincronizacion'),
              (e.style.margin = '0.25rem 0 0.55rem'),
              (e.style.border = '1px solid var(--border)'),
              (e.style.borderRadius = '0.6rem'),
              (e.style.padding = '0.42rem 0.62rem'),
              (e.style.background = 'var(--surface-soft)'),
              (e.style.color = 'var(--text)'),
              (e.style.cursor = 'pointer'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function h(e) {
        const t = g();
        t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e)),
            (t.textContent = e
                ? 'Actualizando cola...'
                : 'Reintentar sincronizacion'));
    }
    function k(e) {
        const t = Math.max(0, Number(e || 0)),
            n = Math.round(t / 1e3);
        if (n < 60) return `${n}s`;
        const a = Math.floor(n / 60),
            i = n % 60;
        return i <= 0 ? `${a}m` : `${a}m ${i}s`;
    }
    function v() {
        return n.queueLastHealthySyncAt
            ? `hace ${k(Date.now() - n.queueLastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function T(e) {
        const t = i('queueUpdatedAt');
        if (!t) return;
        const n = Date.parse(String(e || ''));
        Number.isFinite(n)
            ? (t.textContent = `Actualizado ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (t.textContent = 'Actualizacion pendiente');
    }
    function S() {
        const e = Math.max(0, Number(n.queueFailureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function M() {
        n.queueTimerId &&
            (window.clearTimeout(n.queueTimerId), (n.queueTimerId = 0));
    }
    async function b() {
        if (n.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        n.queueRefreshBusy = !0;
        try {
            const e = await o('queue-state');
            ((n.queueState = e.data || {}),
                (function (e) {
                    const t = i('queueWaitingCount'),
                        n = i('queueCalledCount'),
                        o = i('queueCallingNow'),
                        s = i('queueNextList');
                    if (
                        (t && (t.textContent = String(e?.waitingCount || 0)),
                        n && (n.textContent = String(e?.calledCount || 0)),
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
                                          `\n                        <article class="queue-called-card">\n                            <header>Consultorio ${a(e.assignedConsultorio)}</header>\n                            <strong>${a(e.ticketCode || '--')}</strong>\n                            <span>${a(e.patientInitials || '--')}</span>\n                        </article>\n                    `
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
                                          `\n                        <li>\n                            <span class="ticket-code">${a(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${a(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${a(e.position || '-')}</span>\n                        </li>\n                    `
                                  )
                                  .join(''));
                    }
                })(n.queueState),
                T(n.queueState?.updatedAt));
            const t = (function (e) {
                const t = Date.parse(String(e?.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const n = Math.max(0, Date.now() - t);
                return { stale: n >= 3e4, missingTimestamp: !1, ageMs: n };
            })(n.queueState);
            return {
                ok: !0,
                stale: Boolean(t.stale),
                missingTimestamp: Boolean(t.missingTimestamp),
                ageMs: t.ageMs,
            };
        } catch (e) {
            return {
                ok: !1,
                stale: !1,
                reason: 'fetch_error',
                errorMessage: e.message,
            };
        } finally {
            n.queueRefreshBusy = !1;
        }
    }
    function E(e, t) {
        const o = i('ticketResult');
        if (!o) return;
        const s = e?.data || {},
            r = e?.print || {},
            c = Array.isArray(n.queueState?.nextTickets)
                ? n.queueState.nextTickets
                : [],
            u = c.find((e) => Number(e.id) === Number(s.id))?.position || '-',
            l = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${a(r.message || 'sin detalle')})`;
        o.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${a(t)}</p>\n            <div class="ticket-result-main">\n                <strong>${a(s.ticketCode || '--')}</strong>\n                <span>${a(s.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${a(u)}</dd></div>\n                <div><dt>Tipo</dt><dd>${a(s.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${a(
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
    async function w(e) {
        if (
            (e.preventDefault(),
            m(),
            !(e.currentTarget instanceof HTMLFormElement))
        )
            return;
        const t = i('checkinPhone'),
            a = i('checkinTime'),
            c = i('checkinDate'),
            u = i('checkinInitials'),
            l = i('checkinSubmit'),
            d = t instanceof HTMLInputElement ? t.value.trim() : '',
            p = a instanceof HTMLInputElement ? a.value.trim() : '',
            f = c instanceof HTMLInputElement ? c.value.trim() : '',
            y = u instanceof HTMLInputElement ? u.value.trim() : '';
        if (d && p && f) {
            l instanceof HTMLButtonElement && (l.disabled = !0);
            try {
                const e = await o('queue-checkin', {
                    method: 'POST',
                    body: {
                        telefono: d,
                        hora: p,
                        fecha: f,
                        patientInitials: y,
                    },
                });
                (s('Check-in registrado correctamente', 'success'),
                    E(
                        e,
                        e.replay ? 'Check-in ya existente' : 'Check-in de cita'
                    ),
                    (n.queueFailureStreak = 0),
                    (await b()).ok ||
                        r(
                            'reconnecting',
                            'Check-in registrado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                s(`No se pudo registrar el check-in: ${e.message}`, 'error');
            } finally {
                l instanceof HTMLButtonElement && (l.disabled = !1);
            }
        } else
            s('Telefono, fecha y hora son obligatorios para check-in', 'error');
    }
    async function L(e) {
        (e.preventDefault(), m());
        const t = i('walkinName'),
            a = i('walkinInitials'),
            c = i('walkinPhone'),
            u = i('walkinSubmit'),
            l = t instanceof HTMLInputElement ? t.value.trim() : '',
            d =
                (a instanceof HTMLInputElement ? a.value.trim() : '') ||
                (function (e) {
                    const t = String(e || '').trim();
                    if (!t) return '';
                    const n = t
                        .toUpperCase()
                        .split(/\s+/)
                        .map((e) => e.replace(/[^A-Z]/g, ''))
                        .filter(Boolean);
                    if (0 === n.length) return '';
                    let a = '';
                    for (const e of n)
                        if (((a += e.slice(0, 1)), a.length >= 3)) break;
                    return a.slice(0, 4);
                })(l),
            p = c instanceof HTMLInputElement ? c.value.trim() : '';
        if (d) {
            u instanceof HTMLButtonElement && (u.disabled = !0);
            try {
                const e = await o('queue-ticket', {
                    method: 'POST',
                    body: { patientInitials: d, name: l, phone: p },
                });
                (s('Turno walk-in registrado correctamente', 'success'),
                    E(e, 'Turno sin cita'),
                    (n.queueFailureStreak = 0),
                    (await b()).ok ||
                        r(
                            'reconnecting',
                            'Turno creado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                s(`No se pudo crear el turno: ${e.message}`, 'error');
            } finally {
                u instanceof HTMLButtonElement && (u.disabled = !1);
            }
        } else s('Ingresa iniciales o nombre para generar el turno', 'error');
    }
    function q(e, t) {
        const n = i('assistantMessages');
        if (!n) return;
        const o = document.createElement('article');
        ((o.className = `assistant-message assistant-message-${e}`),
            (o.innerHTML = `<p>${a(t)}</p>`),
            n.appendChild(o),
            (n.scrollTop = n.scrollHeight));
    }
    async function C(e) {
        if ((e.preventDefault(), m(), n.assistantBusy)) return;
        const t = i('assistantInput'),
            a = i('assistantSend');
        if (!(t instanceof HTMLInputElement)) return;
        const o = t.value.trim();
        if (o) {
            (q('user', o),
                (t.value = ''),
                (n.assistantBusy = !0),
                a instanceof HTMLButtonElement && (a.disabled = !0));
            try {
                const e = [
                        {
                            role: 'system',
                            content:
                                'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                        },
                        ...n.chatHistory.slice(-6),
                        { role: 'user', content: o },
                    ],
                    t = await fetch(`/figo-chat.php?t=${Date.now()}`, {
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
                    a = await t.json(),
                    i = (function (e) {
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
                    })(String(a?.choices?.[0]?.message?.content || '').trim());
                (q('bot', i),
                    (n.chatHistory = [
                        ...n.chatHistory,
                        { role: 'user', content: o },
                        { role: 'assistant', content: i },
                    ].slice(-8)));
            } catch (e) {
                q(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                );
            } finally {
                ((n.assistantBusy = !1),
                    a instanceof HTMLButtonElement && (a.disabled = !1));
            }
        }
    }
    function H(e) {
        n.themeMode = e;
        const t = document.documentElement,
            a = n.mediaQuery instanceof MediaQueryList && n.mediaQuery.matches,
            i = 'system' === e ? (a ? 'dark' : 'light') : e;
        ((t.dataset.theme = i),
            document.querySelectorAll('[data-theme-mode]').forEach((t) => {
                const n = t.getAttribute('data-theme-mode');
                (t.classList.toggle('is-active', n === e),
                    t.setAttribute('aria-pressed', String(n === e)));
            }));
    }
    function x() {
        const e = i('checkinDate');
        e instanceof HTMLInputElement &&
            !e.value &&
            (e.value = new Date().toISOString().slice(0, 10));
    }
    function I({ immediate: e = !1 } = {}) {
        if ((M(), !n.queuePollingEnabled)) return;
        const t = e ? 0 : S();
        n.queueTimerId = window.setTimeout(() => {
            $();
        }, t);
    }
    async function $() {
        if (!n.queuePollingEnabled) return;
        if (document.hidden)
            return (
                r('paused', 'Cola en pausa (pestana oculta)'),
                y('Pestana oculta. Turnero en pausa temporal.'),
                void I()
            );
        if (!1 === navigator.onLine)
            return (
                (n.queueFailureStreak += 1),
                r('offline', 'Sin conexion al backend'),
                y(
                    'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
                ),
                void I()
            );
        const e = await b();
        if (e.ok && !e.stale)
            ((n.queueFailureStreak = 0),
                (n.queueLastHealthySyncAt = Date.now()),
                r('live', 'Cola conectada'),
                y(
                    `Operacion estable (${v()}). Kiosco disponible para turnos.`
                ));
        else if (e.ok && e.stale) {
            n.queueFailureStreak += 1;
            const t = k(e.ageMs || 0);
            (r('reconnecting', `Watchdog: cola estancada ${t}`),
                y(
                    `Cola degradada: sin cambios en ${t}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
                ));
        } else {
            n.queueFailureStreak += 1;
            const e = Math.max(1, Math.ceil(S() / 1e3));
            (r('reconnecting', `Reintentando en ${e}s`),
                y(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        I();
    }
    async function A() {
        if (!n.queueManualRefreshBusy) {
            (m(),
                (n.queueManualRefreshBusy = !0),
                h(!0),
                r('reconnecting', 'Refrescando manualmente...'));
            try {
                const e = await b();
                if (e.ok && !e.stale)
                    return (
                        (n.queueFailureStreak = 0),
                        (n.queueLastHealthySyncAt = Date.now()),
                        r('live', 'Cola conectada'),
                        void y(`Sincronizacion manual exitosa (${v()}).`)
                    );
                if (e.ok && e.stale) {
                    const t = k(e.ageMs || 0);
                    return (
                        r('reconnecting', `Watchdog: cola estancada ${t}`),
                        void y(
                            `Persisten datos estancados (${t}). Verifica backend o recepcion.`
                        )
                    );
                }
                const t = Math.max(1, Math.ceil(S() / 1e3));
                (r(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion al backend'
                        : `Reintentando en ${t}s`
                ),
                    y(
                        !1 === navigator.onLine
                            ? 'Sin internet. Opera manualmente en recepcion.'
                            : `Refresh manual sin exito. Reintento automatico en ${t}s.`
                    ));
            } finally {
                ((n.queueManualRefreshBusy = !1), h(!1));
            }
        }
    }
    function R({ immediate: e = !0 } = {}) {
        if (((n.queuePollingEnabled = !0), e))
            return (r('live', 'Sincronizando cola...'), void $());
        I();
    }
    function B({ reason: e = 'paused' } = {}) {
        ((n.queuePollingEnabled = !1), (n.queueFailureStreak = 0), M());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (r('offline', 'Sin conexion al backend'),
              void y('Sin conexion. Esperando reconexion para reanudar cola.'))
            : 'hidden' === t
              ? (r('paused', 'Cola en pausa (pestana oculta)'),
                void y('Pestana oculta. Reanudando al volver a primer plano.'))
              : (r('paused', 'Cola en pausa'),
                void y('Sincronizacion pausada por navegacion.'));
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((n.idleResetMs = (function () {
            const e = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS),
                n = Number.isFinite(e) ? e : 9e4;
            return Math.min(t, Math.max(5e3, Math.round(n)));
        })()),
            (function () {
                const t = localStorage.getItem(e) || 'system';
                ((n.mediaQuery = window.matchMedia(
                    '(prefers-color-scheme: dark)'
                )),
                    n.mediaQuery.addEventListener('change', () => {
                        'system' === n.themeMode && H('system');
                    }),
                    document
                        .querySelectorAll('[data-theme-mode]')
                        .forEach((t) => {
                            t.addEventListener('click', () => {
                                !(function (t) {
                                    const n = [
                                        'light',
                                        'dark',
                                        'system',
                                    ].includes(t)
                                        ? t
                                        : 'system';
                                    (localStorage.setItem(e, n), H(n));
                                })(
                                    t.getAttribute('data-theme-mode') ||
                                        'system'
                                );
                            });
                        }),
                    H(t));
            })(),
            x());
        const a = i('checkinForm'),
            o = i('walkinForm'),
            s = i('assistantForm');
        (a instanceof HTMLFormElement && a.addEventListener('submit', w),
            o instanceof HTMLFormElement && o.addEventListener('submit', L),
            s instanceof HTMLFormElement && s.addEventListener('submit', C),
            (function () {
                let e = i('kioskSessionGuard');
                if (e instanceof HTMLElement) return e;
                const t = i('kioskStatus');
                if (!(t instanceof HTMLElement)) return null;
                ((e = document.createElement('div')),
                    (e.id = 'kioskSessionGuard'),
                    (e.style.display = 'flex'),
                    (e.style.flexWrap = 'wrap'),
                    (e.style.alignItems = 'center'),
                    (e.style.gap = '0.55rem'),
                    (e.style.marginBottom = '0.85rem'));
                const n = document.createElement('span');
                ((n.id = 'kioskSessionCountdown'),
                    (n.textContent = 'Privacidad auto: --:--'),
                    (n.style.display = 'inline-flex'),
                    (n.style.alignItems = 'center'),
                    (n.style.padding = '0.2rem 0.55rem'),
                    (n.style.border = '1px solid var(--border)'),
                    (n.style.borderRadius = '999px'),
                    (n.style.background = 'var(--surface-soft)'),
                    (n.style.color = 'var(--muted)'),
                    (n.style.fontSize = '0.82rem'));
                const a = document.createElement('button');
                ((a.id = 'kioskSessionResetBtn'),
                    (a.type = 'button'),
                    (a.textContent = 'Nueva persona / limpiar pantalla'),
                    (a.style.border = '1px solid var(--border)'),
                    (a.style.borderRadius = '0.65rem'),
                    (a.style.padding = '0.38rem 0.62rem'),
                    (a.style.background = 'var(--surface-soft)'),
                    (a.style.color = 'var(--text)'),
                    (a.style.cursor = 'pointer'),
                    e.appendChild(n),
                    e.appendChild(a),
                    t.insertAdjacentElement('afterend', e));
            })());
        const c = i('kioskSessionResetBtn');
        (c instanceof HTMLButtonElement &&
            c.addEventListener('click', () => {
                p({ reason: 'manual' });
            }),
            l(),
            u(),
            ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((e) => {
                document.addEventListener(
                    e,
                    () => {
                        m();
                    },
                    !0
                );
            }),
            d(),
            f());
        const h = g();
        (h instanceof HTMLButtonElement &&
            h.addEventListener('click', () => {
                A();
            }),
            r('paused', 'Sincronizacion lista'),
            y('Esperando primera sincronizacion de cola...'),
            T(''),
            R({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? B({ reason: 'hidden' })
                    : R({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                R({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                B({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                B({ reason: 'paused' });
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const t = String(e.code || '').toLowerCase();
                if ('keyr' === t) return (e.preventDefault(), void A());
                'keyl' === t && (e.preventDefault(), p({ reason: 'manual' }));
            }));
    });
})();
