import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
} from './turnero-release-control-center.js';
import { appendTurneroIncidentJournalEntries } from './turnero-release-incident-journal.js';
import { buildTurneroReleaseEscalationMatrix } from './turnero-release-escalation-matrix.js';
import {
    buildTurneroReleaseOwnershipBoard,
    buildTurneroOwnerBrief,
    buildTurneroOwnershipMarkdown,
} from './turnero-release-ownership-board.js';
import { toReleaseControlCenterSnapshot } from './turnero-remediation-playbook.js';
import {
    buildTurneroReleaseOwnerStateStats,
    clearTurneroReleaseOwnerLaneState,
    clearTurneroReleaseOwnerState,
    readTurneroReleaseOwnerState,
    updateTurneroReleaseOwnerLaneState,
} from './turnero-release-owner-state.js';

function ensureDocument() {
    return typeof document !== 'undefined' ? document : null;
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function resolveTarget(target) {
    if (typeof target === 'string') {
        const doc = ensureDocument();
        if (!doc) {
            return null;
        }

        return doc.querySelector(target) || doc.getElementById(target);
    }

    return target;
}

function stageLabel(value) {
    if (value === 'escalate-now') return 'Escalar ahora';
    if (value === 'active-incident') return 'Incidente activo';
    if (value === 'watch') return 'Vigilar';
    return 'Estable';
}

function statusLabel(value) {
    if (value === 'done') return 'Hecho';
    if (value === 'working') return 'Trabajando';
    if (value === 'blocked') return 'Bloqueado';
    return 'Pendiente';
}

function buildOwnerNote(board, owner, action) {
    const lane =
        toArray(board?.lanes).find((item) => item?.owner === owner) || {};
    const titles = toArray(lane.incidents)
        .slice(0, 2)
        .map((incident) => incident?.title)
        .filter(Boolean);
    const prefix = lane.label || owner;

    if (action === 'ack') {
        return titles.length
            ? `Ack en ${prefix}: ${titles.join(' · ')}`
            : `Ack en ${prefix}`;
    }

    if (action === 'working') {
        return titles.length
            ? `Trabajando ${prefix}: ${titles.join(' · ')}`
            : `Trabajando ${prefix}`;
    }

    if (action === 'blocked') {
        return titles.length
            ? `Bloqueado en ${prefix}: ${titles[0]}`
            : `Bloqueado en ${prefix}`;
    }

    if (action === 'done') {
        return `Cerrado ${prefix} · ${board?.decisionReason || 'sin bloqueos visibles'}`;
    }

    return lane.note || '';
}

function renderLaneHtml(lane) {
    const incidents = toArray(lane.incidents);
    const commands = toArray(lane.commands).slice(0, 3);
    const docs = toArray(lane.docs).slice(0, 3);

    return `
        <article
            class="turnero-release-war-room__lane"
            data-owner="${escapeHtml(lane.owner)}"
            data-stage="${escapeHtml(lane.stage)}"
            data-status="${escapeHtml(lane.laneStatus)}"
        >
            <header class="turnero-release-war-room__lane-header">
                <div>
                    <span class="turnero-release-war-room__lane-owner">${escapeHtml(
                        lane.label
                    )}</span>
                    <h4 class="turnero-release-war-room__lane-stage">${escapeHtml(
                        stageLabel(lane.stage)
                    )}</h4>
                </div>
                <div class="turnero-release-war-room__lane-meta">
                    <span>Prioridad: ${escapeHtml(lane.priority)}</span>
                    <span>Ventana: ${escapeHtml(lane.nextWindow)}</span>
                    <span>Estado: ${escapeHtml(statusLabel(lane.laneStatus))}</span>
                </div>
            </header>

            <div class="turnero-release-war-room__lane-summary">
                <span class="turnero-release-war-room__pill">B ${escapeHtml(
                    lane.summary?.blocker || 0
                )}</span>
                <span class="turnero-release-war-room__pill">W ${escapeHtml(
                    lane.summary?.warning || 0
                )}</span>
                <span class="turnero-release-war-room__pill">I ${escapeHtml(
                    lane.summary?.info || 0
                )}</span>
                <span class="turnero-release-war-room__pill">Repite ${escapeHtml(
                    lane.repeatedCount || 0
                )}</span>
            </div>

            <p class="turnero-release-war-room__lane-target">
                Escalar con: <strong>${escapeHtml(lane.escalationTarget)}</strong>
            </p>
            <p class="turnero-release-war-room__lane-note">
                Nota: ${escapeHtml(lane.note || 'sin nota local')}
            </p>

            <div class="turnero-release-war-room__lane-actions">
                <button type="button" data-owner-action="ack" data-owner="${escapeHtml(
                    lane.owner
                )}">Ack</button>
                <button type="button" data-owner-action="working" data-owner="${escapeHtml(
                    lane.owner
                )}">Working</button>
                <button type="button" data-owner-action="blocked" data-owner="${escapeHtml(
                    lane.owner
                )}">Blocked</button>
                <button type="button" data-owner-action="done" data-owner="${escapeHtml(
                    lane.owner
                )}">Done</button>
                <button type="button" data-owner-action="clear" data-owner="${escapeHtml(
                    lane.owner
                )}">Clear</button>
                <button type="button" data-owner-action="copy-brief" data-owner="${escapeHtml(
                    lane.owner
                )}">Copiar brief</button>
            </div>

            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Incidentes</span>
                ${
                    incidents.length
                        ? `<ul>${incidents
                              .slice(0, 4)
                              .map(
                                  (incident) =>
                                      `<li>[${escapeHtml(
                                          incident.severity
                                      )}] ${escapeHtml(incident.title)}</li>`
                              )
                              .join('')}</ul>`
                        : '<p>Sin incidentes.</p>'
                }
            </div>

            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Comandos</span>
                ${
                    commands.length
                        ? `<ul>${commands
                              .map(
                                  (command) =>
                                      `<li><code>${escapeHtml(command)}</code></li>`
                              )
                              .join('')}</ul>`
                        : '<p>Sin comandos sugeridos.</p>'
                }
            </div>

            <div class="turnero-release-war-room__lane-block">
                <span class="turnero-release-war-room__section-label">Docs</span>
                ${
                    docs.length
                        ? `<ul>${docs
                              .map((doc) => `<li>${escapeHtml(doc)}</li>`)
                              .join('')}</ul>`
                        : '<p>Sin docs sugeridos.</p>'
                }
            </div>
        </article>
    `;
}

function buildGlobalSummaryHtml(matrix, ownerStateStats) {
    const summary = matrix?.summary || {};
    return `
        <div class="turnero-release-war-room__global-summary">
            <span class="turnero-release-war-room__pill">Escalar ahora ${escapeHtml(
                summary.escalateNow || 0
            )}</span>
            <span class="turnero-release-war-room__pill">Activos ${escapeHtml(
                summary.active || 0
            )}</span>
            <span class="turnero-release-war-room__pill">Watch ${escapeHtml(
                summary.watch || 0
            )}</span>
            <span class="turnero-release-war-room__pill">Ack ${escapeHtml(
                ownerStateStats.acknowledged || 0
            )}/${escapeHtml(ownerStateStats.total || 0)}</span>
            <span class="turnero-release-war-room__pill">Done ${escapeHtml(
                ownerStateStats.done || 0
            )}</span>
            <span class="turnero-release-war-room__pill">Blocked ${escapeHtml(
                ownerStateStats.blocked || 0
            )}</span>
        </div>
    `;
}

function buildEscalationMarkdown(matrix) {
    const header = [
        `# Escalation Matrix — ${String(matrix?.clinicId || 'default-clinic')}`,
        '',
        `- Fingerprint: ${matrix?.profileFingerprint || 'sin fingerprint'}`,
        `- Generado: ${matrix?.generatedAt || new Date().toISOString()}`,
        `- Decisión: ${matrix?.decision || 'review'}`,
        '',
    ];

    const body = toArray(matrix?.lanes).flatMap((lane, index) => [
        `## ${index + 1}. ${lane.label}`,
        `- Stage: ${lane.stage}`,
        `- Target: ${lane.escalationTarget}`,
        `- Ventana: ${lane.nextWindow}`,
        `- Estado local: ${lane.laneStatus}`,
        `- Ack: ${lane.acknowledged ? 'sí' : 'no'}`,
        `- Repeticiones: ${lane.repeatedCount || 0}`,
        `- Resumen: blocker=${lane.summary?.blocker || 0}, warning=${
            lane.summary?.warning || 0
        }, info=${lane.summary?.info || 0}`,
        lane.note ? `- Nota: ${lane.note}` : '- Nota: sin nota local',
        lane.commands.length
            ? `- Comandos: ${lane.commands.join(' | ')}`
            : '- Comandos: sin comandos',
        lane.docs.length
            ? `- Docs: ${lane.docs.join(' | ')}`
            : '- Docs: sin docs',
        '',
    ]);

    return [...header, ...body].join('\n').trim();
}

function buildHtml(model) {
    return `
        <section class="turnero-release-war-room" data-decision="${escapeHtml(
            model.board?.decision || 'review'
        )}">
            <header class="turnero-release-war-room__header">
                <div>
                    <span class="turnero-release-war-room__kicker">Release War Room</span>
                    <h3 class="turnero-release-war-room__title">${escapeHtml(
                        model.board?.clinicId || 'default-clinic'
                    )}</h3>
                    <p class="turnero-release-war-room__subtitle">${escapeHtml(
                        model.board?.decision || 'review'
                    )} — ${escapeHtml(model.board?.decisionReason || '')}</p>
                </div>
                <div class="turnero-release-war-room__meta">
                    <span>Fingerprint: ${escapeHtml(
                        model.board?.profileFingerprint || 'sin fingerprint'
                    )}</span>
                    <span>Generado: ${escapeHtml(model.board?.generatedAt || '')}</span>
                </div>
            </header>

            ${buildGlobalSummaryHtml(model.matrix, model.ownerStateStats)}

            <div class="turnero-release-war-room__global-actions">
                <button type="button" data-global-action="copy-board">Copiar board</button>
                <button type="button" data-global-action="copy-escalation">Copiar escalación</button>
                <button type="button" data-global-action="download-pack">Descargar pack</button>
                <button type="button" data-global-action="clear-owner-state">Limpiar owner state</button>
            </div>

            <div class="turnero-release-war-room__lanes">
                ${toArray(model.matrix?.lanes)
                    .map((lane) => renderLaneHtml(lane))
                    .join('')}
            </div>
        </section>
    `;
}

function buildOwnerBriefs(board, ownerState) {
    return Object.fromEntries(
        toArray(board?.lanes).map((lane) => [
            lane.owner,
            buildTurneroOwnerBrief(board, lane.owner, ownerState),
        ])
    );
}

export function buildTurneroReleaseWarRoomModel(parts = {}) {
    const controlCenter = toReleaseControlCenterSnapshot(parts);
    const ownerState = readTurneroReleaseOwnerState(controlCenter.clinicId);
    const board = buildTurneroReleaseOwnershipBoard(controlCenter, {
        ownerState,
    });
    const journalEntries = appendTurneroIncidentJournalEntries(
        controlCenter.clinicId,
        toArray(board?.lanes).flatMap((lane) => lane.incidents)
    );
    const matrix = buildTurneroReleaseEscalationMatrix(controlCenter, {
        journalEntries,
        ownerState,
        decision: board?.decision,
    });
    const ownerStateStats = buildTurneroReleaseOwnerStateStats(ownerState);
    const boardMarkdown = buildTurneroOwnershipMarkdown(board);
    const escalationMarkdown = buildEscalationMarkdown(matrix);
    const ownerBriefs = buildOwnerBriefs(board, ownerState);
    const pack = {
        generatedAt: new Date().toISOString(),
        clinicId: board?.clinicId,
        profileFingerprint: board?.profileFingerprint,
        decision: board?.decision,
        decisionReason: board?.decisionReason,
        controlCenterSnapshot: controlCenter,
        board,
        matrix,
        ownerState,
        ownerStateStats,
        journalEntries,
        ownerBriefs,
        boardMarkdown,
        escalationMarkdown,
    };

    return {
        clinicId: board?.clinicId,
        profileFingerprint: board?.profileFingerprint,
        controlCenter,
        ownerState,
        ownerStateStats,
        board,
        matrix,
        journalEntries,
        ownerBriefs,
        boardMarkdown,
        escalationMarkdown,
        pack,
    };
}

function handleGlobalAction(action, model) {
    if (action === 'copy-board') {
        return copyToClipboardSafe(model.boardMarkdown);
    }

    if (action === 'copy-escalation') {
        return copyToClipboardSafe(model.escalationMarkdown);
    }

    if (action === 'download-pack') {
        return downloadJsonSnapshot(
            'turnero-release-war-room.json',
            model.pack
        );
    }

    if (action === 'clear-owner-state') {
        return clearTurneroReleaseOwnerState(model.clinicId);
    }

    return false;
}

function handleOwnerAction(action, owner, model) {
    if (action === 'copy-brief') {
        return copyToClipboardSafe(
            model.ownerBriefs[owner] ||
                buildTurneroOwnerBrief(model.board, owner, model.ownerState)
        );
    }

    if (action === 'ack') {
        updateTurneroReleaseOwnerLaneState(model.clinicId, owner, {
            acknowledged: true,
            status: 'pending',
            note: buildOwnerNote(model.board, owner, action),
            updatedBy: 'turnero-release-war-room',
        });
        return true;
    }

    if (action === 'working') {
        updateTurneroReleaseOwnerLaneState(model.clinicId, owner, {
            acknowledged: true,
            status: 'working',
            note: buildOwnerNote(model.board, owner, action),
            updatedBy: 'turnero-release-war-room',
        });
        return true;
    }

    if (action === 'blocked') {
        updateTurneroReleaseOwnerLaneState(model.clinicId, owner, {
            acknowledged: true,
            status: 'blocked',
            note: buildOwnerNote(model.board, owner, action),
            updatedBy: 'turnero-release-war-room',
        });
        return true;
    }

    if (action === 'done') {
        updateTurneroReleaseOwnerLaneState(model.clinicId, owner, {
            acknowledged: true,
            status: 'done',
            note: buildOwnerNote(model.board, owner, action),
            updatedBy: 'turnero-release-war-room',
        });
        return true;
    }

    if (action === 'clear') {
        clearTurneroReleaseOwnerLaneState(model.clinicId, owner);
        return true;
    }

    return false;
}

function bindActions(host, model, rerender) {
    Array.from(host.querySelectorAll('[data-global-action]')).forEach(
        (button) => {
            button.addEventListener('click', async () => {
                const action = button.getAttribute('data-global-action');
                const ok = await handleGlobalAction(action, model);
                button.dataset.state = ok ? 'done' : 'error';
                if (action === 'clear-owner-state') {
                    rerender();
                }
            });
        }
    );

    Array.from(host.querySelectorAll('[data-owner-action]')).forEach(
        (button) => {
            button.addEventListener('click', async () => {
                const owner = button.getAttribute('data-owner') || 'unknown';
                const action = button.getAttribute('data-owner-action');
                const ok = await handleOwnerAction(action, owner, model);
                button.dataset.state = ok ? 'done' : 'error';
                if (action !== 'copy-brief') {
                    rerender();
                }
            });
        }
    );
}

export function renderTurneroReleaseWarRoom(target, parts = {}, _options = {}) {
    const host = resolveTarget(target);
    const model = buildTurneroReleaseWarRoomModel(parts);

    if (!host) {
        return model;
    }

    const rerender = () => {
        const nextModel = buildTurneroReleaseWarRoomModel(parts);
        host.innerHTML = buildHtml(nextModel);
        bindActions(host, nextModel, rerender);
        return nextModel;
    };

    host.innerHTML = buildHtml(model);
    bindActions(host, model, rerender);
    return model;
}

export function mountTurneroReleaseWarRoom(target, parts = {}, options = {}) {
    return renderTurneroReleaseWarRoom(target, parts, options);
}
