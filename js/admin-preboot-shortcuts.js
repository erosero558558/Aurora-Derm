(function installAdminPreboot() {
    const SECTION_BY_SHORTCUT = new Map([
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
    ]);
    const SHIFTED_ALIASES = Object.freeze({
        '!': 'digit1',
        '@': 'digit2',
        '#': 'digit3',
        $: 'digit4',
        '%': 'digit5',
        '"': 'digit2',
    });
    const LAST_SECTION_KEY = 'adminLastSection';

    function isTypingTarget(target) {
        if (!(target instanceof HTMLElement)) return false;
        if (target.isContentEditable) return true;
        return Boolean(
            target.closest('input, textarea, select, [contenteditable="true"]')
        );
    }

    function resolveSection(event) {
        if (
            !event.altKey ||
            !event.shiftKey ||
            event.ctrlKey ||
            event.metaKey
        ) {
            return '';
        }

        const key = String(event.key || '').toLowerCase();
        const code = String(event.code || '').toLowerCase();
        const candidates = [];

        if (code) candidates.push(code);
        if (key) candidates.push(key);
        if (SHIFTED_ALIASES[key]) {
            candidates.push(SHIFTED_ALIASES[key]);
        }

        for (const candidate of candidates) {
            const section = SECTION_BY_SHORTCUT.get(candidate);
            if (section) return section;
        }

        return '';
    }

    function persistSection(section) {
        try {
            localStorage.setItem(LAST_SECTION_KEY, section);
        } catch (_error) {
            // no-op
        }

        try {
            const url = new URL(window.location.href);
            url.hash = `#${section}`;
            window.history.replaceState(
                null,
                '',
                `${url.pathname}${url.search}${url.hash}`
            );
        } catch (_error) {
            // no-op
        }
    }

    document.documentElement.setAttribute('data-admin-ui', 'sony_v3');

    window.addEventListener(
        'keydown',
        (event) => {
            if (isTypingTarget(event.target)) return;
            const section = resolveSection(event);
            if (!section) return;
            persistSection(section);
        },
        true
    );
})();
