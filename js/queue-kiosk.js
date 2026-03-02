!(function () {
    'use strict';
    const e = 'queueKioskSeniorMode',
        n = 9e5,
        t = 'queueKioskOfflineOutbox',
        i = 'queueKioskPrinterState',
        o = 'kioskStarInlineStyles',
        a = {
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
            seniorMode: !1,
            voiceGuideSupported: !1,
            voiceGuideBusy: !1,
            voiceGuideUtterance: null,
        };
    function r(e, n = {}) {
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
    function s(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function c(e) {
        return document.getElementById(e);
    }
    function u(e, n = 'info') {
        const t = c('kioskProgressHint');
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
    function l(e, n = 'info') {
        const t = c('kioskSeniorHint');
        if (!(t instanceof HTMLElement)) return;
        const i = ['info', 'warn', 'success'].includes(
            String(n || '').toLowerCase()
        )
            ? String(n || '').toLowerCase()
            : 'info';
        ((t.dataset.tone = i),
            (t.textContent =
                String(e || '').trim() ||
                'Si necesitas letra mas grande, usa "Modo lectura grande".'));
    }
    function d(n, { persist: t = !0, source: i = 'ui' } = {}) {
        const o = Boolean(n);
        ((a.seniorMode = o),
            (document.body.dataset.kioskSenior = o ? 'on' : 'off'),
            (function () {
                const e = c('kioskSeniorToggle');
                if (!(e instanceof HTMLButtonElement)) return;
                const n = Boolean(a.seniorMode);
                ((e.dataset.active = n ? 'true' : 'false'),
                    e.setAttribute('aria-pressed', String(n)),
                    (e.textContent =
                        'Modo lectura grande: ' + (n ? 'On' : 'Off')));
            })(),
            t &&
                (function (n) {
                    try {
                        localStorage.setItem(e, n ? '1' : '0');
                    } catch (e) {}
                })(o),
            l(
                o
                    ? 'Modo lectura grande activo. Botones y textos ampliados.'
                    : 'Modo lectura grande desactivado.',
                o ? 'success' : 'info'
            ),
            r('senior_mode_changed', { enabled: o, source: i }));
    }
    function f({ source: e = 'ui' } = {}) {
        d(!a.seniorMode, { persist: !0, source: e });
    }
    function p() {
        return (
            'undefined' != typeof window &&
            'speechSynthesis' in window &&
            'function' == typeof window.speechSynthesis?.speak &&
            'function' == typeof window.SpeechSynthesisUtterance
        );
    }
    function m() {
        const e = c('kioskVoiceGuideBtn');
        if (!(e instanceof HTMLButtonElement)) return;
        const n = Boolean(a.voiceGuideSupported),
            t = Boolean(a.voiceGuideBusy);
        ((e.disabled = !n && !t),
            (e.textContent = n
                ? t
                    ? 'Leyendo instrucciones...'
                    : 'Leer instrucciones'
                : 'Voz guia no disponible'));
    }
    function g({ source: e = 'manual' } = {}) {
        if (!p())
            return (
                (a.voiceGuideBusy = !1),
                (a.voiceGuideUtterance = null),
                void m()
            );
        try {
            window.speechSynthesis.cancel();
        } catch (e) {}
        ((a.voiceGuideBusy = !1),
            (a.voiceGuideUtterance = null),
            m(),
            r('voice_guide_stopped', { source: e }));
    }
    function k({ source: e = 'button' } = {}) {
        if (!a.voiceGuideSupported)
            return (
                T(
                    'Guia por voz no disponible en este navegador. Usa ayuda rapida en pantalla.',
                    'info'
                ),
                l(
                    'Sin voz guia en este equipo. Usa ayuda rapida o pide apoyo.',
                    'warn'
                ),
                void r('voice_guide_unavailable', { source: e })
            );
        g({ source: 'restart' });
        const n = `Bienvenida al kiosco de turnos de Piel en Armonia. ${'walkin' === a.selectedFlow ? 'Si no tienes cita, escribe iniciales y pulsa Generar turno.' : 'Si tienes cita, escribe telefono, fecha y hora y pulsa Confirmar check in.'} Si necesitas ayuda, pulsa Necesito apoyo y recepcion te asistira. Conserva tu ticket y espera el llamado en la pantalla de sala.`;
        let t;
        try {
            t = new window.SpeechSynthesisUtterance(n);
        } catch (n) {
            return (
                T('No se pudo iniciar guia por voz en este equipo.', 'error'),
                void r('voice_guide_error', {
                    source: e,
                    reason: 'utterance_create_failed',
                })
            );
        }
        ((t.lang = 'es-EC'),
            (t.rate = 0.92),
            (t.pitch = 1),
            (t.onstart = () => {
                ((a.voiceGuideBusy = !0), m());
            }),
            (t.onend = () => {
                ((a.voiceGuideBusy = !1),
                    (a.voiceGuideUtterance = null),
                    m(),
                    r('voice_guide_finished', { source: e }));
            }),
            (t.onerror = () => {
                ((a.voiceGuideBusy = !1),
                    (a.voiceGuideUtterance = null),
                    m(),
                    T(
                        'La guia por voz se interrumpio. Puedes intentar nuevamente.',
                        'error'
                    ),
                    r('voice_guide_error', {
                        source: e,
                        reason: 'speech_error',
                    }));
            }));
        try {
            ((a.voiceGuideUtterance = t),
                (a.voiceGuideBusy = !0),
                m(),
                window.speechSynthesis.speak(t),
                T('Guia por voz iniciada.', 'info'),
                l(
                    'Escuchando guia por voz. Puedes seguir los pasos en pantalla.',
                    'success'
                ),
                r('voice_guide_started', { source: e }));
        } catch (n) {
            ((a.voiceGuideBusy = !1),
                (a.voiceGuideUtterance = null),
                m(),
                T('No se pudo reproducir guia por voz.', 'error'),
                r('voice_guide_error', {
                    source: e,
                    reason: 'speech_start_failed',
                }));
        }
    }
    function b({ source: e = 'button' } = {}) {
        const n =
            'Recepcion te ayudara enseguida. Mantente frente al kiosco o acude al mostrador.';
        (T(n, 'info'),
            u(
                'Apoyo solicitado: recepcion te asistira para completar el turno.',
                'warn'
            ),
            ce('bot', n),
            r('reception_support_requested', { source: e }));
    }
    function h(e, { source: n = 'ui' } = {}) {
        const t = c('kioskQuickHelpPanel'),
            i = c('kioskHelpToggle');
        if (!(t instanceof HTMLElement && i instanceof HTMLButtonElement))
            return;
        const o = Boolean(e);
        ((a.quickHelpOpen = o),
            (t.hidden = !o),
            (i.dataset.open = o ? 'true' : 'false'),
            i.setAttribute('aria-expanded', String(o)),
            r('quick_help_toggled', { open: o, source: n }),
            u(
                o
                    ? 'Guia abierta: elige opcion, completa datos y confirma ticket.'
                    : 'Paso 1 de 2: selecciona una opcion para comenzar.',
                'info'
            ));
    }
    function y(e, { announce: n = !0 } = {}) {
        const t =
            'walkin' === String(e || '').toLowerCase() ? 'walkin' : 'checkin';
        a.selectedFlow = t;
        const i = c('checkinForm'),
            o = c('walkinForm');
        (i instanceof HTMLElement &&
            i.classList.toggle('is-flow-active', 'checkin' === t),
            o instanceof HTMLElement &&
                o.classList.toggle('is-flow-active', 'walkin' === t));
        const s = c('kioskQuickCheckin'),
            l = c('kioskQuickWalkin');
        if (s instanceof HTMLButtonElement) {
            const e = 'checkin' === t;
            ((s.dataset.active = e ? 'true' : 'false'),
                s.setAttribute('aria-pressed', String(e)));
        }
        if (l instanceof HTMLButtonElement) {
            const e = 'walkin' === t;
            ((l.dataset.active = e ? 'true' : 'false'),
                l.setAttribute('aria-pressed', String(e)));
        }
        const d = c('walkin' === t ? 'walkinInitials' : 'checkinPhone');
        (d instanceof HTMLInputElement && d.focus({ preventScroll: !1 }),
            n &&
                u(
                    'walkin' === t
                        ? 'Paso 2: escribe iniciales y pulsa "Generar turno".'
                        : 'Paso 2: escribe telefono, fecha y hora para check-in.',
                    'info'
                ),
            r('flow_focus', { target: t }));
    }
    function v(e, n) {
        if (!e || 'object' != typeof e || !Array.isArray(n)) return [];
        for (const t of n) if (t && Array.isArray(e[t])) return e[t];
        return [];
    }
    function S(e, n) {
        if (!e || 'object' != typeof e || !Array.isArray(n)) return null;
        for (const t of n) {
            if (!t) continue;
            const n = e[t];
            if (n && 'object' == typeof n && !Array.isArray(n)) return n;
        }
        return null;
    }
    function w(e, n, t = 0) {
        if (!e || 'object' != typeof e || !Array.isArray(n))
            return Number(t || 0);
        for (const t of n) {
            if (!t) continue;
            const n = Number(e[t]);
            if (Number.isFinite(n)) return n;
        }
        return Number(t || 0);
    }
    function x(e) {
        const n = e && 'object' == typeof e ? e : {},
            t = S(n, ['counts']) || {},
            i = w(n, ['waitingCount', 'waiting_count'], Number.NaN),
            o = w(n, ['calledCount', 'called_count'], Number.NaN);
        let a = v(n, [
            'callingNow',
            'calling_now',
            'calledTickets',
            'called_tickets',
        ]);
        if (0 === a.length) {
            const e = S(n, [
                'callingNowByConsultorio',
                'calling_now_by_consultorio',
            ]);
            e && (a = Object.values(e).filter(Boolean));
        }
        const r = v(n, [
                'nextTickets',
                'next_tickets',
                'waitingTickets',
                'waiting_tickets',
            ]),
            s = Number.isFinite(i)
                ? i
                : w(t, ['waiting', 'waiting_count'], r.length),
            c = Number.isFinite(o)
                ? o
                : w(t, ['called', 'called_count'], a.length);
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
    async function q(e, { method: n = 'GET', body: t } = {}) {
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
    function T(e, n = 'info') {
        const t = c('kioskStatus');
        if (!t) return;
        const i = String(e || '').trim() || 'Estado operativo',
            o = String(n || 'info').toLowerCase(),
            a =
                i !== String(t.textContent || '').trim() ||
                o !== String(t.dataset.status || '').toLowerCase();
        ((t.textContent = i),
            (t.dataset.status = o),
            a && r('kiosk_status', { status: o, message: i }));
    }
    function L(e, n) {
        const t = c('queueConnectionState');
        if (!t) return;
        const i = String(e || 'live').toLowerCase(),
            o = {
                live: 'Cola conectada',
                reconnecting: 'Reintentando conexion',
                offline: 'Sin conexion al backend',
                paused: 'Cola en pausa',
            },
            s = String(n || '').trim() || o[i] || o.live,
            u = i !== a.lastConnectionState || s !== a.lastConnectionMessage;
        ((a.lastConnectionState = i),
            (a.lastConnectionMessage = s),
            (t.dataset.state = i),
            (t.textContent = s),
            u && r('connection_state', { state: i, message: s }));
    }
    function M() {
        const e = c('kioskSessionCountdown');
        if (!(e instanceof HTMLElement)) return;
        if (!a.idleDeadlineTs)
            return (
                (e.textContent = 'Privacidad auto: --:--'),
                void (e.dataset.state = 'normal')
            );
        const n = Math.max(0, a.idleDeadlineTs - Date.now());
        e.textContent = `Privacidad auto: ${(function (e) {
            const n = Math.max(0, Number(e || 0)),
                t = Math.ceil(n / 1e3);
            return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
        })(n)}`;
        const t = n <= 2e4;
        e.dataset.state = t ? 'warning' : 'normal';
    }
    function E() {
        const e = c('ticketResult');
        e &&
            (e.innerHTML =
                '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>');
    }
    function C() {
        const e = c('assistantMessages');
        (e && (e.innerHTML = ''),
            (a.chatHistory = []),
            ce(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ));
        const n = c('assistantInput');
        n instanceof HTMLInputElement && (n.value = '');
    }
    function H({ durationMs: e = null } = {}) {
        const t = Math.min(
            n,
            Math.max(
                5e3,
                Math.round(
                    Number.isFinite(Number(e)) ? Number(e) : a.idleResetMs
                )
            )
        );
        (a.idleTimerId &&
            (window.clearTimeout(a.idleTimerId), (a.idleTimerId = 0)),
            a.idleTickId &&
                (window.clearInterval(a.idleTickId), (a.idleTickId = 0)),
            (a.idleDeadlineTs = Date.now() + t),
            M(),
            (a.idleTickId = window.setInterval(() => {
                M();
            }, 1e3)),
            (a.idleTimerId = window.setTimeout(() => {
                if (a.assistantBusy || a.queueManualRefreshBusy)
                    return (
                        T(
                            'Sesion activa. Reprogramando limpieza automatica.',
                            'info'
                        ),
                        void H({ durationMs: 15e3 })
                    );
                B({ reason: 'idle_timeout' });
            }, t)));
    }
    function O() {
        (le({ reason: 'activity' }), H());
    }
    function B({ reason: e = 'manual' } = {}) {
        (g({ source: 'session_reset' }),
            (function () {
                const e = c('checkinForm'),
                    n = c('walkinForm');
                (e instanceof HTMLFormElement && e.reset(),
                    n instanceof HTMLFormElement && n.reset(),
                    de());
            })(),
            C(),
            E(),
            h(!1, { source: 'session_reset' }),
            y('checkin', { announce: !1 }),
            T(
                'idle_timeout' === e
                    ? 'Sesion reiniciada por inactividad para proteger privacidad.'
                    : 'Pantalla limpiada. Lista para el siguiente paciente.',
                'info'
            ),
            u('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            j(),
            H());
    }
    function _() {
        let e = c('queueOpsHint');
        if (e) return e;
        const n = document.querySelector('.kiosk-side .kiosk-card'),
            t = c('queueUpdatedAt');
        return n && t
            ? ((e = document.createElement('p')),
              (e.id = 'queueOpsHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function I(e) {
        const n = _();
        n && (n.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function A() {
        let e = c('queueOutboxHint');
        if (e) return e;
        const n = _();
        return n?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queueOutboxHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Pendientes offline: 0'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function N(e) {
        const n = A();
        n &&
            (n.textContent = String(e || '').trim() || 'Pendientes offline: 0');
    }
    function $() {
        let e = c('queuePrinterHint');
        if (e) return e;
        const n = A();
        return n?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queuePrinterHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Impresora: estado pendiente.'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function D() {
        const e = $();
        if (!e) return;
        const n = a.printerState;
        if (!n) return void (e.textContent = 'Impresora: estado pendiente.');
        const t = n.printed ? 'impresion OK' : n.errorCode || 'sin impresion',
            i = n.message ? ` (${n.message})` : '',
            o = Z(n.at);
        e.textContent = `Impresora: ${t}${i} · ${o}`;
    }
    function z() {
        let e = c('queueOutboxConsole');
        if (e instanceof HTMLElement) return e;
        const n = A();
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
    function P(e) {
        const n = c('queueOutboxRetryBtn'),
            t = c('queueOutboxClearBtn'),
            i = c('queueOutboxDropOldestBtn');
        (n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(e) || !a.offlineOutbox.length),
            (n.textContent = e
                ? 'Sincronizando...'
                : 'Sincronizar pendientes')),
            t instanceof HTMLButtonElement &&
                (t.disabled = Boolean(e) || !a.offlineOutbox.length),
            i instanceof HTMLButtonElement &&
                (i.disabled = Boolean(e) || a.offlineOutbox.length <= 0));
    }
    function F() {
        z();
        const e = c('queueOutboxSummary'),
            n = c('queueOutboxList'),
            t = a.offlineOutbox.length;
        (e instanceof HTMLElement &&
            (e.textContent =
                t <= 0 ? 'Outbox: 0 pendientes' : `Outbox: ${t} pendiente(s)`),
            n instanceof HTMLElement &&
                (n.innerHTML =
                    t <= 0
                        ? '<li class="queue-empty">Sin pendientes offline.</li>'
                        : a.offlineOutbox
                              .slice(0, 6)
                              .map((e, n) => {
                                  const t = Z(e.queuedAt),
                                      i = Number(e.attempts || 0);
                                  return `<li><strong>${s(e.originLabel)}</strong> · ${s(e.patientInitials || '--')} · ${s(e.queueType || '--')} · ${s(t)} · intento ${n + 1}/${Math.max(1, i + 1)}</li>`;
                              })
                              .join('')),
            P(!1));
    }
    function R({ reason: e = 'manual' } = {}) {
        ((a.offlineOutbox = []),
            G(),
            j(),
            F(),
            'manual' === e &&
                T('Pendientes offline limpiados manualmente.', 'info'));
    }
    function G() {
        try {
            localStorage.setItem(t, JSON.stringify(a.offlineOutbox));
        } catch (e) {}
    }
    function j() {
        const e = a.offlineOutbox.length;
        if (e <= 0)
            return (N('Pendientes offline: 0 (sin pendientes).'), void F());
        const n = Date.parse(String(a.offlineOutbox[0]?.queuedAt || ''));
        (N(
            `Pendientes offline: ${e} - sincronizacion automatica al reconectar${Number.isFinite(n) ? ` - mas antiguo ${J(Date.now() - n)}` : ''}`
        ),
            F());
    }
    function U() {
        let e = c('queueManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const n = c('queueUpdatedAt');
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
    function K(e) {
        const n = U();
        n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(e)),
            (n.textContent = e
                ? 'Actualizando cola...'
                : 'Reintentar sincronizacion'));
    }
    function J(e) {
        const n = Math.max(0, Number(e || 0)),
            t = Math.round(n / 1e3);
        if (t < 60) return `${t}s`;
        const i = Math.floor(t / 60),
            o = t % 60;
        return o <= 0 ? `${i}m` : `${i}m ${o}s`;
    }
    function Q() {
        return a.queueLastHealthySyncAt
            ? `hace ${J(Date.now() - a.queueLastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function W(e) {
        const n = c('queueUpdatedAt');
        if (!n) return;
        const t = x({ updatedAt: e }),
            i = Date.parse(String(t.updatedAt || ''));
        Number.isFinite(i)
            ? (n.textContent = `Actualizado ${new Date(i).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (n.textContent = 'Actualizacion pendiente');
    }
    function V() {
        const e = Math.max(0, Number(a.queueFailureStreak || 0)),
            n = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, n);
    }
    function Y() {
        a.queueTimerId &&
            (window.clearTimeout(a.queueTimerId), (a.queueTimerId = 0));
    }
    function Z(e) {
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
    async function X() {
        if (a.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        a.queueRefreshBusy = !0;
        try {
            const e = await q('queue-state');
            ((a.queueState = x(e.data || {})),
                (function (e) {
                    const n = x(e),
                        t = c('queueWaitingCount'),
                        i = c('queueCalledCount'),
                        o = c('queueCallingNow'),
                        a = c('queueNextList');
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
                                          `\n                        <article class="queue-called-card">\n                            <header>Consultorio ${s(e.assignedConsultorio)}</header>\n                            <strong>${s(e.ticketCode || '--')}</strong>\n                            <span>${s(e.patientInitials || '--')}</span>\n                        </article>\n                    `
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
                                          `\n                        <li>\n                            <span class="ticket-code">${s(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${s(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${s(e.position || '-')}</span>\n                        </li>\n                    `
                                  )
                                  .join(''));
                    }
                })(a.queueState),
                W(a.queueState?.updatedAt));
            const n = (function (e) {
                const n = x(e),
                    t = Date.parse(String(n.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const i = Math.max(0, Date.now() - t);
                return { stale: i >= 3e4, missingTimestamp: !1, ageMs: i };
            })(a.queueState);
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
            a.queueRefreshBusy = !1;
        }
    }
    function ee(e, n) {
        const t = c('ticketResult');
        if (!t) return;
        const o = e?.data || {},
            u = {
                ...o,
                id: Number(o?.id || o?.ticket_id || 0) || 0,
                ticketCode: String(o?.ticketCode || o?.ticket_code || '--'),
                patientInitials: String(
                    o?.patientInitials || o?.patient_initials || '--'
                ),
                queueType: String(o?.queueType || o?.queue_type || 'walk_in'),
                createdAt: String(
                    o?.createdAt || o?.created_at || new Date().toISOString()
                ),
            },
            l = e?.print || {};
        !(function (e, { origin: n = 'ticket' } = {}) {
            const t = e?.print || {};
            ((a.printerState = {
                ok: Boolean(t.ok),
                printed: Boolean(e?.printed),
                errorCode: String(t.errorCode || ''),
                message: String(t.message || ''),
                at: new Date().toISOString(),
            }),
                (function () {
                    try {
                        localStorage.setItem(i, JSON.stringify(a.printerState));
                    } catch (e) {}
                })(),
                D(),
                r('printer_result', {
                    origin: n,
                    ok: a.printerState.ok,
                    printed: a.printerState.printed,
                    errorCode: a.printerState.errorCode,
                }));
        })(e, { origin: n });
        const d = Array.isArray(a.queueState?.nextTickets)
                ? a.queueState.nextTickets
                : [],
            f = d.find((e) => Number(e.id) === Number(u.id))?.position || '-',
            p = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${s(l.message || 'sin detalle')})`;
        t.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${s(n)}</p>\n            <div class="ticket-result-main">\n                <strong>${s(u.ticketCode || '--')}</strong>\n                <span>${s(u.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${s(f)}</dd></div>\n                <div><dt>Tipo</dt><dd>${s(u.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${s(Z(u.createdAt))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">${p}</p>\n        </article>\n    `;
    }
    function ne({
        originLabel: e,
        patientInitials: n,
        queueType: t,
        queuedAt: i,
    }) {
        const o = c('ticketResult');
        o &&
            (o.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Solicitud guardada offline</h3>\n            <p class="ticket-result-origin">${s(e)}</p>\n            <div class="ticket-result-main">\n                <strong>${s(`PEND-${String(a.offlineOutbox.length).padStart(2, '0')}`)}</strong>\n                <span>${s(n || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>\n                <div><dt>Tipo</dt><dd>${s(t || '--')}</dd></div>\n                <div><dt>Guardado</dt><dd>${s(Z(i))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>\n        </article>\n    `);
    }
    function te(e) {
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
    function ie(e, n) {
        const t = String(e || '').toLowerCase(),
            i = (function (e) {
                const n = e && 'object' == typeof e ? e : {};
                return Object.keys(n)
                    .sort()
                    .reduce((e, t) => ((e[t] = n[t]), e), {});
            })(n);
        return `${t}:${JSON.stringify(i)}`;
    }
    function oe({
        resource: e,
        body: n,
        originLabel: t,
        patientInitials: i,
        queueType: o,
    }) {
        const s = String(e || '');
        if ('queue-ticket' !== s && 'queue-checkin' !== s) return null;
        const c = ie(s, n),
            u = Date.now(),
            l = a.offlineOutbox.find((e) => {
                if (String(e?.fingerprint || '') !== c) return !1;
                const n = Date.parse(String(e?.queuedAt || ''));
                return !!Number.isFinite(n) && u - n <= 9e4;
            });
        if (l)
            return (
                r('offline_queued_duplicate', { resource: s, fingerprint: c }),
                { ...l, deduped: !0 }
            );
        const d = {
            id: `offline_${Date.now()}_${Math.floor(1e5 * Math.random())}`,
            resource: s,
            body: n && 'object' == typeof n ? n : {},
            originLabel: String(t || 'Solicitud offline'),
            patientInitials: String(i || '--'),
            queueType: String(o || '--'),
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: '',
            fingerprint: c,
        };
        return (
            (a.offlineOutbox = [d, ...a.offlineOutbox].slice(0, 25)),
            G(),
            j(),
            r('offline_queued', {
                resource: s,
                queueSize: a.offlineOutbox.length,
            }),
            d
        );
    }
    async function ae({
        source: e = 'auto',
        force: n = !1,
        maxItems: t = 4,
    } = {}) {
        if (a.offlineOutboxFlushBusy) return;
        if (!a.offlineOutbox.length) return;
        if (!n && !1 === navigator.onLine) return;
        ((a.offlineOutboxFlushBusy = !0), P(!0));
        let i = 0;
        try {
            for (
                ;
                a.offlineOutbox.length && i < Math.max(1, Number(t || 1));
            ) {
                const e = a.offlineOutbox[0];
                try {
                    const n = await q(e.resource, {
                        method: 'POST',
                        body: e.body,
                    });
                    (a.offlineOutbox.shift(),
                        G(),
                        j(),
                        ee(n, `${e.originLabel} (sincronizado)`),
                        T(
                            `Pendiente sincronizado (${e.originLabel})`,
                            'success'
                        ),
                        r('offline_synced_item', {
                            resource: e.resource,
                            originLabel: e.originLabel,
                            pendingAfter: a.offlineOutbox.length,
                        }),
                        (i += 1));
                } catch (n) {
                    ((e.attempts = Number(e.attempts || 0) + 1),
                        (e.lastError = String(n?.message || '').slice(0, 180)),
                        (e.lastAttemptAt = new Date().toISOString()),
                        G(),
                        j());
                    const t = te(n);
                    (T(
                        t
                            ? 'Sincronizacion offline pendiente: esperando reconexion.'
                            : `Pendiente con error: ${n.message}`,
                        t ? 'info' : 'error'
                    ),
                        r('offline_sync_error', {
                            resource: e.resource,
                            retryingOffline: t,
                            error: String(n?.message || ''),
                        }));
                    break;
                }
            }
            i > 0 &&
                ((a.queueFailureStreak = 0),
                (await X()).ok &&
                    ((a.queueLastHealthySyncAt = Date.now()),
                    L('live', 'Cola conectada'),
                    I(`Outbox sincronizado desde ${e}. (${Q()})`),
                    r('offline_synced_batch', {
                        source: e,
                        processed: i,
                        pendingAfter: a.offlineOutbox.length,
                    })));
        } finally {
            ((a.offlineOutboxFlushBusy = !1), F());
        }
    }
    async function re(e) {
        if (
            (e.preventDefault(),
            O(),
            le({ reason: 'form_submit' }),
            !(e.currentTarget instanceof HTMLFormElement))
        )
            return;
        const n = c('checkinPhone'),
            t = c('checkinTime'),
            i = c('checkinDate'),
            o = c('checkinInitials'),
            r = c('checkinSubmit'),
            s = n instanceof HTMLInputElement ? n.value.trim() : '',
            l = t instanceof HTMLInputElement ? t.value.trim() : '',
            d = i instanceof HTMLInputElement ? i.value.trim() : '',
            f = o instanceof HTMLInputElement ? o.value.trim() : '';
        if (!s || !l || !d)
            return (
                T(
                    'Telefono, fecha y hora son obligatorios para check-in',
                    'error'
                ),
                void u(
                    'Completa telefono, fecha y hora para continuar.',
                    'warn'
                )
            );
        r instanceof HTMLButtonElement && (r.disabled = !0);
        try {
            const e = { telefono: s, hora: l, fecha: d, patientInitials: f },
                n = await q('queue-checkin', { method: 'POST', body: e });
            (T('Check-in registrado correctamente', 'success'),
                u(
                    'Check-in completado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                ee(n, n.replay ? 'Check-in ya existente' : 'Check-in de cita'),
                (a.queueFailureStreak = 0),
                (await X()).ok ||
                    L(
                        'reconnecting',
                        'Check-in registrado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (te(e)) {
                const e = oe({
                    resource: 'queue-checkin',
                    body: {
                        telefono: s,
                        hora: l,
                        fecha: d,
                        patientInitials: f,
                    },
                    originLabel: 'Check-in de cita',
                    patientInitials: f || s.slice(-2),
                    queueType: 'appointment',
                });
                if (e)
                    return (
                        L('offline', 'Sin conexion al backend'),
                        I(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        ne({
                            originLabel: e.originLabel,
                            patientInitials: e.patientInitials,
                            queueType: e.queueType,
                            queuedAt: e.queuedAt,
                        }),
                        T(
                            e.deduped
                                ? 'Check-in ya pendiente offline. Se sincronizara automaticamente.'
                                : 'Check-in guardado offline. Se sincronizara automaticamente.',
                            'info'
                        ),
                        void u(
                            'Check-in guardado offline. Recepcion confirmara al reconectar.',
                            'warn'
                        )
                    );
            }
            (T(`No se pudo registrar el check-in: ${e.message}`, 'error'),
                u(
                    'No se pudo confirmar check-in. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            r instanceof HTMLButtonElement && (r.disabled = !1);
        }
    }
    async function se(e) {
        (e.preventDefault(), O(), le({ reason: 'form_submit' }));
        const n = c('walkinName'),
            t = c('walkinInitials'),
            i = c('walkinPhone'),
            o = c('walkinSubmit'),
            r = n instanceof HTMLInputElement ? n.value.trim() : '',
            s =
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
        if (!s)
            return (
                T('Ingresa iniciales o nombre para generar el turno', 'error'),
                void u('Escribe iniciales para generar tu turno.', 'warn')
            );
        o instanceof HTMLButtonElement && (o.disabled = !0);
        try {
            const e = { patientInitials: s, name: r, phone: l },
                n = await q('queue-ticket', { method: 'POST', body: e });
            (T('Turno walk-in registrado correctamente', 'success'),
                u(
                    'Turno generado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                ee(n, 'Turno sin cita'),
                (a.queueFailureStreak = 0),
                (await X()).ok ||
                    L(
                        'reconnecting',
                        'Turno creado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (te(e)) {
                const e = oe({
                    resource: 'queue-ticket',
                    body: { patientInitials: s, name: r, phone: l },
                    originLabel: 'Turno sin cita',
                    patientInitials: s,
                    queueType: 'walk_in',
                });
                if (e)
                    return (
                        L('offline', 'Sin conexion al backend'),
                        I(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        ne({
                            originLabel: e.originLabel,
                            patientInitials: e.patientInitials,
                            queueType: e.queueType,
                            queuedAt: e.queuedAt,
                        }),
                        T(
                            e.deduped
                                ? 'Turno ya pendiente offline. Se sincronizara automaticamente.'
                                : 'Turno guardado offline. Se sincronizara automaticamente.',
                            'info'
                        ),
                        void u(
                            'Turno guardado offline. Recepcion lo sincronizara al reconectar.',
                            'warn'
                        )
                    );
            }
            (T(`No se pudo crear el turno: ${e.message}`, 'error'),
                u(
                    'No se pudo generar turno. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            o instanceof HTMLButtonElement && (o.disabled = !1);
        }
    }
    function ce(e, n) {
        const t = c('assistantMessages');
        if (!t) return;
        const i = document.createElement('article');
        ((i.className = `assistant-message assistant-message-${e}`),
            (i.innerHTML = `<p>${s(n)}</p>`),
            t.appendChild(i),
            (t.scrollTop = t.scrollHeight));
    }
    async function ue(e) {
        if ((e.preventDefault(), O(), a.assistantBusy)) return;
        const n = c('assistantInput'),
            t = c('assistantSend');
        if (!(n instanceof HTMLInputElement)) return;
        const i = n.value.trim();
        if (i) {
            (ce('user', i),
                (n.value = ''),
                (a.assistantBusy = !0),
                t instanceof HTMLButtonElement && (t.disabled = !0));
            try {
                const e = [
                        {
                            role: 'system',
                            content:
                                'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                        },
                        ...a.chatHistory.slice(-6),
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
                    o = (function (e) {
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
                (ce('bot', o),
                    (a.chatHistory = [
                        ...a.chatHistory,
                        { role: 'user', content: i },
                        { role: 'assistant', content: o },
                    ].slice(-8)));
            } catch (e) {
                ce(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                );
            } finally {
                ((a.assistantBusy = !1),
                    t instanceof HTMLButtonElement && (t.disabled = !1));
            }
        }
    }
    function le({ reason: e = 'auto' } = {}) {
        if (a.welcomeDismissed) return;
        a.welcomeDismissed = !0;
        const n = c('kioskWelcomeScreen');
        n instanceof HTMLElement &&
            (n.classList.add('is-hidden'),
            window.setTimeout(() => {
                n.parentElement && n.remove();
            }, 700),
            r('welcome_dismissed', { reason: e }));
    }
    function de() {
        const e = c('checkinDate');
        e instanceof HTMLInputElement &&
            !e.value &&
            (e.value = new Date().toISOString().slice(0, 10));
    }
    function fe({ immediate: e = !1 } = {}) {
        if ((Y(), !a.queuePollingEnabled)) return;
        const n = e ? 0 : V();
        a.queueTimerId = window.setTimeout(() => {
            pe();
        }, n);
    }
    async function pe() {
        if (!a.queuePollingEnabled) return;
        if (document.hidden)
            return (
                L('paused', 'Cola en pausa (pestana oculta)'),
                I('Pestana oculta. Turnero en pausa temporal.'),
                void fe()
            );
        if (!1 === navigator.onLine)
            return (
                (a.queueFailureStreak += 1),
                L('offline', 'Sin conexion al backend'),
                I(
                    'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
                ),
                j(),
                void fe()
            );
        await ae({ source: 'poll' });
        const e = await X();
        if (e.ok && !e.stale)
            ((a.queueFailureStreak = 0),
                (a.queueLastHealthySyncAt = Date.now()),
                L('live', 'Cola conectada'),
                I(
                    `Operacion estable (${Q()}). Kiosco disponible para turnos.`
                ));
        else if (e.ok && e.stale) {
            a.queueFailureStreak += 1;
            const n = J(e.ageMs || 0);
            (L('reconnecting', `Watchdog: cola estancada ${n}`),
                I(
                    `Cola degradada: sin cambios en ${n}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
                ));
        } else {
            a.queueFailureStreak += 1;
            const e = Math.max(1, Math.ceil(V() / 1e3));
            (L('reconnecting', `Reintentando en ${e}s`),
                I(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        (j(), fe());
    }
    async function me() {
        if (!a.queueManualRefreshBusy) {
            (O(),
                (a.queueManualRefreshBusy = !0),
                K(!0),
                L('reconnecting', 'Refrescando manualmente...'));
            try {
                await ae({ source: 'manual' });
                const e = await X();
                if (e.ok && !e.stale)
                    return (
                        (a.queueFailureStreak = 0),
                        (a.queueLastHealthySyncAt = Date.now()),
                        L('live', 'Cola conectada'),
                        void I(`Sincronizacion manual exitosa (${Q()}).`)
                    );
                if (e.ok && e.stale) {
                    const n = J(e.ageMs || 0);
                    return (
                        L('reconnecting', `Watchdog: cola estancada ${n}`),
                        void I(
                            `Persisten datos estancados (${n}). Verifica backend o recepcion.`
                        )
                    );
                }
                const n = Math.max(1, Math.ceil(V() / 1e3));
                (L(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion al backend'
                        : `Reintentando en ${n}s`
                ),
                    I(
                        !1 === navigator.onLine
                            ? 'Sin internet. Opera manualmente en recepcion.'
                            : `Refresh manual sin exito. Reintento automatico en ${n}s.`
                    ));
            } finally {
                (j(), (a.queueManualRefreshBusy = !1), K(!1));
            }
        }
    }
    function ge({ immediate: e = !0 } = {}) {
        if (((a.queuePollingEnabled = !0), e))
            return (L('live', 'Sincronizando cola...'), void pe());
        fe();
    }
    function ke({ reason: e = 'paused' } = {}) {
        ((a.queuePollingEnabled = !1), (a.queueFailureStreak = 0), Y());
        const n = String(e || 'paused').toLowerCase();
        return 'offline' === n
            ? (L('offline', 'Sin conexion al backend'),
              I('Sin conexion. Esperando reconexion para reanudar cola.'),
              void j())
            : 'hidden' === n
              ? (L('paused', 'Cola en pausa (pestana oculta)'),
                void I('Pestana oculta. Reanudando al volver a primer plano.'))
              : (L('paused', 'Cola en pausa'),
                I('Sincronizacion pausada por navegacion.'),
                void j());
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((document.body.dataset.kioskMode = 'star'),
            (function () {
                /* canonical CSS handles kiosk visuals */
            })(),
            (a.idleResetMs = (function () {
                const e = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS),
                    t = Number.isFinite(e) ? e : 9e4;
                return Math.min(n, Math.max(5e3, Math.round(t)));
            })()),
            (a.voiceGuideSupported = p()),
            (function () {
                const e = 'light';
                var n;
                (localStorage.setItem('kioskThemeMode', e),
                    (n = e),
                    (a.themeMode = n),
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
            d(
                (function () {
                    try {
                        return '1' === localStorage.getItem(e);
                    } catch (e) {
                        return !1;
                    }
                })(),
                { persist: !1, source: 'init' }
            ),
            m(),
            (function () {
                const e = c('kioskWelcomeScreen');
                e instanceof HTMLElement &&
                    (e.classList.add('is-visible'),
                    u(
                        'Bienvenida: en segundos podras elegir tu tipo de atencion.',
                        'info'
                    ),
                    window.setTimeout(() => {
                        le({ reason: 'auto' });
                    }, 1800),
                    window.setTimeout(() => {
                        le({ reason: 'safety_timeout' });
                    }, 2600));
            })(),
            de());
        const r = c('checkinForm'),
            s = c('walkinForm'),
            l = c('assistantForm');
        (r instanceof HTMLFormElement && r.addEventListener('submit', re),
            s instanceof HTMLFormElement && s.addEventListener('submit', se),
            l instanceof HTMLFormElement && l.addEventListener('submit', ue),
            (function () {
                const e = c('kioskQuickCheckin'),
                    n = c('kioskQuickWalkin'),
                    t = c('kioskHelpToggle'),
                    i = c('kioskHelpClose'),
                    o = c('kioskSeniorToggle'),
                    r = c('kioskVoiceGuideBtn'),
                    s = c('kioskReceptionHelpBtn');
                (e instanceof HTMLButtonElement &&
                    e.addEventListener('click', () => {
                        (O(), y('checkin'));
                    }),
                    n instanceof HTMLButtonElement &&
                        n.addEventListener('click', () => {
                            (O(), y('walkin'));
                        }),
                    t instanceof HTMLButtonElement &&
                        t.addEventListener('click', () => {
                            (O(), h(!a.quickHelpOpen, { source: 'toggle' }));
                        }),
                    i instanceof HTMLButtonElement &&
                        i.addEventListener('click', () => {
                            (O(), h(!1, { source: 'close_button' }));
                        }),
                    o instanceof HTMLButtonElement &&
                        o.addEventListener('click', () => {
                            (O(), f({ source: 'button' }));
                        }),
                    r instanceof HTMLButtonElement &&
                        r.addEventListener('click', () => {
                            (O(), k({ source: 'button' }));
                        }),
                    s instanceof HTMLButtonElement &&
                        ((s.dataset.variant = 'warning'),
                        s.addEventListener('click', () => {
                            (O(), b({ source: 'button' }));
                        })));
            })(),
            h(!1, { source: 'init' }),
            (function () {
                let e = c('kioskSessionGuard');
                if (e instanceof HTMLElement) return e;
                const n = c('kioskStatus');
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
        const v = c('kioskSessionResetBtn');
        (v instanceof HTMLButtonElement &&
            v.addEventListener('click', () => {
                B({ reason: 'manual' });
            }),
            C(),
            E(),
            y('checkin', { announce: !1 }),
            u('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((e) => {
                document.addEventListener(
                    e,
                    () => {
                        O();
                    },
                    !0
                );
            }),
            H(),
            _(),
            A(),
            $(),
            z(),
            (function () {
                try {
                    const e = localStorage.getItem(t);
                    if (!e) return void (a.offlineOutbox = []);
                    const n = JSON.parse(e);
                    if (!Array.isArray(n)) return void (a.offlineOutbox = []);
                    a.offlineOutbox = n
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
                            fingerprint:
                                e.fingerprint || ie(e.resource, e.body),
                        }))
                        .slice(0, 25);
                } catch (e) {
                    a.offlineOutbox = [];
                }
            })(),
            (function () {
                try {
                    const e = localStorage.getItem(i);
                    if (!e) return void (a.printerState = null);
                    const n = JSON.parse(e);
                    if (!n || 'object' != typeof n)
                        return void (a.printerState = null);
                    a.printerState = {
                        ok: Boolean(n.ok),
                        printed: Boolean(n.printed),
                        errorCode: String(n.errorCode || ''),
                        message: String(n.message || ''),
                        at: String(n.at || new Date().toISOString()),
                    };
                } catch (e) {
                    a.printerState = null;
                }
            })(),
            D(),
            j());
        const S = U();
        S instanceof HTMLButtonElement &&
            S.addEventListener('click', () => {
                me();
            });
        const w = c('queueOutboxRetryBtn');
        w instanceof HTMLButtonElement &&
            w.addEventListener('click', () => {
                ae({ source: 'operator', force: !0, maxItems: 25 });
            });
        const x = c('queueOutboxDropOldestBtn');
        x instanceof HTMLButtonElement &&
            x.addEventListener('click', () => {
                !(function () {
                    if (!a.offlineOutbox.length) return;
                    const e = a.offlineOutbox[a.offlineOutbox.length - 1];
                    (a.offlineOutbox.pop(),
                        G(),
                        j(),
                        F(),
                        T(
                            `Descartado pendiente antiguo (${e?.originLabel || 'sin detalle'}).`,
                            'info'
                        ));
                })();
            });
        const q = c('queueOutboxClearBtn');
        (q instanceof HTMLButtonElement &&
            q.addEventListener('click', () => {
                R({ reason: 'manual' });
            }),
            L('paused', 'Sincronizacion lista'),
            I('Esperando primera sincronizacion de cola...'),
            W(''),
            !1 !== navigator.onLine && ae({ source: 'startup', force: !0 }),
            ge({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? ke({ reason: 'hidden' })
                    : ge({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                (ae({ source: 'online', force: !0 }), ge({ immediate: !0 }));
            }),
            window.addEventListener('offline', () => {
                (ke({ reason: 'offline' }), j());
            }),
            window.addEventListener('beforeunload', () => {
                (g({ source: 'beforeunload' }), ke({ reason: 'paused' }));
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const n = String(e.code || '').toLowerCase();
                return 'keyr' === n
                    ? (e.preventDefault(), void me())
                    : 'keyh' === n
                      ? (e.preventDefault(),
                        void h(!a.quickHelpOpen, { source: 'shortcut' }))
                      : 'digit1' === n
                        ? (e.preventDefault(), void y('checkin'))
                        : 'digit2' === n
                          ? (e.preventDefault(), void y('walkin'))
                          : 'keys' === n
                            ? (e.preventDefault(),
                              void f({ source: 'shortcut' }))
                            : 'keyv' === n
                              ? (e.preventDefault(),
                                void k({ source: 'shortcut' }))
                              : 'keya' === n
                                ? (e.preventDefault(),
                                  void b({ source: 'shortcut' }))
                                : 'keyl' === n
                                  ? (e.preventDefault(),
                                    void B({ reason: 'manual' }))
                                  : 'keyy' === n
                                    ? (e.preventDefault(),
                                      void ae({
                                          source: 'shortcut',
                                          force: !0,
                                          maxItems: 25,
                                      }))
                                    : void (
                                          'keyk' === n &&
                                          (e.preventDefault(),
                                          R({ reason: 'manual' }))
                                      );
            }));
    });
})();
