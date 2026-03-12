import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createBuildConfig,
    buildUpdateFeedUrl,
    getSurfaceMeta,
} from '../src/config/contracts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');

function failMissingDependency(packageName) {
    console.error(
        `[turnero-desktop] Falta instalar \`${packageName}\`. Ejecuta \`npm --prefix src/apps/turnero-desktop install\` antes de empaquetar el instalador de Windows.`
    );
    process.exit(1);
}

async function loadElectronBuilder() {
    try {
        return await import('electron-builder');
    } catch (error) {
        if (error && error.code === 'ERR_MODULE_NOT_FOUND') {
            failMissingDependency('electron-builder');
        }
        throw error;
    }
}

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

function resolveTargets(platform) {
    if (platform === 'mac') {
        return Platform.MAC.createTarget(['dmg', 'zip'], Arch.universal);
    }
    if (platform === 'all') {
        return [
            Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
            Platform.MAC.createTarget(['dmg', 'zip'], Arch.universal),
        ];
    }
    return Platform.WINDOWS.createTarget(['nsis'], Arch.x64);
}

function createBuilderConfig(surface, platform, config) {
    const meta = getSurfaceMeta(surface);
    const updatePlatform = platform === 'mac' ? 'darwin' : 'win32';
    return {
        appId: meta.appId,
        productName: meta.productName,
        executableName: meta.executableName,
        asar: true,
        directories: {
            output: path.join(projectDir, 'dist', surface, platform),
            buildResources: path.join(projectDir, 'src', 'renderer'),
        },
        files: ['src/**/*', 'package.json', 'README.md'],
        extraMetadata: {
            version: config.releaseVersion,
            turneroDesktop: config,
        },
        win: {
            target: [{ target: 'nsis', arch: ['x64'] }],
            artifactName: `${meta.artifactBase}Setup.\${ext}`,
            signAndEditExecutable: false,
            verifyUpdateCodeSignature: false,
        },
        nsis: {
            oneClick: false,
            perMachine: false,
            allowToChangeInstallationDirectory: true,
            shortcutName: meta.productName,
            uninstallDisplayName: meta.productName,
        },
        mac: {
            target: [
                { target: 'dmg', arch: ['universal'] },
                { target: 'zip', arch: ['universal'] },
            ],
            artifactName: `${meta.artifactBase}.\${ext}`,
            category: 'public.app-category.medical',
        },
        publish: [
            {
                provider: 'generic',
                url: buildUpdateFeedUrl(config, updatePlatform),
                channel: config.updateChannel,
            },
        ],
    };
}

const { build, Platform, Arch } = await loadElectronBuilder();
const args = parseArgs(process.argv.slice(2));
const surface = String(args.surface || 'operator');
const platform = String(args.platform || 'win');
const buildConfig = createBuildConfig({
    surface,
    baseUrl: args.baseUrl || process.env.TURNERO_BASE_URL,
    launchMode: args.launchMode || process.env.TURNERO_LAUNCH_MODE,
    autoStart:
        args.autoStart !== undefined
            ? args.autoStart
            : process.env.TURNERO_AUTO_START,
    updateBaseUrl: args.updateBaseUrl || process.env.TURNERO_UPDATE_BASE_URL,
});
buildConfig.releaseVersion = String(
    args.version || process.env.TURNERO_RELEASE_VERSION || '0.1.0'
).trim();

await build({
    targets: resolveTargets(platform),
    config: createBuilderConfig(buildConfig.surface, platform, buildConfig),
    publish: 'never',
});
