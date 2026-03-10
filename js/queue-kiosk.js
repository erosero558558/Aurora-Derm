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
            assistantSessionId: '',
            assistantMetrics: {
                intents: {},
                resolvedWithoutHuman: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                actioned: 0,
                lastIntent: '',
                lastLatencyMs: 0,
            },
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
            lastIssuedTicket: null,
            lastHelpRequest: null,
            seniorMode: !1,
            voiceGuideSupported: !1,
            voiceGuideBusy: !1,
            voiceGuideUtterance: null,
        };
    let c = null;
    function u(e = 'runtime') {
        const n = String(e || 'runtime').trim() || 'runtime';
        try {
            if (
                'undefined' != typeof window &&
                window.crypto &&
                'function' == typeof window.crypto.randomUUID
            )
                return `${n}_${window.crypto.randomUUID()}`;
        } catch (e) {}
        return `${n}_${Date.now()}_${Math.floor(1e5 * Math.random())}`;
    }
    function l(e, n = {}) {
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
    function d(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function p(e) {
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
    function m() {
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
                async function p(e = 'interval', { keepalive: t = !1 } = {}) {
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
                function f() {
                    'visible' === document.visibilityState && p('visible');
                }
                function m() {
                    p('online');
                }
                function g() {
                    p('unload', { keepalive: !0 });
                }
                function k() {
                    (c && (window.clearInterval(c), (c = 0)),
                        d &&
                            ((d = !1),
                            document.removeEventListener('visibilitychange', f),
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
                                    f
                                ),
                                window.addEventListener('online', m),
                                window.addEventListener('beforeunload', g)),
                            e && p('boot'),
                            (c = window.setInterval(() => {
                                'hidden' !== document.visibilityState &&
                                    p('interval');
                            }, s)));
                    },
                    stop: k,
                    notify: function (e = 'state_change') {
                        Date.now() - l < 4e3 || p(e);
                    },
                    beatNow: (e = 'manual') => p(e),
                    getDeviceId: () => r,
                };
            })({ surface: 'kiosk', intervalMs: 15e3, getPayload: f })),
            c)
        );
    }
    function g(e, n = 'info') {
        const t = p('kioskProgressHint');
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
    function k(e, n = 'info') {
        const t = p('kioskSeniorHint');
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
    function b(e, { persist: n = !0, source: i = 'ui' } = {}) {
        const o = Boolean(e);
        ((s.seniorMode = o),
            (document.body.dataset.kioskSenior = o ? 'on' : 'off'),
            (function () {
                const e = p('kioskSeniorToggle');
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
            k(
                o
                    ? 'Modo lectura grande activo. Botones y textos ampliados.'
                    : 'Modo lectura grande desactivado.',
                o ? 'success' : 'info'
            ),
            l('senior_mode_changed', { enabled: o, source: i }));
    }
    function h({ source: e = 'ui' } = {}) {
        b(!s.seniorMode, { persist: !0, source: e });
    }
    function y() {
        return (
            'undefined' != typeof window &&
            'speechSynthesis' in window &&
            'function' == typeof window.speechSynthesis?.speak &&
            'function' == typeof window.SpeechSynthesisUtterance
        );
    }
    function v() {
        const e = p('kioskVoiceGuideBtn');
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
    function S({ source: e = 'manual' } = {}) {
        if (!y())
            return (
                (s.voiceGuideBusy = !1),
                (s.voiceGuideUtterance = null),
                void v()
            );
        try {
            window.speechSynthesis.cancel();
        } catch (e) {}
        ((s.voiceGuideBusy = !1),
            (s.voiceGuideUtterance = null),
            v(),
            l('voice_guide_stopped', { source: e }));
    }
    function w({ source: e = 'button' } = {}) {
        if (!s.voiceGuideSupported)
            return (
                O(
                    'Guia por voz no disponible en este navegador. Usa ayuda rapida en pantalla.',
                    'info'
                ),
                k(
                    'Sin voz guia en este equipo. Usa ayuda rapida o pide apoyo.',
                    'warn'
                ),
                void l('voice_guide_unavailable', { source: e })
            );
        S({ source: 'restart' });
        const n = `Bienvenida al kiosco de turnos de Piel en Armonia. ${'walkin' === s.selectedFlow ? 'Si no tienes cita, escribe iniciales y pulsa Generar turno.' : 'Si tienes cita, escribe telefono, fecha y hora y pulsa Confirmar check in.'} Si necesitas ayuda, pulsa Necesito apoyo y recepcion te asistira. Conserva tu ticket y espera el llamado en la pantalla de sala.`;
        let t;
        try {
            t = new window.SpeechSynthesisUtterance(n);
        } catch (n) {
            return (
                O('No se pudo iniciar guia por voz en este equipo.', 'error'),
                void l('voice_guide_error', {
                    source: e,
                    reason: 'utterance_create_failed',
                })
            );
        }
        ((t.lang = 'es-EC'),
            (t.rate = 0.92),
            (t.pitch = 1),
            (t.onstart = () => {
                ((s.voiceGuideBusy = !0), v());
            }),
            (t.onend = () => {
                ((s.voiceGuideBusy = !1),
                    (s.voiceGuideUtterance = null),
                    v(),
                    l('voice_guide_finished', { source: e }));
            }),
            (t.onerror = () => {
                ((s.voiceGuideBusy = !1),
                    (s.voiceGuideUtterance = null),
                    v(),
                    O(
                        'La guia por voz se interrumpio. Puedes intentar nuevamente.',
                        'error'
                    ),
                    l('voice_guide_error', {
                        source: e,
                        reason: 'speech_error',
                    }));
            }));
        try {
            ((s.voiceGuideUtterance = t),
                (s.voiceGuideBusy = !0),
                v(),
                window.speechSynthesis.speak(t),
                O('Guia por voz iniciada.', 'info'),
                k(
                    'Escuchando guia por voz. Puedes seguir los pasos en pantalla.',
                    'success'
                ),
                l('voice_guide_started', { source: e }));
        } catch (n) {
            ((s.voiceGuideBusy = !1),
                (s.voiceGuideUtterance = null),
                v(),
                O('No se pudo reproducir guia por voz.', 'error'),
                l('voice_guide_error', {
                    source: e,
                    reason: 'speech_start_failed',
                }));
        }
    }
    async function q({
        source: e = 'button',
        reason: n = 'general',
        message: t = '',
        intent: i = '',
        announceInAssistant: o = !0,
    } = {}) {
        const a = (function (e, n, t, i = '') {
                const o = s.lastIssuedTicket;
                return {
                    source: String(t || 'kiosk'),
                    reason: String(e || 'general'),
                    message: String(n || '').trim(),
                    intent: String(i || '').trim(),
                    sessionId:
                        (s.assistantSessionId ||
                            (s.assistantSessionId = u('assistant')),
                        s.assistantSessionId),
                    ticketId: Number(o?.id || 0) || void 0,
                    ticketCode: String(o?.ticketCode || ''),
                    patientInitials: A(),
                    context: {
                        selectedFlow: String(s.selectedFlow || 'checkin'),
                        waitingCount: Number(s.queueState?.waitingCount || 0),
                        estimatedWaitMin: Number(
                            s.queueState?.estimatedWaitMin || 0
                        ),
                        offlinePending: Number(s.offlineOutbox.length || 0),
                    },
                };
            })(n, t, e, i),
            r = (function (e) {
                const n = String(e || 'general').toLowerCase();
                return 'clinical_redirect' === n
                    ? 'Recepcion fue alertada para derivarte con el personal adecuado.'
                    : 'printer_issue' === n || 'reprint_requested' === n
                      ? 'Recepcion revisara la impresion o reimpresion de tu ticket enseguida.'
                      : 'appointment_not_found' === n
                        ? 'Recepcion revisara tu cita y te ayudara a continuar.'
                        : 'special_priority' === n
                          ? 'Recepcion fue alertada para darte apoyo prioritario.'
                          : 'accessibility' === n
                            ? 'Recepcion te brindara apoyo para completar el proceso.'
                            : 'Recepcion te ayudara enseguida. Mantente frente al kiosco o acude al mostrador.';
            })(n);
        try {
            const t = await I('queue-help-request', {
                    method: 'POST',
                    body: a,
                }),
                i =
                    t?.data?.helpRequest &&
                    'object' == typeof t.data.helpRequest
                        ? t.data.helpRequest
                        : null;
            return (
                (s.lastHelpRequest = i),
                E(t),
                O(r, 'info'),
                g(
                    'Apoyo solicitado: recepcion te asistira para completar el turno.',
                    'warn'
                ),
                o && he('bot', r),
                l('reception_support_requested', {
                    source: e,
                    reason: n,
                    requestId: i?.id || 0,
                }),
                { ok: !0, queued: !1, message: r, helpRequest: i }
            );
        } catch (t) {
            if (!pe(t)) {
                const i = `No se pudo solicitar apoyo: ${t.message}`;
                return (
                    O(i, 'error'),
                    l('reception_support_error', {
                        source: e,
                        reason: n,
                        error: String(t?.message || ''),
                    }),
                    { ok: !1, queued: !1, message: i, helpRequest: null }
                );
            }
            const i = me({
                resource: 'queue-help-request',
                body: a,
                originLabel: 'Apoyo a recepcion',
                patientInitials: a.patientInitials,
                queueType: 'support',
                renderMode: 'support',
            });
            return (
                (s.lastHelpRequest = i),
                O(
                    'Apoyo guardado offline. Se notificara a recepcion al recuperar conexion.',
                    'info'
                ),
                g(
                    'Apoyo pendiente de sincronizacion: si es urgente, acude al mostrador.',
                    'warn'
                ),
                o &&
                    he(
                        'bot',
                        'Apoyo guardado offline. Se notificara a recepcion al recuperar conexion.'
                    ),
                l('reception_support_queued', {
                    source: e,
                    reason: n,
                    pendingAfter: s.offlineOutbox.length,
                }),
                {
                    ok: !0,
                    queued: !0,
                    message:
                        'Apoyo guardado offline. Se notificara a recepcion al recuperar conexion.',
                    helpRequest: i,
                }
            );
        }
    }
    function x(e, { source: n = 'ui' } = {}) {
        const t = p('kioskQuickHelpPanel'),
            i = p('kioskHelpToggle');
        if (!(t instanceof HTMLElement && i instanceof HTMLButtonElement))
            return;
        const o = Boolean(e);
        ((s.quickHelpOpen = o),
            (t.hidden = !o),
            (i.dataset.open = o ? 'true' : 'false'),
            i.setAttribute('aria-expanded', String(o)),
            l('quick_help_toggled', { open: o, source: n }),
            g(
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
        const i = p('checkinForm'),
            o = p('walkinForm');
        (i instanceof HTMLElement &&
            i.classList.toggle('is-flow-active', 'checkin' === t),
            o instanceof HTMLElement &&
                o.classList.toggle('is-flow-active', 'walkin' === t));
        const a = p('kioskQuickCheckin'),
            r = p('kioskQuickWalkin');
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
        const c = p('walkin' === t ? 'walkinInitials' : 'checkinPhone');
        (c instanceof HTMLInputElement && c.focus({ preventScroll: !1 }),
            n &&
                g(
                    'walkin' === t
                        ? 'Paso 2: escribe iniciales y pulsa "Generar turno".'
                        : 'Paso 2: escribe telefono, fecha y hora para check-in.',
                    'info'
                ),
            l('flow_focus', { target: t }));
    }
    function M(e, n) {
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
    function _(e, n, t = 0) {
        if (!e || 'object' != typeof e || !Array.isArray(n))
            return Number(t || 0);
        for (const t of n) {
            if (!t) continue;
            const n = Number(e[t]);
            if (Number.isFinite(n)) return n;
        }
        return Number(t || 0);
    }
    function C(e) {
        const n = e && 'object' == typeof e ? e : {},
            t = T(n, ['counts']) || {},
            i = _(n, ['waitingCount', 'waiting_count'], Number.NaN),
            o = _(n, ['calledCount', 'called_count'], Number.NaN);
        let a = M(n, [
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
        const r = M(n, [
                'nextTickets',
                'next_tickets',
                'waitingTickets',
                'waiting_tickets',
            ]),
            s = M(n, ['activeHelpRequests', 'active_help_requests']),
            c = Number.isFinite(i)
                ? i
                : _(t, ['waiting', 'waiting_count'], r.length),
            u = Number.isFinite(o)
                ? o
                : _(t, ['called', 'called_count'], a.length),
            l = Math.max(
                0,
                _(n, ['estimatedWaitMin', 'estimated_wait_min'], 8 * c)
            ),
            d = Math.max(
                0,
                _(
                    n,
                    ['assistancePendingCount', 'assistance_pending_count'],
                    s.length
                )
            );
        return {
            updatedAt:
                String(n.updatedAt || n.updated_at || '').trim() ||
                new Date().toISOString(),
            waitingCount: Math.max(0, Number(c || 0)),
            calledCount: Math.max(0, Number(u || 0)),
            estimatedWaitMin: l,
            delayReason: String(n.delayReason || n.delay_reason || '').trim(),
            assistancePendingCount: d,
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
                      needsAssistance: Boolean(
                          e?.needsAssistance ?? e?.needs_assistance
                      ),
                      assistanceRequestStatus: String(
                          e?.assistanceRequestStatus ||
                              e?.assistance_request_status ||
                              ''
                      ),
                      activeHelpRequestId:
                          Number(
                              e?.activeHelpRequestId ??
                                  e?.active_help_request_id ??
                                  0
                          ) || null,
                      specialPriority: Boolean(
                          e?.specialPriority ?? e?.special_priority
                      ),
                      lateArrival: Boolean(e?.lateArrival ?? e?.late_arrival),
                      reprintRequestedAt: String(
                          e?.reprintRequestedAt || e?.reprint_requested_at || ''
                      ),
                      estimatedWaitMin: Math.max(
                          0,
                          Number(
                              e?.estimatedWaitMin ??
                                  e?.estimated_wait_min ??
                                  8 * (n + 1)
                          ) || 0
                      ),
                      position:
                          Number(e?.position || 0) > 0
                              ? Number(e.position)
                              : n + 1,
                  }))
                : [],
            activeHelpRequests: Array.isArray(s)
                ? s.map((e) => ({
                      ...e,
                      id: Number(e?.id || 0) || 0,
                      ticketId: Number(e?.ticketId || e?.ticket_id || 0) || 0,
                      ticketCode: String(e?.ticketCode || e?.ticket_code || ''),
                      patientInitials: String(
                          e?.patientInitials || e?.patient_initials || '--'
                      ),
                      reason: String(e?.reason || 'general'),
                      reasonLabel: String(
                          e?.reasonLabel || e?.reason_label || 'Apoyo general'
                      ),
                      status: String(e?.status || 'pending'),
                      source: String(e?.source || 'kiosk'),
                      createdAt: String(e?.createdAt || e?.created_at || ''),
                      updatedAt: String(e?.updatedAt || e?.updated_at || ''),
                  }))
                : [],
        };
    }
    function E(e) {
        const n = e?.data?.queueState || e?.queueState || e?.data || e;
        if (!n || 'object' != typeof n) return null;
        const t = C(n);
        return (
            (s.queueState = t),
            (function (e) {
                const n = C(e),
                    t = p('queueWaitingCount'),
                    i = p('queueCalledCount'),
                    o = p('queueCallingNow'),
                    a = p('queueNextList');
                if (
                    (t && (t.textContent = String(n.waitingCount || 0)),
                    i && (i.textContent = String(n.calledCount || 0)),
                    o)
                ) {
                    const e = Array.isArray(n.callingNow) ? n.callingNow : [];
                    0 === e.length
                        ? (o.innerHTML =
                              '<p class="queue-empty">Sin llamados activos.</p>')
                        : (o.innerHTML = e
                              .map(
                                  (e) =>
                                      `\n                        <article class="queue-called-card">\n                            <header>Consultorio ${d(e.assignedConsultorio)}</header>\n                            <strong>${d(e.ticketCode || '--')}</strong>\n                            <span>${d(e.patientInitials || '--')}</span>\n                        </article>\n                    `
                              )
                              .join(''));
                }
                if (a) {
                    const e = Array.isArray(n.nextTickets) ? n.nextTickets : [];
                    0 === e.length
                        ? (a.innerHTML =
                              '<li class="queue-empty">No hay turnos en espera.</li>')
                        : (a.innerHTML = e
                              .map(
                                  (e) =>
                                      `\n                        <li>\n                            <span class="ticket-code">${d(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${d(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${d(e.position || '-')}</span>\n                        </li>\n                    `
                              )
                              .join(''));
                }
            })(t),
            ae(t.updatedAt),
            t
        );
    }
    async function I(e, { method: n = 'GET', body: t } = {}) {
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
    function H(e, n, t, i = {}) {
        const o = String(e || 'unknown').trim() || 'unknown',
            a = String(n || 'unknown').trim() || 'unknown',
            r = Math.max(
                0,
                Math.round(performance.now() - Number(t || performance.now()))
            ),
            c = s.assistantMetrics || {
                intents: {},
                resolvedWithoutHuman: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                actioned: 0,
                lastIntent: '',
                lastLatencyMs: 0,
            };
        ((c.intents = c.intents || {}),
            (c.intents[o] = (c.intents[o] || 0) + 1),
            (c.lastIntent = o),
            (c.lastLatencyMs = r),
            (c.actioned += 1),
            'resolved' === a
                ? (c.resolvedWithoutHuman += 1)
                : 'handoff' === a
                  ? (c.escalated += 1)
                  : 'clinical_blocked' === a
                    ? (c.clinicalBlocked += 1)
                    : 'fallback' === a
                      ? (c.fallback += 1)
                      : 'error' === a && (c.errors += 1),
            (s.assistantMetrics = c),
            l('assistant_metric', {
                intent: o,
                outcome: a,
                latencyMs: r,
                ...i,
            }));
    }
    function A() {
        if (s.lastIssuedTicket?.patientInitials)
            return String(s.lastIssuedTicket.patientInitials || '--');
        const e = p('walkinInitials');
        if (e instanceof HTMLInputElement && String(e.value || '').trim())
            return String(e.value || '')
                .trim()
                .slice(0, 4)
                .toUpperCase();
        const n = p('checkinInitials');
        if (n instanceof HTMLInputElement && String(n.value || '').trim())
            return String(n.value || '')
                .trim()
                .slice(0, 4)
                .toUpperCase();
        const t = p('checkinPhone');
        if (t instanceof HTMLInputElement) {
            const e = String(t.value || '').replace(/\D/g, '');
            if (e) return e.slice(-2).padStart(2, '0');
        }
        return '--';
    }
    function O(e, n = 'info') {
        const t = p('kioskStatus');
        if (!t) return;
        const i = String(e || '').trim() || 'Estado operativo',
            o = String(n || 'info').toLowerCase(),
            a =
                i !== String(t.textContent || '').trim() ||
                o !== String(t.dataset.status || '').toLowerCase();
        ((t.textContent = i),
            (t.dataset.status = o),
            a && l('kiosk_status', { status: o, message: i }));
    }
    function $(e, n) {
        const t = p('queueConnectionState');
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
            r && l('connection_state', { state: i, message: a }),
            G());
    }
    function B() {
        const e = p('kioskSessionCountdown');
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
    function N() {
        const e = p('ticketResult');
        e &&
            ((s.lastIssuedTicket = null),
            (e.innerHTML =
                '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>'));
    }
    function z() {
        const e = p('assistantMessages');
        (e && (e.innerHTML = ''),
            (s.chatHistory = []),
            (s.lastHelpRequest = null),
            (s.assistantSessionId = u('assistant')),
            (s.assistantMetrics = {
                intents: {},
                resolvedWithoutHuman: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                actioned: 0,
                lastIntent: '',
                lastLatencyMs: 0,
            }),
            he(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ));
        const n = p('assistantInput');
        n instanceof HTMLInputElement && (n.value = '');
    }
    function D({ durationMs: e = null } = {}) {
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
            B(),
            (s.idleTickId = window.setInterval(() => {
                B();
            }, 1e3)),
            (s.idleTimerId = window.setTimeout(() => {
                if (s.assistantBusy || s.queueManualRefreshBusy)
                    return (
                        O(
                            'Sesion activa. Reprogramando limpieza automatica.',
                            'info'
                        ),
                        void D({ durationMs: 15e3 })
                    );
                P({ reason: 'idle_timeout' });
            }, n)));
    }
    function R() {
        (ve({ reason: 'activity' }), D());
    }
    function P({ reason: e = 'manual' } = {}) {
        (S({ source: 'session_reset' }),
            (function () {
                const e = p('checkinForm'),
                    n = p('walkinForm');
                (e instanceof HTMLFormElement && e.reset(),
                    n instanceof HTMLFormElement && n.reset(),
                    Se());
            })(),
            z(),
            N(),
            x(!1, { source: 'session_reset' }),
            L('checkin', { announce: !1 }),
            O(
                'idle_timeout' === e
                    ? 'Sesion reiniciada por inactividad para proteger privacidad.'
                    : 'Pantalla limpiada. Lista para el siguiente paciente.',
                'info'
            ),
            g('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            ee(),
            D());
    }
    function F() {
        let e = p('queueOpsHint');
        if (e) return e;
        const n = document.querySelector('.kiosk-side .kiosk-card'),
            t = p('queueUpdatedAt');
        return n && t
            ? ((e = document.createElement('p')),
              (e.id = 'queueOpsHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function j(e) {
        const n = F();
        n && (n.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function G() {
        const e = p('kioskSetupTitle'),
            n = p('kioskSetupSummary'),
            t = p('kioskSetupChecks');
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
            l = Boolean(s.queueLastHealthySyncAt),
            f = Date.parse(String(s.offlineOutbox[0]?.queuedAt || '')),
            g = Number.isFinite(f) ? ie(Date.now() - f) : '',
            k = [
                {
                    label: 'Conexion con cola',
                    state:
                        'live' === i
                            ? l
                                ? 'ready'
                                : 'warning'
                            : 'offline' === i
                              ? 'danger'
                              : 'warning',
                    detail:
                        'live' === i
                            ? l
                                ? `Backend en vivo (${oe()}).`
                                : 'Conectado, pero esperando la primera sincronizacion saludable.'
                            : o,
                },
                {
                    label: 'Impresora termica',
                    state: r ? (c ? 'ready' : 'danger') : 'warning',
                    detail: r
                        ? c
                            ? `Impresion OK · ${ce(r.at)}`
                            : `Sin impresion (${r.errorCode || r.message || 'sin detalle'}) · ${ce(r.at)}`
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
                    state: l ? 'ready' : 'warning',
                    detail: l
                        ? 'La cola ya respondio en este arranque. Puedes abrir el kiosco al publico.'
                        : 'Mantiene el flujo abierto, pero falta una sincronizacion completa desde este arranque.',
                },
            ];
        let b = 'Finaliza la puesta en marcha',
            h =
                'Revisa backend, termica y pendientes antes de dejar el kiosco en autoservicio.';
        ('offline' === i
            ? ((b = 'Kiosco en contingencia'),
              (h =
                  'El kiosco puede seguir capturando datos, pero el backend no responde. Si la fila crece, deriva a recepcion.'))
            : a > 0
              ? ((b = 'Kiosco con pendientes por sincronizar'),
                (h =
                    'Hay solicitudes guardadas offline. Manten el equipo abierto hasta que el outbox vuelva a cero.'))
              : u
                ? ((b = 'Revisa la impresora termica'),
                  (h =
                      'El ultimo ticket no confirmo impresion. Verifica energia, papel y cable USB, y repite una prueba.'))
                : c
                  ? 'live' === i &&
                    l &&
                    ((b = 'Kiosco listo para operar'),
                    (h =
                        'La cola esta en vivo, no hay pendientes offline y la termica ya respondio correctamente.'))
                  : ((b = 'Falta probar ticket termico'),
                    (h =
                        'Genera un turno de prueba y confirma "Impresion OK" antes de operar con pacientes.')),
            (e.textContent = b),
            (n.textContent = h),
            (t.innerHTML = k
                .map(
                    (e) =>
                        `\n                <article class="kiosk-setup-check" data-state="${d(e.state)}" role="listitem">\n                    <strong>${d(e.label)}</strong>\n                    <span>${d(e.detail)}</span>\n                </article>\n            `
                )
                .join('')),
            (function (e = 'state_change') {
                m().notify(e);
            })('setup_status'));
    }
    function U() {
        let e = p('queueOutboxHint');
        if (e) return e;
        const n = F();
        return n?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queueOutboxHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Pendientes offline: 0'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function K(e) {
        const n = U();
        n &&
            (n.textContent = String(e || '').trim() || 'Pendientes offline: 0');
    }
    function W() {
        let e = p('queuePrinterHint');
        if (e) return e;
        const n = U();
        return n?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queuePrinterHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Impresora: estado pendiente.'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function J() {
        const e = W();
        if (!e) return;
        const n = s.printerState;
        if (!n)
            return ((e.textContent = 'Impresora: estado pendiente.'), void G());
        const t = n.printed ? 'impresion OK' : n.errorCode || 'sin impresion',
            i = n.message ? ` (${n.message})` : '',
            o = ce(n.at);
        ((e.textContent = `Impresora: ${t}${i} · ${o}`), G());
    }
    function Q() {
        let e = p('queueOutboxConsole');
        if (e instanceof HTMLElement) return e;
        const n = U();
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
    function V(e) {
        const n = p('queueOutboxRetryBtn'),
            t = p('queueOutboxClearBtn'),
            i = p('queueOutboxDropOldestBtn');
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
    function Y() {
        Q();
        const e = p('queueOutboxSummary'),
            n = p('queueOutboxList'),
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
                                  const t = ce(e.queuedAt),
                                      i = Number(e.attempts || 0);
                                  return `<li><strong>${d(e.originLabel)}</strong> · ${d(e.patientInitials || '--')} · ${d(e.queueType || '--')} · ${d(t)} · intento ${n + 1}/${Math.max(1, i + 1)}</li>`;
                              })
                              .join('')),
            V(!1));
    }
    function Z({ reason: e = 'manual' } = {}) {
        ((s.offlineOutbox = []),
            X(),
            ee(),
            Y(),
            'manual' === e &&
                O('Pendientes offline limpiados manualmente.', 'info'));
    }
    function X() {
        try {
            localStorage.setItem(o, JSON.stringify(s.offlineOutbox));
        } catch (e) {}
    }
    function ee() {
        const e = s.offlineOutbox.length;
        if (e <= 0)
            return (
                K('Pendientes offline: 0 (sin pendientes).'),
                Y(),
                void G()
            );
        const n = Date.parse(String(s.offlineOutbox[0]?.queuedAt || ''));
        (K(
            `Pendientes offline: ${e} - sincronizacion automatica al reconectar${Number.isFinite(n) ? ` - mas antiguo ${ie(Date.now() - n)}` : ''}`
        ),
            Y(),
            G());
    }
    function ne() {
        let e = p('queueManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const n = p('queueUpdatedAt');
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
    function te(e) {
        const n = ne();
        n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(e)),
            (n.textContent = e
                ? 'Actualizando cola...'
                : 'Reintentar sincronizacion'));
    }
    function ie(e) {
        const n = Math.max(0, Number(e || 0)),
            t = Math.round(n / 1e3);
        if (t < 60) return `${t}s`;
        const i = Math.floor(t / 60),
            o = t % 60;
        return o <= 0 ? `${i}m` : `${i}m ${o}s`;
    }
    function oe() {
        return s.queueLastHealthySyncAt
            ? `hace ${ie(Date.now() - s.queueLastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function ae(e) {
        const n = p('queueUpdatedAt');
        if (!n) return;
        const t = C({ updatedAt: e }),
            i = Date.parse(String(t.updatedAt || ''));
        Number.isFinite(i)
            ? (n.textContent = `Actualizado ${new Date(i).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (n.textContent = 'Actualizacion pendiente');
    }
    function re() {
        const e = Math.max(0, Number(s.queueFailureStreak || 0)),
            n = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, n);
    }
    function se() {
        s.queueTimerId &&
            (window.clearTimeout(s.queueTimerId), (s.queueTimerId = 0));
    }
    function ce(e) {
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
    async function ue() {
        if (s.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        s.queueRefreshBusy = !0;
        try {
            E(await I('queue-state'));
            const e = (function (e) {
                const n = C(e),
                    t = Date.parse(String(n.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const i = Math.max(0, Date.now() - t);
                return { stale: i >= 3e4, missingTimestamp: !1, ageMs: i };
            })(s.queueState);
            return {
                ok: !0,
                stale: Boolean(e.stale),
                missingTimestamp: Boolean(e.missingTimestamp),
                ageMs: e.ageMs,
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
    function le(e, n) {
        const t = p('ticketResult');
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
            };
        s.lastIssuedTicket = o;
        const r = e?.print || {};
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
                J(),
                l('printer_result', {
                    origin: n,
                    ok: s.printerState.ok,
                    printed: s.printerState.printed,
                    errorCode: s.printerState.errorCode,
                }));
        })(e, { origin: n });
        const c = Array.isArray(s.queueState?.nextTickets)
                ? s.queueState.nextTickets
                : [],
            u = c.find((e) => Number(e.id) === Number(o.id))?.position || '-',
            f = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${d(r.message || 'sin detalle')})`;
        t.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${d(n)}</p>\n            <div class="ticket-result-main">\n                <strong>${d(o.ticketCode || '--')}</strong>\n                <span>${d(o.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${d(u)}</dd></div>\n                <div><dt>Tipo</dt><dd>${d(o.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${d(ce(o.createdAt))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">${f}</p>\n        </article>\n    `;
    }
    function de({
        originLabel: e,
        patientInitials: n,
        queueType: t,
        queuedAt: i,
    }) {
        const o = p('ticketResult');
        o &&
            (o.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Solicitud guardada offline</h3>\n            <p class="ticket-result-origin">${d(e)}</p>\n            <div class="ticket-result-main">\n                <strong>${d(`PEND-${String(s.offlineOutbox.length).padStart(2, '0')}`)}</strong>\n                <span>${d(n || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>\n                <div><dt>Tipo</dt><dd>${d(t || '--')}</dd></div>\n                <div><dt>Guardado</dt><dd>${d(ce(i))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>\n        </article>\n    `);
    }
    function pe(e) {
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
    function fe(e, n) {
        const t = String(e || '').toLowerCase(),
            i = (function (e) {
                const n = e && 'object' == typeof e ? e : {};
                return Object.keys(n)
                    .sort()
                    .reduce((e, t) => ((e[t] = n[t]), e), {});
            })(n);
        return `${t}:${JSON.stringify(i)}`;
    }
    function me({
        resource: e,
        body: n,
        originLabel: t,
        patientInitials: i,
        queueType: o,
        renderMode: a = 'ticket',
    }) {
        const r = String(e || '');
        if (
            'queue-ticket' !== r &&
            'queue-checkin' !== r &&
            'queue-help-request' !== r
        )
            return null;
        const c = fe(r, n),
            u = Date.now(),
            d = s.offlineOutbox.find((e) => {
                if (String(e?.fingerprint || '') !== c) return !1;
                const n = Date.parse(String(e?.queuedAt || ''));
                return !!Number.isFinite(n) && u - n <= 9e4;
            });
        if (d)
            return (
                l('offline_queued_duplicate', { resource: r, fingerprint: c }),
                { ...d, deduped: !0 }
            );
        const p = {
            id: `offline_${Date.now()}_${Math.floor(1e5 * Math.random())}`,
            resource: r,
            body: n && 'object' == typeof n ? n : {},
            originLabel: String(t || 'Solicitud offline'),
            patientInitials: String(i || '--'),
            queueType: String(o || '--'),
            renderMode:
                'support' === String(a || 'ticket').toLowerCase()
                    ? 'support'
                    : 'ticket',
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: '',
            fingerprint: c,
        };
        return (
            (s.offlineOutbox = [p, ...s.offlineOutbox].slice(0, 25)),
            X(),
            ee(),
            l('offline_queued', {
                resource: r,
                queueSize: s.offlineOutbox.length,
            }),
            p
        );
    }
    async function ge({
        source: e = 'auto',
        force: n = !1,
        maxItems: t = 4,
    } = {}) {
        if (s.offlineOutboxFlushBusy) return;
        if (!s.offlineOutbox.length) return;
        if (!n && !1 === navigator.onLine) return;
        ((s.offlineOutboxFlushBusy = !0), V(!0));
        let i = 0;
        try {
            for (
                ;
                s.offlineOutbox.length && i < Math.max(1, Number(t || 1));
            ) {
                const e = s.offlineOutbox[0];
                try {
                    const n = await I(e.resource, {
                        method: 'POST',
                        body: e.body,
                    });
                    if (
                        (s.offlineOutbox.shift(),
                        X(),
                        ee(),
                        E(n),
                        'support' === String(e.renderMode || 'ticket'))
                    ) {
                        const t =
                            n?.data?.helpRequest &&
                            'object' == typeof n.data.helpRequest
                                ? n.data.helpRequest
                                : null;
                        ((s.lastHelpRequest = t),
                            O(
                                `Apoyo sincronizado (${e.originLabel})`,
                                'success'
                            ),
                            g(
                                'Apoyo enviado a recepcion correctamente.',
                                'success'
                            ));
                    } else
                        (le(n, `${e.originLabel} (sincronizado)`),
                            O(
                                `Pendiente sincronizado (${e.originLabel})`,
                                'success'
                            ));
                    (l('offline_synced_item', {
                        resource: e.resource,
                        originLabel: e.originLabel,
                        pendingAfter: s.offlineOutbox.length,
                    }),
                        (i += 1));
                } catch (n) {
                    ((e.attempts = Number(e.attempts || 0) + 1),
                        (e.lastError = String(n?.message || '').slice(0, 180)),
                        (e.lastAttemptAt = new Date().toISOString()),
                        X(),
                        ee());
                    const t = pe(n);
                    (O(
                        t
                            ? 'Sincronizacion offline pendiente: esperando reconexion.'
                            : `Pendiente con error: ${n.message}`,
                        t ? 'info' : 'error'
                    ),
                        l('offline_sync_error', {
                            resource: e.resource,
                            retryingOffline: t,
                            error: String(n?.message || ''),
                        }));
                    break;
                }
            }
            i > 0 &&
                ((s.queueFailureStreak = 0),
                (await ue()).ok &&
                    ((s.queueLastHealthySyncAt = Date.now()),
                    $('live', 'Cola conectada'),
                    j(`Outbox sincronizado desde ${e}. (${oe()})`),
                    l('offline_synced_batch', {
                        source: e,
                        processed: i,
                        pendingAfter: s.offlineOutbox.length,
                    })));
        } finally {
            ((s.offlineOutboxFlushBusy = !1), Y());
        }
    }
    async function ke(e) {
        if (
            (e.preventDefault(),
            R(),
            ve({ reason: 'form_submit' }),
            !(e.currentTarget instanceof HTMLFormElement))
        )
            return;
        const n = p('checkinPhone'),
            t = p('checkinTime'),
            i = p('checkinDate'),
            o = p('checkinInitials'),
            a = p('checkinSubmit'),
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
                void g(
                    'Completa telefono, fecha y hora para continuar.',
                    'warn'
                )
            );
        a instanceof HTMLButtonElement && (a.disabled = !0);
        try {
            const e = { telefono: r, hora: c, fecha: u, patientInitials: l },
                n = await I('queue-checkin', { method: 'POST', body: e });
            (O('Check-in registrado correctamente', 'success'),
                g(
                    'Check-in completado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                le(n, n.replay ? 'Check-in ya existente' : 'Check-in de cita'),
                (s.queueFailureStreak = 0),
                (await ue()).ok ||
                    $(
                        'reconnecting',
                        'Check-in registrado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (pe(e)) {
                const e = me({
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
                        $('offline', 'Sin conexion al backend'),
                        j(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        de({
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
                        void g(
                            'Check-in guardado offline. Recepcion confirmara al reconectar.',
                            'warn'
                        )
                    );
            }
            (O(`No se pudo registrar el check-in: ${e.message}`, 'error'),
                g(
                    'No se pudo confirmar check-in. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            a instanceof HTMLButtonElement && (a.disabled = !1);
        }
    }
    async function be(e) {
        (e.preventDefault(), R(), ve({ reason: 'form_submit' }));
        const n = p('walkinName'),
            t = p('walkinInitials'),
            i = p('walkinPhone'),
            o = p('walkinSubmit'),
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
                void g('Escribe iniciales para generar tu turno.', 'warn')
            );
        o instanceof HTMLButtonElement && (o.disabled = !0);
        try {
            const e = { patientInitials: r, name: a, phone: c },
                n = await I('queue-ticket', { method: 'POST', body: e });
            (O('Turno walk-in registrado correctamente', 'success'),
                g(
                    'Turno generado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                le(n, 'Turno sin cita'),
                (s.queueFailureStreak = 0),
                (await ue()).ok ||
                    $(
                        'reconnecting',
                        'Turno creado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (pe(e)) {
                const e = me({
                    resource: 'queue-ticket',
                    body: { patientInitials: r, name: a, phone: c },
                    originLabel: 'Turno sin cita',
                    patientInitials: r,
                    queueType: 'walk_in',
                });
                if (e)
                    return (
                        $('offline', 'Sin conexion al backend'),
                        j(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        de({
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
                        void g(
                            'Turno guardado offline. Recepcion lo sincronizara al reconectar.',
                            'warn'
                        )
                    );
            }
            (O(`No se pudo crear el turno: ${e.message}`, 'error'),
                g(
                    'No se pudo generar turno. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            o instanceof HTMLButtonElement && (o.disabled = !1);
        }
    }
    function he(e, n) {
        const t = p('assistantMessages');
        if (!t) return;
        const i = document.createElement('article');
        ((i.className = `assistant-message assistant-message-${e}`),
            (i.innerHTML = `<p>${d(n)}</p>`),
            t.appendChild(i),
            (t.scrollTop = t.scrollHeight));
    }
    async function ye(e) {
        if ((e.preventDefault(), R(), s.assistantBusy)) return;
        const n = p('assistantInput'),
            t = p('assistantSend');
        if (!(n instanceof HTMLInputElement)) return;
        const i = n.value.trim();
        if (!i) return;
        (he('user', i),
            (n.value = ''),
            (s.assistantBusy = !0),
            t instanceof HTMLButtonElement && (t.disabled = !0));
        const o = performance.now();
        try {
            const e = (function (e) {
                const n = (function (e) {
                    return String(e || '')
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .trim();
                })(e);
                return n
                    ? /(diagnost|medicacion|tratamiento|receta|dosis|enfermedad|medicamento|que tomo|que crema|que me pongo)/.test(
                          n
                      )
                        ? { intent: 'clinical_blocked', normalized: n }
                        : /(perdi mi ticket|perdi el ticket|no encuentro mi ticket|extravie mi ticket)/.test(
                                n
                            )
                          ? { intent: 'lost_ticket', normalized: n }
                          : /(impresora|no imprimio|no salio el ticket|ticket no salio|no imprime|problema de impresion|reimprimir)/.test(
                                  n
                              )
                            ? { intent: 'printer_issue', normalized: n }
                            : /(no encuentro mi cita|mi cita no aparece|no sale mi cita|no encuentro la cita)/.test(
                                    n
                                )
                              ? {
                                    intent: 'appointment_not_found',
                                    normalized: n,
                                }
                              : /(embarazada|adulto mayor|discapacidad|movilidad reducida|prioridad especial|necesito prioridad)/.test(
                                      n
                                  )
                                ? { intent: 'special_priority', normalized: n }
                                : /(acompanante|soy acompanante|vengo con alguien)/.test(
                                        n
                                    )
                                  ? { intent: 'companion', normalized: n }
                                  : /(no veo bien|no puedo leer|letra grande|accesibilidad|dificultad visual)/.test(
                                          n
                                      )
                                    ? { intent: 'accessibility', normalized: n }
                                    : /(necesito ayuda humana|necesito ayuda|quiero hablar con recepcion|llama a recepcion|apoyo humano)/.test(
                                            n
                                        )
                                      ? { intent: 'human_help', normalized: n }
                                      : /(no tengo cita|sin cita|quiero turno|sacar turno|turno sin cita|walk in)/.test(
                                              n
                                          )
                                        ? { intent: 'walk_in', normalized: n }
                                        : /(tengo cita|check in|checkin|vengo con cita)/.test(
                                                n
                                            )
                                          ? {
                                                intent: 'have_appointment',
                                                normalized: n,
                                            }
                                          : /(donde espero|donde me siento|donde aguardo)/.test(
                                                  n
                                              )
                                            ? {
                                                  intent: 'where_wait',
                                                  normalized: n,
                                              }
                                            : /(que sigue|que hago ahora|siguiente paso|ahora que hago)/.test(
                                                    n
                                                )
                                              ? {
                                                    intent: 'next_step',
                                                    normalized: n,
                                                }
                                              : /(cuanto falta|cuanto demora|cuanto tiempo|cuanto tarda|tiempo de espera)/.test(
                                                      n
                                                  )
                                                ? {
                                                      intent: 'wait_time',
                                                      normalized: n,
                                                  }
                                                : null
                    : { intent: 'empty', normalized: n };
            })(i);
            if (e && 'empty' !== e.intent) {
                const n = await (async function (e, n, t) {
                    const i = String(e?.intent || 'fallback');
                    switch (i) {
                        case 'have_appointment':
                            return (
                                L('checkin'),
                                H(i, 'resolved', t, {
                                    action: 'focus_checkin',
                                }),
                                'Te llevo a Tengo cita. Escribe telefono, fecha y hora y pulsa "Confirmar check-in".'
                            );
                        case 'walk_in':
                            return (
                                L('walkin'),
                                H(i, 'resolved', t, { action: 'focus_walkin' }),
                                'Te llevo a No tengo cita. Escribe tus iniciales y pulsa "Generar turno".'
                            );
                        case 'where_wait':
                            return (
                                H(i, 'resolved', t, {
                                    action: 'waiting_room_guidance',
                                }),
                                s.lastIssuedTicket?.ticketCode
                                    ? `Espera en la sala mirando la pantalla. Cuando aparezca ${s.lastIssuedTicket.ticketCode}, acude al consultorio indicado.`
                                    : 'Espera en la sala mirando la pantalla de turnos. Cuando llamen tu codigo, acude al consultorio indicado.'
                            );
                        case 'next_step':
                            return (
                                H(i, 'resolved', t, {
                                    action: 'next_step_guidance',
                                }),
                                (function () {
                                    const e = s.lastIssuedTicket;
                                    return e?.ticketCode
                                        ? `Tu ticket ${e.ticketCode} ya esta generado. Espera mirando la pantalla de sala hasta que te llamen al consultorio indicado.`
                                        : 'walkin' === s.selectedFlow
                                          ? 'Completa tus iniciales y pulsa "Generar turno". Luego espera el llamado en la pantalla de sala.'
                                          : 'Completa telefono, fecha y hora y pulsa "Confirmar check-in". Luego espera el llamado en la pantalla de sala.';
                                })()
                            );
                        case 'wait_time':
                            return (
                                H(i, 'resolved', t, {
                                    action: 'wait_time_guidance',
                                }),
                                (function () {
                                    const e = s.queueState || {},
                                        n = Math.max(
                                            0,
                                            Number(e.waitingCount || 0)
                                        ),
                                        t = Math.max(
                                            0,
                                            Number(
                                                e.estimatedWaitMin || 8 * n || 0
                                            )
                                        ),
                                        i = String(e.delayReason || '').trim();
                                    return i
                                        ? `Ahora hay ${n} persona(s) en espera. El tiempo estimado es ${t} min. Motivo de demora: ${i}.`
                                        : `Ahora hay ${n} persona(s) en espera. El tiempo estimado es ${t} min.`;
                                })()
                            );
                        case 'companion':
                            return (
                                H(i, 'resolved', t, {
                                    action: 'companion_guidance',
                                }),
                                'Tu acompanante puede esperar contigo en la sala. Si recepcion debe validar algo adicional, te ayudaran en el mostrador.'
                            );
                        case 'human_help': {
                            const e = await q({
                                source: 'assistant',
                                reason: 'human_help',
                                message: n,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                H(i, 'handoff', t, { queued: e.queued }),
                                e.message
                            );
                        }
                        case 'lost_ticket': {
                            const e = await q({
                                source: 'assistant',
                                reason: 'lost_ticket',
                                message: n,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                H(i, 'handoff', t, { queued: e.queued }),
                                s.lastIssuedTicket?.ticketCode
                                    ? `${e.message} Tu ultimo ticket registrado fue ${s.lastIssuedTicket.ticketCode}.`
                                    : e.message
                            );
                        }
                        case 'printer_issue': {
                            const e = await q({
                                source: 'assistant',
                                reason: 'printer_issue',
                                message: n,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                H(i, 'handoff', t, { queued: e.queued }),
                                e.message
                            );
                        }
                        case 'appointment_not_found': {
                            L('checkin');
                            const e = await q({
                                source: 'assistant',
                                reason: 'appointment_not_found',
                                message: n,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                H(i, 'handoff', t, { queued: e.queued }),
                                `${e.message} Mientras tanto, revisa telefono, fecha y hora en Tengo cita.`
                            );
                        }
                        case 'special_priority': {
                            const e = await q({
                                source: 'assistant',
                                reason: 'special_priority',
                                message: n,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                H(i, 'handoff', t, { queued: e.queued }),
                                e.message
                            );
                        }
                        case 'accessibility': {
                            const e = await q({
                                source: 'assistant',
                                reason: 'accessibility',
                                message: n,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                H(i, 'handoff', t, { queued: e.queued }),
                                e.message
                            );
                        }
                        case 'clinical_blocked':
                            return (
                                H(i, 'clinical_blocked', t, {
                                    queued: (
                                        await q({
                                            source: 'assistant',
                                            reason: 'clinical_redirect',
                                            message: n,
                                            intent: i,
                                            announceInAssistant: !1,
                                        })
                                    ).queued,
                                }),
                                'En este kiosco no doy orientacion medica. Recepcion ya fue alertada para derivarte con el personal adecuado.'
                            );
                        default:
                            return '';
                    }
                })(e, i, o);
                return (
                    he('bot', n),
                    void (s.chatHistory = [
                        ...s.chatHistory,
                        { role: 'user', content: i },
                        { role: 'assistant', content: n },
                    ].slice(-8))
                );
            }
            const n = [
                    {
                        role: 'system',
                        content:
                            'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                    },
                    ...s.chatHistory.slice(-6),
                    { role: 'user', content: i },
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
                        messages: n,
                        max_tokens: 180,
                        temperature: 0.2,
                    }),
                }),
                a = await t.json(),
                r = (function (e) {
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
                })(String(a?.choices?.[0]?.message?.content || '').trim());
            (H('fallback_ai', 'fallback', o, { aiSource: 'figo' }),
                he('bot', r),
                (s.chatHistory = [
                    ...s.chatHistory,
                    { role: 'user', content: i },
                    { role: 'assistant', content: r },
                ].slice(-8)));
        } catch (e) {
            (H('fallback_ai', 'error', o, { error: String(e?.message || '') }),
                he(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                ));
        } finally {
            ((s.assistantBusy = !1),
                t instanceof HTMLButtonElement && (t.disabled = !1));
        }
    }
    function ve({ reason: e = 'auto' } = {}) {
        if (s.welcomeDismissed) return;
        s.welcomeDismissed = !0;
        const n = p('kioskWelcomeScreen');
        n instanceof HTMLElement &&
            (n.classList.add('is-hidden'),
            window.setTimeout(() => {
                n.parentElement && n.remove();
            }, 700),
            l('welcome_dismissed', { reason: e }));
    }
    function Se() {
        const e = p('checkinDate');
        e instanceof HTMLInputElement &&
            !e.value &&
            (e.value = new Date().toISOString().slice(0, 10));
    }
    function we({ immediate: e = !1 } = {}) {
        if ((se(), !s.queuePollingEnabled)) return;
        const n = e ? 0 : re();
        s.queueTimerId = window.setTimeout(() => {
            qe();
        }, n);
    }
    async function qe() {
        if (!s.queuePollingEnabled) return;
        if (document.hidden)
            return (
                $('paused', 'Cola en pausa (pestana oculta)'),
                j('Pestana oculta. Turnero en pausa temporal.'),
                void we()
            );
        if (!1 === navigator.onLine)
            return (
                (s.queueFailureStreak += 1),
                $('offline', 'Sin conexion al backend'),
                j(
                    'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
                ),
                ee(),
                void we()
            );
        await ge({ source: 'poll' });
        const e = await ue();
        if (e.ok && !e.stale)
            ((s.queueFailureStreak = 0),
                (s.queueLastHealthySyncAt = Date.now()),
                $('live', 'Cola conectada'),
                j(
                    `Operacion estable (${oe()}). Kiosco disponible para turnos.`
                ));
        else if (e.ok && e.stale) {
            s.queueFailureStreak += 1;
            const n = ie(e.ageMs || 0);
            ($('reconnecting', `Watchdog: cola estancada ${n}`),
                j(
                    `Cola degradada: sin cambios en ${n}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
                ));
        } else {
            s.queueFailureStreak += 1;
            const e = Math.max(1, Math.ceil(re() / 1e3));
            ($('reconnecting', `Reintentando en ${e}s`),
                j(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        (ee(), we());
    }
    async function xe() {
        if (!s.queueManualRefreshBusy) {
            (R(),
                (s.queueManualRefreshBusy = !0),
                te(!0),
                $('reconnecting', 'Refrescando manualmente...'));
            try {
                await ge({ source: 'manual' });
                const e = await ue();
                if (e.ok && !e.stale)
                    return (
                        (s.queueFailureStreak = 0),
                        (s.queueLastHealthySyncAt = Date.now()),
                        $('live', 'Cola conectada'),
                        void j(`Sincronizacion manual exitosa (${oe()}).`)
                    );
                if (e.ok && e.stale) {
                    const n = ie(e.ageMs || 0);
                    return (
                        $('reconnecting', `Watchdog: cola estancada ${n}`),
                        void j(
                            `Persisten datos estancados (${n}). Verifica backend o recepcion.`
                        )
                    );
                }
                const n = Math.max(1, Math.ceil(re() / 1e3));
                ($(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion al backend'
                        : `Reintentando en ${n}s`
                ),
                    j(
                        !1 === navigator.onLine
                            ? 'Sin internet. Opera manualmente en recepcion.'
                            : `Refresh manual sin exito. Reintento automatico en ${n}s.`
                    ));
            } finally {
                (ee(), (s.queueManualRefreshBusy = !1), te(!1));
            }
        }
    }
    function Le({ immediate: e = !0 } = {}) {
        if (((s.queuePollingEnabled = !0), e))
            return ($('live', 'Sincronizando cola...'), void qe());
        we();
    }
    function Me({ reason: e = 'paused' } = {}) {
        ((s.queuePollingEnabled = !1), (s.queueFailureStreak = 0), se());
        const n = String(e || 'paused').toLowerCase();
        return 'offline' === n
            ? ($('offline', 'Sin conexion al backend'),
              j('Sin conexion. Esperando reconexion para reanudar cola.'),
              void ee())
            : 'hidden' === n
              ? ($('paused', 'Cola en pausa (pestana oculta)'),
                void j('Pestana oculta. Reanudando al volver a primer plano.'))
              : ($('paused', 'Cola en pausa'),
                j('Sincronizacion pausada por navegacion.'),
                void ee());
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
            b(
                (function () {
                    try {
                        return '1' === localStorage.getItem(t);
                    } catch (e) {
                        return !1;
                    }
                })(),
                { persist: !1, source: 'init' }
            ),
            v(),
            (function () {
                const e = p('kioskWelcomeScreen');
                e instanceof HTMLElement &&
                    (e.classList.add('is-visible'),
                    g(
                        'Bienvenida: en segundos podras elegir tu tipo de atencion.',
                        'info'
                    ),
                    window.setTimeout(() => {
                        ve({ reason: 'auto' });
                    }, 1800),
                    window.setTimeout(() => {
                        ve({ reason: 'safety_timeout' });
                    }, 2600));
            })(),
            Se());
        const e = p('checkinForm'),
            n = p('walkinForm'),
            u = p('assistantForm');
        (e instanceof HTMLFormElement && e.addEventListener('submit', ke),
            n instanceof HTMLFormElement && n.addEventListener('submit', be),
            u instanceof HTMLFormElement && u.addEventListener('submit', ye),
            (function () {
                const e = p('kioskQuickCheckin'),
                    n = p('kioskQuickWalkin'),
                    t = p('kioskHelpToggle'),
                    i = p('kioskHelpClose'),
                    o = p('kioskSeniorToggle'),
                    a = p('kioskVoiceGuideBtn'),
                    r = p('kioskReceptionHelpBtn');
                (e instanceof HTMLButtonElement &&
                    e.addEventListener('click', () => {
                        (R(), L('checkin'));
                    }),
                    n instanceof HTMLButtonElement &&
                        n.addEventListener('click', () => {
                            (R(), L('walkin'));
                        }),
                    t instanceof HTMLButtonElement &&
                        t.addEventListener('click', () => {
                            (R(), x(!s.quickHelpOpen, { source: 'toggle' }));
                        }),
                    i instanceof HTMLButtonElement &&
                        i.addEventListener('click', () => {
                            (R(), x(!1, { source: 'close_button' }));
                        }),
                    o instanceof HTMLButtonElement &&
                        o.addEventListener('click', () => {
                            (R(), h({ source: 'button' }));
                        }),
                    a instanceof HTMLButtonElement &&
                        a.addEventListener('click', () => {
                            (R(), w({ source: 'button' }));
                        }),
                    r instanceof HTMLButtonElement &&
                        ((r.dataset.variant = 'warning'),
                        r.addEventListener('click', () => {
                            (R(), q({ source: 'button' }));
                        })));
            })(),
            x(!1, { source: 'init' }),
            (function () {
                let e = p('kioskSessionGuard');
                if (e instanceof HTMLElement) return e;
                const n = p('kioskStatus');
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
        const l = p('kioskSessionResetBtn');
        (l instanceof HTMLButtonElement &&
            l.addEventListener('click', () => {
                P({ reason: 'manual' });
            }),
            z(),
            N(),
            L('checkin', { announce: !1 }),
            g('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((e) => {
                document.addEventListener(
                    e,
                    () => {
                        R();
                    },
                    !0
                );
            }),
            D(),
            F(),
            U(),
            W(),
            Q(),
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
                            renderMode:
                                'support' ===
                                String(e?.renderMode || 'ticket').toLowerCase()
                                    ? 'support'
                                    : 'ticket',
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
                                    'queue-checkin' === e.resource ||
                                    'queue-help-request' === e.resource)
                        )
                        .map((e) => ({
                            ...e,
                            fingerprint:
                                e.fingerprint || fe(e.resource, e.body),
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
            J(),
            ee());
        const d = ne();
        d instanceof HTMLButtonElement &&
            d.addEventListener('click', () => {
                xe();
            });
        const f = p('queueOutboxRetryBtn');
        f instanceof HTMLButtonElement &&
            f.addEventListener('click', () => {
                ge({ source: 'operator', force: !0, maxItems: 25 });
            });
        const k = p('queueOutboxDropOldestBtn');
        k instanceof HTMLButtonElement &&
            k.addEventListener('click', () => {
                !(function () {
                    if (!s.offlineOutbox.length) return;
                    const e = s.offlineOutbox[s.offlineOutbox.length - 1];
                    (s.offlineOutbox.pop(),
                        X(),
                        ee(),
                        Y(),
                        O(
                            `Descartado pendiente antiguo (${e?.originLabel || 'sin detalle'}).`,
                            'info'
                        ));
                })();
            });
        const M = p('queueOutboxClearBtn');
        (M instanceof HTMLButtonElement &&
            M.addEventListener('click', () => {
                Z({ reason: 'manual' });
            }),
            $('paused', 'Sincronizacion lista'),
            j('Esperando primera sincronizacion de cola...'),
            ae(''),
            !1 !== navigator.onLine && ge({ source: 'startup', force: !0 }),
            m().start({ immediate: !1 }),
            Le({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? Me({ reason: 'hidden' })
                    : Le({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                (ge({ source: 'online', force: !0 }), Le({ immediate: !0 }));
            }),
            window.addEventListener('offline', () => {
                (Me({ reason: 'offline' }), ee());
            }),
            window.addEventListener('beforeunload', () => {
                (S({ source: 'beforeunload' }),
                    Me({ reason: 'paused' }),
                    c?.stop());
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const n = String(e.code || '').toLowerCase();
                return 'keyr' === n
                    ? (e.preventDefault(), void xe())
                    : 'keyh' === n
                      ? (e.preventDefault(),
                        void x(!s.quickHelpOpen, { source: 'shortcut' }))
                      : 'digit1' === n
                        ? (e.preventDefault(), void L('checkin'))
                        : 'digit2' === n
                          ? (e.preventDefault(), void L('walkin'))
                          : 'keys' === n
                            ? (e.preventDefault(),
                              void h({ source: 'shortcut' }))
                            : 'keyv' === n
                              ? (e.preventDefault(),
                                void w({ source: 'shortcut' }))
                              : 'keya' === n
                                ? (e.preventDefault(),
                                  void q({ source: 'shortcut' }))
                                : 'keyl' === n
                                  ? (e.preventDefault(),
                                    void P({ reason: 'manual' }))
                                  : 'keyy' === n
                                    ? (e.preventDefault(),
                                      void ge({
                                          source: 'shortcut',
                                          force: !0,
                                          maxItems: 25,
                                      }))
                                    : void (
                                          'keyk' === n &&
                                          (e.preventDefault(),
                                          Z({ reason: 'manual' }))
                                      );
            }));
    });
})();
