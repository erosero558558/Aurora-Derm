(function () {
    const titleEl = document.getElementById('bootTitle');
    const messageEl = document.getElementById('bootMessage');
    const surfaceEl = document.getElementById('bootSurface');
    const baseUrlEl = document.getElementById('bootBaseUrl');
    const phaseEl = document.getElementById('bootPhase');
    const retryBtn = document.getElementById('bootRetryBtn');
    const configModeEl = document.getElementById('bootConfigMode');
    const configHintEl = document.getElementById('bootConfigHint');
    const launchUrlPreviewEl = document.getElementById('bootConfigLaunchUrl');
    const openSurfaceBtn = document.getElementById('bootOpenSurfaceBtn');
    const saveBtn = document.getElementById('bootSaveBtn');
    const runPreflightBtn = document.getElementById('bootRunPreflightBtn');
    const preflightSummaryEl = document.getElementById('bootPreflightSummary');
    const preflightChecksEl = document.getElementById('bootPreflightChecks');
    const preflightGateHintEl = document.getElementById(
        'bootPreflightGateHint'
    );
    const configForm = document.getElementById('bootConfigForm');
    const baseUrlInput = document.getElementById('bootConfigBaseUrl');
    const profileSelect = document.getElementById('bootConfigProfile');
    const oneTapInput = document.getElementById('bootConfigOneTap');
    const launchModeSelect = document.getElementById('bootConfigLaunchMode');
    const autoStartInput = document.getElementById('bootConfigAutoStart');
    const operatorFields = document.getElementById('bootConfigOperatorFields');

    let latestSnapshot = null;
    let lastPreflightRunToken = 0;
    let latestPreflightReport = null;
    let lastPreflightFingerprint = '';
    let preflightRunning = false;

    function formatPlatformLabel(platform) {
        const normalized = String(platform || '')
            .trim()
            .toLowerCase();
        if (normalized === 'win32') {
            return 'Windows';
        }
        if (normalized === 'darwin') {
            return 'macOS';
        }
        if (normalized === 'linux') {
            return 'Linux';
        }
        return normalized || 'Equipo local';
    }

    function getSurfaceLabel(snapshot) {
        const surfaceLabel = String(
            snapshot?.surfaceLabel || snapshot?.config?.surface || 'Superficie'
        ).trim();
        return surfaceLabel || 'Superficie';
    }

    function getSurfaceDesktopLabel(snapshot) {
        const surfaceDesktopLabel = String(
            snapshot?.surfaceDesktopLabel || ''
        ).trim();
        if (surfaceDesktopLabel) {
            return surfaceDesktopLabel;
        }
        return `Turnero ${getSurfaceLabel(snapshot)}`;
    }

    function formatShellSummary(snapshot) {
        const surfaceDesktopLabel = getSurfaceDesktopLabel(snapshot);
        if (!snapshot || !snapshot.packaged) {
            return `${surfaceDesktopLabel} en validacion local`;
        }

        const name = String(snapshot.name || surfaceDesktopLabel).trim();
        const version = String(snapshot.version || '').trim();
        return version ? `${name} v${version}` : name;
    }

    function formatOpenSurfaceLabel(snapshot) {
        if (!snapshot || !snapshot.packaged) {
            return 'Abrir superficie';
        }

        const surfaceLabel = getSurfaceLabel(snapshot).toLowerCase();
        return `Abrir ${surfaceLabel} ${formatPlatformLabel(snapshot.platform)}`;
    }

    function formatShellMeta(snapshot) {
        if (!snapshot) {
            return 'Sin metadata del shell.';
        }

        const platformLabel = formatPlatformLabel(snapshot.platform);
        const appMode = snapshot.packaged
            ? 'Desktop instalada'
            : 'Desktop en desarrollo';
        const updateChannel = String(
            snapshot.config?.updateChannel || 'stable'
        );
        const configPath = String(snapshot.configPath || '').trim();
        const configSuffix = configPath ? ` · Config: ${configPath}` : '';

        return `${platformLabel} · ${appMode} · Canal ${updateChannel}${configSuffix}`;
    }

    function isOperatorSurface(surface) {
        return (
            String(surface || '')
                .trim()
                .toLowerCase() === 'operator'
        );
    }

    function buildLaunchUrl(config) {
        try {
            const surface = String(config.surface || 'operator');
            const baseUrl = String(
                config.baseUrl || 'https://pielarmonia.com'
            ).trim();
            const route =
                surface === 'kiosk'
                    ? '/kiosco-turnos.html'
                    : '/operador-turnos.html';
            const url = new URL(route, baseUrl);

            if (surface === 'operator') {
                const profile = String(config.profile || 'free');
                url.searchParams.set(
                    'station',
                    profile === 'c2_locked' ? 'c2' : 'c1'
                );
                url.searchParams.set('lock', profile === 'free' ? '0' : '1');
                url.searchParams.set('one_tap', config.oneTap ? '1' : '0');
            }

            return url.toString();
        } catch (_error) {
            return '-';
        }
    }

    function getFormPayload() {
        return {
            surface: latestSnapshot?.config?.surface || 'operator',
            baseUrl:
                baseUrlInput instanceof HTMLInputElement
                    ? baseUrlInput.value
                    : 'https://pielarmonia.com',
            profile:
                profileSelect instanceof HTMLSelectElement
                    ? profileSelect.value
                    : 'free',
            launchMode:
                launchModeSelect instanceof HTMLSelectElement
                    ? launchModeSelect.value
                    : 'fullscreen',
            autoStart:
                autoStartInput instanceof HTMLInputElement
                    ? autoStartInput.checked
                    : true,
            oneTap:
                oneTapInput instanceof HTMLInputElement
                    ? oneTapInput.checked
                    : false,
        };
    }

    function createRuntimePatch(formPayload) {
        const profile = String(formPayload.profile || 'free');
        return {
            baseUrl: formPayload.baseUrl,
            launchMode: formPayload.launchMode,
            autoStart: formPayload.autoStart,
            stationMode: profile === 'free' ? 'free' : 'locked',
            stationConsultorio: profile === 'c2_locked' ? 2 : 1,
            oneTap: Boolean(formPayload.oneTap),
        };
    }

    function getRuntimePatchFromForm() {
        return createRuntimePatch(getFormPayload());
    }

    function getPreflightFingerprint() {
        return JSON.stringify({
            packaged: Boolean(latestSnapshot?.packaged),
            surface: String(latestSnapshot?.config?.surface || 'operator'),
            config: getRuntimePatchFromForm(),
        });
    }

    function getPreflightGateState() {
        if (!latestSnapshot) {
            return {
                blocked: true,
                state: 'warning',
                detail: 'Cargando la configuración local del shell.',
            };
        }

        if (!latestSnapshot.packaged) {
            return {
                blocked: false,
                state: 'warning',
                detail: 'El checklist remoto completo se valida solo en desktop instalada; en desarrollo puedes continuar.',
            };
        }

        if (preflightRunning) {
            return {
                blocked: true,
                state: 'warning',
                detail: 'Espera a que termine la comprobación antes de abrir la superficie.',
            };
        }

        const currentFingerprint = getPreflightFingerprint();
        if (
            !latestPreflightReport ||
            lastPreflightFingerprint !== currentFingerprint
        ) {
            return {
                blocked: true,
                state: 'warning',
                detail: 'Vuelve a comprobar el equipo después de cambiar la configuración.',
            };
        }

        if (String(latestPreflightReport.state || '') === 'danger') {
            return {
                blocked: true,
                state: 'danger',
                detail: 'Corrige los checks en rojo antes de guardar y abrir esta desktop.',
            };
        }

        if (String(latestPreflightReport.state || '') === 'warning') {
            return {
                blocked: false,
                state: 'warning',
                detail: 'El equipo puede abrir, pero todavía quedan validaciones pendientes.',
            };
        }

        return {
            blocked: false,
            state: 'ready',
            detail: 'Checklist vigente para esta configuración local.',
        };
    }

    function syncLaunchGuard() {
        const gate = getPreflightGateState();

        if (saveBtn instanceof HTMLButtonElement) {
            saveBtn.disabled = gate.blocked;
            saveBtn.title = gate.detail;
        }

        if (openSurfaceBtn instanceof HTMLButtonElement) {
            openSurfaceBtn.disabled = gate.blocked;
            openSurfaceBtn.title = gate.detail;
        }

        if (preflightGateHintEl instanceof HTMLElement) {
            preflightGateHintEl.setAttribute('data-state', gate.state);
            preflightGateHintEl.textContent = gate.detail;
        }
    }

    function renderLaunchPreview() {
        if (!launchUrlPreviewEl) {
            return;
        }
        launchUrlPreviewEl.textContent = buildLaunchUrl(getFormPayload());
    }

    function renderPreflight(report) {
        if (preflightSummaryEl instanceof HTMLElement) {
            if (!report) {
                preflightSummaryEl.setAttribute('data-state', 'warning');
                preflightSummaryEl.textContent =
                    'Ejecuta la comprobación para validar servidor, superficie y perfil del equipo.';
            } else {
                preflightSummaryEl.setAttribute(
                    'data-state',
                    report.state || 'warning'
                );
                preflightSummaryEl.textContent = `${report.title || 'Equipo en revisión'}: ${
                    report.summary || ''
                }`;
            }
        }

        if (preflightChecksEl instanceof HTMLElement) {
            const checks = Array.isArray(report?.checks) ? report.checks : [];
            preflightChecksEl.innerHTML = checks
                .map(
                    (check) => `
                        <article class="boot-preflight__check" data-state="${String(
                            check.state || 'warning'
                        )}">
                            <strong>${String(check.label || check.id || 'Check')}</strong>
                            <span>${String(check.detail || '')}</span>
                        </article>
                    `
                )
                .join('');
        }

        syncLaunchGuard();
    }

    async function runPreflight() {
        if (
            !window.turneroDesktop ||
            typeof window.turneroDesktop.runPreflight !== 'function'
        ) {
            latestPreflightReport = null;
            lastPreflightFingerprint = '';
            renderPreflight(null);
            return;
        }

        const token = Date.now();
        const fingerprint = getPreflightFingerprint();
        lastPreflightRunToken = token;
        preflightRunning = true;
        syncLaunchGuard();

        if (runPreflightBtn instanceof HTMLButtonElement) {
            runPreflightBtn.disabled = true;
        }
        if (preflightSummaryEl instanceof HTMLElement) {
            preflightSummaryEl.setAttribute('data-state', 'warning');
            preflightSummaryEl.textContent =
                'Comprobando servidor, superficie y salud del equipo...';
        }

        try {
            const report = await window.turneroDesktop.runPreflight(
                getRuntimePatchFromForm()
            );
            if (lastPreflightRunToken === token) {
                latestPreflightReport =
                    report && typeof report === 'object' ? report : null;
                lastPreflightFingerprint = fingerprint;
                renderPreflight(report);
            }
        } catch (_error) {
            if (lastPreflightRunToken === token) {
                latestPreflightReport = {
                    state: 'danger',
                    title: 'No se pudo comprobar el equipo',
                    summary:
                        'La verificación remota falló antes de completar el checklist.',
                    checks: [],
                };
                lastPreflightFingerprint = fingerprint;
                renderPreflight(latestPreflightReport);
            }
        } finally {
            if (lastPreflightRunToken === token) {
                preflightRunning = false;
            }
            if (runPreflightBtn instanceof HTMLButtonElement) {
                runPreflightBtn.disabled = false;
            }
            syncLaunchGuard();
        }
    }

    function hydrateForm(snapshot) {
        const config = snapshot?.config || {};
        const operator = isOperatorSurface(config.surface);
        const profile =
            config.stationMode === 'locked'
                ? Number(config.stationConsultorio || 1) === 2
                    ? 'c2_locked'
                    : 'c1_locked'
                : 'free';

        if (baseUrlInput instanceof HTMLInputElement) {
            baseUrlInput.value = String(config.baseUrl || '');
        }
        if (profileSelect instanceof HTMLSelectElement) {
            profileSelect.value = profile;
        }
        if (oneTapInput instanceof HTMLInputElement) {
            oneTapInput.checked = Boolean(config.oneTap);
        }
        if (launchModeSelect instanceof HTMLSelectElement) {
            launchModeSelect.value = String(config.launchMode || 'fullscreen');
        }
        if (autoStartInput instanceof HTMLInputElement) {
            autoStartInput.checked = config.autoStart !== false;
        }
        if (operatorFields instanceof HTMLElement) {
            operatorFields.hidden = !operator;
        }
        renderLaunchPreview();
    }

    function render(snapshot) {
        if (!snapshot) {
            return;
        }

        latestSnapshot = snapshot;

        if (titleEl) {
            titleEl.textContent =
                snapshot.phase === 'ready'
                    ? 'Shell conectado'
                    : snapshot.settingsMode || snapshot.firstRun
                      ? 'Configura este equipo'
                      : 'Inicializando shell operativo';
        }
        if (surfaceEl) {
            surfaceEl.textContent = snapshot.config?.surface || '-';
        }
        if (baseUrlEl) {
            baseUrlEl.textContent = snapshot.config?.baseUrl || '-';
        }
        if (phaseEl) {
            phaseEl.textContent = snapshot.phase || 'boot';
        }
        if (configModeEl) {
            const runtimeMode = snapshot.firstRun
                ? 'Primer arranque'
                : snapshot.settingsMode
                  ? 'Reconfiguracion'
                  : 'Perfil persistido';
            configModeEl.textContent = `${runtimeMode} · ${formatPlatformLabel(
                snapshot.platform
            )}`;
        }
        if (configHintEl) {
            configHintEl.innerHTML = snapshot.firstRun
                ? `Confirma este equipo antes de abrir el turnero. Mismo instalador para <code>C1</code> y <code>C2</code>; cambia solo el perfil local.`
                : `Presiona <code>F10</code> o <code>Ctrl/Cmd + ,</code> para volver a esta configuracion. ${formatShellMeta(
                      snapshot
                  )}`;
        }
        if (openSurfaceBtn instanceof HTMLButtonElement) {
            openSurfaceBtn.hidden = Boolean(snapshot.firstRun);
            openSurfaceBtn.textContent = formatOpenSurfaceLabel(snapshot);
        }
        if (messageEl) {
            const shellSummary = formatShellSummary(snapshot);
            const runtimeMessage = String(snapshot.message || '')
                .trim()
                .replace(/[.!?]\s*$/u, '');
            messageEl.textContent = runtimeMessage
                ? `${runtimeMessage}. ${shellSummary}.`
                : `${shellSummary}.`;
        }

        hydrateForm(snapshot);
        syncLaunchGuard();
    }

    async function refreshSnapshot() {
        if (!window.turneroDesktop) {
            return;
        }

        const snapshot = await window.turneroDesktop.getRuntimeSnapshot();
        render({
            ...snapshot,
            ...snapshot.status,
        });
    }

    if (window.turneroDesktop) {
        refreshSnapshot()
            .then(() => runPreflight())
            .catch(() => {});

        window.turneroDesktop.onBootStatus(() => {
            refreshSnapshot().catch(() => {});
        });
    }

    if (retryBtn && window.turneroDesktop) {
        retryBtn.addEventListener('click', () => {
            retryBtn.disabled = true;
            window.turneroDesktop.retryLoad().finally(() => {
                retryBtn.disabled = false;
            });
        });
    }

    if (configForm instanceof HTMLFormElement && window.turneroDesktop) {
        configForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const gate = getPreflightGateState();
            if (gate.blocked) {
                syncLaunchGuard();
                return;
            }

            if (saveBtn instanceof HTMLButtonElement) {
                saveBtn.disabled = true;
            }

            window.turneroDesktop
                .saveRuntimeConfig(getRuntimePatchFromForm())
                .then(() => window.turneroDesktop.openSurface())
                .catch(() => {})
                .finally(() => {
                    if (saveBtn instanceof HTMLButtonElement) {
                        saveBtn.disabled = false;
                    }
                    syncLaunchGuard();
                });
        });
    }

    if (openSurfaceBtn && window.turneroDesktop) {
        openSurfaceBtn.addEventListener('click', () => {
            const gate = getPreflightGateState();
            if (gate.blocked) {
                syncLaunchGuard();
                return;
            }

            openSurfaceBtn.disabled = true;
            window.turneroDesktop.openSurface().finally(() => {
                syncLaunchGuard();
            });
        });
    }

    if (runPreflightBtn && window.turneroDesktop) {
        runPreflightBtn.addEventListener('click', () => {
            void runPreflight();
        });
    }

    [baseUrlInput, profileSelect, oneTapInput, launchModeSelect, autoStartInput]
        .filter(Boolean)
        .forEach((element) => {
            element.addEventListener('input', () => {
                renderLaunchPreview();
                syncLaunchGuard();
            });
            element.addEventListener('change', renderLaunchPreview);
            element.addEventListener('change', () => {
                syncLaunchGuard();
                void runPreflight();
            });
        });

    renderPreflight(null);
})();
