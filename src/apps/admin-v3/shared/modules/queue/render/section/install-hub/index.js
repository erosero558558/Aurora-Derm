import { setHtml, setText } from '../../../../../ui/render.js';
import { renderDesktopCard } from './desktop-card.js';
import { mergeManifest } from './manifest.js';
import { detectPlatform } from './platform.js';
import { renderTvCard } from './tv-card.js';

export function renderQueueInstallHub() {
    const cardsRoot = document.getElementById('queueAppDownloadsCards');
    if (!(cardsRoot instanceof HTMLElement)) {
        return;
    }

    const platform = detectPlatform();
    const platformChip = document.getElementById('queueAppsPlatformChip');
    const platformLabel =
        platform === 'mac'
            ? 'macOS detectado'
            : platform === 'win'
              ? 'Windows detectado'
              : 'Selecciona la plataforma del equipo';
    setText('#queueAppsPlatformChip', platformLabel);
    if (platformChip instanceof HTMLElement) {
        platformChip.setAttribute('data-platform', platform);
    }

    const manifest = mergeManifest();
    setHtml(
        '#queueAppDownloadsCards',
        [
            renderDesktopCard('operator', manifest.operator, platform),
            renderDesktopCard('kiosk', manifest.kiosk, platform),
            renderTvCard(manifest.sala_tv),
        ].join('')
    );
}
