const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function read(filePath) {
    return fs.readFileSync(path.resolve(__dirname, '..', filePath), 'utf8');
}

function extractVersionedAsset(content, assetPathPattern) {
    const regex = new RegExp(`${assetPathPattern}\\?v=([^"'\\s]+)`, 'i');
    const match = content.match(regex);
    return match ? { full: match[0], version: match[1] } : null;
}

test.describe('Version consistency across pages and service worker', () => {
    test('subpages and sw.js use the same critical bundle versions as index', () => {
        const indexHtml = read('index.html');
        const telemedicinaHtml = read('telemedicina.html');
        const acneHtml = read('servicios/acne.html');
        const laserHtml = read('servicios/laser.html');
        const sw = read('sw.js');

        const indexScript = extractVersionedAsset(indexHtml, 'script\\.js');
        const indexBootstrap = extractVersionedAsset(
            indexHtml,
            'js/bootstrap-inline-engine\\.js'
        );
        const indexDeferredStyles = extractVersionedAsset(
            indexHtml,
            'styles-deferred\\.css'
        );

        expect(indexScript, 'index must reference versioned script.js').toBeTruthy();
        expect(
            indexBootstrap,
            'index must reference versioned bootstrap-inline-engine.js'
        ).toBeTruthy();
        expect(
            indexDeferredStyles,
            'index must reference versioned deferred styles'
        ).toBeTruthy();

        const teleScript = extractVersionedAsset(telemedicinaHtml, 'script\\.js');
        const teleBootstrap = extractVersionedAsset(
            telemedicinaHtml,
            'js/bootstrap-inline-engine\\.js'
        );
        const acneScript = extractVersionedAsset(acneHtml, 'script\\.js');
        const laserScript = extractVersionedAsset(laserHtml, 'script\\.js');

        expect(teleScript?.version).toBe(indexScript.version);
        expect(acneScript?.version).toBe(indexScript.version);
        expect(laserScript?.version).toBe(indexScript.version);
        expect(teleBootstrap?.version).toBe(indexBootstrap.version);

        expect(sw).toContain(`/script.js?v=${indexScript.version}`);
        expect(sw).toContain(
            `/js/bootstrap-inline-engine.js?v=${indexBootstrap.version}`
        );
        expect(sw).toContain(
            `/styles-deferred.css?v=ui-20260223-opt1`
        );
    });
});
