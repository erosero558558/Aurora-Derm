import { escapeHtml, formatDateTime } from '../../../../../ui/render.js';
import { APP_COPY } from './constants.js';
import { absoluteUrl } from './platform.js';

export function renderDesktopCard(key, appConfig, platform) {
    const copy = APP_COPY[key];
    const detectedTarget =
        platform === 'mac'
            ? appConfig.targets.mac
            : platform === 'win'
              ? appConfig.targets.win
              : appConfig.targets.win || appConfig.targets.mac;
    const detectedLabel =
        platform === 'mac'
            ? 'macOS'
            : platform === 'win'
              ? 'Windows'
              : (detectedTarget && detectedTarget.label) || 'este equipo';
    const alternateTargets = Object.entries(appConfig.targets || {})
        .filter(([_targetKey, value]) => value && value.url)
        .map(
            ([targetKey, value]) => `
                <a
                    href="${escapeHtml(value.url)}"
                    class="${targetKey === platform ? 'queue-app-card__recommended' : ''}"
                    download
                >
                    ${escapeHtml(value.label || targetKey)}
                </a>
            `
        )
        .join('');

    return `
        <article class="queue-app-card">
            <div>
                <p class="queue-app-card__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                <h5 class="queue-app-card__title">${escapeHtml(copy.title)}</h5>
                <p class="queue-app-card__description">${escapeHtml(copy.description)}</p>
            </div>
            <p class="queue-app-card__meta">
                v${escapeHtml(appConfig.version || '0.1.0')} · ${escapeHtml(
                    formatDateTime(appConfig.updatedAt || '')
                )}
            </p>
            <span class="queue-app-card__tag">Ideal para ${escapeHtml(copy.recommendedFor)}</span>
            <div class="queue-app-card__actions">
                ${
                    detectedTarget && detectedTarget.url
                        ? `<a href="${escapeHtml(
                              detectedTarget.url
                          )}" class="queue-app-card__cta-primary" download>Descargar para ${escapeHtml(
                              detectedLabel
                          )}</a>`
                        : ''
                }
            </div>
            <div class="queue-app-card__targets">${alternateTargets}</div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/')}">Abrir versión web</a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(
                        absoluteUrl(
                            (detectedTarget && detectedTarget.url) || ''
                        )
                    )}"
                >
                    Copiar enlace
                </button>
            </div>
            <ul class="queue-app-card__notes">
                ${copy.notes
                    .map((note) => `<li>${escapeHtml(note)}</li>`)
                    .join('')}
            </ul>
        </article>
    `;
}
