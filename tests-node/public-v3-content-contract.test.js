#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    validatePublicV3Content,
} = require('../bin/lib/public-v3-content-validator.js');

const SOURCE_PUBLIC_V3_DIR = path.resolve(
    __dirname,
    '..',
    'content',
    'public-v3'
);

function createFixture() {
    const sandboxDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'public-v3-content-contract-')
    );
    const repoRoot = path.join(sandboxDir, 'repo');
    const contentRoot = path.join(repoRoot, 'content');
    const fixturePublicV3Dir = path.join(contentRoot, 'public-v3');

    fs.mkdirSync(contentRoot, { recursive: true });
    fs.cpSync(SOURCE_PUBLIC_V3_DIR, fixturePublicV3Dir, { recursive: true });

    return {
        sandboxDir,
        repoRoot,
        fixturePublicV3Dir,
    };
}

test('public-v3 content contract passes with current repository fixtures', () => {
    const result = validatePublicV3Content({
        repoRoot: path.resolve(__dirname, '..'),
    });

    assert.equal(
        result.ok,
        true,
        `Expected current fixtures to validate, got errors:\n${result.errors.join('\n')}`
    );
    assert.equal(result.requestedSchemaVersion, 'v2');
    assert.equal(result.fallbackSchemaVersion, 'v2');
    assert.equal(result.fallbackUsed, false);
});

test('public-v3 content contract fails when a required schema key is removed', () => {
    const fixture = createFixture();
    try {
        const navigationPath = path.join(
            fixture.fixturePublicV3Dir,
            'es',
            'navigation.json'
        );
        const navigation = JSON.parse(fs.readFileSync(navigationPath, 'utf8'));
        delete navigation.labels.book;
        fs.writeFileSync(
            navigationPath,
            JSON.stringify(navigation, null, 2) + '\n',
            'utf8'
        );

        const result = validatePublicV3Content({ repoRoot: fixture.repoRoot });
        assert.equal(result.ok, false, 'Expected schema validation to fail');
        assert.equal(
            result.errors.some((message) =>
                message.includes(
                    'content/public-v3/es.navigation.labels is missing "book".'
                )
            ),
            true,
            `Expected missing "book" error, got:\n${result.errors.join('\n')}`
        );
    } finally {
        fs.rmSync(fixture.sandboxDir, { recursive: true, force: true });
    }
});

test('public-v3 content contract fails when legal pageOrder drifts from legal pages', () => {
    const fixture = createFixture();
    try {
        const legalPath = path.join(
            fixture.fixturePublicV3Dir,
            'es',
            'legal.json'
        );
        const legal = JSON.parse(fs.readFileSync(legalPath, 'utf8'));
        const removedSlug = String(legal.pageOrder[0] || '');
        legal.pageOrder = legal.pageOrder.slice(1);
        fs.writeFileSync(
            legalPath,
            JSON.stringify(legal, null, 2) + '\n',
            'utf8'
        );

        const result = validatePublicV3Content({ repoRoot: fixture.repoRoot });
        assert.equal(
            result.ok,
            false,
            'Expected legal pageOrder drift to fail'
        );
        assert.equal(
            result.errors.some((message) =>
                message.includes(
                    `content/public-v3/es.legal.pages.${removedSlug} is not declared in pageOrder.`
                )
            ),
            true,
            `Expected legal pageOrder drift error, got:\n${result.errors.join('\n')}`
        );
    } finally {
        fs.rmSync(fixture.sandboxDir, { recursive: true, force: true });
    }
});

test('public-v3 content contract uses fallback schemas when active version is partial', () => {
    const fixture = createFixture();
    try {
        const removedSchemaPath = path.join(
            fixture.fixturePublicV3Dir,
            'schemas',
            'v2',
            'hub.schema.json'
        );
        fs.rmSync(removedSchemaPath, { force: true });

        const versionConfigPath = path.join(
            fixture.fixturePublicV3Dir,
            'schema-version.json'
        );
        fs.writeFileSync(
            versionConfigPath,
            JSON.stringify(
                {
                    active: 'v2',
                    fallback: 'v1',
                    allowFallback: true,
                },
                null,
                2
            ) + '\n',
            'utf8'
        );

        const result = validatePublicV3Content({ repoRoot: fixture.repoRoot });
        assert.equal(
            result.ok,
            true,
            `Expected fallback validation to pass, got:\n${result.errors.join('\n')}`
        );
        assert.equal(result.requestedSchemaVersion, 'v2');
        assert.equal(result.fallbackUsed, true);
        assert.equal(result.fallbackHits.length > 0, true);
    } finally {
        fs.rmSync(fixture.sandboxDir, { recursive: true, force: true });
    }
});

test('public-v3 content contract fails when fallback is disabled on partial schema version', () => {
    const fixture = createFixture();
    try {
        const removedSchemaPath = path.join(
            fixture.fixturePublicV3Dir,
            'schemas',
            'v2',
            'hub.schema.json'
        );
        fs.rmSync(removedSchemaPath, { force: true });

        const result = validatePublicV3Content({
            repoRoot: fixture.repoRoot,
            schemaVersion: 'v2',
            fallbackVersion: 'v1',
            allowFallback: false,
        });
        assert.equal(
            result.ok,
            false,
            'Expected validation to fail without fallback'
        );
        assert.equal(
            result.errors.some((message) =>
                message.includes(
                    'Missing schema file for "hub" in version "v2".'
                )
            ),
            true,
            `Expected missing schema v2 error, got:\n${result.errors.join('\n')}`
        );
    } finally {
        fs.rmSync(fixture.sandboxDir, { recursive: true, force: true });
    }
});
