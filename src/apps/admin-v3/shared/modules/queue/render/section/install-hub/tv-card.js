import { escapeHtml, formatDateTime } from '../../../../../ui/render.js';
import { APP_COPY } from './constants.js';
import { absoluteUrl, buildQrUrl } from './platform.js';

export function renderTvCard(appConfig) {
    const copy = APP_COPY.sala_tv;
    const target = appConfig.targets.android_tv || {};
    const apkUrl = String(target.url || '');
    const qrUrl = buildQrUrl(apkUrl);

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
                <a
                    href="${escapeHtml(qrUrl)}"
                    class="queue-app-card__cta-primary"
                    target="_blank"
                    rel="noopener"
                >
                    Mostrar QR de instalación
                </a>
                <a href="${escapeHtml(apkUrl)}" download>Descargar APK</a>
            </div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/sala-turnos.html')}">
                    Abrir fallback web
                </a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(absoluteUrl(apkUrl))}"
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
