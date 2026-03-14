const ADMIN_LAST_SECTION_STORAGE_KEY = 'adminLastSection';
const PREBOOT_SECTION_SHORTCUTS = new Map([
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
const SHIFTED_SHORTCUT_ALIASES = Object.freeze({
    '!': 'digit1',
    '@': 'digit2',
    '#': 'digit3',
    $: 'digit4',
    '%': 'digit5',
    '"': 'digit2',
});

function setDocumentVariant() {
    document.documentElement.setAttribute('data-admin-ui', 'sony_v3');
}

function setDocumentReadyState(ready) {
    document.documentElement.setAttribute(
        'data-admin-ready',
        ready ? 'true' : 'false'
    );
}

function isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]')
    );
}

function resolvePrebootShortcutSection(event) {
    if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) {
        return '';
    }

    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '').toLowerCase();
    const candidates = [];

    if (code) candidates.push(code);
    if (key) candidates.push(key);

    const shiftedAlias = SHIFTED_SHORTCUT_ALIASES[key];
    if (shiftedAlias) {
        candidates.push(shiftedAlias);
    }

    for (const candidate of candidates) {
        const section = PREBOOT_SECTION_SHORTCUTS.get(candidate);
        if (section) return section;
    }

    return '';
}

function persistLastSection(section) {
    if (!section) return;
    try {
        localStorage.setItem(ADMIN_LAST_SECTION_STORAGE_KEY, section);
    } catch (_error) {
        // no-op
    }
}

function updateSectionHash(section) {
    if (!section) return;
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

function installPrebootShortcutCapture() {
    const handler = (event) => {
        if (
            document.documentElement.getAttribute('data-admin-ready') === 'true'
        ) {
            return;
        }
        if (isTypingTarget(event.target)) {
            return;
        }

        const section = resolvePrebootShortcutSection(event);
        if (!section) return;

        event.preventDefault();
        persistLastSection(section);
        updateSectionHash(section);
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
}

async function bootModuleExport(module, preferredExportName = '') {
    if (!module || typeof module !== 'object') return;

    if (preferredExportName) {
        const preferred = module[preferredExportName];
        if (typeof preferred === 'function') {
            await preferred();
            return;
        }
    }

    const exported = module.default;
    if (typeof exported === 'function') {
        await exported();
        return;
    }

    if (exported && typeof exported.then === 'function') {
        await exported;
    }
}

async function loadSonyV3Variant() {
    const module = await import('../admin-v3/index.js');
    await bootModuleExport(module);
}

(async function bootstrapAdmin() {
    setDocumentVariant();
    setDocumentReadyState(false);
    const removePrebootShortcutCapture = installPrebootShortcutCapture();

    try {
        await loadSonyV3Variant();
        setDocumentReadyState(true);
    } catch (error) {
        setDocumentReadyState(false);
        throw error;
    } finally {
        removePrebootShortcutCapture();
    }
})();
