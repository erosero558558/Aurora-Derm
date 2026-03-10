!(function () {
    'use strict';
    function e(e) {
        if (
            'object' == typeof crypto &&
            crypto &&
            'function' == typeof crypto.randomUUID
        )
            return `${e}-${crypto.randomUUID()}`;
        const n = Math.random().toString(36).slice(2, 10);
        return `${e}-${Date.now().toString(36)}-${n}`;
    }
    function n(e, n, t, i) {
        const o = 'function' == typeof t && t() ? t() : {},
            a = o.details && 'object' == typeof o.details ? o.details : {};
        return {
            surface: e,
            deviceId: n,
            instance: String(o.instance || 'main'),
            deviceLabel: String(o.deviceLabel || ''),
            appMode: String(o.appMode || 'web'),
            route:
                String(o.route || '').trim() ||
                `${window.location.pathname}${window.location.search}`,
            status: String(o.status || 'warning'),
            summary: String(o.summary || ''),
            networkOnline:
                'boolean' == typeof o.networkOnline
                    ? o.networkOnline
                    : !1 !== navigator.onLine,
            lastEvent: String(o.lastEvent || i || 'heartbeat'),
            lastEventAt: String(o.lastEventAt || new Date().toISOString()),
            details: a,
        };
    }
    const t = 'queueKioskSeniorMode',
        i = 9e5,
        o = 'queueKioskOfflineOutbox',
        a = 'queueKioskPrinterState',
        r = 'kioskStarInlineStyles',
        s = {
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
    let c = null;
    function u(e, n = {}) {
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
    function l(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function d(e) {
        return document.getElementById(e);
    }
    function f() {
        const e = String(s.lastConnectionState || 'paused'),
            n = Number(s.offlineOutbox.length || 0),
            t = s.printerState,
            i = Boolean(t?.printed),
            o = String(t?.errorCode || ''),
            a = Boolean(s.queueLastHealthySyncAt);
        let r = 'warning',
            c = 'Kiosco pendiente de validación.';
        return (
            'offline' === e
                ? ((r = 'alert'),
                  (c =
                      'Kiosco sin conexión; usa contingencia local y deriva si crece la fila.'))
                : n > 0
                  ? ((r = 'warning'),
                    (c = `Kiosco con ${n} pendiente(s) offline por sincronizar.`))
                  : t && !i
                    ? ((r = 'alert'),
                      (c = `La última impresión falló${o ? ` (${o})` : ''}.`))
                    : i && a && 'live' === e
                      ? ((r = 'ready'),
                        (c =
                            'Kiosco listo: cola en vivo, térmica validada y sin pendientes offline.'))
                      : i ||
                        ((r = 'warning'),
                        (c =
                            'Falta probar ticket térmico antes de abrir autoservicio.')),
            {
                instance: 'main',
                deviceLabel: 'Kiosco principal',
                appMode:
                    'object' == typeof window.turneroDesktop &&
                    null !== window.turneroDesktop &&
                    'function' == typeof window.turneroDesktop.openSettings
                        ? 'desktop'
                        : 'web',
                status: r,
                summary: c,
                networkOnline: !1 !== navigator.onLine,
                lastEvent: i ? 'printer_ok' : 'heartbeat',
                lastEventAt: t?.at || new Date().toISOString(),
                details: {
                    connection: e,
                    pendingOffline: n,
                    printerPrinted: i,
                    printerErrorCode: o,
                    healthySync: a,
                    flow: String(s.selectedFlow || 'checkin'),
                },
            }
        );
    }
    function p() {
        return (
            c ||
            ((c = (function ({
                surface: t,
                intervalMs: i = 15e3,
                getPayload: o,
            } = {}) {
                const a = (function (e) {
                        const n = String(e || '')
                            .trim()
                            .toLowerCase();
                        return 'sala_tv' === n ? 'display' : n || 'operator';
                    })(t),
                    r = (function (n) {
                        const t = `queueSurfaceDeviceIdV1:${n}`;
                        try {
                            const i = localStorage.getItem(t);
                            if (i) return i;
                            const o = e(n);
                            return (localStorage.setItem(t, o), o);
                        } catch (t) {
                            return e(n);
                        }
                    })(a),
                    s = Math.max(5e3, Number(i || 15e3));
                let c = 0,
                    u = !1,
                    l = 0,
                    d = !1;
                async function f(e = 'interval', { keepalive: t = !1 } = {}) {
                    if (u) return !1;
                    u = !0;
                    try {
                        return (
                            !!(
                                await fetch(
                                    `/api.php?resource=${encodeURIComponent('queue-surface-heartbeat')}`,
                                    {
                                        method: 'POST',
                                        credentials: 'same-origin',
                                        keepalive: t,
                                        headers: {
                                            Accept: 'application/json',
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify(n(a, r, o, e)),
                                    }
                                )
                            ).ok && ((l = Date.now()), !0)
                        );
                    } catch (e) {
                        return !1;
                    } finally {
                        u = !1;
                    }
                }
                function p() {
                    'visible' === document.visibilityState && f('visible');
                }
                function m() {
                    f('online');
                }
                function g() {
                    f('unload', { keepalive: !0 });
                }
                function k() {
                    (c && (window.clearInterval(c), (c = 0)),
                        d &&
                            ((d = !1),
                            document.removeEventListener('visibilitychange', p),
                            window.removeEventListener('online', m),
                            window.removeEventListener('beforeunload', g)));
                }
                return {
                    start: function ({ immediate: e = !0 } = {}) {
                        (k(),
                            d ||
                                ((d = !0),
                                document.addEventListener(
                                    'visibilitychange',
                                    p
                                ),
                                window.addEventListener('online', m),
                                window.addEventListener('beforeunload', g)),
                            e && f('boot'),
                            (c = window.setInterval(() => {
                                'hidden' !== document.visibilityState &&
                                    f('interval');
                            }, s)));
                    },
                    stop: k,
                    notify: function (e = 'state_change') {
                        Date.now() - l < 4e3 || f(e);
                    },
                    beatNow: (e = 'manual') => f(e),
                    getDeviceId: () => r,
                };
            })({ surface: 'kiosk', intervalMs: 15e3, getPayload: f })),
            c)
        );
    }
    function m(e, n = 'info') {
        const t = d('kioskProgressHint');
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
    function g(e, n = 'info') {
        const t = d('kioskSeniorHint');
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
    function k(e, { persist: n = !0, source: i = 'ui' } = {}) {
        const o = Boolean(e);
        ((s.seniorMode = o),
            (document.body.dataset.kioskSenior = o ? 'on' : 'off'),
            (function () {
                const e = d('kioskSeniorToggle');
                if (!(e instanceof HTMLButtonElement)) return;
                const n = Boolean(s.seniorMode);
                ((e.dataset.active = n ? 'true' : 'false'),
                    e.setAttribute('aria-pressed', String(n)),
                    (e.textContent =
                        'Modo lectura grande: ' + (n ? 'On' : 'Off')));
            })(),
            n &&
                (function (e) {
                    try {
                        localStorage.setItem(t, e ? '1' : '0');
                    } catch (e) {}
                })(o),
            g(
                o
                    ? 'Modo lectura grande activo. Botones y textos ampliados.'
                    : 'Modo lectura grande desactivado.',
                o ? 'success' : 'info'
            ),
            u('senior_mode_changed', { enabled: o, source: i }));
    }
    function b({ source: e = 'ui' } = {}) {
        k(!s.seniorMode, { persist: !0, source: e });
    }
    function y() {
        return (
            'undefined' != typeof window &&
            'speechSynthesis' in window &&
            'function' == typeof window.speechSynthesis?.speak &&
            'function' == typeof window.SpeechSynthesisUtterance
        );
    }
    function h() {
        const e = d('kioskVoiceGuideBtn');
        if (!(e instanceof HTMLButtonElement)) return;
        const n = Boolean(s.voiceGuideSupported),
            t = Boolean(s.voiceGuideBusy);
        ((e.disabled = !n && !t),
            (e.textContent = n
                ? t
                    ? 'Leyendo instrucciones...'
                    : 'Leer instrucciones'
                : 'Voz guia no disponible'));
    }
    function v({ source: e = 'manual' } = {}) {
        if (!y())
            return (
                (s.voiceGuideBusy = !1),
                (s.voiceGuideUtterance = null),
                void h()
            );
        try {
            window.speechSynthesis.cancel();
        } catch (e) {}
        ((s.voiceGuideBusy = !1),
            (s.voiceGuideUtterance = null),
            h(),
            u('voice_guide_stopped', { source: e }));
    }
    function S({ source: e = 'button' } = {}) {
        if (!s.voiceGuideSupported)
            return (
                O(
                    'Guia por voz no disponible en este navegador. Usa ayuda rapida en pantalla.',
                    'info'
                ),
                g(
                    'Sin voz guia en este equipo. Usa ayuda rapida o pide apoyo.',
                    'warn'
                ),
                void u('voice_guide_unavailable', { source: e })
            );
        v({ source: 'restart' });
        const n = `Bienvenida al kiosco de turnos de Piel en Armonia. ${'walkin' === s.selectedFlow ? 'Si no tienes cita, escribe iniciales y pulsa Generar turno.' : 'Si tienes cita, escribe telefono, fecha y hora y pulsa Confirmar check in.'} Si necesitas ayuda, pulsa Necesito apoyo y recepcion te asistira. Conserva tu ticket y espera el llamado en la pantalla de sala.`;
        let t;
        try {
            t = new window.SpeechSynthesisUtterance(n);
        } catch (n) {
            return (
                O('No se pudo iniciar guia por voz en este equipo.', 'error'),
                void u('voice_guide_error', {
                    source: e,
                    reason: 'utterance_create_failed',
                })
            );
        }
        ((t.lang = 'es-EC'),
            (t.rate = 0.92),
            (t.pitch = 1),
            (t.onstart = () => {
                ((s.voiceGuideBusy = !0), h());
            }),
            (t.onend = () => {
                ((s.voiceGuideBusy = !1),
                    (s.voiceGuideUtterance = null),
                    h(),
                    u('voice_guide_finished', { source: e }));
            }),
            (t.onerror = () => {
                ((s.voiceGuideBusy = !1),
                    (s.voiceGuideUtterance = null),
                    h(),
                    O(
                        'La guia por voz se interrumpio. Puedes intentar nuevamente.',
                        'error'
                    ),
                    u('voice_guide_error', {
                        source: e,
                        reason: 'speech_error',
                    }));
            }));
        try {
            ((s.voiceGuideUtterance = t),
                (s.voiceGuideBusy = !0),
                h(),
                window.speechSynthesis.speak(t),
                O('Guia por voz iniciada.', 'info'),
                g(
                    'Escuchando guia por voz. Puedes seguir los pasos en pantalla.',
                    'success'
                ),
                u('voice_guide_started', { source: e }));
        } catch (n) {
            ((s.voiceGuideBusy = !1),
                (s.voiceGuideUtterance = null),
                h(),
                O('No se pudo reproducir guia por voz.', 'error'),
                u('voice_guide_error', {
                    source: e,
                    reason: 'speech_start_failed',
                }));
        }
    }
    function w({ source: e = 'button' } = {}) {
        const n =
            'Recepcion te ayudara enseguida. Mantente frente al kiosco o acude al mostrador.';
        (O(n, 'info'),
            m(
                'Apoyo solicitado: recepcion te asistira para completar el turno.',
                'warn'
            ),
            me('bot', n),
            u('reception_support_requested', { source: e }));
    }
    function x(e, { source: n = 'ui' } = {}) {
        const t = d('kioskQuickHelpPanel'),
            i = d('kioskHelpToggle');
        if (!(t instanceof HTMLElement && i instanceof HTMLButtonElement))
            return;
        const o = Boolean(e);
        ((s.quickHelpOpen = o),
            (t.hidden = !o),
            (i.dataset.open = o ? 'true' : 'false'),
            i.setAttribute('aria-expanded', String(o)),
            u('quick_help_toggled', { open: o, source: n }),
            m(
                o
                    ? 'Guia abierta: elige opcion, completa datos y confirma ticket.'
                    : 'Paso 1 de 2: selecciona una opcion para comenzar.',
                'info'
            ));
    }
    function L(e, { announce: n = !0 } = {}) {
        const t =
            'walkin' === String(e || '').toLowerCase() ? 'walkin' : 'checkin';
        s.selectedFlow = t;
        const i = d('checkinForm'),
            o = d('walkinForm');
        (i instanceof HTMLElement &&
            i.classList.toggle('is-flow-active', 'checkin' === t),
            o instanceof HTMLElement &&
                o.classList.toggle('is-flow-active', 'walkin' === t));
        const a = d('kioskQuickCheckin'),
            r = d('kioskQuickWalkin');
        if (a instanceof HTMLButtonElement) {
            const e = 'checkin' === t;
            ((a.dataset.active = e ? 'true' : 'false'),
                a.setAttribute('aria-pressed', String(e)));
        }
        if (r instanceof HTMLButtonElement) {
            const e = 'walkin' === t;
            ((r.dataset.active = e ? 'true' : 'false'),
                r.setAttribute('aria-pressed', String(e)));
        }
        const c = d('walkin' === t ? 'walkinInitials' : 'checkinPhone');
        (c instanceof HTMLInputElement && c.focus({ preventScroll: !1 }),
            n &&
                m(
                    'walkin' === t
                        ? 'Paso 2: escribe iniciales y pulsa "Generar turno".'
                        : 'Paso 2: escribe telefono, fecha y hora para check-in.',
                    'info'
                ),
            u('flow_focus', { target: t }));
    }
    function q(e, n) {
        if (!e || 'object' != typeof e || !Array.isArray(n)) return [];
        for (const t of n) if (t && Array.isArray(e[t])) return e[t];
        return [];
    }
    function T(e, n) {
        if (!e || 'object' != typeof e || !Array.isArray(n)) return null;
        for (const t of n) {
            if (!t) continue;
            const n = e[t];
            if (n && 'object' == typeof n && !Array.isArray(n)) return n;
        }
        return null;
    }
    function E(e, n, t = 0) {
        if (!e || 'object' != typeof e || !Array.isArray(n))
            return Number(t || 0);
        for (const t of n) {
            if (!t) continue;
            const n = Number(e[t]);
            if (Number.isFinite(n)) return n;
        }
        return Number(t || 0);
    }
    function M(e) {
        const n = e && 'object' == typeof e ? e : {},
            t = T(n, ['counts']) || {},
            i = E(n, ['waitingCount', 'waiting_count'], Number.NaN),
            o = E(n, ['calledCount', 'called_count'], Number.NaN);
        let a = q(n, [
            'callingNow',
            'calling_now',
            'calledTickets',
            'called_tickets',
        ]);
        if (0 === a.length) {
            const e = T(n, [
                'callingNowByConsultorio',
                'calling_now_by_consultorio',
            ]);
            e && (a = Object.values(e).filter(Boolean));
        }
        const r = q(n, [
                'nextTickets',
                'next_tickets',
                'waitingTickets',
                'waiting_tickets',
            ]),
            s = Number.isFinite(i)
                ? i
                : E(t, ['waiting', 'waiting_count'], r.length),
            c = Number.isFinite(o)
                ? o
                : E(t, ['called', 'called_count'], a.length);
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
    async function C(e, { method: n = 'GET', body: t } = {}) {
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
    function O(e, n = 'info') {
        const t = d('kioskStatus');
        if (!t) return;
        const i = String(e || '').trim() || 'Estado operativo',
            o = String(n || 'info').toLowerCase(),
            a =
                i !== String(t.textContent || '').trim() ||
                o !== String(t.dataset.status || '').toLowerCase();
        ((t.textContent = i),
            (t.dataset.status = o),
            a && u('kiosk_status', { status: o, message: i }));
    }
    function H(e, n) {
        const t = d('queueConnectionState');
        if (!t) return;
        const i = String(e || 'live').toLowerCase(),
            o = {
                live: 'Cola conectada',
                reconnecting: 'Reintentando conexion',
                offline: 'Sin conexion al backend',
                paused: 'Cola en pausa',
            },
            a = String(n || '').trim() || o[i] || o.live,
            r = i !== s.lastConnectionState || a !== s.lastConnectionMessage;
        ((s.lastConnectionState = i),
            (s.lastConnectionMessage = a),
            (t.dataset.state = i),
            (t.textContent = a),
            r && u('connection_state', { state: i, message: a }),
            P());
    }
    function I() {
        const e = d('kioskSessionCountdown');
        if (!(e instanceof HTMLElement)) return;
        if (!s.idleDeadlineTs)
            return (
                (e.textContent = 'Privacidad auto: --:--'),
                void (e.dataset.state = 'normal')
            );
        const n = Math.max(0, s.idleDeadlineTs - Date.now());
        e.textContent = `Privacidad auto: ${(function (e) {
            const n = Math.max(0, Number(e || 0)),
                t = Math.ceil(n / 1e3);
            return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
        })(n)}`;
        const t = n <= 2e4;
        e.dataset.state = t ? 'warning' : 'normal';
    }
    function B() {
        const e = d('ticketResult');
        e &&
            (e.innerHTML =
                '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>');
    }
    function _() {
        const e = d('assistantMessages');
        (e && (e.innerHTML = ''),
            (s.chatHistory = []),
            me(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ));
        const n = d('assistantInput');
        n instanceof HTMLInputElement && (n.value = '');
    }
    function A({ durationMs: e = null } = {}) {
        const n = Math.min(
            i,
            Math.max(
                5e3,
                Math.round(
                    Number.isFinite(Number(e)) ? Number(e) : s.idleResetMs
                )
            )
        );
        (s.idleTimerId &&
            (window.clearTimeout(s.idleTimerId), (s.idleTimerId = 0)),
            s.idleTickId &&
                (window.clearInterval(s.idleTickId), (s.idleTickId = 0)),
            (s.idleDeadlineTs = Date.now() + n),
            I(),
            (s.idleTickId = window.setInterval(() => {
                I();
            }, 1e3)),
            (s.idleTimerId = window.setTimeout(() => {
                if (s.assistantBusy || s.queueManualRefreshBusy)
                    return (
                        O(
                            'Sesion activa. Reprogramando limpieza automatica.',
                            'info'
                        ),
                        void A({ durationMs: 15e3 })
                    );
                N({ reason: 'idle_timeout' });
            }, n)));
    }
    function $() {
        (ke({ reason: 'activity' }), A());
    }
    function N({ reason: e = 'manual' } = {}) {
        (v({ source: 'session_reset' }),
            (function () {
                const e = d('checkinForm'),
                    n = d('walkinForm');
                (e instanceof HTMLFormElement && e.reset(),
                    n instanceof HTMLFormElement && n.reset(),
                    be());
            })(),
            _(),
            B(),
            x(!1, { source: 'session_reset' }),
            L('checkin', { announce: !1 }),
            O(
                'idle_timeout' === e
                    ? 'Sesion reiniciada por inactividad para proteger privacidad.'
                    : 'Pantalla limpiada. Lista para el siguiente paciente.',
                'info'
            ),
            m('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            V(),
            A());
    }
    function D() {
        let e = d('queueOpsHint');
        if (e) return e;
        const n = document.querySelector('.kiosk-side .kiosk-card'),
            t = d('queueUpdatedAt');
        return n && t
            ? ((e = document.createElement('p')),
              (e.id = 'queueOpsHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function z(e) {
        const n = D();
        n && (n.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function P() {
        const e = d('kioskSetupTitle'),
            n = d('kioskSetupSummary'),
            t = d('kioskSetupChecks');
        if (
            !(
                e instanceof HTMLElement &&
                n instanceof HTMLElement &&
                t instanceof HTMLElement
            )
        )
            return;
        const i = String(s.lastConnectionState || 'paused'),
            o = String(s.lastConnectionMessage || 'Sincronizacion pendiente'),
            a = Number(s.offlineOutbox.length || 0),
            r = s.printerState,
            c = Boolean(r?.printed),
            u = Boolean(r && !r.printed),
            f = Boolean(s.queueLastHealthySyncAt),
            m = Date.parse(String(s.offlineOutbox[0]?.queuedAt || '')),
            g = Number.isFinite(m) ? X(Date.now() - m) : '',
            k = [
                {
                    label: 'Conexion con cola',
                    state:
                        'live' === i
                            ? f
                                ? 'ready'
                                : 'warning'
                            : 'offline' === i
                              ? 'danger'
                              : 'warning',
                    detail:
                        'live' === i
                            ? f
                                ? `Backend en vivo (${ee()}).`
                                : 'Conectado, pero esperando la primera sincronizacion saludable.'
                            : o,
                },
                {
                    label: 'Impresora termica',
                    state: r ? (c ? 'ready' : 'danger') : 'warning',
                    detail: r
                        ? c
                            ? `Impresion OK · ${oe(r.at)}`
                            : `Sin impresion (${r.errorCode || r.message || 'sin detalle'}) · ${oe(r.at)}`
                        : 'Sin ticket de prueba todavia. Genera uno para validar papel y USB.',
                },
                {
                    label: 'Pendientes offline',
                    state:
                        a <= 0
                            ? 'ready'
                            : 'offline' === i
                              ? 'danger'
                              : 'warning',
                    detail:
                        a <= 0
                            ? 'Sin pendientes locales.'
                            : `Hay ${a} pendiente(s) por subir${g ? ` · mas antiguo ${g}` : ''}.`,
                },
                {
                    label: 'Operacion guiada',
                    state: f ? 'ready' : 'warning',
                    detail: f
                        ? 'La cola ya respondio en este arranque. Puedes abrir el kiosco al publico.'
                        : 'Mantiene el flujo abierto, pero falta una sincronizacion completa desde este arranque.',
                },
            ];
        let b = 'Finaliza la puesta en marcha',
            y =
                'Revisa backend, termica y pendientes antes de dejar el kiosco en autoservicio.';
        ('offline' === i
            ? ((b = 'Kiosco en contingencia'),
              (y =
                  'El kiosco puede seguir capturando datos, pero el backend no responde. Si la fila crece, deriva a recepcion.'))
            : a > 0
              ? ((b = 'Kiosco con pendientes por sincronizar'),
                (y =
                    'Hay solicitudes guardadas offline. Manten el equipo abierto hasta que el outbox vuelva a cero.'))
              : u
                ? ((b = 'Revisa la impresora termica'),
                  (y =
                      'El ultimo ticket no confirmo impresion. Verifica energia, papel y cable USB, y repite una prueba.'))
                : c
                  ? 'live' === i &&
                    f &&
                    ((b = 'Kiosco listo para operar'),
                    (y =
                        'La cola esta en vivo, no hay pendientes offline y la termica ya respondio correctamente.'))
                  : ((b = 'Falta probar ticket termico'),
                    (y =
                        'Genera un turno de prueba y confirma "Impresion OK" antes de operar con pacientes.')),
            (e.textContent = b),
            (n.textContent = y),
            (t.innerHTML = k
                .map(
                    (e) =>
                        `\n                <article class="kiosk-setup-check" data-state="${l(e.state)}" role="listitem">\n                    <strong>${l(e.label)}</strong>\n                    <span>${l(e.detail)}</span>\n                </article>\n            `
                )
                .join('')),
            (function (e = 'state_change') {
                p().notify(e);
            })('setup_status'));
    }
    function F() {
        let e = d('queueOutboxHint');
        if (e) return e;
        const n = D();
        return n?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queueOutboxHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Pendientes offline: 0'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function R(e) {
        const n = F();
        n &&
            (n.textContent = String(e || '').trim() || 'Pendientes offline: 0');
    }
    function j() {
        let e = d('queuePrinterHint');
        if (e) return e;
        const n = F();
        return n?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queuePrinterHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Impresora: estado pendiente.'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function G() {
        const e = j();
        if (!e) return;
        const n = s.printerState;
        if (!n)
            return ((e.textContent = 'Impresora: estado pendiente.'), void P());
        const t = n.printed ? 'impresion OK' : n.errorCode || 'sin impresion',
            i = n.message ? ` (${n.message})` : '',
            o = oe(n.at);
        ((e.textContent = `Impresora: ${t}${i} · ${o}`), P());
    }
    function U() {
        let e = d('queueOutboxConsole');
        if (e instanceof HTMLElement) return e;
        const n = F();
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
    function K(e) {
        const n = d('queueOutboxRetryBtn'),
            t = d('queueOutboxClearBtn'),
            i = d('queueOutboxDropOldestBtn');
        (n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(e) || !s.offlineOutbox.length),
            (n.textContent = e
                ? 'Sincronizando...'
                : 'Sincronizar pendientes')),
            t instanceof HTMLButtonElement &&
                (t.disabled = Boolean(e) || !s.offlineOutbox.length),
            i instanceof HTMLButtonElement &&
                (i.disabled = Boolean(e) || s.offlineOutbox.length <= 0));
    }
    function J() {
        U();
        const e = d('queueOutboxSummary'),
            n = d('queueOutboxList'),
            t = s.offlineOutbox.length;
        (e instanceof HTMLElement &&
            (e.textContent =
                t <= 0 ? 'Outbox: 0 pendientes' : `Outbox: ${t} pendiente(s)`),
            n instanceof HTMLElement &&
                (n.innerHTML =
                    t <= 0
                        ? '<li class="queue-empty">Sin pendientes offline.</li>'
                        : s.offlineOutbox
                              .slice(0, 6)
                              .map((e, n) => {
                                  const t = oe(e.queuedAt),
                                      i = Number(e.attempts || 0);
                                  return `<li><strong>${l(e.originLabel)}</strong> · ${l(e.patientInitials || '--')} · ${l(e.queueType || '--')} · ${l(t)} · intento ${n + 1}/${Math.max(1, i + 1)}</li>`;
                              })
                              .join('')),
            K(!1));
    }
    function Q({ reason: e = 'manual' } = {}) {
        ((s.offlineOutbox = []),
            W(),
            V(),
            J(),
            'manual' === e &&
                O('Pendientes offline limpiados manualmente.', 'info'));
    }
    function W() {
        try {
            localStorage.setItem(o, JSON.stringify(s.offlineOutbox));
        } catch (e) {}
    }
    function V() {
        const e = s.offlineOutbox.length;
        if (e <= 0)
            return (
                R('Pendientes offline: 0 (sin pendientes).'),
                J(),
                void P()
            );
        const n = Date.parse(String(s.offlineOutbox[0]?.queuedAt || ''));
        (R(
            `Pendientes offline: ${e} - sincronizacion automatica al reconectar${Number.isFinite(n) ? ` - mas antiguo ${X(Date.now() - n)}` : ''}`
        ),
            J(),
            P());
    }
    function Y() {
        let e = d('queueManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const n = d('queueUpdatedAt');
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
    function Z(e) {
        const n = Y();
        n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(e)),
            (n.textContent = e
                ? 'Actualizando cola...'
                : 'Reintentar sincronizacion'));
    }
    function X(e) {
        const n = Math.max(0, Number(e || 0)),
            t = Math.round(n / 1e3);
        if (t < 60) return `${t}s`;
        const i = Math.floor(t / 60),
            o = t % 60;
        return o <= 0 ? `${i}m` : `${i}m ${o}s`;
    }
    function ee() {
        return s.queueLastHealthySyncAt
            ? `hace ${X(Date.now() - s.queueLastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function ne(e) {
        const n = d('queueUpdatedAt');
        if (!n) return;
        const t = M({ updatedAt: e }),
            i = Date.parse(String(t.updatedAt || ''));
        Number.isFinite(i)
            ? (n.textContent = `Actualizado ${new Date(i).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (n.textContent = 'Actualizacion pendiente');
    }
    function te() {
        const e = Math.max(0, Number(s.queueFailureStreak || 0)),
            n = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, n);
    }
    function ie() {
        s.queueTimerId &&
            (window.clearTimeout(s.queueTimerId), (s.queueTimerId = 0));
    }
    function oe(e) {
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
    async function ae() {
        if (s.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        s.queueRefreshBusy = !0;
        try {
            const e = await C('queue-state');
            ((s.queueState = M(e.data || {})),
                (function (e) {
                    const n = M(e),
                        t = d('queueWaitingCount'),
                        i = d('queueCalledCount'),
                        o = d('queueCallingNow'),
                        a = d('queueNextList');
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
                                          `\n                        <article class="queue-called-card">\n                            <header>Consultorio ${l(e.assignedConsultorio)}</header>\n                            <strong>${l(e.ticketCode || '--')}</strong>\n                            <span>${l(e.patientInitials || '--')}</span>\n                        </article>\n                    `
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
                                          `\n                        <li>\n                            <span class="ticket-code">${l(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${l(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${l(e.position || '-')}</span>\n                        </li>\n                    `
                                  )
                                  .join(''));
                    }
                })(s.queueState),
                ne(s.queueState?.updatedAt));
            const n = (function (e) {
                const n = M(e),
                    t = Date.parse(String(n.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const i = Math.max(0, Date.now() - t);
                return { stale: i >= 3e4, missingTimestamp: !1, ageMs: i };
            })(s.queueState);
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
            s.queueRefreshBusy = !1;
        }
    }
    function re(e, n) {
        const t = d('ticketResult');
        if (!t) return;
        const i = e?.data || {},
            o = {
                ...i,
                id: Number(i?.id || i?.ticket_id || 0) || 0,
                ticketCode: String(i?.ticketCode || i?.ticket_code || '--'),
                patientInitials: String(
                    i?.patientInitials || i?.patient_initials || '--'
                ),
                queueType: String(i?.queueType || i?.queue_type || 'walk_in'),
                createdAt: String(
                    i?.createdAt || i?.created_at || new Date().toISOString()
                ),
            },
            r = e?.print || {};
        !(function (e, { origin: n = 'ticket' } = {}) {
            const t = e?.print || {};
            ((s.printerState = {
                ok: Boolean(t.ok),
                printed: Boolean(e?.printed),
                errorCode: String(t.errorCode || ''),
                message: String(t.message || ''),
                at: new Date().toISOString(),
            }),
                (function () {
                    try {
                        localStorage.setItem(a, JSON.stringify(s.printerState));
                    } catch (e) {}
                })(),
                G(),
                u('printer_result', {
                    origin: n,
                    ok: s.printerState.ok,
                    printed: s.printerState.printed,
                    errorCode: s.printerState.errorCode,
                }));
        })(e, { origin: n });
        const c = Array.isArray(s.queueState?.nextTickets)
                ? s.queueState.nextTickets
                : [],
            f = c.find((e) => Number(e.id) === Number(o.id))?.position || '-',
            p = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${l(r.message || 'sin detalle')})`;
        t.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${l(n)}</p>\n            <div class="ticket-result-main">\n                <strong>${l(o.ticketCode || '--')}</strong>\n                <span>${l(o.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${l(f)}</dd></div>\n                <div><dt>Tipo</dt><dd>${l(o.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${l(oe(o.createdAt))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">${p}</p>\n        </article>\n    `;
    }
    function se({
        originLabel: e,
        patientInitials: n,
        queueType: t,
        queuedAt: i,
    }) {
        const o = d('ticketResult');
        o &&
            (o.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Solicitud guardada offline</h3>\n            <p class="ticket-result-origin">${l(e)}</p>\n            <div class="ticket-result-main">\n                <strong>${l(`PEND-${String(s.offlineOutbox.length).padStart(2, '0')}`)}</strong>\n                <span>${l(n || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>\n                <div><dt>Tipo</dt><dd>${l(t || '--')}</dd></div>\n                <div><dt>Guardado</dt><dd>${l(oe(i))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>\n        </article>\n    `);
    }
    function ce(e) {
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
    function ue(e, n) {
        const t = String(e || '').toLowerCase(),
            i = (function (e) {
                const n = e && 'object' == typeof e ? e : {};
                return Object.keys(n)
                    .sort()
                    .reduce((e, t) => ((e[t] = n[t]), e), {});
            })(n);
        return `${t}:${JSON.stringify(i)}`;
    }
    function le({
        resource: e,
        body: n,
        originLabel: t,
        patientInitials: i,
        queueType: o,
    }) {
        const a = String(e || '');
        if ('queue-ticket' !== a && 'queue-checkin' !== a) return null;
        const r = ue(a, n),
            c = Date.now(),
            l = s.offlineOutbox.find((e) => {
                if (String(e?.fingerprint || '') !== r) return !1;
                const n = Date.parse(String(e?.queuedAt || ''));
                return !!Number.isFinite(n) && c - n <= 9e4;
            });
        if (l)
            return (
                u('offline_queued_duplicate', { resource: a, fingerprint: r }),
                { ...l, deduped: !0 }
            );
        const d = {
            id: `offline_${Date.now()}_${Math.floor(1e5 * Math.random())}`,
            resource: a,
            body: n && 'object' == typeof n ? n : {},
            originLabel: String(t || 'Solicitud offline'),
            patientInitials: String(i || '--'),
            queueType: String(o || '--'),
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: '',
            fingerprint: r,
        };
        return (
            (s.offlineOutbox = [d, ...s.offlineOutbox].slice(0, 25)),
            W(),
            V(),
            u('offline_queued', {
                resource: a,
                queueSize: s.offlineOutbox.length,
            }),
            d
        );
    }
    async function de({
        source: e = 'auto',
        force: n = !1,
        maxItems: t = 4,
    } = {}) {
        if (s.offlineOutboxFlushBusy) return;
        if (!s.offlineOutbox.length) return;
        if (!n && !1 === navigator.onLine) return;
        ((s.offlineOutboxFlushBusy = !0), K(!0));
        let i = 0;
        try {
            for (
                ;
                s.offlineOutbox.length && i < Math.max(1, Number(t || 1));
            ) {
                const e = s.offlineOutbox[0];
                try {
                    const n = await C(e.resource, {
                        method: 'POST',
                        body: e.body,
                    });
                    (s.offlineOutbox.shift(),
                        W(),
                        V(),
                        re(n, `${e.originLabel} (sincronizado)`),
                        O(
                            `Pendiente sincronizado (${e.originLabel})`,
                            'success'
                        ),
                        u('offline_synced_item', {
                            resource: e.resource,
                            originLabel: e.originLabel,
                            pendingAfter: s.offlineOutbox.length,
                        }),
                        (i += 1));
                } catch (n) {
                    ((e.attempts = Number(e.attempts || 0) + 1),
                        (e.lastError = String(n?.message || '').slice(0, 180)),
                        (e.lastAttemptAt = new Date().toISOString()),
                        W(),
                        V());
                    const t = ce(n);
                    (O(
                        t
                            ? 'Sincronizacion offline pendiente: esperando reconexion.'
                            : `Pendiente con error: ${n.message}`,
                        t ? 'info' : 'error'
                    ),
                        u('offline_sync_error', {
                            resource: e.resource,
                            retryingOffline: t,
                            error: String(n?.message || ''),
                        }));
                    break;
                }
            }
            i > 0 &&
                ((s.queueFailureStreak = 0),
                (await ae()).ok &&
                    ((s.queueLastHealthySyncAt = Date.now()),
                    H('live', 'Cola conectada'),
                    z(`Outbox sincronizado desde ${e}. (${ee()})`),
                    u('offline_synced_batch', {
                        source: e,
                        processed: i,
                        pendingAfter: s.offlineOutbox.length,
                    })));
        } finally {
            ((s.offlineOutboxFlushBusy = !1), J());
        }
    }
    async function fe(e) {
        if (
            (e.preventDefault(),
            $(),
            ke({ reason: 'form_submit' }),
            !(e.currentTarget instanceof HTMLFormElement))
        )
            return;
        const n = d('checkinPhone'),
            t = d('checkinTime'),
            i = d('checkinDate'),
            o = d('checkinInitials'),
            a = d('checkinSubmit'),
            r = n instanceof HTMLInputElement ? n.value.trim() : '',
            c = t instanceof HTMLInputElement ? t.value.trim() : '',
            u = i instanceof HTMLInputElement ? i.value.trim() : '',
            l = o instanceof HTMLInputElement ? o.value.trim() : '';
        if (!r || !c || !u)
            return (
                O(
                    'Telefono, fecha y hora son obligatorios para check-in',
                    'error'
                ),
                void m(
                    'Completa telefono, fecha y hora para continuar.',
                    'warn'
                )
            );
        a instanceof HTMLButtonElement && (a.disabled = !0);
        try {
            const e = { telefono: r, hora: c, fecha: u, patientInitials: l },
                n = await C('queue-checkin', { method: 'POST', body: e });
            (O('Check-in registrado correctamente', 'success'),
                m(
                    'Check-in completado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                re(n, n.replay ? 'Check-in ya existente' : 'Check-in de cita'),
                (s.queueFailureStreak = 0),
                (await ae()).ok ||
                    H(
                        'reconnecting',
                        'Check-in registrado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (ce(e)) {
                const e = le({
                    resource: 'queue-checkin',
                    body: {
                        telefono: r,
                        hora: c,
                        fecha: u,
                        patientInitials: l,
                    },
                    originLabel: 'Check-in de cita',
                    patientInitials: l || r.slice(-2),
                    queueType: 'appointment',
                });
                if (e)
                    return (
                        H('offline', 'Sin conexion al backend'),
                        z(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        se({
                            originLabel: e.originLabel,
                            patientInitials: e.patientInitials,
                            queueType: e.queueType,
                            queuedAt: e.queuedAt,
                        }),
                        O(
                            e.deduped
                                ? 'Check-in ya pendiente offline. Se sincronizara automaticamente.'
                                : 'Check-in guardado offline. Se sincronizara automaticamente.',
                            'info'
                        ),
                        void m(
                            'Check-in guardado offline. Recepcion confirmara al reconectar.',
                            'warn'
                        )
                    );
            }
            (O(`No se pudo registrar el check-in: ${e.message}`, 'error'),
                m(
                    'No se pudo confirmar check-in. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            a instanceof HTMLButtonElement && (a.disabled = !1);
        }
    }
    async function pe(e) {
        (e.preventDefault(), $(), ke({ reason: 'form_submit' }));
        const n = d('walkinName'),
            t = d('walkinInitials'),
            i = d('walkinPhone'),
            o = d('walkinSubmit'),
            a = n instanceof HTMLInputElement ? n.value.trim() : '',
            r =
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
                })(a),
            c = i instanceof HTMLInputElement ? i.value.trim() : '';
        if (!r)
            return (
                O('Ingresa iniciales o nombre para generar el turno', 'error'),
                void m('Escribe iniciales para generar tu turno.', 'warn')
            );
        o instanceof HTMLButtonElement && (o.disabled = !0);
        try {
            const e = { patientInitials: r, name: a, phone: c },
                n = await C('queue-ticket', { method: 'POST', body: e });
            (O('Turno walk-in registrado correctamente', 'success'),
                m(
                    'Turno generado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                re(n, 'Turno sin cita'),
                (s.queueFailureStreak = 0),
                (await ae()).ok ||
                    H(
                        'reconnecting',
                        'Turno creado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (ce(e)) {
                const e = le({
                    resource: 'queue-ticket',
                    body: { patientInitials: r, name: a, phone: c },
                    originLabel: 'Turno sin cita',
                    patientInitials: r,
                    queueType: 'walk_in',
                });
                if (e)
                    return (
                        H('offline', 'Sin conexion al backend'),
                        z(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        se({
                            originLabel: e.originLabel,
                            patientInitials: e.patientInitials,
                            queueType: e.queueType,
                            queuedAt: e.queuedAt,
                        }),
                        O(
                            e.deduped
                                ? 'Turno ya pendiente offline. Se sincronizara automaticamente.'
                                : 'Turno guardado offline. Se sincronizara automaticamente.',
                            'info'
                        ),
                        void m(
                            'Turno guardado offline. Recepcion lo sincronizara al reconectar.',
                            'warn'
                        )
                    );
            }
            (O(`No se pudo crear el turno: ${e.message}`, 'error'),
                m(
                    'No se pudo generar turno. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            o instanceof HTMLButtonElement && (o.disabled = !1);
        }
    }
    function me(e, n) {
        const t = d('assistantMessages');
        if (!t) return;
        const i = document.createElement('article');
        ((i.className = `assistant-message assistant-message-${e}`),
            (i.innerHTML = `<p>${l(n)}</p>`),
            t.appendChild(i),
            (t.scrollTop = t.scrollHeight));
    }
    async function ge(e) {
        if ((e.preventDefault(), $(), s.assistantBusy)) return;
        const n = d('assistantInput'),
            t = d('assistantSend');
        if (!(n instanceof HTMLInputElement)) return;
        const i = n.value.trim();
        if (i) {
            (me('user', i),
                (n.value = ''),
                (s.assistantBusy = !0),
                t instanceof HTMLButtonElement && (t.disabled = !0));
            try {
                const e = [
                        {
                            role: 'system',
                            content:
                                'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                        },
                        ...s.chatHistory.slice(-6),
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
                (me('bot', o),
                    (s.chatHistory = [
                        ...s.chatHistory,
                        { role: 'user', content: i },
                        { role: 'assistant', content: o },
                    ].slice(-8)));
            } catch (e) {
                me(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                );
            } finally {
                ((s.assistantBusy = !1),
                    t instanceof HTMLButtonElement && (t.disabled = !1));
            }
        }
    }
    function ke({ reason: e = 'auto' } = {}) {
        if (s.welcomeDismissed) return;
        s.welcomeDismissed = !0;
        const n = d('kioskWelcomeScreen');
        n instanceof HTMLElement &&
            (n.classList.add('is-hidden'),
            window.setTimeout(() => {
                n.parentElement && n.remove();
            }, 700),
            u('welcome_dismissed', { reason: e }));
    }
    function be() {
        const e = d('checkinDate');
        e instanceof HTMLInputElement &&
            !e.value &&
            (e.value = new Date().toISOString().slice(0, 10));
    }
    function ye({ immediate: e = !1 } = {}) {
        if ((ie(), !s.queuePollingEnabled)) return;
        const n = e ? 0 : te();
        s.queueTimerId = window.setTimeout(() => {
            he();
        }, n);
    }
    async function he() {
        if (!s.queuePollingEnabled) return;
        if (document.hidden)
            return (
                H('paused', 'Cola en pausa (pestana oculta)'),
                z('Pestana oculta. Turnero en pausa temporal.'),
                void ye()
            );
        if (!1 === navigator.onLine)
            return (
                (s.queueFailureStreak += 1),
                H('offline', 'Sin conexion al backend'),
                z(
                    'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
                ),
                V(),
                void ye()
            );
        await de({ source: 'poll' });
        const e = await ae();
        if (e.ok && !e.stale)
            ((s.queueFailureStreak = 0),
                (s.queueLastHealthySyncAt = Date.now()),
                H('live', 'Cola conectada'),
                z(
                    `Operacion estable (${ee()}). Kiosco disponible para turnos.`
                ));
        else if (e.ok && e.stale) {
            s.queueFailureStreak += 1;
            const n = X(e.ageMs || 0);
            (H('reconnecting', `Watchdog: cola estancada ${n}`),
                z(
                    `Cola degradada: sin cambios en ${n}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
                ));
        } else {
            s.queueFailureStreak += 1;
            const e = Math.max(1, Math.ceil(te() / 1e3));
            (H('reconnecting', `Reintentando en ${e}s`),
                z(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        (V(), ye());
    }
    async function ve() {
        if (!s.queueManualRefreshBusy) {
            ($(),
                (s.queueManualRefreshBusy = !0),
                Z(!0),
                H('reconnecting', 'Refrescando manualmente...'));
            try {
                await de({ source: 'manual' });
                const e = await ae();
                if (e.ok && !e.stale)
                    return (
                        (s.queueFailureStreak = 0),
                        (s.queueLastHealthySyncAt = Date.now()),
                        H('live', 'Cola conectada'),
                        void z(`Sincronizacion manual exitosa (${ee()}).`)
                    );
                if (e.ok && e.stale) {
                    const n = X(e.ageMs || 0);
                    return (
                        H('reconnecting', `Watchdog: cola estancada ${n}`),
                        void z(
                            `Persisten datos estancados (${n}). Verifica backend o recepcion.`
                        )
                    );
                }
                const n = Math.max(1, Math.ceil(te() / 1e3));
                (H(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion al backend'
                        : `Reintentando en ${n}s`
                ),
                    z(
                        !1 === navigator.onLine
                            ? 'Sin internet. Opera manualmente en recepcion.'
                            : `Refresh manual sin exito. Reintento automatico en ${n}s.`
                    ));
            } finally {
                (V(), (s.queueManualRefreshBusy = !1), Z(!1));
            }
        }
    }
    function Se({ immediate: e = !0 } = {}) {
        if (((s.queuePollingEnabled = !0), e))
            return (H('live', 'Sincronizando cola...'), void he());
        ye();
    }
    function we({ reason: e = 'paused' } = {}) {
        ((s.queuePollingEnabled = !1), (s.queueFailureStreak = 0), ie());
        const n = String(e || 'paused').toLowerCase();
        return 'offline' === n
            ? (H('offline', 'Sin conexion al backend'),
              z('Sin conexion. Esperando reconexion para reanudar cola.'),
              void V())
            : 'hidden' === n
              ? (H('paused', 'Cola en pausa (pestana oculta)'),
                void z('Pestana oculta. Reanudando al volver a primer plano.'))
              : (H('paused', 'Cola en pausa'),
                z('Sincronizacion pausada por navegacion.'),
                void V());
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((document.body.dataset.kioskMode = 'star'),
            (function () {
                if (document.getElementById(r)) return;
                const e = document.createElement('style');
                ((e.id = r),
                    (e.textContent =
                        "\n        body[data-kiosk-mode='star'] .kiosk-header {\n            border-bottom-color: color-mix(in srgb, var(--primary) 18%, var(--border));\n            box-shadow: 0 10px 28px rgb(15 31 54 / 10%);\n        }\n        .kiosk-header-tools {\n            display: grid;\n            gap: 0.35rem;\n            justify-items: end;\n        }\n        .kiosk-header-controls {\n            display: grid;\n            grid-template-columns: repeat(3, minmax(0, 1fr));\n            gap: 0.45rem;\n            width: 100%;\n            max-width: 620px;\n        }\n        .kiosk-header-help-btn {\n            border: 1px solid var(--border);\n            border-radius: 999px;\n            padding: 0.34rem 0.72rem;\n            background: var(--surface-soft);\n            color: var(--text);\n            font-size: 0.86rem;\n            font-weight: 600;\n            cursor: pointer;\n            min-height: 44px;\n        }\n        .kiosk-header-help-btn[data-variant='warning'] {\n            border-color: color-mix(in srgb, #b45309 32%, #fff 68%);\n            background: color-mix(in srgb, #fef3c7 88%, #fff 12%);\n            color: #92400e;\n        }\n        .kiosk-header-help-btn[data-open='true'] {\n            border-color: color-mix(in srgb, var(--primary) 38%, #fff 62%);\n            background: color-mix(in srgb, var(--surface-strong) 84%, #fff 16%);\n            color: var(--primary-strong);\n        }\n        .kiosk-header-help-btn[data-active='true'] {\n            border-color: color-mix(in srgb, var(--primary) 42%, #fff 58%);\n            background: color-mix(in srgb, var(--surface-strong) 84%, #fff 16%);\n            color: var(--primary-strong);\n            box-shadow: 0 10px 24px rgb(15 107 220 / 15%);\n        }\n        .kiosk-header-help-btn[disabled] {\n            opacity: 0.65;\n            cursor: not-allowed;\n            box-shadow: none;\n        }\n        .kiosk-quick-actions {\n            display: grid;\n            grid-template-columns: repeat(2, minmax(0, 1fr));\n            gap: 0.65rem;\n            margin: 0.45rem 0 0.6rem;\n        }\n        .kiosk-quick-action {\n            border: 1px solid var(--border);\n            border-radius: 16px;\n            padding: 0.8rem 0.92rem;\n            background: var(--surface-soft);\n            color: var(--text);\n            font-size: 1rem;\n            font-weight: 700;\n            letter-spacing: 0.01em;\n            cursor: pointer;\n            min-height: 64px;\n            text-align: left;\n        }\n        .kiosk-quick-action[data-active='true'] {\n            border-color: color-mix(in srgb, var(--primary) 42%, #fff 58%);\n            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);\n            color: var(--primary-strong);\n            box-shadow: 0 12px 26px rgb(15 107 220 / 14%);\n        }\n        .kiosk-progress-hint {\n            margin: 0 0 0.72rem;\n            color: var(--muted);\n            font-size: 0.95rem;\n            font-weight: 600;\n        }\n        .kiosk-progress-hint[data-tone='success'] {\n            color: var(--success);\n        }\n        .kiosk-progress-hint[data-tone='warn'] {\n            color: #9a6700;\n        }\n        .kiosk-quick-help-panel {\n            margin: 0 0 0.9rem;\n            border: 1px solid color-mix(in srgb, var(--primary) 24%, #fff 76%);\n            border-radius: 16px;\n            padding: 0.88rem 0.95rem;\n            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);\n        }\n        .kiosk-quick-help-panel h2 {\n            margin: 0 0 0.46rem;\n            font-size: 1.08rem;\n        }\n        .kiosk-quick-help-panel ol {\n            margin: 0 0 0.56rem;\n            padding-left: 1.12rem;\n            color: var(--text);\n            line-height: 1.45;\n        }\n        .kiosk-quick-help-panel p {\n            margin: 0 0 0.6rem;\n            color: var(--muted);\n            font-size: 0.9rem;\n        }\n        .kiosk-quick-help-panel button {\n            border: 1px solid var(--border);\n            border-radius: 12px;\n            padding: 0.46rem 0.74rem;\n            background: #fff;\n            color: var(--text);\n            font-weight: 600;\n            cursor: pointer;\n            min-height: 44px;\n        }\n        .kiosk-form.is-flow-active {\n            border-color: color-mix(in srgb, var(--primary) 32%, var(--border) 68%);\n            box-shadow: 0 14px 28px rgb(15 107 220 / 11%);\n        }\n        body[data-kiosk-senior='on'] {\n            font-size: 18px;\n        }\n        body[data-kiosk-senior='on'] .kiosk-layout {\n            gap: 1.2rem;\n        }\n        body[data-kiosk-senior='on'] h1 {\n            font-size: clamp(2rem, 3vw, 2.55rem);\n            line-height: 1.15;\n        }\n        body[data-kiosk-senior='on'] .kiosk-form label,\n        body[data-kiosk-senior='on'] .kiosk-progress-hint,\n        body[data-kiosk-senior='on'] .kiosk-status {\n            font-size: 1.08rem;\n        }\n        body[data-kiosk-senior='on'] .kiosk-form input,\n        body[data-kiosk-senior='on'] .assistant-form input {\n            min-height: 64px;\n            font-size: 1.18rem;\n        }\n        body[data-kiosk-senior='on'] .kiosk-form button,\n        body[data-kiosk-senior='on'] .assistant-form button {\n            min-height: 68px;\n            font-size: 1.16rem;\n        }\n        body[data-kiosk-senior='on'] .kiosk-quick-action {\n            min-height: 76px;\n            font-size: 1.13rem;\n        }\n        body[data-kiosk-senior='on'] .kiosk-header-help-btn {\n            min-height: 52px;\n            font-size: 0.97rem;\n            padding: 0.45rem 0.84rem;\n        }\n        body[data-kiosk-senior='on'] .queue-kpi-row article strong {\n            font-size: 2.3rem;\n        }\n        body[data-kiosk-senior='on'] .ticket-result-main strong {\n            font-size: 2.6rem;\n        }\n        body[data-kiosk-senior='on'] #kioskSeniorHint {\n            color: color-mix(in srgb, var(--primary) 72%, #1f2937 28%);\n        }\n        .kiosk-quick-action:focus-visible,\n        .kiosk-header-help-btn:focus-visible,\n        .kiosk-quick-help-panel button:focus-visible {\n            outline: 3px solid color-mix(in srgb, var(--primary) 62%, #fff 38%);\n            outline-offset: 2px;\n        }\n        @media (max-width: 760px) {\n            .kiosk-header-tools {\n                justify-items: start;\n            }\n            .kiosk-header-controls {\n                grid-template-columns: 1fr;\n            }\n            .kiosk-quick-actions {\n                grid-template-columns: 1fr;\n            }\n        }\n        @media (prefers-reduced-motion: reduce) {\n            .kiosk-quick-action,\n            .kiosk-header-help-btn,\n            .kiosk-form {\n                transition: none !important;\n            }\n        }\n    "),
                    document.head.appendChild(e));
            })(),
            (s.idleResetMs = (function () {
                const e = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS),
                    n = Number.isFinite(e) ? e : 9e4;
                return Math.min(i, Math.max(5e3, Math.round(n)));
            })()),
            (s.voiceGuideSupported = y()),
            (function () {
                const e = 'light';
                var n;
                (localStorage.setItem('kioskThemeMode', e),
                    (n = e),
                    (s.themeMode = n),
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
            k(
                (function () {
                    try {
                        return '1' === localStorage.getItem(t);
                    } catch (e) {
                        return !1;
                    }
                })(),
                { persist: !1, source: 'init' }
            ),
            h(),
            (function () {
                const e = d('kioskWelcomeScreen');
                e instanceof HTMLElement &&
                    (e.classList.add('is-visible'),
                    m(
                        'Bienvenida: en segundos podras elegir tu tipo de atencion.',
                        'info'
                    ),
                    window.setTimeout(() => {
                        ke({ reason: 'auto' });
                    }, 1800),
                    window.setTimeout(() => {
                        ke({ reason: 'safety_timeout' });
                    }, 2600));
            })(),
            be());
        const e = d('checkinForm'),
            n = d('walkinForm'),
            u = d('assistantForm');
        (e instanceof HTMLFormElement && e.addEventListener('submit', fe),
            n instanceof HTMLFormElement && n.addEventListener('submit', pe),
            u instanceof HTMLFormElement && u.addEventListener('submit', ge),
            (function () {
                const e = d('kioskQuickCheckin'),
                    n = d('kioskQuickWalkin'),
                    t = d('kioskHelpToggle'),
                    i = d('kioskHelpClose'),
                    o = d('kioskSeniorToggle'),
                    a = d('kioskVoiceGuideBtn'),
                    r = d('kioskReceptionHelpBtn');
                (e instanceof HTMLButtonElement &&
                    e.addEventListener('click', () => {
                        ($(), L('checkin'));
                    }),
                    n instanceof HTMLButtonElement &&
                        n.addEventListener('click', () => {
                            ($(), L('walkin'));
                        }),
                    t instanceof HTMLButtonElement &&
                        t.addEventListener('click', () => {
                            ($(), x(!s.quickHelpOpen, { source: 'toggle' }));
                        }),
                    i instanceof HTMLButtonElement &&
                        i.addEventListener('click', () => {
                            ($(), x(!1, { source: 'close_button' }));
                        }),
                    o instanceof HTMLButtonElement &&
                        o.addEventListener('click', () => {
                            ($(), b({ source: 'button' }));
                        }),
                    a instanceof HTMLButtonElement &&
                        a.addEventListener('click', () => {
                            ($(), S({ source: 'button' }));
                        }),
                    r instanceof HTMLButtonElement &&
                        ((r.dataset.variant = 'warning'),
                        r.addEventListener('click', () => {
                            ($(), w({ source: 'button' }));
                        })));
            })(),
            x(!1, { source: 'init' }),
            (function () {
                let e = d('kioskSessionGuard');
                if (e instanceof HTMLElement) return e;
                const n = d('kioskStatus');
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
        const l = d('kioskSessionResetBtn');
        (l instanceof HTMLButtonElement &&
            l.addEventListener('click', () => {
                N({ reason: 'manual' });
            }),
            _(),
            B(),
            L('checkin', { announce: !1 }),
            m('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((e) => {
                document.addEventListener(
                    e,
                    () => {
                        $();
                    },
                    !0
                );
            }),
            A(),
            D(),
            F(),
            j(),
            U(),
            (function () {
                try {
                    const e = localStorage.getItem(o);
                    if (!e) return void (s.offlineOutbox = []);
                    const n = JSON.parse(e);
                    if (!Array.isArray(n)) return void (s.offlineOutbox = []);
                    s.offlineOutbox = n
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
                                e.fingerprint || ue(e.resource, e.body),
                        }))
                        .slice(0, 25);
                } catch (e) {
                    s.offlineOutbox = [];
                }
            })(),
            (function () {
                try {
                    const e = localStorage.getItem(a);
                    if (!e) return void (s.printerState = null);
                    const n = JSON.parse(e);
                    if (!n || 'object' != typeof n)
                        return void (s.printerState = null);
                    s.printerState = {
                        ok: Boolean(n.ok),
                        printed: Boolean(n.printed),
                        errorCode: String(n.errorCode || ''),
                        message: String(n.message || ''),
                        at: String(n.at || new Date().toISOString()),
                    };
                } catch (e) {
                    s.printerState = null;
                }
            })(),
            G(),
            V());
        const f = Y();
        f instanceof HTMLButtonElement &&
            f.addEventListener('click', () => {
                ve();
            });
        const g = d('queueOutboxRetryBtn');
        g instanceof HTMLButtonElement &&
            g.addEventListener('click', () => {
                de({ source: 'operator', force: !0, maxItems: 25 });
            });
        const q = d('queueOutboxDropOldestBtn');
        q instanceof HTMLButtonElement &&
            q.addEventListener('click', () => {
                !(function () {
                    if (!s.offlineOutbox.length) return;
                    const e = s.offlineOutbox[s.offlineOutbox.length - 1];
                    (s.offlineOutbox.pop(),
                        W(),
                        V(),
                        J(),
                        O(
                            `Descartado pendiente antiguo (${e?.originLabel || 'sin detalle'}).`,
                            'info'
                        ));
                })();
            });
        const T = d('queueOutboxClearBtn');
        (T instanceof HTMLButtonElement &&
            T.addEventListener('click', () => {
                Q({ reason: 'manual' });
            }),
            H('paused', 'Sincronizacion lista'),
            z('Esperando primera sincronizacion de cola...'),
            ne(''),
            !1 !== navigator.onLine && de({ source: 'startup', force: !0 }),
            p().start({ immediate: !1 }),
            Se({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? we({ reason: 'hidden' })
                    : Se({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                (de({ source: 'online', force: !0 }), Se({ immediate: !0 }));
            }),
            window.addEventListener('offline', () => {
                (we({ reason: 'offline' }), V());
            }),
            window.addEventListener('beforeunload', () => {
                (v({ source: 'beforeunload' }),
                    we({ reason: 'paused' }),
                    c?.stop());
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const n = String(e.code || '').toLowerCase();
                return 'keyr' === n
                    ? (e.preventDefault(), void ve())
                    : 'keyh' === n
                      ? (e.preventDefault(),
                        void x(!s.quickHelpOpen, { source: 'shortcut' }))
                      : 'digit1' === n
                        ? (e.preventDefault(), void L('checkin'))
                        : 'digit2' === n
                          ? (e.preventDefault(), void L('walkin'))
                          : 'keys' === n
                            ? (e.preventDefault(),
                              void b({ source: 'shortcut' }))
                            : 'keyv' === n
                              ? (e.preventDefault(),
                                void S({ source: 'shortcut' }))
                              : 'keya' === n
                                ? (e.preventDefault(),
                                  void w({ source: 'shortcut' }))
                                : 'keyl' === n
                                  ? (e.preventDefault(),
                                    void N({ reason: 'manual' }))
                                  : 'keyy' === n
                                    ? (e.preventDefault(),
                                      void de({
                                          source: 'shortcut',
                                          force: !0,
                                          maxItems: 25,
                                      }))
                                    : void (
                                          'keyk' === n &&
                                          (e.preventDefault(),
                                          Q({ reason: 'manual' }))
                                      );
            }));
    });
})();
