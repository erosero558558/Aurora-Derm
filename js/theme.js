import { withDeployAssetVersion } from '../src/apps/shared/utils.js';
import { loadDeferredModule, runDeferredModule } from './loader.js';
import { state } from './state.js';
import { THEME_STORAGE_KEY, VALID_THEME_MODES } from './config.js';

const UI_BUNDLE_URL = withDeployAssetVersion(
    '/js/engines/ui-bundle.js?v=20260220-consolidated1'
);
const systemThemeQuery = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

function getThemeEngineDeps() {
    return {
        getCurrentThemeMode: () => state.currentThemeMode,
        setCurrentThemeMode: (mode) => {
            state.currentThemeMode = VALID_THEME_MODES.has(mode) ? mode : 'system';
        },
        themeStorageKey: THEME_STORAGE_KEY,
        validThemeModes: Array.from(VALID_THEME_MODES),
        getSystemThemeQuery: () => systemThemeQuery,
    };
}

export function loadThemeEngine() {
    return loadDeferredModule({
        cacheKey: 'theme-engine',
        src: UI_BUNDLE_URL,
        scriptDataAttribute: 'data-ui-bundle',
        resolveModule: () => window.Piel && window.Piel.ThemeEngine,
        isModuleReady: (module) =>
            !!(module && typeof module.init === 'function'),
        onModuleReady: (module) => module.init(getThemeEngineDeps()),
        missingApiError: 'theme-engine loaded without API',
        loadError: 'No se pudo cargar theme-engine.js',
        logLabel: 'Theme engine',
    });
}

export function setThemeMode(mode) {
    runDeferredModule(loadThemeEngine, (engine) => engine.setThemeMode(mode));
}

export function initThemeMode() {
    runDeferredModule(loadThemeEngine, (engine) => engine.initThemeMode());
}
