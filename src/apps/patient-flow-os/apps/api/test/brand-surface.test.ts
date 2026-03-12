import assert from "node:assert/strict";
import test from "node:test";
import { createBrandSurfaceService } from "../src/brand-surface.js";
import { InMemoryPlatformRepository, createBootstrapState } from "../src/state.js";

function createRepository() {
  return new InMemoryPlatformRepository(createBootstrapState());
}

function makeAsset(
  overrides: Record<string, unknown> = {}
): {
  id: string;
  kind: string;
  src: string;
  srcset: string;
  status: string;
  sourceType: string;
  publicWebSafe: boolean;
  editorialTags: string[];
  allowedSlotRoles: string[];
  tone: string;
  localeAlt: { es: string; en: string };
  generation: { strategy: string; source: string };
  [key: string]: unknown;
} {
  return {
    id: "asset_default",
    kind: "card",
    src: "/images/optimized/asset-default.webp",
    srcset: "",
    status: "approved",
    sourceType: "ai_generated",
    publicWebSafe: true,
    editorialTags: ["default"],
    allowedSlotRoles: ["page_hero", "statement_band"],
    tone: "ink",
    localeAlt: {
      es: "Asset por defecto",
      en: "Default asset"
    },
    generation: {
      strategy: "unit_test",
      source: "brand-surface.test.ts"
    },
    ...overrides
  };
}

test("brand surface ranking reuses an approved asset when fit is high", () => {
  const repository = createRepository();
  const service = createBrandSurfaceService(repository, {
    contentSeed: {
      assets: [
        makeAsset({
          id: "asset_fit",
          editorialTags: ["editorial_map", "hub", "hero"],
          allowedSlotRoles: ["page_hero"],
          kind: "wide"
        })
      ],
      slotRegistry: [
        {
          slotId: "custom.hub.hero",
          surface: "hub",
          pageKey: "hub",
          slotRole: "page_hero",
          currentAssetId: "asset_fit",
          fallbackAssetId: "asset_fit",
          allowedAssetKinds: ["wide"],
          requiredTags: ["editorial_map", "hub"],
          localeMode: "shared"
        }
      ],
      decisions: []
    },
    now: () => "2026-03-12T10:00:00.000Z"
  });

  const result = service.inspectSlot("tnt_green", "custom.hub.hero");
  assert.equal(result.recommendation.mode, "reuse_existing");
  assert.equal(result.recommendation.candidateAssetId, "asset_fit");
  assert.equal(result.draft, null);
});

test("brand surface ranking falls back to generate_new when no safe asset fits", () => {
  const repository = createRepository();
  const service = createBrandSurfaceService(repository, {
    contentSeed: {
      assets: [
        makeAsset({
          id: "asset_real_case_blocked",
          sourceType: "real_case",
          publicWebSafe: false,
          editorialTags: ["missing_tag"],
          allowedSlotRoles: ["page_hero"]
        }),
        makeAsset({
          id: "asset_unrelated",
          editorialTags: ["other_tag"],
          allowedSlotRoles: ["page_hero"]
        })
      ],
      slotRegistry: [
        {
          slotId: "custom.service.hero",
          surface: "service",
          pageKey: "service.custom",
          slotRole: "page_hero",
          currentAssetId: null,
          fallbackAssetId: null,
          allowedAssetKinds: ["card"],
          requiredTags: ["missing_tag"],
          localeMode: "shared"
        }
      ],
      decisions: []
    },
    now: () => "2026-03-12T10:00:00.000Z"
  });

  const result = service.inspectSlot("tnt_green", "custom.service.hero");
  assert.equal(result.recommendation.mode, "generate_new");
  assert.ok(result.recommendation.generationBrief);
  assert.ok(result.draft);
  assert.ok(result.recommendation.privateCaseRefs.length > 0);
});

test("brand surface review exports a packet without leaking private case refs", () => {
  const repository = createRepository();
  const service = createBrandSurfaceService(repository, {
    contentSeed: {
      assets: [
        makeAsset({
          id: "asset_safe",
          editorialTags: ["legal", "consent"],
          allowedSlotRoles: ["statement_band"]
        })
      ],
      slotRegistry: [
        {
          slotId: "custom.legal.statement",
          surface: "legal",
          pageKey: "legal",
          slotRole: "statement_band",
          currentAssetId: "asset_safe",
          fallbackAssetId: "asset_safe",
          allowedAssetKinds: ["card"],
          requiredTags: ["legal", "consent"],
          localeMode: "shared"
        }
      ],
      decisions: []
    },
    now: () => "2026-03-12T10:00:00.000Z"
  });

  const inspection = service.inspectSlot("tnt_green", "custom.legal.statement");
  const review = service.reviewRecommendation("tnt_green", inspection.recommendation.id, {
    actor: "brand_editor",
    decision: "approve"
  });

  assert.ok(review.packet);
  assert.equal(review.packet?.approvedDecisions[0]?.slotId, "custom.legal.statement");
  assert.doesNotMatch(JSON.stringify(review.packet), /privateCaseRefs/);
});
