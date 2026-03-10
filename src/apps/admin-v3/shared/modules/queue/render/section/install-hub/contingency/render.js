import { escapeHtml, setHtml } from '../../../../../../ui/render.js';
import { renderContingencyAction } from './actions.js';
import { buildContingencyCards } from './cards.js';

export function renderContingencyDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueContingencyDeck');
    if (!(root instanceof HTMLElement)) return;

    const { syncHealth, cards } = buildContingencyCards(
        manifest,
        detectedPlatform
    );
    const title =
        syncHealth.state === 'alert'
            ? 'Contingencia activa'
            : syncHealth.state === 'warning'
              ? 'Contingencia preventiva'
              : 'Contingencia rápida lista';
    const summary =
        syncHealth.state === 'alert'
            ? 'Resuelve primero la sincronización y luego ataca hardware puntual. Las rutas de abajo ya quedan preparadas para operar sin perder tiempo.'
            : syncHealth.state === 'warning'
              ? 'Hay señal de retraso en la cola. Usa estas rutas directas antes de que el operador quede fuera de contexto.'
              : 'Las tarjetas de abajo sirven como ruta corta cuando algo falla en medio de la jornada, sin mezclar instalación con operación.';

    setHtml(
        '#queueContingencyDeck',
        `
        <section class="queue-contingency-deck__shell">
            <div class="queue-contingency-deck__header">
                <div>
                    <p class="queue-app-card__eyebrow">Contingencia rápida</p>
                    <h5 id="queueContingencyTitle" class="queue-app-card__title">${escapeHtml(title)}</h5>
                    <p id="queueContingencySummary" class="queue-contingency-deck__summary">${escapeHtml(summary)}</p>
                </div>
                <span id="queueContingencyStatus" class="queue-contingency-deck__status" data-state="${escapeHtml(syncHealth.state)}">${escapeHtml(syncHealth.badge)}</span>
            </div>
            <div id="queueContingencyCards" class="queue-contingency-deck__grid" role="list" aria-label="Tarjetas de contingencia rápida">
                ${cards
                    .map(
                        (card) => `
                    <article class="queue-contingency-card" ${card.id === 'sync_issue' ? 'id="queueContingencySyncCard"' : ''} data-state="${escapeHtml(card.state)}" role="listitem">
                        <div class="queue-contingency-card__header">
                            <div>
                                <strong>${escapeHtml(card.title)}</strong>
                                <p class="queue-contingency-card__summary">${escapeHtml(card.summary)}</p>
                            </div>
                            <span class="queue-contingency-card__badge">${escapeHtml(card.badge)}</span>
                        </div>
                        <ul class="queue-contingency-card__steps">${card.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ul>
                        <div class="queue-contingency-card__actions">${card.actions.map((action, index) => renderContingencyAction(card.id, action, index)).join('')}</div>
                    </article>
                `
                    )
                    .join('')}
            </div>
        </section>
    `
    );
}
