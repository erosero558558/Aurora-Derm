import type { TenantConfig } from "../../../packages/core/src/index.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderOpsConsoleShell(tenant: TenantConfig): string {
  const config = JSON.stringify({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    endpoints: {
      cases: `/v1/patient-cases?tenantId=${encodeURIComponent(tenant.id)}`,
      kpi: `/v1/reports/kpi?tenantId=${encodeURIComponent(tenant.id)}`,
      nextBestAction: "/v1/agent-tasks/ops-next-best-action",
      dispatchWorkerDrain: "/v1/copilot/dispatch-worker/drain",
      providerExceptions: `/v1/copilot/provider-exceptions?tenantId=${encodeURIComponent(tenant.id)}`,
      providerExceptionsBase: "/v1/copilot/provider-exceptions",
      copilotBase: `/v1/patient-cases/${encodeURIComponent(tenant.id)}`,
      receiptsBase: "/v1/patient-cases",
      receiptEventsBase: "/v1/patient-cases",
      reviewBase: `/v1/patient-cases/${encodeURIComponent(tenant.id)}`
    }
  });

  return `
<section class="hero">
  <span class="pill">Ops Console</span>
  <div class="row">
    <div>
      <h1>Copilot operativo sobre el caso canónico</h1>
      <p>Esta consola ya consume las rutas canónicas del runtime para leer board, KPI y spotlight del Copilot.</p>
    </div>
    <div class="button-row">
      <button class="button secondary" type="button" data-process-outbox="true">Process outbox</button>
      <button class="button secondary" type="button" data-refresh-board="true">Refresh board</button>
    </div>
  </div>
</section>

<section class="grid">
  <article class="card">
    <div class="stat" id="kpi-active-cases">--</div>
    <p>Casos activos</p>
  </article>
  <article class="card">
    <div class="stat" id="kpi-approvals">--</div>
    <p>Approvals pendientes</p>
  </article>
  <article class="card">
    <div class="stat" id="kpi-follow-up">--</div>
    <p>Follow-up pendiente</p>
  </article>
  <article class="card">
    <div class="stat" id="kpi-waiting">--</div>
    <p>Queue pressure</p>
  </article>
</section>

<section class="grid ops-layout">
  <article class="card ops-spotlight-card">
    <div class="row">
      <div>
        <span class="pill">Copilot Spotlight</span>
        <h2>Siguiente jugada</h2>
      </div>
      <p class="small muted" id="ops-console-status">Loading board...</p>
    </div>
    <div id="ops-copilot-spotlight" data-copilot-ready="true">
      <p class="muted">El Copilot está cargando la recomendación prioritaria del tenant.</p>
    </div>
  </article>

  <article class="card">
    <div class="row">
      <div>
        <span class="pill">Case Board</span>
        <h2>Cases activos</h2>
      </div>
      <p class="small muted">Selecciona un case para inspección detallada.</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Focus</th>
          <th>Patient</th>
          <th>Status</th>
          <th>Delivery</th>
          <th>Open actions</th>
          <th>Approvals</th>
        </tr>
      </thead>
      <tbody id="ops-case-board">
        <tr><td colspan="6" class="muted">Cargando patient cases...</td></tr>
      </tbody>
    </table>
  </article>

  <article class="card">
    <div class="row">
      <div>
        <span class="pill">Provider Exceptions</span>
        <h2>Receipts fallidos</h2>
      </div>
      <p class="small muted">Casos que requieren intervención porque el provider no confirmó entrega.</p>
    </div>
    <div id="ops-provider-exceptions">
      <p class="muted">Cargando exceptions del provider...</p>
    </div>
  </article>
</section>

<script type="module">
  const config = ${config};
  const state = {
    cases: [],
    kpi: null,
    providerExceptions: [],
    inspection: null,
    selectedCaseId: null
  };

  const elements = {
    activeCases: document.getElementById("kpi-active-cases"),
    approvals: document.getElementById("kpi-approvals"),
    followUp: document.getElementById("kpi-follow-up"),
    waiting: document.getElementById("kpi-waiting"),
    caseBoard: document.getElementById("ops-case-board"),
    providerExceptions: document.getElementById("ops-provider-exceptions"),
    spotlight: document.getElementById("ops-copilot-spotlight"),
    status: document.getElementById("ops-console-status")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeInspection(payload) {
    return payload && payload.data ? payload.data : payload;
  }

  function setStatus(message, tone) {
    if (!elements.status) {
      return;
    }
    elements.status.textContent = message;
    elements.status.setAttribute("data-tone", tone || "info");
  }

  async function requestJson(url, init) {
    const response = await fetch(url, init);
    const payload = await response.json();
    if (!response.ok) {
      const message = payload && (payload.message || payload.error)
        ? payload.message || payload.error
        : "Request failed";
      throw new Error(message);
    }
    return payload;
  }

  function renderKpis() {
    const report = state.kpi;
    if (!report) {
      return;
    }
    elements.activeCases.textContent = String(report.activeCases);
    elements.approvals.textContent = String(report.casesRequiringApproval);
    elements.followUp.textContent = String(report.followUpPending);
    elements.waiting.textContent = String((report.waiting || 0) + (report.called || 0));
  }

  function renderCaseBoard() {
    if (!elements.caseBoard) {
      return;
    }
    if (!Array.isArray(state.cases) || state.cases.length === 0) {
      elements.caseBoard.innerHTML = '<tr><td colspan="6" class="muted">No hay patient cases activos en este tenant.</td></tr>';
      return;
    }

    elements.caseBoard.innerHTML = state.cases.map((snapshot) => {
      const isActive = snapshot.case.id === state.selectedCaseId;
      const actionCount = snapshot.case.summary.openActionCount;
      const approvalCount = snapshot.case.summary.pendingApprovalCount;
      const failedReceipts = Array.isArray(snapshot.copilotExecutionReceipts)
        ? snapshot.copilotExecutionReceipts.filter((receipt) => receipt.providerStatus === 'failed').length
        : 0;
      return [
        '<tr class="board-row' + (isActive ? ' is-active' : '') + '">',
        '<td><button class="button ghost" type="button" data-case-id="' + escapeHtml(snapshot.case.id) + '">Open</button></td>',
        '<td><strong>' + escapeHtml(snapshot.patient.displayName) + '</strong><div class="small muted">' + escapeHtml(snapshot.case.id) + '</div></td>',
        '<td>' + escapeHtml(snapshot.case.status) + '</td>',
        '<td>' + escapeHtml(String(failedReceipts)) + '</td>',
        '<td>' + escapeHtml(String(actionCount)) + '</td>',
        '<td>' + escapeHtml(String(approvalCount)) + '</td>',
        '</tr>'
      ].join("");
    }).join("");
  }

  function renderProviderExceptions() {
    if (!elements.providerExceptions) {
      return;
    }

    if (!Array.isArray(state.providerExceptions) || state.providerExceptions.length === 0) {
      elements.providerExceptions.innerHTML = '<p class="muted">No hay exceptions activas de provider.</p>';
      return;
    }

    function humanizeRemediationStatus(status) {
      switch (status) {
        case 'retry_queued':
          return 'Retry queued';
        case 'retry_running':
          return 'Retry running';
        case 'retry_failed':
          return 'Retry failed';
        case 'awaiting_provider_confirmation':
          return 'Awaiting provider confirmation';
        case 'escalated':
          return 'Escalated to staff';
        default:
          return 'Open';
      }
    }

    elements.providerExceptions.innerHTML = '<ul>' + state.providerExceptions.slice(0, 6).map((item) => {
      const externalRef = item.externalRef ? ' · ' + escapeHtml(item.externalRef) : '';
      const error = item.lastProviderError
        ? '<div class="small muted">' + escapeHtml(item.lastProviderError) + '</div>'
        : '';
      const remediationMeta = '<div class="small muted">Status: '
        + escapeHtml(humanizeRemediationStatus(item.remediationStatus || 'open'))
        + (item.currentChannel ? ' · channel ' + escapeHtml(item.currentChannel) : '')
        + (item.remediationChannelOverride ? ' · fallback ' + escapeHtml(item.remediationChannelOverride) : '')
        + '</div>';
      const actions = []
      if (item.canRetry) {
        actions.push(
          '<button class="button ghost" type="button" data-provider-exception-id="'
          + escapeHtml(item.receiptRecordId)
          + '" data-provider-exception-decision="retry_dispatch">Retry</button>'
        );
      }
      if (item.canFallback && item.suggestedFallbackChannel) {
        actions.push(
          '<button class="button ghost" type="button" data-provider-exception-id="'
          + escapeHtml(item.receiptRecordId)
          + '" data-provider-exception-decision="fallback_channel_retry" data-provider-exception-fallback="'
          + escapeHtml(item.suggestedFallbackChannel)
          + '">Fallback to '
          + escapeHtml(item.suggestedFallbackChannel)
          + '</button>'
        );
      }
      if (item.canEscalate) {
        actions.push(
          '<button class="button ghost" type="button" data-provider-exception-id="'
          + escapeHtml(item.receiptRecordId)
          + '" data-provider-exception-decision="escalate_handoff">Escalate</button>'
        );
      }
      const actionRow = actions.length > 0
        ? '<div class="button-row">' + actions.join('') + '</div>'
        : '';
      return '<li><strong>' + escapeHtml(item.patientName) + '</strong>'
        + ' · ' + escapeHtml(item.system)
        + ' · ' + escapeHtml(item.operation)
        + externalRef
        + error
        + remediationMeta
        + actionRow
        + '</li>';
    }).join('') + '</ul>';
  }

  function renderSpotlight() {
    if (!elements.spotlight) {
      return;
    }

    const inspection = state.inspection;
    if (!inspection || !inspection.card || !inspection.snapshot) {
      elements.spotlight.innerHTML = '<p class="muted">Selecciona un case para ver la recomendación estructurada del Copilot.</p>';
      return;
    }

    const card = inspection.card;
    const snapshot = inspection.snapshot;
    const evidence = Array.isArray(card.evidenceLabels) && card.evidenceLabels.length > 0
      ? '<ul>' + card.evidenceLabels.map((label) => '<li>' + escapeHtml(label) + '</li>').join("") + '</ul>'
      : '<p class="muted">Sin evidencia enlazada todavía.</p>';
    const blockers = Array.isArray(card.blockedBy) && card.blockedBy.length > 0
      ? '<ul>' + card.blockedBy.map((label) => '<li>' + escapeHtml(label) + '</li>').join("") + '</ul>'
      : '<p class="muted">Sin bloqueos explícitos.</p>';
    const preparedHistory = Array.isArray(snapshot.preparedActions) && snapshot.preparedActions.length > 0
      ? '<ul>' + snapshot.preparedActions
          .slice()
          .sort((left, right) => right.version - left.version)
          .slice(0, 4)
          .map((item) => '<li>v' + escapeHtml(String(item.version)) + ' · ' + escapeHtml(item.status) + ' · ' + escapeHtml(item.recommendedAction) + '</li>')
          .join("") + '</ul>'
      : '<p class="muted">Sin versiones registradas todavía.</p>';
    const dispatchHistoryItems = Array.isArray(snapshot.preparedActionDispatchJobs)
      ? snapshot.preparedActionDispatchJobs
          .slice()
          .sort((left, right) => {
            const requestedDelta = right.requestedAt.localeCompare(left.requestedAt);
            if (requestedDelta !== 0) {
              return requestedDelta;
            }
            return right.attempt - left.attempt;
          })
      : [];
    const dispatchHistory = dispatchHistoryItems.length > 0
      ? '<ul>' + dispatchHistoryItems.slice(0, 4).map((job) => {
          const preparedVersion = Array.isArray(snapshot.preparedActions)
            ? snapshot.preparedActions.find((item) => item.id === job.preparedActionId)
            : null;
          const versionLabel = preparedVersion ? 'v' + String(preparedVersion.version) : job.preparedActionId;
          const lease = job.leaseOwner ? ' · lease ' + escapeHtml(job.leaseOwner) : '';
          const suffix = job.lastError ? ' · ' + escapeHtml(job.lastError) : '';
          return '<li>' + escapeHtml(versionLabel) + ' · attempt ' + escapeHtml(String(job.attempt)) + ' · ' + escapeHtml(job.trigger) + ' · ' + escapeHtml(job.status) + lease + suffix + '</li>';
        }).join("") + '</ul>'
      : '<p class="muted">Sin dispatch jobs todavía.</p>';
    const receiptLedgerItems = Array.isArray(snapshot.copilotExecutionReceipts)
      ? snapshot.copilotExecutionReceipts
          .slice()
          .sort((left, right) => {
            const recordedDelta = right.recordedAt.localeCompare(left.recordedAt);
            if (recordedDelta !== 0) {
              return recordedDelta;
            }
            return right.id.localeCompare(left.id);
          })
      : [];
    const receiptLedger = receiptLedgerItems.length > 0
      ? '<ul>' + receiptLedgerItems.slice(0, 6).map((record) => {
          const externalRef = record.receipt.externalRef
            ? ' · ' + escapeHtml(record.receipt.externalRef)
            : '';
          const dedupe = record.deduped ? ' · deduped' : '';
          const providerState = record.providerStatus
            ? ' · provider ' + escapeHtml(record.providerStatus)
            : '';
          const providerError = record.lastProviderError
            ? ' · ' + escapeHtml(record.lastProviderError)
            : '';
          return '<li>'
            + escapeHtml(record.receipt.system)
            + ' · '
            + escapeHtml(record.receipt.operation)
            + ' · '
            + escapeHtml(record.receipt.status)
            + ' · attempt '
            + escapeHtml(String(record.attempt))
            + dedupe
            + providerState
            + externalRef
            + providerError
            + '</li>';
        }).join("") + '</ul>'
      : '<p class="muted">Sin receipts externos todavía.</p>';
    const receiptEventItems = Array.isArray(snapshot.copilotExecutionReceiptEvents)
      ? snapshot.copilotExecutionReceiptEvents
          .slice()
          .sort((left, right) => {
            const occurredDelta = right.occurredAt.localeCompare(left.occurredAt);
            if (occurredDelta !== 0) {
              return occurredDelta;
            }
            return right.id.localeCompare(left.id);
          })
      : [];
    const receiptEvents = receiptEventItems.length > 0
      ? '<ul>' + receiptEventItems.slice(0, 6).map((event) => {
          const externalRef = event.externalRef ? ' · ' + escapeHtml(event.externalRef) : '';
          return '<li>'
            + escapeHtml(event.system)
            + ' · '
            + escapeHtml(event.eventType)
            + ' · '
            + escapeHtml(event.providerStatus)
            + externalRef
            + '</li>';
        }).join("") + '</ul>'
      : '<p class="muted">Sin eventos de provider todavía.</p>';
    const latestDispatch = dispatchHistoryItems[0] || null;
    const retryButton = latestDispatch && latestDispatch.status === 'failed' && inspection.preparedAction && inspection.preparedAction.status === 'pending'
      ? '<button class="button secondary" type="button" data-prepared-action-retry="true">Retry execution</button>'
      : '';
    const reviewButtons = Array.isArray(card.reviewOptions)
      ? card.reviewOptions.map((option) => {
          const variant = option.id === "approve"
            ? " primary"
            : option.id === "reject"
              ? " danger"
              : "";
          return '<button class="button' + variant + '" type="button" data-review-decision="' + escapeHtml(option.id) + '">' + escapeHtml(option.label) + '</button>';
        }).join("")
      : "";

    elements.spotlight.innerHTML = [
      '<div class="stack">',
      '<div class="row"><div><h3>' + escapeHtml(card.patientLabel) + '</h3><p class="small muted">Status: ' + escapeHtml(card.statusLabel) + ' · Action: ' + escapeHtml(card.recommendedAction) + '</p><p class="small muted">Prepared action: v' + escapeHtml(String(inspection.preparedAction.version || 1)) + ' · ' + escapeHtml(inspection.preparedAction.status || 'pending') + ' · executions ' + escapeHtml(String(inspection.preparedAction.executionCount || 0)) + '</p></div><span class="pill">' + escapeHtml(card.preparedActionType) + '</span></div>',
      '<div class="spotlight-grid">',
      '<article class="card subtle"><h3>' + escapeHtml(card.blocks.now.title) + '</h3><p>' + escapeHtml(card.blocks.now.body) + '</p></article>',
      '<article class="card subtle"><h3>' + escapeHtml(card.blocks.whyNow.title) + '</h3><p>' + escapeHtml(card.blocks.whyNow.body) + '</p></article>',
      '<article class="card subtle"><h3>' + escapeHtml(card.blocks.riskIfIgnored.title) + '</h3><p>' + escapeHtml(card.blocks.riskIfIgnored.body) + '</p></article>',
      '<article class="card subtle"><h3>' + escapeHtml(card.blocks.preparedAction.title) + '</h3><p>' + escapeHtml(card.blocks.preparedAction.body) + '</p></article>',
      '<article class="card subtle"><h3>' + escapeHtml(card.blocks.humanApproval.title) + '</h3><p>' + escapeHtml(card.blocks.humanApproval.body) + '</p></article>',
      '<article class="card subtle"><h3>Evidencia</h3>' + evidence + '</article>',
      '<article class="card subtle"><h3>Blocked By</h3>' + blockers + '</article>',
      '<article class="card subtle"><h3>Prepared History</h3>' + preparedHistory + '</article>',
      '<article class="card subtle"><h3>Dispatch History</h3>' + dispatchHistory + '</article>',
      '<article class="card subtle"><h3>Delivery Ledger</h3>' + receiptLedger + '</article>',
      '<article class="card subtle"><h3>Provider Events</h3>' + receiptEvents + '</article>',
      '<article class="card subtle"><h3>Case Snapshot</h3><p>Patient: ' + escapeHtml(snapshot.patient.displayName) + '</p><p>Last activity: ' + escapeHtml(snapshot.case.latestActivityAt) + '</p></article>',
      '</div>',
      '<div class="button-row">' + reviewButtons + retryButton + '</div>',
      '</div>'
    ].join("");
  }

  async function loadCase(caseId) {
    if (!caseId) {
      return;
    }
    setStatus('Loading case ' + caseId + '...', 'info');
    const [payload, receiptsPayload, receiptEventsPayload] = await Promise.all([
      requestJson(config.endpoints.copilotBase + '/' + encodeURIComponent(caseId) + '/copilot'),
      requestJson(
        config.endpoints.receiptsBase
          + '/'
          + encodeURIComponent(caseId)
          + '/copilot-receipts?tenantId='
          + encodeURIComponent(config.tenantId)
      ),
      requestJson(
        config.endpoints.receiptEventsBase
          + '/'
          + encodeURIComponent(caseId)
          + '/copilot-receipt-events?tenantId='
          + encodeURIComponent(config.tenantId)
      )
    ]);
    const inspection = normalizeInspection(payload);
    if (inspection && inspection.snapshot) {
      inspection.snapshot.copilotExecutionReceipts = Array.isArray(receiptsPayload.items)
        ? receiptsPayload.items
        : Array.isArray(inspection.snapshot.copilotExecutionReceipts)
          ? inspection.snapshot.copilotExecutionReceipts
          : [];
      inspection.snapshot.copilotExecutionReceiptEvents = Array.isArray(receiptEventsPayload.items)
        ? receiptEventsPayload.items
        : Array.isArray(inspection.snapshot.copilotExecutionReceiptEvents)
          ? inspection.snapshot.copilotExecutionReceiptEvents
          : [];
    }
    state.selectedCaseId = caseId;
    state.inspection = inspection;
    renderCaseBoard();
    renderSpotlight();
    setStatus('Copilot listo para ' + state.inspection.snapshot.patient.displayName + '.', 'success');
  }

  async function loadBoard(preserveSelection) {
    setStatus('Refreshing board...', 'info');
    const [casesPayload, kpiPayload, focusPayload, providerExceptionsPayload] = await Promise.all([
      requestJson(config.endpoints.cases),
      requestJson(config.endpoints.kpi),
      requestJson(config.endpoints.nextBestAction, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: config.tenantId,
          persistTask: false
        })
      }),
      requestJson(config.endpoints.providerExceptions)
    ]);

    state.cases = Array.isArray(casesPayload.items) ? casesPayload.items : [];
    state.kpi = kpiPayload;
    state.providerExceptions = Array.isArray(providerExceptionsPayload.items) ? providerExceptionsPayload.items : [];
    renderKpis();
    renderProviderExceptions();

    const preferredCaseId = preserveSelection && state.selectedCaseId
      ? state.selectedCaseId
      : (focusPayload && focusPayload.patientCaseId)
        ? focusPayload.patientCaseId
        : state.cases[0] && state.cases[0].case
          ? state.cases[0].case.id
          : null;

    if (!preferredCaseId) {
      state.inspection = null;
      renderCaseBoard();
      renderSpotlight();
      setStatus('Board loaded with no active cases.', 'warning');
      return;
    }

    await loadCase(preferredCaseId);
  }

  async function submitReview(decision) {
    if (!state.inspection || !state.selectedCaseId) {
      return;
    }

    const requiresNote = decision === 'reject' || decision === 'snooze';
    const shouldExecute = decision === 'approve' || decision === 'edit_and_run';
    const defaultMessage = state.inspection.preparedAction && state.inspection.preparedAction.messageDraft
      ? state.inspection.preparedAction.messageDraft
      : '';
    const messageOverride = decision === 'edit_and_run'
      ? window.prompt('Edit the prepared copy before running it.', defaultMessage)
      : null;
    const note = requiresNote
      ? window.prompt('Add a short note for ' + decision.replace(/_/g, ' ') + '.', '')
      : '';

    if (requiresNote && !note) {
      setStatus('A note is required for this review decision.', 'warning');
      return;
    }

    if (decision === 'edit_and_run' && messageOverride === null) {
      setStatus('Execution cancelled before applying the edited copy.', 'warning');
      return;
    }

    setStatus(shouldExecute ? 'Recording review and queueing prepared action...' : 'Recording review...', 'info');
    const result = normalizeInspection(await requestJson(config.endpoints.reviewBase + '/' + encodeURIComponent(state.selectedCaseId) + '/copilot/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recommendationAction: state.inspection.recommendation.recommendedAction,
        decision,
        actor: 'ops_console',
        note: note || null,
        preparedActionId: state.inspection.preparedAction ? state.inspection.preparedAction.id : null,
        executeNow: shouldExecute,
        messageOverride: decision === 'edit_and_run'
          ? messageOverride
          : null
      })
    }));

    if (result && result.snapshot) {
      state.inspection = result;
      renderSpotlight();
    }

    await loadBoard(true);
    setStatus(
      shouldExecute
        ? 'Review recorded and dispatch queued as ' + decision + '.'
        : 'Review recorded as ' + decision + '.',
      'success'
    );
  }

  async function submitRetry() {
    if (!state.inspection || !state.selectedCaseId || !state.inspection.preparedAction) {
      return;
    }

    setStatus('Queueing retry for prepared action...', 'info');
    try {
      const result = normalizeInspection(await requestJson(
        config.endpoints.reviewBase
          + '/'
          + encodeURIComponent(state.selectedCaseId)
          + '/prepared-actions/'
          + encodeURIComponent(state.inspection.preparedAction.id)
          + '/retry',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actor: 'ops_console'
          })
        }
      ));

      if (result && result.snapshot) {
        state.inspection = result;
        renderSpotlight();
      }

      await loadBoard(true);
      setStatus('Prepared action retry queued successfully.', 'success');
    } catch (error) {
      await loadCase(state.selectedCaseId);
      throw error;
    }
  }

  async function drainOutbox() {
    setStatus('Processing dispatch outbox...', 'info');
    const payload = await requestJson(config.endpoints.dispatchWorkerDrain, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: config.tenantId,
        workerId: 'ops_console_manual',
        limit: 10
      })
    });
    const data = payload && payload.data ? payload.data : payload;
    await loadBoard(true);
    setStatus(
      'Outbox processed: '
        + String(data.successCount || 0)
        + ' succeeded, '
        + String(data.failureCount || 0)
        + ' failed.',
      data.failureCount > 0 ? 'warning' : 'success'
    );
  }

  async function remediateProviderException(target) {
    const receiptRecordId = target.getAttribute('data-provider-exception-id');
    const decision = target.getAttribute('data-provider-exception-decision');
    const fallbackChannel = target.getAttribute('data-provider-exception-fallback');
    if (!receiptRecordId || !decision) {
      return;
    }

    const payload = normalizeInspection(await requestJson(
      config.endpoints.providerExceptionsBase
        + '/'
        + encodeURIComponent(receiptRecordId)
        + '/remediate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: config.tenantId,
          actor: 'ops_console',
          decision,
          fallbackChannel: fallbackChannel || null
        })
      }
    ));

    await loadBoard(true);
    setStatus(
      payload && payload.dispatchJob
        ? 'Provider remediation queued for dispatch.'
        : 'Provider exception escalated for human handling.',
      'success'
    );
  }

  document.addEventListener('click', async (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-case-id], [data-review-decision], [data-refresh-board], [data-prepared-action-retry], [data-process-outbox], [data-provider-exception-decision]')
      : null;

    if (!target) {
      return;
    }

    try {
      if (target.hasAttribute('data-case-id')) {
        await loadCase(target.getAttribute('data-case-id'));
        return;
      }

      if (target.hasAttribute('data-review-decision')) {
        await submitReview(target.getAttribute('data-review-decision'));
        return;
      }

      if (target.hasAttribute('data-prepared-action-retry')) {
        await submitRetry();
        return;
      }

      if (target.hasAttribute('data-process-outbox')) {
        await drainOutbox();
        return;
      }

      if (target.hasAttribute('data-provider-exception-decision')) {
        await remediateProviderException(target);
        return;
      }

      if (target.hasAttribute('data-refresh-board')) {
        await loadBoard(Boolean(state.selectedCaseId));
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unexpected ops console error.', 'warning');
    }
  });

  void loadBoard(false).catch((error) => {
    renderCaseBoard();
    renderSpotlight();
    setStatus(error instanceof Error ? error.message : 'Unexpected ops console error.', 'warning');
  });
  window.setInterval(() => {
    void loadBoard(Boolean(state.selectedCaseId)).catch((error) => {
      setStatus(error instanceof Error ? error.message : 'Unexpected ops console error.', 'warning');
    });
  }, 15000);
</script>`;
}

export function renderOpsConsoleApiHint(tenant: TenantConfig): string {
  return [
    '<ul>',
    '<li><code>' + escapeHtml(`/v1/patient-cases?tenantId=${tenant.id}`) + '</code></li>',
    '<li><code>' + escapeHtml(`/v1/reports/kpi?tenantId=${tenant.id}`) + '</code></li>',
    '<li><code>/v1/agent-tasks/ops-next-best-action</code></li>',
    '<li><code>' + escapeHtml(`/v1/copilot/provider-exceptions?tenantId=${tenant.id}`) + '</code></li>',
    '<li><code>/v1/patient-cases/' + escapeHtml(tenant.id) + '/:caseId/copilot</code></li>',
    '<li><code>' + escapeHtml(`/v1/patient-cases/:caseId/copilot-receipts?tenantId=${tenant.id}`) + '</code></li>',
    '<li><code>' + escapeHtml(`/v1/patient-cases/:caseId/copilot-receipt-events?tenantId=${tenant.id}`) + '</code></li>',
    '<li><code>/v1/copilot/receipts/webhook</code></li>',
    '<li><code>/v1/copilot/dispatch-worker/drain</code></li>',
    '</ul>'
  ].join("");
}
