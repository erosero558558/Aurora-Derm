import { debugLog, withDeployAssetVersion } from './utils.js';

const CONTENT_JSON_URL = withDeployAssetVersion('/content/index.json');
const REQUIRED_SECTION_IDS = [
    'showcase',
    'servicios',
    'telemedicina',
    'tarifario',
    'equipo',
    'galeria',
    'consultorio',
    'resenas',
    'citas',
    'chatbotWidget',
];

const FALLBACK_SECTION_TITLES = {
    showcase: 'Presentacion',
    servicios: 'Servicios',
    telemedicina: 'Telemedicina',
    tarifario: 'Tarifario',
    equipo: 'Equipo medico',
    galeria: 'Resultados',
    consultorio: 'Consultorio',
    resenas: 'Resenas',
    citas: 'Reserva de cita',
    chatbotWidget: 'Asistente virtual',
};

export function hydrateDeferredText(container) {
    if (!window.PIEL_CONTENT) return;
    const nodes = container.querySelectorAll('[data-i18n]');
    nodes.forEach((node) => {
        const key = node.getAttribute('data-i18n');
        if (window.PIEL_CONTENT[key]) {
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
                node.placeholder = window.PIEL_CONTENT[key];
            } else {
                node.innerHTML = window.PIEL_CONTENT[key];
            }
        }
    });
}

function normalizeDeferredAssetPath(value) {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    if (raw.startsWith('images/')) return `/${raw}`;
    if (raw.startsWith('./images/')) return raw.replace('./images/', '/images/');
    return raw;
}

function normalizeDeferredSrcset(value) {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    return raw
        .split(',')
        .map((chunk) => {
            const trimmed = chunk.trim();
            if (!trimmed) return trimmed;
            const parts = trimmed.split(/\s+/);
            parts[0] = normalizeDeferredAssetPath(parts[0]);
            return parts.join(' ');
        })
        .join(', ');
}

function normalizeDeferredInlineStyle(value) {
    const raw = String(value || '');
    if (!raw) return raw;
    return raw
        .replace(/url\((['"]?)\.?\/?images\//g, "url($1/images/")
        .replace(/url\((['"]?)images\//g, "url($1/images/");
}

function normalizeDeferredAssetUrls(container) {
    if (!container) return;

    container.querySelectorAll('[src]').forEach((node) => {
        const current = node.getAttribute('src');
        const next = normalizeDeferredAssetPath(current);
        if (next && next !== current) {
            node.setAttribute('src', next);
        }
    });

    container.querySelectorAll('[data-src]').forEach((node) => {
        const current = node.getAttribute('data-src');
        const next = normalizeDeferredAssetPath(current);
        if (next && next !== current) {
            node.setAttribute('data-src', next);
        }
    });

    container.querySelectorAll('[srcset]').forEach((node) => {
        const current = node.getAttribute('srcset');
        const next = normalizeDeferredSrcset(current);
        if (next && next !== current) {
            node.setAttribute('srcset', next);
        }
    });

    container.querySelectorAll('[data-srcset]').forEach((node) => {
        const current = node.getAttribute('data-srcset');
        const next = normalizeDeferredSrcset(current);
        if (next && next !== current) {
            node.setAttribute('data-srcset', next);
        }
    });

    container.querySelectorAll('[style*="url("]').forEach((node) => {
        const current = node.getAttribute('style');
        const next = normalizeDeferredInlineStyle(current);
        if (next && next !== current) {
            node.setAttribute('style', next);
        }
    });
}

function forceDeferredSectionPaint(container) {
    if (!container || !(container instanceof HTMLElement)) return;
    container.style.contentVisibility = 'visible';
    container.style.containIntrinsicSize = 'auto';
}

function isValidDeferredPayload(data) {
    if (!data || typeof data !== 'object') return false;
    return REQUIRED_SECTION_IDS.some(
        (id) => typeof data[id] === 'string' && data[id].trim() !== ''
    );
}

async function tryFetchDeferredPayload(url, useCacheBuster = false) {
    const parsedUrl = new URL(url, window.location.origin);
    if (useCacheBuster) {
        parsedUrl.searchParams.set('_ts', String(Date.now()));
    }

    const response = await fetch(parsedUrl.toString(), {
        cache: 'no-store',
        credentials: 'same-origin',
    });
    if (!response.ok) {
        throw new Error(`Deferred content fetch failed (${response.status})`);
    }

    const data = await response.json();
    if (!isValidDeferredPayload(data)) {
        throw new Error('Deferred content payload is invalid');
    }

    return data;
}

async function fetchDeferredPayload() {
    const candidateUrls = [
        CONTENT_JSON_URL,
        '/content/index.json',
        'content/index.json',
        './content/index.json',
    ];
    const uniqueUrls = [...new Set(candidateUrls.filter(Boolean))];

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const useCacheBuster = attempt > 0;
        for (const url of uniqueUrls) {
            try {
                return await tryFetchDeferredPayload(url, useCacheBuster);
            } catch (error) {
                lastError = error;
                debugLog(`Deferred content retry failed for ${url}:`, error);
            }
        }
    }

    throw lastError || new Error('Deferred content unavailable');
}

function renderDeferredFallbackState() {
    const refreshHref = encodeURI(window.location.pathname || '/');
    document.querySelectorAll('.section.deferred-content').forEach((section) => {
        const title =
            FALLBACK_SECTION_TITLES[section.id] || 'Contenido temporalmente no disponible';
        section.innerHTML = `
            <div class="section-header" style="text-align:center;">
                <h2 class="section-title">${title}</h2>
                <p class="section-subtitle">
                    Estamos recargando esta seccion. Si no aparece en unos segundos, recarga la pagina.
                </p>
                <a href="${refreshHref}" class="btn btn-secondary">
                    Recargar ahora
                </a>
            </div>
        `;
        section.classList.remove('deferred-content');
        forceDeferredSectionPaint(section);
    });
}

export async function loadDeferredContent() {
    try {
        const data = await fetchDeferredPayload();

        Object.keys(data).forEach((id) => {
            const container = document.getElementById(id);
            if (container && container.classList.contains('deferred-content')) {
                container.innerHTML = data[id];
                normalizeDeferredAssetUrls(container);
                container.classList.remove('deferred-content'); // Optional cleanup
                forceDeferredSectionPaint(container);
                hydrateDeferredText(container);
            } else if (!container) {
                debugLog(`Warning: Container #${id} not found for deferred content.`);
            }
        });

        debugLog('Deferred content loaded and hydrated.');
        return true;
    } catch (error) {
        debugLog('Error loading deferred content:', error);
        renderDeferredFallbackState();
        return false;
    }
}
