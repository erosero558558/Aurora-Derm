const t = 'adminUiVariant',
    e = 'admin_ui_reset',
    n = new Set(['legacy', 'sony_v2']),
    a = new Set(['1', 'true', 'yes', 'on', 'clear', 'reset']),
    i = new Map([
        ['digit1', 'dashboard'],
        ['digit2', 'appointments'],
        ['digit3', 'callbacks'],
        ['digit4', 'reviews'],
        ['digit5', 'availability'],
        ['digit6', 'queue'],
        ['numpad1', 'dashboard'],
        ['numpad2', 'appointments'],
        ['numpad3', 'callbacks'],
        ['numpad4', 'reviews'],
        ['numpad5', 'availability'],
        ['numpad6', 'queue'],
        ['1', 'dashboard'],
        ['2', 'appointments'],
        ['3', 'callbacks'],
        ['4', 'reviews'],
        ['5', 'availability'],
        ['6', 'queue'],
    ]),
    o = Object.freeze({
        '!': 'digit1',
        '@': 'digit2',
        '#': 'digit3',
        $: 'digit4',
        '%': 'digit5',
        '^': 'digit6',
        '"': 'digit2',
        '&': 'digit6',
    });
function r(t) {
    const e = String(t || '')
        .trim()
        .toLowerCase();
    return n.has(e) ? e : '';
}
function c(e) {
    const n = r(e);
    if (n)
        try {
            localStorage.setItem(t, n);
        } catch (t) {}
}
function s(t) {
    document.documentElement.setAttribute('data-admin-ui', t);
}
function u(t) {
    document.documentElement.setAttribute(
        'data-admin-ready',
        t ? 'true' : 'false'
    );
}
function d(t) {
    const e = 'sony_v2' === t;
    Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach(
        (t) => {
            const n = String(t.getAttribute('href') || '').toLowerCase(),
                a =
                    n.includes('styles.min.css') ||
                    n.includes('admin.min.css') ||
                    n.includes('admin.css'),
                i =
                    'adminLegacyFonts' === t.id ||
                    'adminLegacyFontAwesome' === t.id;
            a || i
                ? (t.disabled = e)
                : 'adminV2Styles' === t.id && (t.disabled = !e);
        }
    );
}
async function l(t, e = '') {
    if (!t || 'object' != typeof t) return;
    if (e) {
        const n = t[e];
        if ('function' == typeof n) return void (await n());
    }
    const n = t.default;
    'function' != typeof n
        ? n && 'function' == typeof n.then && (await n)
        : await n();
}
async function y(t) {
    'sony_v2' !== t
        ? await (async function () {
              const t =
                  await import('./js/admin-chunks/legacy-index-CzSo9Nse.js');
              await l(t, 'bootLegacyAdminAuto');
          })()
        : await (async function () {
              const t = await import('./js/admin-chunks/index-D6Z6dOAt.js');
              await l(t);
          })();
}
!(async function () {
    u(!1);
    const n = (function () {
            const t = (t) => {
                if (
                    'true' ===
                    document.documentElement.getAttribute('data-admin-ready')
                )
                    return;
                if (
                    (e = t.target) instanceof HTMLElement &&
                    (e.isContentEditable ||
                        Boolean(
                            e.closest(
                                'input, textarea, select, [contenteditable="true"]'
                            )
                        ))
                )
                    return;
                var e;
                const n = (function (t) {
                    if (!t.altKey || !t.shiftKey || t.ctrlKey || t.metaKey)
                        return '';
                    const e = String(t.key || '').toLowerCase(),
                        n = String(t.code || '').toLowerCase(),
                        a = [];
                    (n && a.push(n), e && a.push(e));
                    const r = o[e];
                    r && a.push(r);
                    for (const t of a) {
                        const e = i.get(t);
                        if (e) return e;
                    }
                    return '';
                })(t);
                n &&
                    (t.preventDefault(),
                    (function (t) {
                        if (t)
                            try {
                                localStorage.setItem('adminLastSection', t);
                            } catch (t) {}
                    })(n),
                    (function (t) {
                        if (t)
                            try {
                                const e = new URL(window.location.href);
                                ((e.hash = `#${t}`),
                                    window.history.replaceState(
                                        null,
                                        '',
                                        `${e.pathname}${e.search}${e.hash}`
                                    ));
                            } catch (t) {}
                    })(n));
            };
            return (
                window.addEventListener('keydown', t, !0),
                () => window.removeEventListener('keydown', t, !0)
            );
        })(),
        l = (function () {
            try {
                const t = new URL(window.location.href);
                if (!t.searchParams.has(e)) return !1;
                const n = String(t.searchParams.get(e) || '')
                    .trim()
                    .toLowerCase();
                return !n || a.has(n);
            } catch (t) {
                return !1;
            }
        })();
    l &&
        (function (t) {
            try {
                const e = new URL(window.location.href);
                if (!e.searchParams.has(t)) return;
                e.searchParams.delete(t);
                const n = e.searchParams.toString(),
                    a = `${e.pathname}${n ? `?${n}` : ''}${e.hash}`;
                window.history.replaceState(null, '', a);
            } catch (t) {}
        })(e);
    try {
        const e = await (async function (
            { resetStorage: e } = { resetStorage: !1 }
        ) {
            let n;
            e &&
                (function () {
                    try {
                        localStorage.removeItem(t);
                    } catch (t) {}
                })();
            const a = async () => (
                    void 0 !== n ||
                        (n = await (async function () {
                            const t =
                                    'function' == typeof AbortController
                                        ? new AbortController()
                                        : null,
                                e = window.setTimeout(() => {
                                    t && t.abort();
                                }, 3500);
                            try {
                                const e = await fetch(
                                    '/api.php?resource=features',
                                    {
                                        method: 'GET',
                                        credentials: 'same-origin',
                                        headers: { Accept: 'application/json' },
                                        ...(t ? { signal: t.signal } : {}),
                                    }
                                );
                                if (!e.ok) return null;
                                const n = await e.json();
                                return !(
                                    !n ||
                                    !0 !== n.ok ||
                                    !n.data ||
                                    !0 !== n.data.admin_sony_ui
                                );
                            } catch (t) {
                                return null;
                            } finally {
                                window.clearTimeout(e);
                            }
                        })()),
                    n
                ),
                i = (function () {
                    try {
                        return r(
                            new URL(window.location.href).searchParams.get(
                                'admin_ui'
                            )
                        );
                    } catch (t) {
                        return '';
                    }
                })();
            if (i)
                return 'sony_v2' === i && !1 === (await a())
                    ? (e || c('legacy'), 'legacy')
                    : (e || c(i), i);
            const o = e
                ? ''
                : (function () {
                      try {
                          return r(localStorage.getItem(t));
                      } catch (t) {
                          return '';
                      }
                  })();
            return o
                ? 'sony_v2' === o && !1 === (await a())
                    ? (c('legacy'), 'legacy')
                    : o
                : !0 === (await a())
                  ? (c('sony_v2'), 'sony_v2')
                  : 'legacy';
        })({ resetStorage: l });
        (s(e), d(e));
        try {
            (await y(e), u(!0));
        } catch (t) {
            if ('legacy' !== e)
                return (
                    s('legacy'),
                    d('legacy'),
                    await y('legacy'),
                    void u(!0)
                );
            throw (u(!1), t);
        }
    } catch (t) {
        throw (u(!1), t);
    } finally {
        n();
    }
})();
