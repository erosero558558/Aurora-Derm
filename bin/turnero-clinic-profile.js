#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
    getActiveTurneroClinicProfileStatus,
    getTurneroActiveClinicProfilePath,
    getTurneroClinicProfilesDir,
    getTurneroClinicProfileEntry,
    listTurneroClinicProfiles,
    stageTurneroClinicProfile,
} = require('../lib/turnero-clinic-profile-registry.js');

function parseArgs(argv) {
    const positional = [];
    const options = {};

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            positional.push(token);
            continue;
        }

        const key = token.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            options[key] = true;
            continue;
        }
        options[key] = next;
        index += 1;
    }

    return {
        command: positional[0] || 'help',
        options,
    };
}

function printHelp() {
    console.log(`Uso:
  node bin/turnero-clinic-profile.js list [--json]
  node bin/turnero-clinic-profile.js validate --id <clinic_id> [--json]
  node bin/turnero-clinic-profile.js stage --id <clinic_id> [--dry-run] [--json]
  node bin/turnero-clinic-profile.js status [--json]

Opciones:
  --profiles-dir <path>  Directorio de perfiles catalogados
  --output <path>        Ruta del clinic-profile activo
  --root <path>          Root alterno del proyecto
  --json                 Salida JSON`);
}

function printResult(result, asJson) {
    if (asJson) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    if (Array.isArray(result.items)) {
        for (const item of result.items) {
            const status = item.ok ? 'OK' : 'ERROR';
            console.log(`${status} ${item.id} -> ${item.filePath}`);
            if (item.warnings?.length) {
                for (const warning of item.warnings) {
                    console.log(`  warn: ${warning}`);
                }
            }
            if (item.errors?.length) {
                for (const error of item.errors) {
                    console.log(`  error: ${error}`);
                }
            }
        }
        return;
    }

    if (result.command === 'status') {
        console.log(`Activo: ${result.activePath}`);
        console.log(`Clinic ID: ${result.profile?.clinic_id || 'sin perfil'}`);
        console.log(
            `Catalogo: ${result.matchingProfileId || 'sin coincidencia'}${result.matchesCatalog ? ' (exacto)' : ''}`
        );
        for (const warning of result.warnings || []) {
            console.log(`warn: ${warning}`);
        }
        for (const error of result.errors || []) {
            console.log(`error: ${error}`);
        }
        return;
    }

    if (result.command === 'stage') {
        console.log(
            `${result.dryRun ? 'Preview' : 'Stage'} ${result.id} -> ${result.outputPath}`
        );
        for (const warning of result.warnings || []) {
            console.log(`warn: ${warning}`);
        }
        return;
    }

    if (result.command === 'validate') {
        console.log(
            `${result.ok ? 'OK' : 'ERROR'} ${result.id} -> ${result.filePath}`
        );
        for (const warning of result.warnings || []) {
            console.log(`warn: ${warning}`);
        }
        for (const error of result.errors || []) {
            console.log(`error: ${error}`);
        }
    }
}

function resolveCommonOptions(options) {
    return {
        root: options.root ? path.resolve(options.root) : undefined,
        profilesDir: options['profiles-dir']
            ? path.resolve(options['profiles-dir'])
            : undefined,
        outputPath: options.output ? path.resolve(options.output) : undefined,
    };
}

function main() {
    const { command, options } = parseArgs(process.argv.slice(2));
    const asJson = Boolean(options.json);
    const commonOptions = resolveCommonOptions(options);

    if (command === 'help' || command === '--help' || command === '-h') {
        printHelp();
        return;
    }

    if (command === 'list') {
        const items = listTurneroClinicProfiles(commonOptions).map((entry) => ({
            id: entry.id,
            filePath: entry.filePath,
            ok: entry.ok,
            warnings: entry.warnings,
            errors: entry.errors,
            clinicId: entry.profile.clinic_id,
            releaseMode: entry.profile.release.mode,
        }));
        printResult(
            {
                command,
                profilesDir:
                    commonOptions.profilesDir ||
                    getTurneroClinicProfilesDir(commonOptions.root),
                items,
            },
            asJson
        );
        return;
    }

    if (command === 'validate') {
        const entry = getTurneroClinicProfileEntry(options.id, commonOptions);
        printResult(
            {
                command,
                id: entry.id,
                filePath: entry.filePath,
                ok: entry.ok,
                warnings: entry.warnings,
                errors: entry.errors,
                profile: entry.profile,
            },
            asJson
        );
        process.exitCode = entry.ok ? 0 : 1;
        return;
    }

    if (command === 'stage') {
        const result = stageTurneroClinicProfile(options.id, {
            ...commonOptions,
            dryRun: Boolean(options['dry-run']),
        });
        printResult(
            {
                command,
                ...result,
            },
            asJson
        );
        return;
    }

    if (command === 'status') {
        const result = getActiveTurneroClinicProfileStatus(commonOptions);
        printResult(
            {
                command,
                ...result,
            },
            asJson
        );
        process.exitCode = result.ok ? 0 : 1;
        return;
    }

    printHelp();
    process.exitCode = 1;
}

main();
