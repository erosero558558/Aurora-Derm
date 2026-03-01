const ADMIN_UI_QUERY_KEY = 'admin_ui';
const ADMIN_UI_STORAGE_KEY = 'adminUiVariant';
const ADMIN_UI_RESET_QUERY_KEY = 'admin_ui_reset';
const ADMIN_UI_FALLBACK = 'legacy';
const ADMIN_UI_VARIANTS = new Set(['legacy', 'sony_v2']);
const TRUTHY_QUERY_VALUES = new Set([
    '1',
    'true',
    'yes',
    'on',
    'clear',
    'reset',
]);
const FEATURE_FLAG_TIMEOUT_MS = 3500;
const ADMIN_LAST_SECTION_STORAGE_KEY = 'adminLastSection';
const PREBOOT_SECTION_SHORTCUTS = new Map([
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
]);
const SHIFTED_SHORTCUT_ALIASES = Object.freeze({
    '!': 'digit1',
    '@': 'digit2',
    '#': 'digit3',
    $: 'digit4',
    '%': 'digit5',
    '^': 'digit6',
    '"': 'digit2',
    '&': 'digit6',
});

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

function normalizeVariant(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    return ADMIN_UI_VARIANTS.has(normalized) ? normalized : '';
}

function readVariantFromQuery() {
    try {
        const url = new URL(window.location.href);
        return normalizeVariant(url.searchParams.get(ADMIN_UI_QUERY_KEY));
    } catch (_error) {
        return '';
    }
}

function readVariantFromStorage() {
    try {
        return normalizeVariant(localStorage.getItem(ADMIN_UI_STORAGE_KEY));
    } catch (_error) {
        return '';
    }
}

function clearStoredVariant() {
    try {
        localStorage.removeItem(ADMIN_UI_STORAGE_KEY);
    } catch (_error) {
        // no-op
    }
}

function persistVariant(value) {
    const variant = normalizeVariant(value);
    if (!variant) return;
    try {
        localStorage.setItem(ADMIN_UI_STORAGE_KEY, variant);
    } catch (_error) {
        // no-op
    }
}

function readResetStorageFromQuery() {
    try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(ADMIN_UI_RESET_QUERY_KEY)) {
            return false;
        }
        const rawValue = String(
            url.searchParams.get(ADMIN_UI_RESET_QUERY_KEY) || ''
        )
            .trim()
            .toLowerCase();
        if (!rawValue) {
            return true;
        }
        return TRUTHY_QUERY_VALUES.has(rawValue);
    } catch (_error) {
        return false;
    }
}

function stripQueryParam(name) {
    try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(name)) {
            return;
        }
        url.searchParams.delete(name);
        const nextSearch = url.searchParams.toString();
        const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
        window.history.replaceState(null, '', nextUrl);
    } catch (_error) {
        // no-op
    }
}

async function readVariantFromFeatureFlag() {
    const supportsAbortController = typeof AbortController === 'function';
    const controller = supportsAbortController ? new AbortController() : null;
    const timeoutId = window.setTimeout(() => {
        if (controller) {
            controller.abort();
        }
    }, FEATURE_FLAG_TIMEOUT_MS);

    try {
        const response = await fetch('/api.php?resource=features', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
            },
            ...(controller ? { signal: controller.signal } : {}),
        });
        if (!response.ok) return null;
        const payload = await response.json();
        const featureEnabled =
            payload &&
            payload.ok === true &&
            payload.data &&
            payload.data.admin_sony_ui === true;
        return featureEnabled ? true : false;
    } catch (_error) {
        return null;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

async function resolveVariant({ resetStorage } = { resetStorage: false }) {
    if (resetStorage) {
        clearStoredVariant();
    }

    let featureFlagCache = undefined;
    const getFeatureFlagEnabled = async () => {
        if (featureFlagCache !== undefined) {
            return featureFlagCache;
        }
        featureFlagCache = await readVariantFromFeatureFlag();
        return featureFlagCache;
    };

    const queryVariant = readVariantFromQuery();
    if (queryVariant) {
        if (queryVariant === 'sony_v2') {
            const featureFlagEnabled = await getFeatureFlagEnabled();
            if (featureFlagEnabled === false) {
                if (!resetStorage) {
                    persistVariant('legacy');
                }
                return 'legacy';
            }
        }
        if (!resetStorage) {
            persistVariant(queryVariant);
        }
        return queryVariant;
    }

    const storageVariant = resetStorage ? '' : readVariantFromStorage();
    if (storageVariant) {
        if (storageVariant === 'sony_v2') {
            const featureFlagEnabled = await getFeatureFlagEnabled();
            if (featureFlagEnabled === false) {
                persistVariant('legacy');
                return 'legacy';
            }
        }
        return storageVariant;
    }

    const featureFlagEnabled = await getFeatureFlagEnabled();
    if (featureFlagEnabled === true) {
        persistVariant('sony_v2');
        return 'sony_v2';
    }

    return ADMIN_UI_FALLBACK;
}

function setDocumentVariant(variant) {
    document.documentElement.setAttribute('data-admin-ui', variant);
}

function setDocumentReadyState(ready) {
    document.documentElement.setAttribute(
        'data-admin-ready',
        ready ? 'true' : 'false'
    );
}

function toggleStylesheets(variant) {
    const isV2 = variant === 'sony_v2';
    const links = Array.from(
        document.querySelectorAll('link[rel="stylesheet"]')
    );

    links.forEach((linkEl) => {
        const href = String(linkEl.getAttribute('href') || '').toLowerCase();
        const isLegacyStyle =
            href.includes('styles.min.css') ||
            href.includes('admin.min.css') ||
            href.includes('admin.css');
        const isLegacyAuxStyle =
            linkEl.id === 'adminLegacyFonts' ||
            linkEl.id === 'adminLegacyFontAwesome';

        if (isLegacyStyle || isLegacyAuxStyle) {
            linkEl.disabled = isV2;
            return;
        }

        if (linkEl.id === 'adminV2Styles') {
            linkEl.disabled = !isV2;
        }
    });
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

async function loadSonyVariant() {
    const module = await import('../admin-v2/index.js');
    await bootModuleExport(module);
}

async function loadLegacyVariant() {
    const module = await import('./legacy-index.js');
    await bootModuleExport(module, 'bootLegacyAdminAuto');
}

async function loadVariant(variant) {
    if (variant === 'sony_v2') {
        await loadSonyVariant();
        return;
    }
    await loadLegacyVariant();
}

(async function bootstrapAdminVariant() {
    setDocumentReadyState(false);
    const removePrebootShortcutCapture = installPrebootShortcutCapture();
    const resetStorage = readResetStorageFromQuery();
    if (resetStorage) {
        stripQueryParam(ADMIN_UI_RESET_QUERY_KEY);
    }
    try {
        const variant = await resolveVariant({ resetStorage });
        setDocumentVariant(variant);
        toggleStylesheets(variant);

        try {
            await loadVariant(variant);
            setDocumentReadyState(true);
        } catch (error) {
            if (variant !== 'legacy') {
                setDocumentVariant('legacy');
                toggleStylesheets('legacy');
                await loadVariant('legacy');
                setDocumentReadyState(true);
                return;
            }
            setDocumentReadyState(false);
            throw error;
        }
    } catch (error) {
        setDocumentReadyState(false);
        throw error;
    } finally {
        removePrebootShortcutCapture();
    }
})();
