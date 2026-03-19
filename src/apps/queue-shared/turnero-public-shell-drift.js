function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function toList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => toString(item)).filter(Boolean);
    }
    const normalized = toString(value);
    return normalized ? [normalized] : [];
}

function normalizeNeedles(list) {
    return toList(list).map((item) => item.toLowerCase());
}

function hasNeedle(haystack, needles = []) {
    const body = String(haystack || '').toLowerCase();
    return normalizeNeedles(needles).some((needle) => body.includes(needle));
}

function findAllMatches(haystack, pattern) {
    return Array.from(String(haystack || '').matchAll(pattern));
}

function firstNonEmpty(values = []) {
    for (const value of values) {
        const normalized = toString(value);
        if (normalized) {
            return normalized;
        }
    }
    return '';
}

function extractHref(match) {
    if (!match) {
        return '';
    }

    return firstNonEmpty([match.groups?.href, match[1], match[2]]);
}

function extractInlineScripts(html = '') {
    const matches = findAllMatches(
        html,
        /<script\b(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi
    );

    return matches
        .map((match) => toString(match[2]))
        .filter(Boolean)
        .map((value) => value.trim());
}

function detectStylesheetHref(html = '', options = {}) {
    const linkMatches = findAllMatches(
        html,
        /<link\b[^>]*\brel=(["'])[^"']*stylesheet[^"']*\1[^>]*\bhref=(["'])(?<href>[^"']+)\2[^>]*>/gi
    );
    const fallbackMatches = findAllMatches(
        html,
        /<link\b[^>]*\bhref=(["'])(?<href>[^"']+)\1[^>]*\brel=(["'])[^"']*stylesheet[^"']*\2[^>]*>/gi
    );
    const matches = [...linkMatches, ...fallbackMatches];
    const hrefs = matches.map(extractHref).filter(Boolean);
    const preferredNeedles = normalizeNeedles(
        options.expectedStylesNeedle ||
            options.preferredStyleNeedles || ['styles.css']
    );
    const chosen =
        hrefs.find((href) => hasNeedle(href, preferredNeedles)) ||
        hrefs[0] ||
        '';

    return {
        href: chosen,
        all: hrefs,
        present: Boolean(chosen),
        matchesExpected:
            !preferredNeedles.length || !chosen
                ? Boolean(chosen)
                : hasNeedle(chosen, preferredNeedles),
    };
}

function detectShellScriptSrc(html = '', options = {}) {
    const matches = findAllMatches(
        html,
        /<script\b[^>]*\bsrc=(["'])(?<src>[^"']+)\1[^>]*><\/script>/gi
    );
    const srcs = matches
        .map((match) => firstNonEmpty([match.groups?.src, match[1]]))
        .filter(Boolean);
    const preferredNeedles = normalizeNeedles(
        options.expectedShellScriptNeedle ||
            options.preferredShellNeedles || ['script.js']
    );
    const chosen =
        srcs.find((src) => hasNeedle(src, preferredNeedles)) || srcs[0] || '';

    return {
        src: chosen,
        all: srcs,
        present: Boolean(chosen),
        matchesExpected:
            !preferredNeedles.length || !chosen
                ? Boolean(chosen)
                : hasNeedle(chosen, preferredNeedles),
    };
}

function detectGa4(html = '', options = {}) {
    const requiredNeedles = normalizeNeedles(
        options.expectedGa4Needles ||
            options.requiredGa4Needles || [
                'googletagmanager.com',
                'gtag(',
                'dataLayer',
            ]
    );
    const body = String(html || '').toLowerCase();
    const found = requiredNeedles.filter((needle) => body.includes(needle));

    return {
        required: requiredNeedles,
        found,
        present: found.length > 0,
        complete:
            requiredNeedles.length === 0
                ? true
                : found.length === requiredNeedles.length,
    };
}

export function createTurneroPublicShellDriftModel(scan = {}, options = {}) {
    const pageStatus = Number(scan.pageStatus || 0);
    const pageOk = Boolean(scan.pageOk);
    const html = toString(scan.html);
    const stylesheet = detectStylesheetHref(html, options);
    const shellScript = detectShellScriptSrc(html, options);
    const inlineScripts = extractInlineScripts(html);
    const executableInlineScripts = inlineScripts.filter((script) => {
        const normalized = script.toLowerCase();
        if (!normalized) {
            return false;
        }

        return (
            normalized.includes('window.') ||
            normalized.includes('document.') ||
            normalized.includes('gtag(') ||
            normalized.includes('datalayer') ||
            normalized.includes('import(') ||
            normalized.includes('function(') ||
            normalized.includes('=>')
        );
    });
    const ga4 = detectGa4(html, options);
    const blockers = [];

    function pushBlocker(key, title, detail) {
        blockers.push({ key, title, detail });
    }

    if (!pageOk) {
        pushBlocker(
            'public_shell_unavailable',
            'Shell público no disponible',
            `No se pudo leer / o respondió con status ${pageStatus || 'desconocido'}.`
        );
    }

    if (!stylesheet.present) {
        pushBlocker(
            'stylesheet_missing',
            'Stylesheet público ausente',
            'No se detectó un <link rel="stylesheet"> en el shell público.'
        );
    } else if (options.expectedStylesNeedle && !stylesheet.matchesExpected) {
        pushBlocker(
            'stylesheet_drift',
            'Stylesheet fuera del corte esperado',
            `Detectado ${stylesheet.href}, esperado substring ${toString(
                options.expectedStylesNeedle
            )}.`
        );
    }

    if (!shellScript.present) {
        pushBlocker(
            'shell_script_missing',
            'Shell script ausente',
            'No se detectó un <script src> del shell público.'
        );
    } else if (
        options.expectedShellScriptNeedle &&
        !shellScript.matchesExpected
    ) {
        pushBlocker(
            'shell_script_drift',
            'Shell script fuera del corte esperado',
            `Detectado ${shellScript.src}, esperado substring ${toString(
                options.expectedShellScriptNeedle
            )}.`
        );
    }

    if (executableInlineScripts.length > 0) {
        pushBlocker(
            'inline_executable_script',
            'Script inline ejecutable detectado',
            `Se detectaron ${executableInlineScripts.length} script(s) inline con ejecución aparente en el HTML público.`
        );
    }

    const requireGa4Markers = options.requireGa4Markers !== false;
    if (requireGa4Markers && !ga4.complete) {
        pushBlocker(
            'ga4_markers_missing',
            'Marcadores GA4 incompletos',
            ga4.required.length
                ? `Presentes ${ga4.found.length}/${ga4.required.length}: ${
                      ga4.found.join(', ') || 'ninguno'
                  }.`
                : 'No se detectaron marcadores GA4 requeridos.'
        );
    }

    const signalSummary = [
        `GET / ${pageOk ? `OK (${pageStatus || 200})` : `falló (${pageStatus || 'n/a'})`}`,
        `stylesheet ${stylesheet.href || 'unknown'}`,
        `shell script ${shellScript.src || 'unknown'}`,
        `inline ${String(executableInlineScripts.length)}`,
        `GA4 ${ga4.found.length ? ga4.found.join(', ') : 'ninguno'}`,
    ].join(' · ');

    return {
        pageOk,
        pageStatus: pageStatus || null,
        stylesheetHref: stylesheet.href || 'unknown',
        shellScriptSrc: shellScript.src || 'unknown',
        inlineExecutableScripts: executableInlineScripts.length,
        ga4Found: ga4.found,
        ga4Required: ga4.required,
        signalSummary,
        supportCopy:
            blockers.length > 0
                ? 'Bloquea la salida hasta que el shell público vuelva al corte esperado.'
                : 'Shell público alineado con el corte esperado.',
        driftStatus: blockers.length ? 'blocked' : 'ready',
        driftLabel: blockers.length ? 'Bloqueado' : 'Listo',
        blockers,
    };
}

export function renderTurneroPublicShellDriftCard(modelOrScan, options = {}) {
    const model =
        modelOrScan && Array.isArray(modelOrScan.blockers)
            ? modelOrScan
            : createTurneroPublicShellDriftModel(modelOrScan, options);

    const blockersMarkup = model.blockers.length
        ? model.blockers
              .map(
                  (item) => `
                        <article
                            id="queuePublicShellDriftBlocker_${escapeHtml(item.key)}"
                            class="queue-ops-pilot__issues-item"
                            data-state="alert"
                            role="listitem"
                        >
                            <div class="queue-ops-pilot__issues-item-head">
                                <strong>Bloquea: ${escapeHtml(item.title)}</strong>
                                <span class="queue-ops-pilot__issues-item-badge">Bloquea</span>
                            </div>
                            <p>${escapeHtml(item.detail)}</p>
                        </article>
                    `
              )
              .join('')
        : `
                        <article
                            id="queuePublicShellDriftBlocker_ready"
                            class="queue-ops-pilot__issues-item"
                            data-state="ready"
                            role="listitem"
                        >
                            <div class="queue-ops-pilot__issues-item-head">
                                <strong>Shell público alineado</strong>
                                <span class="queue-ops-pilot__issues-item-badge">Listo</span>
                            </div>
                            <p>El shell público respondió y coincide con el corte esperado.</p>
                        </article>
                    `;

    return `
        <section
            id="queuePublicShellDrift"
            class="queue-ops-pilot__issues queue-ops-pilot__public-shell-drift"
            data-state="${escapeHtml(model.driftStatus)}"
            aria-live="polite"
        >
            <div class="queue-ops-pilot__issues-head">
                <div>
                    <p class="queue-app-card__eyebrow">Deploy drift del shell público</p>
                    <h6 id="queuePublicShellDriftTitle">Drift del shell público</h6>
                </div>
                <span
                    id="queuePublicShellDriftStatus"
                    class="queue-ops-pilot__issues-status"
                    data-state="${escapeHtml(model.driftStatus)}"
                >
                    ${escapeHtml(model.driftLabel)}
                </span>
            </div>
            <p id="queuePublicShellDriftSummary" class="queue-ops-pilot__issues-summary">${escapeHtml(
                model.signalSummary
            )}</p>
            <div
                id="queuePublicShellDriftBlockers"
                class="queue-ops-pilot__issues-items"
                role="list"
                aria-label="Bloqueos del shell público"
            >
                ${blockersMarkup}
            </div>
            <p id="queuePublicShellDriftSupport" class="queue-ops-pilot__issues-support">${escapeHtml(
                model.supportCopy
            )}</p>
        </section>
    `.trim();
}

export async function loadTurneroPublicShellHtml(options = {}) {
    const url = toString(options.pageUrl || '/', '/');
    const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutMs = Math.max(1500, Number(options.timeoutMs || 6000));
    const timeoutId = controller
        ? globalThis.setTimeout(() => controller.abort('timeout'), timeoutMs)
        : 0;

    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'text/html,application/xhtml+xml',
            },
            signal: controller?.signal,
        });

        const html = await response.text();

        return {
            ok: response.ok,
            pageStatus: response.status,
            html,
            error: null,
        };
    } catch (error) {
        return {
            ok: false,
            pageStatus: 0,
            html: '',
            error,
        };
    } finally {
        if (timeoutId) {
            globalThis.clearTimeout(timeoutId);
        }
    }
}

export async function mountTurneroPublicShellDriftCard(target, options = {}) {
    if (
        typeof HTMLElement === 'undefined' ||
        !(target instanceof HTMLElement)
    ) {
        return null;
    }

    const result = await loadTurneroPublicShellHtml(options);
    const model = createTurneroPublicShellDriftModel(
        {
            pageOk: result.ok,
            pageStatus: result.pageStatus,
            html: result.html,
        },
        options
    );

    if (result.error) {
        model.blockers.unshift({
            key: 'public_shell_fetch_failed',
            title: 'No se pudo inspeccionar el shell público',
            detail: toString(result.error?.message, 'Fallo leyendo /'),
        });
        model.driftStatus = 'blocked';
        model.driftLabel = 'Bloqueado';
        model.supportCopy =
            'Bloquea la salida hasta que se pueda leer el shell público de forma estable.';
    }

    target.innerHTML = renderTurneroPublicShellDriftCard(model, options);
    const section = target.querySelector('#queuePublicShellDrift');
    if (section instanceof HTMLElement) {
        section.__turneroPublicShellDriftModel = model;
    }

    return section;
}
