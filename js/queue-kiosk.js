!(function () {
    'use strict';
    function e(e) {
        if (
            'object' == typeof crypto &&
            crypto &&
            'function' == typeof crypto.randomUUID
        )
            return `${e}-${crypto.randomUUID()}`;
        const t = Math.random().toString(36).slice(2, 10);
        return `${e}-${Date.now().toString(36)}-${t}`;
    }
    function t(e, t, n, i) {
        const a = 'function' == typeof n && n() ? n() : {},
            o = a.details && 'object' == typeof a.details ? a.details : {};
        return {
            surface: e,
            deviceId: t,
            instance: String(a.instance || 'main'),
            deviceLabel: String(a.deviceLabel || ''),
            appMode: String(a.appMode || 'web'),
            route:
                String(a.route || '').trim() ||
                `${window.location.pathname}${window.location.search}`,
            status: String(a.status || 'warning'),
            summary: String(a.summary || ''),
            networkOnline:
                'boolean' == typeof a.networkOnline
                    ? a.networkOnline
                    : !1 !== navigator.onLine,
            lastEvent: String(a.lastEvent || i || 'heartbeat'),
            lastEventAt: String(a.lastEventAt || new Date().toISOString()),
            details: o,
        };
    }
    const n = Object.freeze({
        schema: 'turnero-clinic-profile/v1',
        clinic_id: 'default-clinic',
        branding: {
            name: 'Piel en Armonia',
            short_name: 'Piel en Armonia',
            city: 'Quito',
            base_url: '',
        },
        consultorios: {
            c1: { label: 'Consultorio 1', short_label: 'C1' },
            c2: { label: 'Consultorio 2', short_label: 'C2' },
        },
        surfaces: {
            admin: {
                enabled: !0,
                label: 'Admin web',
                route: '/admin.html#queue',
            },
            operator: {
                enabled: !0,
                label: 'Operador web',
                route: '/operador-turnos.html',
            },
            kiosk: {
                enabled: !0,
                label: 'Kiosco web',
                route: '/kiosco-turnos.html',
            },
            display: {
                enabled: !0,
                label: 'Sala web',
                route: '/sala-turnos.html',
            },
        },
        release: {
            mode: 'web_pilot',
            admin_mode_default: 'basic',
            separate_deploy: !0,
            native_apps_blocking: !1,
            notes: [],
        },
    });
    let i = null;
    function a(e, t = '') {
        return String(e ?? '').trim() || t;
    }
    function o(e) {
        const t = e && 'object' == typeof e ? e : {},
            i = t.branding && 'object' == typeof t.branding ? t.branding : {},
            o =
                t.consultorios && 'object' == typeof t.consultorios
                    ? t.consultorios
                    : {},
            r = t.surfaces && 'object' == typeof t.surfaces ? t.surfaces : {},
            s = t.release && 'object' == typeof t.release ? t.release : {};
        return {
            schema: a(t.schema, n.schema),
            clinic_id: a(t.clinic_id, n.clinic_id),
            branding: {
                name: a(i.name, n.branding.name),
                short_name: a(i.short_name, a(i.name, n.branding.short_name)),
                city: a(i.city, n.branding.city),
                base_url: a(i.base_url, n.branding.base_url),
            },
            consultorios: {
                c1: {
                    label: a(o?.c1?.label, n.consultorios.c1.label),
                    short_label: a(
                        o?.c1?.short_label,
                        n.consultorios.c1.short_label
                    ),
                },
                c2: {
                    label: a(o?.c2?.label, n.consultorios.c2.label),
                    short_label: a(
                        o?.c2?.short_label,
                        n.consultorios.c2.short_label
                    ),
                },
            },
            surfaces: {
                admin: {
                    enabled:
                        'boolean' != typeof r?.admin?.enabled ||
                        r.admin.enabled,
                    label: a(r?.admin?.label, n.surfaces.admin.label),
                    route: a(r?.admin?.route, n.surfaces.admin.route),
                },
                operator: {
                    enabled:
                        'boolean' != typeof r?.operator?.enabled ||
                        r.operator.enabled,
                    label: a(r?.operator?.label, n.surfaces.operator.label),
                    route: a(r?.operator?.route, n.surfaces.operator.route),
                },
                kiosk: {
                    enabled:
                        'boolean' != typeof r?.kiosk?.enabled ||
                        r.kiosk.enabled,
                    label: a(r?.kiosk?.label, n.surfaces.kiosk.label),
                    route: a(r?.kiosk?.route, n.surfaces.kiosk.route),
                },
                display: {
                    enabled:
                        'boolean' != typeof r?.display?.enabled ||
                        r.display.enabled,
                    label: a(r?.display?.label, n.surfaces.display.label),
                    route: a(r?.display?.route, n.surfaces.display.route),
                },
            },
            release: {
                mode: a(s.mode, n.release.mode),
                admin_mode_default:
                    'expert' ===
                    a(s.admin_mode_default, n.release.admin_mode_default)
                        ? 'expert'
                        : 'basic',
                separate_deploy:
                    'boolean' != typeof s.separate_deploy || s.separate_deploy,
                native_apps_blocking:
                    'boolean' == typeof s.native_apps_blocking &&
                    s.native_apps_blocking,
                notes: Array.isArray(s.notes)
                    ? s.notes.map((e) => a(e)).filter(Boolean)
                    : [],
            },
        };
    }
    function r(e) {
        return a(e?.branding?.name, n.branding.name);
    }
    function s(e) {
        return a(e?.branding?.short_name, r(e));
    }
    function c(e) {
        const t = o(e);
        return (function (e) {
            let t = 2166136261;
            for (let n = 0; n < e.length; n += 1)
                ((t ^= e.charCodeAt(n)), (t = Math.imul(t, 16777619)));
            return (t >>> 0).toString(16).padStart(8, '0');
        })(
            [
                t.clinic_id,
                t.branding.base_url,
                t.consultorios.c1.label,
                t.consultorios.c1.short_label,
                t.consultorios.c2.label,
                t.consultorios.c2.short_label,
                t.surfaces.admin.enabled ? '1' : '0',
                t.surfaces.admin.route,
                t.surfaces.operator.enabled ? '1' : '0',
                t.surfaces.operator.route,
                t.surfaces.kiosk.enabled ? '1' : '0',
                t.surfaces.kiosk.route,
                t.surfaces.display.enabled ? '1' : '0',
                t.surfaces.display.route,
                t.release.mode,
                t.release.admin_mode_default,
                t.release.separate_deploy ? '1' : '0',
                t.release.native_apps_blocking ? '1' : '0',
            ].join('|')
        );
    }
    function l(e) {
        const t = a(e);
        if (!t) return '';
        try {
            const e = new URL(t, 'https://turnero.local');
            return `${e.pathname}${e.hash || ''}` || '/';
        } catch (e) {
            return t;
        }
    }
    const u = 'turnero-clinic-storage/v1';
    function d(e) {
        if ('string' != typeof e || !e.trim()) return null;
        try {
            const t = JSON.parse(e);
            if (!t || 'object' != typeof t || Array.isArray(t)) return null;
            if (
                t.values &&
                'object' == typeof t.values &&
                !Array.isArray(t.values)
            )
                return {
                    schema: String(t.schema || '').trim() || u,
                    values: t.values,
                };
        } catch (e) {
            return null;
        }
        return null;
    }
    function p(e) {
        const t = o(e);
        return String(t?.clinic_id || '').trim() || 'default-clinic';
    }
    function m(e, t, n = {}) {
        const i =
                'function' == typeof n.normalizeValue
                    ? n.normalizeValue
                    : (e) => e,
            a = Object.prototype.hasOwnProperty.call(n, 'fallbackValue')
                ? n.fallbackValue
                : null,
            o = p(t);
        try {
            const t = localStorage.getItem(String(e || ''));
            if (null === t) return a;
            const n = d(t);
            return n
                ? Object.prototype.hasOwnProperty.call(n.values, o)
                    ? i(n.values[o], a)
                    : a
                : i(t, a);
        } catch (e) {
            return a;
        }
    }
    function f(e, t, n) {
        const i = p(t),
            a = String(e || '');
        if (!a) return !1;
        try {
            const e = d(localStorage.getItem(a)) || { schema: u, values: {} };
            return (
                (e.values[i] = n),
                localStorage.setItem(a, JSON.stringify(e)),
                !0
            );
        } catch (e) {
            return !1;
        }
    }
    const g = 'queueKioskSeniorMode',
        k = 9e5,
        b = 'queueKioskOfflineOutbox',
        h = 'queueKioskPrinterState',
        y = 'kioskStarInlineStyles',
        v = {
            queueState: null,
            chatHistory: [],
            assistantBusy: !1,
            assistantSessionId: '',
            assistantMetrics: {
                intents: {},
                helpReasons: {},
                resolvedWithoutHuman: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                actioned: 0,
                lastIntent: '',
                lastLatencyMs: 0,
                latencyTotalMs: 0,
                latencySamples: 0,
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
            clinicProfile: null,
        };
    let S = null;
    function w(e, t = !1) {
        return (
            !0 === e ||
            1 === e ||
            '1' === e ||
            'true' === e ||
            (!1 !== e && 0 !== e && '0' !== e && 'false' !== e && Boolean(t))
        );
    }
    function _(e) {
        const t = (function (e) {
            if (!e) return null;
            if ('object' == typeof e) return e;
            if ('string' != typeof e || !e.trim()) return null;
            try {
                const t = JSON.parse(e);
                return t && 'object' == typeof t ? t : null;
            } catch (e) {
                return null;
            }
        })(e);
        return !t || Array.isArray(t)
            ? null
            : {
                  ok: Boolean(t.ok),
                  printed: Boolean(t.printed),
                  errorCode: String(t.errorCode || ''),
                  message: String(t.message || ''),
                  at: String(t.at || new Date().toISOString()),
              };
    }
    function q(e) {
        let t = e;
        if ('string' == typeof e)
            try {
                t = JSON.parse(e);
            } catch (e) {
                t = null;
            }
        return Array.isArray(t)
            ? t
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
                      queuedAt: String(e?.queuedAt || new Date().toISOString()),
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
                      fingerprint: e.fingerprint || $e(e.resource, e.body),
                  }))
                  .slice(0, 25)
            : [];
    }
    function x(e = 'runtime') {
        const t = String(e || 'runtime').trim() || 'runtime';
        try {
            if (
                'undefined' != typeof window &&
                window.crypto &&
                'function' == typeof window.crypto.randomUUID
            )
                return `${t}_${window.crypto.randomUUID()}`;
        } catch (e) {}
        return `${t}_${Date.now()}_${Math.floor(1e5 * Math.random())}`;
    }
    function M(e, t = {}) {
        try {
            window.dispatchEvent(
                new CustomEvent('piel:queue-ops', {
                    detail: {
                        surface: 'kiosk',
                        event: String(e || 'unknown'),
                        at: new Date().toISOString(),
                        ...t,
                    },
                })
            );
        } catch (e) {}
    }
    function L(e) {
        return String(e || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function T(e) {
        return document.getElementById(e);
    }
    function C(e) {
        return (function (e, t, i = {}) {
            const o = Boolean(i.short),
                r = 2 === Number(t || 0) ? 'c2' : 'c1',
                s = n.consultorios[r],
                c =
                    e?.consultorios && 'object' == typeof e.consultorios
                        ? e.consultorios[r]
                        : null;
            return o ? a(c?.short_label, s.short_label) : a(c?.label, s.label);
        })(v.clinicProfile, e);
    }
    function E(e = v.clinicProfile) {
        return (function (e, t, i = {}) {
            const r = o(e),
                u = (function (e) {
                    return {
                        source:
                            'fallback_default' ===
                            String(e?.runtime_meta?.source || 'remote')
                                .trim()
                                .toLowerCase()
                                ? 'fallback_default'
                                : 'remote',
                        profileFingerprint: String(
                            e?.runtime_meta?.profileFingerprint || c(e)
                        ).trim(),
                    };
                })(e),
                d = String(t).trim().toLowerCase(),
                p = r.surfaces[d] || n.surfaces.operator,
                m = !1 !== p.enabled,
                f = l(p.route),
                g = (function (e = {}) {
                    return a(e.currentRoute)
                        ? l(e.currentRoute)
                        : 'undefined' != typeof window &&
                            window.location &&
                            'string' == typeof window.location.pathname
                          ? l(
                                `${window.location.pathname || ''}${window.location.hash || ''}`
                            )
                          : '';
                })(i),
                k = '' === f || '' === g || f === g;
            return m
                ? 'remote' !== u.source
                    ? {
                          surface: d,
                          enabled: m,
                          expectedRoute: f,
                          currentRoute: g,
                          routeMatches: k,
                          state: 'alert',
                          label: p.label,
                          detail: 'No se pudo cargar clinic-profile.json; la superficie quedó con perfil de respaldo y no puede operar como piloto.',
                          reason: 'profile_missing',
                      }
                    : k
                      ? {
                            surface: d,
                            enabled: m,
                            expectedRoute: f,
                            currentRoute: g,
                            routeMatches: k,
                            state: 'ready',
                            label: p.label,
                            detail: `Ruta canónica verificada: ${f || g || 'sin ruta'}.`,
                            reason: 'ready',
                        }
                      : {
                            surface: d,
                            enabled: m,
                            expectedRoute: f,
                            currentRoute: g,
                            routeMatches: k,
                            state: 'alert',
                            label: p.label,
                            detail: `La ruta activa (${g || 'sin ruta'}) no coincide con la canónica (${f || 'sin ruta declarada'}).`,
                            reason: 'route_mismatch',
                        }
                : {
                      surface: d,
                      enabled: m,
                      expectedRoute: f,
                      currentRoute: g,
                      routeMatches: !1,
                      state: 'alert',
                      label: p.label,
                      detail: `${p.label} está deshabilitada en el perfil de ${s(r)}.`,
                      reason: 'disabled',
                  };
        })(e, 'kiosk');
    }
    function I() {
        const e = (function () {
            const e = E();
            return 'alert' !== e.state
                ? ''
                : 'profile_missing' === e.reason
                  ? 'No se puede operar este kiosco: clinic-profile.json remoto ausente. Corrige el perfil y recarga la página antes de recibir pacientes.'
                  : `No se puede operar este kiosco: la ruta no coincide con el canon del piloto (${e.expectedRoute || '/kiosco-turnos.html'}). Abre la ruta correcta antes de registrar turnos.`;
        })();
        return (
            !!e &&
            (te(e, 'error'),
            B(
                'Este equipo queda bloqueado hasta cargar el perfil remoto correcto y la ruta canónica del piloto.',
                'warn'
            ),
            !0)
        );
    }
    function A() {
        const e = String(v.lastConnectionState || 'paused'),
            t = Number(v.offlineOutbox.length || 0),
            n = v.printerState,
            i = Boolean(n?.printed),
            a = String(n?.errorCode || ''),
            o = Boolean(v.queueLastHealthySyncAt),
            r = E(),
            s = String(v.clinicProfile?.clinic_id || '').trim(),
            l = String(
                v.clinicProfile?.branding?.name ||
                    v.clinicProfile?.branding?.short_name ||
                    ''
            ).trim(),
            u = c(v.clinicProfile),
            d = String(
                v.clinicProfile?.runtime_meta?.source || 'remote'
            ).trim(),
            p = (function () {
                const e = v.assistantMetrics || {};
                return {
                    sessionId: Z(),
                    actioned: Math.max(0, Number(e.actioned || 0)),
                    resolvedWithoutHuman: Math.max(
                        0,
                        Number(e.resolvedWithoutHuman || 0)
                    ),
                    escalated: Math.max(0, Number(e.escalated || 0)),
                    clinicalBlocked: Math.max(
                        0,
                        Number(e.clinicalBlocked || 0)
                    ),
                    fallback: Math.max(0, Number(e.fallback || 0)),
                    errors: Math.max(0, Number(e.errors || 0)),
                    lastIntent: String(e.lastIntent || '').trim(),
                    lastLatencyMs: Math.max(0, Number(e.lastLatencyMs || 0)),
                    latencyTotalMs: Math.max(0, Number(e.latencyTotalMs || 0)),
                    latencySamples: Math.max(0, Number(e.latencySamples || 0)),
                    intents: $(e.intents),
                    helpReasons: $(e.helpReasons),
                };
            })();
        let m = 'warning',
            f = 'Kiosco pendiente de validación.';
        return (
            'alert' === r.state
                ? ((m = 'alert'), (f = r.detail))
                : 'offline' === e
                  ? ((m = 'alert'),
                    (f =
                        'Kiosco sin conexión; usa contingencia local y deriva si crece la fila.'))
                  : t > 0
                    ? ((m = 'warning'),
                      (f = `Kiosco con ${t} pendiente(s) offline por sincronizar.`))
                    : n && !i
                      ? ((m = 'alert'),
                        (f = `La última impresión falló${a ? ` (${a})` : ''}.`))
                      : i && o && 'live' === e
                        ? ((m = 'ready'),
                          (f =
                              'Kiosco listo: cola en vivo, térmica validada y sin pendientes offline.'))
                        : i ||
                          ((m = 'warning'),
                          (f =
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
                status: m,
                summary: f,
                networkOnline: !1 !== navigator.onLine,
                lastEvent: i ? 'printer_ok' : 'heartbeat',
                lastEventAt: n?.at || new Date().toISOString(),
                details: {
                    connection: e,
                    pendingOffline: t,
                    printerPrinted: i,
                    printerErrorCode: a,
                    healthySync: o,
                    flow: String(v.selectedFlow || 'checkin'),
                    clinicId: s,
                    clinicName: l,
                    profileSource: d,
                    profileFingerprint: u,
                    surfaceContractState: String(r.state || ''),
                    surfaceRouteExpected: String(r.expectedRoute || ''),
                    surfaceRouteCurrent: String(r.currentRoute || ''),
                    assistantSessionId: p.sessionId,
                    assistantActioned: p.actioned,
                    assistantResolvedWithoutHuman: p.resolvedWithoutHuman,
                    assistantEscalated: p.escalated,
                    assistantClinicalBlocked: p.clinicalBlocked,
                    assistantFallback: p.fallback,
                    assistantErrors: p.errors,
                    assistantLastIntent: p.lastIntent,
                    assistantLastLatencyMs: p.lastLatencyMs,
                    assistantLatencyTotalMs: p.latencyTotalMs,
                    assistantLatencySamples: p.latencySamples,
                    assistantIntents: p.intents,
                    assistantHelpReasons: p.helpReasons,
                },
            }
        );
    }
    function H() {
        return (
            S ||
            ((S = (function ({
                surface: n,
                intervalMs: i = 15e3,
                getPayload: a,
            } = {}) {
                const o = (function (e) {
                        const t = String(e || '')
                            .trim()
                            .toLowerCase();
                        return 'sala_tv' === t ? 'display' : t || 'operator';
                    })(n),
                    r = (function (t) {
                        const n = `queueSurfaceDeviceIdV1:${t}`;
                        try {
                            const i = localStorage.getItem(n);
                            if (i) return i;
                            const a = e(t);
                            return (localStorage.setItem(n, a), a);
                        } catch (n) {
                            return e(t);
                        }
                    })(o),
                    s = Math.max(5e3, Number(i || 15e3));
                let c = 0,
                    l = !1,
                    u = 0,
                    d = !1;
                async function p(e = 'interval', { keepalive: n = !1 } = {}) {
                    if (l) return !1;
                    l = !0;
                    try {
                        return (
                            !!(
                                await fetch(
                                    `/api.php?resource=${encodeURIComponent('queue-surface-heartbeat')}`,
                                    {
                                        method: 'POST',
                                        credentials: 'same-origin',
                                        keepalive: n,
                                        headers: {
                                            Accept: 'application/json',
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify(t(o, r, a, e)),
                                    }
                                )
                            ).ok && ((u = Date.now()), !0)
                        );
                    } catch (e) {
                        return !1;
                    } finally {
                        l = !1;
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
                function k() {
                    (c && (window.clearInterval(c), (c = 0)),
                        d &&
                            ((d = !1),
                            document.removeEventListener('visibilitychange', m),
                            window.removeEventListener('online', f),
                            window.removeEventListener('beforeunload', g)));
                }
                return {
                    start: function ({ immediate: e = !0 } = {}) {
                        (k(),
                            d ||
                                ((d = !0),
                                document.addEventListener(
                                    'visibilitychange',
                                    m
                                ),
                                window.addEventListener('online', f),
                                window.addEventListener('beforeunload', g)),
                            e && p('boot'),
                            (c = window.setInterval(() => {
                                'hidden' !== document.visibilityState &&
                                    p('interval');
                            }, s)));
                    },
                    stop: k,
                    notify: function (e = 'state_change') {
                        Date.now() - u < 4e3 || p(e);
                    },
                    beatNow: (e = 'manual') => p(e),
                    getDeviceId: () => r,
                };
            })({ surface: 'kiosk', intervalMs: 15e3, getPayload: A })),
            S)
        );
    }
    function $(e) {
        return e && 'object' == typeof e
            ? Object.entries(e).reduce((e, [t, n]) => {
                  const i = String(t || '')
                          .trim()
                          .toLowerCase(),
                      a = Math.max(0, Number(n || 0));
                  return (
                      !i ||
                          !Number.isFinite(a) ||
                          a <= 0 ||
                          (e[i] = Math.round(a)),
                      e
                  );
              }, {})
            : {};
    }
    function B(e, t = 'info') {
        const n = T('kioskProgressHint');
        if (!(n instanceof HTMLElement)) return;
        const i = ['info', 'warn', 'success'].includes(
                String(t || '').toLowerCase()
            )
                ? String(t || '').toLowerCase()
                : 'info',
            a =
                String(e || '').trim() ||
                'Paso 1 de 2: selecciona una opcion para comenzar.';
        ((n.dataset.tone = i), (n.textContent = a));
    }
    function O(e, t = 'info') {
        const n = T('kioskSeniorHint');
        if (!(n instanceof HTMLElement)) return;
        const i = ['info', 'warn', 'success'].includes(
            String(t || '').toLowerCase()
        )
            ? String(t || '').toLowerCase()
            : 'info';
        ((n.dataset.tone = i),
            (n.textContent =
                String(e || '').trim() ||
                'Si necesitas letra mas grande, usa "Modo lectura grande".'));
    }
    function N(e, { persist: t = !0, source: n = 'ui' } = {}) {
        const i = Boolean(e);
        ((v.seniorMode = i),
            (document.body.dataset.kioskSenior = i ? 'on' : 'off'),
            (function () {
                const e = T('kioskSeniorToggle');
                if (!(e instanceof HTMLButtonElement)) return;
                const t = Boolean(v.seniorMode);
                ((e.dataset.active = t ? 'true' : 'false'),
                    e.setAttribute('aria-pressed', String(t)),
                    (e.textContent =
                        'Modo lectura grande: ' + (t ? 'On' : 'Off')));
            })(),
            t &&
                (function (e) {
                    f(g, v.clinicProfile, e ? '1' : '0');
                })(i),
            O(
                i
                    ? 'Modo lectura grande activo. Botones y textos ampliados.'
                    : 'Modo lectura grande desactivado.',
                i ? 'success' : 'info'
            ),
            M('senior_mode_changed', { enabled: i, source: n }));
    }
    function R({ source: e = 'ui' } = {}) {
        N(!v.seniorMode, { persist: !0, source: e });
    }
    function z() {
        return (
            'undefined' != typeof window &&
            'speechSynthesis' in window &&
            'function' == typeof window.speechSynthesis?.speak &&
            'function' == typeof window.SpeechSynthesisUtterance
        );
    }
    function P() {
        const e = T('kioskVoiceGuideBtn');
        if (!(e instanceof HTMLButtonElement)) return;
        const t = Boolean(v.voiceGuideSupported),
            n = Boolean(v.voiceGuideBusy);
        ((e.disabled = !t && !n),
            (e.textContent = t
                ? n
                    ? 'Leyendo instrucciones...'
                    : 'Leer instrucciones'
                : 'Voz guia no disponible'));
    }
    function D({ source: e = 'manual' } = {}) {
        if (!z())
            return (
                (v.voiceGuideBusy = !1),
                (v.voiceGuideUtterance = null),
                void P()
            );
        try {
            window.speechSynthesis.cancel();
        } catch (e) {}
        ((v.voiceGuideBusy = !1),
            (v.voiceGuideUtterance = null),
            P(),
            M('voice_guide_stopped', { source: e }));
    }
    function j({ source: e = 'button' } = {}) {
        if (!v.voiceGuideSupported)
            return (
                te(
                    'Guia por voz no disponible en este navegador. Usa ayuda rapida en pantalla.',
                    'info'
                ),
                O(
                    'Sin voz guia en este equipo. Usa ayuda rapida o pide apoyo.',
                    'warn'
                ),
                void M('voice_guide_unavailable', { source: e })
            );
        D({ source: 'restart' });
        const t = (function () {
            const e =
                'walkin' === v.selectedFlow
                    ? 'Si no tienes cita, escribe iniciales y pulsa Generar turno.'
                    : 'Si tienes cita, escribe telefono, fecha y hora y pulsa Confirmar check in.';
            return `Bienvenida al kiosco de turnos de ${r(v.clinicProfile)}. ${e} Si necesitas ayuda, pulsa Necesito apoyo y recepcion te asistira. Conserva tu ticket y espera el llamado en la pantalla de sala.`;
        })();
        let n;
        try {
            n = new window.SpeechSynthesisUtterance(t);
        } catch (t) {
            return (
                te('No se pudo iniciar guia por voz en este equipo.', 'error'),
                void M('voice_guide_error', {
                    source: e,
                    reason: 'utterance_create_failed',
                })
            );
        }
        ((n.lang = 'es-EC'),
            (n.rate = 0.92),
            (n.pitch = 1),
            (n.onstart = () => {
                ((v.voiceGuideBusy = !0), P());
            }),
            (n.onend = () => {
                ((v.voiceGuideBusy = !1),
                    (v.voiceGuideUtterance = null),
                    P(),
                    M('voice_guide_finished', { source: e }));
            }),
            (n.onerror = () => {
                ((v.voiceGuideBusy = !1),
                    (v.voiceGuideUtterance = null),
                    P(),
                    te(
                        'La guia por voz se interrumpio. Puedes intentar nuevamente.',
                        'error'
                    ),
                    M('voice_guide_error', {
                        source: e,
                        reason: 'speech_error',
                    }));
            }));
        try {
            ((v.voiceGuideUtterance = n),
                (v.voiceGuideBusy = !0),
                P(),
                window.speechSynthesis.speak(n),
                te('Guia por voz iniciada.', 'info'),
                O(
                    'Escuchando guia por voz. Puedes seguir los pasos en pantalla.',
                    'success'
                ),
                M('voice_guide_started', { source: e }));
        } catch (t) {
            ((v.voiceGuideBusy = !1),
                (v.voiceGuideUtterance = null),
                P(),
                te('No se pudo reproducir guia por voz.', 'error'),
                M('voice_guide_error', {
                    source: e,
                    reason: 'speech_start_failed',
                }));
        }
    }
    async function F({
        source: e = 'button',
        reason: t = 'general',
        message: n = '',
        intent: i = '',
        announceInAssistant: a = !0,
    } = {}) {
        const o = (function (e, t, n, i = '') {
                const a = v.lastIssuedTicket,
                    o = T('checkinPhone'),
                    r = T('checkinDate'),
                    s = T('checkinTime'),
                    c =
                        o instanceof HTMLInputElement
                            ? String(o.value || '').replace(/\D/g, '')
                            : '',
                    l = String(a?.phoneLast4 || '').trim() || c.slice(-4),
                    u =
                        r instanceof HTMLInputElement
                            ? String(r.value || '').trim()
                            : '',
                    d =
                        s instanceof HTMLInputElement
                            ? String(s.value || '').trim()
                            : '';
                return {
                    source: String(n || 'kiosk'),
                    reason: String(e || 'general'),
                    message: String(t || '').trim(),
                    intent: String(i || '').trim(),
                    sessionId: Z(),
                    ticketId: Number(a?.id || 0) || void 0,
                    ticketCode: String(a?.ticketCode || ''),
                    patientInitials: ee(),
                    context: {
                        selectedFlow: String(v.selectedFlow || 'checkin'),
                        waitingCount: Number(v.queueState?.waitingCount || 0),
                        estimatedWaitMin: Number(
                            v.queueState?.estimatedWaitMin || 0
                        ),
                        offlinePending: Number(v.offlineOutbox.length || 0),
                        appointmentId: Number(a?.appointmentId || 0) || 0,
                        patientCaseId: String(a?.patientCaseId || '').trim(),
                        phoneLast4: l || '',
                        requestedDate: u,
                        requestedTime: d,
                    },
                };
            })(t, n, e, i),
            r = (function (e) {
                const t = String(e || 'general').toLowerCase();
                return 'clinical_redirect' === t
                    ? 'Recepcion fue alertada para derivarte con el personal adecuado.'
                    : 'lost_ticket' === t
                      ? 'Recepcion revisara tu ticket y te ayudara a retomar la fila.'
                      : 'printer_issue' === t || 'reprint_requested' === t
                        ? 'Recepcion revisara la impresion o reimpresion de tu ticket enseguida.'
                        : 'appointment_not_found' === t
                          ? 'Recepcion revisara tu cita y te ayudara a continuar.'
                          : 'ticket_duplicate' === t
                            ? 'Recepcion revisara el ticket duplicado para dejar un solo turno activo.'
                            : 'special_priority' === t
                              ? 'Recepcion fue alertada para darte apoyo prioritario.'
                              : 'late_arrival' === t
                                ? 'Recepcion revisara tu llegada tarde y te indicara el siguiente paso.'
                                : 'offline_pending' === t
                                  ? 'Recepcion revisara el pendiente offline y te ayudara a continuar.'
                                  : 'no_phone' === t
                                    ? 'Recepcion te ayudara a completar el proceso sin celular.'
                                    : 'schedule_taken' === t
                                      ? 'Recepcion revisara la disponibilidad y te ayudara a continuar.'
                                      : 'accessibility' === t
                                        ? 'Recepcion te brindara apoyo para completar el proceso.'
                                        : 'Recepcion te ayudara enseguida. Mantente frente al kiosco o acude al mostrador.';
            })(t);
        try {
            const n = await Y('queue-help-request', {
                    method: 'POST',
                    body: o,
                }),
                i =
                    n?.data?.helpRequest &&
                    'object' == typeof n.data.helpRequest
                        ? n.data.helpRequest
                        : null;
            return (
                (v.lastHelpRequest = i),
                Q(n),
                te(r, 'info'),
                B(
                    'Apoyo solicitado: recepcion te asistira para completar el turno.',
                    'warn'
                ),
                a && ze('bot', r),
                M('reception_support_requested', {
                    source: e,
                    reason: t,
                    requestId: i?.id || 0,
                }),
                { ok: !0, queued: !1, message: r, helpRequest: i }
            );
        } catch (n) {
            if (!He(n)) {
                const i = `No se pudo solicitar apoyo: ${n.message}`;
                return (
                    te(i, 'error'),
                    M('reception_support_error', {
                        source: e,
                        reason: t,
                        error: String(n?.message || ''),
                    }),
                    { ok: !1, queued: !1, message: i, helpRequest: null }
                );
            }
            const i = Be({
                resource: 'queue-help-request',
                body: o,
                originLabel: 'Apoyo a recepcion',
                patientInitials: o.patientInitials,
                queueType: 'support',
                renderMode: 'support',
            });
            return (
                (v.lastHelpRequest = i),
                te(
                    'Apoyo guardado offline. Se notificara a recepcion al recuperar conexion.',
                    'info'
                ),
                B(
                    'Apoyo pendiente de sincronizacion: si es urgente, acude al mostrador.',
                    'warn'
                ),
                a &&
                    ze(
                        'bot',
                        'Apoyo guardado offline. Se notificara a recepcion al recuperar conexion.'
                    ),
                M('reception_support_queued', {
                    source: e,
                    reason: t,
                    pendingAfter: v.offlineOutbox.length,
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
    function G(e, { source: t = 'ui' } = {}) {
        const n = T('kioskQuickHelpPanel'),
            i = T('kioskHelpToggle');
        if (!(n instanceof HTMLElement && i instanceof HTMLButtonElement))
            return;
        const a = Boolean(e);
        ((v.quickHelpOpen = a),
            (n.hidden = !a),
            (i.dataset.open = a ? 'true' : 'false'),
            i.setAttribute('aria-expanded', String(a)),
            M('quick_help_toggled', { open: a, source: t }),
            B(
                a
                    ? 'Guia abierta: elige opcion, completa datos y confirma ticket.'
                    : 'Paso 1 de 2: selecciona una opcion para comenzar.',
                'info'
            ));
    }
    function U(e, { announce: t = !0 } = {}) {
        const n =
            'walkin' === String(e || '').toLowerCase() ? 'walkin' : 'checkin';
        v.selectedFlow = n;
        const i = T('checkinForm'),
            a = T('walkinForm');
        (i instanceof HTMLElement &&
            i.classList.toggle('is-flow-active', 'checkin' === n),
            a instanceof HTMLElement &&
                a.classList.toggle('is-flow-active', 'walkin' === n));
        const o = T('kioskQuickCheckin'),
            r = T('kioskQuickWalkin');
        if (o instanceof HTMLButtonElement) {
            const e = 'checkin' === n;
            ((o.dataset.active = e ? 'true' : 'false'),
                o.setAttribute('aria-pressed', String(e)));
        }
        if (r instanceof HTMLButtonElement) {
            const e = 'walkin' === n;
            ((r.dataset.active = e ? 'true' : 'false'),
                r.setAttribute('aria-pressed', String(e)));
        }
        const s = T('walkin' === n ? 'walkinInitials' : 'checkinPhone');
        (s instanceof HTMLInputElement && s.focus({ preventScroll: !1 }),
            t &&
                B(
                    'walkin' === n
                        ? 'Paso 2: escribe iniciales y pulsa "Generar turno".'
                        : 'Paso 2: escribe telefono, fecha y hora para check-in.',
                    'info'
                ),
            M('flow_focus', { target: n }));
    }
    function W(e, t) {
        if (!e || 'object' != typeof e || !Array.isArray(t)) return [];
        for (const n of t) if (n && Array.isArray(e[n])) return e[n];
        return [];
    }
    function K(e, t) {
        if (!e || 'object' != typeof e || !Array.isArray(t)) return null;
        for (const n of t) {
            if (!n) continue;
            const t = e[n];
            if (t && 'object' == typeof t && !Array.isArray(t)) return t;
        }
        return null;
    }
    function V(e, t, n = 0) {
        if (!e || 'object' != typeof e || !Array.isArray(t))
            return Number(n || 0);
        for (const n of t) {
            if (!n) continue;
            const t = Number(e[n]);
            if (Number.isFinite(t)) return t;
        }
        return Number(n || 0);
    }
    function J(e) {
        const t = e && 'object' == typeof e ? e : {},
            n = K(t, ['counts']) || {},
            i = V(t, ['waitingCount', 'waiting_count'], Number.NaN),
            a = V(t, ['calledCount', 'called_count'], Number.NaN);
        let o = W(t, [
            'callingNow',
            'calling_now',
            'calledTickets',
            'called_tickets',
        ]);
        if (0 === o.length) {
            const e = K(t, [
                'callingNowByConsultorio',
                'calling_now_by_consultorio',
            ]);
            e && (o = Object.values(e).filter(Boolean));
        }
        const r = W(t, [
                'nextTickets',
                'next_tickets',
                'waitingTickets',
                'waiting_tickets',
            ]),
            s = W(t, ['activeHelpRequests', 'active_help_requests']),
            c = Number.isFinite(i)
                ? i
                : V(n, ['waiting', 'waiting_count'], r.length),
            l = Number.isFinite(a)
                ? a
                : V(n, ['called', 'called_count'], o.length),
            u = Math.max(
                0,
                V(t, ['estimatedWaitMin', 'estimated_wait_min'], 8 * c)
            ),
            d = Math.max(
                0,
                V(
                    t,
                    ['assistancePendingCount', 'assistance_pending_count'],
                    s.length
                )
            );
        return {
            updatedAt:
                String(t.updatedAt || t.updated_at || '').trim() ||
                new Date().toISOString(),
            waitingCount: Math.max(0, Number(c || 0)),
            calledCount: Math.max(0, Number(l || 0)),
            estimatedWaitMin: u,
            delayReason: String(t.delayReason || t.delay_reason || '').trim(),
            assistancePendingCount: d,
            callingNow: Array.isArray(o)
                ? o.map((e) => ({
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
                ? r.map((e, t) => ({
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
                                  8 * (t + 1)
                          ) || 0
                      ),
                      position:
                          Number(e?.position || 0) > 0
                              ? Number(e.position)
                              : t + 1,
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
    function Q(e) {
        const t = e?.data?.queueState || e?.queueState || e?.data || e;
        if (!t || 'object' != typeof t) return null;
        const n = J(t);
        return (
            (v.queueState = n),
            (function (e) {
                const t = J(e),
                    n = T('queueWaitingCount'),
                    i = T('queueCalledCount'),
                    a = T('queueCallingNow'),
                    o = T('queueNextList');
                if (
                    (n && (n.textContent = String(t.waitingCount || 0)),
                    i && (i.textContent = String(t.calledCount || 0)),
                    a)
                ) {
                    const e = Array.isArray(t.callingNow) ? t.callingNow : [];
                    0 === e.length
                        ? (a.innerHTML =
                              '<p class="queue-empty">Sin llamados activos.</p>')
                        : (a.innerHTML = e
                              .map(
                                  (e) =>
                                      `\n                        <article class="queue-called-card">\n                            <header>${L(C(e.assignedConsultorio))}</header>\n                            <strong>${L(e.ticketCode || '--')}</strong>\n                            <span>${L(e.patientInitials || '--')}</span>\n                        </article>\n                    `
                              )
                              .join(''));
                }
                if (o) {
                    const e = Array.isArray(t.nextTickets) ? t.nextTickets : [];
                    0 === e.length
                        ? (o.innerHTML =
                              '<li class="queue-empty">No hay turnos en espera.</li>')
                        : (o.innerHTML = e
                              .map(
                                  (e) =>
                                      `\n                        <li>\n                            <span class="ticket-code">${L(e.ticketCode || '--')}</span>\n                            <span class="ticket-meta">${L(e.patientInitials || '--')}</span>\n                            <span class="ticket-position">#${L(e.position || '-')}</span>\n                        </li>\n                    `
                              )
                              .join(''));
                }
            })(n),
            Me(n.updatedAt),
            n
        );
    }
    async function Y(e, { method: t = 'GET', body: n } = {}) {
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
        let r;
        try {
            r = o ? JSON.parse(o) : {};
        } catch (e) {
            throw new Error('Respuesta invalida del servidor');
        }
        if (!a.ok || !1 === r.ok)
            throw new Error(r.error || `HTTP ${a.status}`);
        return r;
    }
    function Z() {
        return (
            v.assistantSessionId || (v.assistantSessionId = x('assistant')),
            v.assistantSessionId
        );
    }
    function X(e, t, n, i = {}) {
        const a = String(e || 'unknown').trim() || 'unknown',
            o = String(t || 'unknown').trim() || 'unknown',
            r = Math.max(
                0,
                Math.round(performance.now() - Number(n || performance.now()))
            ),
            s = v.assistantMetrics || {
                intents: {},
                helpReasons: {},
                resolvedWithoutHuman: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                actioned: 0,
                lastIntent: '',
                lastLatencyMs: 0,
                latencyTotalMs: 0,
                latencySamples: 0,
            };
        ((s.intents = s.intents || {}),
            (s.helpReasons = s.helpReasons || {}),
            (s.intents[a] = (s.intents[a] || 0) + 1),
            (s.lastIntent = a),
            (s.lastLatencyMs = r),
            (s.latencyTotalMs += r),
            (s.latencySamples += 1),
            (s.actioned += 1),
            'resolved' === o
                ? (s.resolvedWithoutHuman += 1)
                : 'handoff' === o
                  ? (s.escalated += 1)
                  : 'clinical_blocked' === o
                    ? (s.clinicalBlocked += 1)
                    : 'fallback' === o
                      ? (s.fallback += 1)
                      : 'error' === o && (s.errors += 1));
        const c = String(i.reason || '')
            .trim()
            .toLowerCase();
        (c && (s.helpReasons[c] = (s.helpReasons[c] || 0) + 1),
            (v.assistantMetrics = s),
            H().beatNow('assistant_metric'),
            M('assistant_metric', {
                intent: a,
                outcome: o,
                latencyMs: r,
                ...i,
            }));
    }
    function ee() {
        if (v.lastIssuedTicket?.patientInitials)
            return String(v.lastIssuedTicket.patientInitials || '--');
        const e = T('walkinInitials');
        if (e instanceof HTMLInputElement && String(e.value || '').trim())
            return String(e.value || '')
                .trim()
                .slice(0, 4)
                .toUpperCase();
        const t = T('checkinInitials');
        if (t instanceof HTMLInputElement && String(t.value || '').trim())
            return String(t.value || '')
                .trim()
                .slice(0, 4)
                .toUpperCase();
        const n = T('checkinPhone');
        if (n instanceof HTMLInputElement) {
            const e = String(n.value || '').replace(/\D/g, '');
            if (e) return e.slice(-2).padStart(2, '0');
        }
        return '--';
    }
    function te(e, t = 'info') {
        const n = T('kioskStatus');
        if (!n) return;
        const i = String(e || '').trim() || 'Estado operativo',
            a = String(t || 'info').toLowerCase(),
            o =
                i !== String(n.textContent || '').trim() ||
                a !== String(n.dataset.status || '').toLowerCase();
        ((n.textContent = i),
            (n.dataset.status = a),
            o && M('kiosk_status', { status: a, message: i }));
    }
    function ne(e, t) {
        const n = T('queueConnectionState');
        if (!n) return;
        const i = String(e || 'live').toLowerCase(),
            a = {
                live: 'Cola conectada',
                reconnecting: 'Reintentando conexion',
                offline: 'Sin conexion al backend',
                paused: 'Cola en pausa',
            },
            o = String(t || '').trim() || a[i] || a.live,
            r = i !== v.lastConnectionState || o !== v.lastConnectionMessage;
        ((v.lastConnectionState = i),
            (v.lastConnectionMessage = o),
            (n.dataset.state = i),
            (n.textContent = o),
            r && M('connection_state', { state: i, message: o }),
            de());
    }
    function ie() {
        const e = T('kioskSessionCountdown');
        if (!(e instanceof HTMLElement)) return;
        if (!v.idleDeadlineTs)
            return (
                (e.textContent = 'Privacidad auto: --:--'),
                void (e.dataset.state = 'normal')
            );
        const t = Math.max(0, v.idleDeadlineTs - Date.now());
        e.textContent = `Privacidad auto: ${(function (e) {
            const t = Math.max(0, Number(e || 0)),
                n = Math.ceil(t / 1e3);
            return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
        })(t)}`;
        const n = t <= 2e4;
        e.dataset.state = n ? 'warning' : 'normal';
    }
    function ae() {
        const e = T('ticketResult');
        e &&
            ((v.lastIssuedTicket = null),
            (e.innerHTML =
                '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>'));
    }
    function oe() {
        const e = T('assistantMessages');
        (e && (e.innerHTML = ''),
            (v.chatHistory = []),
            (v.lastHelpRequest = null),
            (v.assistantSessionId = x('assistant')),
            (v.assistantMetrics = {
                intents: {},
                helpReasons: {},
                resolvedWithoutHuman: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                actioned: 0,
                lastIntent: '',
                lastLatencyMs: 0,
                latencyTotalMs: 0,
                latencySamples: 0,
            }),
            ze(
                'bot',
                'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.'
            ));
        const t = T('assistantInput');
        t instanceof HTMLInputElement && (t.value = '');
    }
    function re({ durationMs: e = null } = {}) {
        const t = Math.min(
            k,
            Math.max(
                5e3,
                Math.round(
                    Number.isFinite(Number(e)) ? Number(e) : v.idleResetMs
                )
            )
        );
        (v.idleTimerId &&
            (window.clearTimeout(v.idleTimerId), (v.idleTimerId = 0)),
            v.idleTickId &&
                (window.clearInterval(v.idleTickId), (v.idleTickId = 0)),
            (v.idleDeadlineTs = Date.now() + t),
            ie(),
            (v.idleTickId = window.setInterval(() => {
                ie();
            }, 1e3)),
            (v.idleTimerId = window.setTimeout(() => {
                if (v.assistantBusy || v.queueManualRefreshBusy)
                    return (
                        te(
                            'Sesion activa. Reprogramando limpieza automatica.',
                            'info'
                        ),
                        void re({ durationMs: 15e3 })
                    );
                ce({ reason: 'idle_timeout' });
            }, t)));
    }
    function se() {
        (De({ reason: 'activity' }), re());
    }
    function ce({ reason: e = 'manual' } = {}) {
        (D({ source: 'session_reset' }),
            (function () {
                const e = T('checkinForm'),
                    t = T('walkinForm');
                (e instanceof HTMLFormElement && e.reset(),
                    t instanceof HTMLFormElement && t.reset(),
                    je());
            })(),
            oe(),
            ae(),
            G(!1, { source: 'session_reset' }),
            U('checkin', { announce: !1 }),
            te(
                'idle_timeout' === e
                    ? 'Sesion reiniciada por inactividad para proteger privacidad.'
                    : 'Pantalla limpiada. Lista para el siguiente paciente.',
                'info'
            ),
            B('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            Se(),
            re());
    }
    function le() {
        let e = T('queueOpsHint');
        if (e) return e;
        const t = document.querySelector('.kiosk-side .kiosk-card'),
            n = T('queueUpdatedAt');
        return t && n
            ? ((e = document.createElement('p')),
              (e.id = 'queueOpsHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Estado operativo: inicializando...'),
              n.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function ue(e) {
        const t = le();
        t && (t.textContent = String(e || '').trim() || 'Estado operativo');
    }
    function de() {
        const e = T('kioskSetupTitle'),
            t = T('kioskSetupSummary'),
            n = T('kioskSetupChecks');
        if (
            !(
                e instanceof HTMLElement &&
                t instanceof HTMLElement &&
                n instanceof HTMLElement
            )
        )
            return;
        const i = String(v.lastConnectionState || 'paused'),
            a = String(v.lastConnectionMessage || 'Sincronizacion pendiente'),
            o = Number(v.offlineOutbox.length || 0),
            r = v.printerState,
            s = Boolean(r?.printed),
            c = Boolean(r && !r.printed),
            l = Boolean(v.queueLastHealthySyncAt),
            u = E(),
            d = Date.parse(String(v.offlineOutbox[0]?.queuedAt || '')),
            p = Number.isFinite(d) ? qe(Date.now() - d) : '',
            m = [
                {
                    label: 'Perfil de clínica',
                    state: 'alert' === u.state ? 'danger' : 'ready',
                    detail: u.detail,
                },
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
                                ? `Backend en vivo (${xe()}).`
                                : 'Conectado, pero esperando la primera sincronizacion saludable.'
                            : a,
                },
                {
                    label: 'Impresora termica',
                    state: r ? (s ? 'ready' : 'danger') : 'warning',
                    detail: r
                        ? s
                            ? `Impresion OK · ${Ce(r.at)}`
                            : `Sin impresion (${r.errorCode || r.message || 'sin detalle'}) · ${Ce(r.at)}`
                        : 'Sin ticket de prueba todavia. Genera uno para validar papel y USB.',
                },
                {
                    label: 'Pendientes offline',
                    state:
                        o <= 0
                            ? 'ready'
                            : 'offline' === i
                              ? 'danger'
                              : 'warning',
                    detail:
                        o <= 0
                            ? 'Sin pendientes locales.'
                            : `Hay ${o} pendiente(s) por subir${p ? ` · mas antiguo ${p}` : ''}.`,
                },
                {
                    label: 'Operacion guiada',
                    state: l ? 'ready' : 'warning',
                    detail: l
                        ? 'La cola ya respondio en este arranque. Puedes abrir el kiosco al publico.'
                        : 'Mantiene el flujo abierto, pero falta una sincronizacion completa desde este arranque.',
                },
            ];
        let f = 'Finaliza la puesta en marcha',
            g =
                'Revisa backend, termica y pendientes antes de dejar el kiosco en autoservicio.';
        ('alert' === u.state
            ? ((f =
                  'profile_missing' === u.reason
                      ? 'Perfil de clínica no cargado'
                      : 'Ruta del piloto incorrecta'),
              (g = u.detail))
            : 'offline' === i
              ? ((f = 'Kiosco en contingencia'),
                (g =
                    'El kiosco puede seguir capturando datos, pero el backend no responde. Si la fila crece, deriva a recepcion.'))
              : o > 0
                ? ((f = 'Kiosco con pendientes por sincronizar'),
                  (g =
                      'Hay solicitudes guardadas offline. Manten el equipo abierto hasta que el outbox vuelva a cero.'))
                : c
                  ? ((f = 'Revisa la impresora termica'),
                    (g =
                        'El ultimo ticket no confirmo impresion. Verifica energia, papel y cable USB, y repite una prueba.'))
                  : s
                    ? 'live' === i &&
                      l &&
                      ((f = 'Kiosco listo para operar'),
                      (g =
                          'La cola esta en vivo, no hay pendientes offline y la termica ya respondio correctamente.'))
                    : ((f = 'Falta probar ticket termico'),
                      (g =
                          'Genera un turno de prueba y confirma "Impresion OK" antes de operar con pacientes.')),
            (e.textContent = f),
            (t.textContent = g),
            (n.innerHTML = m
                .map(
                    (e) =>
                        `\n                <article class="kiosk-setup-check" data-state="${L(e.state)}" role="listitem">\n                    <strong>${L(e.label)}</strong>\n                    <span>${L(e.detail)}</span>\n                </article>\n            `
                )
                .join('')),
            (function (e = 'state_change') {
                H().notify(e);
            })('setup_status'));
    }
    function pe() {
        let e = T('queueOutboxHint');
        if (e) return e;
        const t = le();
        return t?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queueOutboxHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Pendientes offline: 0'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function me(e) {
        const t = pe();
        t &&
            (t.textContent = String(e || '').trim() || 'Pendientes offline: 0');
    }
    function fe() {
        let e = T('queuePrinterHint');
        if (e) return e;
        const t = pe();
        return t?.parentElement
            ? ((e = document.createElement('p')),
              (e.id = 'queuePrinterHint'),
              (e.className = 'queue-updated-at'),
              (e.textContent = 'Impresora: estado pendiente.'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function ge() {
        const e = fe();
        if (!e) return;
        const t = v.printerState;
        if (!t)
            return (
                (e.textContent = 'Impresora: estado pendiente.'),
                void de()
            );
        const n = t.printed ? 'impresion OK' : t.errorCode || 'sin impresion',
            i = t.message ? ` (${t.message})` : '',
            a = Ce(t.at);
        ((e.textContent = `Impresora: ${n}${i} · ${a}`), de());
    }
    function ke() {
        let e = T('queueOutboxConsole');
        if (e instanceof HTMLElement) return e;
        const t = pe();
        return t?.parentElement
            ? ((e = document.createElement('section')),
              (e.id = 'queueOutboxConsole'),
              (e.className = 'queue-outbox-console'),
              (e.innerHTML =
                  '\n        <p id="queueOutboxSummary" class="queue-updated-at">Outbox: 0 pendientes</p>\n        <div class="queue-outbox-actions">\n            <button id="queueOutboxRetryBtn" type="button" class="queue-outbox-btn">Sincronizar pendientes</button>\n            <button id="queueOutboxDropOldestBtn" type="button" class="queue-outbox-btn">Descartar mas antiguo</button>\n            <button id="queueOutboxClearBtn" type="button" class="queue-outbox-btn">Limpiar pendientes</button>\n        </div>\n        <ol id="queueOutboxList" class="queue-outbox-list">\n            <li class="queue-empty">Sin pendientes offline.</li>\n        </ol>\n        <p class="queue-updated-at queue-outbox-shortcuts">Atajos: Alt+Shift+Y sincroniza pendientes, Alt+Shift+K limpia pendientes.</p>\n    '),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function be(e) {
        const t = T('queueOutboxRetryBtn'),
            n = T('queueOutboxClearBtn'),
            i = T('queueOutboxDropOldestBtn');
        (t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e) || !v.offlineOutbox.length),
            (t.textContent = e
                ? 'Sincronizando...'
                : 'Sincronizar pendientes')),
            n instanceof HTMLButtonElement &&
                (n.disabled = Boolean(e) || !v.offlineOutbox.length),
            i instanceof HTMLButtonElement &&
                (i.disabled = Boolean(e) || v.offlineOutbox.length <= 0));
    }
    function he() {
        ke();
        const e = T('queueOutboxSummary'),
            t = T('queueOutboxList'),
            n = v.offlineOutbox.length;
        (e instanceof HTMLElement &&
            (e.textContent =
                n <= 0 ? 'Outbox: 0 pendientes' : `Outbox: ${n} pendiente(s)`),
            t instanceof HTMLElement &&
                (t.innerHTML =
                    n <= 0
                        ? '<li class="queue-empty">Sin pendientes offline.</li>'
                        : v.offlineOutbox
                              .slice(0, 6)
                              .map((e, t) => {
                                  const n = Ce(e.queuedAt),
                                      i = Number(e.attempts || 0);
                                  return `<li><strong>${L(e.originLabel)}</strong> · ${L(e.patientInitials || '--')} · ${L(e.queueType || '--')} · ${L(n)} · intento ${t + 1}/${Math.max(1, i + 1)}</li>`;
                              })
                              .join('')),
            be(!1));
    }
    function ye({ reason: e = 'manual' } = {}) {
        ((v.offlineOutbox = []),
            ve(),
            Se(),
            he(),
            'manual' === e &&
                te('Pendientes offline limpiados manualmente.', 'info'));
    }
    function ve() {
        f(b, v.clinicProfile, v.offlineOutbox);
    }
    function Se() {
        const e = v.offlineOutbox.length;
        if (e <= 0)
            return (
                me('Pendientes offline: 0 (sin pendientes).'),
                he(),
                void de()
            );
        const t = Date.parse(String(v.offlineOutbox[0]?.queuedAt || ''));
        (me(
            `Pendientes offline: ${e} - sincronizacion automatica al reconectar${Number.isFinite(t) ? ` - mas antiguo ${qe(Date.now() - t)}` : ''}`
        ),
            he(),
            de());
    }
    function we() {
        let e = T('queueManualRefreshBtn');
        if (e instanceof HTMLButtonElement) return e;
        const t = T('queueUpdatedAt');
        return t?.parentElement
            ? ((e = document.createElement('button')),
              (e.id = 'queueManualRefreshBtn'),
              (e.type = 'button'),
              (e.className = 'queue-manual-refresh-btn'),
              (e.textContent = 'Reintentar sincronizacion'),
              t.insertAdjacentElement('afterend', e),
              e)
            : null;
    }
    function _e(e) {
        const t = we();
        t instanceof HTMLButtonElement &&
            ((t.disabled = Boolean(e)),
            (t.textContent = e
                ? 'Actualizando cola...'
                : 'Reintentar sincronizacion'));
    }
    function qe(e) {
        const t = Math.max(0, Number(e || 0)),
            n = Math.round(t / 1e3);
        if (n < 60) return `${n}s`;
        const i = Math.floor(n / 60),
            a = n % 60;
        return a <= 0 ? `${i}m` : `${i}m ${a}s`;
    }
    function xe() {
        return v.queueLastHealthySyncAt
            ? `hace ${qe(Date.now() - v.queueLastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function Me(e) {
        const t = T('queueUpdatedAt');
        if (!t) return;
        const n = J({ updatedAt: e }),
            i = Date.parse(String(n.updatedAt || ''));
        Number.isFinite(i)
            ? (t.textContent = `Actualizado ${new Date(i).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
            : (t.textContent = 'Actualizacion pendiente');
    }
    function Le() {
        const e = Math.max(0, Number(v.queueFailureStreak || 0)),
            t = 2500 * Math.pow(2, Math.min(e, 3));
        return Math.min(15e3, t);
    }
    function Te() {
        v.queueTimerId &&
            (window.clearTimeout(v.queueTimerId), (v.queueTimerId = 0));
    }
    function Ce(e) {
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
    async function Ee() {
        if (v.queueRefreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        v.queueRefreshBusy = !0;
        try {
            Q(await Y('queue-state'));
            const e = (function (e) {
                const t = J(e),
                    n = Date.parse(String(t.updatedAt || ''));
                if (!Number.isFinite(n))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const i = Math.max(0, Date.now() - n);
                return { stale: i >= 3e4, missingTimestamp: !1, ageMs: i };
            })(v.queueState);
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
            v.queueRefreshBusy = !1;
        }
    }
    function Ie(e, t) {
        const n = T('ticketResult');
        if (!n) return;
        const i = e?.data || {},
            a = {
                ...i,
                id: Number(i?.id || i?.ticket_id || 0) || 0,
                ticketCode: String(i?.ticketCode || i?.ticket_code || '--'),
                appointmentId:
                    Number(i?.appointmentId || i?.appointment_id || 0) || 0,
                phoneLast4: String(i?.phoneLast4 || i?.phone_last4 || ''),
                patientCaseId: String(
                    i?.patientCaseId || i?.patient_case_id || ''
                ),
                patientInitials: String(
                    i?.patientInitials || i?.patient_initials || '--'
                ),
                queueType: String(i?.queueType || i?.queue_type || 'walk_in'),
                createdAt: String(
                    i?.createdAt || i?.created_at || new Date().toISOString()
                ),
            };
        v.lastIssuedTicket = a;
        const o = e?.print || {};
        !(function (e, { origin: t = 'ticket' } = {}) {
            const n = e?.print || {};
            ((v.printerState = {
                ok: Boolean(n.ok),
                printed: Boolean(e?.printed),
                errorCode: String(n.errorCode || ''),
                message: String(n.message || ''),
                at: new Date().toISOString(),
            }),
                f(h, v.clinicProfile, v.printerState),
                ge(),
                M('printer_result', {
                    origin: t,
                    ok: v.printerState.ok,
                    printed: v.printerState.printed,
                    errorCode: v.printerState.errorCode,
                }));
        })(e, { origin: t });
        const r = Array.isArray(v.queueState?.nextTickets)
                ? v.queueState.nextTickets
                : [],
            s = r.find((e) => Number(e.id) === Number(a.id))?.position || '-',
            c = e?.printed
                ? 'Impresion enviada a termica'
                : `Ticket generado sin impresion (${L(o.message || 'sin detalle')})`;
        n.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Turno generado</h3>\n            <p class="ticket-result-origin">${L(t)}</p>\n            <div class="ticket-result-main">\n                <strong>${L(a.ticketCode || '--')}</strong>\n                <span>${L(a.patientInitials || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>#${L(s)}</dd></div>\n                <div><dt>Tipo</dt><dd>${L(a.queueType || '--')}</dd></div>\n                <div><dt>Creado</dt><dd>${L(Ce(a.createdAt))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">${c}</p>\n        </article>\n    `;
    }
    function Ae({
        originLabel: e,
        patientInitials: t,
        queueType: n,
        queuedAt: i,
    }) {
        const a = T('ticketResult');
        a &&
            (a.innerHTML = `\n        <article class="ticket-result-card">\n            <h3>Solicitud guardada offline</h3>\n            <p class="ticket-result-origin">${L(e)}</p>\n            <div class="ticket-result-main">\n                <strong>${L(`PEND-${String(v.offlineOutbox.length).padStart(2, '0')}`)}</strong>\n                <span>${L(t || '--')}</span>\n            </div>\n            <dl>\n                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>\n                <div><dt>Tipo</dt><dd>${L(n || '--')}</dd></div>\n                <div><dt>Guardado</dt><dd>${L(Ce(i))}</dd></div>\n            </dl>\n            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>\n        </article>\n    `);
    }
    function He(e) {
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
    function $e(e, t) {
        const n = String(e || '').toLowerCase(),
            i = (function (e) {
                const t = e && 'object' == typeof e ? e : {};
                return Object.keys(t)
                    .sort()
                    .reduce((e, n) => ((e[n] = t[n]), e), {});
            })(t);
        return `${n}:${JSON.stringify(i)}`;
    }
    function Be({
        resource: e,
        body: t,
        originLabel: n,
        patientInitials: i,
        queueType: a,
        renderMode: o = 'ticket',
    }) {
        const r = String(e || '');
        if (
            'queue-ticket' !== r &&
            'queue-checkin' !== r &&
            'queue-help-request' !== r
        )
            return null;
        const s = $e(r, t),
            c = Date.now(),
            l = v.offlineOutbox.find((e) => {
                if (String(e?.fingerprint || '') !== s) return !1;
                const t = Date.parse(String(e?.queuedAt || ''));
                return !!Number.isFinite(t) && c - t <= 9e4;
            });
        if (l)
            return (
                M('offline_queued_duplicate', { resource: r, fingerprint: s }),
                { ...l, deduped: !0 }
            );
        const u = {
            id: `offline_${Date.now()}_${Math.floor(1e5 * Math.random())}`,
            resource: r,
            body: t && 'object' == typeof t ? t : {},
            originLabel: String(n || 'Solicitud offline'),
            patientInitials: String(i || '--'),
            queueType: String(a || '--'),
            renderMode:
                'support' === String(o || 'ticket').toLowerCase()
                    ? 'support'
                    : 'ticket',
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: '',
            fingerprint: s,
        };
        return (
            (v.offlineOutbox = [u, ...v.offlineOutbox].slice(0, 25)),
            ve(),
            Se(),
            M('offline_queued', {
                resource: r,
                queueSize: v.offlineOutbox.length,
            }),
            u
        );
    }
    async function Oe({
        source: e = 'auto',
        force: t = !1,
        maxItems: n = 4,
    } = {}) {
        if (v.offlineOutboxFlushBusy) return;
        if (!v.offlineOutbox.length) return;
        if (!t && !1 === navigator.onLine) return;
        ((v.offlineOutboxFlushBusy = !0), be(!0));
        let i = 0;
        try {
            for (
                ;
                v.offlineOutbox.length && i < Math.max(1, Number(n || 1));
            ) {
                const e = v.offlineOutbox[0];
                try {
                    const t = await Y(e.resource, {
                        method: 'POST',
                        body: e.body,
                    });
                    if (
                        (v.offlineOutbox.shift(),
                        ve(),
                        Se(),
                        Q(t),
                        'support' === String(e.renderMode || 'ticket'))
                    ) {
                        const n =
                            t?.data?.helpRequest &&
                            'object' == typeof t.data.helpRequest
                                ? t.data.helpRequest
                                : null;
                        ((v.lastHelpRequest = n),
                            te(
                                `Apoyo sincronizado (${e.originLabel})`,
                                'success'
                            ),
                            B(
                                'Apoyo enviado a recepcion correctamente.',
                                'success'
                            ));
                    } else
                        (Ie(t, `${e.originLabel} (sincronizado)`),
                            te(
                                `Pendiente sincronizado (${e.originLabel})`,
                                'success'
                            ));
                    (M('offline_synced_item', {
                        resource: e.resource,
                        originLabel: e.originLabel,
                        pendingAfter: v.offlineOutbox.length,
                    }),
                        (i += 1));
                } catch (t) {
                    ((e.attempts = Number(e.attempts || 0) + 1),
                        (e.lastError = String(t?.message || '').slice(0, 180)),
                        (e.lastAttemptAt = new Date().toISOString()),
                        ve(),
                        Se());
                    const n = He(t);
                    (te(
                        n
                            ? 'Sincronizacion offline pendiente: esperando reconexion.'
                            : `Pendiente con error: ${t.message}`,
                        n ? 'info' : 'error'
                    ),
                        M('offline_sync_error', {
                            resource: e.resource,
                            retryingOffline: n,
                            error: String(t?.message || ''),
                        }));
                    break;
                }
            }
            i > 0 &&
                ((v.queueFailureStreak = 0),
                (await Ee()).ok &&
                    ((v.queueLastHealthySyncAt = Date.now()),
                    ne('live', 'Cola conectada'),
                    ue(`Outbox sincronizado desde ${e}. (${xe()})`),
                    M('offline_synced_batch', {
                        source: e,
                        processed: i,
                        pendingAfter: v.offlineOutbox.length,
                    })));
        } finally {
            ((v.offlineOutboxFlushBusy = !1), he());
        }
    }
    async function Ne(e) {
        if ((e.preventDefault(), se(), De({ reason: 'form_submit' }), I()))
            return;
        if (!(e.currentTarget instanceof HTMLFormElement)) return;
        const t = T('checkinPhone'),
            n = T('checkinTime'),
            i = T('checkinDate'),
            a = T('checkinInitials'),
            o = T('checkinSubmit'),
            r = t instanceof HTMLInputElement ? t.value.trim() : '',
            s = n instanceof HTMLInputElement ? n.value.trim() : '',
            c = i instanceof HTMLInputElement ? i.value.trim() : '',
            l = a instanceof HTMLInputElement ? a.value.trim() : '';
        if (!r || !s || !c)
            return (
                te(
                    'Telefono, fecha y hora son obligatorios para check-in',
                    'error'
                ),
                void B(
                    'Completa telefono, fecha y hora para continuar.',
                    'warn'
                )
            );
        o instanceof HTMLButtonElement && (o.disabled = !0);
        try {
            const e = { telefono: r, hora: s, fecha: c, patientInitials: l },
                t = await Y('queue-checkin', { method: 'POST', body: e });
            (te('Check-in registrado correctamente', 'success'),
                B(
                    'Check-in completado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                Ie(t, t.replay ? 'Check-in ya existente' : 'Check-in de cita'),
                (v.queueFailureStreak = 0),
                (await Ee()).ok ||
                    ne(
                        'reconnecting',
                        'Check-in registrado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (He(e)) {
                const e = Be({
                    resource: 'queue-checkin',
                    body: {
                        telefono: r,
                        hora: s,
                        fecha: c,
                        patientInitials: l,
                    },
                    originLabel: 'Check-in de cita',
                    patientInitials: l || r.slice(-2),
                    queueType: 'appointment',
                });
                if (e)
                    return (
                        ne('offline', 'Sin conexion al backend'),
                        ue(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        Ae({
                            originLabel: e.originLabel,
                            patientInitials: e.patientInitials,
                            queueType: e.queueType,
                            queuedAt: e.queuedAt,
                        }),
                        te(
                            e.deduped
                                ? 'Check-in ya pendiente offline. Se sincronizara automaticamente.'
                                : 'Check-in guardado offline. Se sincronizara automaticamente.',
                            'info'
                        ),
                        void B(
                            'Check-in guardado offline. Recepcion confirmara al reconectar.',
                            'warn'
                        )
                    );
            }
            (te(`No se pudo registrar el check-in: ${e.message}`, 'error'),
                B(
                    'No se pudo confirmar check-in. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            o instanceof HTMLButtonElement && (o.disabled = !1);
        }
    }
    async function Re(e) {
        if ((e.preventDefault(), se(), De({ reason: 'form_submit' }), I()))
            return;
        const t = T('walkinName'),
            n = T('walkinInitials'),
            i = T('walkinPhone'),
            a = T('walkinSubmit'),
            o = t instanceof HTMLInputElement ? t.value.trim() : '',
            r =
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
                })(o),
            s = i instanceof HTMLInputElement ? i.value.trim() : '';
        if (!r)
            return (
                te('Ingresa iniciales o nombre para generar el turno', 'error'),
                void B('Escribe iniciales para generar tu turno.', 'warn')
            );
        a instanceof HTMLButtonElement && (a.disabled = !0);
        try {
            const e = { patientInitials: r, name: o, phone: s },
                t = await Y('queue-ticket', { method: 'POST', body: e });
            (te('Turno walk-in registrado correctamente', 'success'),
                B(
                    'Turno generado. Conserva tu ticket y espera llamado.',
                    'success'
                ),
                Ie(t, 'Turno sin cita'),
                (v.queueFailureStreak = 0),
                (await Ee()).ok ||
                    ne(
                        'reconnecting',
                        'Turno creado; pendiente sincronizar cola'
                    ));
        } catch (e) {
            if (He(e)) {
                const e = Be({
                    resource: 'queue-ticket',
                    body: { patientInitials: r, name: o, phone: s },
                    originLabel: 'Turno sin cita',
                    patientInitials: r,
                    queueType: 'walk_in',
                });
                if (e)
                    return (
                        ne('offline', 'Sin conexion al backend'),
                        ue(
                            'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                        ),
                        Ae({
                            originLabel: e.originLabel,
                            patientInitials: e.patientInitials,
                            queueType: e.queueType,
                            queuedAt: e.queuedAt,
                        }),
                        te(
                            e.deduped
                                ? 'Turno ya pendiente offline. Se sincronizara automaticamente.'
                                : 'Turno guardado offline. Se sincronizara automaticamente.',
                            'info'
                        ),
                        void B(
                            'Turno guardado offline. Recepcion lo sincronizara al reconectar.',
                            'warn'
                        )
                    );
            }
            (te(`No se pudo crear el turno: ${e.message}`, 'error'),
                B(
                    'No se pudo generar turno. Intenta de nuevo o pide apoyo.',
                    'warn'
                ));
        } finally {
            a instanceof HTMLButtonElement && (a.disabled = !1);
        }
    }
    function ze(e, t) {
        const n = T('assistantMessages');
        if (!n) return;
        const i = document.createElement('article');
        ((i.className = `assistant-message assistant-message-${e}`),
            (i.innerHTML = `<p>${L(t)}</p>`),
            n.appendChild(i),
            (n.scrollTop = n.scrollHeight));
    }
    async function Pe(e) {
        if ((e.preventDefault(), se(), I())) return;
        if (v.assistantBusy) return;
        const t = T('assistantInput'),
            n = T('assistantSend');
        if (!(t instanceof HTMLInputElement)) return;
        const i = t.value.trim();
        if (!i) return;
        (ze('user', i),
            (t.value = ''),
            (v.assistantBusy = !0),
            n instanceof HTMLButtonElement && (n.disabled = !0));
        const a = performance.now();
        try {
            const e = (function (e) {
                const t = (function (e) {
                    return String(e || '')
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .trim();
                })(e);
                return t
                    ? /(diagnost|medicacion|tratamiento|receta|dosis|enfermedad|medicamento|que tomo|que crema|que me pongo)/.test(
                          t
                      )
                        ? { intent: 'clinical_blocked', normalized: t }
                        : /(perdi mi ticket|perdi el ticket|no encuentro mi ticket|extravie mi ticket)/.test(
                                t
                            )
                          ? { intent: 'lost_ticket', normalized: t }
                          : /(ticket duplicado|tengo dos tickets|me salieron dos tickets|doble ticket|ticket repetido|turno duplicado|dos turnos)/.test(
                                  t
                              )
                            ? { intent: 'ticket_duplicate', normalized: t }
                            : /(impresora|no imprimio|no salio el ticket|ticket no salio|no imprime|problema de impresion|reimprimir)/.test(
                                    t
                                )
                              ? { intent: 'printer_issue', normalized: t }
                              : /(llegue tarde|voy tarde|estoy tarde|se me hizo tarde|se paso mi hora|llegada tarde|me atrase a la cita)/.test(
                                      t
                                  )
                                ? { intent: 'late_arrival', normalized: t }
                                : /(sin internet|sin conexion|internet caido|pendiente offline|quedo offline|no hay internet|sin red)/.test(
                                        t
                                    )
                                  ? { intent: 'offline_pending', normalized: t }
                                  : /(no encuentro mi cita|mi cita no aparece|no sale mi cita|no encuentro la cita)/.test(
                                          t
                                      )
                                    ? {
                                          intent: 'appointment_not_found',
                                          normalized: t,
                                      }
                                    : /(no tengo celular|no traje celular|no traje mi celular|sin celular|sin telefono|no tengo telefono|no traje telefono|no traje mi telefono|sin movil)/.test(
                                            t
                                        )
                                      ? { intent: 'no_phone', normalized: t }
                                      : /(horario ya tomado|horario ocupado|ya se ocupo el horario|se tomo el horario|ya no hay cupo|no hay cupo en ese horario|ese horario ya esta ocupado)/.test(
                                              t
                                          )
                                        ? {
                                              intent: 'schedule_taken',
                                              normalized: t,
                                          }
                                        : /(embarazada|adulto mayor|discapacidad|movilidad reducida|prioridad especial|necesito prioridad)/.test(
                                                t
                                            )
                                          ? {
                                                intent: 'special_priority',
                                                normalized: t,
                                            }
                                          : /(acompanante|soy acompanante|vengo con alguien)/.test(
                                                  t
                                              )
                                            ? {
                                                  intent: 'companion',
                                                  normalized: t,
                                              }
                                            : /(no veo bien|no puedo leer|letra grande|accesibilidad|dificultad visual)/.test(
                                                    t
                                                )
                                              ? {
                                                    intent: 'accessibility',
                                                    normalized: t,
                                                }
                                              : /(necesito ayuda humana|necesito ayuda|quiero hablar con recepcion|llama a recepcion|apoyo humano)/.test(
                                                      t
                                                  )
                                                ? {
                                                      intent: 'human_help',
                                                      normalized: t,
                                                  }
                                                : /(no tengo cita|sin cita|quiero turno|sacar turno|turno sin cita|walk in)/.test(
                                                        t
                                                    )
                                                  ? {
                                                        intent: 'walk_in',
                                                        normalized: t,
                                                    }
                                                  : /(tengo cita|check in|checkin|vengo con cita)/.test(
                                                          t
                                                      )
                                                    ? {
                                                          intent: 'have_appointment',
                                                          normalized: t,
                                                      }
                                                    : /(donde espero|donde me siento|donde aguardo)/.test(
                                                            t
                                                        )
                                                      ? {
                                                            intent: 'where_wait',
                                                            normalized: t,
                                                        }
                                                      : /(que sigue|que hago ahora|siguiente paso|ahora que hago)/.test(
                                                              t
                                                          )
                                                        ? {
                                                              intent: 'next_step',
                                                              normalized: t,
                                                          }
                                                        : /(cuanto falta|cuanto demora|cuanto tiempo|cuanto tarda|tiempo de espera)/.test(
                                                                t
                                                            )
                                                          ? {
                                                                intent: 'wait_time',
                                                                normalized: t,
                                                            }
                                                          : null
                    : { intent: 'empty', normalized: t };
            })(i);
            if (e && 'empty' !== e.intent) {
                const t = await (async function (e, t, n) {
                    const i = String(e?.intent || 'fallback');
                    switch (i) {
                        case 'have_appointment':
                            return (
                                U('checkin'),
                                X(i, 'resolved', n, {
                                    action: 'focus_checkin',
                                }),
                                'Te llevo a Tengo cita. Escribe telefono, fecha y hora y pulsa "Confirmar check-in".'
                            );
                        case 'walk_in':
                            return (
                                U('walkin'),
                                X(i, 'resolved', n, { action: 'focus_walkin' }),
                                'Te llevo a No tengo cita. Escribe tus iniciales y pulsa "Generar turno".'
                            );
                        case 'where_wait':
                            return (
                                X(i, 'resolved', n, {
                                    action: 'waiting_room_guidance',
                                }),
                                v.lastIssuedTicket?.ticketCode
                                    ? `Espera en la sala mirando la pantalla. Cuando aparezca ${v.lastIssuedTicket.ticketCode}, acude al consultorio indicado.`
                                    : 'Espera en la sala mirando la pantalla de turnos. Cuando llamen tu codigo, acude al consultorio indicado.'
                            );
                        case 'next_step':
                            return (
                                X(i, 'resolved', n, {
                                    action: 'next_step_guidance',
                                }),
                                (function () {
                                    const e = v.lastIssuedTicket;
                                    return e?.ticketCode
                                        ? `Tu ticket ${e.ticketCode} ya esta generado. Espera mirando la pantalla de sala hasta que te llamen al consultorio indicado.`
                                        : 'walkin' === v.selectedFlow
                                          ? 'Completa tus iniciales y pulsa "Generar turno". Luego espera el llamado en la pantalla de sala.'
                                          : 'Completa telefono, fecha y hora y pulsa "Confirmar check-in". Luego espera el llamado en la pantalla de sala.';
                                })()
                            );
                        case 'wait_time':
                            return (
                                X(i, 'resolved', n, {
                                    action: 'wait_time_guidance',
                                }),
                                (function () {
                                    const e = v.queueState || {},
                                        t = Math.max(
                                            0,
                                            Number(e.waitingCount || 0)
                                        ),
                                        n = Math.max(
                                            0,
                                            Number(
                                                e.estimatedWaitMin || 8 * t || 0
                                            )
                                        ),
                                        i = String(e.delayReason || '').trim();
                                    return i
                                        ? `Ahora hay ${t} persona(s) en espera. El tiempo estimado es ${n} min. Motivo de demora: ${i}.`
                                        : `Ahora hay ${t} persona(s) en espera. El tiempo estimado es ${n} min.`;
                                })()
                            );
                        case 'companion':
                            return (
                                X(i, 'resolved', n, {
                                    action: 'companion_guidance',
                                }),
                                'Tu acompanante puede esperar contigo en la sala. Si recepcion debe validar algo adicional, te ayudaran en el mostrador.'
                            );
                        case 'human_help': {
                            const e = await F({
                                source: 'assistant',
                                reason: 'human_help',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'human_help',
                                }),
                                e.message
                            );
                        }
                        case 'lost_ticket': {
                            const e = await F({
                                source: 'assistant',
                                reason: 'lost_ticket',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'lost_ticket',
                                }),
                                v.lastIssuedTicket?.ticketCode
                                    ? `${e.message} Tu ultimo ticket registrado fue ${v.lastIssuedTicket.ticketCode}.`
                                    : e.message
                            );
                        }
                        case 'ticket_duplicate': {
                            const e = await F({
                                source: 'assistant',
                                reason: 'ticket_duplicate',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'ticket_duplicate',
                                }),
                                v.lastIssuedTicket?.ticketCode
                                    ? `${e.message} Conserva por ahora ${v.lastIssuedTicket.ticketCode} hasta que recepcion te confirme el ticket valido.`
                                    : e.message
                            );
                        }
                        case 'printer_issue': {
                            const e = await F({
                                source: 'assistant',
                                reason: 'printer_issue',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'printer_issue',
                                }),
                                e.message
                            );
                        }
                        case 'late_arrival': {
                            U('checkin');
                            const e = await F({
                                source: 'assistant',
                                reason: 'late_arrival',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'late_arrival',
                                }),
                                `${e.message} Si tienes la cita a mano, deja listos telefono, fecha y hora para validarlo con recepcion.`
                            );
                        }
                        case 'offline_pending': {
                            const e = Math.max(
                                    0,
                                    Number(v.offlineOutbox.length || 0)
                                ),
                                a = await F({
                                    source: 'assistant',
                                    reason: 'offline_pending',
                                    message: t,
                                    intent: i,
                                    announceInAssistant: !1,
                                });
                            return (
                                X(i, 'handoff', n, {
                                    queued: a.queued,
                                    reason: 'offline_pending',
                                }),
                                e > 0
                                    ? `${a.message} Este kiosco tiene ${e} pendiente(s) offline por sincronizar.`
                                    : `${a.message} Si el kiosco sigue sin conexion, recepcion continuara el registro manualmente.`
                            );
                        }
                        case 'appointment_not_found': {
                            U('checkin');
                            const e = await F({
                                source: 'assistant',
                                reason: 'appointment_not_found',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'appointment_not_found',
                                }),
                                `${e.message} Mientras tanto, revisa telefono, fecha y hora en Tengo cita.`
                            );
                        }
                        case 'no_phone': {
                            U('checkin');
                            const e = await F({
                                source: 'assistant',
                                reason: 'no_phone',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'no_phone',
                                }),
                                `${e.message} Recepcion validara tus datos presencialmente para continuar.`
                            );
                        }
                        case 'schedule_taken': {
                            const e = await F({
                                source: 'assistant',
                                reason: 'schedule_taken',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'schedule_taken',
                                }),
                                `${e.message} La reprogramacion o cambio de horario se gestiona en recepcion.`
                            );
                        }
                        case 'special_priority': {
                            const e = await F({
                                source: 'assistant',
                                reason: 'special_priority',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'special_priority',
                                }),
                                e.message
                            );
                        }
                        case 'accessibility': {
                            const e = await F({
                                source: 'assistant',
                                reason: 'accessibility',
                                message: t,
                                intent: i,
                                announceInAssistant: !1,
                            });
                            return (
                                X(i, 'handoff', n, {
                                    queued: e.queued,
                                    reason: 'accessibility',
                                }),
                                e.message
                            );
                        }
                        case 'clinical_blocked':
                            return (
                                X(i, 'clinical_blocked', n, {
                                    queued: (
                                        await F({
                                            source: 'assistant',
                                            reason: 'clinical_redirect',
                                            message: t,
                                            intent: i,
                                            announceInAssistant: !1,
                                        })
                                    ).queued,
                                    reason: 'clinical_redirect',
                                }),
                                'En este kiosco no doy orientacion medica. Recepcion ya fue alertada para derivarte con el personal adecuado.'
                            );
                        default:
                            return '';
                    }
                })(e, i, a);
                return (
                    ze('bot', t),
                    void (v.chatHistory = [
                        ...v.chatHistory,
                        { role: 'user', content: i },
                        { role: 'assistant', content: t },
                    ].slice(-8))
                );
            }
            const t = [
                    {
                        role: 'system',
                        content:
                            'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
                    },
                    ...v.chatHistory.slice(-6),
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
                        messages: t,
                        max_tokens: 180,
                        temperature: 0.2,
                    }),
                }),
                o = await n.json(),
                r = (function (e) {
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
                })(String(o?.choices?.[0]?.message?.content || '').trim());
            (X('fallback_ai', 'fallback', a, { aiSource: 'figo' }),
                ze('bot', r),
                (v.chatHistory = [
                    ...v.chatHistory,
                    { role: 'user', content: i },
                    { role: 'assistant', content: r },
                ].slice(-8)));
        } catch (e) {
            (X('fallback_ai', 'error', a, { error: String(e?.message || '') }),
                ze(
                    'bot',
                    'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
                ));
        } finally {
            ((v.assistantBusy = !1),
                n instanceof HTMLButtonElement && (n.disabled = !1));
        }
    }
    function De({ reason: e = 'auto' } = {}) {
        if (v.welcomeDismissed) return;
        v.welcomeDismissed = !0;
        const t = T('kioskWelcomeScreen');
        t instanceof HTMLElement &&
            (t.classList.add('is-hidden'),
            window.setTimeout(() => {
                t.parentElement && t.remove();
            }, 700),
            M('welcome_dismissed', { reason: e }));
    }
    function je() {
        const e = T('checkinDate');
        e instanceof HTMLInputElement &&
            !e.value &&
            (e.value = new Date().toISOString().slice(0, 10));
    }
    function Fe({ immediate: e = !1 } = {}) {
        if ((Te(), !v.queuePollingEnabled)) return;
        const t = e ? 0 : Le();
        v.queueTimerId = window.setTimeout(() => {
            Ge();
        }, t);
    }
    async function Ge() {
        if (!v.queuePollingEnabled) return;
        if (document.hidden)
            return (
                ne('paused', 'Cola en pausa (pestana oculta)'),
                ue('Pestana oculta. Turnero en pausa temporal.'),
                void Fe()
            );
        if (!1 === navigator.onLine)
            return (
                (v.queueFailureStreak += 1),
                ne('offline', 'Sin conexion al backend'),
                ue(
                    'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
                ),
                Se(),
                void Fe()
            );
        await Oe({ source: 'poll' });
        const e = await Ee();
        if (e.ok && !e.stale)
            ((v.queueFailureStreak = 0),
                (v.queueLastHealthySyncAt = Date.now()),
                ne('live', 'Cola conectada'),
                ue(
                    `Operacion estable (${xe()}). Kiosco disponible para turnos.`
                ));
        else if (e.ok && e.stale) {
            v.queueFailureStreak += 1;
            const t = qe(e.ageMs || 0);
            (ne('reconnecting', `Watchdog: cola estancada ${t}`),
                ue(
                    `Cola degradada: sin cambios en ${t}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
                ));
        } else {
            v.queueFailureStreak += 1;
            const e = Math.max(1, Math.ceil(Le() / 1e3));
            (ne('reconnecting', `Reintentando en ${e}s`),
                ue(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        (Se(), Fe());
    }
    async function Ue() {
        if (!v.queueManualRefreshBusy) {
            (se(),
                (v.queueManualRefreshBusy = !0),
                _e(!0),
                ne('reconnecting', 'Refrescando manualmente...'));
            try {
                await Oe({ source: 'manual' });
                const e = await Ee();
                if (e.ok && !e.stale)
                    return (
                        (v.queueFailureStreak = 0),
                        (v.queueLastHealthySyncAt = Date.now()),
                        ne('live', 'Cola conectada'),
                        void ue(`Sincronizacion manual exitosa (${xe()}).`)
                    );
                if (e.ok && e.stale) {
                    const t = qe(e.ageMs || 0);
                    return (
                        ne('reconnecting', `Watchdog: cola estancada ${t}`),
                        void ue(
                            `Persisten datos estancados (${t}). Verifica backend o recepcion.`
                        )
                    );
                }
                const t = Math.max(1, Math.ceil(Le() / 1e3));
                (ne(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion al backend'
                        : `Reintentando en ${t}s`
                ),
                    ue(
                        !1 === navigator.onLine
                            ? 'Sin internet. Opera manualmente en recepcion.'
                            : `Refresh manual sin exito. Reintento automatico en ${t}s.`
                    ));
            } finally {
                (Se(), (v.queueManualRefreshBusy = !1), _e(!1));
            }
        }
    }
    function We({ immediate: e = !0 } = {}) {
        if (((v.queuePollingEnabled = !0), e))
            return (ne('live', 'Sincronizando cola...'), void Ge());
        Fe();
    }
    function Ke({ reason: e = 'paused' } = {}) {
        ((v.queuePollingEnabled = !1), (v.queueFailureStreak = 0), Te());
        const t = String(e || 'paused').toLowerCase();
        return 'offline' === t
            ? (ne('offline', 'Sin conexion al backend'),
              ue('Sin conexion. Esperando reconexion para reanudar cola.'),
              void Se())
            : 'hidden' === t
              ? (ne('paused', 'Cola en pausa (pestana oculta)'),
                void ue('Pestana oculta. Reanudando al volver a primer plano.'))
              : (ne('paused', 'Cola en pausa'),
                ue('Sincronizacion pausada por navegacion.'),
                void Se());
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((
            i ||
            ((i = fetch('/content/turnero/clinic-profile.json', {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            })
                .then(async (e) => {
                    if (!e.ok)
                        throw new Error(`clinic_profile_http_${e.status}`);
                    return e.json();
                })
                .then((e) => {
                    const t = o(e);
                    return {
                        ...t,
                        runtime_meta: {
                            source: 'remote',
                            profileFingerprint: c(t),
                        },
                    };
                })
                .catch(() => {
                    const e = o(n);
                    return {
                        ...e,
                        runtime_meta: {
                            source: 'fallback_default',
                            profileFingerprint: c(e),
                        },
                    };
                })),
            i)
        ).then((e) => {
            ((function (e) {
                v.clinicProfile = e;
                const t = r(e),
                    n = s(e),
                    i = String(e?.clinic_id || '').trim() || 'sin-clinic-id',
                    a = String(e?.branding?.city || '').trim(),
                    o = String(
                        e?.surfaces?.kiosk?.route || '/kiosco-turnos.html'
                    ).trim(),
                    l = [C(1), C(2)].join(' · ');
                document.title = `Kiosco de Turnos | ${t}`;
                const u = document.querySelector('#kioskWelcomeScreen strong');
                u instanceof HTMLElement &&
                    (u.textContent = `Bienvenida a ${t}`);
                const d = document.querySelector('.kiosk-brand strong');
                d instanceof HTMLElement && (d.textContent = t);
                const p = T('kioskClinicMeta');
                p instanceof HTMLElement &&
                    (p.textContent = [i, a || n].filter(Boolean).join(' · '));
                const m = T('kioskClinicContext');
                (m instanceof HTMLElement &&
                    (m.textContent = `${n} · ${o} · ${l}`),
                    (function (e) {
                        const t = E(e),
                            n = c(e).slice(0, 8),
                            i = T('kioskProfileStatus');
                        i instanceof HTMLElement &&
                            ((i.dataset.state =
                                'alert' === t.state
                                    ? 'alert'
                                    : 'ready' === t.state
                                      ? 'ready'
                                      : 'warning'),
                            (i.textContent =
                                'alert' === t.state
                                    ? 'profile_missing' === t.reason
                                        ? 'Bloqueado · perfil de respaldo · clinic-profile.json remoto ausente'
                                        : `Bloqueado · ruta fuera de canon · se esperaba ${t.expectedRoute || '/kiosco-turnos.html'}`
                                    : `Perfil remoto verificado · firma ${n} · canon ${t.expectedRoute || '/kiosco-turnos.html'}`));
                    })(e));
                const f = document.querySelector('.kiosk-header-note');
                f instanceof HTMLElement &&
                    (f.textContent = `Piloto web por clínica · ${a || n}`);
            })(e),
                N(
                    m(g, v.clinicProfile, {
                        fallbackValue: !1,
                        normalizeValue: w,
                    }),
                    { persist: !1, source: 'clinic_profile' }
                ),
                (v.offlineOutbox = m(b, v.clinicProfile, {
                    fallbackValue: [],
                    normalizeValue: q,
                })),
                (v.printerState = m(h, v.clinicProfile, {
                    fallbackValue: null,
                    normalizeValue: _,
                })),
                ge(),
                Se(),
                ne('paused', 'Sincronizacion lista'),
                ue('Esperando primera sincronizacion de cola...'),
                Me(''),
                !1 !== navigator.onLine && Oe({ source: 'startup', force: !0 }),
                H().start({ immediate: !1 }),
                We({ immediate: !0 }));
        }),
            (document.body.dataset.kioskMode = 'star'),
            (function () {
                if (document.getElementById(y)) return;
                const e = document.createElement('style');
                ((e.id = y),
                    (e.textContent =
                        "\n        body[data-kiosk-mode='star'] .kiosk-header {\n            border-bottom-color: color-mix(in srgb, var(--primary) 18%, var(--border));\n            box-shadow: 0 10px 28px rgb(15 31 54 / 10%);\n        }\n        .kiosk-header-tools {\n            display: grid;\n            gap: 0.35rem;\n            justify-items: end;\n        }\n        .kiosk-header-controls {\n            display: grid;\n            grid-template-columns: repeat(3, minmax(0, 1fr));\n            gap: 0.45rem;\n            width: 100%;\n            max-width: 620px;\n        }\n        .kiosk-header-help-btn {\n            border: 1px solid var(--border);\n            border-radius: 999px;\n            padding: 0.34rem 0.72rem;\n            background: var(--surface-soft);\n            color: var(--text);\n            font-size: 0.86rem;\n            font-weight: 600;\n            cursor: pointer;\n            min-height: 44px;\n        }\n        .kiosk-header-help-btn[data-variant='warning'] {\n            border-color: color-mix(in srgb, #b45309 32%, #fff 68%);\n            background: color-mix(in srgb, #fef3c7 88%, #fff 12%);\n            color: #92400e;\n        }\n        .kiosk-header-help-btn[data-open='true'] {\n            border-color: color-mix(in srgb, var(--primary) 38%, #fff 62%);\n            background: color-mix(in srgb, var(--surface-strong) 84%, #fff 16%);\n            color: var(--primary-strong);\n        }\n        .kiosk-header-help-btn[data-active='true'] {\n            border-color: color-mix(in srgb, var(--primary) 42%, #fff 58%);\n            background: color-mix(in srgb, var(--surface-strong) 84%, #fff 16%);\n            color: var(--primary-strong);\n            box-shadow: 0 10px 24px rgb(15 107 220 / 15%);\n        }\n        .kiosk-header-help-btn[disabled] {\n            opacity: 0.65;\n            cursor: not-allowed;\n            box-shadow: none;\n        }\n        .kiosk-quick-actions {\n            display: grid;\n            grid-template-columns: repeat(2, minmax(0, 1fr));\n            gap: 0.65rem;\n            margin: 0.45rem 0 0.6rem;\n        }\n        .kiosk-quick-action {\n            border: 1px solid var(--border);\n            border-radius: 16px;\n            padding: 0.8rem 0.92rem;\n            background: var(--surface-soft);\n            color: var(--text);\n            font-size: 1rem;\n            font-weight: 700;\n            letter-spacing: 0.01em;\n            cursor: pointer;\n            min-height: 64px;\n            text-align: left;\n        }\n        .kiosk-quick-action[data-active='true'] {\n            border-color: color-mix(in srgb, var(--primary) 42%, #fff 58%);\n            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);\n            color: var(--primary-strong);\n            box-shadow: 0 12px 26px rgb(15 107 220 / 14%);\n        }\n        .kiosk-progress-hint {\n            margin: 0 0 0.72rem;\n            color: var(--muted);\n            font-size: 0.95rem;\n            font-weight: 600;\n        }\n        .kiosk-progress-hint[data-tone='success'] {\n            color: var(--success);\n        }\n        .kiosk-progress-hint[data-tone='warn'] {\n            color: #9a6700;\n        }\n        .kiosk-quick-help-panel {\n            margin: 0 0 0.9rem;\n            border: 1px solid color-mix(in srgb, var(--primary) 24%, #fff 76%);\n            border-radius: 16px;\n            padding: 0.88rem 0.95rem;\n            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);\n        }\n        .kiosk-quick-help-panel h2 {\n            margin: 0 0 0.46rem;\n            font-size: 1.08rem;\n        }\n        .kiosk-quick-help-panel ol {\n            margin: 0 0 0.56rem;\n            padding-left: 1.12rem;\n            color: var(--text);\n            line-height: 1.45;\n        }\n        .kiosk-quick-help-panel p {\n            margin: 0 0 0.6rem;\n            color: var(--muted);\n            font-size: 0.9rem;\n        }\n        .kiosk-quick-help-panel button {\n            border: 1px solid var(--border);\n            border-radius: 12px;\n            padding: 0.46rem 0.74rem;\n            background: #fff;\n            color: var(--text);\n            font-weight: 600;\n            cursor: pointer;\n            min-height: 44px;\n        }\n        .kiosk-form.is-flow-active {\n            border-color: color-mix(in srgb, var(--primary) 32%, var(--border) 68%);\n            box-shadow: 0 14px 28px rgb(15 107 220 / 11%);\n        }\n        body[data-kiosk-senior='on'] {\n            font-size: 18px;\n        }\n        body[data-kiosk-senior='on'] .kiosk-layout {\n            gap: 1.2rem;\n        }\n        body[data-kiosk-senior='on'] h1 {\n            font-size: clamp(2rem, 3vw, 2.55rem);\n            line-height: 1.15;\n        }\n        body[data-kiosk-senior='on'] .kiosk-form label,\n        body[data-kiosk-senior='on'] .kiosk-progress-hint,\n        body[data-kiosk-senior='on'] .kiosk-status {\n            font-size: 1.08rem;\n        }\n        body[data-kiosk-senior='on'] .kiosk-form input,\n        body[data-kiosk-senior='on'] .assistant-form input {\n            min-height: 64px;\n            font-size: 1.18rem;\n        }\n        body[data-kiosk-senior='on'] .kiosk-form button,\n        body[data-kiosk-senior='on'] .assistant-form button {\n            min-height: 68px;\n            font-size: 1.16rem;\n        }\n        body[data-kiosk-senior='on'] .kiosk-quick-action {\n            min-height: 76px;\n            font-size: 1.13rem;\n        }\n        body[data-kiosk-senior='on'] .kiosk-header-help-btn {\n            min-height: 52px;\n            font-size: 0.97rem;\n            padding: 0.45rem 0.84rem;\n        }\n        body[data-kiosk-senior='on'] .queue-kpi-row article strong {\n            font-size: 2.3rem;\n        }\n        body[data-kiosk-senior='on'] .ticket-result-main strong {\n            font-size: 2.6rem;\n        }\n        body[data-kiosk-senior='on'] #kioskSeniorHint {\n            color: color-mix(in srgb, var(--primary) 72%, #1f2937 28%);\n        }\n        .kiosk-quick-action:focus-visible,\n        .kiosk-header-help-btn:focus-visible,\n        .kiosk-quick-help-panel button:focus-visible {\n            outline: 3px solid color-mix(in srgb, var(--primary) 62%, #fff 38%);\n            outline-offset: 2px;\n        }\n        @media (max-width: 760px) {\n            .kiosk-header-tools {\n                justify-items: start;\n            }\n            .kiosk-header-controls {\n                grid-template-columns: 1fr;\n            }\n            .kiosk-quick-actions {\n                grid-template-columns: 1fr;\n            }\n        }\n        @media (prefers-reduced-motion: reduce) {\n            .kiosk-quick-action,\n            .kiosk-header-help-btn,\n            .kiosk-form {\n                transition: none !important;\n            }\n        }\n    "),
                    document.head.appendChild(e));
            })(),
            (v.idleResetMs = (function () {
                const e = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS),
                    t = Number.isFinite(e) ? e : 9e4;
                return Math.min(k, Math.max(5e3, Math.round(t)));
            })()),
            (v.voiceGuideSupported = z()),
            (function () {
                const e = 'light';
                var t;
                (localStorage.setItem('kioskThemeMode', e),
                    (t = e),
                    (v.themeMode = t),
                    (document.documentElement.dataset.theme = 'light'),
                    document
                        .querySelectorAll('[data-theme-mode]')
                        .forEach((e) => {
                            const n = e.getAttribute('data-theme-mode');
                            (e.classList.toggle('is-active', n === t),
                                e.setAttribute(
                                    'aria-pressed',
                                    String(n === t)
                                ));
                        }));
            })(),
            N(!1, { persist: !1, source: 'init' }),
            P(),
            (function () {
                const e = T('kioskWelcomeScreen');
                e instanceof HTMLElement &&
                    (e.classList.add('is-visible'),
                    B(
                        'Bienvenida: en segundos podras elegir tu tipo de atencion.',
                        'info'
                    ),
                    window.setTimeout(() => {
                        De({ reason: 'auto' });
                    }, 1800),
                    window.setTimeout(() => {
                        De({ reason: 'safety_timeout' });
                    }, 2600));
            })(),
            je());
        const e = T('checkinForm'),
            t = T('walkinForm'),
            a = T('assistantForm');
        (e instanceof HTMLFormElement && e.addEventListener('submit', Ne),
            t instanceof HTMLFormElement && t.addEventListener('submit', Re),
            a instanceof HTMLFormElement && a.addEventListener('submit', Pe),
            (function () {
                const e = T('kioskQuickCheckin'),
                    t = T('kioskQuickWalkin'),
                    n = T('kioskHelpToggle'),
                    i = T('kioskHelpClose'),
                    a = T('kioskSeniorToggle'),
                    o = T('kioskVoiceGuideBtn'),
                    r = T('kioskReceptionHelpBtn');
                (e instanceof HTMLButtonElement &&
                    e.addEventListener('click', () => {
                        (se(), U('checkin'));
                    }),
                    t instanceof HTMLButtonElement &&
                        t.addEventListener('click', () => {
                            (se(), U('walkin'));
                        }),
                    n instanceof HTMLButtonElement &&
                        n.addEventListener('click', () => {
                            (se(), G(!v.quickHelpOpen, { source: 'toggle' }));
                        }),
                    i instanceof HTMLButtonElement &&
                        i.addEventListener('click', () => {
                            (se(), G(!1, { source: 'close_button' }));
                        }),
                    a instanceof HTMLButtonElement &&
                        a.addEventListener('click', () => {
                            (se(), R({ source: 'button' }));
                        }),
                    o instanceof HTMLButtonElement &&
                        o.addEventListener('click', () => {
                            (se(), j({ source: 'button' }));
                        }),
                    r instanceof HTMLButtonElement &&
                        ((r.dataset.variant = 'warning'),
                        r.addEventListener('click', () => {
                            (se(), F({ source: 'button' }));
                        })));
            })(),
            G(!1, { source: 'init' }),
            (function () {
                let e = T('kioskSessionGuard');
                if (e instanceof HTMLElement) return e;
                const t = T('kioskStatus');
                if (!(t instanceof HTMLElement)) return null;
                ((e = document.createElement('div')),
                    (e.id = 'kioskSessionGuard'),
                    (e.className = 'kiosk-session-guard'));
                const n = document.createElement('span');
                ((n.id = 'kioskSessionCountdown'),
                    (n.className = 'kiosk-session-countdown'),
                    (n.textContent = 'Privacidad auto: --:--'));
                const i = document.createElement('button');
                ((i.id = 'kioskSessionResetBtn'),
                    (i.type = 'button'),
                    (i.className = 'kiosk-session-reset'),
                    (i.textContent = 'Nueva persona / limpiar pantalla'),
                    e.appendChild(n),
                    e.appendChild(i),
                    t.insertAdjacentElement('afterend', e));
            })());
        const l = T('kioskSessionResetBtn');
        (l instanceof HTMLButtonElement &&
            l.addEventListener('click', () => {
                ce({ reason: 'manual' });
            }),
            oe(),
            ae(),
            U('checkin', { announce: !1 }),
            B('Paso 1 de 2: selecciona una opcion para comenzar.', 'info'),
            ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((e) => {
                document.addEventListener(
                    e,
                    () => {
                        se();
                    },
                    !0
                );
            }),
            re(),
            le(),
            pe(),
            fe(),
            ke(),
            ge(),
            Se());
        const u = we();
        u instanceof HTMLButtonElement &&
            u.addEventListener('click', () => {
                Ue();
            });
        const d = T('queueOutboxRetryBtn');
        d instanceof HTMLButtonElement &&
            d.addEventListener('click', () => {
                Oe({ source: 'operator', force: !0, maxItems: 25 });
            });
        const p = T('queueOutboxDropOldestBtn');
        p instanceof HTMLButtonElement &&
            p.addEventListener('click', () => {
                !(function () {
                    if (!v.offlineOutbox.length) return;
                    const e = v.offlineOutbox[v.offlineOutbox.length - 1];
                    (v.offlineOutbox.pop(),
                        ve(),
                        Se(),
                        he(),
                        te(
                            `Descartado pendiente antiguo (${e?.originLabel || 'sin detalle'}).`,
                            'info'
                        ));
                })();
            });
        const f = T('queueOutboxClearBtn');
        (f instanceof HTMLButtonElement &&
            f.addEventListener('click', () => {
                ye({ reason: 'manual' });
            }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? Ke({ reason: 'hidden' })
                    : v.clinicProfile && We({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                v.clinicProfile &&
                    (Oe({ source: 'online', force: !0 }),
                    We({ immediate: !0 }));
            }),
            window.addEventListener('offline', () => {
                (Ke({ reason: 'offline' }), Se());
            }),
            window.addEventListener('beforeunload', () => {
                (D({ source: 'beforeunload' }),
                    Ke({ reason: 'paused' }),
                    S?.stop());
            }),
            window.addEventListener('keydown', (e) => {
                if (!e.altKey || !e.shiftKey) return;
                const t = String(e.code || '').toLowerCase();
                return 'keyr' === t
                    ? (e.preventDefault(), void Ue())
                    : 'keyh' === t
                      ? (e.preventDefault(),
                        void G(!v.quickHelpOpen, { source: 'shortcut' }))
                      : 'digit1' === t
                        ? (e.preventDefault(), void U('checkin'))
                        : 'digit2' === t
                          ? (e.preventDefault(), void U('walkin'))
                          : 'keys' === t
                            ? (e.preventDefault(),
                              void R({ source: 'shortcut' }))
                            : 'keyv' === t
                              ? (e.preventDefault(),
                                void j({ source: 'shortcut' }))
                              : 'keya' === t
                                ? (e.preventDefault(),
                                  void F({ source: 'shortcut' }))
                                : 'keyl' === t
                                  ? (e.preventDefault(),
                                    void ce({ reason: 'manual' }))
                                  : 'keyy' === t
                                    ? (e.preventDefault(),
                                      void Oe({
                                          source: 'shortcut',
                                          force: !0,
                                          maxItems: 25,
                                      }))
                                    : void (
                                          'keyk' === t &&
                                          (e.preventDefault(),
                                          ye({ reason: 'manual' }))
                                      );
            }));
    });
})();
