#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'content', 'services.json');
const OUT_SERVICIOS = path.join(ROOT, 'servicios');
const OUT_NINOS = path.join(ROOT, 'ninos');
const SERVICE_ANALYTICS_VERSION = 'service-analytics-20260226-v1';

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * @param {string} category
 * @returns {string}
 */
function getCategoryLabel(category) {
    const normalized = String(category || '')
        .trim()
        .toLowerCase();
    if (normalized === 'clinical') return 'Dermatología clínica';
    if (normalized === 'aesthetic') return 'Estética médica';
    if (normalized === 'children') return 'Pediatría dermatológica';
    return 'Dermatología especializada';
}

/**
 * @param {string} hrefPath
 * @returns {string}
 */
function getCanonical(hrefPath) {
    return `https://pielarmonia.com${hrefPath}`;
}

/**
 * @param {string} title
 * @param {string} description
 * @param {string} canonical
 * @param {string} content
 * @returns {string}
 */
function buildPage(title, description, canonical, content) {
    return `<!DOCTYPE html>
<html lang="es">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>${escapeHtml(title)} | Piel en Armonía</title>
        <meta name="description" content="${escapeHtml(description)}" />
        <link rel="canonical" href="${escapeHtml(canonical)}" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="${escapeHtml(title)} | Piel en Armonía" />
        <meta property="og:description" content="${escapeHtml(description)}" />
        <meta property="og:url" content="${escapeHtml(canonical)}" />
        <meta property="og:site_name" content="Piel en Armonía" />
        <meta property="og:image" content="https://pielarmonia.com/images/optimized/showcase-hero.jpg" />
        <link rel="stylesheet" href="/styles.css?v=inline-20260224-extracted1" />
        <link rel="stylesheet" href="/styles-deferred.css?v=ui-20260223-clsfix1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script src="/js/service-navigation-analytics.js?v=${escapeHtml(SERVICE_ANALYTICS_VERSION)}" defer></script>
    </head>
    <body class="service-page-premium">
        <header class="service-header">
            <a href="/" class="service-back-link">&larr; Volver a Piel en Armonía</a>
            <a href="/#citas" class="service-cta-link">Reservar cita</a>
        </header>
        <main class="service-main">
            ${content}
        </main>
        <footer class="service-footer">
            <p>&copy; 2026 Piel en Armonía · Dermatología especializada en Quito</p>
        </footer>
    </body>
</html>
`;
}

/**
 * @param {any} service
 * @param {string} serviceHrefPath
 * @returns {string}
 */
function buildServiceContent(service, serviceHrefPath) {
    const indications = Array.isArray(service.indications)
        ? service.indications
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join('')
        : '';
    const contraindications = Array.isArray(service.contraindications)
        ? service.contraindications
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join('')
        : '';
    const faq = Array.isArray(service.faq)
        ? service.faq
              .map(
                  (item) =>
                      `<details><summary>${escapeHtml(item)}</summary><p>Durante la consulta se personaliza la respuesta según tu diagnóstico.</p></details>`
              )
              .join('')
        : '';

    const ivaLabel = Number(service.iva) === 0 ? 'IVA 0%' : 'IVA 15%';
    const bookingHint =
        service && service.cta && service.cta.service_hint
            ? String(service.cta.service_hint)
            : 'consulta';
    const ctaLabel =
        service && service.cta && service.cta.label_es
            ? String(service.cta.label_es)
            : 'Reservar valoración';
    const bookingHref = `/?service=${encodeURIComponent(bookingHint)}#citas`;
    const slug = String(service.slug || '').trim();
    const category = String(service.category || '')
        .trim()
        .toLowerCase();

    return `
<section class="service-hero-card" data-service-slug="${escapeHtml(slug)}" data-service-category="${escapeHtml(category)}">
    <p class="service-hero-kicker">${escapeHtml(getCategoryLabel(category))}</p>
    <h1>${escapeHtml(service.hero || service.slug)}</h1>
    <p>${escapeHtml(service.summary || '')}</p>
    <div class="service-meta-row">
        <span>Duración estimada: ${escapeHtml(service.duration || '30 min')}</span>
        <span>Desde $${escapeHtml(service.price_from)}</span>
        <span>${escapeHtml(ivaLabel)}</span>
    </div>
    <div class="service-actions">
        <a class="btn btn-primary" href="${escapeHtml(bookingHref)}" data-analytics-event="start_booking_from_service" data-service-slug="${escapeHtml(slug)}" data-service-category="${escapeHtml(category)}">${escapeHtml(ctaLabel)}</a>
        <a class="btn btn-secondary" href="https://wa.me/593982453672" target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a>
    </div>
</section>

<section class="service-grid-block">
    <article class="service-panel">
        <h2>Indicaciones frecuentes</h2>
        <ul>${indications}</ul>
    </article>
    <article class="service-panel">
        <h2>Consideraciones médicas</h2>
        <ul>${contraindications || '<li>Se confirma el plan durante valoración clínica.</li>'}</ul>
    </article>
</section>

<section class="service-panel service-faq">
    <h2>Preguntas frecuentes</h2>
    ${faq}
</section>
<section class="service-panel">
    <h2>Siguiente paso recomendado</h2>
    <p>
        Reserva una valoración médica para confirmar diagnóstico, prioridad y plan personalizado.
        Si ya tienes exámenes o fotos clínicas, llévalas a consulta.
    </p>
    <div class="service-actions">
        <a class="btn btn-primary" href="${escapeHtml(bookingHref)}" data-analytics-event="start_booking_from_service" data-service-slug="${escapeHtml(slug)}" data-service-category="${escapeHtml(category)}">Reservar ahora</a>
        <a class="btn btn-secondary" href="${escapeHtml(serviceHrefPath)}">Compartir este servicio</a>
    </div>
</section>`;
}

/**
 * @param {string} filePath
 * @param {string} content
 * @returns {{ changed: boolean, exists: boolean }}
 */
function compareWithFile(filePath, content) {
    if (!fs.existsSync(filePath)) {
        return { changed: true, exists: false };
    }
    const current = fs.readFileSync(filePath, 'utf8');
    return { changed: current !== content, exists: true };
}

/**
 * @param {string} filePath
 * @param {string} content
 */
function writeFileEnsured(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * @param {{ checkOnly?: boolean }} options
 * @returns {{ ok: boolean, mismatches: string[], written: string[] }}
 */
function runPremiumGenerator(options = {}) {
    const checkOnly = options.checkOnly === true;
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const services = Array.isArray(data.services) ? data.services : [];
    const mismatches = [];
    const written = [];

    fs.mkdirSync(OUT_SERVICIOS, { recursive: true });
    fs.mkdirSync(OUT_NINOS, { recursive: true });

    for (const service of services) {
        if (!service || typeof service.slug !== 'string') continue;
        const slug = service.slug.trim();
        if (!slug) continue;

        const isPediatric = slug === 'dermatologia-pediatrica';
        const hrefPath = isPediatric ? `/ninos/${slug}` : `/servicios/${slug}`;
        const canonical = getCanonical(hrefPath);
        const page = buildPage(
            service.hero || slug,
            service.summary ||
                'Servicio dermatológico especializado en Piel en Armonía.',
            canonical,
            buildServiceContent(service, hrefPath)
        );
        const htmlPath = isPediatric
            ? path.join(OUT_NINOS, `${slug}.html`)
            : path.join(OUT_SERVICIOS, `${slug}.html`);
        const routeIndexPath = isPediatric
            ? path.join(OUT_NINOS, slug, 'index.html')
            : path.join(OUT_SERVICIOS, slug, 'index.html');

        const htmlDiff = compareWithFile(htmlPath, page);
        const routeDiff = compareWithFile(routeIndexPath, page);

        if (checkOnly) {
            if (htmlDiff.changed) mismatches.push(htmlPath);
            if (routeDiff.changed) mismatches.push(routeIndexPath);
            continue;
        }

        if (htmlDiff.changed) {
            writeFileEnsured(htmlPath, page);
            written.push(htmlPath);
        }
        if (routeDiff.changed) {
            writeFileEnsured(routeIndexPath, page);
            written.push(routeIndexPath);
        }
    }

    return { ok: mismatches.length === 0, mismatches, written };
}

if (require.main === module) {
    const checkOnly = process.argv.includes('--check');
    const result = runPremiumGenerator({ checkOnly });
    if (checkOnly) {
        if (!result.ok) {
            console.error(
                [
                    'Premium service pages out of sync.',
                    ...result.mismatches.map((item) => `- ${item}`),
                    'Run: node servicios/generate-premium-pages.js',
                ].join('\n')
            );
            process.exit(1);
        }
        console.log('OK: premium service pages are in sync.');
    } else if (result.written.length === 0) {
        console.log(
            'Sin cambios: premium service pages ya estaban sincronizadas.'
        );
    } else {
        console.log(
            `Actualizado: ${result.written.length} archivo(s) premium generado(s).`
        );
    }
}

module.exports = {
    runPremiumGenerator,
};
