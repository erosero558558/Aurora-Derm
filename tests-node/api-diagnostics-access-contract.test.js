#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');

function readRepoFile(...segments) {
    return readFileSync(resolve(REPO_ROOT, ...segments), 'utf8');
}

test('ApiConfig separa endpoints publicos de diagnostics sensibles', () => {
    const raw = readRepoFile('lib', 'ApiConfig.php');

    for (const snippet of [
        'public static function getPublicEndpoints(): array',
        'public static function getDiagnosticsEndpoints(): array',
        "['method' => 'GET', 'resource' => 'metrics']",
        "['method' => 'GET', 'resource' => 'health-diagnostics']",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `ApiConfig.php debe incluir ${snippet}`
        );
    }

    const publicBlock = raw.split(
        'public static function getDiagnosticsEndpoints(): array'
    )[0];
    assert.equal(
        publicBlock.includes("['method' => 'GET', 'resource' => 'metrics']"),
        false,
        'metrics no debe seguir en la allowlist publica'
    );
    assert.equal(
        publicBlock.includes(
            "['method' => 'GET', 'resource' => 'health-diagnostics']"
        ),
        false,
        'health-diagnostics no debe seguir en la allowlist publica'
    );
});

test('ApiKernel autoriza carril diagnostics antes del gate admin y audita scope dedicado', () => {
    const raw = readRepoFile('lib', 'ApiKernel.php');

    for (const snippet of [
        '$diagnosticsEndpoints = ApiConfig::getDiagnosticsEndpoints();',
        '$isDiagnostics = false;',
        '$diagnosticsAuthorized = false;',
        'diagnostics_request_authorized([',
        "'reason' => 'diagnostics_required'",
        "'scope' => $isAdmin",
        "? 'admin'",
        "? 'queue_operator'",
        ": ($diagnosticsAuthorized ? 'diagnostics' : 'public')",
        "'diagnosticsAuthorized' => $diagnosticsAuthorized,",
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `ApiKernel.php debe incluir ${snippet}`
        );
    }
});
