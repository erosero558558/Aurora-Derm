#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_OUT_DIR = path.join('verification', 'copy-v5-final');
const DEFAULT_LABEL = 'public-v5-copy-audit';

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

const ES_MIXED = /\b(adults?|seniors?|children|teenagers?)\b/giu;
const EN_MIXED = /\b(adultos?|ninos|niños|adolescentes|adultos\s+mayores)\b/giu;

function parseArgs(argv) {
    const parsed = {
        strict: false,
        outDir: DEFAULT_OUT_DIR,
        label: DEFAULT_LABEL,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = String(argv[i] || '').trim();
        if (token === '--strict') {
            parsed.strict = true;
            continue;
        }
        if (token === '--out-dir') {
            parsed.outDir = String(argv[i + 1] || parsed.outDir).trim();
            i += 1;
            continue;
        }
        if (token === '--label') {
            parsed.label = String(argv[i + 1] || parsed.label).trim();
            i += 1;
            continue;
        }
    }

    return parsed;
}

function nowStamp() {
    const date = new Date();
    return [
        String(date.getUTCFullYear()).padStart(4, '0'),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
        '-',
        String(date.getUTCHours()).padStart(2, '0'),
        String(date.getUTCMinutes()).padStart(2, '0'),
        String(date.getUTCSeconds()).padStart(2, '0'),
    ].join('');
}

function readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
    return JSON.parse(readText(filePath));
}

function collectStrings(payload, out = []) {
    if (Array.isArray(payload)) {
        payload.forEach((item) => collectStrings(item, out));
        return out;
    }

    if (!payload || typeof payload !== 'object') {
        if (typeof payload === 'string') {
            out.push(payload);
        }
        return out;
    }

    Object.values(payload).forEach((value) => collectStrings(value, out));
    return out;
}

function countPatternMatches(text, pattern) {
    const matches = String(text || '').match(pattern);
    return matches ? matches.length : 0;
}

function scanClaims(filePath, strings, failures) {
    for (const pattern of FORBIDDEN_CLAIMS) {
        const joined = strings.join(' \n ');
        const hits = countPatternMatches(joined, pattern);
        if (hits > 0) {
            failures.push({
                check: 'forbidden_claims',
                file: filePath,
                value: hits,
                pattern: String(pattern),
            });
        }
    }
}

function scanTuteo(filePath, strings, failures) {
    const joined = strings.join(' \n ');
    for (const pattern of SPANISH_TUTEO) {
        const hits = countPatternMatches(joined, pattern);
        if (hits > 0) {
            failures.push({
                check: 'usted_policy',
                file: filePath,
                value: hits,
                pattern: String(pattern),
            });
        }
    }
}

function scanMixedLocale(filePath, strings, locale, failures) {
    const joined = strings.join(' \n ');
    const pattern = locale === 'es' ? ES_MIXED : EN_MIXED;
    const hits = countPatternMatches(joined, pattern);
    if (hits > 0) {
        failures.push({
            check: 'mixed_locale',
            file: filePath,
            value: hits,
        });
    }
}

function scanTechnicalCopy(filePath, strings, failures) {
    const joined = strings.join(' \n ');
    const hits = countPatternMatches(joined, TECHNICAL_COPY);
    if (hits > 0) {
        failures.push({
            check: 'technical_tokens_visible',
            file: filePath,
            value: hits,
        });
    }
}

function extractDictKeys(repoRoot) {
    const keys = new Set();
    const roots = [
        path.join(
            repoRoot,
            'src',
            'apps',
            'astro',
            'src',
            'components',
            'public-v5'
        ),
        path.join(repoRoot, 'src', 'apps', 'astro', 'src', 'pages', 'es'),
        path.join(repoRoot, 'src', 'apps', 'astro', 'src', 'pages', 'en'),
    ];
    const re = /\bdict\.([a-zA-Z0-9_]+)/g;

    for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        const stack = [root];
        while (stack.length) {
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
                const text = readText(target);
                let match;
                while ((match = re.exec(text))) {
                    keys.add(match[1]);
                }
            }
        }
    }

    return Array.from(keys).sort();
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function writeReport(runDir, payload) {
    const jsonPath = path.join(runDir, 'copy-audit.json');
    const mdPath = path.join(runDir, 'copy-audit.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const lines = [
        '# Public V5 Copy Audit',
        '',
        `- Generated At: ${payload.generatedAt}`,
        `- Strict Mode: ${payload.strict ? 'true' : 'false'}`,
        `- Result: ${payload.passed ? 'PASS' : 'FAIL'}`,
        `- Dict Keys (V5): ${payload.summary.dictKeyCount}`,
        '',
        '## Checks',
        '',
        `- Forbidden claims: ${payload.summary.forbiddenClaims}`,
        `- Mixed locale: ${payload.summary.mixedLocale}`,
        `- Usted policy hits: ${payload.summary.ustedPolicy}`,
        `- Technical tokens visible: ${payload.summary.technicalTokens}`,
        `- Missing dict keys (ES): ${payload.summary.missingEsKeys}`,
        `- Missing dict keys (EN): ${payload.summary.missingEnKeys}`,
        '',
        '## Failures',
        '',
    ];

    if (payload.failures.length === 0) {
        lines.push('- None');
    } else {
        payload.failures.forEach((failure) => {
            lines.push(
                `- ${failure.check} :: ${failure.file || 'n/a'} :: ${failure.value ?? ''} ${failure.pattern || ''}`.trim()
            );
        });
    }

    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
    return { jsonPath, mdPath };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = process.cwd();
    const dictKeys = extractDictKeys(repoRoot);
    const esDict = readJson(path.join(repoRoot, 'content', 'es.json'));
    const enDict = readJson(path.join(repoRoot, 'content', 'en.json'));

    const esContentFiles = [
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
        'content/public-v5/navigation.json',
        'content/public-v5/catalog.json',
    ];

    const enContentFiles = [
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
    ];

    const esUstedFiles = [
        'content/public-v3/es/home.json',
        'content/public-v3/es/hub.json',
        'content/public-v3/es/service.json',
        'content/public-v3/es/telemedicine.json',
        'content/es.json',
    ];

    const failures = [];

    for (const rel of esContentFiles) {
        const filePath = path.join(repoRoot, rel);
        const strings = collectStrings(readJson(filePath));
        scanClaims(rel, strings, failures);
        if (!rel.startsWith('content/public-v5/')) {
            scanMixedLocale(rel, strings, 'es', failures);
        }
        scanTechnicalCopy(rel, strings, failures);
    }

    for (const rel of enContentFiles) {
        const filePath = path.join(repoRoot, rel);
        const strings = collectStrings(readJson(filePath));
        scanClaims(rel, strings, failures);
        if (!rel.startsWith('content/public-v5/')) {
            scanMixedLocale(rel, strings, 'en', failures);
        }
        scanTechnicalCopy(rel, strings, failures);
    }

    for (const rel of esUstedFiles) {
        if (rel === 'content/es.json') {
            const strings = dictKeys
                .map((key) =>
                    typeof esDict[key] === 'string' ? esDict[key] : ''
                )
                .filter(Boolean);
            scanTuteo(rel, strings, failures);
            continue;
        }
        const filePath = path.join(repoRoot, rel);
        const strings = collectStrings(readJson(filePath));
        scanTuteo(rel, strings, failures);
    }

    const missingEs = dictKeys.filter(
        (key) => !Object.prototype.hasOwnProperty.call(esDict, key)
    );
    const missingEn = dictKeys.filter(
        (key) => !Object.prototype.hasOwnProperty.call(enDict, key)
    );

    if (missingEs.length > 0) {
        failures.push({
            check: 'missing_dict_keys_es',
            file: 'content/es.json',
            value: missingEs.length,
            pattern: missingEs.join(', '),
        });
    }

    if (missingEn.length > 0) {
        failures.push({
            check: 'missing_dict_keys_en',
            file: 'content/en.json',
            value: missingEn.length,
            pattern: missingEn.join(', '),
        });
    }

    const summary = {
        dictKeyCount: dictKeys.length,
        forbiddenClaims: failures.filter(
            (item) => item.check === 'forbidden_claims'
        ).length,
        mixedLocale: failures.filter((item) => item.check === 'mixed_locale')
            .length,
        ustedPolicy: failures.filter((item) => item.check === 'usted_policy')
            .length,
        technicalTokens: failures.filter(
            (item) => item.check === 'technical_tokens_visible'
        ).length,
        missingEsKeys: missingEs.length,
        missingEnKeys: missingEn.length,
    };

    const runDir = path.resolve(
        args.outDir,
        `${nowStamp()}-${String(args.label || DEFAULT_LABEL).replace(/[^a-zA-Z0-9_-]+/gu, '-')}`
    );
    ensureDir(runDir);

    const payload = {
        generatedAt: new Date().toISOString(),
        strict: args.strict,
        passed: failures.length === 0,
        summary,
        dictKeys,
        failures,
    };

    const report = writeReport(runDir, payload);
    const relJson = path
        .relative(repoRoot, report.jsonPath)
        .replace(/\\/g, '/');
    const relMd = path.relative(repoRoot, report.mdPath).replace(/\\/g, '/');

    process.stdout.write(
        [
            `Public V5 copy audit: ${payload.passed ? 'PASS' : 'FAIL'}`,
            `Failures: ${failures.length}`,
            'Artifacts:',
            `- ${relJson}`,
            `- ${relMd}`,
            '',
        ].join('\n')
    );

    if (args.strict && failures.length > 0) {
        process.exitCode = 1;
    }
}

main();
