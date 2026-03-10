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
    function n(e, n, t, a) {
        const i = 'function' == typeof t && t() ? t() : {},
            o = i.details && 'object' == typeof i.details ? i.details : {};
        return {
            surface: e,
            deviceId: n,
            instance: String(i.instance || 'main'),
            deviceLabel: String(i.deviceLabel || ''),
            appMode: String(i.appMode || 'web'),
            route:
                String(i.route || '').trim() ||
                `${window.location.pathname}${window.location.search}`,
            status: String(i.status || 'warning'),
            summary: String(i.summary || ''),
            networkOnline:
                'boolean' == typeof i.networkOnline
                    ? i.networkOnline
                    : !1 !== navigator.onLine,
            lastEvent: String(i.lastEvent || a || 'heartbeat'),
            lastEventAt: String(i.lastEventAt || new Date().toISOString()),
            details: o,
        };
    }
    const t = 'queueDisplayBellMuted',
        a = 'queueDisplayLastSnapshot',
        i = 'displayAnnouncementInlineStyles',
        o = 'displayStarInlineStyles',
        l = 'display-bell-flash',
        r = {
            lastCalledSignature: '',
            callBaselineReady: !1,
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
            lastConnectionMessage: '',
            lastRenderedSignature: '',
            bellFlashId: 0,
            lastBellAt: 0,
            lastBellBlockedHintAt: 0,
            bellPrimed: !1,
            lastBellSource: '',
            lastBellOutcome: 'idle',
        };
    let s = null;
    function c(e, n = {}) {
        try {
            window.dispatchEvent(
                new CustomEvent('piel:queue-ops', {
                    detail: {
                        surface: 'display',
                        event: String(e || 'unknown'),
                        at: new Date().toISOString(),
                        ...n,
                    },
                })
            );
        } catch (e) {}
    }
    function d(e) {
        return document.getElementById(e);
    }
    function u() {
        const e =
            `${navigator.userAgent || ''} ${navigator.platform || ''}`.toLowerCase();
        return e.includes('android') ||
            e.includes('google tv') ||
            e.includes('aft')
            ? 'android_tv'
            : 'web';
    }
    function p() {
        const e = String(r.connectionState || 'paused'),
            n = Boolean(r.lastHealthySyncAt);
        let t = 'warning',
            a = 'Sala TV pendiente de validación.';
        return (
            'offline' === e
                ? ((t = 'alert'),
                  (a =
                      'Sala TV sin conexión; usa respaldo local y confirma llamados manuales.'))
                : r.bellMuted
                  ? ((t = 'warning'),
                    (a =
                        'La campanilla está en silencio; reactivarla antes de operar.'))
                  : 'blocked' !== r.lastBellOutcome && r.bellPrimed
                    ? 'live' === e &&
                      n &&
                      ((t = 'ready'),
                      (a =
                          'Sala TV lista: cola en vivo, audio activo y respaldo local disponible.'))
                    : ((t = 'alert'),
                      (a =
                          'La TV no confirmó audio; repite la prueba de campanilla.')),
            {
                instance: 'main',
                deviceLabel: 'Sala TV TCL C655',
                appMode: u(),
                status: t,
                summary: a,
                networkOnline: !1 !== navigator.onLine,
                lastEvent:
                    'played' === r.lastBellOutcome
                        ? 'bell_ok'
                        : 'blocked' === r.lastBellOutcome
                          ? 'bell_blocked'
                          : 'heartbeat',
                lastEventAt:
                    r.lastBellAt > 0
                        ? new Date(r.lastBellAt).toISOString()
                        : new Date().toISOString(),
                details: {
                    connection: e,
                    bellMuted: Boolean(r.bellMuted),
                    bellPrimed: Boolean(r.bellPrimed),
                    bellOutcome: String(r.lastBellOutcome || 'idle'),
                    healthySync: n,
                },
            }
        );
    }
    function m() {
        return (
            s ||
            ((s = (function ({
                surface: t,
                intervalMs: a = 15e3,
                getPayload: i,
            } = {}) {
                const o = (function (e) {
                        const n = String(e || '')
                            .trim()
                            .toLowerCase();
                        return 'sala_tv' === n ? 'display' : n || 'operator';
                    })(t),
                    l = (function (n) {
                        const t = `queueSurfaceDeviceIdV1:${n}`;
                        try {
                            const a = localStorage.getItem(t);
                            if (a) return a;
                            const i = e(n);
                            return (localStorage.setItem(t, i), i);
                        } catch (t) {
                            return e(n);
                        }
                    })(o),
                    r = Math.max(5e3, Number(a || 15e3));
                let s = 0,
                    c = !1,
                    d = 0,
                    u = !1;
                async function p(e = 'interval', { keepalive: t = !1 } = {}) {
                    if (c) return !1;
                    c = !0;
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
                                        body: JSON.stringify(n(o, l, i, e)),
                                    }
                                )
                            ).ok && ((d = Date.now()), !0)
                        );
                    } catch (e) {
                        return !1;
                    } finally {
                        c = !1;
                    }
                }
                function m() {
                    'visible' === document.visibilityState && p('visible');
                }
                function f() {
                    p('online');
                }
                function g() {
                    p('unload', { keepalive: !0 });
                }
                function y() {
                    (s && (window.clearInterval(s), (s = 0)),
                        u &&
                            ((u = !1),
                            document.removeEventListener('visibilitychange', m),
                            window.removeEventListener('online', f),
                            window.removeEventListener('beforeunload', g)));
                }
                return {
                    start: function ({ immediate: e = !0 } = {}) {
                        (y(),
                            u ||
                                ((u = !0),
                                document.addEventListener(
                                    'visibilitychange',
                                    m
                                ),
                                window.addEventListener('online', f),
                                window.addEventListener('beforeunload', g)),
                            e && p('boot'),
                            (s = window.setInterval(() => {
                                'hidden' !== document.visibilityState &&
                                    p('interval');
                            }, r)));
                    },
                    stop: y,
                    notify: function (e = 'state_change') {
                        Date.now() - d < 4e3 || p(e);
                    },
                    beatNow: (e = 'manual') => p(e),
                    getDeviceId: () => l,
                };
            })({ surface: 'display', intervalMs: 15e3, getPayload: p })),
            s)
        );
    }
    function f(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function g(e) {
        const n = String(e || '')
            .trim()
            .toUpperCase();
        return (n && n.replace(/[^A-Z0-9-]/g, '')) || '--';
    }
    function y(e) {
        const n = String(e || '').trim();
        if (!n) return '--';
        const t = n
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9\s-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!t) return '--';
        const a = t.split(/[\s-]+/).filter(Boolean);
        let i = '';
        if (a.length >= 2)
            i = `${String(a[0] || '').charAt(0)}${String(a[a.length - 1] || '').charAt(0)}`;
        else if (1 === a.length) {
            const e = String(a[0] || '').replace(/[^A-Za-z0-9]/g, '');
            if (!e) return '--';
            i = e.length <= 3 && e === e.toUpperCase() ? e : e.slice(0, 2);
        }
        const o = i.toUpperCase().trim();
        return o ? o.slice(0, 3) : '--';
    }
    function b(e, n) {
        if (!e || 'object' != typeof e || !Array.isArray(n)) return [];
        for (const t of n) if (t && Array.isArray(e[t])) return e[t];
        return [];
    }
    function h(e, n) {
        if (!e || 'object' != typeof e || !Array.isArray(n)) return null;
        for (const t of n) {
            if (!t) continue;
            const n = e[t];
            if (n && 'object' == typeof n && !Array.isArray(n)) return n;
        }
        return null;
    }
    function v(e, n, t = 0) {
        if (!e || 'object' != typeof e || !Array.isArray(n))
            return Number(t || 0);
        for (const t of n) {
            if (!t) continue;
            const n = Number(e[t]);
            if (Number.isFinite(n)) return n;
        }
        return Number(t || 0);
    }
    function S(e) {
        const n = e && 'object' == typeof e ? e : {},
            t = h(n, ['counts']) || {},
            a = v(n, ['waitingCount', 'waiting_count'], Number.NaN),
            i = v(n, ['calledCount', 'called_count'], Number.NaN);
        let o = b(n, [
            'callingNow',
            'calling_now',
            'calledTickets',
            'called_tickets',
        ]);
        if (0 === o.length) {
            const e = h(n, [
                'callingNowByConsultorio',
                'calling_now_by_consultorio',
            ]);
            e && (o = Object.values(e).filter(Boolean));
        }
        const l = b(n, [
                'nextTickets',
                'next_tickets',
                'waitingTickets',
                'waiting_tickets',
            ]),
            r = Number.isFinite(a)
                ? a
                : v(t, ['waiting', 'waiting_count'], l.length),
            s = Number.isFinite(i)
                ? i
                : v(t, ['called', 'called_count'], o.length);
        return {
            updatedAt:
                String(n.updatedAt || n.updated_at || '').trim() ||
                new Date().toISOString(),
            waitingCount: Math.max(0, Number(r || 0)),
            calledCount: Math.max(0, Number(s || 0)),
            callingNow: Array.isArray(o)
                ? o.map((e) => ({
                      ...e,
                      id: Number(e?.id || e?.ticket_id || 0) || 0,
                      ticketCode: g(e?.ticketCode || e?.ticket_code || '--'),
                      patientInitials: y(
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
            nextTickets: Array.isArray(l)
                ? l.map((e, n) => ({
                      ...e,
                      id: Number(e?.id || e?.ticket_id || 0) || 0,
                      ticketCode: g(e?.ticketCode || e?.ticket_code || '--'),
                      patientInitials: y(
                          e?.patientInitials || e?.patient_initials || '--'
                      ),
                      position:
                          Number(e?.position || 0) > 0
                              ? Number(e.position)
                              : n + 1,
                  }))
                : [],
        };
    }
    function w(e, n) {
        const t = d('displayConnectionState');
        if (!t) return;
        const a = String(e || 'live').toLowerCase(),
            i = {
                live: 'Conectado',
                reconnecting: 'Reconectando',
                offline: 'Sin conexion',
                paused: 'En pausa',
            },
            o = String(n || '').trim() || i[a] || i.live,
            l = a !== r.connectionState || o !== r.lastConnectionMessage;
        ((r.connectionState = a),
            (r.lastConnectionMessage = o),
            (t.dataset.state = a),
            (t.textContent = o),
            l && c('connection_state', { state: a, message: o }),
            T());
    }
    function x() {
        let e = d('displayOpsHint');
        if (e) return e;
        const n = d('displayUpdatedAt');
        return n?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displayOpsHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function A() {
        if (document.getElementById(o)) return;
        const e = document.createElement('style');
        ((e.id = o),
            (e.textContent = `\n        body[data-display-mode='star'] .display-header {\n            border-bottom-color: color-mix(in srgb, var(--accent) 18%, var(--border));\n            box-shadow: 0 10px 32px rgb(16 36 61 / 10%);\n        }\n        body[data-display-mode='star'] .display-brand strong {\n            letter-spacing: -0.02em;\n        }\n        body[data-display-mode='star'] .display-privacy-pill {\n            width: fit-content;\n            border: 1px solid color-mix(in srgb, var(--accent) 24%, #fff 76%);\n            border-radius: 999px;\n            padding: 0.22rem 0.66rem;\n            background: color-mix(in srgb, var(--accent-soft) 90%, #fff 10%);\n            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);\n            font-size: 0.83rem;\n            font-weight: 600;\n            line-height: 1.3;\n        }\n        body[data-display-mode='star'] .display-layout {\n            gap: 1.1rem;\n        }\n        body[data-display-mode='star'] .display-panel {\n            border-radius: 22px;\n            padding: 1.12rem;\n        }\n        body[data-display-mode='star'] .display-next-list li {\n            min-height: 68px;\n        }\n        #displayMetrics {\n            margin: 0.7rem 1.35rem 0;\n            display: flex;\n            flex-wrap: wrap;\n            gap: 0.56rem;\n        }\n        .display-metric-chip {\n            border: 1px solid var(--border);\n            border-radius: 12px;\n            padding: 0.36rem 0.7rem;\n            background: var(--surface-soft);\n            color: var(--muted);\n            font-size: 0.9rem;\n            font-weight: 600;\n        }\n        .display-metric-chip strong {\n            color: var(--text);\n            font-size: 1.02rem;\n            margin-left: 0.28rem;\n        }\n        .display-metric-chip[data-kind='active'] {\n            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);\n            background: color-mix(in srgb, var(--accent-soft) 88%, #fff 12%);\n            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);\n        }\n        .display-metric-chip[data-kind='active'] strong {\n            color: var(--accent);\n        }\n        #displayAnnouncement .display-announcement-support {\n            margin: 0.24rem 0 0;\n            color: var(--muted);\n            font-size: clamp(0.98rem, 1.45vw, 1.15rem);\n            font-weight: 500;\n            line-height: 1.3;\n        }\n        #displayAnnouncement.is-live .display-announcement-support {\n            color: color-mix(in srgb, var(--accent) 60%, var(--muted) 40%);\n        }\n        body.${l} .display-header {\n            box-shadow:\n                0 0 0 2px color-mix(in srgb, var(--accent) 34%, #fff 66%),\n                0 14px 34px rgb(16 36 61 / 18%);\n        }\n        body.${l} #displayAnnouncement {\n            border-color: color-mix(in srgb, var(--accent) 45%, #fff 55%);\n            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, #fff 72%);\n            transform: translateY(-1px);\n        }\n        body.${l} .display-called-card.is-live {\n            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);\n            box-shadow: 0 12px 24px rgb(16 36 61 / 14%);\n        }\n        @media (max-width: 720px) {\n            #displayMetrics {\n                margin: 0.56rem 0.9rem 0;\n            }\n        }\n    `),
            document.head.appendChild(e));
    }
    function C() {
        let e = d('displayAnnouncement');
        if (e instanceof HTMLElement) return e;
        const n = document.querySelector('.display-layout');
        return n instanceof HTMLElement
            ? ((function () {
                  if (document.getElementById(i)) return;
                  const e = document.createElement('style');
                  ((e.id = i),
                      (e.textContent =
                          '\n        #displayAnnouncement {\n            margin: 0.75rem 1.35rem 0;\n            padding: 1rem 1.2rem;\n            border-radius: 18px;\n            border: 1px solid color-mix(in srgb, var(--accent) 28%, #fff 72%);\n            background: linear-gradient(120deg, color-mix(in srgb, var(--accent-soft) 92%, #fff 8%), #fff);\n            box-shadow: 0 12px 24px rgb(16 36 61 / 11%);\n        }\n        #displayAnnouncement .display-announcement-label {\n            margin: 0;\n            color: var(--muted);\n            font-size: 0.96rem;\n            font-weight: 600;\n            letter-spacing: 0.02em;\n        }\n        #displayAnnouncement .display-announcement-text {\n            margin: 0.24rem 0 0;\n            font-size: clamp(1.34rem, 2.5vw, 2.15rem);\n            line-height: 1.18;\n            font-weight: 700;\n            letter-spacing: 0.01em;\n            color: var(--text);\n        }\n        #displayAnnouncement.is-live .display-announcement-text {\n            color: var(--accent);\n        }\n        #displayAnnouncement.is-bell {\n            border-color: color-mix(in srgb, var(--accent) 40%, #fff 60%);\n            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, #fff 78%);\n        }\n        #displayAnnouncement.is-idle {\n            border-color: var(--border);\n            background: linear-gradient(160deg, var(--surface-soft), #fff);\n        }\n        @media (max-width: 720px) {\n            #displayAnnouncement {\n                margin: 0.6rem 0.9rem 0;\n            }\n        }\n        @media (prefers-reduced-motion: reduce) {\n            #displayAnnouncement {\n                transition: none !important;\n            }\n        }\n    '),
                      document.head.appendChild(e));
              })(),
              A(),
              (e = document.createElement('section')),
              (e.id = 'displayAnnouncement'),
              (e.className = 'display-announcement is-idle'),
              e.setAttribute('role', 'status'),
              e.setAttribute('aria-live', 'assertive'),
              e.setAttribute('aria-atomic', 'true'),
              (e.innerHTML =
                  '\n        <p class="display-announcement-label">Llamando ahora</p>\n        <p class="display-announcement-text">Esperando siguiente llamado...</p>\n        <p class="display-announcement-support">Consulta la pantalla para el consultorio asignado.</p>\n    '),
              n.insertAdjacentElement('beforebegin', e),
              e)
            : null;
    }
    function k(e) {
        const n = C();
        if (!(n instanceof HTMLElement)) return;
        const t = n.querySelector('.display-announcement-text'),
            a = n.querySelector('.display-announcement-support');
        if (!(t instanceof HTMLElement)) return;
        if (!e) {
            (n.classList.add('is-idle'),
                n.classList.remove('is-live'),
                delete n.dataset.consultorio);
            const e = 'Esperando siguiente llamado...',
                i = 'Consulta la pantalla para el consultorio asignado.';
            return (
                t.textContent !== e &&
                    ((t.textContent = e),
                    c('announcement_update', { mode: 'idle' })),
                void (
                    a instanceof HTMLElement &&
                    a.textContent !== i &&
                    (a.textContent = i)
                )
            );
        }
        const i = Number(e?.assignedConsultorio || 0),
            o = 1 === i || 2 === i ? `Consultorio ${i}` : 'Recepcion',
            l = g(e?.ticketCode || '--'),
            r = `${o} · Turno ${l}`,
            s = `Paciente ${y(e?.patientInitials || '--')}: pasa con calma al ${o}.`;
        (n.classList.remove('is-idle'),
            n.classList.add('is-live'),
            (n.dataset.consultorio = String(i || '')),
            t.textContent !== r &&
                ((t.textContent = r),
                c('announcement_update', {
                    mode: 'live',
                    consultorio: i,
                    ticketCode: l,
                })),
            a instanceof HTMLElement &&
                a.textContent !== s &&
                (a.textContent = s));
    }
    function M(e) {
        const n = x();
        n && (n.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function T() {
        const e = d('displaySetupTitle'),
            n = d('displaySetupSummary'),
            t = d('displaySetupChecks');
        if (
            !(
                e instanceof HTMLElement &&
                n instanceof HTMLElement &&
                t instanceof HTMLElement
            )
        )
            return;
        const a = String(r.connectionState || 'paused'),
            i = String(r.lastConnectionMessage || 'Sincronizacion pendiente'),
            o = r.lastBellAt > 0 ? z(Date.now() - r.lastBellAt) : '',
            l = Date.parse(String(r.lastSnapshot?.savedAt || '')),
            s = Number.isFinite(l) ? z(Date.now() - l) : '',
            c = [
                {
                    label: 'Conexion y cola',
                    state:
                        'live' === a
                            ? r.lastHealthySyncAt
                                ? 'ready'
                                : 'warning'
                            : 'offline' === a
                              ? 'danger'
                              : 'warning',
                    detail:
                        'live' === a
                            ? r.lastHealthySyncAt
                                ? `Panel en vivo (${j()}).`
                                : 'Conectado, pero esperando una sincronizacion saludable.'
                            : i,
                },
                {
                    label: 'Audio del TV',
                    state: r.bellPrimed ? 'ready' : 'warning',
                    detail: r.bellPrimed
                        ? 'Audio desbloqueado para WebView/navegador.'
                        : 'Toca "Probar campanilla" una vez para habilitar audio en la TCL C655.',
                },
                {
                    label: 'Campanilla',
                    state: r.bellMuted
                        ? 'warning'
                        : 'played' === r.lastBellOutcome
                          ? 'ready'
                          : 'blocked' === r.lastBellOutcome
                            ? 'danger'
                            : 'warning',
                    detail: r.bellMuted
                        ? 'Esta en silencio. Reactivala antes de operar la sala.'
                        : 'played' === r.lastBellOutcome
                          ? `Prueba sonora confirmada${o ? ` · hace ${o}` : ''}.`
                          : 'blocked' === r.lastBellOutcome
                            ? 'El audio fue bloqueado. Repite la prueba sonora en la TV.'
                            : 'Todavia no hay prueba sonora confirmada.',
                },
                {
                    label: 'Respaldo local',
                    state: Number.isFinite(l) ? 'ready' : 'warning',
                    detail: Number.isFinite(l)
                        ? `Ultimo respaldo local ${s} de antiguedad.`
                        : 'Aun sin snapshot local para contingencia.',
                },
            ];
        let u = 'Finaliza la puesta en marcha',
            p =
                'Confirma conexion, audio y campanilla antes de dejar la TV en operacion continua.';
        ('offline' === a
            ? ((u = 'Sala TV en contingencia'),
              (p =
                  'La TV puede seguir mostrando respaldo local, pero el enlace con la cola no esta disponible.'))
            : r.bellMuted
              ? ((u = 'Campanilla en silencio'),
                (p =
                    'La campanilla esta apagada. Reactivala antes de iniciar llamados reales.'))
              : 'blocked' !== r.lastBellOutcome && r.bellPrimed
                ? 'played' !== r.lastBellOutcome || r.lastBellAt <= 0
                    ? ((u = 'Falta probar la campanilla'),
                      (p =
                          'Ejecuta "Probar campanilla" y confirma sonido en sala antes de abrir pacientes.'))
                    : 'live' === a &&
                      r.lastHealthySyncAt &&
                      ((u = 'Sala TV lista para llamados'),
                      (p =
                          'La cola esta en vivo, la campanilla ya respondio y la TV tiene respaldo local para contingencia.'))
                : ((u = 'Falta habilitar audio'),
                  (p =
                      'Haz una prueba sonora en la TCL C655 para desbloquear audio y confirmar volumen.')),
            (e.textContent = u),
            (n.textContent = p),
            (t.innerHTML = c
                .map(
                    (e) =>
                        `\n                <article class="display-setup-check" data-state="${f(e.state)}" role="listitem">\n                    <strong>${f(e.label)}</strong>\n                    <span>${f(e.detail)}</span>\n                </article>\n            `
                )
                .join('')),
            (function (e = 'state_change') {
                m().notify(e);
            })('setup_status'));
    }
    function E() {
        let e = d('displayMetrics');
        if (e instanceof HTMLElement) return e;
        const n = C();
        return n instanceof HTMLElement
            ? (A(),
              (e = document.createElement('section')),
              (e.id = 'displayMetrics'),
              (e.className = 'display-metrics'),
              e.setAttribute('aria-live', 'polite'),
              (e.innerHTML =
                  '\n        <span class="display-metric-chip" data-kind="waiting">\n            En cola\n            <strong data-metric="waiting">0</strong>\n        </span>\n        <span class="display-metric-chip" data-kind="active">\n            Llamando\n            <strong data-metric="active">0</strong>\n        </span>\n        <span class="display-metric-chip" data-kind="next">\n            Siguientes\n            <strong data-metric="next">0</strong>\n        </span>\n    '),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function L(e, n, t) {
        if (!(e instanceof HTMLElement)) return;
        const a = e.querySelector(`[data-metric="${n}"]`);
        if (!(a instanceof HTMLElement)) return;
        const i = String(Math.max(0, Number(t || 0)));
        a.textContent !== i && (a.textContent = i);
    }
    function B() {
        let e = d('displayManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const n = document.querySelector('.display-clock-wrap');
        return n
            ? ((e = document.createElement('button')),
              (e.id = 'displayManualRefreshBtn'),
              (e.type = 'button'),
              (e.className = 'display-control-btn'),
              (e.textContent = 'Refrescar panel'),
              e.setAttribute(
                  'aria-label',
                  'Refrescar estado de turnos en pantalla'
              ),
              n.appendChild(e),
              e)
            : null;
    }
    function N(e) {
        const n = B();
        n instanceof HTMLButtonElement &&
            ((n.disabled = Boolean(e)),
            (n.textContent = e ? 'Refrescando...' : 'Refrescar panel'));
    }
    function $() {
        let e = d('displayBellToggleBtn');
        if (e instanceof HTMLButtonElement) return e;
        const n = document.querySelector('.display-clock-wrap');
        return n
            ? ((e = document.createElement('button')),
              (e.id = 'displayBellToggleBtn'),
              (e.type = 'button'),
              (e.className = 'display-control-btn display-control-btn-muted'),
              e.setAttribute('aria-label', 'Alternar campanilla de llamados'),
              n.appendChild(e),
              e)
            : null;
    }
    function I() {
        const e = $();
        e instanceof HTMLButtonElement &&
            ((e.textContent = r.bellMuted
                ? 'Campanilla: Off'
                : 'Campanilla: On'),
            (e.dataset.state = r.bellMuted ? 'muted' : 'enabled'),
            e.setAttribute('aria-pressed', String(r.bellMuted)),
            (e.title = r.bellMuted
                ? 'Campanilla en silencio'
                : 'Campanilla activa'),
            T());
    }
    function H() {
        !(function (e, { announce: n = !1 } = {}) {
            ((r.bellMuted = Boolean(e)),
                localStorage.setItem(t, r.bellMuted ? '1' : '0'),
                I(),
                c('bell_muted_changed', { muted: r.bellMuted, announce: n }),
                n &&
                    M(
                        r.bellMuted
                            ? 'Campanilla en silencio. Puedes reactivarla con Alt+Shift+M.'
                            : 'Campanilla activa para nuevos llamados.'
                    ));
        })(!r.bellMuted, { announce: !0 });
    }
    function _(e) {
        const n = S(e);
        return {
            updatedAt: String(n.updatedAt || new Date().toISOString()),
            waitingCount: Number(n.waitingCount || 0),
            calledCount: Number(n.calledCount || 0),
            callingNow: Array.isArray(n.callingNow) ? n.callingNow : [],
            nextTickets: Array.isArray(n.nextTickets) ? n.nextTickets : [],
        };
    }
    function D(e, { mode: n = 'restore' } = {}) {
        if (!e?.data) return !1;
        G(e.data);
        const t = Math.max(0, Date.now() - Date.parse(String(e.savedAt || ''))),
            a = z(t);
        return (
            w('reconnecting', 'Respaldo local activo'),
            M(
                'startup' === n
                    ? `Mostrando respaldo local (${a}) mientras conecta.`
                    : `Sin backend. Mostrando ultimo estado local (${a}).`
            ),
            c('snapshot_restored', { mode: n, ageMs: t }),
            !0
        );
    }
    function R() {
        let e = d('displaySnapshotHint');
        if (e instanceof HTMLElement) return e;
        const n = x();
        return n?.parentElement
            ? ((e = document.createElement('span')),
              (e.id = 'displaySnapshotHint'),
              (e.className = 'display-updated-at'),
              (e.textContent = 'Respaldo: sin datos locales'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function O() {
        const e = R();
        if (!(e instanceof HTMLElement)) return;
        if (!r.lastSnapshot?.savedAt)
            return ((e.textContent = 'Respaldo: sin datos locales'), void T());
        const n = Date.parse(String(r.lastSnapshot.savedAt || ''));
        if (!Number.isFinite(n))
            return ((e.textContent = 'Respaldo: sin datos locales'), void T());
        ((e.textContent = `Respaldo: ${z(Date.now() - n)} de antiguedad`), T());
    }
    function P({ announce: e = !1 } = {}) {
        ((r.lastSnapshot = null), (r.lastRenderedSignature = ''));
        try {
            localStorage.removeItem(a);
        } catch (e) {}
        (O(),
            'live' !== r.connectionState &&
                ((function (e = 'No hay turnos pendientes.') {
                    ((r.lastRenderedSignature = ''),
                        (r.lastCalledSignature = ''),
                        (r.callBaselineReady = !0),
                        F('displayConsultorio1', null, 'Consultorio 1'),
                        F('displayConsultorio2', null, 'Consultorio 2'),
                        k(null));
                    const n = d('displayNextList');
                    n &&
                        (n.innerHTML = `<li class="display-empty">${f(e)}</li>`);
                })('Sin respaldo local disponible.'),
                !1 === navigator.onLine
                    ? w('offline', 'Sin conexion')
                    : w('reconnecting', 'Sin respaldo local')),
            e &&
                M(
                    'Respaldo local limpiado. Esperando datos en vivo del backend.'
                ),
            c('snapshot_cleared', { announce: e }));
    }
    function z(e) {
        const n = Math.max(0, Number(e || 0)),
            t = Math.round(n / 1e3);
        if (t < 60) return `${t}s`;
        const a = Math.floor(t / 60),
            i = t % 60;
        return i <= 0 ? `${a}m` : `${a}m ${i}s`;
    }
    function j() {
        return r.lastHealthySyncAt
            ? `hace ${z(Date.now() - r.lastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function F(e, n, t) {
        const a = d(e);
        if (!a) return;
        if (!n)
            return void (a.innerHTML = `\n            <article class="display-called-card is-empty">\n                <h3>${t}</h3>\n                <p>Sin llamado activo</p>\n            </article>\n        `);
        const i = Date.parse(String(n.calledAt || '')),
            o =
                Number.isFinite(i) && Date.now() - i <= 8e3
                    ? 'display-called-card is-live is-fresh'
                    : 'display-called-card is-live';
        a.innerHTML = `\n        <article class="${o}">\n            <h3>${t}</h3>\n            <strong>${f(n.ticketCode || '--')}</strong>\n            <span>${f(n.patientInitials || '--')}</span>\n        </article>\n    `;
    }
    function q(e) {
        return e
            ? new Set(
                  String(e)
                      .split('|')
                      .map((e) => e.trim())
                      .filter(Boolean)
              )
            : new Set();
    }
    function V() {
        (r.bellFlashId &&
            (window.clearTimeout(r.bellFlashId), (r.bellFlashId = 0)),
            document.body.classList.remove(l));
        const e = d('displayAnnouncement');
        e instanceof HTMLElement && e.classList.remove('is-bell');
    }
    async function U({ source: e = 'unknown' } = {}) {
        try {
            r.audioContext ||
                (r.audioContext = new (
                    window.AudioContext || window.webkitAudioContext
                )());
            const n = r.audioContext;
            return (
                'suspended' === n.state && (await n.resume()),
                (r.bellPrimed = 'running' === n.state),
                c('bell_audio_primed', { source: e, running: r.bellPrimed }),
                T(),
                r.bellPrimed
            );
        } catch (n) {
            return (
                (r.bellPrimed = !1),
                c('bell_audio_primed', { source: e, running: !1 }),
                T(),
                !1
            );
        }
    }
    function J() {
        const e = Date.now();
        (r.lastBellBlockedHintAt > 0 && e - r.lastBellBlockedHintAt < 2e4) ||
            ((r.lastBellBlockedHintAt = e),
            (r.lastBellOutcome = 'blocked'),
            T(),
            M(
                'Audio bloqueado por navegador. Toca "Probar campanilla" una vez para habilitar sonido.'
            ));
    }
    async function W({ source: e = 'new_call', force: n = !1 } = {}) {
        if (
            ((function () {
                const e = document.body;
                if (!(e instanceof HTMLElement)) return;
                (V(), e.offsetWidth, e.classList.add(l));
                const n = d('displayAnnouncement');
                (n instanceof HTMLElement && n.classList.add('is-bell'),
                    (r.bellFlashId = window.setTimeout(() => {
                        V();
                    }, 1300)));
            })(),
            r.bellMuted && !n)
        )
            return;
        const t = Date.now();
        if (!(!n && r.lastBellAt > 0 && t - r.lastBellAt < 1200))
            try {
                if (!(await U({ source: e })))
                    return ((r.lastBellSource = e), void J());
                const n = r.audioContext,
                    t = n.currentTime,
                    a = n.createOscillator(),
                    i = n.createGain();
                ((a.type = 'sine'),
                    a.frequency.setValueAtTime(932, t),
                    i.gain.setValueAtTime(1e-4, t),
                    i.gain.exponentialRampToValueAtTime(0.16, t + 0.02),
                    i.gain.exponentialRampToValueAtTime(1e-4, t + 0.22),
                    a.connect(i),
                    i.connect(n.destination),
                    a.start(t),
                    a.stop(t + 0.24),
                    (r.lastBellAt = Date.now()),
                    (r.lastBellSource = e),
                    (r.lastBellOutcome = 'played'),
                    T(),
                    c('bell_played', { source: e, muted: r.bellMuted }));
            } catch (n) {
                ((r.lastBellSource = e), J());
            }
    }
    function G(e) {
        const n = S(e),
            t = (function (e) {
                const n = S(e),
                    t = Array.isArray(n.callingNow)
                        ? n.callingNow.map((e) => ({
                              id: Number(e?.id || 0),
                              ticketCode: String(e?.ticketCode || ''),
                              patientInitials: String(e?.patientInitials || ''),
                              consultorio: Number(e?.assignedConsultorio || 0),
                              calledAt: String(e?.calledAt || ''),
                          }))
                        : [],
                    a = Array.isArray(n.nextTickets)
                        ? n.nextTickets
                              .slice(0, 8)
                              .map((e) => ({
                                  id: Number(e?.id || 0),
                                  ticketCode: String(e?.ticketCode || ''),
                                  patientInitials: String(
                                      e?.patientInitials || ''
                                  ),
                                  position: Number(e?.position || 0),
                              }))
                        : [],
                    i = String(n.updatedAt || '');
                return JSON.stringify({
                    updatedAt: i,
                    callingNow: t,
                    nextTickets: a,
                });
            })(n),
            a = t === r.lastRenderedSignature,
            i = Array.isArray(n.callingNow) ? n.callingNow : [],
            o = { 1: null, 2: null };
        for (const e of i) {
            const n = Number(e?.assignedConsultorio || 0);
            (1 !== n && 2 !== n) || (o[n] = e);
        }
        const l = (function (e, n) {
            const t = Array.isArray(e) ? e.filter(Boolean) : [];
            if (0 === t.length) return null;
            let a = t[0],
                i = Number.NEGATIVE_INFINITY;
            for (const e of t) {
                const n = Date.parse(String(e?.calledAt || ''));
                Number.isFinite(n) && n >= i && ((i = n), (a = e));
            }
            return Number.isFinite(i) ? a : n[1] || n[2] || a;
        })(i, o);
        (a ||
            (F('displayConsultorio1', o[1], 'Consultorio 1'),
            F('displayConsultorio2', o[2], 'Consultorio 2'),
            (function (e) {
                const n = d('displayNextList');
                n &&
                    (Array.isArray(e) && 0 !== e.length
                        ? (n.innerHTML = e
                              .slice(0, 8)
                              .map(
                                  (e) =>
                                      `\n                <li>\n                    <span class="next-code">${f(e.ticketCode || '--')}</span>\n                    <span class="next-initials">${f(e.patientInitials || '--')}</span>\n                    <span class="next-position">#${f(e.position || '-')}</span>\n                </li>\n            `
                              )
                              .join(''))
                        : (n.innerHTML =
                              '<li class="display-empty">No hay turnos pendientes.</li>'));
            })(n?.nextTickets || []),
            (function (e) {
                const n = d('displayUpdatedAt');
                if (!n) return;
                const t = S(e),
                    a = Date.parse(String(t.updatedAt || ''));
                Number.isFinite(a)
                    ? (n.textContent = `Actualizado ${new Date(a).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
                    : (n.textContent = 'Actualizacion pendiente');
            })(n),
            (r.lastRenderedSignature = t),
            c('render_update', {
                callingNowCount: i.length,
                nextCount: Array.isArray(n?.nextTickets)
                    ? n.nextTickets.length
                    : 0,
            })),
            k(l),
            (function (e) {
                const n = E();
                if (!(n instanceof HTMLElement)) return;
                const t = S(e),
                    a = Number(t.waitingCount || 0),
                    i = Array.isArray(t.callingNow) ? t.callingNow.length : 0,
                    o = Array.isArray(t.nextTickets) ? t.nextTickets.length : 0;
                (L(n, 'waiting', a), L(n, 'active', i), L(n, 'next', o));
            })(n));
        const s = (function (e) {
            return Array.isArray(e) && 0 !== e.length
                ? e
                      .map((e) => {
                          const n = String(e.assignedConsultorio || '-'),
                              t = Number(e.id || 0),
                              a = g(e.ticketCode || '--');
                          return `${n}:${t > 0 ? `id-${t}` : `code-${a}`}`;
                      })
                      .sort()
                      .join('|')
                : '';
        })(i);
        if (!r.callBaselineReady)
            return (
                (r.lastCalledSignature = s),
                void (r.callBaselineReady = !0)
            );
        if (s !== r.lastCalledSignature) {
            const e = q(r.lastCalledSignature),
                n = q(s),
                t = [];
            for (const a of n) e.has(a) || t.push(a);
            (t.length > 0 && W({ source: 'new_call' }),
                c('called_signature_changed', {
                    signature: s,
                    added_count: t.length,
                }));
        }
        r.lastCalledSignature = s;
    }
    function Z() {
        const e = Math.max(0, Number(r.failureStreak || 0)),
            n = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, n);
    }
    function K() {
        r.pollingId && (window.clearTimeout(r.pollingId), (r.pollingId = 0));
    }
    function Y({ immediate: e = !1 } = {}) {
        if ((K(), !r.pollingEnabled)) return;
        const n = e ? 0 : Z();
        r.pollingId = window.setTimeout(() => {
            X();
        }, n);
    }
    async function Q() {
        if (r.refreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        r.refreshBusy = !0;
        try {
            const e = S(
                (
                    await (async function () {
                        const e = new URLSearchParams();
                        (e.set('resource', 'queue-state'),
                            e.set('t', String(Date.now())));
                        const n = await fetch(`/api.php?${e.toString()}`, {
                                method: 'GET',
                                credentials: 'same-origin',
                                headers: { Accept: 'application/json' },
                            }),
                            t = await n.text();
                        let a;
                        try {
                            a = t ? JSON.parse(t) : {};
                        } catch (e) {
                            throw new Error('Respuesta JSON invalida');
                        }
                        if (!n.ok || !1 === a.ok)
                            throw new Error(a.error || `HTTP ${n.status}`);
                        return a;
                    })()
                ).data || {}
            );
            (G(e),
                (function (e) {
                    const n = _(e),
                        t = { savedAt: new Date().toISOString(), data: n };
                    r.lastSnapshot = t;
                    try {
                        localStorage.setItem(a, JSON.stringify(t));
                    } catch (e) {}
                    O();
                })(e));
            const n = (function (e) {
                const n = S(e),
                    t = Date.parse(String(n.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const a = Math.max(0, Date.now() - t);
                return { stale: a >= 3e4, missingTimestamp: !1, ageMs: a };
            })(e);
            return {
                ok: !0,
                stale: Boolean(n.stale),
                missingTimestamp: Boolean(n.missingTimestamp),
                ageMs: n.ageMs,
                usedSnapshot: !1,
            };
        } catch (e) {
            const n = D(r.lastSnapshot, { mode: 'restore' });
            if (!n) {
                const n = d('displayNextList');
                n &&
                    (n.innerHTML = `<li class="display-empty">Sin conexion: ${f(e.message)}</li>`);
            }
            return {
                ok: !1,
                stale: !1,
                reason: 'fetch_error',
                errorMessage: e.message,
                usedSnapshot: n,
            };
        } finally {
            r.refreshBusy = !1;
        }
    }
    async function X() {
        if (!r.pollingEnabled) return;
        if (document.hidden)
            return (
                w('paused', 'En pausa (pestana oculta)'),
                M('Pantalla en pausa por pestana oculta.'),
                void Y()
            );
        if (!1 === navigator.onLine)
            return (
                (r.failureStreak += 1),
                D(r.lastSnapshot, { mode: 'restore' }) ||
                    (w('offline', 'Sin conexion'),
                    M(
                        'Sin conexion. Mantener llamado por voz desde recepcion hasta recuperar enlace.'
                    )),
                void Y()
            );
        const e = await Q();
        if (e.ok && !e.stale)
            ((r.failureStreak = 0),
                (r.lastHealthySyncAt = Date.now()),
                w('live', 'Conectado'),
                M(`Panel estable (${j()}).`));
        else if (e.ok && e.stale) {
            r.failureStreak += 1;
            const n = z(e.ageMs || 0);
            (w('reconnecting', `Watchdog: datos estancados ${n}`),
                M(`Datos estancados ${n}. Verifica fuente de cola.`));
        } else {
            if (((r.failureStreak += 1), e.usedSnapshot)) return void Y();
            const n = Math.max(1, Math.ceil(Z() / 1e3));
            (w('reconnecting', `Reconectando en ${n}s`),
                M(`Conexion inestable. Reintento automatico en ${n}s.`));
        }
        Y();
    }
    async function ee() {
        if (!r.manualRefreshBusy) {
            ((r.manualRefreshBusy = !0),
                N(!0),
                w('reconnecting', 'Refrescando panel...'));
            try {
                const e = await Q();
                if (e.ok && !e.stale)
                    return (
                        (r.failureStreak = 0),
                        (r.lastHealthySyncAt = Date.now()),
                        w('live', 'Conectado'),
                        void M(`Sincronizacion manual exitosa (${j()}).`)
                    );
                if (e.ok && e.stale) {
                    const n = z(e.ageMs || 0);
                    return (
                        w('reconnecting', `Watchdog: datos estancados ${n}`),
                        void M(`Persisten datos estancados (${n}).`)
                    );
                }
                if (e.usedSnapshot) return;
                const n = Math.max(1, Math.ceil(Z() / 1e3));
                (w(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion'
                        : `Reconectando en ${n}s`
                ),
                    M(
                        !1 === navigator.onLine
                            ? 'Sin internet. Llamado manual temporal.'
                            : `Refresh manual sin exito. Reintento automatico en ${n}s.`
                    ));
            } finally {
                ((r.manualRefreshBusy = !1), N(!1));
            }
        }
    }
    function ne({ immediate: e = !0 } = {}) {
        if (((r.pollingEnabled = !0), e))
            return (w('live', 'Sincronizando...'), void X());
        Y();
    }
    function te({ reason: e = 'paused' } = {}) {
        ((r.pollingEnabled = !1), (r.failureStreak = 0), K());
        const n = String(e || 'paused').toLowerCase();
        return 'offline' === n
            ? (w('offline', 'Sin conexion'),
              void M('Sin conexion. Mantener protocolo manual de llamados.'))
            : 'hidden' === n
              ? (w('paused', 'En pausa (pestana oculta)'),
                void M('Pantalla oculta. Reanuda al volver al frente.'))
              : (w('paused', 'En pausa'), void M('Sincronizacion pausada.'));
    }
    function ae() {
        const e = d('displayClock');
        e &&
            (e.textContent = new Date().toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
            }));
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((document.body.dataset.displayMode = 'star'),
            A(),
            (function () {
                const e = localStorage.getItem(t);
                r.bellMuted = '1' === e;
            })(),
            (function () {
                r.lastSnapshot = null;
                try {
                    const e = localStorage.getItem(a);
                    if (!e) return (O(), null);
                    const n = JSON.parse(e);
                    if (!n || 'object' != typeof n) return (O(), null);
                    const t = Date.parse(String(n.savedAt || ''));
                    if (!Number.isFinite(t)) return (O(), null);
                    if (Date.now() - t > 216e5) return (O(), null);
                    const i = _(n.data || {}),
                        o = { savedAt: new Date(t).toISOString(), data: i };
                    return ((r.lastSnapshot = o), O(), o);
                } catch (e) {
                    return (O(), null);
                }
            })(),
            ae(),
            (r.clockId = window.setInterval(ae, 1e3)),
            x(),
            R(),
            C(),
            E());
        const e = B();
        e instanceof HTMLButtonElement &&
            e.addEventListener('click', () => {
                ee();
            });
        const n = $();
        n instanceof HTMLButtonElement &&
            n.addEventListener('click', () => {
                H();
            });
        const i = (function () {
            let e = d('displayBellTestBtn');
            if (e instanceof HTMLButtonElement) return e;
            const n = document.querySelector('.display-clock-wrap');
            return n
                ? ((e = document.createElement('button')),
                  (e.id = 'displayBellTestBtn'),
                  (e.type = 'button'),
                  (e.className =
                      'display-control-btn display-control-btn-muted'),
                  (e.textContent = 'Probar campanilla'),
                  e.setAttribute('aria-label', 'Probar campanilla de llamados'),
                  n.appendChild(e),
                  e)
                : null;
        })();
        i instanceof HTMLButtonElement &&
            i.addEventListener('click', () => {
                (W({ source: 'manual_test', force: !0 }),
                    M(
                        'Campanilla de prueba ejecutada. Si no escuchas sonido, revisa audio del equipo/TV.'
                    ));
            });
        const o = (function () {
            let e = d('displaySnapshotClearBtn');
            if (e instanceof HTMLButtonElement) return e;
            const n = document.querySelector('.display-clock-wrap');
            return n
                ? ((e = document.createElement('button')),
                  (e.id = 'displaySnapshotClearBtn'),
                  (e.type = 'button'),
                  (e.className =
                      'display-control-btn display-control-btn-muted'),
                  (e.textContent = 'Limpiar respaldo'),
                  e.setAttribute(
                      'aria-label',
                      'Limpiar respaldo local del panel'
                  ),
                  n.appendChild(e),
                  e)
                : null;
        })();
        (o instanceof HTMLButtonElement &&
            o.addEventListener('click', () => {
                P({ announce: !0 });
            }),
            I(),
            O(),
            T(),
            m().start({ immediate: !1 }),
            w('paused', 'Sincronizacion lista'),
            D(r.lastSnapshot, { mode: 'startup' }) ||
                M('Esperando primera sincronizacion...'));
        const l = () => {
            U({ source: 'user_gesture' });
        };
        (window.addEventListener('pointerdown', l, { once: !0 }),
            window.addEventListener('keydown', l, { once: !0 }),
            ne({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? te({ reason: 'hidden' })
                    : ne({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                ne({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                te({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                (te({ reason: 'paused' }),
                    s?.stop(),
                    r.clockId &&
                        (window.clearInterval(r.clockId), (r.clockId = 0)));
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const n = String(e.code || '').toLowerCase();
                return 'keyr' === n
                    ? (e.preventDefault(), void ee())
                    : 'keym' === n
                      ? (e.preventDefault(), void H())
                      : 'keyb' === n
                        ? (e.preventDefault(),
                          W({ source: 'shortcut_test', force: !0 }),
                          void M('Campanilla de prueba ejecutada con teclado.'))
                        : void (
                              'keyx' === n &&
                              (e.preventDefault(), P({ announce: !0 }))
                          );
            }));
    });
})();
