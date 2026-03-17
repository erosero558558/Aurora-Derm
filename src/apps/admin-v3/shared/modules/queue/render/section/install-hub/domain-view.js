import { setHtml } from '../../../../../ui/render.js';

const QUEUE_HUB_DOMAIN_STORAGE_KEY = 'queueHubDomainViewV1';
const VALID_DOMAIN_SELECTIONS = new Set([
    'auto',
    'operations',
    'deployment',
    'incidents',
]);
const VALID_QUEUE_FOCUS_MODES = new Set([
    'opening',
    'operations',
    'incidents',
    'closing',
]);

function normalizeSelection(value) {
    const safeValue = String(value || '')
        .trim()
        .toLowerCase();
    return VALID_DOMAIN_SELECTIONS.has(safeValue) ? safeValue : 'auto';
}

function normalizeFocusMode(value) {
    const safeValue = String(value || '')
        .trim()
        .toLowerCase();
    return VALID_QUEUE_FOCUS_MODES.has(safeValue) ? safeValue : 'operations';
}

function normalizeClinicScopedSelection(rawValue, activeClinicId) {
    const clinicId = String(activeClinicId || '').trim() || 'default-clinic';
    if (typeof rawValue === 'string') {
        return {
            clinicId,
            selection: normalizeSelection(rawValue),
        };
    }
    const source = rawValue && typeof rawValue === 'object' ? rawValue : {};
    return {
        clinicId,
        selection:
            String(source.clinicId || '').trim() === clinicId
                ? normalizeSelection(source.selection)
                : 'auto',
    };
}

function loadSelection(activeClinicId) {
    const clinicId = String(activeClinicId || '').trim() || 'default-clinic';
    try {
        const rawValue = window.localStorage.getItem(
            QUEUE_HUB_DOMAIN_STORAGE_KEY
        );
        if (!rawValue) {
            return 'auto';
        }
        const parsed = JSON.parse(rawValue);
        const normalized = normalizeClinicScopedSelection(parsed, clinicId);
        if (
            normalized.selection !== normalizeSelection(parsed?.selection) ||
            String(parsed?.clinicId || '').trim() !== clinicId
        ) {
            window.localStorage.setItem(
                QUEUE_HUB_DOMAIN_STORAGE_KEY,
                JSON.stringify(normalized)
            );
        }
        return normalized.selection;
    } catch (_error) {
        try {
            const legacyValue = window.localStorage.getItem(
                QUEUE_HUB_DOMAIN_STORAGE_KEY
            );
            if (legacyValue) {
                const normalized = normalizeClinicScopedSelection(
                    legacyValue,
                    clinicId
                );
                window.localStorage.setItem(
                    QUEUE_HUB_DOMAIN_STORAGE_KEY,
                    JSON.stringify(normalized)
                );
                return normalized.selection;
            }
        } catch (_nestedError) {
            // ignore storage recovery failures
        }
        return 'auto';
    }
}

function persistSelection(value, activeClinicId) {
    const normalized = normalizeClinicScopedSelection(
        {
            clinicId: activeClinicId,
            selection: value,
        },
        activeClinicId
    );
    try {
        window.localStorage.setItem(
            QUEUE_HUB_DOMAIN_STORAGE_KEY,
            JSON.stringify(normalized)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return normalized.selection;
}

function getSuggestedDomain(queueFocus) {
    const safeFocus = normalizeFocusMode(queueFocus);
    if (safeFocus === 'opening') {
        return 'deployment';
    }
    if (safeFocus === 'incidents') {
        return 'incidents';
    }
    return 'operations';
}

function normalizeAdminMode(value) {
    return String(value || '')
        .trim()
        .toLowerCase() === 'basic'
        ? 'basic'
        : 'expert';
}

function tokenizeMatchList(value) {
    return String(value || '')
        .split(/\s+/u)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}

function matchesDataset(node, datasetKey, activeValue, defaultVisible) {
    const matches = tokenizeMatchList(node?.dataset?.[datasetKey] || '');
    if (matches.length === 0) {
        return defaultVisible;
    }
    return matches.includes(activeValue);
}

function setPanelVisibility(node, isVisible) {
    node.hidden = !isVisible;
    node.style.display = isVisible ? '' : 'none';
    node.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
}

function listHubPanels(hub) {
    if (!(hub instanceof HTMLElement)) {
        return [];
    }

    return Array.from(
        hub.querySelectorAll(
            '[data-queue-admin-level], [data-queue-basic-match], [data-queue-domain-match]'
        )
    ).filter((node) => node instanceof HTMLElement && node.id);
}

function buildDomainCopy(
    domain,
    adminMode = 'expert',
    queueFocus = 'operations'
) {
    if (adminMode === 'basic') {
        if (domain === 'deployment') {
            return {
                title: 'Experiencia: Despliegue',
                summary:
                    'El foco de apertura deja checklist, Turnero V2 y apps del release al frente. Las superficies nativas y el hardware crítico sí bloquean el go-live.',
                primaryHref: '#queueOpeningChecklist',
                primaryLabel: 'Ir a apertura diaria',
            };
        }

        if (domain === 'incidents') {
            return {
                title: 'Experiencia: Incidentes',
                summary:
                    'Telemetría, alertas, contingencias y bitácora urgente quedan juntas para resolver la incidencia sin cambiar de carril.',
                primaryHref: '#queueSurfaceTelemetry',
                primaryLabel: 'Ir a incidentes',
            };
        }

        if (queueFocus === 'closing') {
            return {
                title: 'Experiencia: Operación',
                summary:
                    'El cierre deja relevo, bitácora y telemetría al frente sin reabrir la vista completa del hub.',
                primaryHref: '#queueShiftHandoff',
                primaryLabel: 'Ir a cierre y relevo',
            };
        }

        return {
            title: 'Experiencia: Operación',
            summary:
                'Consultorios, resolución, llamados y bandejas rápidas quedan al frente para operar el turno sin ruido lateral.',
            primaryHref: '#queueConsultorioBoard',
            primaryLabel: 'Ir a operación',
        };
    }

    if (domain === 'deployment') {
        return {
            title: 'Experiencia: Despliegue',
            summary:
                'Instaladores, checklist, configuracion y material de piloto viven aqui sin tapar la cola diaria.',
            primaryHref: '#queueAppDownloadsCards',
            primaryLabel: 'Ir a despliegue',
        };
    }

    if (domain === 'incidents') {
        return {
            title: 'Experiencia: Incidentes',
            summary:
                'Telemetria, alertas, bitacora y contingencias quedan juntas para diagnosticar sin mezclar instalacion.',
            primaryHref: '#queueSurfaceTelemetry',
            primaryLabel: 'Ir a incidentes',
        };
    }

    return {
        title: 'Experiencia: Operación',
        summary:
            'Llamados, cola viva, apoyo y cierre quedan al frente para usar el turnero sin ruido de despliegue.',
        primaryHref: '#queueConsultorioBoard',
        primaryLabel: 'Ir a operacion',
    };
}

function applyDomainVisibility(hub, effectiveDomain) {
    if (!(hub instanceof HTMLElement)) {
        return;
    }

    const adminMode = normalizeAdminMode(hub.dataset.queueAdminMode || '');
    const queueFocus = normalizeFocusMode(hub.dataset.queueFocus || '');
    const basicFullView =
        adminMode === 'basic' &&
        String(hub.dataset.queueBasicFullView || '')
            .trim()
            .toLowerCase() === 'true';

    listHubPanels(hub).forEach((node) => {
        let isVisible = true;
        if (adminMode === 'basic' && !basicFullView) {
            isVisible = matchesDataset(
                node,
                'queueBasicMatch',
                queueFocus,
                false
            );
        } else if (!basicFullView) {
            isVisible = matchesDataset(
                node,
                'queueDomainMatch',
                effectiveDomain,
                true
            );
        }

        setPanelVisibility(node, isVisible);
    });
}

function buildModel(hub, deps = {}) {
    const activeClinicId =
        String(hub?.dataset?.queueClinicId || '').trim() || 'default-clinic';
    const selectedDomain = loadSelection(activeClinicId);
    const queueFocus = normalizeFocusMode(hub?.dataset?.queueFocus || '');
    const suggestedDomain = getSuggestedDomain(queueFocus);
    const adminMode =
        typeof deps.getAdminMode === 'function'
            ? normalizeAdminMode(deps.getAdminMode())
            : normalizeAdminMode(hub?.dataset?.queueAdminMode || '');
    const effectiveDomain =
        adminMode === 'basic' || selectedDomain === 'auto'
            ? suggestedDomain
            : selectedDomain;
    const copy = buildDomainCopy(effectiveDomain, adminMode, queueFocus);

    return {
        selectedDomain,
        suggestedDomain,
        effectiveDomain,
        adminMode,
        queueFocus,
        chipState:
            adminMode === 'basic'
                ? 'focus'
                : selectedDomain === 'auto'
                  ? 'auto'
                  : 'manual',
        chipLabel:
            adminMode === 'basic'
                ? `Foco -> ${effectiveDomain}`
                : selectedDomain === 'auto'
                  ? `Auto -> ${effectiveDomain}`
                  : `Manual -> ${effectiveDomain}`,
        domainSource:
            adminMode === 'basic'
                ? 'focus'
                : selectedDomain === 'auto'
                  ? 'auto'
                  : 'manual',
        ...copy,
    };
}

export function renderQueueHubDomainView(deps = {}) {
    const root = document.getElementById('queueDomainSwitcher');
    const hub = document.getElementById('queueAppsHub');
    if (!(root instanceof HTMLElement) || !(hub instanceof HTMLElement)) {
        return;
    }

    const activeClinicId =
        String(hub.dataset.queueClinicId || '').trim() || 'default-clinic';
    const model = buildModel(hub, deps);
    const rerender = () => renderQueueHubDomainView(deps);
    hub.dataset.queueDomain = model.effectiveDomain;
    hub.dataset.queueDomainSource = model.domainSource;
    applyDomainVisibility(hub, model.effectiveDomain);

    if (model.adminMode === 'basic') {
        setHtml(
            '#queueDomainSwitcher',
            `
                <section class="queue-domain-switcher__shell" data-state="basic">
                    <div class="queue-domain-switcher__head">
                        <div>
                            <p class="queue-app-card__eyebrow">Contexto recomendado</p>
                            <h5 id="queueDomainTitle" class="queue-app-card__title">${model.title}</h5>
                            <p id="queueDomainSummary" class="queue-domain-switcher__summary">${model.summary}</p>
                        </div>
                        <div class="queue-domain-switcher__meta">
                            <span id="queueDomainChip" class="queue-domain-switcher__chip" data-state="${model.chipState}">${model.chipLabel}</span>
                            <a id="queueDomainPrimary" href="${model.primaryHref}" class="queue-domain-switcher__ghost">${model.primaryLabel}</a>
                            <button id="queueDomainAuto" type="button" class="queue-domain-switcher__ghost" hidden disabled>Seguir foco</button>
                        </div>
                    </div>
                    <div class="queue-domain-switcher__tabs" role="tablist" aria-label="Cambiar experiencia del turnero" hidden>
                        <button id="queueDomainOperations" type="button" class="queue-domain-switcher__tab" data-state="${model.effectiveDomain === 'operations' ? 'active' : 'idle'}" disabled>Operacion</button>
                        <button id="queueDomainDeployment" type="button" class="queue-domain-switcher__tab" data-state="${model.effectiveDomain === 'deployment' ? 'active' : 'idle'}" disabled>Despliegue</button>
                        <button id="queueDomainIncidents" type="button" class="queue-domain-switcher__tab" data-state="${model.effectiveDomain === 'incidents' ? 'active' : 'idle'}" disabled>Incidentes</button>
                    </div>
                </section>
            `
        );
        return;
    }

    setHtml(
        '#queueDomainSwitcher',
        `
            <section class="queue-domain-switcher__shell" data-state="expert">
                <div class="queue-domain-switcher__head">
                    <div>
                        <p class="queue-app-card__eyebrow">Experiencia</p>
                        <h5 id="queueDomainTitle" class="queue-app-card__title">${model.title}</h5>
                        <p id="queueDomainSummary" class="queue-domain-switcher__summary">${model.summary}</p>
                    </div>
                    <div class="queue-domain-switcher__meta">
                        <span id="queueDomainChip" class="queue-domain-switcher__chip" data-state="${model.chipState}">${model.chipLabel}</span>
                        <a id="queueDomainPrimary" href="${model.primaryHref}" class="queue-domain-switcher__primary">${model.primaryLabel}</a>
                        <button id="queueDomainAuto" type="button" class="queue-domain-switcher__ghost"${model.selectedDomain === 'auto' ? ' hidden' : ''}>Seguir foco</button>
                    </div>
                </div>
                <div class="queue-domain-switcher__tabs" role="tablist" aria-label="Cambiar experiencia del turnero">
                    <button id="queueDomainOperations" type="button" class="queue-domain-switcher__tab" data-queue-domain-select="operations" data-state="${model.effectiveDomain === 'operations' ? 'active' : 'idle'}">Operacion</button>
                    <button id="queueDomainDeployment" type="button" class="queue-domain-switcher__tab" data-queue-domain-select="deployment" data-state="${model.effectiveDomain === 'deployment' ? 'active' : 'idle'}">Despliegue</button>
                    <button id="queueDomainIncidents" type="button" class="queue-domain-switcher__tab" data-queue-domain-select="incidents" data-state="${model.effectiveDomain === 'incidents' ? 'active' : 'idle'}">Incidentes</button>
                </div>
            </section>
        `
    );

    root.querySelectorAll('[data-queue-domain-select]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            persistSelection(
                button.dataset.queueDomainSelect || 'operations',
                activeClinicId
            );
            rerender();
        };
    });

    const autoButton = document.getElementById('queueDomainAuto');
    if (autoButton instanceof HTMLButtonElement) {
        autoButton.onclick = () => {
            persistSelection('auto', activeClinicId);
            rerender();
        };
    }
}
