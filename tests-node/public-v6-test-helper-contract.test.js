const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const testsDir = path.join(repoRoot, 'tests');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('public V6 specs import the V6 helper instead of the legacy public-v3 helper', () => {
    const v6Specs = fs
        .readdirSync(testsDir)
        .filter((entry) => /^public-v6-.*\.spec\.js$/u.test(entry))
        .sort();

    assert.ok(v6Specs.length > 0, 'expected at least one public-v6 spec');

    for (const entry of v6Specs) {
        const content = read(path.join('tests', entry));
        assert.match(
            content,
            /require\('\.\/helpers\/public-v6'\)/u,
            `${entry} must import ./helpers/public-v6`
        );
        assert.doesNotMatch(
            content,
            /require\('\.\/helpers\/public-v3'\)/u,
            `${entry} must not import ./helpers/public-v3`
        );
    }
});

test('public V6 helper exposes booking status wiring and keeps V3 helper as a legacy wrapper', () => {
    const v6Helper = read(path.join('tests', 'helpers', 'public-v6.js'));
    const legacyHelper = read(path.join('tests', 'helpers', 'public-v3.js'));

    assert.match(
        v6Helper,
        /\[data-v6-booking-status\]/u,
        'public-v6 helper must target the V6 booking status surface'
    );
    assert.match(
        legacyHelper,
        /require\('\.\/public-v6'\)/u,
        'public-v3 helper should delegate shared routines to public-v6'
    );
});
