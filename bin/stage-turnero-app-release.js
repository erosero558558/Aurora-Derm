#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
    buildTurneroReleaseArtifactName,
    getTurneroDefaultTargetKey,
    getTurneroRegistryDefaults,
    getTurneroTargetDefinition,
    listTurneroSurfaceDefinitions,
    listTurneroTargetKeys,
    resolveTurneroDownloadPublicPath,
    resolveTurneroUpdatePublicFeedPath,
    resolveTurneroUpdatePublicPayloadPath,
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

function resetDir(dirPath) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    ensureDir(dirPath);
}

function toWebPath(filePath, outputRoot) {
    return `/${path.relative(outputRoot, filePath).split(path.sep).join('/')}`;
}

function sha256(filePath) {
    return crypto
        .createHash('sha256')
        .update(fs.readFileSync(filePath))
        .digest('hex');
}

function copyTrackedFile(sourcePath, destinationPath, outputRoot, records) {
    ensureDir(path.dirname(destinationPath));
    fs.copyFileSync(sourcePath, destinationPath);
    const stats = fs.statSync(destinationPath);
    const record = {
        path: toWebPath(destinationPath, outputRoot),
        bytes: stats.size,
        sha256: sha256(destinationPath),
    };
    records.push(record);
    return record;
}

function copyCompanionBlockmap(
    sourcePath,
    destinationPath,
    outputRoot,
    records
) {
    const blockmapSource = `${sourcePath}.blockmap`;
    if (!fs.existsSync(blockmapSource)) {
        return null;
    }
    return copyTrackedFile(
        blockmapSource,
        `${destinationPath}.blockmap`,
        outputRoot,
        records
    );
}

function requireFile(filePath, description) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Falta ${description}: ${filePath}`);
    }
    return filePath;
}

function buildShaLines(records) {
    return records
        .map((record) => `${record.sha256}  ${record.path.replace(/^\//, '')}`)
        .join('\n');
}

function publicPathToOutputPath(outputRoot, publicPath) {
    return path.join(
        outputRoot,
        ...String(publicPath || '')
            .replace(/^\/+/, '')
            .split('/')
            .filter(Boolean)
    );
}

function resolveDesktopSourceDir(desktopRoot, surface, targetKey) {
    const candidates = [
        path.join(desktopRoot, surface.id, targetKey),
        path.join(
            desktopRoot,
            buildTurneroReleaseArtifactName(surface, targetKey)
        ),
        path.join(
            desktopRoot,
            String(surface.desktop?.distDir || ''),
            targetKey
        ),
    ];

    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            return resolved;
        }
    }

    throw new Error(
        `No se encontro build desktop para ${surface.id}/${targetKey} en ${desktopRoot}`
    );
}

function resolveAndroidArtifactFile(androidRoot, surface, targetKey) {
    const target = getTurneroTargetDefinition(surface, targetKey);
    const candidates = [
        path.join(androidRoot, String(surface.android?.stagedArtifact || '')),
        path.join(
            androidRoot,
            buildTurneroReleaseArtifactName(surface, targetKey),
            String(surface.android?.stagedArtifact || target?.manualFile || '')
        ),
        path.join(androidRoot, String(surface.android?.sourceArtifact || '')),
        path.join(
            androidRoot,
            buildTurneroReleaseArtifactName(surface, targetKey),
            path.basename(String(surface.android?.sourceArtifact || ''))
        ),
    ].filter((candidate) => String(candidate || '').trim() !== '');

    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
            return resolved;
        }
    }

    const apkCandidates = fs
        .readdirSync(androidRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.apk'))
        .map((entry) => path.join(androidRoot, entry.name))
        .sort();

    if (apkCandidates.length > 0) {
        return apkCandidates[0];
    }

    throw new Error(
        `No se encontro artefacto Android para ${surface.id}/${targetKey} en ${androidRoot}`
    );
}

function stageDesktopSurface(
    surface,
    outputRoot,
    desktopRoot,
    channel,
    version,
    releasedAt
) {
    const surfaceManifest = {
        version,
        updatedAt: releasedAt,
        webFallbackUrl: surface.webFallbackUrl,
        guideUrl: surface.guideUrl,
        targets: {},
        updates: {},
        files: [],
    };

    for (const targetKey of listTurneroTargetKeys(surface)) {
        const target = getTurneroTargetDefinition(surface, targetKey);
        const sourceDir = resolveDesktopSourceDir(
            desktopRoot,
            surface,
            targetKey
        );

        const manualSource = requireFile(
            path.join(sourceDir, target.manualFile),
            `instalador ${surface.id}/${targetKey}`
        );
        const manualDestination = publicPathToOutputPath(
            outputRoot,
            resolveTurneroDownloadPublicPath(surface, targetKey, { channel })
        );
        const manualRecord = copyTrackedFile(
            manualSource,
            manualDestination,
            outputRoot,
            surfaceManifest.files
        );
        copyCompanionBlockmap(
            manualSource,
            manualDestination,
            outputRoot,
            surfaceManifest.files
        );

        surfaceManifest.targets[targetKey] = {
            label: target.label,
            url: manualRecord.path,
            sha256: manualRecord.sha256,
            bytes: manualRecord.bytes,
        };

        if (
            target.feedFile === '' ||
            target.updateFile === '' ||
            target.updatePath === ''
        ) {
            continue;
        }

        const feedSource = requireFile(
            path.join(sourceDir, target.feedFile),
            `feed update ${surface.id}/${targetKey}`
        );
        const feedRecord = copyTrackedFile(
            feedSource,
            publicPathToOutputPath(
                outputRoot,
                resolveTurneroUpdatePublicFeedPath(surface, targetKey, {
                    channel,
                })
            ),
            outputRoot,
            surfaceManifest.files
        );

        const updateFileName = target.updateFile || target.manualFile;
        const updateSource = requireFile(
            path.join(sourceDir, updateFileName),
            `payload update ${surface.id}/${targetKey}`
        );
        const updateDestination = publicPathToOutputPath(
            outputRoot,
            resolveTurneroUpdatePublicPayloadPath(surface, targetKey, {
                channel,
            })
        );
        const updateRecord = copyTrackedFile(
            updateSource,
            updateDestination,
            outputRoot,
            surfaceManifest.files
        );
        copyCompanionBlockmap(
            updateSource,
            updateDestination,
            outputRoot,
            surfaceManifest.files
        );

        surfaceManifest.updates[targetKey] = {
            feedUrl: feedRecord.path,
            payloadUrl: updateRecord.path,
        };
    }

    return surfaceManifest;
}

function stageAndroidSurface(
    surface,
    outputRoot,
    androidRoot,
    channel,
    version,
    releasedAt
) {
    const targetKey = getTurneroDefaultTargetKey(surface, {
        targetKey: String(surface.android?.targetKey || ''),
    });
    const target = getTurneroTargetDefinition(surface, targetKey);
    const artifactSource = resolveAndroidArtifactFile(
        androidRoot,
        surface,
        targetKey
    );
    const destination = publicPathToOutputPath(
        outputRoot,
        resolveTurneroDownloadPublicPath(surface, targetKey, { channel })
    );
    const files = [];
    const artifactRecord = copyTrackedFile(
        artifactSource,
        destination,
        outputRoot,
        files
    );

    return {
        version,
        updatedAt: releasedAt,
        webFallbackUrl: surface.webFallbackUrl,
        guideUrl: surface.guideUrl,
        targets: {
            [targetKey]: {
                label: target?.label || 'Android',
                url: artifactRecord.path,
                sha256: artifactRecord.sha256,
                bytes: artifactRecord.bytes,
            },
        },
        files,
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const version = String(args.version || '').trim();
    if (!version) {
        throw new Error('Debes pasar --version');
    }

    const channel = String(args.channel || 'stable').trim() || 'stable';
    const outputRoot = path.resolve(
        String(args.outputRoot || 'release/turnero-apps').trim()
    );
    const defaults = getTurneroRegistryDefaults();
    const desktopRoot = path.resolve(
        String(args.desktopRoot || 'src/apps/turnero-desktop/dist').trim()
    );
    const androidRoot = path.resolve(
        String(
            args.tvRoot ||
                args.androidRoot ||
                'src/apps/turnero-sala-tv-android/app/build/outputs/apk/release'
        ).trim()
    );
    const baseUrl = String(args.baseUrl || defaults.baseUrl).trim();
    const releasedAt = String(
        args.releasedAt || new Date().toISOString()
    ).trim();

    resetDir(outputRoot);

    const manifest = {
        schema: 'turnero-release-bundle/v1',
        channel,
        version,
        releasedAt,
        baseUrl,
        apps: {},
    };

    for (const surface of listTurneroSurfaceDefinitions({
        family: 'desktop',
    })) {
        manifest.apps[surface.id] = stageDesktopSurface(
            surface,
            outputRoot,
            desktopRoot,
            channel,
            version,
            releasedAt
        );
    }

    for (const surface of listTurneroSurfaceDefinitions({
        family: 'android',
    })) {
        manifest.apps[surface.id] = stageAndroidSurface(
            surface,
            outputRoot,
            androidRoot,
            channel,
            version,
            releasedAt
        );
    }

    const manifestPath = path.join(
        outputRoot,
        trimBasePath(defaults.downloadBasePath),
        channel,
        'release-manifest.json'
    );
    ensureDir(path.dirname(manifestPath));
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const shaRecords = Object.values(manifest.apps).flatMap((surface) =>
        Array.isArray(surface.files) ? surface.files : []
    );
    const shaPath = path.join(
        outputRoot,
        trimBasePath(defaults.downloadBasePath),
        channel,
        'SHA256SUMS.txt'
    );
    fs.writeFileSync(shaPath, `${buildShaLines(shaRecords)}\n`);

    const summary = {
        version,
        channel,
        releasedAt,
        outputRoot,
        manifestPath,
        fileCount: shaRecords.length + 2,
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function trimBasePath(value) {
    return String(value || '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
