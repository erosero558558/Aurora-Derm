!(function () {
    'use strict';
    const e = 'kioskThemeMode',
        t = 9e5,
        n = 'queueKioskOfflineOutbox',
        i = {
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
        };
    function o(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function a(e) {
        return document.getElementById(e);
    }
    async function r(e, { method: t = 'GET', body: n } = {}) {
        const i = new URLSearchParams();
        (i.set('resource', e), i.set('t', String(Date.now())));
        const o = await fetch(`/api.php?${i.toString()}`, {
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
    function s(e, t = 'info') {
        const n = a('kioskStatus');
        n && ((n.textContent = e), (n.dataset.status = t));
    }
    function u(e, t) {
        const n = a('queueConnectionState');
        if (!n) return;
        const i = String(e || 'live').toLowerCase(),
            o = {
                live: 'Cola conectada',
                reconnecting: 'Reintentando conexion',
                offline: 'Sin conexion al backend',
                paused: 'Cola en pausa',
            };
        ((n.dataset.state = i),
            (n.textContent = String(t || '').trim() || o[i] || o.live));
    }
    function c() {
        const e = a('kioskSessionCountdown');
        if (!(e instanceof HTMLElement)) return;
        if (!i.idleDeadlineTs)
            return (
                (e.textContent = 'Privacidad auto: --:--'),
                (e.dataset.state = 'normal'),
                (e.style.color = 'var(--muted)'),
                void (e.style.borderColor = 'var(--border)')
            );
        const t = Math.max(0, i.idleDeadlineTs - Date.now());
        e.textContent = `Privacidad auto: ${(function (e) {
            const t = Math.max(0, Number(e || 0)),
                n = Math.ceil(t / 1e3);
            return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
        })(t)}`;
        const n = t <= 2e4;
        ((e.dataset.state = n ? 'warning' : 'normal'),
            (e.style.color = n ? 'var(--danger)' : 'var(--muted)'),
            (e.style.borderColor = n ? 'var(--danger)' : 'var(--border)'));
    }
    function l() {
        const e = a('ticketResult');
        e &&
            (e.innerHTML =
                '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>');
    }
    function d() {
        const e = a('assistantMessages');
        (e && (e.innerHTML = ''),
            (i.chatHistory = []),
            z(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ));
        const t = a('assistantInput');
        t instanceof HTMLInputElement && (t.value = '');
    }
    function m({ durationMs: e = null } = {}) {
        const n = Math.min(
            t,
            Math.max(
                5e3,
                Math.round(
                    Number.isFinite(Number(e)) ? Number(e) : i.idleResetMs
                )
            )
        );
        (i.idleTimerId &&
            (window.clearTimeout(i.idleTimerId), (i.idleTimerId = 0)),
            i.idleTickId &&
                (window.clearInterval(i.idleTickId), (i.idleTickId = 0)),
            (i.idleDeadlineTs = Date.now() + n),
            c(),
            (i.idleTickId = window.setInterval(() => {
                c();
            }, 1e3)),
            (i.idleTimerId = window.setTimeout(() => {
                if (i.assistantBusy || i.queueManualRefreshBusy)
                    return (
                        s(
                            'Sesion activa. Reprogramando limpieza automatica.',
                            'info'
                        ),
                        void m({ durationMs: 15e3 })
                    );
                p({ reason: 'idle_timeout' });
            }, n)));
    }
    function f() {
        m();
    }
    function p({ reason: e = 'manual' } = {}) {
        (!(function () {
            const e = a('checkinForm'),
                t = a('walkinForm');
            (e instanceof HTMLFormElement && e.reset(),
                t instanceof HTMLFormElement && t.reset(),
                U());
        })(),
            d(),
            l(),
            s(
                'idle_timeout' === e
                    ? 'Sesion reiniciada por inactividad para proteger privacidad.'
                    : 'Pantalla limpiada. Lista para el siguiente paciente.',
                'info'
            ),
            q(),
            m());
    }
    function g() {
        let e = a('queueOpsHint');
        if (e) return e;
        const t = document.querySelector('.kiosk-side .kiosk-card'),
            n = a('queueUpdatedAt');
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
        const t = g();
        t && (t.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function b() {
        let e = a('queueOutboxHint');
        if (e) return e;
        const t = g();
        return t?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queueOutboxHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Pendientes offline: 0'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function h(e) {
        const t = b();
        t &&
            (t.textContent = String(e || '').trim() || 'Pendientes offline: 0');
    }
    function k() {
        let e = a('queueOutboxConsole');
        if (e instanceof HTMLElement) return e;
        const t = b();
        return t?.parentElement
            ? ((e = document.createElement('section')),
              (e.id = 'queueOutboxConsole'),
              (e.style.border = '1px solid var(--border)'),
              (e.style.borderRadius = '0.75rem'),
              (e.style.padding = '0.55rem 0.65rem'),
              (e.style.marginBottom = '0.65rem'),
              (e.style.background = 'var(--surface-soft)'),
              (e.innerHTML =
                  '\n        <p id="queueOutboxSummary" class="queue-updated-at">Outbox: 0 pendientes</p>\n        <div style="display:flex;flex-wrap:wrap;gap:0.45rem;margin:0.25rem 0 0.45rem;">\n            <button id="queueOutboxRetryBtn" type="button" style="border:1px solid var(--border);border-radius:0.6rem;padding:0.34rem 0.55rem;background:var(--surface);color:var(--text);cursor:pointer;">Sincronizar pendientes</button>\n            <button id="queueOutboxDropOldestBtn" type="button" style="border:1px solid var(--border);border-radius:0.6rem;padding:0.34rem 0.55rem;background:var(--surface);color:var(--text);cursor:pointer;">Descartar mas antiguo</button>\n            <button id="queueOutboxClearBtn" type="button" style="border:1px solid var(--border);border-radius:0.6rem;padding:0.34rem 0.55rem;background:var(--surface);color:var(--text);cursor:pointer;">Limpiar pendientes</button>\n        </div>\n        <ol id="queueOutboxList" style="margin:0;padding-left:1.1rem;display:grid;gap:0.35rem;">\n            <li class="queue-empty">Sin pendientes offline.</li>\n        </ol>\n        <p class="queue-updated-at" style="margin-top:0.45rem;">Atajos: Alt+Shift+Y sincroniza pendientes, Alt+Shift+K limpia pendientes.</p>\n    '),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function v(e) {
        const t = a('queueOutboxRetryBtn'),
            n = a('queueOutboxClearBtn'),
            o = a('queueOutboxDropOldestBtn');
        (t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e) || !i.offlineOutbox.length),
            (t.textContent = e
                ? 'Sincronizando...'
                : 'Sincronizar pendientes')),
            n instanceof HTMLButtonElement &&
                (n.disabled = Boolean(e) || !i.offlineOutbox.length),
            o instanceof HTMLButtonElement &&
                (o.disabled = Boolean(e) || i.offlineOutbox.length <= 0));
    }
    function S() {
        k();
        const e = a('queueOutboxSummary'),
            t = a('queueOutboxList'),
            n = i.offlineOutbox.length;
        (e instanceof HTMLElement &&
            (e.textContent =
                n <= 0 ? 'Outbox: 0 pendientes' : `Outbox: ${n} pendiente(s)`),
            t instanceof HTMLElement &&
                (t.innerHTML =
                    n <= 0
                        ? '<li class="queue-empty">Sin pendientes offline.</li>'
                        : i.offlineOutbox
                              .slice(0, 6)
                              .map((e, t) => {
                                  const n = H(e.queuedAt),
                                      i = Number(e.attempts || 0);
                                  return `<li><strong>${o(e.originLabel)}</strong> · ${o(e.patientInitials || '--')} · ${o(e.queueType || '--')} · ${o(n)} · intento ${t + 1}/${Math.max(1, i + 1)}</li>`;
                              })
                              .join('')),
            v(!1));
    }
    function x({ reason: e = 'manual' } = {}) {
        ((i.offlineOutbox = []),
            T(),
            q(),
            S(),
            'manual' === e &&
                s('Pendientes offline limpiados manualmente.', 'info'));
    }
    function T() {
        try {
            localStorage.setItem(n, JSON.stringify(i.offlineOutbox));
        } catch (e) {}
    }
    function q() {
        const e = i.offlineOutbox.length;
        if (e <= 0)
            return (h('Pendientes offline: 0 (sin pendientes).'), void S());
        const t = Date.parse(String(i.offlineOutbox[0]?.queuedAt || ''));
        (h(
            `Pendientes offline: ${e} - sincronizacion automatica al reconectar${Number.isFinite(t) ? ` - mas antiguo ${E(Date.now() - t)}` : ''}`
        ),
            S());
    }
    function L() {
        let e = a('queueManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = a('queueUpdatedAt');
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
    function M(e) {
        const t = L();
        t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e)),
            (t.textContent = e
                ? 'Actualizando cola...'
                : 'Reintentar sincronizacion'));
    }
    function E(e) {
        const t = Math.max(0, Number(e || 0)),
            n = Math.round(t / 1e3);
        if (n < 60) return `${n}s`;
        const i = Math.floor(n / 60),
            o = n % 60;
        return o <= 0 ? `${i}m` : `${i}m ${o}s`;
    }
    function w() {
        return i.queueLastHealthySyncAt
            ? `hace ${E(Date.now() - i.queueLastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function O(e) {
        const t = a('queueUpdatedAt');
        if (!t) return;
        const n = Date.parse(String(e || ''));
        Number.isFinite(n)
            ? (t.textContent = `Actualizado ${new Date(n).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (t.textContent = 'Actualizacion pendiente');
    }
    function C() {
        const e = Math.max(0, Number(i.queueFailureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function I() {
        i.queueTimerId &&
            (window.clearTimeout(i.queueTimerId), (i.queueTimerId = 0));
    }
    function H(e) {
        const t = Date.parse(String(e || ''));
        return Number.isFinite(t)
            ? new Date(t).toLocaleString('es-EC', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
              })
            : '--';
    }
    async function $() {
        if (i.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        i.queueRefreshBusy = !0;
        try {
            const e = await r('queue-state');
            ((i.queueState = e.data || {}),
                (function (e) {
                    const t = a('queueWaitingCount'),
                        n = a('queueCalledCount'),
                        i = a('queueCallingNow'),
                        r = a('queueNextList');
                    if (
                        (t && (t.textContent = String(e?.waitingCount || 0)),
                        n && (n.textContent = String(e?.calledCount || 0)),
                        i)
                    ) {
                        const t = Array.isArray(e?.callingNow)
                            ? e.callingNow
                            : [];
                        0 === t.length
                            ? (i.innerHTML =
                                  '<p class="queue-empty">Sin llamados activos.</p>')
                            : (i.innerHTML = t
                                  .map(
                                      (e) =>
                                          `\n                        <article class="queue-called-card">\n                            <header>Consultorio ${o(e.assignedConsultorio)}</header>\n                            <strong>${o(e.ticketCode || '--')}</strong>\n                            <span>${o(e.patientInitials || '--')}</span>\n                        </article>\n                    `
                                  )
                                  .join(''));
                    }
                    if (r) {
                        const t = Array.isArray(e?.nextTickets)
                            ? e.nextTickets
                            : [];
                        0 === t.length
                            ? (r.innerHTML =
                                  '<li class="queue-empty">No hay turnos en espera.</li>')
                            : (r.innerHTML = t
                                  .map(
                                      (e) =>
                                          `\n                        <li>\n                            <span class="ticket-code">${o(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${o(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${o(e.position || '-')}</span>\n                        </li>\n                    `
                                  )
                                  .join(''));
                    }
                })(i.queueState),
                O(i.queueState?.updatedAt));
            const t = (function (e) {
                const t = Date.parse(String(e?.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const n = Math.max(0, Date.now() - t);
                return { stale: n >= 3e4, missingTimestamp: !1, ageMs: n };
            })(i.queueState);
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
            i.queueRefreshBusy = !1;
        }
    }
    function B(e, t) {
        const n = a('ticketResult');
        if (!n) return;
        const r = e?.data || {},
            s = e?.print || {},
            u = Array.isArray(i.queueState?.nextTickets)
                ? i.queueState.nextTickets
                : [],
            c = u.find((e) => Number(e.id) === Number(r.id))?.position || '-',
            l = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${o(s.message || 'sin detalle')})`;
        n.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${o(t)}</p>\n            <div class="ticket-result-main">\n                <strong>${o(r.ticketCode || '--')}</strong>\n                <span>${o(r.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${o(c)}</dd></div>\n                <div><dt>Tipo</dt><dd>${o(r.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${o(H(r.createdAt))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">${l}</p>\n        </article>\n    `;
    }
    function A({
        originLabel: e,
        patientInitials: t,
        queueType: n,
        queuedAt: r,
    }) {
        const s = a('ticketResult');
        s &&
            (s.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Solicitud guardada offline</h3>\n            <p class="ticket-result-origin">${o(e)}</p>\n            <div class="ticket-result-main">\n                <strong>${o(`PEND-${String(i.offlineOutbox.length).padStart(2, '0')}`)}</strong>\n                <span>${o(t || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>\n                <div><dt>Tipo</dt><dd>${o(n || '--')}</dd></div>\n                <div><dt>Guardado</dt><dd>${o(H(r))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>\n        </article>\n    `);
    }
    function D(e) {
        if (!1 === navigator.onLine) return !0;
        const t = String(e?.message || '').toLowerCase();
        return (
            !!t &&
            (t.includes('failed to fetch') ||
                t.includes('networkerror') ||
                t.includes('network request failed') ||
                t.includes('load failed') ||
                t.includes('network'))
        );
    }
    function R({
        resource: e,
        body: t,
        originLabel: n,
        patientInitials: o,
        queueType: a,
    }) {
        const r = String(e || '');
        if ('queue-ticket' !== r && 'queue-checkin' !== r) return null;
        const s = {
            id: `offline_${Date.now()}_${Math.floor(1e5 * Math.random())}`,
            resource: r,
            body: t && 'object' == typeof t ? t : {},
            originLabel: String(n || 'Solicitud offline'),
            patientInitials: String(o || '--'),
            queueType: String(a || '--'),
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: '',
        };
        return (
            (i.offlineOutbox = [s, ...i.offlineOutbox].slice(0, 25)),
            T(),
            q(),
            s
        );
    }
    async function N({
        source: e = 'auto',
        force: t = !1,
        maxItems: n = 4,
    } = {}) {
        if (i.offlineOutboxFlushBusy) return;
        if (!i.offlineOutbox.length) return;
        if (!t && !1 === navigator.onLine) return;
        ((i.offlineOutboxFlushBusy = !0), v(!0));
        let o = 0;
        try {
            for (
                ;
                i.offlineOutbox.length && o < Math.max(1, Number(n || 1));
            ) {
                const e = i.offlineOutbox[0];
                try {
                    const t = await r(e.resource, {
                        method: 'POST',
                        body: e.body,
                    });
                    (i.offlineOutbox.shift(),
                        T(),
                        q(),
                        B(t, `${e.originLabel} (sincronizado)`),
                        s(
                            `Pendiente sincronizado (${e.originLabel})`,
                            'success'
                        ),
                        (o += 1));
                } catch (t) {
                    ((e.attempts = Number(e.attempts || 0) + 1),
                        (e.lastError = String(t?.message || '').slice(0, 180)),
                        (e.lastAttemptAt = new Date().toISOString()),
                        T(),
                        q());
                    const n = D(t);
                    s(
                        n
                            ? 'Sincronizacion offline pendiente: esperando reconexion.'
                            : `Pendiente con error: ${t.message}`,
                        n ? 'info' : 'error'
                    );
                    break;
                }
            }
            o > 0 &&
                ((i.queueFailureStreak = 0),
                (await $()).ok &&
                    ((i.queueLastHealthySyncAt = Date.now()),
                    u('live', 'Cola conectada'),
                    y(`Outbox sincronizado desde ${e}. (${w()})`)));
        } finally {
            ((i.offlineOutboxFlushBusy = !1), S());
        }
    }
    async function P(e) {
        if (
            (e.preventDefault(),
            f(),
            !(e.currentTarget instanceof HTMLFormElement))
        )
            return;
        const t = a('checkinPhone'),
            n = a('checkinTime'),
            o = a('checkinDate'),
            c = a('checkinInitials'),
            l = a('checkinSubmit'),
            d = t instanceof HTMLInputElement ? t.value.trim() : '',
            m = n instanceof HTMLInputElement ? n.value.trim() : '',
            p = o instanceof HTMLInputElement ? o.value.trim() : '',
            g = c instanceof HTMLInputElement ? c.value.trim() : '';
        if (d && m && p) {
            l instanceof HTMLButtonElement && (l.disabled = !0);
            try {
                const e = {
                        telefono: d,
                        hora: m,
                        fecha: p,
                        patientInitials: g,
                    },
                    t = await r('queue-checkin', { method: 'POST', body: e });
                (s('Check-in registrado correctamente', 'success'),
                    B(
                        t,
                        t.replay ? 'Check-in ya existente' : 'Check-in de cita'
                    ),
                    (i.queueFailureStreak = 0),
                    (await $()).ok ||
                        u(
                            'reconnecting',
                            'Check-in registrado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                if (D(e)) {
                    const e = R({
                        resource: 'queue-checkin',
                        body: {
                            telefono: d,
                            hora: m,
                            fecha: p,
                            patientInitials: g,
                        },
                        originLabel: 'Check-in de cita',
                        patientInitials: g || d.slice(-2),
                        queueType: 'appointment',
                    });
                    if (e)
                        return (
                            u('offline', 'Sin conexion al backend'),
                            y(
                                'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                            ),
                            A({
                                originLabel: e.originLabel,
                                patientInitials: e.patientInitials,
                                queueType: e.queueType,
                                queuedAt: e.queuedAt,
                            }),
                            void s(
                                'Check-in guardado offline. Se sincronizara automaticamente.',
                                'info'
                            )
                        );
                }
                s(`No se pudo registrar el check-in: ${e.message}`, 'error');
            } finally {
                l instanceof HTMLButtonElement && (l.disabled = !1);
            }
        } else
            s('Telefono, fecha y hora son obligatorios para check-in', 'error');
    }
    async function F(e) {
        (e.preventDefault(), f());
        const t = a('walkinName'),
            n = a('walkinInitials'),
            o = a('walkinPhone'),
            c = a('walkinSubmit'),
            l = t instanceof HTMLInputElement ? t.value.trim() : '',
            d =
                (n instanceof HTMLInputElement ? n.value.trim() : '') ||
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
                })(l),
            m = o instanceof HTMLInputElement ? o.value.trim() : '';
        if (d) {
            c instanceof HTMLButtonElement && (c.disabled = !0);
            try {
                const e = { patientInitials: d, name: l, phone: m },
                    t = await r('queue-ticket', { method: 'POST', body: e });
                (s('Turno walk-in registrado correctamente', 'success'),
                    B(t, 'Turno sin cita'),
                    (i.queueFailureStreak = 0),
                    (await $()).ok ||
                        u(
                            'reconnecting',
                            'Turno creado; pendiente sincronizar cola'
                        ));
            } catch (e) {
                if (D(e)) {
                    const e = R({
                        resource: 'queue-ticket',
                        body: { patientInitials: d, name: l, phone: m },
                        originLabel: 'Turno sin cita',
                        patientInitials: d,
                        queueType: 'walk_in',
                    });
                    if (e)
                        return (
                            u('offline', 'Sin conexion al backend'),
                            y(
                                'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                            ),
                            A({
                                originLabel: e.originLabel,
                                patientInitials: e.patientInitials,
                                queueType: e.queueType,
                                queuedAt: e.queuedAt,
                            }),
                            void s(
                                'Turno guardado offline. Se sincronizara automaticamente.',
                                'info'
                            )
                        );
                }
                s(`No se pudo crear el turno: ${e.message}`, 'error');
            } finally {
                c instanceof HTMLButtonElement && (c.disabled = !1);
            }
        } else s('Ingresa iniciales o nombre para generar el turno', 'error');
    }
    function z(e, t) {
        const n = a('assistantMessages');
        if (!n) return;
        const i = document.createElement('article');
        ((i.className = `assistant-message assistant-message-${e}`),
            (i.innerHTML = `<p>${o(t)}</p>`),
            n.appendChild(i),
            (n.scrollTop = n.scrollHeight));
    }
    async function j(e) {
        if ((e.preventDefault(), f(), i.assistantBusy)) return;
        const t = a('assistantInput'),
            n = a('assistantSend');
        if (!(t instanceof HTMLInputElement)) return;
        const o = t.value.trim();
        if (o) {
            (z('user', o),
                (t.value = ''),
                (i.assistantBusy = !0),
                n instanceof HTMLButtonElement && (n.disabled = !0));
            try {
                const e = [
                        {
                            role: 'system',
                            content:
                                'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                        },
                        ...i.chatHistory.slice(-6),
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
                    n = await t.json(),
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
                    })(String(n?.choices?.[0]?.message?.content || '').trim());
                (z('bot', a),
                    (i.chatHistory = [
                        ...i.chatHistory,
                        { role: 'user', content: o },
                        { role: 'assistant', content: a },
                    ].slice(-8)));
            } catch (e) {
                z(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                );
            } finally {
                ((i.assistantBusy = !1),
                    n instanceof HTMLButtonElement && (n.disabled = !1));
            }
        }
    }
    function _(e) {
        i.themeMode = e;
        const t = document.documentElement,
            n = i.mediaQuery instanceof MediaQueryList && i.mediaQuery.matches,
            o = 'system' === e ? (n ? 'dark' : 'light') : e;
        ((t.dataset.theme = o),
            document.querySelectorAll('[data-theme-mode]').forEach((t) => {
                const n = t.getAttribute('data-theme-mode');
                (t.classList.toggle('is-active', n === e),
                    t.setAttribute('aria-pressed', String(n === e)));
            }));
    }
    function U() {
        const e = a('checkinDate');
        e instanceof HTMLInputElement &&
            !e.value &&
            (e.value = new Date().toISOString().slice(0, 10));
    }
    function K({ immediate: e = !1 } = {}) {
        if ((I(), !i.queuePollingEnabled)) return;
        const t = e ? 0 : C();
        i.queueTimerId = window.setTimeout(() => {
            Q();
        }, t);
    }
    async function Q() {
        if (!i.queuePollingEnabled) return;
        if (document.hidden)
            return (
                u('paused', 'Cola en pausa (pestana oculta)'),
                y('Pestana oculta. Turnero en pausa temporal.'),
                void K()
            );
        if (!1 === navigator.onLine)
            return (
                (i.queueFailureStreak += 1),
                u('offline', 'Sin conexion al backend'),
                y(
                    'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
                ),
                q(),
                void K()
            );
        await N({ source: 'poll' });
        const e = await $();
        if (e.ok && !e.stale)
            ((i.queueFailureStreak = 0),
                (i.queueLastHealthySyncAt = Date.now()),
                u('live', 'Cola conectada'),
                y(
                    `Operacion estable (${w()}). Kiosco disponible para turnos.`
                ));
        else if (e.ok && e.stale) {
            i.queueFailureStreak += 1;
            const t = E(e.ageMs || 0);
            (u('reconnecting', `Watchdog: cola estancada ${t}`),
                y(
                    `Cola degradada: sin cambios en ${t}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
                ));
        } else {
            i.queueFailureStreak += 1;
            const e = Math.max(1, Math.ceil(C() / 1e3));
            (u('reconnecting', `Reintentando en ${e}s`),
                y(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        (q(), K());
    }
    async function J() {
        if (!i.queueManualRefreshBusy) {
            (f(),
                (i.queueManualRefreshBusy = !0),
                M(!0),
                u('reconnecting', 'Refrescando manualmente...'));
            try {
                await N({ source: 'manual' });
                const e = await $();
                if (e.ok && !e.stale)
                    return (
                        (i.queueFailureStreak = 0),
                        (i.queueLastHealthySyncAt = Date.now()),
                        u('live', 'Cola conectada'),
                        void y(`Sincronizacion manual exitosa (${w()}).`)
                    );
                if (e.ok && e.stale) {
                    const t = E(e.ageMs || 0);
                    return (
                        u('reconnecting', `Watchdog: cola estancada ${t}`),
                        void y(
                            `Persisten datos estancados (${t}). Verifica backend o recepcion.`
                        )
                    );
                }
                const t = Math.max(1, Math.ceil(C() / 1e3));
                (u(
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
                (q(), (i.queueManualRefreshBusy = !1), M(!1));
            }
        }
    }
    function G({ immediate: e = !0 } = {}) {
        if (((i.queuePollingEnabled = !0), e))
            return (u('live', 'Sincronizando cola...'), void Q());
        K();
    }
    function W({ reason: e = 'paused' } = {}) {
        ((i.queuePollingEnabled = !1), (i.queueFailureStreak = 0), I());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (u('offline', 'Sin conexion al backend'),
              y('Sin conexion. Esperando reconexion para reanudar cola.'),
              void q())
            : 'hidden' === t
              ? (u('paused', 'Cola en pausa (pestana oculta)'),
                void y('Pestana oculta. Reanudando al volver a primer plano.'))
              : (u('paused', 'Cola en pausa'),
                y('Sincronizacion pausada por navegacion.'),
                void q());
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((i.idleResetMs = (function () {
            const e = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS),
                n = Number.isFinite(e) ? e : 9e4;
            return Math.min(t, Math.max(5e3, Math.round(n)));
        })()),
            (function () {
                const t = localStorage.getItem(e) || 'system';
                ((i.mediaQuery = window.matchMedia(
                    '(prefers-color-scheme: dark)'
                )),
                    i.mediaQuery.addEventListener('change', () => {
                        'system' === i.themeMode && _('system');
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
                                    (localStorage.setItem(e, n), _(n));
                                })(
                                    t.getAttribute('data-theme-mode') ||
                                        'system'
                                );
                            });
                        }),
                    _(t));
            })(),
            U());
        const o = a('checkinForm'),
            r = a('walkinForm'),
            c = a('assistantForm');
        (o instanceof HTMLFormElement && o.addEventListener('submit', P),
            r instanceof HTMLFormElement && r.addEventListener('submit', F),
            c instanceof HTMLFormElement && c.addEventListener('submit', j),
            (function () {
                let e = a('kioskSessionGuard');
                if (e instanceof HTMLElement) return e;
                const t = a('kioskStatus');
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
                const i = document.createElement('button');
                ((i.id = 'kioskSessionResetBtn'),
                    (i.type = 'button'),
                    (i.textContent = 'Nueva persona / limpiar pantalla'),
                    (i.style.border = '1px solid var(--border)'),
                    (i.style.borderRadius = '0.65rem'),
                    (i.style.padding = '0.38rem 0.62rem'),
                    (i.style.background = 'var(--surface-soft)'),
                    (i.style.color = 'var(--text)'),
                    (i.style.cursor = 'pointer'),
                    e.appendChild(n),
                    e.appendChild(i),
                    t.insertAdjacentElement('afterend', e));
            })());
        const h = a('kioskSessionResetBtn');
        (h instanceof HTMLButtonElement &&
            h.addEventListener('click', () => {
                p({ reason: 'manual' });
            }),
            d(),
            l(),
            ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((e) => {
                document.addEventListener(
                    e,
                    () => {
                        f();
                    },
                    !0
                );
            }),
            m(),
            g(),
            b(),
            k(),
            (function () {
                try {
                    const e = localStorage.getItem(n);
                    if (!e) return void (i.offlineOutbox = []);
                    const t = JSON.parse(e);
                    if (!Array.isArray(t)) return void (i.offlineOutbox = []);
                    i.offlineOutbox = t
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
                        }))
                        .filter(
                            (e) =>
                                e.id &&
                                ('queue-ticket' === e.resource ||
                                    'queue-checkin' === e.resource)
                        )
                        .slice(0, 25);
                } catch (e) {
                    i.offlineOutbox = [];
                }
            })(),
            q());
        const v = L();
        v instanceof HTMLButtonElement &&
            v.addEventListener('click', () => {
                J();
            });
        const M = a('queueOutboxRetryBtn');
        M instanceof HTMLButtonElement &&
            M.addEventListener('click', () => {
                N({ source: 'operator', force: !0, maxItems: 25 });
            });
        const E = a('queueOutboxDropOldestBtn');
        E instanceof HTMLButtonElement &&
            E.addEventListener('click', () => {
                !(function () {
                    if (!i.offlineOutbox.length) return;
                    const e = i.offlineOutbox[i.offlineOutbox.length - 1];
                    (i.offlineOutbox.pop(),
                        T(),
                        q(),
                        S(),
                        s(
                            `Descartado pendiente antiguo (${e?.originLabel || 'sin detalle'}).`,
                            'info'
                        ));
                })();
            });
        const w = a('queueOutboxClearBtn');
        (w instanceof HTMLButtonElement &&
            w.addEventListener('click', () => {
                x({ reason: 'manual' });
            }),
            u('paused', 'Sincronizacion lista'),
            y('Esperando primera sincronizacion de cola...'),
            O(''),
            !1 !== navigator.onLine && N({ source: 'startup', force: !0 }),
            G({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? W({ reason: 'hidden' })
                    : G({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                (N({ source: 'online', force: !0 }), G({ immediate: !0 }));
            }),
            window.addEventListener('offline', () => {
                (W({ reason: 'offline' }), q());
            }),
            window.addEventListener('beforeunload', () => {
                W({ reason: 'paused' });
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const t = String(e.code || '').toLowerCase();
                return 'keyr' === t
                    ? (e.preventDefault(), void J())
                    : 'keyl' === t
                      ? (e.preventDefault(), void p({ reason: 'manual' }))
                      : 'keyy' === t
                        ? (e.preventDefault(),
                          void N({
                              source: 'shortcut',
                              force: !0,
                              maxItems: 25,
                          }))
                        : void (
                              'keyk' === t &&
                              (e.preventDefault(), x({ reason: 'manual' }))
                          );
            }));
    });
})();
