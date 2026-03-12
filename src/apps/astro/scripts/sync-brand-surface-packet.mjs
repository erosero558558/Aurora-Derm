import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..'
);

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureNoPrivateCaseRefs(value, context = 'packet') {
    if (!value || typeof value !== 'object') {
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            ensureNoPrivateCaseRefs(item, `${context}[${index}]`)
        );
        return;
    }

    Object.entries(value).forEach(([key, item]) => {
        if (key === 'privateCaseRefs') {
            throw new Error(`${context} contains forbidden privateCaseRefs`);
        }
        ensureNoPrivateCaseRefs(item, `${context}.${key}`);
    });
}

function resolveInputPath(rootDir, candidatePath) {
    if (!candidatePath) {
        throw new Error('--input is required');
    }
    return path.isAbsolute(candidatePath)
        ? candidatePath
        : path.resolve(rootDir, candidatePath);
}

function resolveExistingPath(rootDir, candidatePath) {
    const safePath = normalizeText(candidatePath);
    if (!safePath) {
        return null;
    }

    if (path.isAbsolute(safePath)) {
        return safePath;
    }

    const absolute = path.resolve(rootDir, safePath);
    return absolute;
}

function ensurePacket(packet) {
    ensureNoPrivateCaseRefs(packet);

    if (!packet || typeof packet !== 'object') {
        throw new Error('brand surface packet must be an object');
    }

    if (!Number.isInteger(packet.revision) || packet.revision <= 0) {
        throw new Error('brand surface packet revision must be a positive integer');
    }

    if (!Array.isArray(packet.approvedDecisions)) {
        throw new Error('brand surface packet approvedDecisions must be an array');
    }

    if (!Array.isArray(packet.approvedAssets)) {
        throw new Error('brand surface packet approvedAssets must be an array');
    }

    packet.approvedDecisions.forEach((decision) => {
        if (!normalizeText(decision && decision.slotId)) {
            throw new Error('approved decision slotId is required');
        }
        if (!normalizeText(decision && decision.assetId)) {
            throw new Error(
                `approved decision for slot ${decision.slotId || '<unknown>'} requires assetId`
            );
        }
    });

    packet.approvedAssets.forEach((asset) => {
        if (!normalizeText(asset && asset.assetId)) {
            throw new Error('approved asset assetId is required');
        }
        if (asset.publicWebSafe !== true) {
            throw new Error(`asset ${asset.assetId || '<unknown>'} is not public-web-safe`);
        }
        if (asset.sourceType === 'real_case') {
            throw new Error(`asset ${asset.assetId || '<unknown>'} cannot be published from real_case`);
        }
    });
}

function upsertByKey(items, key, value) {
    const index = items.findIndex((item) => item && item[key] === value[key]);
    if (index >= 0) {
        items[index] = value;
        return;
    }
    items.push(value);
}

function copyIntoDirectory(rootDir, sourcePath, destinationRelativeDir) {
    const absoluteSource = resolveExistingPath(rootDir, sourcePath);
    if (!absoluteSource || !fs.existsSync(absoluteSource)) {
        return null;
    }
    const destinationDir = path.join(rootDir, destinationRelativeDir);
    fs.mkdirSync(destinationDir, { recursive: true });
    const destinationPath = path.join(destinationDir, path.basename(absoluteSource));
    if (path.resolve(absoluteSource) !== path.resolve(destinationPath)) {
        fs.copyFileSync(absoluteSource, destinationPath);
    }
    return path.relative(rootDir, destinationPath).replace(/\\/g, '/');
}

export function applyBrandSurfacePacket({
    rootDir = REPO_ROOT,
    inputPath,
    packet,
} = {}) {
    const safeRoot = path.resolve(rootDir);
    const payload = packet
        ? JSON.parse(JSON.stringify(packet))
        : readJson(resolveInputPath(safeRoot, inputPath));
    ensurePacket(payload);

    const manifestPath = path.join(
        safeRoot,
        'content',
        'public-v6',
        'assets-manifest.json'
    );
    const decisionsPath = path.join(
        safeRoot,
        'content',
        'public-v6',
        'image-decisions.json'
    );

    const manifest = readJson(manifestPath);
    const decisionsFile = readJson(decisionsPath);
    const assets = Array.isArray(manifest.assets) ? manifest.assets.slice() : [];
    const decisions = Array.isArray(decisionsFile.decisions)
        ? decisionsFile.decisions.slice()
        : [];

    payload.approvedAssets.forEach((asset) => {
        const manifestEntry =
            asset.manifestEntry && typeof asset.manifestEntry === 'object'
                ? { ...asset.manifestEntry }
                : {};
        ensureNoPrivateCaseRefs(manifestEntry, `approvedAssets.${asset.assetId}`);

        const copiedSourceMaster = copyIntoDirectory(
            safeRoot,
            asset.sourceMasterPath,
            path.join('images', 'src')
        );
        const copiedOptimized = Array.isArray(asset.optimizedFiles)
            ? asset.optimizedFiles
                  .map((filePath) =>
                      copyIntoDirectory(
                          safeRoot,
                          filePath,
                          path.join('images', 'optimized')
                      )
                  )
                  .filter(Boolean)
            : [];

        upsertByKey(assets, 'id', {
            ...manifestEntry,
            id: normalizeText(asset.assetId) || normalizeText(manifestEntry.id),
            sourceType: asset.sourceType,
            publicWebSafe: asset.publicWebSafe,
            generation:
                manifestEntry.generation && typeof manifestEntry.generation === 'object'
                    ? manifestEntry.generation
                    : {
                          strategy: 'brand_surface_sync',
                          source: 'src/apps/astro/scripts/sync-brand-surface-packet.mjs',
                          reviewState: 'approved',
                      },
            sync:
                copiedSourceMaster || copiedOptimized.length
                    ? {
                          sourceMasterPath: copiedSourceMaster,
                          optimizedFiles: copiedOptimized,
                      }
                    : undefined,
        });
    });

    const assetIds = new Set(
        assets
            .map((asset) => normalizeText(asset && asset.id))
            .filter(Boolean)
    );

    payload.approvedDecisions.forEach((decision) => {
        const assetId = normalizeText(decision.assetId);
        if (!assetIds.has(assetId)) {
            throw new Error(
                `approved decision for slot ${decision.slotId} references unknown asset ${assetId}`
            );
        }
        upsertByKey(decisions, 'slotId', {
            slotId: normalizeText(decision.slotId),
            assetId,
            altOverride:
                decision.altOverride &&
                typeof decision.altOverride === 'object' &&
                !Array.isArray(decision.altOverride)
                    ? decision.altOverride
                    : null,
            revision: payload.revision,
            approvedAt: normalizeText(decision.approvedAt) || normalizeText(payload.exportedAt),
            approvedBy: normalizeText(decision.approvedBy) || normalizeText(payload.exportedBy),
            sourceRecommendationId:
                normalizeText(decision.sourceRecommendationId) || null,
        });
    });

    const nextManifest = {
        ...manifest,
        updated_at: normalizeText(payload.exportedAt).slice(0, 10) || manifest.updated_at,
        assets,
    };
    const nextDecisions = {
        ...decisionsFile,
        updated_at:
            normalizeText(payload.exportedAt).slice(0, 10) ||
            decisionsFile.updated_at,
        revision: Math.max(Number(decisionsFile.revision) || 0, payload.revision),
        decisions,
    };

    writeJson(manifestPath, nextManifest);
    writeJson(decisionsPath, nextDecisions);

    return {
        ok: true,
        revision: payload.revision,
        decisionsUpdated: payload.approvedDecisions.length,
        assetsUpdated: payload.approvedAssets.length,
        manifestPath: path.relative(safeRoot, manifestPath).replace(/\\/g, '/'),
        decisionsPath: path.relative(safeRoot, decisionsPath).replace(/\\/g, '/'),
    };
}

function parseArgs(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--input') {
            options.inputPath = argv[index + 1];
            index += 1;
            continue;
        }
        if (token === '--root') {
            options.rootDir = argv[index + 1];
            index += 1;
        }
    }
    return options;
}

const isEntrypoint =
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
    try {
        const result = applyBrandSurfacePacket(parseArgs(process.argv.slice(2)));
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
        process.stderr.write(
            `${JSON.stringify(
                {
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                },
                null,
                2
            )}\n`
        );
        process.exit(1);
    }
}
