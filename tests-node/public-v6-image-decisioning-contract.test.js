const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
    return JSON.parse(
        fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
    );
}

async function loadPublicV6() {
    return import(
        pathToFileURL(
            path.join(ROOT, 'src/apps/astro/src/lib/public-v6.js')
        ).href
    );
}

test('public-v6 image decisioning contract: service slots are present for every service slug', () => {
    const registry = readJson('content/public-v6/image-slot-registry.json');
    const slotIds = new Set(
        (Array.isArray(registry.slots) ? registry.slots : []).map((slot) =>
            String(slot.slotId || '').trim()
        )
    );
    const service = readJson('content/public-v6/es/service.json');
    const services = Array.isArray(service.services) ? service.services : [];

    assert.ok(services.length > 0);
    services.forEach((item) => {
        assert.ok(slotIds.has(`service.${item.slug}.hero`));
        assert.ok(slotIds.has(`service.${item.slug}.statement`));
    });
});

test('public-v6 image decisioning contract: approved decisions only reference public-safe assets', () => {
    const manifest = readJson('content/public-v6/assets-manifest.json');
    const decisions = readJson('content/public-v6/image-decisions.json');
    const assetsById = new Map(
        (Array.isArray(manifest.assets) ? manifest.assets : []).map((asset) => [
            asset.id,
            asset,
        ])
    );

    (Array.isArray(decisions.decisions) ? decisions.decisions : []).forEach(
        (decision) => {
            const asset = assetsById.get(decision.assetId);
            assert.ok(asset, `missing asset ${decision.assetId}`);
            assert.equal(asset.publicWebSafe, true);
            assert.notEqual(asset.sourceType, 'real_case');
            assert.ok(Number.isInteger(decision.revision));
            assert.ok(decision.revision > 0);
        }
    );
});

test('public-v6 image decisioning contract: overlay resolves home, service, telemedicine, and legal slots', async () => {
    const publicV6 = await loadPublicV6();
    const manifest = readJson('content/public-v6/assets-manifest.json');
    const decisions = readJson('content/public-v6/image-decisions.json');
    const assetsById = new Map(
        (Array.isArray(manifest.assets) ? manifest.assets : []).map((asset) => [
            asset.id,
            asset,
        ])
    );
    const decisionsBySlot = new Map(
        (Array.isArray(decisions.decisions) ? decisions.decisions : []).map(
            (decision) => [decision.slotId, decision]
        )
    );

    const home = publicV6.getV6HomeData('es');
    const homeDecision = decisionsBySlot.get('home.hero.slides.s1');
    assert.equal(
        home.hero.slides[0].image,
        assetsById.get(homeDecision.assetId).src
    );

    const telemedicine = publicV6.getV6TelemedicineData('es');
    assert.equal(
        telemedicine.ui.statement.slotId,
        'telemedicine.statement'
    );
    assert.equal(
        telemedicine.ui.statement.assetId,
        decisionsBySlot.get('telemedicine.statement').assetId
    );

    const service = publicV6.getV6ServiceData('es');
    const diagnostico = service.services.find(
        (item) => item.slug === 'diagnostico-integral'
    );
    assert.ok(diagnostico);
    assert.equal(
        diagnostico.heroImageSlotId,
        'service.diagnostico-integral.hero'
    );
    assert.equal(
        diagnostico.statementImageSlotId,
        'service.diagnostico-integral.statement'
    );
    assert.ok(diagnostico.statementImage);

    const legalPage = publicV6.getV6LegalPage('en', 'terms');
    assert.ok(legalPage);
    assert.equal(legalPage.heroImageSlotId, 'legal.pages.terminos.hero');
    assert.equal(legalPage.indexCardSlotId, 'legal.indexCards.terminos');
});
