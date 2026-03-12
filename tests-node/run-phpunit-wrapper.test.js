#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    buildPhpunitArgs,
    readComposerAutoloadInitSignature,
    hasComposerAutoloadMismatch,
    isComposerAutoloadBootstrapError,
} = require('../bin/run-phpunit.js');

function writeFixture(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

test('run-phpunit extrae la firma ComposerAutoloaderInit desde vendor autoloads', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phpunit-wrapper-'));
    const autoloadPath = path.join(tempRoot, 'vendor', 'autoload.php');
    const autoloadRealPath = path.join(
        tempRoot,
        'vendor',
        'composer',
        'autoload_real.php'
    );

    writeFixture(
        autoloadPath,
        '<?php return ComposerAutoloaderInitABC123::getLoader();\n'
    );
    writeFixture(
        autoloadRealPath,
        '<?php class ComposerAutoloaderInitDEF456 {}\n'
    );

    assert.equal(
        readComposerAutoloadInitSignature(autoloadPath),
        'ComposerAutoloaderInitABC123'
    );
    assert.equal(
        readComposerAutoloadInitSignature(autoloadRealPath),
        'ComposerAutoloaderInitDEF456'
    );
});

test('run-phpunit detecta drift entre vendor/autoload.php y autoload_real.php', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phpunit-drift-'));
    const autoloadPath = path.join(tempRoot, 'vendor', 'autoload.php');
    const autoloadRealPath = path.join(
        tempRoot,
        'vendor',
        'composer',
        'autoload_real.php'
    );

    writeFixture(
        autoloadPath,
        '<?php return ComposerAutoloaderInitAAA111::getLoader();\n'
    );
    writeFixture(
        autoloadRealPath,
        '<?php class ComposerAutoloaderInitBBB222 {}\n'
    );

    assert.equal(
        hasComposerAutoloadMismatch(autoloadPath, autoloadRealPath),
        true
    );

    writeFixture(
        autoloadRealPath,
        '<?php class ComposerAutoloaderInitAAA111 {}\n'
    );

    assert.equal(
        hasComposerAutoloadMismatch(autoloadPath, autoloadRealPath),
        false
    );
});

test('run-phpunit reconoce fatal de bootstrap Composer en salida de PHPUnit', () => {
    assert.equal(
        isComposerAutoloadBootstrapError(
            'Fatal error: Class "ComposerAutoloaderInit123" not found in C:\\repo\\vendor\\autoload.php:22'
        ),
        true
    );
    assert.equal(
        isComposerAutoloadBootstrapError(
            'PHPUnit 10.5.0 by Sebastian Bergmann.'
        ),
        false
    );
});

test('run-phpunit inyecta --no-coverage cuando la corrida no pide reportes', () => {
    const args = buildPhpunitArgs([
        'tests/Integration/AdminDataAppDownloadsContractTest.php',
    ]);

    assert.equal(args[0], '--no-coverage');
    assert.equal(
        args.includes(
            'tests/Integration/AdminDataAppDownloadsContractTest.php'
        ),
        true
    );
});

test('run-phpunit no duplica flags de coverage cuando ya vienen definidos', () => {
    const args = buildPhpunitArgs([
        '--coverage-text=php://stdout',
        'tests/Integration/AdminDataAppDownloadsContractTest.php',
    ]);

    assert.equal(args[0], '--coverage-text=php://stdout');
    assert.equal(args.includes('--no-coverage'), false);
});
