#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { runPremiumGenerator } = require('./generate-premium-pages.js');

const ROOT = path.resolve(__dirname, '..');
const ACNE_FILE = path.join(ROOT, 'servicios', 'acne.html');
const LASER_FILE = path.join(ROOT, 'servicios', 'laser.html');
const ACNE_ROUTE_INDEX = path.join(ROOT, 'servicios', 'acne', 'index.html');
const LASER_ROUTE_INDEX = path.join(ROOT, 'servicios', 'laser', 'index.html');

const LASER_COPY = {
    title:
        '<title>\n' +
        '            L\u00e1ser Dermatol\u00f3gico en Quito | Manchas y Cicatrices | Piel en\n' +
        '            Armon\u00eda\n' +
        '        </title>',
    description:
        'Tratamientos l\u00e1ser para manchas, cicatrices, rejuvenecimiento y lesiones vasculares. Tecnolog\u00eda de punta con dermat\u00f3logos especialistas.',
    ogTitle: 'L\u00e1ser Dermatol\u00f3gico en Quito | Piel en Armon\u00eda',
    ogDescription:
        'Elimina manchas, cicatrices y lesiones con l\u00e1ser dermatol\u00f3gico en Quito.',
    intentLabel: 'Plan rapido para laser dermatologico',
    intentBadge: 'Laser dermatologico',
    intentCopy:
        'Definimos si el laser es la mejor opcion para\n' +
        '                            manchas, cicatrices o rejuvenecimiento y te damos\n' +
        '                            un plan con sesiones estimadas.',
    intentIdeal: 'Buscas tratar manchas, marcas o textura',
    intentIncludes: 'Valoracion + protocolo + cuidados previos',
    intentResult: 'Plan por sesiones con seguimiento medico',
    intentBookCta: 'Reservar valoracion laser',
    whatsappHref:
        'https://wa.me/593982453672?text=Hola%2C%20quiero%20una%20valoracion%20de%20laser%20dermatologico',
    whatsappLabel: 'Consultar por WhatsApp',
};

function readUtf8(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

function normalizeNewlines(text, newline) {
    return String(text).replace(/\n/g, newline);
}

function replaceOnce(content, pattern, replacement, label) {
    if (!pattern.test(content)) {
        throw new Error(`No se encontro patron para ${label}`);
    }
    return content.replace(pattern, replacement);
}

function replaceLiteral(content, fromText, toText, label) {
    if (!content.includes(fromText)) {
        throw new Error(`No se encontro texto esperado para ${label}`);
    }
    return content.split(fromText).join(toText);
}

function buildLaserFromAcne(sourceHtml) {
    const newline = sourceHtml.includes('\r\n') ? '\r\n' : '\n';
    let output = sourceHtml;

    output = replaceOnce(
        output,
        /<title>[\s\S]*?<\/title>/,
        normalizeNewlines(LASER_COPY.title, newline),
        'title'
    );
    output = replaceOnce(
        output,
        /(<meta\s+name="description"\s+content=")[^"]*(")/s,
        `$1${LASER_COPY.description}$2`,
        'meta description'
    );
    output = replaceLiteral(
        output,
        'href="https://pielarmonia.com/servicios/acne"',
        'href="https://pielarmonia.com/servicios/laser"',
        'canonical'
    );
    output = replaceOnce(
        output,
        /(<meta\s+property="og:title"\s+content=")[^"]*(")/s,
        `$1${LASER_COPY.ogTitle}$2`,
        'og:title'
    );
    output = replaceOnce(
        output,
        /(<meta\s+property="og:description"\s+content=")[^"]*(")/s,
        `$1${LASER_COPY.ogDescription}$2`,
        'og:description'
    );
    output = replaceLiteral(
        output,
        'content="https://pielarmonia.com/servicios/acne"',
        'content="https://pielarmonia.com/servicios/laser"',
        'og:url'
    );

    output = replaceLiteral(
        output,
        'service-page-acne',
        'service-page-laser',
        'body class'
    );

    const acneValues = output.match(/data-value="acne"/g) || [];
    if (acneValues.length < 3) {
        throw new Error(
            'Se esperaban al menos 3 data-value="acne" para transformar CTAs de servicio'
        );
    }
    output = output.replace(/data-value="acne"/g, 'data-value="laser"');

    output = replaceLiteral(
        output,
        'aria-label="Plan rapido para tratamiento de acne"',
        `aria-label="${LASER_COPY.intentLabel}"`,
        'intent aria-label'
    );
    output = replaceOnce(
        output,
        /(<span class="service-intent-badge">)[\s\S]*?(<\/span>)/,
        `$1${LASER_COPY.intentBadge}$2`,
        'intent badge'
    );
    output = replaceOnce(
        output,
        /(<p class="service-intent-copy">\s*)[\s\S]*?(\s*<\/p>)/,
        `$1${normalizeNewlines(LASER_COPY.intentCopy, newline)}$2`,
        'intent copy'
    );
    output = replaceLiteral(
        output,
        'Tu acne reaparece o dejo marcas',
        LASER_COPY.intentIdeal,
        'intent ideal'
    );
    output = replaceLiteral(
        output,
        'Diagnostico + rutina + plan de seguimiento',
        LASER_COPY.intentIncludes,
        'intent includes'
    );
    output = replaceLiteral(
        output,
        '<span class="service-intent-label">Modalidad</span>',
        '<span class="service-intent-label">Resultado</span>',
        'intent label result'
    );
    output = replaceLiteral(
        output,
        'Presencial o telemedicina con fotos',
        LASER_COPY.intentResult,
        'intent result'
    );
    output = replaceLiteral(
        output,
        'Reservar evaluacion de acne',
        LASER_COPY.intentBookCta,
        'intent book cta'
    );
    output = replaceLiteral(
        output,
        'href="https://wa.me/593982453672?text=Hola%2C%20quiero%20evaluar%20tratamiento%20para%20acne"',
        `href="${LASER_COPY.whatsappHref}"`,
        'intent whatsapp href'
    );
    output = replaceLiteral(
        output,
        'Enviar mi caso por WhatsApp',
        LASER_COPY.whatsappLabel,
        'intent whatsapp label'
    );

    return output;
}

function run() {
    const checkOnly = process.argv.includes('--check');

    const acneHtml = readUtf8(ACNE_FILE);
    const expectedLaser = buildLaserFromAcne(acneHtml);
    const currentLaser = readUtf8(LASER_FILE);
    const currentAcneRoute = fs.existsSync(ACNE_ROUTE_INDEX)
        ? readUtf8(ACNE_ROUTE_INDEX)
        : '';
    const currentLaserRoute = fs.existsSync(LASER_ROUTE_INDEX)
        ? readUtf8(LASER_ROUTE_INDEX)
        : '';

    if (checkOnly && expectedLaser !== currentLaser) {
        console.error(
            [
                'servicios/laser.html esta fuera de sync con la fuente canonica servicios/acne.html.',
                'Ejecuta: node servicios/build-service-pages.js',
            ].join('\n')
        );
        process.exit(1);
    }
    if (checkOnly && currentAcneRoute !== acneHtml) {
        console.error(
            [
                'servicios/acne/index.html esta fuera de sync con servicios/acne.html.',
                'Ejecuta: node servicios/build-service-pages.js',
            ].join('\n')
        );
        process.exit(1);
    }
    if (checkOnly && currentLaserRoute !== expectedLaser) {
        console.error(
            [
                'servicios/laser/index.html esta fuera de sync con servicios/laser.html.',
                'Ejecuta: node servicios/build-service-pages.js',
            ].join('\n')
        );
        process.exit(1);
    }

    if (!checkOnly && expectedLaser !== currentLaser) {
        writeUtf8(LASER_FILE, expectedLaser);
        console.log(
            'Actualizado: servicios/laser.html generado desde servicios/acne.html'
        );
    } else if (checkOnly) {
        console.log(
            'OK: servicios/laser.html esta sincronizado con la fuente canonica.'
        );
    } else {
        console.log(
            'Sin cambios: servicios/laser.html ya estaba sincronizado.'
        );
    }

    if (!checkOnly) {
        if (currentAcneRoute !== acneHtml) {
            writeUtf8(ACNE_ROUTE_INDEX, acneHtml);
            console.log('Actualizado: servicios/acne/index.html sincronizado.');
        }
        if (currentLaserRoute !== expectedLaser) {
            writeUtf8(LASER_ROUTE_INDEX, expectedLaser);
            console.log(
                'Actualizado: servicios/laser/index.html sincronizado.'
            );
        }
    }

    const premiumResult = runPremiumGenerator({ checkOnly });
    if (checkOnly) {
        if (!premiumResult.ok) {
            console.error(
                [
                    'Premium pages fuera de sync con content/services.json.',
                    ...premiumResult.mismatches.map((file) => `- ${file}`),
                    'Ejecuta: node servicios/build-service-pages.js',
                ].join('\n')
            );
            process.exit(1);
        }
        console.log('OK: premium service pages sincronizadas.');
        return;
    }

    if (premiumResult.written.length > 0) {
        console.log(
            `Actualizado: ${premiumResult.written.length} archivo(s) premium de servicios.`
        );
    } else {
        console.log('Sin cambios: premium service pages ya sincronizadas.');
    }
}

try {
    run();
} catch (error) {
    console.error(
        error && error.message
            ? error.message
            : 'Error inesperado al generar service pages'
    );
    process.exit(1);
}
