#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const FORBIDDEN_CLAIMS = [
    /garantizad[oa]s?/giu,
    /\b100\s*%\b/giu,
    /cura\s+definitiva/giu,
    /sin\s+riesgos?/giu,
    /\bguaranteed\b/giu,
    /definitive\s+cure/giu,
    /risk[-\s]?free/giu,
];

const SPANISH_TUTEO = [
    /\btu\b/giu,
    /\btus\b/giu,
    /\bcontigo\b/giu,
    /\bpuedes\b/giu,
    /\belige\b/giu,
    /\bhaz\b/giu,
    /agenda\s+tu/giu,
    /\bdependas\b/giu,
];

const TECHNICAL_COPY = /\b(bridge|runtime|shell|v3|v4)\b/giu;

function readJson(relativePath) {
    return JSON.parse(
        fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
    );
}

function collectStrings(payload, out = []) {
    if (Array.isArray(payload)) {
        payload.forEach((item) => collectStrings(item, out));
        return out;
    }
    if (!payload || typeof payload !== 'object') {
        if (typeof payload === 'string') out.push(payload);
        return out;
    }
    Object.values(payload).forEach((value) => collectStrings(value, out));
    return out;
}

function extractDictKeys() {
    const roots = [
        path.join(repoRoot, 'src/apps/astro/src/components/public-v5'),
        path.join(repoRoot, 'src/apps/astro/src/pages/es'),
        path.join(repoRoot, 'src/apps/astro/src/pages/en'),
    ];
    const keys = new Set();
    const re = /\bdict\.([a-zA-Z0-9_]+)/g;

    for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        const stack = [root];
        while (stack.length > 0) {
            const current = stack.pop();
            const entries = fs.readdirSync(current, { withFileTypes: true });
            for (const entry of entries) {
                const target = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(target);
                    continue;
                }
                if (
                    !entry.isFile() ||
                    !/\.(astro|js|ts|mjs|cjs)$/u.test(entry.name)
                ) {
                    continue;
                }
                const text = fs.readFileSync(target, 'utf8');
                let match;
                while ((match = re.exec(text))) {
                    keys.add(match[1]);
                }
            }
        }
    }

    return Array.from(keys).sort();
}

function hasMatch(strings, pattern) {
    return pattern.test(strings.join(' \n '));
}

const copyFiles = [
    'content/public-v3/es/home.json',
    'content/public-v3/es/hub.json',
    'content/public-v3/es/service.json',
    'content/public-v3/es/telemedicine.json',
    'content/public-v3/es/navigation.json',
    'content/public-v3/es/legal.json',
    'content/public-v3/es/legal/terminos.json',
    'content/public-v3/es/legal/privacidad.json',
    'content/public-v3/es/legal/cookies.json',
    'content/public-v3/es/legal/aviso-medico.json',
    'content/public-v3/en/home.json',
    'content/public-v3/en/hub.json',
    'content/public-v3/en/service.json',
    'content/public-v3/en/telemedicine.json',
    'content/public-v3/en/navigation.json',
    'content/public-v3/en/legal.json',
    'content/public-v3/en/legal/terms.json',
    'content/public-v3/en/legal/privacy.json',
    'content/public-v3/en/legal/cookies.json',
    'content/public-v3/en/legal/medical-disclaimer.json',
    'content/public-v5/navigation.json',
    'content/public-v5/catalog.json',
    'content/es.json',
    'content/en.json',
];

const ustedFiles = [
    'content/public-v3/es/home.json',
    'content/public-v3/es/hub.json',
    'content/public-v3/es/service.json',
    'content/public-v3/es/telemedicine.json',
    'content/es.json',
];

test('public-v5 copy contract: no forbidden claims or technical tokens in source content', () => {
    for (const file of copyFiles) {
        const strings = collectStrings(readJson(file));
        for (const pattern of FORBIDDEN_CLAIMS) {
            assert.equal(
                hasMatch(strings, pattern),
                false,
                `${file} must not contain forbidden claim pattern ${pattern}`
            );
        }
        assert.equal(
            hasMatch(strings, TECHNICAL_COPY),
            false,
            `${file} must not expose technical tokens`
        );
    }
});

test('public-v5 copy contract: spanish usted policy in public routes', () => {
    const dictKeys = extractDictKeys();
    const esDict = readJson('content/es.json');
    for (const file of ustedFiles) {
        const strings =
            file === 'content/es.json'
                ? dictKeys
                      .map((key) =>
                          typeof esDict[key] === 'string' ? esDict[key] : ''
                      )
                      .filter(Boolean)
                : collectStrings(readJson(file));
        for (const pattern of SPANISH_TUTEO) {
            assert.equal(
                hasMatch(strings, pattern),
                false,
                `${file} must not contain tuteo pattern ${pattern}`
            );
        }
    }
});

test('public-v5 copy contract: dict key parity for V5 microcopy subset', () => {
    const dictKeys = extractDictKeys();
    const es = readJson('content/es.json');
    const en = readJson('content/en.json');

    assert.equal(
        dictKeys.length >= 70,
        true,
        'expected V5 dict subset >= 70 keys'
    );

    for (const key of dictKeys) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(es, key),
            true,
            `missing ES key ${key}`
        );
        assert.equal(
            Object.prototype.hasOwnProperty.call(en, key),
            true,
            `missing EN key ${key}`
        );
    }
});
