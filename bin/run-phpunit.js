#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');

const {
    resolvePhpBinary,
    firstNonEmptyLine,
} = require('./run-php-cs-fixer.js');

const root = resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const phpunitPath = resolve(root, 'vendor', 'bin', 'phpunit');

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

function probeCommand(command, commandArgs, options = {}) {
    const probe = spawnSync(command, commandArgs, {
        cwd: root,
        stdio: 'ignore',
        shell: false,
        ...options,
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

function hasOption(argv, names) {
    const wanted = new Set(names);
    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '');
        for (const name of wanted) {
            if (token === name || token.startsWith(`${name}=`)) {
                return true;
            }
        }
    }
    return false;
}

function buildComposerCandidates() {
    const winCandidates = isWin
        ? [
              process.env.COMPOSER_BIN || '',
              'composer',
              'composer.bat',
              'C:\\ProgramData\\ComposerSetup\\bin\\composer.bat',
              'C:\\Program Files\\Composer\\bin\\composer.bat',
          ]
        : [process.env.COMPOSER_BIN || '', 'composer'];

    return uniqueList(winCandidates);
}

function resolveComposerBinary() {
    const tried = [];
    for (const candidate of buildComposerCandidates()) {
        tried.push(candidate);
        if (
            candidate !== 'composer' &&
            candidate !== 'composer.bat' &&
            !existsSync(candidate)
        ) {
            continue;
        }
        if (
            probeCommand(candidate, ['--version'], {
                shell:
                    isWin &&
                    (candidate === 'composer' || /\.bat$/i.test(candidate)),
            })
        ) {
            return { ok: true, command: candidate, tried };
        }
    }
    return { ok: false, command: null, tried };
}

function readComposerAutoloadInitSignature(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }
    const raw = readFileSync(filePath, 'utf8');
    const match = raw.match(/ComposerAutoloaderInit[a-f0-9]+/i);
    return match ? match[0] : null;
}

function hasComposerAutoloadMismatch(
    autoloadPath = resolve(root, 'vendor', 'autoload.php'),
    autoloadRealPath = resolve(root, 'vendor', 'composer', 'autoload_real.php')
) {
    const autoloadInit = readComposerAutoloadInitSignature(autoloadPath);
    const autoloadRealInit =
        readComposerAutoloadInitSignature(autoloadRealPath);
    return Boolean(
        autoloadInit && autoloadRealInit && autoloadInit !== autoloadRealInit
    );
}

function isComposerAutoloadBootstrapError(output) {
    const text = String(output || '');
    return (
        text.includes('ComposerAutoloaderInit') &&
        (text.includes('vendor\\autoload.php') ||
            text.includes('vendor/autoload.php'))
    );
}

function buildPhpunitArgs(argv) {
    const args = Array.isArray(argv) ? argv.slice() : [];
    if (
        hasOption(args, [
            '--no-coverage',
            '--coverage-clover',
            '--coverage-cobertura',
            '--coverage-crap4j',
            '--coverage-html',
            '--coverage-php',
            '--coverage-text',
            '--coverage-xml',
            '--warm-coverage-cache',
        ])
    ) {
        return args;
    }

    return ['--no-coverage', ...args];
}

function probePhpunitBootstrap(phpCommand) {
    const probe = spawnSync(phpCommand, [phpunitPath, '--version'], {
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
            repairable: true,
            reason: 'composer_autoload_bootstrap_error',
            output: combined.trim(),
        };
    }
    return {
        ok: false,
        repairable: false,
        reason: 'probe_failed',
        status: probe.status,
        output: combined.trim(),
    };
}

function repairComposerAutoload(composerCommand) {
    return spawnSync(
        composerCommand,
        ['dump-autoload', '--no-scripts', '--no-interaction'],
        {
            cwd: root,
            stdio: 'inherit',
            shell:
                isWin &&
                (composerCommand === 'composer' ||
                    /\.bat$/i.test(String(composerCommand || ''))),
        }
    );
}

function main(argv = process.argv.slice(2)) {
    const rawArgs = Array.isArray(argv) ? argv : [];
    const args = buildPhpunitArgs(rawArgs);
    if (args.length === 0) {
        fail('Uso: node bin/run-phpunit.js <phpunit args...>');
    }

    if (!existsSync(phpunitPath)) {
        fail('No existe vendor/bin/phpunit. Ejecuta `composer install`.');
    }

    const phpRuntime = resolvePhpBinary();
    if (!phpRuntime.ok || !phpRuntime.command) {
        const tried =
            phpRuntime.tried.length > 0 ? phpRuntime.tried.join(', ') : 'php';
        fail(
            `PHP no esta disponible. Configura PATH o define PHP_BIN. Candidatos probados: ${tried}`
        );
    }

    let phpunitBootstrap = probePhpunitBootstrap(phpRuntime.command);
    if (!phpunitBootstrap.ok && phpunitBootstrap.repairable) {
        const composerRuntime = resolveComposerBinary();
        if (!composerRuntime.ok || !composerRuntime.command) {
            const tried =
                composerRuntime.tried.length > 0
                    ? composerRuntime.tried.join(', ')
                    : 'composer';
            fail(
                `Composer no esta disponible para reparar autoload. Candidatos probados: ${tried}`
            );
        }

        const mismatchDetected = hasComposerAutoloadMismatch();
        console.warn(
            `WARN: PHPUnit detecto drift de Composer autoload${mismatchDetected ? ' (autoload.php != autoload_real.php)' : ''}; ejecutando composer dump-autoload.`
        );
        const repair = repairComposerAutoload(composerRuntime.command);
        if (repair.error || repair.status !== 0) {
            fail(
                `No se pudo reparar el autoload de Composer con dump-autoload (status=${repair.status ?? 'null'}).`
            );
        }

        phpunitBootstrap = probePhpunitBootstrap(phpRuntime.command);
    }

    if (!phpunitBootstrap.ok) {
        const detail = firstNonEmptyLine(phpunitBootstrap.output);
        fail(
            `PHPUnit no arranca (${phpunitBootstrap.reason || 'unknown'}). ${detail || ''}`.trim()
        );
    }

    const result = spawnSync(phpRuntime.command, [phpunitPath, ...args], {
        cwd: root,
        stdio: 'inherit',
        shell: false,
    });

    if (result.error) {
        fail(`No se pudo ejecutar PHPUnit: ${result.error.message}`);
    }

    process.exit(result.status === null ? 1 : result.status);
}

if (require.main === module) {
    main();
}

module.exports = {
    buildComposerCandidates,
    buildPhpunitArgs,
    hasOption,
    resolveComposerBinary,
    readComposerAutoloadInitSignature,
    hasComposerAutoloadMismatch,
    isComposerAutoloadBootstrapError,
    probePhpunitBootstrap,
    main,
};
