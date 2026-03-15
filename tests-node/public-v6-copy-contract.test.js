const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
    const full = path.join(ROOT, relativePath);
    return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function pick(obj, pathExpr) {
    return pathExpr.split('.').reduce((acc, key) => {
        if (acc === null || acc === undefined) return undefined;
        return acc[key];
    }, obj);
}

function assertString(obj, file, pathExpr) {
    const value = pick(obj, pathExpr);
    assert.equal(
        typeof value,
        'string',
        `${file}: ${pathExpr} must be a string`
    );
    assert.ok(value.trim(), `${file}: ${pathExpr} must not be empty`);
}

function countWords(text) {
    return String(text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

const tuteoPattern = /\b(tu|tus|contigo|te\s+acompanamos|te\s+guiamos)\b/i;

test('public-v6 copy contract: required ui labels exist in ES and EN', () => {
    const files = [
        'content/public-v6/es/navigation.json',
        'content/public-v6/es/home.json',
        'content/public-v6/es/hub.json',
        'content/public-v6/es/service.json',
        'content/public-v6/es/telemedicine.json',
        'content/public-v6/es/legal.json',
        'content/public-v6/en/navigation.json',
        'content/public-v6/en/home.json',
        'content/public-v6/en/hub.json',
        'content/public-v6/en/service.json',
        'content/public-v6/en/telemedicine.json',
        'content/public-v6/en/legal.json',
    ];

    const requiredByFile = {
        'navigation.json': [
            'brand.logo',
            'brand.tag',
            'brand.utility.label',
            'brand.utility.href',
            'ui.shell.skipToContent',
            'ui.shell.backToTop',
            'ui.header.primaryNavAria',
            'ui.header.megaCategoryTabsAria',
            'ui.header.openCategoryLabel',
            'ui.pageHead.breadcrumbAria',
            'ui.pageHead.pageNavigationTitle',
            'ui.footer.policyAria',
            'header.menuLabel',
            'header.closeMenuLabel',
            'header.switchLabel',
            'header.switchHref',
        ],
        'home.json': [
            'hero.labels.prev',
            'hero.labels.next',
            'hero.labels.pause',
            'hero.labels.play',
            'hero.labels.indicatorItemPrefix',
            'newsStrip.expandLabel',
            'editorial.ctaLabel',
            'corporateMatrix.ctaLabel',
            'bookingStatus.eyebrow',
            'bookingStatus.ctaHref',
        ],
        'hub.json': [
            'ui.menu.featured',
            'ui.menu.initiatives',
            'ui.ctaLabel',
            'ui.railAria',
            'bookingStatus.eyebrow',
            'bookingStatus.ctaHref',
        ],
        'service.json': [
            'ui.menu.glance',
            'ui.menu.faq',
            'ui.breadcrumb.home',
            'ui.sections.relatedTitle',
            'ui.relatedCta',
            'ui.bookingStatus.title',
            'ui.bookingStatus.ctaHref',
        ],
        'telemedicine.json': [
            'ui.menu.initiatives',
            'ui.kpis.blocks',
            'ui.initiatives.ctaLabel',
            'ui.blockCtaLabel',
            'bookingStatus.eyebrow',
            'bookingStatus.ctaHref',
        ],
        'legal.json': [
            'ui.breadcrumb.home',
            'ui.menu.legalIndex',
            'ui.thesis.title',
            'ui.statement.title',
            'ui.clausesLabel',
        ],
    };

    for (const file of files) {
        const json = readJson(file);
        const base = path.basename(file);
        const required = requiredByFile[base] || [];
        for (const field of required) {
            assertString(json, file, field);
        }
    }
});

test('public-v6 brand contract: Aurora Derm is canonical in navigation ES and EN', () => {
    const files = [
        'content/public-v6/es/navigation.json',
        'content/public-v6/en/navigation.json',
    ];

    for (const file of files) {
        const json = readJson(file);
        assert.equal(
            json?.brand?.logo,
            'Aurora Derm',
            `${file}: brand.logo must be Aurora Derm`
        );
        assert.equal(
            typeof json?.brand?.utility?.href,
            'string',
            `${file}: brand.utility.href must be a string`
        );
        assert.ok(
            String(json?.brand?.utility?.href || '').includes('/software/'),
            `${file}: brand.utility.href must link to software`
        );
        const raw = JSON.stringify(json).toLowerCase();
        assert.equal(
            raw.includes('piel en armonia'),
            false,
            `${file}: legacy brand must not appear`
        );
    }
});

test('public-v6 copy contract: service FAQ answers are explicit per route', () => {
    const files = [
        'content/public-v6/es/service.json',
        'content/public-v6/en/service.json',
    ];

    for (const file of files) {
        const json = readJson(file);
        const fallback = String(json?.ui?.faqAnswerNote || '')
            .trim()
            .toLowerCase();
        const internalFallback = String(json?.ui?.internalMessageFallback || '')
            .trim()
            .toLowerCase();
        const services = Array.isArray(json.services) ? json.services : [];
        assert.ok(services.length > 0, `${file}: services must not be empty`);

        for (const service of services) {
            const label = `${file}:${service.slug || 'service'}`;
            const faq = Array.isArray(service.faq) ? service.faq : [];
            const faqAnswers = Array.isArray(service.faqAnswers)
                ? service.faqAnswers
                : [];

            assert.equal(
                typeof service.lead,
                'string',
                `${label}: lead must be string`
            );
            assert.ok(
                service.lead.trim().length > 0,
                `${label}: lead must not be empty`
            );
            assert.ok(
                countWords(service.lead) >= 12,
                `${label}: lead must include at least 12 words`
            );
            if (internalFallback) {
                assert.notEqual(
                    service.lead.trim().toLowerCase(),
                    internalFallback,
                    `${label}: lead must not fallback to generic internal message`
                );
            }

            assert.equal(
                faqAnswers.length,
                faq.length,
                `${label}: faqAnswers length must match faq length`
            );

            for (const [index, answer] of faqAnswers.entries()) {
                assert.equal(
                    typeof answer,
                    'string',
                    `${label}: faqAnswers[${index}] must be string`
                );
                assert.ok(
                    answer.trim().length > 0,
                    `${label}: faqAnswers[${index}] must not be empty`
                );
                assert.ok(
                    countWords(answer) >= 12,
                    `${label}: faqAnswers[${index}] must include at least 12 words`
                );
                if (fallback) {
                    assert.notEqual(
                        answer.trim().toLowerCase(),
                        fallback,
                        `${label}: faqAnswers[${index}] must not use generic fallback`
                    );
                }
            }
        }
    }
});

test('public-v6 copy contract: booking status title is unified across key surfaces', () => {
    const checks = [
        {
            locale: 'es',
            expected: 'reserva online en mantenimiento',
            file: 'content/public-v6/es/home.json',
            pathExpr: 'bookingStatus.title',
        },
        {
            locale: 'es',
            expected: 'reserva online en mantenimiento',
            file: 'content/public-v6/es/hub.json',
            pathExpr: 'bookingStatus.title',
        },
        {
            locale: 'es',
            expected: 'reserva online en mantenimiento',
            file: 'content/public-v6/es/telemedicine.json',
            pathExpr: 'bookingStatus.title',
        },
        {
            locale: 'es',
            expected: 'reserva online en mantenimiento',
            file: 'content/public-v6/es/service.json',
            pathExpr: 'ui.bookingStatus.title',
        },
        {
            locale: 'en',
            expected: 'online booking under maintenance',
            file: 'content/public-v6/en/home.json',
            pathExpr: 'bookingStatus.title',
        },
        {
            locale: 'en',
            expected: 'online booking under maintenance',
            file: 'content/public-v6/en/hub.json',
            pathExpr: 'bookingStatus.title',
        },
        {
            locale: 'en',
            expected: 'online booking under maintenance',
            file: 'content/public-v6/en/telemedicine.json',
            pathExpr: 'bookingStatus.title',
        },
        {
            locale: 'en',
            expected: 'online booking under maintenance',
            file: 'content/public-v6/en/service.json',
            pathExpr: 'ui.bookingStatus.title',
        },
    ];

    checks.forEach((item) => {
        const json = readJson(item.file);
        const value = String(pick(json, item.pathExpr) || '')
            .trim()
            .toLowerCase();
        assert.equal(
            value,
            item.expected,
            `${item.locale}: ${item.file}:${item.pathExpr} must be "${item.expected}"`
        );
    });
});

test('public-v6 copy contract: anti-robot legacy phrases removed', () => {
    const files = [
        'content/public-v6/es/home.json',
        'content/public-v6/es/hub.json',
        'content/public-v6/es/service.json',
        'content/public-v6/es/telemedicine.json',
        'content/public-v6/en/home.json',
        'content/public-v6/en/hub.json',
        'content/public-v6/en/service.json',
        'content/public-v6/en/telemedicine.json',
    ];

    const blocked = [
        /protocolo,\s*evidencia\s*y\s*seguimiento/i,
        /nunca promesas vacias/i,
        /bloque corporativo/i,
        /v6 recalibration/i,
        /corporate block/i,
        /calidez serena/i,
        /seguimiento preciso/i,
        /lectura medica clara/i,
        /la promesa es simple/i,
    ];

    for (const file of files) {
        const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
        for (const pattern of blocked) {
            assert.equal(
                pattern.test(raw),
                false,
                `${file}: unexpected legacy phrase ${pattern}`
            );
        }
    }
});

test('public-v6 copy contract: ES patient surfaces keep usted register and avoid tuteo', () => {
    const files = [
        'content/public-v6/es/navigation.json',
        'content/public-v6/es/home.json',
        'content/public-v6/es/hub.json',
        'content/public-v6/es/service.json',
        'content/public-v6/es/telemedicine.json',
    ];

    for (const file of files) {
        const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
        const normalized = raw.toLowerCase();
        assert.equal(
            normalized.includes('usted'),
            true,
            `${file}: expected explicit usted register`
        );
        assert.equal(
            tuteoPattern.test(raw),
            false,
            `${file}: unexpected tuteo phrasing`
        );
    }
});

test('public-v6 copy contract: legal ES stays clear without colloquial filler', () => {
    const raw = fs.readFileSync(
        path.join(ROOT, 'content/public-v6/es/legal.json'),
        'utf8'
    );

    const blocked = [
        /sin tanta vuelta/i,
        /\bde una\b/i,
        /\bbacan\b/i,
        /\bfull\b/i,
    ];

    blocked.forEach((pattern) => {
        assert.equal(
            pattern.test(raw),
            false,
            `content/public-v6/es/legal.json: unexpected colloquial pattern ${pattern}`
        );
    });
});
