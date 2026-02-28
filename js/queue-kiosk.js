!(function () {
    'use strict';
    const e = 9e5,
        n = 'queueKioskOfflineOutbox',
        t = 'queueKioskPrinterState',
        i = 'kioskStarInlineStyles',
        o = {
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
            offlineOutbox: [],
            offlineOutboxFlushBusy: !1,
            lastConnectionState: '',
            lastConnectionMessage: '',
            printerState: null,
            quickHelpOpen: !1,
            selectedFlow: 'checkin',
            welcomeDismissed: !1,
        };
    function a(e, n = {}) {
        try {
            window.dispatchEvent(
                new CustomEvent('piel:queue-ops', {
                    detail: {
                        surface: 'kiosk',
                        event: String(e || 'unknown'),
                        at: new Date().toISOString(),
                        ...n,
                    },
                })
            );
        } catch (e) {}
    }
    function r(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function s(e) {
        return document.getElementById(e);
    }
    function c(e, n = 'info') {
        const t = s('kioskProgressHint');
        if (!(t instanceof HTMLElement)) return;
        const i = ['info', 'warn', 'success'].includes(
                String(n || '').toLowerCase()
            )
                ? String(n || '').toLowerCase()
                : 'info',
            o =
                String(e || '').trim() ||
                'Paso 1 de 2: selecciona una opcion para comenzar.';
        ((t.dataset.tone = i), (t.textContent = o));
    }
    function u(e, { source: n = 'ui' } = {}) {
        const t = s('kioskQuickHelpPanel'),
            i = s('kioskHelpToggle');
        if (!(t instanceof HTMLElement && i instanceof HTMLButtonElement))
            return;
        const r = Boolean(e);
        ((o.quickHelpOpen = r),
            (t.hidden = !r),
            (i.dataset.open = r ? 'true' : 'false'),
            i.setAttribute('aria-expanded', String(r)),
            a('quick_help_toggled', { open: r, source: n }),
            c(
                r
                    ? 'Guia abierta: elige opcion, completa datos y confirma ticket.'
                    : 'Paso 1 de 2: selecciona una opcion para comenzar.',
                'info'
            ));
    }
    function l(e, { announce: n = !0 } = {}) {
        const t =
            'walkin' === String(e || '').toLowerCase() ? 'walkin' : 'checkin';
        o.selectedFlow = t;
        const i = s('checkinForm'),
            r = s('walkinForm');
        (i instanceof HTMLElement &&
            i.classList.toggle('is-flow-active', 'checkin' === t),
            r instanceof HTMLElement &&
                r.classList.toggle('is-flow-active', 'walkin' === t));
        const u = s('kioskQuickCheckin'),
            l = s('kioskQuickWalkin');
        if (u instanceof HTMLButtonElement) {
            const e = 'checkin' === t;
            ((u.dataset.active = e ? 'true' : 'false'),
                u.setAttribute('aria-pressed', String(e)));
        }
        if (l instanceof HTMLButtonElement) {
            const e = 'walkin' === t;
            ((l.dataset.active = e ? 'true' : 'false'),
                l.setAttribute('aria-pressed', String(e)));
        }
        const d = s('walkin' === t ? 'walkinInitials' : 'checkinPhone');
        (d instanceof HTMLInputElement && d.focus({ preventScroll: !1 }),
            n &&
                c(
                    'walkin' === t
                        ? 'Paso 2: escribe iniciales y pulsa "Generar turno".'
                        : 'Paso 2: escribe telefono, fecha y hora para check-in.',
                    'info'
                ),
            a('flow_focus', { target: t }));
    }
    function d(e, n) {
        if (!e || 'object' != typeof e || !Array.isArray(n)) return [];
        for (const t of n) if (t && Array.isArray(e[t])) return e[t];
        return [];
    }
    function f(e, n) {
        if (!e || 'object' != typeof e || !Array.isArray(n)) return null;
        for (const t of n) {
            if (!t) continue;
            const n = e[t];
            if (n && 'object' == typeof n && !Array.isArray(n)) return n;
        }
        return null;
    }
    function m(e, n, t = 0) {
        if (!e || 'object' != typeof e || !Array.isArray(n))
            return Number(t || 0);
        for (const t of n) {
            if (!t) continue;
            const n = Number(e[t]);
            if (Number.isFinite(n)) return n;
        }
        return Number(t || 0);
    }
    function p(e) {
        const n = e && 'object' == typeof e ? e : {},
            t = f(n, ['counts']) || {},
            i = m(n, ['waitingCount', 'waiting_count'], Number.NaN),
            o = m(n, ['calledCount', 'called_count'], Number.NaN);
        let a = d(n, [
            'callingNow',
            'calling_now',
            'calledTickets',
            'called_tickets',
        ]);
        if (0 === a.length) {
            const e = f(n, [
                'callingNowByConsultorio',
                'calling_now_by_consultorio',
            ]);
            e && (a = Object.values(e).filter(Boolean));
        }
        const r = d(n, [
                'nextTickets',
                'next_tickets',
                'waitingTickets',
                'waiting_tickets',
            ]),
            s = Number.isFinite(i)
                ? i
                : m(t, ['waiting', 'waiting_count'], r.length),
            c = Number.isFinite(o)
                ? o
                : m(t, ['called', 'called_count'], a.length);
        return {
            updatedAt:
                String(n.updatedAt || n.updated_at || '').trim() ||
                new Date().toISOString(),
            waitingCount: Math.max(0, Number(s || 0)),
            calledCount: Math.max(0, Number(c || 0)),
            callingNow: Array.isArray(a)
                ? a.map((e) => ({
                      ...e,
                      id: Number(e?.id || e?.ticket_id || 0) || 0,
                      ticketCode: String(
                          e?.ticketCode || e?.ticket_code || '--'
                      ),
                      patientInitials: String(
                          e?.patientInitials || e?.patient_initials || '--'
                      ),
                      assignedConsultorio:
                          Number(
                              e?.assignedConsultorio ??
                                  e?.assigned_consultorio ??
                                  0
                          ) || null,
                      calledAt: String(e?.calledAt || e?.called_at || ''),
                  }))
                : [],
            nextTickets: Array.isArray(r)
                ? r.map((e, n) => ({
                      ...e,
                      id: Number(e?.id || e?.ticket_id || 0) || 0,
                      ticketCode: String(
                          e?.ticketCode || e?.ticket_code || '--'
                      ),
                      patientInitials: String(
                          e?.patientInitials || e?.patient_initials || '--'
                      ),
                      queueType: String(
                          e?.queueType || e?.queue_type || 'walk_in'
                      ),
                      priorityClass: String(
                          e?.priorityClass || e?.priority_class || 'walk_in'
                      ),
                      position:
                          Number(e?.position || 0) > 0
                              ? Number(e.position)
                              : n + 1,
                  }))
                : [],
        };
    }
    async function g(e, { method: n = 'GET', body: t } = {}) {
        const i = new URLSearchParams();
        (i.set('resource', e), i.set('t', String(Date.now())));
        const o = await fetch(`/api.php?${i.toString()}`, {
                method: n,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    ...(void 0 !== t
                        ? { 'Content-Type': 'application/json' }
                        : {}),
                },
                body: void 0 !== t ? JSON.stringify(t) : void 0,
            }),
            a = await o.text();
        let r;
        try {
            r = a ? JSON.parse(a) : {};
        } catch (e) {
            throw new Error('Respuesta invalida del servidor');
        }
        if (!o.ok || !1 === r.ok)
            throw new Error(r.error || `HTTP ${o.status}`);
        return r;
    }
    function k(e, n = 'info') {
        const t = s('kioskStatus');
        if (!t) return;
        const i = String(e || '').trim() || 'Estado operativo',
            o = String(n || 'info').toLowerCase(),
            r =
                i !== String(t.textContent || '').trim() ||
                o !== String(t.dataset.status || '').toLowerCase();
        ((t.textContent = i),
            (t.dataset.status = o),
            r && a('kiosk_status', { status: o, message: i }));
    }
    function b(e, n) {
        const t = s('queueConnectionState');
        if (!t) return;
        const i = String(e || 'live').toLowerCase(),
            r = {
                live: 'Cola conectada',
                reconnecting: 'Reintentando conexion',
                offline: 'Sin conexion al backend',
                paused: 'Cola en pausa',
            },
            c = String(n || '').trim() || r[i] || r.live,
            u = i !== o.lastConnectionState || c !== o.lastConnectionMessage;
        ((o.lastConnectionState = i),
            (o.lastConnectionMessage = c),
            (t.dataset.state = i),
            (t.textContent = c),
            u && a('connection_state', { state: i, message: c }));
    }
    function h() {
        const e = s('kioskSessionCountdown');
        if (!(e instanceof HTMLElement)) return;
        if (!o.idleDeadlineTs)
            return (
                (e.textContent = 'Privacidad auto: --:--'),
                void (e.dataset.state = 'normal')
            );
        const n = Math.max(0, o.idleDeadlineTs - Date.now());
        e.textContent = `Privacidad auto: ${(function (e) {
            const n = Math.max(0, Number(e || 0)),
                t = Math.ceil(n / 1e3);
            return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
        })(n)}`;
        const t = n <= 2e4;
        e.dataset.state = t ? 'warning' : 'normal';
    }
    function y() {
        const e = s('ticketResult');
        e &&
            (e.innerHTML =
                '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>');
    }
    function S() {
        const e = s('assistantMessages');
        (e && (e.innerHTML = ''),
            (o.chatHistory = []),
            X(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ));
        const n = s('assistantInput');
        n instanceof HTMLInputElement && (n.value = '');
    }
    function v({ durationMs: n = null } = {}) {
        const t = Math.min(
            e,
            Math.max(
                5e3,
                Math.round(
                    Number.isFinite(Number(n)) ? Number(n) : o.idleResetMs
                )
            )
        );
        (o.idleTimerId &&
            (window.clearTimeout(o.idleTimerId), (o.idleTimerId = 0)),
            o.idleTickId &&
                (window.clearInterval(o.idleTickId), (o.idleTickId = 0)),
            (o.idleDeadlineTs = Date.now() + t),
            h(),
            (o.idleTickId = window.setInterval(() => {
                h();
            }, 1e3)),
            (o.idleTimerId = window.setTimeout(() => {
                if (o.assistantBusy || o.queueManualRefreshBusy)
                    return (
                        k(
                            'Sesion activa. Reprogramando limpieza automatica.',
                            'info'
                        ),
                        void v({ durationMs: 15e3 })
                    );
                w({ reason: 'idle_timeout' });
            }, t)));
    }
    function x() {
        (ne({ reason: 'activity' }), v());
    }
    function w({ reason: e = 'manual' } = {}) {
        (!(function () {
            const e = s('checkinForm'),
                n = s('walkinForm');
            (e instanceof HTMLFormElement && e.reset(),
                n instanceof HTMLFormElement && n.reset(),
                te());
        })(),
            S(),
            y(),
            u(!1, { source: 'session_reset' }),
            l('checkin', { announce: !1 }),
            k(
                'idle_timeout' === e
                    ? 'Sesion reiniciada por inactividad para proteger privacidad.'
                    : 'Pantalla limpiada. Lista para el siguiente paciente.',
                'info'
            ),
            c('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            B(),
            v());
    }
    function q() {
        let e = s('queueOpsHint');
        if (e) return e;
        const n = document.querySelector('.kiosk-side .kiosk-card'),
            t = s('queueUpdatedAt');
        return n && t
            ? ((e = document.createElement('p')),
              (e.id = 'queueOpsHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function T(e) {
        const n = q();
        n && (n.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function L() {
        let e = s('queueOutboxHint');
        if (e) return e;
        const n = q();
        return n?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queueOutboxHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Pendientes offline: 0'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function E(e) {
        const n = L();
        n &&
            (n.textContent = String(e || '').trim() || 'Pendientes offline: 0');
    }
    function M() {
        let e = s('queuePrinterHint');
        if (e) return e;
        const n = L();
        return n?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queuePrinterHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Impresora: estado pendiente.'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function C() {
        const e = M();
        if (!e) return;
        const n = o.printerState;
        if (!n) return void (e.textContent = 'Impresora: estado pendiente.');
        const t = n.printed ? 'impresion OK' : n.errorCode || 'sin impresion',
            i = n.message ? ` (${n.message})` : '',
            a = j(n.at);
        e.textContent = `Impresora: ${t}${i} · ${a}`;
    }
    function O() {
        let e = s('queueOutboxConsole');
        if (e instanceof HTMLElement) return e;
        const n = L();
        return n?.parentElement
            ? ((e = document.createElement('section')),
              (e.id = 'queueOutboxConsole'),
              (e.className = 'queue-outbox-console'),
              (e.innerHTML =
                  '\n        <p id="queueOutboxSummary" class="queue-updated-at">Outbox: 0 pendientes</p>\n        <div class="queue-outbox-actions">\n            <button id="queueOutboxRetryBtn" type="button" class="queue-outbox-btn">Sincronizar pendientes</button>\n            <button id="queueOutboxDropOldestBtn" type="button" class="queue-outbox-btn">Descartar mas antiguo</button>\n            <button id="queueOutboxClearBtn" type="button" class="queue-outbox-btn">Limpiar pendientes</button>\n        </div>\n        <ol id="queueOutboxList" class="queue-outbox-list">\n            <li class="queue-empty">Sin pendientes offline.</li>\n        </ol>\n        <p class="queue-updated-at queue-outbox-shortcuts">Atajos: Alt+Shift+Y sincroniza pendientes, Alt+Shift+K limpia pendientes.</p>\n    '),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function H(e) {
        const n = s('queueOutboxRetryBtn'),
            t = s('queueOutboxClearBtn'),
            i = s('queueOutboxDropOldestBtn');
        (n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(e) || !o.offlineOutbox.length),
            (n.textContent = e
                ? 'Sincronizando...'
                : 'Sincronizar pendientes')),
            t instanceof HTMLButtonElement &&
                (t.disabled = Boolean(e) || !o.offlineOutbox.length),
            i instanceof HTMLButtonElement &&
                (i.disabled = Boolean(e) || o.offlineOutbox.length <= 0));
    }
    function I() {
        O();
        const e = s('queueOutboxSummary'),
            n = s('queueOutboxList'),
            t = o.offlineOutbox.length;
        (e instanceof HTMLElement &&
            (e.textContent =
                t <= 0 ? 'Outbox: 0 pendientes' : `Outbox: ${t} pendiente(s)`),
            n instanceof HTMLElement &&
                (n.innerHTML =
                    t <= 0
                        ? '<li class="queue-empty">Sin pendientes offline.</li>'
                        : o.offlineOutbox
                              .slice(0, 6)
                              .map((e, n) => {
                                  const t = j(e.queuedAt),
                                      i = Number(e.attempts || 0);
                                  return `<li><strong>${r(e.originLabel)}</strong> · ${r(e.patientInitials || '--')} · ${r(e.queueType || '--')} · ${r(t)} · intento ${n + 1}/${Math.max(1, i + 1)}</li>`;
                              })
                              .join('')),
            H(!1));
    }
    function A({ reason: e = 'manual' } = {}) {
        ((o.offlineOutbox = []),
            N(),
            B(),
            I(),
            'manual' === e &&
                k('Pendientes offline limpiados manualmente.', 'info'));
    }
    function N() {
        try {
            localStorage.setItem(n, JSON.stringify(o.offlineOutbox));
        } catch (e) {}
    }
    function B() {
        const e = o.offlineOutbox.length;
        if (e <= 0)
            return (E('Pendientes offline: 0 (sin pendientes).'), void I());
        const n = Date.parse(String(o.offlineOutbox[0]?.queuedAt || ''));
        (E(
            `Pendientes offline: ${e} - sincronizacion automatica al reconectar${Number.isFinite(n) ? ` - mas antiguo ${D(Date.now() - n)}` : ''}`
        ),
            I());
    }
    function $() {
        let e = s('queueManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const n = s('queueUpdatedAt');
        return n?.parentElement
            ? ((e = document.createElement('button')),
              (e.id = 'queueManualRefreshBtn'),
              (e.type = 'button'),
              (e.className = 'queue-manual-refresh-btn'),
              (e.textContent = 'Reintentar sincronizacion'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function _(e) {
        const n = $();
        n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(e)),
            (n.textContent = e
                ? 'Actualizando cola...'
                : 'Reintentar sincronizacion'));
    }
    function D(e) {
        const n = Math.max(0, Number(e || 0)),
            t = Math.round(n / 1e3);
        if (t < 60) return `${t}s`;
        const i = Math.floor(t / 60),
            o = t % 60;
        return o <= 0 ? `${i}m` : `${i}m ${o}s`;
    }
    function P() {
        return o.queueLastHealthySyncAt
            ? `hace ${D(Date.now() - o.queueLastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function z(e) {
        const n = s('queueUpdatedAt');
        if (!n) return;
        const t = p({ updatedAt: e }),
            i = Date.parse(String(t.updatedAt || ''));
        Number.isFinite(i)
            ? (n.textContent = `Actualizado ${new Date(i).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (n.textContent = 'Actualizacion pendiente');
    }
    function F() {
        const e = Math.max(0, Number(o.queueFailureStreak || 0)),
            n = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, n);
    }
    function R() {
        o.queueTimerId &&
            (window.clearTimeout(o.queueTimerId), (o.queueTimerId = 0));
    }
    function j(e) {
        const n = Date.parse(String(e || ''));
        return Number.isFinite(n)
            ? new Date(n).toLocaleString('es-EC', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
              })
            : '--';
    }
    async function K() {
        if (o.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        o.queueRefreshBusy = !0;
        try {
            const e = await g('queue-state');
            ((o.queueState = p(e.data || {})),
                (function (e) {
                    const n = p(e),
                        t = s('queueWaitingCount'),
                        i = s('queueCalledCount'),
                        o = s('queueCallingNow'),
                        a = s('queueNextList');
                    if (
                        (t && (t.textContent = String(n.waitingCount || 0)),
                        i && (i.textContent = String(n.calledCount || 0)),
                        o)
                    ) {
                        const e = Array.isArray(n.callingNow)
                            ? n.callingNow
                            : [];
                        0 === e.length
                            ? (o.innerHTML =
                                  '<p class="queue-empty">Sin llamados activos.</p>')
                            : (o.innerHTML = e
                                  .map(
                                      (e) =>
                                          `\n                        <article class="queue-called-card">\n                            <header>Consultorio ${r(e.assignedConsultorio)}</header>\n                            <strong>${r(e.ticketCode || '--')}</strong>\n                            <span>${r(e.patientInitials || '--')}</span>\n                        </article>\n                    `
                                  )
                                  .join(''));
                    }
                    if (a) {
                        const e = Array.isArray(n.nextTickets)
                            ? n.nextTickets
                            : [];
                        0 === e.length
                            ? (a.innerHTML =
                                  '<li class="queue-empty">No hay turnos en espera.</li>')
                            : (a.innerHTML = e
                                  .map(
                                      (e) =>
                                          `\n                        <li>\n                            <span class="ticket-code">${r(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${r(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${r(e.position || '-')}</span>\n                        </li>\n                    `
                                  )
                                  .join(''));
                    }
                })(o.queueState),
                z(o.queueState?.updatedAt));
            const n = (function (e) {
                const n = p(e),
                    t = Date.parse(String(n.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const i = Math.max(0, Date.now() - t);
                return { stale: i >= 3e4, missingTimestamp: !1, ageMs: i };
            })(o.queueState);
            return {
                ok: !0,
                stale: Boolean(n.stale),
                missingTimestamp: Boolean(n.missingTimestamp),
                ageMs: n.ageMs,
            };
        } catch (e) {
            return {
                ok: !1,
                stale: !1,
                reason: 'fetch_error',
                errorMessage: e.message,
            };
        } finally {
            o.queueRefreshBusy = !1;
        }
    }
    function J(e, n) {
        const i = s('ticketResult');
        if (!i) return;
        const c = e?.data || {},
            u = {
                ...c,
                id: Number(c?.id || c?.ticket_id || 0) || 0,
                ticketCode: String(c?.ticketCode || c?.ticket_code || '--'),
                patientInitials: String(
                    c?.patientInitials || c?.patient_initials || '--'
                ),
                queueType: String(c?.queueType || c?.queue_type || 'walk_in'),
                createdAt: String(
                    c?.createdAt || c?.created_at || new Date().toISOString()
                ),
            },
            l = e?.print || {};
        !(function (e, { origin: n = 'ticket' } = {}) {
            const i = e?.print || {};
            ((o.printerState = {
                ok: Boolean(i.ok),
                printed: Boolean(e?.printed),
                errorCode: String(i.errorCode || ''),
                message: String(i.message || ''),
                at: new Date().toISOString(),
            }),
                (function () {
                    try {
                        localStorage.setItem(t, JSON.stringify(o.printerState));
                    } catch (e) {}
                })(),
                C(),
                a('printer_result', {
                    origin: n,
                    ok: o.printerState.ok,
                    printed: o.printerState.printed,
                    errorCode: o.printerState.errorCode,
                }));
        })(e, { origin: n });
        const d = Array.isArray(o.queueState?.nextTickets)
                ? o.queueState.nextTickets
                : [],
            f = d.find((e) => Number(e.id) === Number(u.id))?.position || '-',
            m = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${r(l.message || 'sin detalle')})`;
        i.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${r(n)}</p>\n            <div class="ticket-result-main">\n                <strong>${r(u.ticketCode || '--')}</strong>\n                <span>${r(u.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${r(f)}</dd></div>\n                <div><dt>Tipo</dt><dd>${r(u.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${r(j(u.createdAt))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">${m}</p>\n        </article>\n    `;
    }
    function U({
        originLabel: e,
        patientInitials: n,
        queueType: t,
        queuedAt: i,
    }) {
        const a = s('ticketResult');
        a &&
            (a.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Solicitud guardada offline</h3>\n            <p class="ticket-result-origin">${r(e)}</p>\n            <div class="ticket-result-main">\n                <strong>${r(`PEND-${String(o.offlineOutbox.length).padStart(2, '0')}`)}</strong>\n                <span>${r(n || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>\n                <div><dt>Tipo</dt><dd>${r(t || '--')}</dd></div>\n                <div><dt>Guardado</dt><dd>${r(j(i))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>\n        </article>\n    `);
    }
    function Q(e) {
        if (!1 === navigator.onLine) return !0;
        const n = String(e?.message || '').toLowerCase();
        return (
            !!n &&
            (n.includes('failed to fetch') ||
                n.includes('networkerror') ||
                n.includes('network request failed') ||
                n.includes('load failed') ||
                n.includes('network'))
        );
    }
    function W(e, n) {
        const t = String(e || '').toLowerCase(),
            i = (function (e) {
                const n = e && 'object' == typeof e ? e : {};
                return Object.keys(n)
                    .sort()
                    .reduce((e, t) => ((e[t] = n[t]), e), {});
            })(n);
        return `${t}:${JSON.stringify(i)}`;
    }
    function G({
        resource: e,
        body: n,
        originLabel: t,
        patientInitials: i,
        queueType: r,
    }) {
        const s = String(e || '');
        if ('queue-ticket' !== s && 'queue-checkin' !== s) return null;
        const c = W(s, n),
            u = Date.now(),
            l = o.offlineOutbox.find((e) => {
                if (String(e?.fingerprint || '') !== c) return !1;
                const n = Date.parse(String(e?.queuedAt || ''));
                return !!Number.isFinite(n) && u - n <= 9e4;
            });
        if (l)
            return (
                a('offline_queued_duplicate', { resource: s, fingerprint: c }),
                { ...l, deduped: !0 }
            );
        const d = {
            id: `offline_${Date.now()}_${Math.floor(1e5 * Math.random())}`,
            resource: s,
            body: n && 'object' == typeof n ? n : {},
            originLabel: String(t || 'Solicitud offline'),
            patientInitials: String(i || '--'),
            queueType: String(r || '--'),
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: '',
            fingerprint: c,
        };
        return (
            (o.offlineOutbox = [d, ...o.offlineOutbox].slice(0, 25)),
            N(),
            B(),
            a('offline_queued', {
                resource: s,
                queueSize: o.offlineOutbox.length,
            }),
            d
        );
    }
    async function V({
        source: e = 'auto',
        force: n = !1,
        maxItems: t = 4,
    } = {}) {
        if (o.offlineOutboxFlushBusy) return;
        if (!o.offlineOutbox.length) return;
        if (!n && !1 === navigator.onLine) return;
        ((o.offlineOutboxFlushBusy = !0), H(!0));
        let i = 0;
        try {
            for (
                ;
                o.offlineOutbox.length && i < Math.max(1, Number(t || 1));
            ) {
                const e = o.offlineOutbox[0];
                try {
                    const n = await g(e.resource, {
                        method: 'POST',
                        body: e.body,
                    });
                    (o.offlineOutbox.shift(),
                        N(),
                        B(),
                        J(n, `${e.originLabel} (sincronizado)`),
                        k(
                            `Pendiente sincronizado (${e.originLabel})`,
                            'success'
                        ),
                        a('offline_synced_item', {
                            resource: e.resource,
                            originLabel: e.originLabel,
                            pendingAfter: o.offlineOutbox.length,
                        }),
                        (i += 1));
                } catch (n) {
                    ((e.attempts = Number(e.attempts || 0) + 1),
                        (e.lastError = String(n?.message || '').slice(0, 180)),
                        (e.lastAttemptAt = new Date().toISOString()),
                        N(),
                        B());
                    const t = Q(n);
                    (k(
                        t
                            ? 'Sincronizacion offline pendiente: esperando reconexion.'
                            : `Pendiente con error: ${n.message}`,
                        t ? 'info' : 'error'
                    ),
                        a('offline_sync_error', {
                            resource: e.resource,
                            retryingOffline: t,
                            error: String(n?.message || ''),
                        }));
                    break;
                }
            }
            i > 0 &&
                ((o.queueFailureStreak = 0),
                (await K()).ok &&
                    ((o.queueLastHealthySyncAt = Date.now()),
                    b('live', 'Cola conectada'),
                    T(`Outbox sincronizado desde ${e}. (${P()})`),
                    a('offline_synced_batch', {
                        source: e,
                        processed: i,
                        pendingAfter: o.offlineOutbox.length,
                    })));
        } finally {
            ((o.offlineOutboxFlushBusy = !1), I());
        }
    }
    async function Y(e) {
        if (
            (e.preventDefault(),
            x(),
            ne({ reason: 'form_submit' }),
            !(e.currentTarget instanceof HTMLFormElement))
        )
            return;
        const n = s('checkinPhone'),
            t = s('checkinTime'),
            i = s('checkinDate'),
            a = s('checkinInitials'),
            r = s('checkinSubmit'),
            u = n instanceof HTMLInputElement ? n.value.trim() : '',
            l = t instanceof HTMLInputElement ? t.value.trim() : '',
            d = i instanceof HTMLInputElement ? i.value.trim() : '',
            f = a instanceof HTMLInputElement ? a.value.trim() : '';
        if (!u || !l || !d)
            return (
                k(
                    'Telefono, fecha y hora son obligatorios para check-in',
                    'error'
                ),
                void c(
                    'Completa telefono, fecha y hora para continuar.',
                    'warn'
                )
            );
        r instanceof HTMLButtonElement && (r.disabled = !0);
        try {
            const e = { telefono: u, hora: l, fecha: d, patientInitials: f },
                n = await g('queue-checkin', { method: 'POST', body: e });
            (k('Check-in registrado correctamente', 'success'),
                c(
                    'Check-in completado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                J(n, n.replay ? 'Check-in ya existente' : 'Check-in de cita'),
                (o.queueFailureStreak = 0),
                (await K()).ok ||
                    b(
                        'reconnecting',
                        'Check-in registrado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (Q(e)) {
                const e = G({
                    resource: 'queue-checkin',
                    body: {
                        telefono: u,
                        hora: l,
                        fecha: d,
                        patientInitials: f,
                    },
                    originLabel: 'Check-in de cita',
                    patientInitials: f || u.slice(-2),
                    queueType: 'appointment',
                });
                if (e)
                    return (
                        b('offline', 'Sin conexion al backend'),
                        T(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        U({
                            originLabel: e.originLabel,
                            patientInitials: e.patientInitials,
                            queueType: e.queueType,
                            queuedAt: e.queuedAt,
                        }),
                        k(
                            e.deduped
                                ? 'Check-in ya pendiente offline. Se sincronizara automaticamente.'
                                : 'Check-in guardado offline. Se sincronizara automaticamente.',
                            'info'
                        ),
                        void c(
                            'Check-in guardado offline. Recepcion confirmara al reconectar.',
                            'warn'
                        )
                    );
            }
            (k(`No se pudo registrar el check-in: ${e.message}`, 'error'),
                c(
                    'No se pudo confirmar check-in. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            r instanceof HTMLButtonElement && (r.disabled = !1);
        }
    }
    async function Z(e) {
        (e.preventDefault(), x(), ne({ reason: 'form_submit' }));
        const n = s('walkinName'),
            t = s('walkinInitials'),
            i = s('walkinPhone'),
            a = s('walkinSubmit'),
            r = n instanceof HTMLInputElement ? n.value.trim() : '',
            u =
                (t instanceof HTMLInputElement ? t.value.trim() : '') ||
                (function (e) {
                    const n = String(e || '').trim();
                    if (!n) return '';
                    const t = n
                        .toUpperCase()
                        .split(/\s+/)
                        .map((e) => e.replace(/[^A-Z]/g, ''))
                        .filter(Boolean);
                    if (0 === t.length) return '';
                    let i = '';
                    for (const e of t)
                        if (((i += e.slice(0, 1)), i.length >= 3)) break;
                    return i.slice(0, 4);
                })(r),
            l = i instanceof HTMLInputElement ? i.value.trim() : '';
        if (!u)
            return (
                k('Ingresa iniciales o nombre para generar el turno', 'error'),
                void c('Escribe iniciales para generar tu turno.', 'warn')
            );
        a instanceof HTMLButtonElement && (a.disabled = !0);
        try {
            const e = { patientInitials: u, name: r, phone: l },
                n = await g('queue-ticket', { method: 'POST', body: e });
            (k('Turno walk-in registrado correctamente', 'success'),
                c(
                    'Turno generado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                J(n, 'Turno sin cita'),
                (o.queueFailureStreak = 0),
                (await K()).ok ||
                    b(
                        'reconnecting',
                        'Turno creado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (Q(e)) {
                const e = G({
                    resource: 'queue-ticket',
                    body: { patientInitials: u, name: r, phone: l },
                    originLabel: 'Turno sin cita',
                    patientInitials: u,
                    queueType: 'walk_in',
                });
                if (e)
                    return (
                        b('offline', 'Sin conexion al backend'),
                        T(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        U({
                            originLabel: e.originLabel,
                            patientInitials: e.patientInitials,
                            queueType: e.queueType,
                            queuedAt: e.queuedAt,
                        }),
                        k(
                            e.deduped
                                ? 'Turno ya pendiente offline. Se sincronizara automaticamente.'
                                : 'Turno guardado offline. Se sincronizara automaticamente.',
                            'info'
                        ),
                        void c(
                            'Turno guardado offline. Recepcion lo sincronizara al reconectar.',
                            'warn'
                        )
                    );
            }
            (k(`No se pudo crear el turno: ${e.message}`, 'error'),
                c(
                    'No se pudo generar turno. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            a instanceof HTMLButtonElement && (a.disabled = !1);
        }
    }
    function X(e, n) {
        const t = s('assistantMessages');
        if (!t) return;
        const i = document.createElement('article');
        ((i.className = `assistant-message assistant-message-${e}`),
            (i.innerHTML = `<p>${r(n)}</p>`),
            t.appendChild(i),
            (t.scrollTop = t.scrollHeight));
    }
    async function ee(e) {
        if ((e.preventDefault(), x(), o.assistantBusy)) return;
        const n = s('assistantInput'),
            t = s('assistantSend');
        if (!(n instanceof HTMLInputElement)) return;
        const i = n.value.trim();
        if (i) {
            (X('user', i),
                (n.value = ''),
                (o.assistantBusy = !0),
                t instanceof HTMLButtonElement && (t.disabled = !0));
            try {
                const e = [
                        {
                            role: 'system',
                            content:
                                'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                        },
                        ...o.chatHistory.slice(-6),
                        { role: 'user', content: i },
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
                    t = await n.json(),
                    a = (function (e) {
                        const n = String(e || '')
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '');
                        if (
                            /(diagnost|medicacion|tratamiento medico|receta|dosis|enfermedad)/.test(
                                n
                            )
                        )
                            return 'En este kiosco solo puedo ayudarte con turnos y orientacion de sala. Para consulta medica, acude a recepcion.';
                        return (
                            String(e || '').trim() ||
                            'Puedo ayudarte con turnos, check-in y ubicacion de consultorios.'
                        );
                    })(String(t?.choices?.[0]?.message?.content || '').trim());
                (X('bot', a),
                    (o.chatHistory = [
                        ...o.chatHistory,
                        { role: 'user', content: i },
                        { role: 'assistant', content: a },
                    ].slice(-8)));
            } catch (e) {
                X(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                );
            } finally {
                ((o.assistantBusy = !1),
                    t instanceof HTMLButtonElement && (t.disabled = !1));
            }
        }
    }
    function ne({ reason: e = 'auto' } = {}) {
        if (o.welcomeDismissed) return;
        o.welcomeDismissed = !0;
        const n = s('kioskWelcomeScreen');
        n instanceof HTMLElement &&
            (n.classList.add('is-hidden'),
            window.setTimeout(() => {
                n.parentElement && n.remove();
            }, 700),
            a('welcome_dismissed', { reason: e }));
    }
    function te() {
        const e = s('checkinDate');
        e instanceof HTMLInputElement &&
            !e.value &&
            (e.value = new Date().toISOString().slice(0, 10));
    }
    function ie({ immediate: e = !1 } = {}) {
        if ((R(), !o.queuePollingEnabled)) return;
        const n = e ? 0 : F();
        o.queueTimerId = window.setTimeout(() => {
            oe();
        }, n);
    }
    async function oe() {
        if (!o.queuePollingEnabled) return;
        if (document.hidden)
            return (
                b('paused', 'Cola en pausa (pestana oculta)'),
                T('Pestana oculta. Turnero en pausa temporal.'),
                void ie()
            );
        if (!1 === navigator.onLine)
            return (
                (o.queueFailureStreak += 1),
                b('offline', 'Sin conexion al backend'),
                T(
                    'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
                ),
                B(),
                void ie()
            );
        await V({ source: 'poll' });
        const e = await K();
        if (e.ok && !e.stale)
            ((o.queueFailureStreak = 0),
                (o.queueLastHealthySyncAt = Date.now()),
                b('live', 'Cola conectada'),
                T(
                    `Operacion estable (${P()}). Kiosco disponible para turnos.`
                ));
        else if (e.ok && e.stale) {
            o.queueFailureStreak += 1;
            const n = D(e.ageMs || 0);
            (b('reconnecting', `Watchdog: cola estancada ${n}`),
                T(
                    `Cola degradada: sin cambios en ${n}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
                ));
        } else {
            o.queueFailureStreak += 1;
            const e = Math.max(1, Math.ceil(F() / 1e3));
            (b('reconnecting', `Reintentando en ${e}s`),
                T(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        (B(), ie());
    }
    async function ae() {
        if (!o.queueManualRefreshBusy) {
            (x(),
                (o.queueManualRefreshBusy = !0),
                _(!0),
                b('reconnecting', 'Refrescando manualmente...'));
            try {
                await V({ source: 'manual' });
                const e = await K();
                if (e.ok && !e.stale)
                    return (
                        (o.queueFailureStreak = 0),
                        (o.queueLastHealthySyncAt = Date.now()),
                        b('live', 'Cola conectada'),
                        void T(`Sincronizacion manual exitosa (${P()}).`)
                    );
                if (e.ok && e.stale) {
                    const n = D(e.ageMs || 0);
                    return (
                        b('reconnecting', `Watchdog: cola estancada ${n}`),
                        void T(
                            `Persisten datos estancados (${n}). Verifica backend o recepcion.`
                        )
                    );
                }
                const n = Math.max(1, Math.ceil(F() / 1e3));
                (b(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion al backend'
                        : `Reintentando en ${n}s`
                ),
                    T(
                        !1 === navigator.onLine
                            ? 'Sin internet. Opera manualmente en recepcion.'
                            : `Refresh manual sin exito. Reintento automatico en ${n}s.`
                    ));
            } finally {
                (B(), (o.queueManualRefreshBusy = !1), _(!1));
            }
        }
    }
    function re({ immediate: e = !0 } = {}) {
        if (((o.queuePollingEnabled = !0), e))
            return (b('live', 'Sincronizando cola...'), void oe());
        ie();
    }
    function se({ reason: e = 'paused' } = {}) {
        ((o.queuePollingEnabled = !1), (o.queueFailureStreak = 0), R());
        const n = String(e || 'paused').toLowerCase();
        return 'offline' === n
            ? (b('offline', 'Sin conexion al backend'),
              T('Sin conexion. Esperando reconexion para reanudar cola.'),
              void B())
            : 'hidden' === n
              ? (b('paused', 'Cola en pausa (pestana oculta)'),
                void T('Pestana oculta. Reanudando al volver a primer plano.'))
              : (b('paused', 'Cola en pausa'),
                T('Sincronizacion pausada por navegacion.'),
                void B());
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((document.body.dataset.kioskMode = 'star'),
            (function () {
                if (document.getElementById(i)) return;
                const e = document.createElement('style');
                ((e.id = i),
                    (e.textContent =
                        "\n        body[data-kiosk-mode='star'] .kiosk-header {\n            border-bottom-color: color-mix(in srgb, var(--primary) 18%, var(--border));\n            box-shadow: 0 10px 28px rgb(15 31 54 / 10%);\n        }\n        .kiosk-header-tools {\n            display: grid;\n            gap: 0.35rem;\n            justify-items: end;\n        }\n        .kiosk-header-help-btn {\n            border: 1px solid var(--border);\n            border-radius: 999px;\n            padding: 0.34rem 0.72rem;\n            background: var(--surface-soft);\n            color: var(--text);\n            font-size: 0.86rem;\n            font-weight: 600;\n            cursor: pointer;\n            min-height: 44px;\n        }\n        .kiosk-header-help-btn[data-open='true'] {\n            border-color: color-mix(in srgb, var(--primary) 38%, #fff 62%);\n            background: color-mix(in srgb, var(--surface-strong) 84%, #fff 16%);\n            color: var(--primary-strong);\n        }\n        .kiosk-quick-actions {\n            display: grid;\n            grid-template-columns: repeat(2, minmax(0, 1fr));\n            gap: 0.65rem;\n            margin: 0.45rem 0 0.6rem;\n        }\n        .kiosk-quick-action {\n            border: 1px solid var(--border);\n            border-radius: 16px;\n            padding: 0.8rem 0.92rem;\n            background: var(--surface-soft);\n            color: var(--text);\n            font-size: 1rem;\n            font-weight: 700;\n            letter-spacing: 0.01em;\n            cursor: pointer;\n            min-height: 64px;\n            text-align: left;\n        }\n        .kiosk-quick-action[data-active='true'] {\n            border-color: color-mix(in srgb, var(--primary) 42%, #fff 58%);\n            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);\n            color: var(--primary-strong);\n            box-shadow: 0 12px 26px rgb(15 107 220 / 14%);\n        }\n        .kiosk-progress-hint {\n            margin: 0 0 0.72rem;\n            color: var(--muted);\n            font-size: 0.95rem;\n            font-weight: 600;\n        }\n        .kiosk-progress-hint[data-tone='success'] {\n            color: var(--success);\n        }\n        .kiosk-progress-hint[data-tone='warn'] {\n            color: #9a6700;\n        }\n        .kiosk-quick-help-panel {\n            margin: 0 0 0.9rem;\n            border: 1px solid color-mix(in srgb, var(--primary) 24%, #fff 76%);\n            border-radius: 16px;\n            padding: 0.88rem 0.95rem;\n            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);\n        }\n        .kiosk-quick-help-panel h2 {\n            margin: 0 0 0.46rem;\n            font-size: 1.08rem;\n        }\n        .kiosk-quick-help-panel ol {\n            margin: 0 0 0.56rem;\n            padding-left: 1.12rem;\n            color: var(--text);\n            line-height: 1.45;\n        }\n        .kiosk-quick-help-panel p {\n            margin: 0 0 0.6rem;\n            color: var(--muted);\n            font-size: 0.9rem;\n        }\n        .kiosk-quick-help-panel button {\n            border: 1px solid var(--border);\n            border-radius: 12px;\n            padding: 0.46rem 0.74rem;\n            background: #fff;\n            color: var(--text);\n            font-weight: 600;\n            cursor: pointer;\n            min-height: 44px;\n        }\n        .kiosk-form.is-flow-active {\n            border-color: color-mix(in srgb, var(--primary) 32%, var(--border) 68%);\n            box-shadow: 0 14px 28px rgb(15 107 220 / 11%);\n        }\n        .kiosk-quick-action:focus-visible,\n        .kiosk-header-help-btn:focus-visible,\n        .kiosk-quick-help-panel button:focus-visible {\n            outline: 3px solid color-mix(in srgb, var(--primary) 62%, #fff 38%);\n            outline-offset: 2px;\n        }\n        @media (max-width: 760px) {\n            .kiosk-header-tools {\n                justify-items: start;\n            }\n            .kiosk-quick-actions {\n                grid-template-columns: 1fr;\n            }\n        }\n        @media (prefers-reduced-motion: reduce) {\n            .kiosk-quick-action,\n            .kiosk-header-help-btn,\n            .kiosk-form {\n                transition: none !important;\n            }\n        }\n    "),
                    document.head.appendChild(e));
            })(),
            (o.idleResetMs = (function () {
                const n = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS),
                    t = Number.isFinite(n) ? n : 9e4;
                return Math.min(e, Math.max(5e3, Math.round(t)));
            })()),
            (function () {
                const e = 'light';
                var n;
                (localStorage.setItem('kioskThemeMode', e),
                    (n = e),
                    (o.themeMode = n),
                    (document.documentElement.dataset.theme = 'light'),
                    document
                        .querySelectorAll('[data-theme-mode]')
                        .forEach((e) => {
                            const t = e.getAttribute('data-theme-mode');
                            (e.classList.toggle('is-active', t === n),
                                e.setAttribute(
                                    'aria-pressed',
                                    String(t === n)
                                ));
                        }));
            })(),
            (function () {
                const e = s('kioskWelcomeScreen');
                e instanceof HTMLElement &&
                    (e.classList.add('is-visible'),
                    c(
                        'Bienvenida: en segundos podras elegir tu tipo de atencion.',
                        'info'
                    ),
                    window.setTimeout(() => {
                        ne({ reason: 'auto' });
                    }, 1800),
                    window.setTimeout(() => {
                        ne({ reason: 'safety_timeout' });
                    }, 2600));
            })(),
            te());
        const a = s('checkinForm'),
            r = s('walkinForm'),
            d = s('assistantForm');
        (a instanceof HTMLFormElement && a.addEventListener('submit', Y),
            r instanceof HTMLFormElement && r.addEventListener('submit', Z),
            d instanceof HTMLFormElement && d.addEventListener('submit', ee),
            (function () {
                const e = s('kioskQuickCheckin'),
                    n = s('kioskQuickWalkin'),
                    t = s('kioskHelpToggle'),
                    i = s('kioskHelpClose');
                (e instanceof HTMLButtonElement &&
                    e.addEventListener('click', () => {
                        (x(), l('checkin'));
                    }),
                    n instanceof HTMLButtonElement &&
                        n.addEventListener('click', () => {
                            (x(), l('walkin'));
                        }),
                    t instanceof HTMLButtonElement &&
                        t.addEventListener('click', () => {
                            (x(), u(!o.quickHelpOpen, { source: 'toggle' }));
                        }),
                    i instanceof HTMLButtonElement &&
                        i.addEventListener('click', () => {
                            (x(), u(!1, { source: 'close_button' }));
                        }));
            })(),
            u(!1, { source: 'init' }),
            (function () {
                let e = s('kioskSessionGuard');
                if (e instanceof HTMLElement) return e;
                const n = s('kioskStatus');
                if (!(n instanceof HTMLElement)) return null;
                ((e = document.createElement('div')),
                    (e.id = 'kioskSessionGuard'),
                    (e.className = 'kiosk-session-guard'));
                const t = document.createElement('span');
                ((t.id = 'kioskSessionCountdown'),
                    (t.className = 'kiosk-session-countdown'),
                    (t.textContent = 'Privacidad auto: --:--'));
                const i = document.createElement('button');
                ((i.id = 'kioskSessionResetBtn'),
                    (i.type = 'button'),
                    (i.className = 'kiosk-session-reset'),
                    (i.textContent = 'Nueva persona / limpiar pantalla'),
                    e.appendChild(t),
                    e.appendChild(i),
                    n.insertAdjacentElement('afterend', e));
            })());
        const f = s('kioskSessionResetBtn');
        (f instanceof HTMLButtonElement &&
            f.addEventListener('click', () => {
                w({ reason: 'manual' });
            }),
            S(),
            y(),
            l('checkin', { announce: !1 }),
            c('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((e) => {
                document.addEventListener(
                    e,
                    () => {
                        x();
                    },
                    !0
                );
            }),
            v(),
            q(),
            L(),
            M(),
            O(),
            (function () {
                try {
                    const e = localStorage.getItem(n);
                    if (!e) return void (o.offlineOutbox = []);
                    const t = JSON.parse(e);
                    if (!Array.isArray(t)) return void (o.offlineOutbox = []);
                    o.offlineOutbox = t
                        .map((e) => ({
                            id: String(e?.id || ''),
                            resource: String(e?.resource || ''),
                            body:
                                e && 'object' == typeof e.body && e.body
                                    ? e.body
                                    : {},
                            originLabel: String(
                                e?.originLabel || 'Solicitud offline'
                            ),
                            patientInitials: String(e?.patientInitials || '--'),
                            queueType: String(e?.queueType || '--'),
                            queuedAt: String(
                                e?.queuedAt || new Date().toISOString()
                            ),
                            attempts: Number(e?.attempts || 0),
                            lastError: String(e?.lastError || ''),
                            fingerprint: String(e?.fingerprint || ''),
                        }))
                        .filter(
                            (e) =>
                                e.id &&
                                ('queue-ticket' === e.resource ||
                                    'queue-checkin' === e.resource)
                        )
                        .map((e) => ({
                            ...e,
                            fingerprint: e.fingerprint || W(e.resource, e.body),
                        }))
                        .slice(0, 25);
                } catch (e) {
                    o.offlineOutbox = [];
                }
            })(),
            (function () {
                try {
                    const e = localStorage.getItem(t);
                    if (!e) return void (o.printerState = null);
                    const n = JSON.parse(e);
                    if (!n || 'object' != typeof n)
                        return void (o.printerState = null);
                    o.printerState = {
                        ok: Boolean(n.ok),
                        printed: Boolean(n.printed),
                        errorCode: String(n.errorCode || ''),
                        message: String(n.message || ''),
                        at: String(n.at || new Date().toISOString()),
                    };
                } catch (e) {
                    o.printerState = null;
                }
            })(),
            C(),
            B());
        const m = $();
        m instanceof HTMLButtonElement &&
            m.addEventListener('click', () => {
                ae();
            });
        const p = s('queueOutboxRetryBtn');
        p instanceof HTMLButtonElement &&
            p.addEventListener('click', () => {
                V({ source: 'operator', force: !0, maxItems: 25 });
            });
        const g = s('queueOutboxDropOldestBtn');
        g instanceof HTMLButtonElement &&
            g.addEventListener('click', () => {
                !(function () {
                    if (!o.offlineOutbox.length) return;
                    const e = o.offlineOutbox[o.offlineOutbox.length - 1];
                    (o.offlineOutbox.pop(),
                        N(),
                        B(),
                        I(),
                        k(
                            `Descartado pendiente antiguo (${e?.originLabel || 'sin detalle'}).`,
                            'info'
                        ));
                })();
            });
        const h = s('queueOutboxClearBtn');
        (h instanceof HTMLButtonElement &&
            h.addEventListener('click', () => {
                A({ reason: 'manual' });
            }),
            b('paused', 'Sincronizacion lista'),
            T('Esperando primera sincronizacion de cola...'),
            z(''),
            !1 !== navigator.onLine && V({ source: 'startup', force: !0 }),
            re({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? se({ reason: 'hidden' })
                    : re({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                (V({ source: 'online', force: !0 }), re({ immediate: !0 }));
            }),
            window.addEventListener('offline', () => {
                (se({ reason: 'offline' }), B());
            }),
            window.addEventListener('beforeunload', () => {
                se({ reason: 'paused' });
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const n = String(e.code || '').toLowerCase();
                return 'keyr' === n
                    ? (e.preventDefault(), void ae())
                    : 'keyh' === n
                      ? (e.preventDefault(),
                        void u(!o.quickHelpOpen, { source: 'shortcut' }))
                      : 'digit1' === n
                        ? (e.preventDefault(), void l('checkin'))
                        : 'digit2' === n
                          ? (e.preventDefault(), void l('walkin'))
                          : 'keyl' === n
                            ? (e.preventDefault(), void w({ reason: 'manual' }))
                            : 'keyy' === n
                              ? (e.preventDefault(),
                                void V({
                                    source: 'shortcut',
                                    force: !0,
                                    maxItems: 25,
                                }))
                              : void (
                                    'keyk' === n &&
                                    (e.preventDefault(),
                                    A({ reason: 'manual' }))
                                );
            }));
    });
})();
