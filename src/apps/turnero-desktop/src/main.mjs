import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Menu, ipcMain, powerSaveBlocker } from 'electron';
import { ensureRuntimeConfig, persistRuntimeConfig } from './config/store.mjs';
import { buildUpdateFeedUrl, mergeRuntimeConfig } from './config/contracts.mjs';
import { createNavigationPolicy } from './runtime/navigation.mjs';
import { runPreflightChecks } from './runtime/preflight.mjs';
import {
    getBrowserWindowOptions,
    shouldPreventDisplaySleep,
    shouldUseKioskMode,
} from './runtime/window-options.mjs';
import {
    buildDesktopHeartbeatEndpoint,
    buildDesktopHeartbeatPayload,
    DESKTOP_HEARTBEAT_INTERVAL_MS,
    shouldRunDesktopHeartbeat,
} from './runtime/desktop-heartbeat.mjs';
import { createUpdater } from './updater.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(__dirname, 'preload.cjs');
const bootHtmlPath = path.join(__dirname, 'renderer', 'boot.html');
const RETRY_DELAYS_MS = [3000, 5000, 10000, 15000];

let mainWindow = null;
let currentRuntime = null;
let currentConfig = null;
let navigationPolicy = null;
let retryCount = 0;
let retryTimer = null;
let displaySleepBlockerId = null;
let updater = null;
let settingsMode = false;
let firstRunPending = false;
let desktopHeartbeatTimer = null;
let desktopHeartbeatInFlight = false;
let desktopHeartbeatActive = false;
let lastBootStatus = {
    level: 'info',
    phase: 'boot',
    message: 'Inicializando shell desktop...',
};

function getSurfaceRuntimeLabels(config = currentConfig) {
    const surface = String(config?.surface || 'operator')
        .trim()
        .toLowerCase();
    if (surface === 'kiosk') {
        return {
            surfaceId: 'kiosk',
            surfaceLabel: 'Kiosco',
            surfaceDesktopLabel: 'Turnero Kiosco',
        };
    }

    return {
        surfaceId: 'operator',
        surfaceLabel: 'Operador',
        surfaceDesktopLabel: 'Turnero Operador',
    };
}

function getRuntimeSnapshot() {
    const packaged = app.isPackaged;
    const supportsNativeUpdate =
        process.platform === 'win32' || process.platform === 'darwin';
    const surfaceLabels = getSurfaceRuntimeLabels(currentConfig);

    return {
        config: currentConfig,
        status: lastBootStatus,
        surfaceUrl: navigationPolicy ? navigationPolicy.surfaceUrl : '',
        packaged,
        platform: process.platform,
        arch: process.arch,
        version: app.getVersion(),
        name: app.getName(),
        configPath: currentRuntime ? currentRuntime.configPath : '',
        ...surfaceLabels,
        updateFeedUrl:
            supportsNativeUpdate && currentConfig
                ? buildUpdateFeedUrl(currentConfig, process.platform)
                : '',
        firstRun: firstRunPending,
        settingsMode,
        appMode: packaged ? 'packaged' : 'development',
    };
}

function log(level, message) {
    const prefix = `[turnero-desktop:${level}]`;
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        prefix,
        message
    );
}

function setBootStatus(payload) {
    lastBootStatus = {
        ...lastBootStatus,
        ...payload,
        at: new Date().toISOString(),
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('turnero:boot-status', lastBootStatus);
    }
    if (desktopHeartbeatActive) {
        void sendDesktopHeartbeat('status_change');
    }
}

function clearDesktopHeartbeatTimer() {
    if (desktopHeartbeatTimer) {
        clearInterval(desktopHeartbeatTimer);
        desktopHeartbeatTimer = null;
    }
}

async function sendDesktopHeartbeat(reason = 'interval') {
    if (desktopHeartbeatInFlight || !currentConfig) {
        return false;
    }

    const snapshot = getRuntimeSnapshot();
    if (!shouldRunDesktopHeartbeat(snapshot)) {
        return false;
    }

    const endpoint = buildDesktopHeartbeatEndpoint(snapshot);
    const payload = buildDesktopHeartbeatPayload(snapshot, {
        reason,
    });
    if (!endpoint || !payload) {
        return false;
    }

    desktopHeartbeatInFlight = true;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        return response.ok;
    } catch (error) {
        log('warn', `desktop heartbeat failed: ${error.message}`);
        return false;
    } finally {
        desktopHeartbeatInFlight = false;
    }
}

function startDesktopHeartbeat(reason = 'boot_page') {
    clearDesktopHeartbeatTimer();
    desktopHeartbeatActive = false;

    const snapshot = getRuntimeSnapshot();
    if (!shouldRunDesktopHeartbeat(snapshot)) {
        return;
    }

    desktopHeartbeatActive = true;
    void sendDesktopHeartbeat(reason);
    desktopHeartbeatTimer = setInterval(() => {
        void sendDesktopHeartbeat('interval');
    }, DESKTOP_HEARTBEAT_INTERVAL_MS);
}

function stopDesktopHeartbeat() {
    desktopHeartbeatActive = false;
    clearDesktopHeartbeatTimer();
}

async function loadBootPage() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }
    settingsMode = true;
    await mainWindow.loadFile(bootHtmlPath);
    startDesktopHeartbeat(firstRunPending ? 'first_run' : 'boot_page');
    setBootStatus(lastBootStatus);
}

function clearRetryTimer() {
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
}

function scheduleReload(reason) {
    clearRetryTimer();
    settingsMode = false;
    const delay =
        RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
    retryCount += 1;
    setBootStatus({
        level: 'warn',
        phase: 'retry',
        message: `${reason}. Reintentando en ${Math.round(delay / 1000)}s.`,
    });
    retryTimer = setTimeout(() => {
        void loadSurface('retry');
    }, delay);
}

async function loadSurface(source = 'launch') {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    clearRetryTimer();
    stopDesktopHeartbeat();
    settingsMode = false;
    setBootStatus({
        level: 'info',
        phase: 'loading',
        message: `Conectando ${currentConfig.surface} a ${currentConfig.baseUrl} (${source})`,
    });

    try {
        await mainWindow.loadURL(navigationPolicy.surfaceUrl);
    } catch (error) {
        log('error', `loadURL failed: ${error.message}`);
        await loadBootPage();
        scheduleReload(
            `No se pudo abrir la superficie ${currentConfig.surface}`
        );
    }
}

async function openSettings(reason = 'manual') {
    await loadBootPage();
    setBootStatus({
        level: 'info',
        phase: 'settings',
        message: firstRunPending
            ? `Configura ${currentConfig.surface} antes del primer arranque.`
            : `Configuracion del equipo abierta (${reason}).`,
    });
}

function attachNavigationGuards(windowRef) {
    const contents = windowRef.webContents;

    contents.on('will-navigate', (event, targetUrl) => {
        if (!navigationPolicy.isAllowedNavigation(targetUrl)) {
            event.preventDefault();
            setBootStatus({
                level: 'warn',
                phase: 'blocked',
                message: 'Navegacion externa bloqueada por el shell desktop.',
            });
        }
    });

    contents.setWindowOpenHandler(() => ({
        action: 'deny',
    }));

    contents.on('before-input-event', (event, input) => {
        if (String(input.type || '').toLowerCase() !== 'keydown') {
            return;
        }

        const key = String(input.key || '').toLowerCase();
        const openSettingsShortcut =
            key === 'f10' || ((input.control || input.meta) && key === ',');
        if (!openSettingsShortcut) {
            return;
        }

        event.preventDefault();
        void openSettings('shortcut');
    });

    contents.on('render-process-gone', async (_event, details) => {
        log('warn', `render-process-gone: ${details.reason}`);
        await loadBootPage();
        scheduleReload('La aplicacion remota se cerro de forma inesperada');
    });

    contents.on(
        'did-fail-load',
        async (
            _event,
            errorCode,
            errorDescription,
            validatedUrl,
            isMainFrame
        ) => {
            if (!isMainFrame) {
                return;
            }

            if (
                !validatedUrl ||
                !navigationPolicy.isAllowedNavigation(validatedUrl)
            ) {
                return;
            }

            log(
                'warn',
                `did-fail-load ${errorCode}: ${errorDescription} (${validatedUrl})`
            );
            await loadBootPage();
            scheduleReload(
                `La superficie ${currentConfig.surface} no pudo cargar (${errorDescription})`
            );
        }
    );

    contents.on('did-finish-load', () => {
        const currentUrl = contents.getURL();
        if (!navigationPolicy.isAllowedNavigation(currentUrl)) {
            return;
        }

        retryCount = 0;
        firstRunPending = false;
        setBootStatus({
            level: 'info',
            phase: 'ready',
            message: `${currentConfig.surface} conectado correctamente.`,
            url: currentUrl,
        });
        if (shouldUseKioskMode(currentConfig)) {
            windowRef.setKiosk(true);
        } else if (currentConfig.launchMode === 'fullscreen') {
            windowRef.setFullScreen(true);
        }
        windowRef.show();
        windowRef.focus();
    });
}

function applyAutoStart(config) {
    app.setLoginItemSettings({
        openAtLogin: Boolean(config.autoStart),
        openAsHidden: false,
    });
}

function applyDisplaySleepPolicy(config) {
    if (displaySleepBlockerId !== null) {
        powerSaveBlocker.stop(displaySleepBlockerId);
        displaySleepBlockerId = null;
    }

    if (shouldPreventDisplaySleep(config)) {
        displaySleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
}

async function createMainWindow() {
    const runtime = ensureRuntimeConfig(app);
    currentRuntime = runtime;
    currentConfig = runtime.runtimeConfig;
    navigationPolicy = createNavigationPolicy(currentConfig);
    firstRunPending = Boolean(runtime.firstRun);

    mainWindow = new BrowserWindow(
        getBrowserWindowOptions(currentConfig, preloadPath, {
            packaged: app.isPackaged,
        })
    );
    mainWindow.removeMenu();

    attachNavigationGuards(mainWindow);
    applyAutoStart(currentConfig);
    applyDisplaySleepPolicy(currentConfig);

    await loadBootPage();
    mainWindow.show();
    setBootStatus({
        level: 'info',
        phase: 'boot',
        message: firstRunPending
            ? `${currentConfig.surface} listo para configuracion inicial.`
            : `${currentConfig.surface} listo para conectar.`,
        configPath: runtime.configPath,
    });
    if (firstRunPending) {
        await openSettings('first-run');
        return;
    }

    await loadSurface('boot');
}

function setupUpdater() {
    if (!app.isPackaged) {
        setBootStatus({
            level: 'info',
            phase: 'update',
            message: 'Auto-update desactivado en modo desarrollo.',
        });
        return;
    }

    updater = createUpdater(currentConfig, setBootStatus, log);
    if (!updater) {
        return;
    }

    setTimeout(() => {
        updater.checkForUpdates().catch((error) => {
            setBootStatus({
                level: 'warn',
                phase: 'update',
                message: `No se pudo comprobar update: ${error.message}`,
            });
        });
    }, 6000);
}

ipcMain.handle('turnero:get-runtime-snapshot', () => ({
    ...getRuntimeSnapshot(),
}));

ipcMain.handle('turnero:run-preflight', async (_event, payload = {}) => {
    if (!currentRuntime) {
        throw new Error('Runtime config no inicializado');
    }

    const nextConfig = mergeRuntimeConfig(
        currentRuntime.buildConfig,
        payload && typeof payload === 'object'
            ? {
                  ...currentConfig,
                  ...payload,
              }
            : currentConfig
    );

    return runPreflightChecks(nextConfig, {
        packaged: app.isPackaged,
    });
});

ipcMain.handle('turnero:retry-load', async () => {
    await loadBootPage();
    await loadSurface('manual-retry');
    return true;
});

ipcMain.handle('turnero:save-runtime-config', async (_event, payload = {}) => {
    if (!currentRuntime) {
        throw new Error('Runtime config no inicializado');
    }

    const nextConfig = persistRuntimeConfig(
        currentRuntime.configPath,
        currentRuntime.buildConfig,
        payload && typeof payload === 'object' ? payload : {}
    );

    currentRuntime = {
        ...currentRuntime,
        runtimeConfig: nextConfig,
        firstRun: false,
    };
    currentConfig = nextConfig;
    navigationPolicy = createNavigationPolicy(currentConfig);
    firstRunPending = false;

    applyAutoStart(currentConfig);
    applyDisplaySleepPolicy(currentConfig);

    setBootStatus({
        level: 'info',
        phase: 'settings',
        message: `Configuracion guardada para ${currentConfig.surface}.`,
    });

    return {
        ...getRuntimeSnapshot(),
    };
});

ipcMain.handle('turnero:open-surface', async () => {
    await loadSurface(settingsMode ? 'settings-open' : 'manual-open');
    return true;
});

ipcMain.handle('turnero:open-settings', async () => {
    await openSettings('renderer');
    return true;
});

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
    app.quit();
} else {
    app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
    app.commandLine.appendSwitch('disable-renderer-backgrounding');

    app.on('second-instance', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        Menu.setApplicationMenu(null);
        await createMainWindow();
        setupUpdater();
    });

    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createMainWindow();
        }
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('before-quit', () => {
        clearRetryTimer();
        stopDesktopHeartbeat();
        if (displaySleepBlockerId !== null) {
            powerSaveBlocker.stop(displaySleepBlockerId);
            displaySleepBlockerId = null;
        }
    });
}
