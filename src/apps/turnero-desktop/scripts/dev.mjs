import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function failMissingDependency(packageName) {
    console.error(
        `[turnero-desktop] Falta instalar \`${packageName}\`. Ejecuta \`npm --prefix src/apps/turnero-desktop install\` antes de abrir el shell.`
    );
    process.exit(1);
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

const args = parseArgs(process.argv.slice(2));
const surface = String(args.surface || 'operator');
let electronBinary;

try {
    electronBinary = require('electron');
} catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
        failMissingDependency('electron');
    }
    throw error;
}

const child = spawn(electronBinary, ['.'], {
    cwd: projectDir,
    stdio: 'inherit',
    env: {
        ...process.env,
        TURNERO_DESKTOP_SURFACE: surface,
        TURNERO_BASE_URL: args.baseUrl || process.env.TURNERO_BASE_URL || '',
        TURNERO_LAUNCH_MODE:
            args.launchMode || process.env.TURNERO_LAUNCH_MODE || '',
        TURNERO_AUTO_START:
            args.autoStart || process.env.TURNERO_AUTO_START || '',
        TURNERO_UPDATE_BASE_URL:
            args.updateBaseUrl || process.env.TURNERO_UPDATE_BASE_URL || '',
    },
});

child.on('exit', (code) => {
    process.exit(code || 0);
});
