import { setHtml } from '../../../../../ui/render.js';

const QUEUE_HUB_DOMAIN_STORAGE_KEY = 'queueHubDomainViewV1';
const VALID_DOMAIN_SELECTIONS = new Set([
    'auto',
    'operations',
    'deployment',
    'incidents',
]);

function normalizeSelection(value) {
    const safeValue = String(value || '')
        .trim()
        .toLowerCase();
    return VALID_DOMAIN_SELECTIONS.has(safeValue) ? safeValue : 'auto';
}

function loadSelection() {
    try {
        return normalizeSelection(
            window.localStorage.getItem(QUEUE_HUB_DOMAIN_STORAGE_KEY)
        );
    } catch (_error) {
        return 'auto';
    }
}

function persistSelection(value) {
    const safeValue = normalizeSelection(value);
    try {
        window.localStorage.setItem(QUEUE_HUB_DOMAIN_STORAGE_KEY, safeValue);
    } catch (_error) {
        // ignore storage write failures
    }
    return safeValue;
}

function getSuggestedDomain(queueFocus) {
    const safeFocus = String(queueFocus || '')
        .trim()
        .toLowerCase();
    if (safeFocus === 'opening') {
        return 'deployment';
    }
    if (safeFocus === 'incidents') {
        return 'incidents';
    }
    return 'operations';
}

function buildDomainCopy(domain) {
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
        title: 'Experiencia: Operacion',
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

    hub.querySelectorAll('[data-queue-domain-match]').forEach((node) => {
        if (!(node instanceof HTMLElement)) {
            return;
        }
        const matches = String(node.dataset.queueDomainMatch || '')
            .split(/\s+/u)
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean);
        const isActive =
            matches.length === 0 || matches.includes(effectiveDomain);
        node.hidden = !isActive;
        node.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
}

function buildModel(hub) {
    const selectedDomain = loadSelection();
    const suggestedDomain = getSuggestedDomain(hub?.dataset?.queueFocus || '');
    const effectiveDomain =
        selectedDomain === 'auto' ? suggestedDomain : selectedDomain;
    const copy = buildDomainCopy(effectiveDomain);

    return {
        selectedDomain,
        suggestedDomain,
        effectiveDomain,
        chipLabel:
            selectedDomain === 'auto'
                ? `Auto -> ${effectiveDomain}`
                : `Manual -> ${effectiveDomain}`,
        ...copy,
    };
}

export function renderQueueHubDomainView() {
    const root = document.getElementById('queueDomainSwitcher');
    const hub = document.getElementById('queueAppsHub');
    if (!(root instanceof HTMLElement) || !(hub instanceof HTMLElement)) {
        return;
    }

    const model = buildModel(hub);
    hub.dataset.queueDomain = model.effectiveDomain;
    hub.dataset.queueDomainSource =
        model.selectedDomain === 'auto' ? 'auto' : 'manual';
    applyDomainVisibility(hub, model.effectiveDomain);

    setHtml(
        '#queueDomainSwitcher',
        `
            <section class="queue-domain-switcher__shell">
                <div class="queue-domain-switcher__head">
                    <div>
                        <p class="queue-app-card__eyebrow">Experiencia</p>
                        <h5 id="queueDomainTitle" class="queue-app-card__title">${model.title}</h5>
                        <p id="queueDomainSummary" class="queue-domain-switcher__summary">${model.summary}</p>
                    </div>
                    <div class="queue-domain-switcher__meta">
                        <span id="queueDomainChip" class="queue-domain-switcher__chip" data-state="${
                            model.selectedDomain === 'auto' ? 'auto' : 'manual'
                        }">${model.chipLabel}</span>
                        <a id="queueDomainPrimary" href="${
                            model.primaryHref
                        }" class="queue-domain-switcher__primary">${
                            model.primaryLabel
                        }</a>
                        <button id="queueDomainAuto" type="button" class="queue-domain-switcher__ghost"${
                            model.selectedDomain === 'auto' ? ' hidden' : ''
                        }>Seguir foco</button>
                    </div>
                </div>
                <div class="queue-domain-switcher__tabs" role="tablist" aria-label="Cambiar experiencia del turnero">
                    <button id="queueDomainOperations" type="button" class="queue-domain-switcher__tab" data-queue-domain-select="operations" data-state="${
                        model.effectiveDomain === 'operations'
                            ? 'active'
                            : 'idle'
                    }">Operacion</button>
                    <button id="queueDomainDeployment" type="button" class="queue-domain-switcher__tab" data-queue-domain-select="deployment" data-state="${
                        model.effectiveDomain === 'deployment'
                            ? 'active'
                            : 'idle'
                    }">Despliegue</button>
                    <button id="queueDomainIncidents" type="button" class="queue-domain-switcher__tab" data-queue-domain-select="incidents" data-state="${
                        model.effectiveDomain === 'incidents'
                            ? 'active'
                            : 'idle'
                    }">Incidentes</button>
                </div>
            </section>
        `
    );

    root.querySelectorAll('[data-queue-domain-select]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            persistSelection(button.dataset.queueDomainSelect || 'operations');
            renderQueueHubDomainView();
        };
    });

    const autoButton = document.getElementById('queueDomainAuto');
    if (autoButton instanceof HTMLButtonElement) {
        autoButton.onclick = () => {
            persistSelection('auto');
            renderQueueHubDomainView();
        };
    }
}
