import type {
  ClinicDashboardProjection,
  PatientFlowLinkProjection,
  TenantConfig,
  WaitRoomDisplayProjection
} from "../../../packages/core/src/index.js";
import { renderOpsConsoleApiHint, renderOpsConsoleShell } from "../../ops-console/src/index.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
}

function renderList(items: string[], fallback: string): string {
  return items.length > 0 ? items.join("") : `<li class="muted">${escapeHtml(fallback)}</li>`;
}

function layout(title: string, tenant: TenantConfig | null, body: string): string {
  const brandColor = tenant?.brandColor ?? "#0f172a";
  const brandName = tenant?.name ?? "Patient Flow OS";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        --brand: ${brandColor};
        --ink: #0f172a;
        --muted: #475569;
        --surface: #f8fafc;
        --line: #dbe4ee;
        --card: #ffffff;
      }
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 45%, #ffffff 100%); color: var(--ink); }
      header { padding: 20px 28px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,0.92); position: sticky; top: 0; backdrop-filter: blur(10px); }
      header strong { color: var(--brand); }
      main { padding: 24px 28px 40px; max-width: 1120px; margin: 0 auto; }
      h1, h2, h3 { margin: 0 0 12px; }
      p { color: var(--muted); line-height: 1.5; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
      .card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.05); }
      .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; background: color-mix(in srgb, var(--brand) 12%, white); color: var(--brand); font-size: 12px; font-weight: 700; margin-bottom: 10px; }
      ul { padding-left: 18px; color: var(--muted); }
      code { background: #e2e8f0; padding: 2px 6px; border-radius: 6px; }
      a { color: var(--brand); text-decoration: none; }
      .hero { margin-bottom: 24px; }
      .stat { font-size: 32px; font-weight: 800; color: var(--brand); }
      .stack { display: grid; gap: 12px; }
      .row { display: flex; justify-content: space-between; gap: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .mono { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; }
      .small { font-size: 12px; }
      .muted { color: var(--muted); }
      .subtle { background: color-mix(in srgb, var(--brand) 4%, white); border-style: dashed; box-shadow: none; }
      .button-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      .button { appearance: none; border: 1px solid var(--line); border-radius: 999px; background: white; color: var(--ink); padding: 10px 14px; font: inherit; font-weight: 700; cursor: pointer; transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease; }
      .button:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08); border-color: color-mix(in srgb, var(--brand) 30%, var(--line)); }
      .button.primary { background: var(--brand); color: white; border-color: var(--brand); }
      .button.secondary { background: color-mix(in srgb, var(--brand) 10%, white); color: var(--brand); border-color: color-mix(in srgb, var(--brand) 25%, var(--line)); }
      .button.danger { background: #fff1f2; color: #be123c; border-color: #fecdd3; }
      .button.ghost { padding: 8px 12px; }
      .ops-layout { align-items: start; }
      .ops-spotlight-card { min-height: 420px; }
      .spotlight-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
      .board-row.is-active { background: color-mix(in srgb, var(--brand) 8%, white); }
      .surface-status { min-width: 180px; text-align: right; }
      [data-tone="success"] { color: #166534; }
      [data-tone="warning"] { color: #b45309; }
      [data-tone="info"] { color: var(--muted); }
      @media (max-width: 720px) {
        header { padding: 18px 20px; }
        main { padding: 20px; }
        .row { flex-direction: column; align-items: flex-start; }
        .surface-status { text-align: left; }
      }
    </style>
  </head>
  <body>
    <header><strong>${brandName}</strong> · patientCase-first runtime</header>
    <main>${body}</main>
  </body>
</html>`;
}

export function renderHomePage(tenants: TenantConfig[]): string {
  const links = tenants.map((tenant) => `<li><a href="/ops/${tenant.slug}">${tenant.name}</a> · <code>${tenant.id}</code></li>`).join("");
  return layout("Patient Flow OS", null, `<section class="hero"><span class="pill">patientCase-first</span><h1>Patient Flow OS</h1><p>El runtime nuevo opera alrededor de un caso operativo vivo, no alrededor de tablas sueltas.</p></section><section class="grid"><article class="card"><h2>Surfaces</h2><ul><li>Ops Console</li><li>Patient Flow Link</li><li>Wait Room Display</li><li>Clinic Dashboard</li></ul></article><article class="card"><h2>Tenants seed</h2><ul>${links}</ul></article><article class="card"><h2>API</h2><ul><li><code>/v1/patient-cases</code></li><li><code>/v1/reports/kpi</code></li><li><code>/v1/surfaces/patient-flow</code></li><li><code>/v1/surfaces/wait-room</code></li><li><code>/v1/surfaces/dashboard</code></li></ul></article></section>`);
}

export function renderOpsConsole(tenant: TenantConfig): string {
  return layout("Ops Console", tenant, `${renderOpsConsoleShell(tenant)}<section class="card"><h2>Canonical API</h2><p class="muted">Este shell se hidrata leyendo las superficies oficiales del runtime.</p>${renderOpsConsoleApiHint(tenant)}</section>`);
}

function renderPatientFlowApprovals(projection: PatientFlowLinkProjection): string {
  return renderList(
    projection.pendingApprovals.map(
      (approval) => `<li><strong>${escapeHtml(approval.type)}</strong><div class="small muted">${escapeHtml(approval.reason)}</div></li>`
    ),
    "No pending approvals."
  );
}

function renderPatientFlowActions(projection: PatientFlowLinkProjection): string {
  return renderList(
    projection.openActions.map(
      (action) => `<li><strong>${escapeHtml(action.title)}</strong><div class="small muted">${escapeHtml(action.status)} · ${escapeHtml(action.channel)}</div></li>`
    ),
    "No open actions."
  );
}

function renderPatientFlowTimeline(projection: PatientFlowLinkProjection): string {
  return renderList(
    projection.recentTimeline.map(
      (event) => `<li><strong>${escapeHtml(event.title)}</strong><div class="small muted">${escapeHtml(event.createdAt)}</div></li>`
    ),
    "No timeline activity yet."
  );
}

function renderWaitRoomWaitingList(projection: WaitRoomDisplayProjection): string {
  return renderList(
    projection.waiting.map(
      (item) => `<li><strong>${escapeHtml(item.ticketNumber)}</strong> · ${escapeHtml(item.patientName)}<div class="small muted">${escapeHtml(item.serviceLine ?? "No service line yet")}</div></li>`
    ),
    "No patients waiting right now."
  );
}

function renderDashboardRecentCases(projection: ClinicDashboardProjection): string {
  return renderList(
    projection.recentCases.map(
      (item) => `<li><strong>${escapeHtml(item.patientName)}</strong> · ${escapeHtml(item.status)}<div class="small muted">${escapeHtml(item.serviceLine ?? "No service line yet")}</div></li>`
    ),
    "No recent cases yet."
  );
}

function renderDashboardAttentionCases(projection: ClinicDashboardProjection): string {
  return renderList(
    projection.attentionCases.map(
      (item) => `<li><strong>${escapeHtml(item.patientName)}</strong><div class="small muted">${escapeHtml(item.reason)}</div></li>`
    ),
    "No active attention cases."
  );
}

export function renderPatientFlowLink(tenant: TenantConfig, projection: PatientFlowLinkProjection): string {
  const endpoint = `/v1/surfaces/patient-flow?tenantId=${encodeURIComponent(projection.tenantId)}&caseId=${encodeURIComponent(projection.caseId)}`;
  return layout("Patient Flow Link", tenant, `<section class="hero"><span class="pill">Patient Flow Link</span><div class="row"><div><h1 id="pfl-patient-name">${escapeHtml(projection.patientName)}</h1><p id="pfl-next-step">${escapeHtml(projection.nextStep)}</p></div><p class="small muted surface-status" id="pfl-refresh-status">Live case projection ready.</p></div></section><section class="grid"><article class="card"><h2>Case</h2><div class="stack"><div class="row"><strong>ID</strong><span class="mono" id="pfl-case-id">${escapeHtml(projection.caseId)}</span></div><div class="row"><strong>Status</strong><span id="pfl-case-status">${escapeHtml(projection.caseStatus)}</span></div><div class="row"><strong>Service</strong><span id="pfl-service-line">${escapeHtml(projection.serviceLine ?? "Pending")}</span></div><div class="row"><strong>Provider</strong><span id="pfl-provider-name">${escapeHtml(projection.providerName ?? "Pending")}</span></div><div class="row"><strong>Updated</strong><span class="small muted" id="pfl-updated-at">${escapeHtml(projection.lastUpdatedAt)}</span></div></div></article><article class="card"><h2>Queue</h2><p><strong>Ticket:</strong> <span id="pfl-queue-ticket">${escapeHtml(projection.liveQueue?.ticketNumber ?? "Not assigned yet")}</span></p><p><strong>Status:</strong> <span id="pfl-queue-status">${escapeHtml(projection.liveQueue?.status ?? "Pending check-in")}</span></p></article><article class="card"><h2>Approvals</h2><ul id="pfl-approvals">${renderPatientFlowApprovals(projection)}</ul></article></section><section class="grid"><article class="card"><h2>Open actions</h2><ul id="pfl-actions">${renderPatientFlowActions(projection)}</ul></article><article class="card"><h2>Recent timeline</h2><ul id="pfl-timeline">${renderPatientFlowTimeline(projection)}</ul></article></section><script type="module">
  const endpoint = ${scriptJson(endpoint)};
  const initialProjection = ${scriptJson(projection)};
  const elements = {
    patientName: document.getElementById("pfl-patient-name"),
    nextStep: document.getElementById("pfl-next-step"),
    caseId: document.getElementById("pfl-case-id"),
    caseStatus: document.getElementById("pfl-case-status"),
    serviceLine: document.getElementById("pfl-service-line"),
    providerName: document.getElementById("pfl-provider-name"),
    updatedAt: document.getElementById("pfl-updated-at"),
    queueTicket: document.getElementById("pfl-queue-ticket"),
    queueStatus: document.getElementById("pfl-queue-status"),
    approvals: document.getElementById("pfl-approvals"),
    actions: document.getElementById("pfl-actions"),
    timeline: document.getElementById("pfl-timeline"),
    status: document.getElementById("pfl-refresh-status")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderList(target, items, fallback) {
    if (!target) return;
    target.innerHTML = Array.isArray(items) && items.length > 0
      ? items.join("")
      : '<li class="muted">' + escapeHtml(fallback) + '</li>';
  }

  function renderProjection(view) {
    if (!view) return;
    elements.patientName.textContent = view.patientName;
    elements.nextStep.textContent = view.nextStep;
    elements.caseId.textContent = view.caseId;
    elements.caseStatus.textContent = view.caseStatus;
    elements.serviceLine.textContent = view.serviceLine || 'Pending';
    elements.providerName.textContent = view.providerName || 'Pending';
    elements.updatedAt.textContent = view.lastUpdatedAt;
    elements.queueTicket.textContent = view.liveQueue ? view.liveQueue.ticketNumber : 'Not assigned yet';
    elements.queueStatus.textContent = view.liveQueue ? view.liveQueue.status : 'Pending check-in';
    renderList(elements.approvals, (view.pendingApprovals || []).map((approval) => '<li><strong>' + escapeHtml(approval.type) + '</strong><div class="small muted">' + escapeHtml(approval.reason) + '</div></li>'), 'No pending approvals.');
    renderList(elements.actions, (view.openActions || []).map((action) => '<li><strong>' + escapeHtml(action.title) + '</strong><div class="small muted">' + escapeHtml(action.status) + ' · ' + escapeHtml(action.channel) + '</div></li>'), 'No open actions.');
    renderList(elements.timeline, (view.recentTimeline || []).map((event) => '<li><strong>' + escapeHtml(event.title) + '</strong><div class="small muted">' + escapeHtml(event.createdAt) + '</div></li>'), 'No timeline activity yet.');
  }

  async function refreshProjection(silent) {
    try {
      const response = await fetch(endpoint);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload && (payload.message || payload.error) ? payload.message || payload.error : 'Request failed');
      }
      renderProjection(payload.item);
      if (elements.status) {
        elements.status.textContent = silent ? 'Projection refreshed automatically.' : 'Projection refreshed.';
        elements.status.setAttribute('data-tone', 'success');
      }
    } catch (error) {
      if (elements.status) {
        elements.status.textContent = error instanceof Error ? error.message : 'Surface refresh failed.';
        elements.status.setAttribute('data-tone', 'warning');
      }
    }
  }

  renderProjection(initialProjection);
  void refreshProjection(true);
  window.setInterval(() => { void refreshProjection(true); }, 15000);
</script>`);
}

export function renderWaitRoomDisplay(tenant: TenantConfig, projection: WaitRoomDisplayProjection): string {
  const endpoint = `/v1/surfaces/wait-room?tenantId=${encodeURIComponent(projection.tenantId)}&locationId=${encodeURIComponent(projection.locationId)}`;
  return layout("Wait Room Display", tenant, `<section class="hero"><span class="pill">Wait Room Display</span><div class="row"><div><h1 id="wrd-room-name">${escapeHtml(projection.waitingRoomName)}</h1><p id="wrd-room-subtitle">Queue depth <strong>${projection.queueDepth}</strong> for ${escapeHtml(projection.locationName)}.</p></div><p class="small muted surface-status" id="wrd-refresh-status">Wait room board ready.</p></div></section><section class="grid"><article class="card"><h2>Llamando ahora</h2><div class="stat" id="wrd-now-ticket">${escapeHtml(projection.nowCalling?.ticketNumber ?? "--")}</div><p id="wrd-now-patient">${escapeHtml(projection.nowCalling?.patientName ?? "Sin llamado activo")}</p></article><article class="card"><h2>Queue depth</h2><div class="stat" id="wrd-depth">${projection.queueDepth}</div><p class="small muted" id="wrd-updated-at">${escapeHtml(projection.lastUpdatedAt)}</p></article><article class="card"><h2>Esperando</h2><ul id="wrd-waiting-list">${renderWaitRoomWaitingList(projection)}</ul></article></section><script type="module">
  const endpoint = ${scriptJson(endpoint)};
  const initialProjection = ${scriptJson(projection)};
  const elements = {
    roomName: document.getElementById("wrd-room-name"),
    subtitle: document.getElementById("wrd-room-subtitle"),
    nowTicket: document.getElementById("wrd-now-ticket"),
    nowPatient: document.getElementById("wrd-now-patient"),
    depth: document.getElementById("wrd-depth"),
    updatedAt: document.getElementById("wrd-updated-at"),
    waitingList: document.getElementById("wrd-waiting-list"),
    status: document.getElementById("wrd-refresh-status")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderList(target, items, fallback) {
    if (!target) return;
    target.innerHTML = Array.isArray(items) && items.length > 0
      ? items.join("")
      : '<li class="muted">' + escapeHtml(fallback) + '</li>';
  }

  function renderProjection(view) {
    if (!view) return;
    elements.roomName.textContent = view.waitingRoomName;
    elements.subtitle.innerHTML = 'Queue depth <strong>' + escapeHtml(String(view.queueDepth)) + '</strong> for ' + escapeHtml(view.locationName) + '.';
    elements.nowTicket.textContent = view.nowCalling ? view.nowCalling.ticketNumber : '--';
    elements.nowPatient.textContent = view.nowCalling ? view.nowCalling.patientName : 'Sin llamado activo';
    elements.depth.textContent = String(view.queueDepth);
    elements.updatedAt.textContent = view.lastUpdatedAt;
    renderList(elements.waitingList, (view.waiting || []).map((item) => '<li><strong>' + escapeHtml(item.ticketNumber) + '</strong> · ' + escapeHtml(item.patientName) + '<div class="small muted">' + escapeHtml(item.serviceLine || 'No service line yet') + '</div></li>'), 'No patients waiting right now.');
  }

  async function refreshProjection(silent) {
    try {
      const response = await fetch(endpoint);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload && (payload.message || payload.error) ? payload.message || payload.error : 'Request failed');
      }
      renderProjection(payload.item);
      if (elements.status) {
        elements.status.textContent = silent ? 'Wait room refreshed automatically.' : 'Wait room refreshed.';
        elements.status.setAttribute('data-tone', 'success');
      }
    } catch (error) {
      if (elements.status) {
        elements.status.textContent = error instanceof Error ? error.message : 'Surface refresh failed.';
        elements.status.setAttribute('data-tone', 'warning');
      }
    }
  }

  renderProjection(initialProjection);
  void refreshProjection(true);
  window.setInterval(() => { void refreshProjection(true); }, 10000);
</script>`);
}

export function renderClinicDashboard(tenant: TenantConfig, projection: ClinicDashboardProjection): string {
  const endpoint = `/v1/surfaces/dashboard?tenantId=${encodeURIComponent(projection.tenantId)}`;
  return layout("Clinic Dashboard", tenant, `<section class="hero"><span class="pill">Clinic Dashboard</span><div class="row"><div><h1>KPIs operativos</h1><p>La lectura diaria del tenant sale del estado consolidado del caso.</p></div><p class="small muted surface-status" id="cd-refresh-status">Dashboard ready.</p></div></section><section class="grid"><article class="card"><div class="stat" id="cd-active">${projection.kpi.activeCases}</div><p>Casos activos</p></article><article class="card"><div class="stat" id="cd-waiting">${projection.kpi.waiting}</div><p>Esperando</p></article><article class="card"><div class="stat" id="cd-no-show">${projection.kpi.noShow}</div><p>No-show</p></article><article class="card"><div class="stat" id="cd-follow-up">${projection.kpi.followUpPending}</div><p>Follow-up pendiente</p></article></section><section class="grid"><article class="card"><h2>Recent cases</h2><ul id="cd-recent-cases">${renderDashboardRecentCases(projection)}</ul></article><article class="card"><h2>Cases needing attention</h2><ul id="cd-attention-cases">${renderDashboardAttentionCases(projection)}</ul></article></section><script type="module">
  const endpoint = ${scriptJson(endpoint)};
  const initialProjection = ${scriptJson(projection)};
  const elements = {
    active: document.getElementById("cd-active"),
    waiting: document.getElementById("cd-waiting"),
    noShow: document.getElementById("cd-no-show"),
    followUp: document.getElementById("cd-follow-up"),
    recentCases: document.getElementById("cd-recent-cases"),
    attentionCases: document.getElementById("cd-attention-cases"),
    status: document.getElementById("cd-refresh-status")
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderList(target, items, fallback) {
    if (!target) return;
    target.innerHTML = Array.isArray(items) && items.length > 0
      ? items.join("")
      : '<li class="muted">' + escapeHtml(fallback) + '</li>';
  }

  function renderProjection(view) {
    if (!view) return;
    elements.active.textContent = String(view.kpi.activeCases);
    elements.waiting.textContent = String(view.kpi.waiting);
    elements.noShow.textContent = String(view.kpi.noShow);
    elements.followUp.textContent = String(view.kpi.followUpPending);
    renderList(elements.recentCases, (view.recentCases || []).map((item) => '<li><strong>' + escapeHtml(item.patientName) + '</strong> · ' + escapeHtml(item.status) + '<div class="small muted">' + escapeHtml(item.serviceLine || 'No service line yet') + '</div></li>'), 'No recent cases yet.');
    renderList(elements.attentionCases, (view.attentionCases || []).map((item) => '<li><strong>' + escapeHtml(item.patientName) + '</strong><div class="small muted">' + escapeHtml(item.reason) + '</div></li>'), 'No active attention cases.');
  }

  async function refreshProjection(silent) {
    try {
      const response = await fetch(endpoint);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload && (payload.message || payload.error) ? payload.message || payload.error : 'Request failed');
      }
      renderProjection(payload.item);
      if (elements.status) {
        elements.status.textContent = silent ? 'Dashboard refreshed automatically.' : 'Dashboard refreshed.';
        elements.status.setAttribute('data-tone', 'success');
      }
    } catch (error) {
      if (elements.status) {
        elements.status.textContent = error instanceof Error ? error.message : 'Surface refresh failed.';
        elements.status.setAttribute('data-tone', 'warning');
      }
    }
  }

  renderProjection(initialProjection);
  void refreshProjection(true);
  window.setInterval(() => { void refreshProjection(true); }, 15000);
</script>`);
}
