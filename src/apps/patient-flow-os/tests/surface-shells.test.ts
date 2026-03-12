import assert from "node:assert/strict";
import test from "node:test";

import {
  renderClinicDashboard,
  renderPatientFlowLink,
  renderWaitRoomDisplay
} from "../apps/api/src/html.js";
import { createBootstrapState, InMemoryPlatformRepository } from "../apps/api/src/state.js";
import {
  buildClinicDashboardProjection,
  buildPatientFlowLinkProjection,
  buildWaitRoomDisplayProjection
} from "../apps/api/src/surfaces.js";

test("patient flow link shell hydrates from the canonical surface endpoint", () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const tenant = repository.getTenantById("tnt_green");
  const snapshot = repository.getPatientCaseSnapshot("tnt_green", "case_green_001");
  assert.ok(tenant);
  assert.ok(snapshot);

  const html = renderPatientFlowLink(tenant, buildPatientFlowLinkProjection(snapshot));

  assert.match(html, /\/v1\/surfaces\/patient-flow\?tenantId=tnt_green&caseId=case_green_001/);
  assert.match(html, /window\.setInterval/);
  assert.match(html, /Projection refreshed automatically/);
  assert.match(html, /id="pfl-refresh-status"/);
});

test("wait room and dashboard shells hydrate from their canonical surface endpoints", () => {
  const repository = new InMemoryPlatformRepository(createBootstrapState());
  const riverTenant = repository.getTenantById("tnt_river");
  const greenTenant = repository.getTenantById("tnt_green");
  const riverLocation = repository.getLocationBySlug("tnt_river", "river-main");
  assert.ok(riverTenant);
  assert.ok(greenTenant);
  assert.ok(riverLocation);

  const waitRoomHtml = renderWaitRoomDisplay(
    riverTenant,
    buildWaitRoomDisplayProjection("tnt_river", riverLocation, repository.listPatientCaseSnapshots("tnt_river"))
  );
  assert.match(waitRoomHtml, /\/v1\/surfaces\/wait-room\?tenantId=tnt_river&locationId=loc_river_main/);
  assert.match(waitRoomHtml, /Wait room refreshed automatically/);
  assert.match(waitRoomHtml, /id="wrd-refresh-status"/);

  const dashboardHtml = renderClinicDashboard(
    greenTenant,
    buildClinicDashboardProjection(
      repository.getKpiReport("tnt_green"),
      repository.listPatientCaseSnapshots("tnt_green")
    )
  );
  assert.match(dashboardHtml, /\/v1\/surfaces\/dashboard\?tenantId=tnt_green/);
  assert.match(dashboardHtml, /Dashboard refreshed automatically/);
  assert.match(dashboardHtml, /id="cd-refresh-status"/);
});
