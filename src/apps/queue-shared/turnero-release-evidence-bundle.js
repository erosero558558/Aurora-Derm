function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeObject(value) {
    return isPlainObject(value) ? value : {};
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function shortCommit(value) {
    const normalized = toString(value);
    return normalized ? normalized.slice(0, 8) : '';
}

function joinDetails(parts) {
    return parts.filter(Boolean).join(' · ');
}

function countAvailabilitySlots(data) {
    if (Array.isArray(data)) {
        return {
            days: data.length,
            slots: data.reduce(
                (count, value) =>
                    count + (Array.isArray(value) ? value.length : 0),
                0
            ),
        };
    }

    const normalized = normalizeObject(data);
    let days = 0;
    let slots = 0;

    for (const value of Object.values(normalized)) {
        if (!Array.isArray(value)) {
            continue;
        }

        days += 1;
        slots += value.length;
    }

    return { days, slots };
}

function countBookedSlots(data) {
    return Array.isArray(data) ? data.length : 0;
}

function normalizeState(value, fallback = 'unknown') {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();
    if (!normalized) {
        return fallback;
    }

    if (
        ['ready', 'ok', 'healthy', 'verified', 'pass', 'listo'].includes(
            normalized
        )
    ) {
        return 'ready';
    }

    if (
        ['blocked', 'error', 'critical', 'fail', 'bloqueado'].includes(
            normalized
        )
    ) {
        return 'blocked';
    }

    if (['warning', 'warn', 'fallback', 'degraded'].includes(normalized)) {
        return 'warning';
    }

    return normalized;
}

function buildSummaryLabel(state, fallback = 'sin dato') {
    const normalized = normalizeState(state, 'unknown');
    if (normalized === 'ready') {
        return 'listo';
    }
    if (normalized === 'blocked') {
        return 'bloqueado';
    }
    if (normalized === 'warning') {
        return 'advertencia';
    }
    return fallback;
}

function mapBlockers(source, lane) {
    return Array.isArray(source?.blockers)
        ? source.blockers.map((item, index) => ({
              lane,
              key: toString(item?.key, `${lane}_blocker_${index + 1}`),
              title: toString(item?.title, 'Bloqueo'),
              detail: toString(item?.detail, ''),
          }))
        : [];
}

function createLocalSummary(localReadinessModel = {}) {
    const readyCount = Number(localReadinessModel?.readySurfaceCount || 0);
    const totalCount = Number(localReadinessModel?.totalSurfaceCount || 0);
    const state = normalizeState(
        localReadinessModel?.openingPackageState ||
            localReadinessModel?.openingPackageStatus ||
            localReadinessModel?.state,
        readyCount && totalCount && readyCount >= totalCount
            ? 'ready'
            : 'warning'
    );

    return {
        state,
        label: buildSummaryLabel(state),
        readyCount,
        totalCount,
        clinicName: toString(
            localReadinessModel?.clinicName || localReadinessModel?.brandName
        ),
        clinicId: toString(localReadinessModel?.clinicId),
        profileFingerprint: toString(localReadinessModel?.profileFingerprint),
        releaseMode: toString(localReadinessModel?.releaseMode),
        runtimeSource: toString(localReadinessModel?.runtimeSource),
        blockers: mapBlockers(localReadinessModel, 'local'),
    };
}

function createRemoteSummary(remoteReleaseModel = {}) {
    const state = normalizeState(
        remoteReleaseModel?.releaseStatus ||
            remoteReleaseModel?.status ||
            remoteReleaseModel?.finalState,
        Array.isArray(remoteReleaseModel?.blockers) &&
            remoteReleaseModel.blockers.length > 0
            ? 'blocked'
            : 'ready'
    );

    return {
        state,
        label: buildSummaryLabel(state),
        clinicId: toString(
            remoteReleaseModel?.expectedClinicId || remoteReleaseModel?.clinicId
        ),
        profileFingerprint: toString(
            remoteReleaseModel?.expectedProfileFingerprint ||
                remoteReleaseModel?.profileFingerprint
        ),
        deployedCommit: toString(
            remoteReleaseModel?.deployedCommit ||
                remoteReleaseModel?.publicSync?.deployedCommit
        ),
        publicSyncLabel: toString(
            remoteReleaseModel?.publicSyncLabel ||
                remoteReleaseModel?.publicSync?.label
        ),
        diagnosticsLabel: toString(
            remoteReleaseModel?.diagnosticsLabel ||
                remoteReleaseModel?.diagnostics?.label
        ),
        figoLabel: toString(
            remoteReleaseModel?.figoLabel || remoteReleaseModel?.figo?.label
        ),
        sourceHealthLabel: toString(
            remoteReleaseModel?.sourceHealthLabel ||
                remoteReleaseModel?.sourceHealth?.label
        ),
        blockers: mapBlockers(remoteReleaseModel, 'remote'),
    };
}

function createShellSummary(publicShellDriftModel = {}) {
    const state = normalizeState(
        publicShellDriftModel?.driftStatus || publicShellDriftModel?.status,
        Array.isArray(publicShellDriftModel?.blockers) &&
            publicShellDriftModel.blockers.length > 0
            ? 'blocked'
            : 'ready'
    );

    return {
        state,
        label: buildSummaryLabel(state),
        pageStatus: toString(publicShellDriftModel?.pageStatus),
        stylesheetHref: toString(publicShellDriftModel?.stylesheetHref),
        shellScriptSrc: toString(publicShellDriftModel?.shellScriptSrc),
        inlineExecutableScripts: Number(
            publicShellDriftModel?.inlineExecutableScripts || 0
        ),
        blockers: mapBlockers(publicShellDriftModel, 'shell'),
    };
}

export function createTurneroReleaseEvidenceBundleModel(
    snapshot = {},
    options = {}
) {
    const local = createLocalSummary(snapshot?.localReadinessModel);
    const remote = createRemoteSummary(snapshot?.remoteReleaseModel);
    const shell = createShellSummary(snapshot?.publicShellDriftModel);
    const blockers = [...local.blockers, ...remote.blockers, ...shell.blockers];
    const finalState = blockers.length
        ? 'blocked'
        : [local.state, remote.state, shell.state].includes('warning')
          ? 'warning'
          : 'ready';
    const finalDecision = finalState === 'ready' ? 'ready' : 'blocked';
    const timestampIso = (() => {
        if (
            options.timestamp instanceof Date &&
            !Number.isNaN(options.timestamp.getTime())
        ) {
            return options.timestamp.toISOString();
        }

        const parsed = options.timestamp
            ? new Date(options.timestamp)
            : new Date();
        return Number.isNaN(parsed.getTime())
            ? new Date().toISOString()
            : parsed.toISOString();
    })();
    const clinicName = toString(
        options.clinicName || local.clinicName,
        'Piel en Armonía'
    );
    const clinicId = toString(
        options.clinicId || local.clinicId || remote.clinicId
    );
    const profileFingerprint = toString(
        options.profileFingerprint ||
            local.profileFingerprint ||
            remote.profileFingerprint
    );
    const releaseMode = toString(
        options.releaseMode || local.releaseMode,
        'unknown'
    );
    const origin = toString(
        options.origin ||
            options.baseUrl ||
            (typeof window !== 'undefined' && window.location
                ? window.location.origin
                : '')
    );
    const nativeWaveLabel = toString(
        options.nativeWaveLabel,
        'ola nativa posterior'
    );

    return {
        timestampIso,
        origin,
        clinicName,
        clinicId,
        profileFingerprint,
        releaseMode,
        local,
        remote,
        shell,
        blockers,
        finalState,
        finalDecision,
        finalLabel:
            finalState === 'ready'
                ? 'listo para salida'
                : finalState === 'warning'
                  ? 'salida condicionada'
                  : 'bloqueado',
        deferredToNativeWave: finalDecision !== 'ready',
        nativeWaveLabel,
        blockerCount: blockers.length,
    };
}

export function serializeTurneroReleaseEvidenceBundle(
    modelOrSnapshot,
    options = {}
) {
    const model = modelOrSnapshot?.finalDecision
        ? modelOrSnapshot
        : createTurneroReleaseEvidenceBundleModel(modelOrSnapshot, options);

    return {
        timestamp_iso: model.timestampIso,
        origin: model.origin,
        clinic_name: model.clinicName,
        clinic_id: model.clinicId,
        profile_fingerprint: model.profileFingerprint,
        release_mode: model.releaseMode,
        final_state: model.finalState,
        final_decision: model.finalDecision,
        deferred_to_native_wave: model.deferredToNativeWave,
        native_wave_label: model.nativeWaveLabel,
        blocker_count: model.blockerCount,
        local: {
            state: model.local.state,
            ready_count: model.local.readyCount,
            total_count: model.local.totalCount,
            runtime_source: model.local.runtimeSource,
        },
        remote: {
            state: model.remote.state,
            deployed_commit: model.remote.deployedCommit,
            public_sync: model.remote.publicSyncLabel,
            diagnostics: model.remote.diagnosticsLabel,
            figo: model.remote.figoLabel,
            sources: model.remote.sourceHealthLabel,
        },
        shell: {
            state: model.shell.state,
            page_status: model.shell.pageStatus,
            stylesheet_href: model.shell.stylesheetHref,
            shell_script_src: model.shell.shellScriptSrc,
            inline_executable_scripts: model.shell.inlineExecutableScripts,
        },
        blockers: model.blockers.map((item) => ({
            lane: item.lane,
            key: item.key,
            title: item.title,
            detail: item.detail,
        })),
    };
}

export function toTurneroReleaseEvidenceMarkdown(
    modelOrSnapshot,
    options = {}
) {
    const model = modelOrSnapshot?.finalDecision
        ? modelOrSnapshot
        : createTurneroReleaseEvidenceBundleModel(modelOrSnapshot, options);

    const blockersLines = model.blockers.length
        ? model.blockers
              .map(
                  (item) =>
                      `- [${item.lane}] ${item.title}: ${item.detail || 'sin detalle'}`
              )
              .join('\n')
        : '- Sin bloqueos consolidados';

    return [
        '# Turnero web pilot - evidencia de salida',
        '',
        `- timestamp: ${model.timestampIso}`,
        `- origin: ${model.origin || 'unknown'}`,
        `- clínica: ${model.clinicName}`,
        `- clinic_id: ${model.clinicId || 'unknown'}`,
        `- profileFingerprint: ${model.profileFingerprint || 'unknown'}`,
        `- releaseMode: ${model.releaseMode || 'unknown'}`,
        `- decisión final: ${model.finalDecision}`,
        `- estado visible: ${model.finalLabel}`,
        `- bloqueos: ${model.blockerCount}`,
        '',
        '## Local',
        `- estado: ${model.local.label}`,
        `- superficies listas: ${model.local.readyCount}/${model.local.totalCount || '0'}`,
        `- runtime source: ${model.local.runtimeSource || 'unknown'}`,
        '',
        '## Remoto',
        `- estado: ${model.remote.label}`,
        `- deployed commit: ${model.remote.deployedCommit || 'unknown'}`,
        `- public sync: ${model.remote.publicSyncLabel || 'unknown'}`,
        `- diagnostics: ${model.remote.diagnosticsLabel || 'unknown'}`,
        `- figo: ${model.remote.figoLabel || 'unknown'}`,
        `- sources: ${model.remote.sourceHealthLabel || 'unknown'}`,
        '',
        '## Shell público',
        `- estado: ${model.shell.label}`,
        `- GET / status: ${model.shell.pageStatus || 'unknown'}`,
        `- stylesheet: ${model.shell.stylesheetHref || 'unknown'}`,
        `- shell script: ${model.shell.shellScriptSrc || 'unknown'}`,
        `- inline executable scripts: ${model.shell.inlineExecutableScripts}`,
        '',
        '## Bloqueos',
        blockersLines,
        '',
        model.deferredToNativeWave
            ? `## Nota\n- Salida diferida a ${model.nativeWaveLabel}.`
            : '## Nota\n- Corte listo sin diferimiento a ola nativa.',
        '',
    ].join('\n');
}

function downloadTextFile(
    filename,
    content,
    contentType = 'application/json;charset=utf-8'
) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function copyText(content) {
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        return true;
    }

    const textArea = document.createElement('textarea');
    textArea.value = content;
    textArea.setAttribute('readonly', 'readonly');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    textArea.remove();
    return Boolean(success);
}

function renderBlockers(model) {
    if (!model.blockers.length) {
        return '<p class="admin-queue-release-evidence__ok">Sin bloqueos consolidados. El corte se ve alineado.</p>';
    }

    return `<ul class="admin-queue-release-evidence__blockers">${model.blockers
        .map(
            (item) =>
                `<li><strong>Bloquea:</strong> ${escapeHtml(item.title)} <em>(${escapeHtml(
                    item.lane
                )})</em><br><span>${escapeHtml(
                    item.detail || 'sin detalle'
                )}</span></li>`
        )
        .join('')}</ul>`;
}

export function renderTurneroReleaseEvidenceBundleCard(
    modelOrSnapshot,
    options = {}
) {
    const model = modelOrSnapshot?.finalDecision
        ? modelOrSnapshot
        : createTurneroReleaseEvidenceBundleModel(modelOrSnapshot, options);

    return `
<section class="admin-queue-release-evidence" data-state="${escapeHtml(
        model.finalState
    )}">
  <header class="admin-queue-release-evidence__header">
    <p class="admin-queue-release-evidence__eyebrow">Decisión final del corte</p>
    <h3>Evidencia de salida del piloto</h3>
    <p class="admin-queue-release-evidence__subtitle">${escapeHtml(
        model.finalLabel
    )}</p>
  </header>
  <dl class="admin-queue-release-evidence__summary">
    <div><dt>clínica</dt><dd>${escapeHtml(model.clinicName)}</dd></div>
    <div><dt>clinic_id</dt><dd>${escapeHtml(model.clinicId || 'unknown')}</dd></div>
    <div><dt>fingerprint</dt><dd>${escapeHtml(
        model.profileFingerprint || 'unknown'
    )}</dd></div>
    <div><dt>releaseMode</dt><dd>${escapeHtml(
        model.releaseMode || 'unknown'
    )}</dd></div>
    <div><dt>local</dt><dd>${escapeHtml(
        `${model.local.label} · ${model.local.readyCount}/${model.local.totalCount || 0}`
    )}</dd></div>
    <div><dt>remoto</dt><dd>${escapeHtml(model.remote.label)}</dd></div>
    <div><dt>shell</dt><dd>${escapeHtml(model.shell.label)}</dd></div>
    <div><dt>bloqueos</dt><dd>${escapeHtml(String(model.blockerCount))}</dd></div>
  </dl>
  <div class="admin-queue-release-evidence__body">
    ${renderBlockers(model)}
  </div>
  <div class="admin-queue-release-evidence__actions">
    <button type="button" class="admin-queue-release-evidence__button" data-action="copy-markdown">Copiar resumen</button>
    <button type="button" class="admin-queue-release-evidence__button" data-action="download-json">Descargar JSON</button>
  </div>
  <p class="admin-queue-release-evidence__footnote">${escapeHtml(
      model.deferredToNativeWave
          ? `Si persisten bloqueos, la salida sigue diferida a ${model.nativeWaveLabel}.`
          : 'Sin diferimiento a ola nativa.'
  )}</p>
</section>`.trim();
}

export function mountTurneroReleaseEvidenceBundleCard(
    target,
    modelOrSnapshot,
    options = {}
) {
    if (!(target instanceof HTMLElement)) {
        return null;
    }

    const model = modelOrSnapshot?.finalDecision
        ? modelOrSnapshot
        : createTurneroReleaseEvidenceBundleModel(modelOrSnapshot, options);

    target.innerHTML = renderTurneroReleaseEvidenceBundleCard(model, options);
    const root = target.querySelector('.admin-queue-release-evidence');
    if (!root) {
        return null;
    }

    const jsonPayload = JSON.stringify(
        serializeTurneroReleaseEvidenceBundle(model, options),
        null,
        2
    );
    const markdownPayload = toTurneroReleaseEvidenceMarkdown(model, options);
    const fileNamePrefix = toString(
        options.fileNamePrefix,
        'turnero-release-evidence'
    );
    const safeClinicId = toString(model.clinicId, 'unknown')
        .replace(/[^a-z0-9_-]+/gi, '-')
        .toLowerCase();
    const safeTimestamp = model.timestampIso.replace(/[:.]/g, '-');

    root.addEventListener('click', async (event) => {
        const actionButton =
            event.target instanceof Element
                ? event.target.closest('button[data-action]')
                : null;

        if (
            !(actionButton instanceof HTMLElement) ||
            !root.contains(actionButton)
        ) {
            return;
        }

        const action = actionButton.getAttribute('data-action');
        if (!action) {
            return;
        }

        if (action === 'copy-markdown') {
            const originalLabel = actionButton.textContent;
            try {
                await copyText(markdownPayload);
                actionButton.textContent = 'Copiado';
            } catch (_error) {
                actionButton.textContent = 'No se pudo copiar';
            } finally {
                window.setTimeout(() => {
                    actionButton.textContent = originalLabel;
                }, 1600);
            }
            return;
        }

        if (action === 'download-json') {
            downloadTextFile(
                `${fileNamePrefix}-${safeClinicId}-${safeTimestamp}.json`,
                `${jsonPayload}\n`
            );
        }
    });

    return root;
}
