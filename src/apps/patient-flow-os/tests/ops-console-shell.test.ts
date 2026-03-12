import assert from "node:assert/strict";
import test from "node:test";

import { renderOpsConsole } from "../apps/api/src/html.js";
import { createBootstrapState, InMemoryPlatformRepository } from "../apps/api/src/state.js";

test("ops console shell se hidrata desde el API canonico del copilot", () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const tenant = repository.getTenantById("tnt_green");
  assert.ok(tenant);

  const html = renderOpsConsole(tenant);

  assert.match(html, /data-copilot-ready="true"/);
  assert.match(html, /\/v1\/patient-cases\?tenantId=tnt_green/);
  assert.match(html, /\/v1\/reports\/kpi\?tenantId=tnt_green/);
  assert.match(html, /\/v1\/agent-tasks\/ops-next-best-action/);
  assert.match(html, /\/v1\/copilot\/dispatch-worker\/drain/);
  assert.match(html, /\/v1\/copilot\/provider-exceptions\?tenantId=tnt_green/);
  assert.match(html, /"providerExceptionsBase":"\/v1\/copilot\/provider-exceptions"/);
  assert.match(html, /\/v1\/patient-cases\/:caseId\/copilot-receipts\?tenantId=tnt_green/);
  assert.match(html, /\/v1\/patient-cases\/:caseId\/copilot-receipt-events\?tenantId=tnt_green/);
  assert.match(html, /\/v1\/copilot\/receipts\/webhook/);
  assert.match(html, /Receipts fallidos/);
  assert.match(html, /data-review-decision/);
  assert.match(html, /data-provider-exception-decision/);
  assert.match(html, /data-process-outbox="true"/);
  assert.match(html, /persistTask: false/);
  assert.match(html, /executeNow: shouldExecute/);
  assert.match(html, /window\.setInterval/);
});
