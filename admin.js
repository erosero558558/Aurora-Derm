const t = new Map([
        ['digit1', 'dashboard'],
        ['digit2', 'appointments'],
        ['digit3', 'callbacks'],
        ['digit4', 'clinical-history'],
        ['digit5', 'availability'],
        ['numpad1', 'dashboard'],
        ['numpad2', 'appointments'],
        ['numpad3', 'callbacks'],
        ['numpad4', 'clinical-history'],
        ['numpad5', 'availability'],
        ['1', 'dashboard'],
        ['2', 'appointments'],
        ['3', 'callbacks'],
        ['4', 'clinical-history'],
        ['5', 'availability'],
    ]),
    e = Object.freeze({
        '!': 'digit1',
        '@': 'digit2',
        '#': 'digit3',
        $: 'digit4',
        '%': 'digit5',
        '"': 'digit2',
    });
function n(t) {
    document.documentElement.setAttribute(
        'data-admin-ready',
        t ? 'true' : 'false'
    );
}
!(async function () {
    (document.documentElement.setAttribute('data-admin-ui', 'sony_v3'),
        window.PielOpsTheme &&
        'function' == typeof window.PielOpsTheme.initAutoOpsTheme
            ? window.PielOpsTheme.initAutoOpsTheme({
                  surface: 'admin',
                  family: 'command',
              })
            : document.documentElement.hasAttribute('data-theme-mode') ||
              document.documentElement.setAttribute(
                  'data-theme-mode',
                  'system'
              ),
        n(!1));
    const i = (function () {
        const n = (n) => {
            if (
                'true' ===
                document.documentElement.getAttribute('data-admin-ready')
            )
                return;
            if (
                (i = n.target) instanceof HTMLElement &&
                (i.isContentEditable ||
                    Boolean(
                        i.closest(
                            'input, textarea, select, [contenteditable="true"]'
                        )
                    ))
            )
                return;
            var i;
            const a = (function (n) {
                if (!n.altKey || !n.shiftKey || n.ctrlKey || n.metaKey)
                    return '';
                const i = String(n.key || '').toLowerCase(),
                    a = String(n.code || '').toLowerCase(),
                    o = [];
                (a && o.push(a), i && o.push(i));
                const c = e[i];
                c && o.push(c);
                for (const e of o) {
                    const n = t.get(e);
                    if (n) return n;
                }
                return '';
            })(n);
            a &&
                (n.preventDefault(),
                (function (t) {
                    if (t)
                        try {
                            localStorage.setItem('adminLastSection', t);
                        } catch (t) {}
                })(a),
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
                })(a));
        };
        return (
            window.addEventListener('keydown', n, !0),
            () => window.removeEventListener('keydown', n, !0)
        );
    })();
    try {
        (await (async function () {
            const t = await import('./js/admin-chunks/index-CISN6xpa.js');
            await (async function (t, e = '') {
                if (!t || 'object' != typeof t) return;
                if (e) {
                    const n = t[e];
                    if ('function' == typeof n) return void (await n());
                }
                const n = t.default;
                'function' != typeof n
                    ? n && 'function' == typeof n.then && (await n)
                    : await n();
            })(t);
        })(),
            n(!0));
    } catch (t) {
        throw (n(!1), t);
    } finally {
        i();
    }
})();
