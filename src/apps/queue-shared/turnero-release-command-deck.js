import {
    copyToClipboardSafe,
    downloadJsonSnapshot,
} from './turnero-release-control-center.js';
import {
    buildTurneroReleaseCheckpointMarkdown,
    buildTurneroReleaseCheckpointStats,
    clearTurneroReleaseCheckpointScheduler,
    readTurneroReleaseCheckpointScheduler,
    resetTurneroReleaseCheckpointScheduler,
    updateTurneroReleaseCheckpoint,
} from './turnero-release-checkpoint-scheduler.js';
import {
    appendTurneroReleaseShiftHandoffNote,
    buildTurneroReleaseShiftHandoff,
    buildTurneroReleaseShiftHandoffMarkdown,
    clearTurneroReleaseShiftHandoffNotes,
} from './turnero-release-shift-handoff.js';
import {
    buildTurneroReleaseTimeline,
    buildTurneroReleaseTimelineMarkdown,
} from './turnero-release-timeline.js';

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

function checkpointBadge(status) {
    if (status === 'done') return 'Hecho';
    if (status === 'working') return 'Trabajando';
    if (status === 'skipped') return 'Saltado';
    return 'Pendiente';
}

function timelineColumnsHtml(timeline) {
    const windows = timeline?.windows || {};
    const ordered = ['ahora', '15m', '30m', 'siguiente-turno'];
    return ordered
        .map((windowKey) => {
            const items = toArray(windows[windowKey]);
            return `
      <article class="turnero-release-command-deck__timeline-column" data-window="${escapeHtml(
          windowKey
      )}">
        <header>
          <span class="turnero-release-command-deck__section-label">${escapeHtml(
              windowKey
          )}</span>
          <strong>${escapeHtml(items.length)}</strong>
        </header>
        ${
            items.length
                ? `<ul>${items
                      .slice(0, 6)
                      .map(
                          (step) => `
          <li>
            <strong>${escapeHtml(step.ownerLabel)}</strong>
            <p>${escapeHtml(step.title)}</p>
            <small>${escapeHtml(step.severity)} · ${escapeHtml(
                step.nextCheck
            )}</small>
          </li>
        `
                      )
                      .join('')}</ul>`
                : '<p>Sin pasos.</p>'
        }
      </article>
    `;
        })
        .join('');
}

function checkpointsHtml(checkpoints) {
    if (!checkpoints.length) {
        return '<p class="turnero-release-command-deck__muted">Sin checkpoints.</p>';
    }

    return `
    <ul class="turnero-release-command-deck__checkpoint-list">
      ${checkpoints
          .map(
              (checkpoint) => `
        <li class="turnero-release-command-deck__checkpoint-item" data-status="${escapeHtml(
            checkpoint.status
        )}">
          <div>
            <strong>${escapeHtml(checkpoint.title)}</strong>
            <p>${escapeHtml(checkpoint.owner)} · ${escapeHtml(
                checkpoint.dueLabel || checkpoint.window
            )}</p>
            <small>${escapeHtml(checkpoint.notes || 'Sin nota')}</small>
          </div>
          <div class="turnero-release-command-deck__checkpoint-actions">
            <span>${escapeHtml(checkpointBadge(checkpoint.status))}</span>
            <button type="button" data-checkpoint-action="working" data-checkpoint-id="${escapeHtml(
                checkpoint.id
            )}">Working</button>
            <button type="button" data-checkpoint-action="done" data-checkpoint-id="${escapeHtml(
                checkpoint.id
            )}">Done</button>
            <button type="button" data-checkpoint-action="skip" data-checkpoint-id="${escapeHtml(
                checkpoint.id
            )}">Skip</button>
          </div>
        </li>
      `
          )
          .join('')}
    </ul>
  `;
}

function notesHtml(notes) {
    if (!notes.length) {
        return '<p class="turnero-release-command-deck__muted">Sin notas de relevo.</p>';
    }

    return `
    <ul class="turnero-release-command-deck__note-list">
      ${notes
          .slice(0, 6)
          .map(
              (entry) => `
        <li>
          <strong>${escapeHtml(entry.shift || 'actual')}</strong>
          <p>${escapeHtml(entry.note || 'Sin nota')}</p>
          <small>${escapeHtml(entry.author || 'local')} · ${escapeHtml(
              entry.at || ''
          )}</small>
        </li>
      `
          )
          .join('')}
    </ul>
  `;
}

function buildHtml(model) {
    const stats = buildTurneroReleaseCheckpointStats(model.checkpoints);
    return `
    <section class="turnero-release-command-deck" data-decision="${escapeHtml(
        model.handoff?.decision || 'review'
    )}">
      <header class="turnero-release-command-deck__header">
        <div>
          <span class="turnero-release-command-deck__kicker">Release Command Deck</span>
          <h3 class="turnero-release-command-deck__title">${escapeHtml(
              model.handoff?.clinicId || 'default-clinic'
          )}</h3>
          <p class="turnero-release-command-deck__subtitle">${escapeHtml(
              model.handoff?.decision || 'review'
          )} — ${escapeHtml(model.handoff?.decisionReason || '')}</p>
        </div>
        <div class="turnero-release-command-deck__meta">
          <span>Fingerprint: ${escapeHtml(
              model.handoff?.profileFingerprint || 'sin fingerprint'
          )}</span>
          <span>Pasos: ${escapeHtml(model.timeline?.stepCount || 0)}</span>
          <span>Checkpoints done: ${escapeHtml(stats.done || 0)}/${escapeHtml(
              stats.total || 0
          )}</span>
        </div>
      </header>

      <div class="turnero-release-command-deck__actions">
        <button type="button" data-global-action="copy-timeline">Copiar timeline</button>
        <button type="button" data-global-action="copy-checkpoints">Copiar checkpoints</button>
        <button type="button" data-global-action="copy-handoff">Copiar handoff</button>
        <button type="button" data-global-action="download-pack">Descargar pack</button>
        <button type="button" data-global-action="reset-checkpoints">Reset checkpoints</button>
        <button type="button" data-global-action="clear-checkpoints">Limpiar checkpoints</button>
        <button type="button" data-global-action="add-note">Agregar nota</button>
        <button type="button" data-global-action="clear-notes">Limpiar notas</button>
      </div>

      <div class="turnero-release-command-deck__summary">
        <span class="turnero-release-command-deck__pill">Pending ${escapeHtml(
            stats.pending || 0
        )}</span>
        <span class="turnero-release-command-deck__pill">Working ${escapeHtml(
            stats.working || 0
        )}</span>
        <span class="turnero-release-command-deck__pill">Done ${escapeHtml(
            stats.done || 0
        )}</span>
        <span class="turnero-release-command-deck__pill">Skipped ${escapeHtml(
            stats.skipped || 0
        )}</span>
      </div>

      <div class="turnero-release-command-deck__timeline-grid">
        ${timelineColumnsHtml(model.timeline)}
      </div>

      <div class="turnero-release-command-deck__body-grid">
        <article>
          <span class="turnero-release-command-deck__section-label">Checkpoint scheduler</span>
          ${checkpointsHtml(model.checkpoints)}
        </article>
        <article>
          <span class="turnero-release-command-deck__section-label">Shift handoff</span>
          ${notesHtml(model.handoff?.notes || [])}
        </article>
      </div>
    </section>
  `;
}

function readNoteInput() {
    if (typeof prompt !== 'function') {
        return { note: '', shift: '', author: '' };
    }
    const note = String(
        prompt('Nota de relevo para el siguiente turno:') || ''
    ).trim();
    const shift = String(
        prompt('Turno / ventana (ej. guardia noche, siguiente turno):') || ''
    ).trim();
    const author = String(prompt('Autor local:') || '').trim();
    return { note, shift, author };
}

async function handleGlobalAction(action, model, rerender) {
    const clinicId = model.handoff?.clinicId || 'default-clinic';

    if (action === 'copy-timeline') {
        await copyToClipboardSafe(
            buildTurneroReleaseTimelineMarkdown(model.timeline)
        );
        return rerender();
    }

    if (action === 'copy-checkpoints') {
        await copyToClipboardSafe(
            buildTurneroReleaseCheckpointMarkdown(clinicId, model.checkpoints)
        );
        return rerender();
    }

    if (action === 'copy-handoff') {
        await copyToClipboardSafe(
            buildTurneroReleaseShiftHandoffMarkdown(model.handoff)
        );
        return rerender();
    }

    if (action === 'download-pack') {
        downloadJsonSnapshot('turnero-release-command-deck.json', {
            timeline: model.timeline,
            checkpoints: model.checkpoints,
            handoff: model.handoff,
            timelineMarkdown: buildTurneroReleaseTimelineMarkdown(
                model.timeline
            ),
            checkpointMarkdown: buildTurneroReleaseCheckpointMarkdown(
                clinicId,
                model.checkpoints
            ),
            handoffMarkdown: buildTurneroReleaseShiftHandoffMarkdown(
                model.handoff
            ),
        });
        return rerender();
    }

    if (action === 'reset-checkpoints') {
        resetTurneroReleaseCheckpointScheduler(clinicId, model.timeline);
        return rerender();
    }

    if (action === 'clear-checkpoints') {
        clearTurneroReleaseCheckpointScheduler(clinicId);
        return rerender();
    }

    if (action === 'add-note') {
        const input = readNoteInput();
        if (input.note) {
            appendTurneroReleaseShiftHandoffNote(clinicId, input);
        }
        return rerender();
    }

    if (action === 'clear-notes') {
        clearTurneroReleaseShiftHandoffNotes(clinicId);
        return rerender();
    }

    return rerender();
}

async function handleCheckpointAction(action, checkpointId, model, rerender) {
    const clinicId = model.handoff?.clinicId || 'default-clinic';
    if (!checkpointId) return rerender();

    if (action === 'working') {
        updateTurneroReleaseCheckpoint(
            clinicId,
            checkpointId,
            { status: 'working' },
            model.timeline
        );
    } else if (action === 'done') {
        updateTurneroReleaseCheckpoint(
            clinicId,
            checkpointId,
            { status: 'done' },
            model.timeline
        );
    } else if (action === 'skip') {
        updateTurneroReleaseCheckpoint(
            clinicId,
            checkpointId,
            { status: 'skipped' },
            model.timeline
        );
    }

    return rerender();
}

export function renderTurneroReleaseCommandDeck(
    target,
    parts = {},
    options = {}
) {
    if (!target) return null;
    const doc = ensureDocument();

    function computeModel() {
        const timeline = buildTurneroReleaseTimeline(parts, options);
        const clinicId = timeline?.clinicId || 'default-clinic';
        const checkpoints = readTurneroReleaseCheckpointScheduler(
            clinicId,
            timeline
        );
        const handoff = buildTurneroReleaseShiftHandoff(parts, options);
        return {
            timeline,
            checkpoints,
            handoff,
        };
    }

    function rerender() {
        const model = computeModel();
        if (!doc) return model;

        const host = doc.createElement('div');
        host.className = 'turnero-release-command-deck-host';
        host.innerHTML = buildHtml(model);

        target.innerHTML = '';
        target.appendChild(host);

        Array.from(host.querySelectorAll('[data-global-action]')).forEach(
            (button) => {
                button.addEventListener('click', async () => {
                    await handleGlobalAction(
                        button.getAttribute('data-global-action'),
                        model,
                        rerender
                    );
                });
            }
        );

        Array.from(host.querySelectorAll('[data-checkpoint-action]')).forEach(
            (button) => {
                button.addEventListener('click', async () => {
                    await handleCheckpointAction(
                        button.getAttribute('data-checkpoint-action'),
                        button.getAttribute('data-checkpoint-id'),
                        model,
                        rerender
                    );
                });
            }
        );

        return model;
    }

    return rerender();
}
