#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const REPO_ROOT = resolve(__dirname, '..');

function readRepoFile(relativePath) {
    return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

test('gitignore incluye caches locales de PHP y cobertura', () => {
    const raw = readRepoFile('.gitignore');
    const requiredEntries = [
        '.php-cs-fixer.cache',
        '.phpunit.cache/',
        'coverage.xml',
    ];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `falta entry en .gitignore: ${entry}`
        );
    }
});

test('prettierignore excluye colas derivadas de agentes', () => {
    const raw = readRepoFile('.prettierignore');
    const requiredEntries = ['JULES_TASKS.md', 'KIMI_TASKS.md'];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `falta entry en .prettierignore: ${entry}`
        );
    }
});
