export function renderQueueOpsAlertsView(manifest, detectedPlatform, deps) {
    const {
        buildQueueOpsAlerts,
        setHtml,
        escapeHtml,
        formatDateTime,
        markOpsAlertsReviewed,
        appendOpsLogEntry,
        getInstallPresetLabel,
        renderQueueOpsAlerts,
        renderQueueOpsLog,
        setOpsAlertReviewed,
    } = deps;
    const root = document.getElementById('queueOpsAlerts');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const alertState = buildQueueOpsAlerts(manifest, detectedPlatform);
    setHtml(
        '#queueOpsAlerts',
        `
            <section class="queue-ops-alerts__shell" data-state="${escapeHtml(alertState.tone)}">
                <div class="queue-ops-alerts__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Prioridad viva</p>
                        <h5 id="queueOpsAlertsTitle" class="queue-app-card__title">${escapeHtml(
                            alertState.title
                        )}</h5>
                        <p id="queueOpsAlertsSummary" class="queue-ops-alerts__summary">${escapeHtml(
                            alertState.summary
                        )}</p>
                    </div>
                    <div class="queue-ops-alerts__meta">
                        <span id="queueOpsAlertsChipTotal" class="queue-ops-alerts__chip">
                            Alertas ${escapeHtml(String(alertState.alerts.length))}
                        </span>
                        <span id="queueOpsAlertsChipPending" class="queue-ops-alerts__chip">
                            Pendientes ${escapeHtml(String(alertState.pendingCount))}
                        </span>
                        <span id="queueOpsAlertsChipReviewed" class="queue-ops-alerts__chip" data-state="${escapeHtml(
                            alertState.reviewedCount > 0 ? 'reviewed' : 'idle'
                        )}">
                            Revisadas ${escapeHtml(String(alertState.reviewedCount))}
                        </span>
                        <button
                            id="queueOpsAlertsApplyBtn"
                            type="button"
                            class="queue-ops-alerts__action queue-ops-alerts__action--primary"
                            ${alertState.pendingCount > 0 ? '' : 'disabled'}
                        >
                            Marcar visibles revisadas
                        </button>
                    </div>
                </div>
                <div id="queueOpsAlertsItems" class="queue-ops-alerts__list" role="list" aria-label="Alertas activas por equipo">
                    ${
                        alertState.alerts.length > 0
                            ? alertState.alerts
                                  .map(
                                      (alert) => `
                                        <article
                                            id="queueOpsAlert_${escapeHtml(alert.id)}"
                                            class="queue-ops-alerts__item"
                                            data-state="${escapeHtml(alert.tone)}"
                                            data-reviewed="${alert.reviewed ? 'true' : 'false'}"
                                            role="listitem"
                                        >
                                            <div class="queue-ops-alerts__item-head">
                                                <div class="queue-ops-alerts__item-copy">
                                                    <span class="queue-ops-alerts__scope">${escapeHtml(
                                                        alert.scope
                                                    )}</span>
                                                    <strong>${escapeHtml(alert.title)}</strong>
                                                </div>
                                                <div class="queue-ops-alerts__item-meta">
                                                    <span class="queue-ops-alerts__severity">${escapeHtml(
                                                        alert.tone === 'alert'
                                                            ? 'Critica'
                                                            : 'Revisar'
                                                    )}</span>
                                                    ${
                                                        alert.reviewed
                                                            ? `<span class="queue-ops-alerts__reviewed">Revisada ${escapeHtml(
                                                                  formatDateTime(
                                                                      alert.reviewedAt
                                                                  )
                                                              )}</span>`
                                                            : ''
                                                    }
                                                </div>
                                            </div>
                                            <p class="queue-ops-alerts__item-summary">${escapeHtml(
                                                alert.summary
                                            )}</p>
                                            <p class="queue-ops-alerts__item-note">${escapeHtml(
                                                alert.meta
                                            )}</p>
                                            <div class="queue-ops-alerts__actions">
                                                <a
                                                    href="${escapeHtml(alert.href)}"
                                                    class="queue-ops-alerts__action queue-ops-alerts__action--primary"
                                                    target="_blank"
                                                    rel="noopener"
                                                >
                                                    ${escapeHtml(alert.actionLabel)}
                                                </a>
                                                <button
                                                    id="queueOpsAlertReview_${escapeHtml(alert.id)}"
                                                    type="button"
                                                    class="queue-ops-alerts__action"
                                                    data-queue-alert-review="${escapeHtml(alert.id)}"
                                                    data-review-state="${alert.reviewed ? 'clear' : 'review'}"
                                                >
                                                    ${escapeHtml(
                                                        alert.reviewed
                                                            ? 'Marcar pendiente otra vez'
                                                            : 'Marcar revisada'
                                                    )}
                                                </button>
                                            </div>
                                        </article>
                                    `
                                  )
                                  .join('')
                            : `
                                <article class="queue-ops-alerts__empty" role="listitem">
                                    <strong>Sin prioridades abiertas</strong>
                                    <p>La telemetría actual no muestra incidentes ni observaciones activas en cola, operador, kiosco o sala.</p>
                                </article>
                            `
                    }
                </div>
            </section>
        `
    );

    const applyButton = document.getElementById('queueOpsAlertsApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            const pendingIds = alertState.alerts
                .filter((alert) => !alert.reviewed)
                .map((alert) => alert.id);
            if (!pendingIds.length) {
                return;
            }
            markOpsAlertsReviewed(pendingIds);
            appendOpsLogEntry({
                tone: alertState.criticalCount > 0 ? 'warning' : 'info',
                source: 'incident',
                title: `Alertas revisadas: ${pendingIds.length}`,
                summary: `Se marcaron como revisadas las alertas visibles del turno. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueOpsAlerts(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-queue-alert-review]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const alertId = String(
                button.dataset.queueAlertReview || ''
            ).trim();
            const targetAlert = alertState.alerts.find(
                (alert) => alert.id === alertId
            );
            if (!targetAlert) {
                return;
            }
            const shouldReview = button.dataset.reviewState !== 'clear';
            setOpsAlertReviewed(alertId, shouldReview);
            appendOpsLogEntry({
                tone: shouldReview ? 'info' : 'warning',
                source: 'incident',
                title: `${shouldReview ? 'Alerta revisada' : 'Alerta reabierta'}: ${targetAlert.scope}`,
                summary: shouldReview
                    ? `${targetAlert.title}. Sigue visible hasta que la condición se resuelva.`
                    : `${targetAlert.title}. La alerta vuelve al tablero pendiente del turno.`,
            });
            renderQueueOpsAlerts(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    });
}
