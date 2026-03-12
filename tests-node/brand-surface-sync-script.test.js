const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function loadSyncModule() {
    return import(
        pathToFileURL(
            path.join(
                ROOT,
                'src/apps/astro/scripts/sync-brand-surface-packet.mjs'
            )
        ).href
    );
}

function createTmpRoot() {
    const tmpRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'brand-surface-sync-')
    );
    writeJson(
        path.join(tmpRoot, 'content/public-v6/assets-manifest.json'),
        {
            version: 'test',
            updated_at: '2026-03-12',
            assets: [],
        }
    );
    writeJson(
        path.join(tmpRoot, 'content/public-v6/image-decisions.json'),
        {
            version: 'test',
            updated_at: '2026-03-12',
            revision: 0,
            decisions: [],
        }
    );
    fs.mkdirSync(path.join(tmpRoot, 'images', 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'images', 'optimized'), {
        recursive: true,
    });
    return tmpRoot;
}

test('brand surface sync script applies approved packets into canonical public-v6 files', async () => {
    const { applyBrandSurfacePacket } = await loadSyncModule();
    const tmpRoot = createTmpRoot();
    const sourceMaster = path.join(tmpRoot, 'incoming', 'asset-a.svg');
    const optimizedFile = path.join(tmpRoot, 'incoming', 'asset-a.webp');
    fs.mkdirSync(path.dirname(sourceMaster), { recursive: true });
    fs.writeFileSync(sourceMaster, '<svg></svg>', 'utf8');
    fs.writeFileSync(optimizedFile, 'webp-binary');

    const result = applyBrandSurfacePacket({
        rootDir: tmpRoot,
        packet: {
            revision: 2,
            exportedAt: '2026-03-12T12:00:00.000Z',
            exportedBy: 'brand_editor',
            approvedDecisions: [
                {
                    slotId: 'service.demo.hero',
                    assetId: 'asset-a',
                    approvedAt: '2026-03-12T12:00:00.000Z',
                    approvedBy: 'brand_editor',
                },
            ],
            approvedAssets: [
                {
                    assetId: 'asset-a',
                    sourceType: 'ai_generated',
                    publicWebSafe: true,
                    manifestEntry: {
                        id: 'asset-a',
                        kind: 'card',
                        src: '/images/optimized/asset-a.webp',
                        srcset: '',
                        status: 'approved',
                        sourceType: 'ai_generated',
                        publicWebSafe: true,
                        orientation: 'landscape',
                        editorialTags: ['demo'],
                        allowedSlotRoles: ['page_hero'],
                        tone: 'ink',
                        localeAlt: { es: 'Demo ES', en: 'Demo EN' },
                        generation: {
                            strategy: 'unit_test',
                            source: 'brand-surface-sync-script.test.js',
                        },
                    },
                    sourceMasterPath: sourceMaster,
                    optimizedFiles: [optimizedFile],
                },
            ],
        },
    });

    assert.equal(result.ok, true);

    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(tmpRoot, 'content/public-v6/assets-manifest.json'),
            'utf8'
        )
    );
    const decisions = JSON.parse(
        fs.readFileSync(
            path.join(tmpRoot, 'content/public-v6/image-decisions.json'),
            'utf8'
        )
    );

    assert.equal(manifest.assets.length, 1);
    assert.equal(manifest.assets[0].id, 'asset-a');
    assert.equal(decisions.decisions.length, 1);
    assert.equal(decisions.decisions[0].slotId, 'service.demo.hero');
    assert.equal(decisions.decisions[0].revision, 2);
    assert.ok(
        fs.existsSync(path.join(tmpRoot, 'images/src', 'asset-a.svg'))
    );
    assert.ok(
        fs.existsSync(path.join(tmpRoot, 'images/optimized', 'asset-a.webp'))
    );
});

test('brand surface sync script rejects packets that leak private case references', async () => {
    const { applyBrandSurfacePacket } = await loadSyncModule();
    const tmpRoot = createTmpRoot();

    assert.throws(
        () =>
            applyBrandSurfacePacket({
                rootDir: tmpRoot,
                packet: {
                    revision: 1,
                    exportedAt: '2026-03-12T12:00:00.000Z',
                    exportedBy: 'brand_editor',
                    approvedDecisions: [
                        {
                            slotId: 'service.demo.hero',
                            assetId: 'asset-a',
                            approvedAt: '2026-03-12T12:00:00.000Z',
                            approvedBy: 'brand_editor',
                        },
                    ],
                    approvedAssets: [
                        {
                            assetId: 'asset-a',
                            sourceType: 'ai_generated',
                            publicWebSafe: true,
                            manifestEntry: {
                                id: 'asset-a',
                                kind: 'card',
                                src: '/images/optimized/asset-a.webp',
                                srcset: '',
                                status: 'approved',
                                sourceType: 'ai_generated',
                                publicWebSafe: true,
                                orientation: 'landscape',
                                editorialTags: ['demo'],
                                allowedSlotRoles: ['page_hero'],
                                tone: 'ink',
                                localeAlt: { es: 'Demo ES', en: 'Demo EN' },
                                generation: {
                                    strategy: 'unit_test',
                                    source:
                                        'brand-surface-sync-script.test.js',
                                },
                                privateCaseRefs: ['case_media_flow:demo'],
                            },
                            sourceMasterPath: null,
                            optimizedFiles: [],
                        },
                    ],
                },
            }),
        /privateCaseRefs/
    );
});
