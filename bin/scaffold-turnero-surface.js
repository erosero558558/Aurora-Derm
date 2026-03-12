#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    REGISTRY_PATH,
    readTurneroSurfaceRegistry,
    resolveTurneroDownloadPublicPath,
    resolveTurneroUpdatePublicFeedPath,
    resolveTurneroUpdatePublicPayloadPath,
    slugifySurfaceId,
} = require('../lib/turnero-surface-registry.js');

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            continue;
        }
        const key = token.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            parsed[key] = 'true';
            continue;
        }
        parsed[key] = next;
        index += 1;
    }
    return parsed;
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeFile(filePath, contents) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, contents, 'utf8');
}

function requiredArg(args, key) {
    const value = String(args[key] || '').trim();
    if (value === '') {
        throw new Error(`Debes pasar --${key}`);
    }
    return value;
}

function normalizeFamily(value) {
    return String(value || '')
        .trim()
        .toLowerCase() === 'android'
        ? 'android'
        : 'desktop';
}

function createDesktopSurfaceDefinition(meta) {
    return {
        id: meta.id,
        family: 'desktop',
        route: meta.route,
        productName: meta.productName,
        artifactBase: meta.artifactBase,
        executableName: meta.artifactBase,
        appId: meta.appId,
        webFallbackUrl: meta.webFallbackUrl,
        guideUrl: meta.guideUrl,
        updateChannel: 'stable',
        catalog: {
            title: meta.title,
            eyebrow: meta.eyebrow,
            description: meta.description,
            qrTarget: 'prepared',
            notes: [
                'Placeholder: define hardware, shell operativo y smoke especifico antes del primer release.',
                'Placeholder: valida rutas de update, instalador y perfil de arranque para esta superficie.',
            ],
        },
        launchDefaults: {},
        release: {
            artifactName: `turnero-desktop-${meta.slug}`,
        },
        desktop: {
            buildDir: 'src/apps/turnero-desktop',
            distDir: `src/apps/turnero-desktop/dist/${meta.id}`,
            supportsAutoUpdate: true,
        },
        targets: {
            win: {
                label: 'Windows',
                downloadPath: `${meta.slug}/win`,
                manualFile: `${meta.artifactBase}Setup.exe`,
                updatePath: `${meta.slug}/win`,
                updateFile: `${meta.artifactBase}Setup.exe`,
                feedFile: 'latest.yml',
            },
            mac: {
                label: 'macOS',
                downloadPath: `${meta.slug}/mac`,
                manualFile: `${meta.artifactBase}.dmg`,
                updatePath: `${meta.slug}/mac`,
                updateFile: `${meta.artifactBase}.zip`,
                feedFile: 'latest-mac.yml',
            },
        },
    };
}

function createAndroidSurfaceDefinition(meta) {
    return {
        id: meta.id,
        family: 'android',
        route: meta.route,
        productName: meta.productName,
        artifactBase: meta.artifactBase,
        appId: meta.appId,
        webFallbackUrl: meta.webFallbackUrl,
        guideUrl: meta.guideUrl,
        updateChannel: 'stable',
        catalog: {
            title: meta.title,
            eyebrow: meta.eyebrow,
            description: meta.description,
            qrTarget: 'download',
            notes: [
                'Placeholder: define hardware objetivo, provisioning y smoke especifico antes del primer release.',
                'Placeholder: confirma modulo Android, firma y recovery operativo para esta superficie.',
            ],
        },
        launchDefaults: {},
        release: {
            artifactName: `turnero-android-${meta.slug}`,
        },
        android: {
            gradleProject: `src/apps/${meta.id}`,
            buildTask: 'assembleRelease',
            sourceArtifact: 'app/build/outputs/apk/release/app-release.apk',
            stagedArtifact: `${meta.artifactBase}.apk`,
            targetKey: 'android_tv',
            baseUrl: 'https://pielarmonia.com',
            surfacePath: meta.route,
        },
        targets: {
            android_tv: {
                label: 'Android TV APK',
                downloadPath: `${meta.slug}/android`,
                manualFile: `${meta.artifactBase}.apk`,
            },
        },
    };
}

function buildMeta(args) {
    const id = requiredArg(args, 'id').toLowerCase();
    const slug = slugifySurfaceId(id);
    const family = normalizeFamily(requiredArg(args, 'family'));
    const productName = requiredArg(args, 'productName');
    const artifactBase = requiredArg(args, 'artifactBase');
    const route = String(args.route || `/${slug}.html`).trim();
    const title = String(args.title || productName).trim();
    const defaultEyebrow =
        family === 'android' ? 'App nativa' : 'Shell instalable';

    return {
        id,
        slug,
        family,
        productName,
        artifactBase,
        route,
        title,
        eyebrow: String(args.eyebrow || defaultEyebrow).trim(),
        description: String(
            args.description ||
                `Placeholder de distribucion para ${productName}.`
        ).trim(),
        appId: String(
            args.appId || `com.pielarmonia.turnero.${slug.replace(/-/g, '')}`
        ).trim(),
        guideUrl: String(
            args.guideUrl || `/app-downloads/?surface=${id}`
        ).trim(),
        webFallbackUrl: String(args.webFallbackUrl || route).trim(),
    };
}

function createDistributionStub(surfaceDefinition) {
    const downloads = [];
    const updates = [];

    for (const targetKey of Object.keys(surfaceDefinition.targets || {})) {
        const downloadPath = resolveTurneroDownloadPublicPath(
            surfaceDefinition,
            targetKey
        );
        if (downloadPath !== '') {
            downloads.push(downloadPath);
        }

        const feedPath = resolveTurneroUpdatePublicFeedPath(
            surfaceDefinition,
            targetKey
        );
        const payloadPath = resolveTurneroUpdatePublicPayloadPath(
            surfaceDefinition,
            targetKey
        );

        if (feedPath !== '') {
            updates.push(feedPath);
        }
        if (payloadPath !== '') {
            updates.push(payloadPath);
        }
    }

    return {
        id: surfaceDefinition.id,
        family: surfaceDefinition.family,
        status: 'placeholder',
        expectedPublicPaths: {
            downloads,
            updates,
        },
        nextSteps: [
            'Conectar un build real que produzca los artefactos esperados.',
            'Completar notas operativas y smoke de la superficie.',
            'Validar el release bundle con stage-turnero-app-release.js.',
        ],
    };
}

function buildDocsStub(surfaceDefinition) {
    const targetLines = Object.entries(surfaceDefinition.targets || {})
        .map(([targetKey, target]) => {
            const downloadPath = resolveTurneroDownloadPublicPath(
                surfaceDefinition,
                targetKey
            );
            const feedPath = resolveTurneroUpdatePublicFeedPath(
                surfaceDefinition,
                targetKey
            );
            const payloadPath = resolveTurneroUpdatePublicPayloadPath(
                surfaceDefinition,
                targetKey
            );

            return [
                `## ${target.label || targetKey}`,
                '',
                `- Target key: \`${targetKey}\``,
                `- Download: \`${downloadPath || 'pendiente'}\``,
                `- Update feed: \`${feedPath || 'n/a'}\``,
                `- Update payload: \`${payloadPath || 'n/a'}\``,
                '',
            ].join('\n');
        })
        .join('\n');

    const platformPlaceholder =
        surfaceDefinition.family === 'desktop'
            ? [
                  '## Placeholder de shell',
                  '',
                  '- Reusa `src/apps/turnero-desktop` o documenta por que esta superficie requiere otro shell.',
                  '- Define launch mode, autostart y politicas de navegacion permitida.',
                  '- Alinea el perfil de primer arranque con `turnero-desktop.json` o agrega el contrato equivalente.',
                  '',
              ].join('\n')
            : [
                  '## Placeholder de shell',
                  '',
                  '- Define modulo Android real, firma, nombre visible y recovery operativo.',
                  '- Confirma `baseUrl`, `surfacePath` y empaquetado release desde Gradle.',
                  '- Documenta instalacion, reprovisioning y rollback del dispositivo destino.',
                  '',
              ].join('\n');

    return [
        `# ${surfaceDefinition.productName}`,
        '',
        '## Registry',
        '',
        `- ID: \`${surfaceDefinition.id}\``,
        `- Family: \`${surfaceDefinition.family}\``,
        `- Route: \`${surfaceDefinition.route}\``,
        `- App ID: \`${surfaceDefinition.appId || 'pendiente'}\``,
        `- Guide URL: \`${surfaceDefinition.guideUrl}\``,
        '',
        targetLines,
        platformPlaceholder,
        '## Smoke minimo',
        '',
        '- Publica el artefacto y valida que el centro de descargas lo resuelva.',
        '- Abre la ruta preparada o la app instalada contra la superficie remota correcta.',
        '- Verifica reconexion, navegacion bloqueada y checklist operativo del equipo.',
        '',
        '## Rollback',
        '',
        '- Revertir la entrada del registry si la superficie aun no tiene build real.',
        '- Si hubo release, retirar artefactos de `app-downloads/` y `desktop-updates/`.',
        '- Confirmar que `release-manifest.json` ya no expone la superficie.',
        '',
    ].join('\n');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const registryPath = path.resolve(
        String(args.registry || REGISTRY_PATH).trim()
    );
    const docsDir = path.resolve(
        String(args.docsDir || 'docs/turnero-surfaces').trim()
    );
    const stubsDir = path.resolve(
        String(args.stubsDir || 'verification/turnero-surface-stubs').trim()
    );

    const registry = readJson(registryPath);
    const meta = buildMeta(args);
    const current = readTurneroSurfaceRegistry(registryPath);
    if (current.surfaces.some((surface) => surface.id === meta.id)) {
        throw new Error(`La superficie ${meta.id} ya existe en el registry`);
    }

    const surfaceDefinition =
        meta.family === 'android'
            ? createAndroidSurfaceDefinition(meta)
            : createDesktopSurfaceDefinition(meta);

    const nextRegistry = {
        ...registry,
        surfaces: [
            ...(Array.isArray(registry.surfaces) ? registry.surfaces : []),
            surfaceDefinition,
        ],
    };
    writeJson(registryPath, nextRegistry);

    const docsPath = path.join(docsDir, `${meta.id}.md`);
    const stubPath = path.join(stubsDir, `${meta.id}.json`);
    writeFile(docsPath, `${buildDocsStub(surfaceDefinition)}\n`);
    writeJson(stubPath, createDistributionStub(surfaceDefinition));

    process.stdout.write(
        `${JSON.stringify(
            {
                ok: true,
                id: meta.id,
                family: meta.family,
                registryPath,
                docsPath,
                stubPath,
            },
            null,
            2
        )}\n`
    );
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
