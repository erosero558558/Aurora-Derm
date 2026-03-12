#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(
    __dirname,
    '..',
    'bin',
    'stage-turnero-app-release.js'
);

function writeFixture(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

function createDesktopFixture(rootDir, surfaceKey, artifactBase) {
    writeFixture(
        path.join(rootDir, surfaceKey, 'win', `${artifactBase}Setup.exe`),
        `${surfaceKey}-win-exe`
    );
    writeFixture(
        path.join(rootDir, surfaceKey, 'win', 'latest.yml'),
        `${surfaceKey}-win-latest`
    );
    writeFixture(
        path.join(
            rootDir,
            surfaceKey,
            'win',
            `${artifactBase}Setup.exe.blockmap`
        ),
        `${surfaceKey}-win-blockmap`
    );

    writeFixture(
        path.join(rootDir, surfaceKey, 'mac', `${artifactBase}.dmg`),
        `${surfaceKey}-mac-dmg`
    );
    writeFixture(
        path.join(rootDir, surfaceKey, 'mac', `${artifactBase}.zip`),
        `${surfaceKey}-mac-zip`
    );
    writeFixture(
        path.join(rootDir, surfaceKey, 'mac', 'latest-mac.yml'),
        `${surfaceKey}-mac-latest`
    );
    writeFixture(
        path.join(rootDir, surfaceKey, 'mac', `${artifactBase}.zip.blockmap`),
        `${surfaceKey}-mac-zip-blockmap`
    );
}

function createDownloadedArtifactFixture(rootDir, artifactName, files) {
    for (const [relativePath, contents] of Object.entries(files)) {
        writeFixture(path.join(rootDir, artifactName, relativePath), contents);
    }
}

test('stage-turnero-app-release genera bundle y manifest con rutas publicas', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'turnero-release-'));
    const desktopRoot = path.join(tempRoot, 'desktop');
    const tvRoot = path.join(tempRoot, 'tv');
    const outputRoot = path.join(tempRoot, 'bundle');

    createDesktopFixture(desktopRoot, 'operator', 'TurneroOperador');
    createDesktopFixture(desktopRoot, 'kiosk', 'TurneroKiosco');
    writeFixture(path.join(tvRoot, 'TurneroSalaTV.apk'), 'tv-apk');

    const result = spawnSync(
        process.execPath,
        [
            SCRIPT_PATH,
            '--version',
            '0.1.3',
            '--baseUrl',
            'https://pielarmonia.com',
            '--desktopRoot',
            desktopRoot,
            '--tvRoot',
            tvRoot,
            '--outputRoot',
            outputRoot,
            '--releasedAt',
            '2026-03-10T12:00:00Z',
        ],
        {
            cwd: path.resolve(__dirname, '..'),
            encoding: 'utf8',
        }
    );

    assert.equal(result.status, 0, result.stderr);

    const manifestPath = path.join(
        outputRoot,
        'app-downloads',
        'stable',
        'release-manifest.json'
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(manifest.version, '0.1.3');
    assert.equal(
        manifest.apps.operator.targets.win.url.includes(
            '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe'
        ),
        true
    );
    assert.equal(
        manifest.apps.operator.updates.win.feedUrl.includes(
            '/desktop-updates/stable/operator/win/latest.yml'
        ),
        true
    );
    assert.equal(
        manifest.apps.kiosk.targets.mac.url.includes(
            '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg'
        ),
        true
    );
    assert.equal(
        manifest.apps.sala_tv.targets.android_tv.url.includes(
            '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk'
        ),
        true
    );

    const shaPath = path.join(
        outputRoot,
        'app-downloads',
        'stable',
        'SHA256SUMS.txt'
    );
    const shaRaw = fs.readFileSync(shaPath, 'utf8');
    assert.equal(
        shaRaw.includes(
            'app-downloads/stable/operator/win/TurneroOperadorSetup.exe'
        ),
        true
    );
    assert.equal(
        shaRaw.includes('desktop-updates/stable/operator/win/latest.yml'),
        true
    );
    assert.equal(
        shaRaw.includes(
            'app-downloads/stable/sala-tv/android/TurneroSalaTV.apk'
        ),
        true
    );
});

test('stage-turnero-app-release falla si falta un artefacto requerido', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'turnero-release-missing-')
    );
    const desktopRoot = path.join(tempRoot, 'desktop');
    const tvRoot = path.join(tempRoot, 'tv');
    const outputRoot = path.join(tempRoot, 'bundle');

    createDesktopFixture(desktopRoot, 'operator', 'TurneroOperador');
    createDesktopFixture(desktopRoot, 'kiosk', 'TurneroKiosco');
    writeFixture(path.join(tvRoot, 'TurneroSalaTV.apk'), 'tv-apk');
    fs.rmSync(path.join(desktopRoot, 'operator', 'win', 'latest.yml'));

    const result = spawnSync(
        process.execPath,
        [
            SCRIPT_PATH,
            '--version',
            '0.1.3',
            '--desktopRoot',
            desktopRoot,
            '--tvRoot',
            tvRoot,
            '--outputRoot',
            outputRoot,
        ],
        {
            cwd: path.resolve(__dirname, '..'),
            encoding: 'utf8',
        }
    );

    assert.notEqual(result.status, 0);
    assert.equal(result.stderr.includes('feed update operator/win'), true);
});

test('stage-turnero-app-release soporta layout de artifacts descargados por nombre de release', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'turnero-release-flat-')
    );
    const desktopRoot = path.join(tempRoot, 'desktop');
    const androidRoot = path.join(tempRoot, 'android');
    const outputRoot = path.join(tempRoot, 'bundle');

    createDownloadedArtifactFixture(
        desktopRoot,
        'turnero-desktop-operator-win',
        {
            'TurneroOperadorSetup.exe': 'operator-win-exe',
            'latest.yml': 'operator-win-latest',
            'TurneroOperadorSetup.exe.blockmap': 'operator-win-blockmap',
        }
    );
    createDownloadedArtifactFixture(
        desktopRoot,
        'turnero-desktop-operator-mac',
        {
            'TurneroOperador.dmg': 'operator-mac-dmg',
            'TurneroOperador.zip': 'operator-mac-zip',
            'latest-mac.yml': 'operator-mac-latest',
            'TurneroOperador.zip.blockmap': 'operator-mac-blockmap',
        }
    );
    createDownloadedArtifactFixture(desktopRoot, 'turnero-desktop-kiosk-win', {
        'TurneroKioscoSetup.exe': 'kiosk-win-exe',
        'latest.yml': 'kiosk-win-latest',
        'TurneroKioscoSetup.exe.blockmap': 'kiosk-win-blockmap',
    });
    createDownloadedArtifactFixture(desktopRoot, 'turnero-desktop-kiosk-mac', {
        'TurneroKiosco.dmg': 'kiosk-mac-dmg',
        'TurneroKiosco.zip': 'kiosk-mac-zip',
        'latest-mac.yml': 'kiosk-mac-latest',
        'TurneroKiosco.zip.blockmap': 'kiosk-mac-blockmap',
    });
    createDownloadedArtifactFixture(
        androidRoot,
        'turnero-android-sala-tv-android-tv',
        {
            'TurneroSalaTV.apk': 'tv-apk',
        }
    );

    const result = spawnSync(
        process.execPath,
        [
            SCRIPT_PATH,
            '--version',
            '0.1.4',
            '--desktopRoot',
            desktopRoot,
            '--androidRoot',
            androidRoot,
            '--outputRoot',
            outputRoot,
        ],
        {
            cwd: path.resolve(__dirname, '..'),
            encoding: 'utf8',
        }
    );

    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(
                outputRoot,
                'app-downloads',
                'stable',
                'release-manifest.json'
            ),
            'utf8'
        )
    );

    assert.equal(
        manifest.apps.sala_tv.targets.android_tv.url,
        '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk'
    );
});
