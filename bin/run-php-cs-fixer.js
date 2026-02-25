#!/usr/bin/env node
'use strict';

const { existsSync, readdirSync } = require('fs');
const { resolve, join } = require('path');
const { homedir } = require('os');
const { spawnSync } = require('child_process');

const root = resolve(__dirname, '..');
const isWin = process.platform === 'win32';
function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

function run(command, commandArgs, options = {}) {
    return spawnSync(command, commandArgs, {
        cwd: root,
        stdio: 'inherit',
        ...options,
    });
}

function probePhp(command) {
    const probe = spawnSync(command, ['-v'], {
        cwd: root,
        stdio: 'ignore',
        shell: false,
    });
    return !probe.error && probe.status === 0;
}

function uniqueList(values) {
    const seen = new Set();
    const out = [];
    for (const raw of values) {
        const value = String(raw || '').trim();
        if (!value) continue;
        const key = isWin ? value.toLowerCase() : value;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
    }
    return out;
}

function listLaragonPhpCandidates() {
    if (!isWin) return [];
    const base = 'C:\\laragon\\bin\\php';
    if (!existsSync(base)) return [];

    const candidates = [];
    try {
        for (const entry of readdirSync(base, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const phpExe = join(base, entry.name, 'php.exe');
            if (existsSync(phpExe)) {
                candidates.push(phpExe);
            }
        }
    } catch {
        return [];
    }
    // Prefer lexicographically latest first (often newest version).
    return candidates.sort((a, b) => b.localeCompare(a));
}

function buildPhpCandidates() {
    const home = homedir();
    const winCandidates = isWin
        ? [
              process.env.PHP_BIN || '',
              'php',
              'C:\\xampp\\php\\php.exe',
              'C:\\php\\php.exe',
              'C:\\tools\\php\\php.exe',
              'C:\\Program Files\\PHP\\php.exe',
              'C:\\Program Files\\php\\php.exe',
              'C:\\ProgramData\\chocolatey\\bin\\php.exe',
              home
                  ? join(home, 'scoop', 'apps', 'php', 'current', 'php.exe')
                  : '',
              home
                  ? join(home, 'AppData', 'Local', 'Programs', 'PHP', 'php.exe')
                  : '',
              ...listLaragonPhpCandidates(),
          ]
        : [process.env.PHP_BIN || '', 'php'];

    return uniqueList(winCandidates);
}

function resolvePhpBinary() {
    const tried = [];
    for (const candidate of buildPhpCandidates()) {
        tried.push(candidate);
        if (candidate !== 'php' && !existsSync(candidate)) {
            continue;
        }
        if (probePhp(candidate)) {
            return { ok: true, command: candidate, tried };
        }
    }
    return { ok: false, command: null, tried };
}

function hasOption(argv, names) {
    const wanted = new Set(names);
    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || '');
        for (const name of wanted) {
            if (token === name || token.startsWith(`${name}=`)) {
                return true;
            }
        }
    }
    return false;
}

function findPhpCsFixerConfig() {
    const candidates = ['.php-cs-fixer.php', '.php-cs-fixer.dist.php'];
    for (const file of candidates) {
        const full = resolve(root, file);
        if (existsSync(full)) {
            return file;
        }
    }
    return null;
}

function buildPhpCsFixerArgs(argv) {
    if (String(argv[0] || '').trim() !== 'fix') {
        return argv.slice();
    }

    const out = [argv[0]];
    const rest = argv.slice(1);

    if (!hasOption(rest, ['--config', '-c'])) {
        const configFile = findPhpCsFixerConfig();
        if (configFile) {
            out.push(`--config=${configFile}`);
        }
    }

    if (!hasOption(rest, ['--path-mode'])) {
        out.push('--path-mode=intersection');
    }

    return [...out, ...rest];
}

const fixerPath = resolve(root, 'vendor', 'bin', 'php-cs-fixer');
function isComposerAutoloadBootstrapError(output) {
    const text = String(output || '');
    return (
        text.includes('ComposerAutoloaderInit') &&
        text.includes('vendor\\autoload.php')
    );
}

function probePhpCsFixerBootstrap(phpCommand) {
    const probe = spawnSync(phpCommand, [fixerPath, '--version'], {
        cwd: root,
        encoding: 'utf8',
        shell: false,
    });

    const combined = `${probe.stdout || ''}\n${probe.stderr || ''}`;
    if (!probe.error && probe.status === 0) {
        return { ok: true };
    }
    if (isComposerAutoloadBootstrapError(combined)) {
        return {
            ok: false,
            skipLocal: true,
            reason: 'composer_autoload_bootstrap_error',
            output: combined.trim(),
        };
    }
    return {
        ok: false,
        skipLocal: false,
        reason: 'probe_failed',
        status: probe.status,
        output: combined.trim(),
    };
}

function firstNonEmptyLine(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
}

function main(argv = process.argv.slice(2)) {
    const args = Array.isArray(argv) ? argv : [];
    if (args.length === 0) {
        fail('Uso: node bin/run-php-cs-fixer.js <args...>');
    }

    if (!existsSync(fixerPath)) {
        fail('No existe vendor/bin/php-cs-fixer. Ejecuta `composer install`.');
    }

    const phpRuntime = resolvePhpBinary();
    if (!phpRuntime.ok || !phpRuntime.command) {
        const tried =
            phpRuntime.tried.length > 0 ? phpRuntime.tried.join(', ') : 'php';
        fail(
            `PHP no esta disponible. Configura PATH o define PHP_BIN (ej: setx PHP_BIN "C:\\\\ruta\\\\php.exe"). Candidatos probados: ${tried}`
        );
    }

    const fixerBootstrap = probePhpCsFixerBootstrap(phpRuntime.command);
    if (!fixerBootstrap.ok) {
        if (fixerBootstrap.skipLocal && process.env.CI !== 'true') {
            console.warn(
                'WARN: php-cs-fixer no disponible por autoload de Composer inconsistente; se omite en hook local.'
            );
            const detail = firstNonEmptyLine(fixerBootstrap.output);
            if (detail) {
                console.warn(detail);
            }
            process.exit(0);
        }
        fail(
            `php-cs-fixer no arranca (${fixerBootstrap.reason || 'unknown'}). ${fixerBootstrap.output || ''}`.trim()
        );
    }

    const fixerArgs = buildPhpCsFixerArgs(args);
    const result = run(phpRuntime.command, [fixerPath, ...fixerArgs]);
    if (result.error) {
        fail(`no se pudo ejecutar php-cs-fixer: ${result.error.message}`);
    }

    process.exit(result.status === null ? 1 : result.status);
}

if (require.main === module) {
    main();
}

module.exports = {
    buildPhpCsFixerArgs,
    hasOption,
    findPhpCsFixerConfig,
    resolvePhpBinary,
    probePhpCsFixerBootstrap,
    isComposerAutoloadBootstrapError,
    firstNonEmptyLine,
    main,
};
