!(function () {
    'use strict';
    const n = 'queueDisplayBellMuted',
        e = 'queueDisplayLastSnapshot',
        t = 'displayAnnouncementInlineStyles',
        a = 'displayStarInlineStyles',
        i = 'display-bell-flash',
        o = {
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
        };
    function l(n, e = {}) {
        try {
            window.dispatchEvent(
                new CustomEvent('piel:queue-ops', {
                    detail: {
                        surface: 'display',
                        event: String(n || 'unknown'),
                        at: new Date().toISOString(),
                        ...e,
                    },
                })
            );
        } catch (n) {}
    }
    function r(n) {
        return document.getElementById(n);
    }
    function s(n) {
        return String(n || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    function c(n) {
        const e = String(n || '')
            .trim()
            .toUpperCase();
        return (e && e.replace(/[^A-Z0-9-]/g, '')) || '--';
    }
    function d(n) {
        const e = String(n || '').trim();
        if (!e) return '--';
        const t = e
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
            const n = String(a[0] || '').replace(/[^A-Za-z0-9]/g, '');
            if (!n) return '--';
            i = n.length <= 3 && n === n.toUpperCase() ? n : n.slice(0, 2);
        }
        const o = i.toUpperCase().trim();
        return o ? o.slice(0, 3) : '--';
    }
    function u(n, e) {
        if (!n || 'object' != typeof n || !Array.isArray(e)) return [];
        for (const t of e) if (t && Array.isArray(n[t])) return n[t];
        return [];
    }
    function p(n, e) {
        if (!n || 'object' != typeof n || !Array.isArray(e)) return null;
        for (const t of e) {
            if (!t) continue;
            const e = n[t];
            if (e && 'object' == typeof e && !Array.isArray(e)) return e;
        }
        return null;
    }
    function m(n, e, t = 0) {
        if (!n || 'object' != typeof n || !Array.isArray(e))
            return Number(t || 0);
        for (const t of e) {
            if (!t) continue;
            const e = Number(n[t]);
            if (Number.isFinite(e)) return e;
        }
        return Number(t || 0);
    }
    function f(n) {
        const e = n && 'object' == typeof n ? n : {},
            t = p(e, ['counts']) || {},
            a = m(e, ['waitingCount', 'waiting_count'], Number.NaN),
            i = m(e, ['calledCount', 'called_count'], Number.NaN);
        let o = u(e, [
            'callingNow',
            'calling_now',
            'calledTickets',
            'called_tickets',
        ]);
        if (0 === o.length) {
            const n = p(e, [
                'callingNowByConsultorio',
                'calling_now_by_consultorio',
            ]);
            n && (o = Object.values(n).filter(Boolean));
        }
        const l = u(e, [
                'nextTickets',
                'next_tickets',
                'waitingTickets',
                'waiting_tickets',
            ]),
            r = Number.isFinite(a)
                ? a
                : m(t, ['waiting', 'waiting_count'], l.length),
            s = Number.isFinite(i)
                ? i
                : m(t, ['called', 'called_count'], o.length);
        return {
            updatedAt:
                String(e.updatedAt || e.updated_at || '').trim() ||
                new Date().toISOString(),
            waitingCount: Math.max(0, Number(r || 0)),
            calledCount: Math.max(0, Number(s || 0)),
            callingNow: Array.isArray(o)
                ? o.map((n) => ({
                      ...n,
                      id: Number(n?.id || n?.ticket_id || 0) || 0,
                      ticketCode: c(n?.ticketCode || n?.ticket_code || '--'),
                      patientInitials: d(
                          n?.patientInitials || n?.patient_initials || '--'
                      ),
                      assignedConsultorio:
                          Number(
                              n?.assignedConsultorio ??
                                  n?.assigned_consultorio ??
                                  0
                          ) || null,
                      calledAt: String(n?.calledAt || n?.called_at || ''),
                  }))
                : [],
            nextTickets: Array.isArray(l)
                ? l.map((n, e) => ({
                      ...n,
                      id: Number(n?.id || n?.ticket_id || 0) || 0,
                      ticketCode: c(n?.ticketCode || n?.ticket_code || '--'),
                      patientInitials: d(
                          n?.patientInitials || n?.patient_initials || '--'
                      ),
                      position:
                          Number(n?.position || 0) > 0
                              ? Number(n.position)
                              : e + 1,
                  }))
                : [],
        };
    }
    function g(n, e) {
        const t = r('displayConnectionState');
        if (!t) return;
        const a = String(n || 'live').toLowerCase(),
            i = {
                live: 'Conectado',
                reconnecting: 'Reconectando',
                offline: 'Sin conexion',
                paused: 'En pausa',
            },
            s = String(e || '').trim() || i[a] || i.live,
            c = a !== o.connectionState || s !== o.lastConnectionMessage;
        ((o.connectionState = a),
            (o.lastConnectionMessage = s),
            (t.dataset.state = a),
            (t.textContent = s),
            c && l('connection_state', { state: a, message: s }));
    }
    function y() {
        let n = r('displayOpsHint');
        if (n) return n;
        const e = r('displayUpdatedAt');
        return e?.parentElement
            ? ((n = document.createElement('span')),
              (n.id = 'displayOpsHint'),
              (n.className = 'display-updated-at'),
              (n.textContent = 'Estado operativo: inicializando...'),
              e.insertAdjacentElement('afterend', n),
              n)
            : null;
    }
    function b() {
        if (document.getElementById(a)) return;
        const n = document.createElement('style');
        ((n.id = a),
            (n.textContent = `\n        body[data-display-mode='star'] .display-header {\n            border-bottom-color: color-mix(in srgb, var(--accent) 18%, var(--border));\n            box-shadow: 0 10px 32px rgb(16 36 61 / 10%);\n        }\n        body[data-display-mode='star'] .display-brand strong {\n            letter-spacing: -0.02em;\n        }\n        body[data-display-mode='star'] .display-privacy-pill {\n            width: fit-content;\n            border: 1px solid color-mix(in srgb, var(--accent) 24%, #fff 76%);\n            border-radius: 999px;\n            padding: 0.22rem 0.66rem;\n            background: color-mix(in srgb, var(--accent-soft) 90%, #fff 10%);\n            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);\n            font-size: 0.83rem;\n            font-weight: 600;\n            line-height: 1.3;\n        }\n        body[data-display-mode='star'] .display-layout {\n            gap: 1.1rem;\n        }\n        body[data-display-mode='star'] .display-panel {\n            border-radius: 22px;\n            padding: 1.12rem;\n        }\n        body[data-display-mode='star'] .display-next-list li {\n            min-height: 68px;\n        }\n        #displayMetrics {\n            margin: 0.7rem 1.35rem 0;\n            display: flex;\n            flex-wrap: wrap;\n            gap: 0.56rem;\n        }\n        .display-metric-chip {\n            border: 1px solid var(--border);\n            border-radius: 12px;\n            padding: 0.36rem 0.7rem;\n            background: var(--surface-soft);\n            color: var(--muted);\n            font-size: 0.9rem;\n            font-weight: 600;\n        }\n        .display-metric-chip strong {\n            color: var(--text);\n            font-size: 1.02rem;\n            margin-left: 0.28rem;\n        }\n        .display-metric-chip[data-kind='active'] {\n            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);\n            background: color-mix(in srgb, var(--accent-soft) 88%, #fff 12%);\n            color: color-mix(in srgb, var(--accent) 68%, #0f172a 32%);\n        }\n        .display-metric-chip[data-kind='active'] strong {\n            color: var(--accent);\n        }\n        #displayAnnouncement .display-announcement-support {\n            margin: 0.24rem 0 0;\n            color: var(--muted);\n            font-size: clamp(0.98rem, 1.45vw, 1.15rem);\n            font-weight: 500;\n            line-height: 1.3;\n        }\n        #displayAnnouncement.is-live .display-announcement-support {\n            color: color-mix(in srgb, var(--accent) 60%, var(--muted) 40%);\n        }\n        body.${i} .display-header {\n            box-shadow:\n                0 0 0 2px color-mix(in srgb, var(--accent) 34%, #fff 66%),\n                0 14px 34px rgb(16 36 61 / 18%);\n        }\n        body.${i} #displayAnnouncement {\n            border-color: color-mix(in srgb, var(--accent) 45%, #fff 55%);\n            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, #fff 72%);\n            transform: translateY(-1px);\n        }\n        body.${i} .display-called-card.is-live {\n            border-color: color-mix(in srgb, var(--accent) 32%, #fff 68%);\n            box-shadow: 0 12px 24px rgb(16 36 61 / 14%);\n        }\n        @media (max-width: 720px) {\n            #displayMetrics {\n                margin: 0.56rem 0.9rem 0;\n            }\n        }\n    `),
            document.head.appendChild(n));
    }
    function h() {
        let n = r('displayAnnouncement');
        if (n instanceof HTMLElement) return n;
        const e = document.querySelector('.display-layout');
        return e instanceof HTMLElement
            ? ((function () {
                  if (document.getElementById(t)) return;
                  const n = document.createElement('style');
                  ((n.id = t),
                      (n.textContent =
                          '\n        #displayAnnouncement {\n            margin: 0.75rem 1.35rem 0;\n            padding: 1rem 1.2rem;\n            border-radius: 18px;\n            border: 1px solid color-mix(in srgb, var(--accent) 28%, #fff 72%);\n            background: linear-gradient(120deg, color-mix(in srgb, var(--accent-soft) 92%, #fff 8%), #fff);\n            box-shadow: 0 12px 24px rgb(16 36 61 / 11%);\n        }\n        #displayAnnouncement .display-announcement-label {\n            margin: 0;\n            color: var(--muted);\n            font-size: 0.96rem;\n            font-weight: 600;\n            letter-spacing: 0.02em;\n        }\n        #displayAnnouncement .display-announcement-text {\n            margin: 0.24rem 0 0;\n            font-size: clamp(1.34rem, 2.5vw, 2.15rem);\n            line-height: 1.18;\n            font-weight: 700;\n            letter-spacing: 0.01em;\n            color: var(--text);\n        }\n        #displayAnnouncement.is-live .display-announcement-text {\n            color: var(--accent);\n        }\n        #displayAnnouncement.is-bell {\n            border-color: color-mix(in srgb, var(--accent) 40%, #fff 60%);\n            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, #fff 78%);\n        }\n        #displayAnnouncement.is-idle {\n            border-color: var(--border);\n            background: linear-gradient(160deg, var(--surface-soft), #fff);\n        }\n        @media (max-width: 720px) {\n            #displayAnnouncement {\n                margin: 0.6rem 0.9rem 0;\n            }\n        }\n        @media (prefers-reduced-motion: reduce) {\n            #displayAnnouncement {\n                transition: none !important;\n            }\n        }\n    '),
                      document.head.appendChild(n));
              })(),
              b(),
              (n = document.createElement('section')),
              (n.id = 'displayAnnouncement'),
              (n.className = 'display-announcement is-idle'),
              n.setAttribute('role', 'status'),
              n.setAttribute('aria-live', 'assertive'),
              n.setAttribute('aria-atomic', 'true'),
              (n.innerHTML =
                  '\n        <p class="display-announcement-label">Llamando ahora</p>\n        <p class="display-announcement-text">Esperando siguiente llamado...</p>\n        <p class="display-announcement-support">Consulta la pantalla para el consultorio asignado.</p>\n    '),
              e.insertAdjacentElement('beforebegin', n),
              n)
            : null;
    }
    function S(n) {
        const e = h();
        if (!(e instanceof HTMLElement)) return;
        const t = e.querySelector('.display-announcement-text'),
            a = e.querySelector('.display-announcement-support');
        if (!(t instanceof HTMLElement)) return;
        if (!n) {
            (e.classList.add('is-idle'),
                e.classList.remove('is-live'),
                delete e.dataset.consultorio);
            const n = 'Esperando siguiente llamado...',
                i = 'Consulta la pantalla para el consultorio asignado.';
            return (
                t.textContent !== n &&
                    ((t.textContent = n),
                    l('announcement_update', { mode: 'idle' })),
                void (
                    a instanceof HTMLElement &&
                    a.textContent !== i &&
                    (a.textContent = i)
                )
            );
        }
        const i = Number(n?.assignedConsultorio || 0),
            o = 1 === i || 2 === i ? `Consultorio ${i}` : 'Recepcion',
            r = c(n?.ticketCode || '--'),
            s = `${o} · Turno ${r}`,
            u = `Paciente ${d(n?.patientInitials || '--')}: pasa con calma al ${o}.`;
        (e.classList.remove('is-idle'),
            e.classList.add('is-live'),
            (e.dataset.consultorio = String(i || '')),
            t.textContent !== s &&
                ((t.textContent = s),
                l('announcement_update', {
                    mode: 'live',
                    consultorio: i,
                    ticketCode: r,
                })),
            a instanceof HTMLElement &&
                a.textContent !== u &&
                (a.textContent = u));
    }
    function x(n) {
        const e = y();
        e && (e.textContent = String(n || '').trim() || 'Estado operativo');
    }
    function v() {
        let n = r('displayMetrics');
        if (n instanceof HTMLElement) return n;
        const e = h();
        return e instanceof HTMLElement
            ? (b(),
              (n = document.createElement('section')),
              (n.id = 'displayMetrics'),
              (n.className = 'display-metrics'),
              n.setAttribute('aria-live', 'polite'),
              (n.innerHTML =
                  '\n        <span class="display-metric-chip" data-kind="waiting">\n            En cola\n            <strong data-metric="waiting">0</strong>\n        </span>\n        <span class="display-metric-chip" data-kind="active">\n            Llamando\n            <strong data-metric="active">0</strong>\n        </span>\n        <span class="display-metric-chip" data-kind="next">\n            Siguientes\n            <strong data-metric="next">0</strong>\n        </span>\n    '),
              e.insertAdjacentElement('afterend', n),
              n)
            : null;
    }
    function w(n, e, t) {
        if (!(n instanceof HTMLElement)) return;
        const a = n.querySelector(`[data-metric="${e}"]`);
        if (!(a instanceof HTMLElement)) return;
        const i = String(Math.max(0, Number(t || 0)));
        a.textContent !== i && (a.textContent = i);
    }
    function A() {
        let n = r('displayManualRefreshBtn');
        if (n instanceof HTMLButtonElement) return n;
        const e = document.querySelector('.display-clock-wrap');
        return e
            ? ((n = document.createElement('button')),
              (n.id = 'displayManualRefreshBtn'),
              (n.type = 'button'),
              (n.className = 'display-control-btn'),
              (n.textContent = 'Refrescar panel'),
              n.setAttribute(
                  'aria-label',
                  'Refrescar estado de turnos en pantalla'
              ),
              e.appendChild(n),
              n)
            : null;
    }
    function C(n) {
        const e = A();
        e instanceof HTMLButtonElement &&
            ((e.disabled = Boolean(n)),
            (e.textContent = n ? 'Refrescando...' : 'Refrescar panel'));
    }
    function k() {
        let n = r('displayBellToggleBtn');
        if (n instanceof HTMLButtonElement) return n;
        const e = document.querySelector('.display-clock-wrap');
        return e
            ? ((n = document.createElement('button')),
              (n.id = 'displayBellToggleBtn'),
              (n.type = 'button'),
              (n.className = 'display-control-btn display-control-btn-muted'),
              n.setAttribute('aria-label', 'Alternar campanilla de llamados'),
              e.appendChild(n),
              n)
            : null;
    }
    function M() {
        const n = k();
        n instanceof HTMLButtonElement &&
            ((n.textContent = o.bellMuted
                ? 'Campanilla: Off'
                : 'Campanilla: On'),
            (n.dataset.state = o.bellMuted ? 'muted' : 'enabled'),
            n.setAttribute('aria-pressed', String(o.bellMuted)),
            (n.title = o.bellMuted
                ? 'Campanilla en silencio'
                : 'Campanilla activa'));
    }
    function E() {
        !(function (e, { announce: t = !1 } = {}) {
            ((o.bellMuted = Boolean(e)),
                localStorage.setItem(n, o.bellMuted ? '1' : '0'),
                M(),
                l('bell_muted_changed', { muted: o.bellMuted, announce: t }),
                t &&
                    x(
                        o.bellMuted
                            ? 'Campanilla en silencio. Puedes reactivarla con Alt+Shift+M.'
                            : 'Campanilla activa para nuevos llamados.'
                    ));
        })(!o.bellMuted, { announce: !0 });
    }
    function T(n) {
        const e = f(n);
        return {
            updatedAt: String(e.updatedAt || new Date().toISOString()),
            waitingCount: Number(e.waitingCount || 0),
            calledCount: Number(e.calledCount || 0),
            callingNow: Array.isArray(e.callingNow) ? e.callingNow : [],
            nextTickets: Array.isArray(e.nextTickets) ? e.nextTickets : [],
        };
    }
    function N(n, { mode: e = 'restore' } = {}) {
        if (!n?.data) return !1;
        j(n.data);
        const t = Math.max(0, Date.now() - Date.parse(String(n.savedAt || ''))),
            a = I(t);
        return (
            g('reconnecting', 'Respaldo local activo'),
            x(
                'startup' === e
                    ? `Mostrando respaldo local (${a}) mientras conecta.`
                    : `Sin backend. Mostrando ultimo estado local (${a}).`
            ),
            l('snapshot_restored', { mode: e, ageMs: t }),
            !0
        );
    }
    function L() {
        let n = r('displaySnapshotHint');
        if (n instanceof HTMLElement) return n;
        const e = y();
        return e?.parentElement
            ? ((n = document.createElement('span')),
              (n.id = 'displaySnapshotHint'),
              (n.className = 'display-updated-at'),
              (n.textContent = 'Respaldo: sin datos locales'),
              e.insertAdjacentElement('afterend', n),
              n)
            : null;
    }
    function B() {
        const n = L();
        if (!(n instanceof HTMLElement)) return;
        if (!o.lastSnapshot?.savedAt)
            return void (n.textContent = 'Respaldo: sin datos locales');
        const e = Date.parse(String(o.lastSnapshot.savedAt || ''));
        Number.isFinite(e)
            ? (n.textContent = `Respaldo: ${I(Date.now() - e)} de antiguedad`)
            : (n.textContent = 'Respaldo: sin datos locales');
    }
    function H({ announce: n = !1 } = {}) {
        ((o.lastSnapshot = null), (o.lastRenderedSignature = ''));
        try {
            localStorage.removeItem(e);
        } catch (n) {}
        (B(),
            'live' !== o.connectionState &&
                ((function (n = 'No hay turnos pendientes.') {
                    ((o.lastRenderedSignature = ''),
                        (o.lastCalledSignature = ''),
                        (o.callBaselineReady = !0),
                        _('displayConsultorio1', null, 'Consultorio 1'),
                        _('displayConsultorio2', null, 'Consultorio 2'),
                        S(null));
                    const e = r('displayNextList');
                    e &&
                        (e.innerHTML = `<li class="display-empty">${s(n)}</li>`);
                })('Sin respaldo local disponible.'),
                !1 === navigator.onLine
                    ? g('offline', 'Sin conexion')
                    : g('reconnecting', 'Sin respaldo local')),
            n &&
                x(
                    'Respaldo local limpiado. Esperando datos en vivo del backend.'
                ),
            l('snapshot_cleared', { announce: n }));
    }
    function I(n) {
        const e = Math.max(0, Number(n || 0)),
            t = Math.round(e / 1e3);
        if (t < 60) return `${t}s`;
        const a = Math.floor(t / 60),
            i = t % 60;
        return i <= 0 ? `${a}m` : `${a}m ${i}s`;
    }
    function $() {
        return o.lastHealthySyncAt
            ? `hace ${I(Date.now() - o.lastHealthySyncAt)}`
            : 'sin sincronizacion confirmada';
    }
    function _(n, e, t) {
        const a = r(n);
        if (!a) return;
        if (!e)
            return void (a.innerHTML = `\n            <article class="display-called-card is-empty">\n                <h3>${t}</h3>\n                <p>Sin llamado activo</p>\n            </article>\n        `);
        const i = Date.parse(String(e.calledAt || '')),
            o =
                Number.isFinite(i) && Date.now() - i <= 8e3
                    ? 'display-called-card is-live is-fresh'
                    : 'display-called-card is-live';
        a.innerHTML = `\n        <article class="${o}">\n            <h3>${t}</h3>\n            <strong>${s(e.ticketCode || '--')}</strong>\n            <span>${s(e.patientInitials || '--')}</span>\n        </article>\n    `;
    }
    function R(n) {
        return n
            ? new Set(
                  String(n)
                      .split('|')
                      .map((n) => n.trim())
                      .filter(Boolean)
              )
            : new Set();
    }
    function D() {
        (o.bellFlashId &&
            (window.clearTimeout(o.bellFlashId), (o.bellFlashId = 0)),
            document.body.classList.remove(i));
        const n = r('displayAnnouncement');
        n instanceof HTMLElement && n.classList.remove('is-bell');
    }
    async function z({ source: n = 'unknown' } = {}) {
        try {
            o.audioContext ||
                (o.audioContext = new (
                    window.AudioContext || window.webkitAudioContext
                )());
            const e = o.audioContext;
            return (
                'suspended' === e.state && (await e.resume()),
                (o.bellPrimed = 'running' === e.state),
                l('bell_audio_primed', { source: n, running: o.bellPrimed }),
                o.bellPrimed
            );
        } catch (e) {
            return (
                (o.bellPrimed = !1),
                l('bell_audio_primed', { source: n, running: !1 }),
                !1
            );
        }
    }
    function F() {
        const n = Date.now();
        (o.lastBellBlockedHintAt > 0 && n - o.lastBellBlockedHintAt < 2e4) ||
            ((o.lastBellBlockedHintAt = n),
            x(
                'Audio bloqueado por navegador. Toca "Probar campanilla" una vez para habilitar sonido.'
            ));
    }
    async function O({ source: n = 'new_call', force: e = !1 } = {}) {
        if (
            ((function () {
                const n = document.body;
                if (!(n instanceof HTMLElement)) return;
                (D(), n.offsetWidth, n.classList.add(i));
                const e = r('displayAnnouncement');
                (e instanceof HTMLElement && e.classList.add('is-bell'),
                    (o.bellFlashId = window.setTimeout(() => {
                        D();
                    }, 1300)));
            })(),
            o.bellMuted && !e)
        )
            return;
        const t = Date.now();
        if (!(!e && o.lastBellAt > 0 && t - o.lastBellAt < 1200))
            try {
                if (!(await z({ source: n }))) return void F();
                const e = o.audioContext,
                    t = e.currentTime,
                    a = e.createOscillator(),
                    i = e.createGain();
                ((a.type = 'sine'),
                    a.frequency.setValueAtTime(932, t),
                    i.gain.setValueAtTime(1e-4, t),
                    i.gain.exponentialRampToValueAtTime(0.16, t + 0.02),
                    i.gain.exponentialRampToValueAtTime(1e-4, t + 0.22),
                    a.connect(i),
                    i.connect(e.destination),
                    a.start(t),
                    a.stop(t + 0.24),
                    (o.lastBellAt = Date.now()),
                    l('bell_played', { source: n, muted: o.bellMuted }));
            } catch (n) {
                F();
            }
    }
    function j(n) {
        const e = f(n),
            t = (function (n) {
                const e = f(n),
                    t = Array.isArray(e.callingNow)
                        ? e.callingNow.map((n) => ({
                              id: Number(n?.id || 0),
                              ticketCode: String(n?.ticketCode || ''),
                              patientInitials: String(n?.patientInitials || ''),
                              consultorio: Number(n?.assignedConsultorio || 0),
                              calledAt: String(n?.calledAt || ''),
                          }))
                        : [],
                    a = Array.isArray(e.nextTickets)
                        ? e.nextTickets
                              .slice(0, 8)
                              .map((n) => ({
                                  id: Number(n?.id || 0),
                                  ticketCode: String(n?.ticketCode || ''),
                                  patientInitials: String(
                                      n?.patientInitials || ''
                                  ),
                                  position: Number(n?.position || 0),
                              }))
                        : [],
                    i = String(e.updatedAt || '');
                return JSON.stringify({
                    updatedAt: i,
                    callingNow: t,
                    nextTickets: a,
                });
            })(e),
            a = t === o.lastRenderedSignature,
            i = Array.isArray(e.callingNow) ? e.callingNow : [],
            d = { 1: null, 2: null };
        for (const n of i) {
            const e = Number(n?.assignedConsultorio || 0);
            (1 !== e && 2 !== e) || (d[e] = n);
        }
        const u = (function (n, e) {
            const t = Array.isArray(n) ? n.filter(Boolean) : [];
            if (0 === t.length) return null;
            let a = t[0],
                i = Number.NEGATIVE_INFINITY;
            for (const n of t) {
                const e = Date.parse(String(n?.calledAt || ''));
                Number.isFinite(e) && e >= i && ((i = e), (a = n));
            }
            return Number.isFinite(i) ? a : e[1] || e[2] || a;
        })(i, d);
        (a ||
            (_('displayConsultorio1', d[1], 'Consultorio 1'),
            _('displayConsultorio2', d[2], 'Consultorio 2'),
            (function (n) {
                const e = r('displayNextList');
                e &&
                    (Array.isArray(n) && 0 !== n.length
                        ? (e.innerHTML = n
                              .slice(0, 8)
                              .map(
                                  (n) =>
                                      `\n                <li>\n                    <span class="next-code">${s(n.ticketCode || '--')}</span>\n                    <span class="next-initials">${s(n.patientInitials || '--')}</span>\n                    <span class="next-position">#${s(n.position || '-')}</span>\n                </li>\n            `
                              )
                              .join(''))
                        : (e.innerHTML =
                              '<li class="display-empty">No hay turnos pendientes.</li>'));
            })(e?.nextTickets || []),
            (function (n) {
                const e = r('displayUpdatedAt');
                if (!e) return;
                const t = f(n),
                    a = Date.parse(String(t.updatedAt || ''));
                Number.isFinite(a)
                    ? (e.textContent = `Actualizado ${new Date(a).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
                    : (e.textContent = 'Actualizacion pendiente');
            })(e),
            (o.lastRenderedSignature = t),
            l('render_update', {
                callingNowCount: i.length,
                nextCount: Array.isArray(e?.nextTickets)
                    ? e.nextTickets.length
                    : 0,
            })),
            S(u),
            (function (n) {
                const e = v();
                if (!(e instanceof HTMLElement)) return;
                const t = f(n),
                    a = Number(t.waitingCount || 0),
                    i = Array.isArray(t.callingNow) ? t.callingNow.length : 0,
                    o = Array.isArray(t.nextTickets) ? t.nextTickets.length : 0;
                (w(e, 'waiting', a), w(e, 'active', i), w(e, 'next', o));
            })(e));
        const p = (function (n) {
            return Array.isArray(n) && 0 !== n.length
                ? n
                      .map((n) => {
                          const e = String(n.assignedConsultorio || '-'),
                              t = Number(n.id || 0),
                              a = c(n.ticketCode || '--');
                          return `${e}:${t > 0 ? `id-${t}` : `code-${a}`}`;
                      })
                      .sort()
                      .join('|')
                : '';
        })(i);
        if (!o.callBaselineReady)
            return (
                (o.lastCalledSignature = p),
                void (o.callBaselineReady = !0)
            );
        if (p !== o.lastCalledSignature) {
            const n = R(o.lastCalledSignature),
                e = R(p),
                t = [];
            for (const a of e) n.has(a) || t.push(a);
            (t.length > 0 && O({ source: 'new_call' }),
                l('called_signature_changed', {
                    signature: p,
                    added_count: t.length,
                }));
        }
        o.lastCalledSignature = p;
    }
    function q() {
        const n = Math.max(0, Number(o.failureStreak || 0)),
            e = 2500 * Math.pow(2, Math.min(n, 3));
        return Math.min(15e3, e);
    }
    function P() {
        o.pollingId && (window.clearTimeout(o.pollingId), (o.pollingId = 0));
    }
    function V({ immediate: n = !1 } = {}) {
        if ((P(), !o.pollingEnabled)) return;
        const e = n ? 0 : q();
        o.pollingId = window.setTimeout(() => {
            J();
        }, e);
    }
    async function U() {
        if (o.refreshBusy) return { ok: !1, stale: !1, reason: 'busy' };
        o.refreshBusy = !0;
        try {
            const n = f(
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
                        let a;
                        try {
                            a = t ? JSON.parse(t) : {};
                        } catch (n) {
                            throw new Error('Respuesta JSON invalida');
                        }
                        if (!e.ok || !1 === a.ok)
                            throw new Error(a.error || `HTTP ${e.status}`);
                        return a;
                    })()
                ).data || {}
            );
            (j(n),
                (function (n) {
                    const t = T(n),
                        a = { savedAt: new Date().toISOString(), data: t };
                    o.lastSnapshot = a;
                    try {
                        localStorage.setItem(e, JSON.stringify(a));
                    } catch (n) {}
                    B();
                })(n));
            const t = (function (n) {
                const e = f(n),
                    t = Date.parse(String(e.updatedAt || ''));
                if (!Number.isFinite(t))
                    return { stale: !1, missingTimestamp: !0, ageMs: null };
                const a = Math.max(0, Date.now() - t);
                return { stale: a >= 3e4, missingTimestamp: !1, ageMs: a };
            })(n);
            return {
                ok: !0,
                stale: Boolean(t.stale),
                missingTimestamp: Boolean(t.missingTimestamp),
                ageMs: t.ageMs,
                usedSnapshot: !1,
            };
        } catch (n) {
            const e = N(o.lastSnapshot, { mode: 'restore' });
            if (!e) {
                const e = r('displayNextList');
                e &&
                    (e.innerHTML = `<li class="display-empty">Sin conexion: ${s(n.message)}</li>`);
            }
            return {
                ok: !1,
                stale: !1,
                reason: 'fetch_error',
                errorMessage: n.message,
                usedSnapshot: e,
            };
        } finally {
            o.refreshBusy = !1;
        }
    }
    async function J() {
        if (!o.pollingEnabled) return;
        if (document.hidden)
            return (
                g('paused', 'En pausa (pestana oculta)'),
                x('Pantalla en pausa por pestana oculta.'),
                void V()
            );
        if (!1 === navigator.onLine)
            return (
                (o.failureStreak += 1),
                N(o.lastSnapshot, { mode: 'restore' }) ||
                    (g('offline', 'Sin conexion'),
                    x(
                        'Sin conexion. Mantener llamado por voz desde recepcion hasta recuperar enlace.'
                    )),
                void V()
            );
        const n = await U();
        if (n.ok && !n.stale)
            ((o.failureStreak = 0),
                (o.lastHealthySyncAt = Date.now()),
                g('live', 'Conectado'),
                x(`Panel estable (${$()}).`));
        else if (n.ok && n.stale) {
            o.failureStreak += 1;
            const e = I(n.ageMs || 0);
            (g('reconnecting', `Watchdog: datos estancados ${e}`),
                x(`Datos estancados ${e}. Verifica fuente de cola.`));
        } else {
            if (((o.failureStreak += 1), n.usedSnapshot)) return void V();
            const e = Math.max(1, Math.ceil(q() / 1e3));
            (g('reconnecting', `Reconectando en ${e}s`),
                x(`Conexion inestable. Reintento automatico en ${e}s.`));
        }
        V();
    }
    async function G() {
        if (!o.manualRefreshBusy) {
            ((o.manualRefreshBusy = !0),
                C(!0),
                g('reconnecting', 'Refrescando panel...'));
            try {
                const n = await U();
                if (n.ok && !n.stale)
                    return (
                        (o.failureStreak = 0),
                        (o.lastHealthySyncAt = Date.now()),
                        g('live', 'Conectado'),
                        void x(`Sincronizacion manual exitosa (${$()}).`)
                    );
                if (n.ok && n.stale) {
                    const e = I(n.ageMs || 0);
                    return (
                        g('reconnecting', `Watchdog: datos estancados ${e}`),
                        void x(`Persisten datos estancados (${e}).`)
                    );
                }
                if (n.usedSnapshot) return;
                const e = Math.max(1, Math.ceil(q() / 1e3));
                (g(
                    !1 === navigator.onLine ? 'offline' : 'reconnecting',
                    !1 === navigator.onLine
                        ? 'Sin conexion'
                        : `Reconectando en ${e}s`
                ),
                    x(
                        !1 === navigator.onLine
                            ? 'Sin internet. Llamado manual temporal.'
                            : `Refresh manual sin exito. Reintento automatico en ${e}s.`
                    ));
            } finally {
                ((o.manualRefreshBusy = !1), C(!1));
            }
        }
    }
    function W({ immediate: n = !0 } = {}) {
        if (((o.pollingEnabled = !0), n))
            return (g('live', 'Sincronizando...'), void J());
        V();
    }
    function Z({ reason: n = 'paused' } = {}) {
        ((o.pollingEnabled = !1), (o.failureStreak = 0), P());
        const e = String(n || 'paused').toLowerCase();
        return 'offline' === e
            ? (g('offline', 'Sin conexion'),
              void x('Sin conexion. Mantener protocolo manual de llamados.'))
            : 'hidden' === e
              ? (g('paused', 'En pausa (pestana oculta)'),
                void x('Pantalla oculta. Reanuda al volver al frente.'))
              : (g('paused', 'En pausa'), void x('Sincronizacion pausada.'));
    }
    function K() {
        const n = r('displayClock');
        n &&
            (n.textContent = new Date().toLocaleTimeString('es-EC', {
                hour: '2-digit',
                minute: '2-digit',
            }));
    }
    document.addEventListener('DOMContentLoaded', function () {
        ((document.body.dataset.displayMode = 'star'),
            b(),
            (function () {
                const e = localStorage.getItem(n);
                o.bellMuted = '1' === e;
            })(),
            (function () {
                o.lastSnapshot = null;
                try {
                    const n = localStorage.getItem(e);
                    if (!n) return (B(), null);
                    const t = JSON.parse(n);
                    if (!t || 'object' != typeof t) return (B(), null);
                    const a = Date.parse(String(t.savedAt || ''));
                    if (!Number.isFinite(a)) return (B(), null);
                    if (Date.now() - a > 216e5) return (B(), null);
                    const i = T(t.data || {}),
                        l = { savedAt: new Date(a).toISOString(), data: i };
                    return ((o.lastSnapshot = l), B(), l);
                } catch (n) {
                    return (B(), null);
                }
            })(),
            K(),
            (o.clockId = window.setInterval(K, 1e3)),
            y(),
            L(),
            h(),
            v());
        const t = A();
        t instanceof HTMLButtonElement &&
            t.addEventListener('click', () => {
                G();
            });
        const a = k();
        a instanceof HTMLButtonElement &&
            a.addEventListener('click', () => {
                E();
            });
        const i = (function () {
            let n = r('displayBellTestBtn');
            if (n instanceof HTMLButtonElement) return n;
            const e = document.querySelector('.display-clock-wrap');
            return e
                ? ((n = document.createElement('button')),
                  (n.id = 'displayBellTestBtn'),
                  (n.type = 'button'),
                  (n.className =
                      'display-control-btn display-control-btn-muted'),
                  (n.textContent = 'Probar campanilla'),
                  n.setAttribute('aria-label', 'Probar campanilla de llamados'),
                  e.appendChild(n),
                  n)
                : null;
        })();
        i instanceof HTMLButtonElement &&
            i.addEventListener('click', () => {
                (O({ source: 'manual_test', force: !0 }),
                    x(
                        'Campanilla de prueba ejecutada. Si no escuchas sonido, revisa audio del equipo/TV.'
                    ));
            });
        const l = (function () {
            let n = r('displaySnapshotClearBtn');
            if (n instanceof HTMLButtonElement) return n;
            const e = document.querySelector('.display-clock-wrap');
            return e
                ? ((n = document.createElement('button')),
                  (n.id = 'displaySnapshotClearBtn'),
                  (n.type = 'button'),
                  (n.className =
                      'display-control-btn display-control-btn-muted'),
                  (n.textContent = 'Limpiar respaldo'),
                  n.setAttribute(
                      'aria-label',
                      'Limpiar respaldo local del panel'
                  ),
                  e.appendChild(n),
                  n)
                : null;
        })();
        (l instanceof HTMLButtonElement &&
            l.addEventListener('click', () => {
                H({ announce: !0 });
            }),
            M(),
            B(),
            g('paused', 'Sincronizacion lista'),
            N(o.lastSnapshot, { mode: 'startup' }) ||
                x('Esperando primera sincronizacion...'));
        const s = () => {
            z({ source: 'user_gesture' });
        };
        (window.addEventListener('pointerdown', s, { once: !0 }),
            window.addEventListener('keydown', s, { once: !0 }),
            W({ immediate: !0 }),
            document.addEventListener('visibilitychange', () => {
                document.hidden
                    ? Z({ reason: 'hidden' })
                    : W({ immediate: !0 });
            }),
            window.addEventListener('online', () => {
                W({ immediate: !0 });
            }),
            window.addEventListener('offline', () => {
                Z({ reason: 'offline' });
            }),
            window.addEventListener('beforeunload', () => {
                (Z({ reason: 'paused' }),
                    o.clockId &&
                        (window.clearInterval(o.clockId), (o.clockId = 0)));
            }),
            window.addEventListener('keydown', (n) => {
                if (!n.altKey || !n.shiftKey) return;
                const e = String(n.code || '').toLowerCase();
                return 'keyr' === e
                    ? (n.preventDefault(), void G())
                    : 'keym' === e
                      ? (n.preventDefault(), void E())
                      : 'keyb' === e
                        ? (n.preventDefault(),
                          O({ source: 'shortcut_test', force: !0 }),
                          void x('Campanilla de prueba ejecutada con teclado.'))
                        : void (
                              'keyx' === e &&
                              (n.preventDefault(), H({ announce: !0 }))
                          );
            }));
    });
})();
