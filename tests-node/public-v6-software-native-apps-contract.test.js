const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const repoRoot = path.resolve(__dirname, '..');

let publicV6ModulePromise = null;

async function loadPublicV6Module() {
    if (!publicV6ModulePromise) {
        publicV6ModulePromise = import(
            pathToFileURL(
                path.join(
                    repoRoot,
                    'src',
                    'apps',
                    'astro',
                    'src',
                    'lib',
                    'public-v6.js'
                )
            ).href
        );
    }
    return publicV6ModulePromise;
}

test('public-v6 software landing derives native app cards from the turnero registry', async () => {
    const { getV6SoftwarePage } = await loadPublicV6Module();
    const esLanding = getV6SoftwarePage('es', 'landing');
    const enLanding = getV6SoftwarePage('en', 'landing');

    assert.equal(Array.isArray(esLanding?.nativeApps?.cards), true);
    assert.deepEqual(
        esLanding.nativeApps.cards.map((card) => card.surfaceId),
        ['operator', 'kiosk', 'sala_tv']
    );
    assert.equal(
        esLanding.nativeApps.cards.some(
            (card) =>
                card.surfaceId === 'operator' &&
                card.guideHref === '/app-downloads/?surface=operator' &&
                card.webHref === '/operador-turnos.html'
        ),
        true
    );
    assert.equal(
        esLanding.nativeApps.cards.some(
            (card) =>
                card.surfaceId === 'sala_tv' &&
                card.guideHref === '/app-downloads/?surface=sala_tv'
        ),
        true
    );
    assert.equal(
        enLanding.nativeApps.cards.some(
            (card) =>
                card.surfaceId === 'kiosk' &&
                card.title === 'Turnero Kiosk' &&
                card.webHref === '/kiosco-turnos.html'
        ),
        true
    );
});
