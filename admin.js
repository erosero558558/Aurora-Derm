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
    n = Object.freeze({
        '!': 'digit1',
        '@': 'digit2',
        '#': 'digit3',
        $: 'digit4',
        '%': 'digit5',
        '"': 'digit2',
    });
function e(t) {
    document.documentElement.setAttribute(
        'data-admin-ready',
        t ? 'true' : 'false'
    );
}
!(async function () {
    (document.documentElement.setAttribute('data-admin-ui', 'sony_v3'),
        document.documentElement.setAttribute('data-ops-tone', 'light'),
        e(!1));
    const i = (function () {
        const e = (e) => {
            if (
                'true' ===
                document.documentElement.getAttribute('data-admin-ready')
            )
                return;
            if (
                (i = e.target) instanceof HTMLElement &&
                (i.isContentEditable ||
                    Boolean(
                        i.closest(
                            'input, textarea, select, [contenteditable="true"]'
                        )
                    ))
            )
                return;
            var i;
            const a = (function (e) {
                if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey)
                    return '';
                const i = String(e.key || '').toLowerCase(),
                    a = String(e.code || '').toLowerCase(),
                    o = [];
                (a && o.push(a), i && o.push(i));
                const c = n[i];
                c && o.push(c);
                for (const n of o) {
                    const e = t.get(n);
                    if (e) return e;
                }
                return '';
            })(e);
            a &&
                (e.preventDefault(),
                (function (t) {
                    if (t)
                        try {
                            localStorage.setItem('adminLastSection', t);
                        } catch (t) {}
                })(a),
                (function (t) {
                    if (t)
                        try {
                            const n = new URL(window.location.href);
                            ((n.hash = `#${t}`),
                                window.history.replaceState(
                                    null,
                                    '',
                                    `${n.pathname}${n.search}${n.hash}`
                                ));
                        } catch (t) {}
                })(a));
        };
        return (
            window.addEventListener('keydown', e, !0),
            () => window.removeEventListener('keydown', e, !0)
        );
    })();
    try {
        (await (async function () {
            const t = await import('./js/admin-chunks/index-MyvPG610.js');
            await (async function (t, n = '') {
                if (!t || 'object' != typeof t) return;
                if (n) {
                    const e = t[n];
                    if ('function' == typeof e) return void (await e());
                }
                const e = t.default;
                'function' != typeof e
                    ? e && 'function' == typeof e.then && (await e)
                    : await e();
            })(t);
        })(),
            e(!0));
    } catch (t) {
        throw (e(!1), t);
    } finally {
        i();
    }
})();
