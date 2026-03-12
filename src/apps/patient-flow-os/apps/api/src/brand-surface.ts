import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BrandAssetDraftSchema,
  BrandPublicationPacketSchema,
  BrandSurfaceApprovalSchema,
  BrandSurfaceRecommendationSchema,
  BrandSurfaceSlotSchema,
  type BrandAssetDraft,
  type BrandAssetSourceType,
  type BrandGenerationBrief,
  type BrandPublicationPacket,
  type BrandSurfaceApproval,
  type BrandSurfaceRecommendation,
  type BrandSurfaceSlot
} from "../../../packages/core/src/index.js";
import type { PlatformRepository } from "./state.js";

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
  ".."
);

export interface PublicAssetManifestEntry extends Record<string, unknown> {
  id: string;
  kind: string;
  src: string;
  srcset?: string;
  status?: string;
  sourceType?: BrandAssetSourceType;
  publicWebSafe?: boolean;
  editorialTags?: string[];
  allowedSlotRoles?: string[];
  tone?: string;
  localeAlt?: Record<string, string>;
  generation?: Record<string, unknown>;
}

export type SlotTemplate = Omit<BrandSurfaceSlot, "tenantId">;

export interface PublicImageDecision {
  slotId: string;
  assetId: string;
  altOverride: Record<string, string> | null;
  revision: number;
  approvedAt: string;
  approvedBy: string;
  sourceRecommendationId: string | null;
}

export interface BrandSurfaceContentSeed {
  assets: PublicAssetManifestEntry[];
  slotRegistry: SlotTemplate[];
  decisions: PublicImageDecision[];
}

export interface BrandSurfaceServiceOptions {
  contentSeed?: Partial<BrandSurfaceContentSeed>;
  now?: () => string;
}

export interface BrandSurfaceSlotListItem {
  slot: BrandSurfaceSlot;
  currentDecision: PublicImageDecision | null;
  latestRecommendation: BrandSurfaceRecommendation | null;
  latestApproval: BrandSurfaceApproval | null;
  status: "ready" | "pending_review" | "approved" | "rejected" | "snoozed";
}

export interface BrandSurfaceInspectionCard {
  now: string;
  why: string;
  risk: string;
  whatReady: string;
  approval: string;
}

export interface BrandSurfaceInspectionResult {
  slot: BrandSurfaceSlot;
  recommendation: BrandSurfaceRecommendation;
  draft: BrandAssetDraft | null;
  card: BrandSurfaceInspectionCard;
}

export interface BrandSurfaceReviewResult {
  recommendation: BrandSurfaceRecommendation;
  approval: BrandSurfaceApproval;
  currentDecision: PublicImageDecision | null;
  packet: BrandPublicationPacket | null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, relativePath), "utf8")) as T;
}

function cloneDecision(decision: PublicImageDecision): PublicImageDecision {
  return JSON.parse(JSON.stringify(decision)) as PublicImageDecision;
}

function toPublicImageDecision(input: Record<string, unknown>): PublicImageDecision {
  return {
    slotId: normalizeText(input.slotId),
    assetId: normalizeText(input.assetId),
    altOverride:
      input.altOverride && typeof input.altOverride === "object" && !Array.isArray(input.altOverride)
        ? Object.fromEntries(
            Object.entries(input.altOverride).filter(
              ([key, value]) => normalizeText(key) && typeof value === "string" && value.trim()
            )
          )
        : null,
    revision: Number.isInteger(input.revision) && Number(input.revision) > 0 ? Number(input.revision) : 1,
    approvedAt: normalizeText(input.approvedAt) || nowIso(),
    approvedBy: normalizeText(input.approvedBy) || "seed_migration",
    sourceRecommendationId: normalizeText(input.sourceRecommendationId) || null
  };
}

function defaultContentSeed(): BrandSurfaceContentSeed {
  const manifest = readJson<{ assets?: PublicAssetManifestEntry[] }>("content/public-v6/assets-manifest.json");
  const registry = readJson<{ slots?: Array<Record<string, unknown>> }>("content/public-v6/image-slot-registry.json");
  const decisionsFile = readJson<{ decisions?: Array<Record<string, unknown>> }>("content/public-v6/image-decisions.json");
  return {
    assets: Array.isArray(manifest.assets) ? manifest.assets : [],
    slotRegistry: (Array.isArray(registry.slots) ? registry.slots : []).map((slot) =>
      BrandSurfaceSlotSchema.omit({ tenantId: true }).parse(slot)
    ),
    decisions: (Array.isArray(decisionsFile.decisions) ? decisionsFile.decisions : []).map((decision) =>
      toPublicImageDecision(decision)
    )
  };
}

function mergeContentSeed(options: BrandSurfaceServiceOptions = {}): BrandSurfaceContentSeed {
  const seed = defaultContentSeed();
  return {
    assets: Array.isArray(options.contentSeed?.assets) ? options.contentSeed.assets : seed.assets,
    slotRegistry: Array.isArray(options.contentSeed?.slotRegistry)
      ? options.contentSeed.slotRegistry
      : seed.slotRegistry,
    decisions: Array.isArray(options.contentSeed?.decisions) ? options.contentSeed.decisions : seed.decisions
  };
}

export class BrandSurfaceService {
  private readonly assets: PublicAssetManifestEntry[];

  private readonly assetsById: Map<string, PublicAssetManifestEntry>;

  private readonly slotTemplates: SlotTemplate[];

  private readonly baseDecisions: Map<string, PublicImageDecision>;

  private readonly slotsByTenant = new Map<string, BrandSurfaceSlot[]>();

  private readonly currentDecisionsByTenant = new Map<string, Map<string, PublicImageDecision>>();

  private readonly recommendations: BrandSurfaceRecommendation[] = [];

  private readonly drafts: BrandAssetDraft[] = [];

  private readonly approvals: BrandSurfaceApproval[] = [];

  private readonly packets: BrandPublicationPacket[] = [];

  private readonly now: () => string;

  constructor(
    private readonly repository: PlatformRepository,
    options: BrandSurfaceServiceOptions = {}
  ) {
    const seed = mergeContentSeed(options);
    this.assets = seed.assets.map((asset) => JSON.parse(JSON.stringify(asset)) as PublicAssetManifestEntry);
    this.assetsById = new Map(this.assets.map((asset) => [asset.id, asset]));
    this.slotTemplates = seed.slotRegistry.map((slot) => JSON.parse(JSON.stringify(slot)) as SlotTemplate);
    this.baseDecisions = new Map(seed.decisions.map((decision) => [decision.slotId, cloneDecision(decision)]));
    this.now = options.now ?? nowIso;
  }

  listSlots(
    tenantId: string,
    filters: { surface?: string; pageKey?: string; slotRole?: string } = {}
  ): BrandSurfaceSlotListItem[] {
    const slots = this.ensureTenantSlots(tenantId).filter((slot) => {
      if (filters.surface && slot.surface !== filters.surface) return false;
      if (filters.pageKey && slot.pageKey !== filters.pageKey) return false;
      if (filters.slotRole && slot.slotRole !== filters.slotRole) return false;
      return true;
    });

    return slots.map((slot) => {
      const latestRecommendation = this.latestRecommendationFor(tenantId, slot.slotId);
      const latestApproval = latestRecommendation
        ? this.latestApprovalFor(tenantId, latestRecommendation.id)
        : null;
      const currentDecision = this.currentDecisionFor(tenantId, slot.slotId);
      return {
        slot: JSON.parse(JSON.stringify(slot)) as BrandSurfaceSlot,
        currentDecision,
        latestRecommendation,
        latestApproval,
        status: latestRecommendation?.status ?? (currentDecision ? "approved" : "ready")
      };
    });
  }

  inspectSlot(
    tenantId: string,
    slotId: string,
    input: { actorId?: string; tone?: string; note?: string } = {}
  ): BrandSurfaceInspectionResult {
    const slot = this.requireSlot(tenantId, slotId);
    const inspection = this.rankAssets(slot, input.tone);
    const createdAt = this.now();
    const privateCaseRefs =
      slot.requiredTags.length > 0
        ? slot.requiredTags.map((tag) => `case_media_flow:${tag}`)
        : [`case_media_flow:${slot.surface}`];

    const recommendation = BrandSurfaceRecommendationSchema.parse({
      id: makeId("brand_rec"),
      tenantId,
      slotId: slot.slotId,
      mode: inspection.mode,
      candidateAssetId: inspection.asset?.id ?? null,
      generationBrief: inspection.generationBrief,
      rationale: inspection.rationale,
      confidence: inspection.confidence,
      privateCaseRefs,
      status: "pending_review",
      createdAt,
      updatedAt: createdAt
    });
    this.recommendations.push(recommendation);

    let draft: BrandAssetDraft | null = null;
    if (inspection.mode === "generate_new" && inspection.generationBrief) {
      draft = BrandAssetDraftSchema.parse({
        id: makeId("brand_draft"),
        tenantId,
        proposedSlotId: slot.slotId,
        sourceType: "ai_generated",
        status: "draft",
        publicWebSafe: true,
        assetId: null,
        prompt: inspection.generationBrief.prompt,
        references: inspection.generationBrief.references,
        sourceMasterPath: null,
        optimizedFiles: [],
        createdAt,
        reviewedAt: null
      });
      this.drafts.push(draft);
    }

    return {
      slot: JSON.parse(JSON.stringify(slot)) as BrandSurfaceSlot,
      recommendation,
      draft,
      card: this.buildInspectionCard(slot, recommendation, draft)
    };
  }

  reviewRecommendation(
    tenantId: string,
    recommendationId: string,
    input: {
      actor: string;
      decision: BrandSurfaceApproval["decision"];
      approvedAssetId?: string | null;
      altOverride?: Record<string, string> | null;
      note?: string | null;
    }
  ): BrandSurfaceReviewResult {
    const recommendation = this.requireRecommendation(tenantId, recommendationId);
    const slot = this.requireSlot(tenantId, recommendation.slotId);
    const createdAt = this.now();
    const approvedAssetId =
      normalizeText(input.approvedAssetId) || normalizeText(recommendation.candidateAssetId) || null;

    if ((input.decision === "approve" || input.decision === "edit") && !approvedAssetId) {
      throw new Error("approvedAssetId is required when approving a brand surface recommendation");
    }

    const approvedAsset =
      approvedAssetId !== null ? this.requirePublicAsset(approvedAssetId) : null;

    const approval = BrandSurfaceApprovalSchema.parse({
      id: makeId("brand_approval"),
      tenantId,
      recommendationId,
      decision: input.decision,
      approvedAssetId,
      altOverride:
        input.altOverride && Object.keys(input.altOverride).length > 0 ? input.altOverride : null,
      note: normalizeText(input.note) || null,
      actor: normalizeText(input.actor),
      createdAt
    });
    this.approvals.push(approval);

    recommendation.status =
      input.decision === "approve" || input.decision === "edit"
        ? "approved"
        : input.decision === "reject"
          ? "rejected"
          : "snoozed";
    recommendation.updatedAt = createdAt;

    let currentDecision = this.currentDecisionFor(tenantId, recommendation.slotId);
    let packet: BrandPublicationPacket | null = null;

    if ((input.decision === "approve" || input.decision === "edit") && approvedAsset) {
      const revision = this.nextRevision(tenantId);
      currentDecision = {
        slotId: recommendation.slotId,
        assetId: approvedAsset.id,
        altOverride:
          approval.altOverride && Object.keys(approval.altOverride).length > 0
            ? approval.altOverride
            : null,
        revision,
        approvedAt: createdAt,
        approvedBy: approval.actor,
        sourceRecommendationId: recommendation.id
      };
      this.currentDecisionsByTenant.get(tenantId)?.set(recommendation.slotId, currentDecision);
      slot.currentAssetId = approvedAsset.id;

      packet = BrandPublicationPacketSchema.parse({
        id: makeId("brand_packet"),
        tenantId,
        revision,
        approvedDecisions: [
          {
            slotId: recommendation.slotId,
            assetId: approvedAsset.id,
            altOverride: currentDecision.altOverride,
            approvedAt: createdAt,
            approvedBy: approval.actor,
            sourceRecommendationId: recommendation.id
          }
        ],
        approvedAssets: [
          {
            assetId: approvedAsset.id,
            sourceType: approvedAsset.sourceType ?? "ai_generated",
            publicWebSafe: approvedAsset.publicWebSafe === true,
            manifestEntry: JSON.parse(JSON.stringify(approvedAsset)),
            sourceMasterPath: null,
            optimizedFiles: []
          }
        ],
        exportedAt: createdAt,
        exportedBy: approval.actor
      });
      this.packets.push(packet);
    }

    const linkedDraft = this.drafts.find(
      (draft) => draft.tenantId === tenantId && draft.proposedSlotId === recommendation.slotId && draft.reviewedAt === null
    );
    if (linkedDraft) {
      linkedDraft.status =
        input.decision === "approve" || input.decision === "edit"
          ? "approved"
          : input.decision === "reject"
            ? "rejected"
            : linkedDraft.status;
      if (input.decision !== "snooze") {
        linkedDraft.reviewedAt = createdAt;
      }
    }

    return {
      recommendation,
      approval,
      currentDecision,
      packet
    };
  }

  listPublicationPackets(tenantId: string): BrandPublicationPacket[] {
    this.ensureTenantSlots(tenantId);
    return this.packets
      .filter((packet) => packet.tenantId === tenantId)
      .map((packet) => JSON.parse(JSON.stringify(packet)) as BrandPublicationPacket);
  }

  private ensureTenantSlots(tenantId: string): BrandSurfaceSlot[] {
    const existing = this.slotsByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    if (!this.repository.getTenantById(tenantId)) {
      throw new Error("tenant not found");
    }

    const tenantDecisions = new Map<string, PublicImageDecision>();
    const slots = this.slotTemplates.map((slot) => {
      const seededDecision = this.baseDecisions.get(slot.slotId);
      if (seededDecision) {
        tenantDecisions.set(slot.slotId, cloneDecision(seededDecision));
      }
      return BrandSurfaceSlotSchema.parse({
        tenantId,
        ...slot,
        currentAssetId: seededDecision?.assetId ?? slot.currentAssetId ?? null,
        fallbackAssetId: slot.fallbackAssetId ?? seededDecision?.assetId ?? slot.currentAssetId ?? null
      });
    });

    this.slotsByTenant.set(tenantId, slots);
    this.currentDecisionsByTenant.set(tenantId, tenantDecisions);
    return slots;
  }

  private requireSlot(tenantId: string, slotId: string): BrandSurfaceSlot {
    const slot = this.ensureTenantSlots(tenantId).find((item) => item.slotId === slotId);
    if (!slot) {
      throw new Error("brand surface slot not found");
    }
    return slot;
  }

  private requireRecommendation(tenantId: string, recommendationId: string): BrandSurfaceRecommendation {
    const recommendation = this.recommendations.find(
      (item) => item.tenantId === tenantId && item.id === recommendationId
    );
    if (!recommendation) {
      throw new Error("brand surface recommendation not found");
    }
    return recommendation;
  }

  private currentDecisionFor(tenantId: string, slotId: string): PublicImageDecision | null {
    return this.currentDecisionsByTenant.get(tenantId)?.get(slotId) ?? null;
  }

  private latestRecommendationFor(tenantId: string, slotId: string): BrandSurfaceRecommendation | null {
    const items = this.recommendations
      .filter((item) => item.tenantId === tenantId && item.slotId === slotId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return items[0] ?? null;
  }

  private latestApprovalFor(tenantId: string, recommendationId: string): BrandSurfaceApproval | null {
    const items = this.approvals
      .filter((item) => item.tenantId === tenantId && item.recommendationId === recommendationId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return items[0] ?? null;
  }

  private requirePublicAsset(assetId: string): PublicAssetManifestEntry {
    const asset = this.assetsById.get(assetId);
    if (!asset) {
      throw new Error("brand surface asset not found");
    }
    if (asset.publicWebSafe !== true || asset.sourceType === "real_case") {
      throw new Error("brand surface asset is not eligible for public web publication");
    }
    return asset;
  }

  private nextRevision(tenantId: string): number {
    const packetRevision = this.packets
      .filter((packet) => packet.tenantId === tenantId)
      .reduce((max, packet) => Math.max(max, packet.revision), 0);
    const currentRevision = [...(this.currentDecisionsByTenant.get(tenantId)?.values() ?? [])].reduce(
      (max, decision) => Math.max(max, decision.revision),
      0
    );
    return Math.max(packetRevision, currentRevision, 0) + 1;
  }

  private rankAssets(
    slot: BrandSurfaceSlot,
    requestedTone?: string
  ): {
    mode: BrandSurfaceRecommendation["mode"];
    asset: PublicAssetManifestEntry | null;
    rationale: string;
    confidence: number;
    generationBrief: BrandGenerationBrief | null;
  } {
    const candidates = this.assets
      .map((asset) => ({
        asset,
        score: this.scoreAsset(slot, asset, requestedTone)
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort((left, right) => right.score - left.score);

    const winner = candidates[0] ?? null;
    const threshold = Math.max(4, slot.requiredTags.length * 2);

    if (winner && winner.score >= threshold) {
      const overlap = slot.requiredTags.filter((tag) =>
        normalizeList(winner.asset.editorialTags).includes(normalizeText(tag))
      );
      return {
        mode: "reuse_existing",
        asset: winner.asset,
        rationale: `OpenClaw ranked approved assets for ${slot.slotRole}. Selected ${winner.asset.id} because it matches ${overlap.join(", ") || "the slot role"} and remains public-web-safe.`,
        confidence: Math.min(0.98, 0.55 + winner.score / 12),
        generationBrief: null
      };
    }

    const generationBrief: BrandGenerationBrief = {
      title: `Generate ${slot.slotRole} for ${slot.pageKey}`,
      prompt: `Create a public-web-safe editorial dermatology image for slot ${slot.slotId}. Surface: ${slot.surface}. Page: ${slot.pageKey}. Role: ${slot.slotRole}. Required tags: ${slot.requiredTags.join(", ") || "editorial fit"}. Tone: ${normalizeText(requestedTone) || "clinical_editorial"}. Do not depict identifiable patients or use any real-case media directly.`,
      requiredTags: slot.requiredTags,
      prohibitedSources: [
        "real_case_publication",
        "patient_identifiers",
        "private_case_media"
      ],
      references: [`surface:${slot.surface}`, `page:${slot.pageKey}`, `slot:${slot.slotId}`],
      tone: normalizeText(requestedTone) || "clinical_editorial",
      notes: "Case Media Flow can inform the brief internally, but never as a public asset source."
    };

    return {
      mode: "generate_new",
      asset: null,
      rationale: `OpenClaw found no approved asset with enough fit for ${slot.slotRole}. A new editorial brief is required before public publication.`,
      confidence: 0.42,
      generationBrief
    };
  }

  private scoreAsset(slot: BrandSurfaceSlot, asset: PublicAssetManifestEntry, requestedTone?: string): number {
    if (asset.publicWebSafe !== true || asset.sourceType === "real_case") {
      return Number.NEGATIVE_INFINITY;
    }
    if (normalizeText(asset.status) !== "approved") {
      return Number.NEGATIVE_INFINITY;
    }

    const assetKind = normalizeText(asset.kind);
    if (slot.allowedAssetKinds.length > 0 && !slot.allowedAssetKinds.includes(assetKind)) {
      return Number.NEGATIVE_INFINITY;
    }

    const allowedSlotRoles = normalizeList(asset.allowedSlotRoles);
    if (allowedSlotRoles.length > 0 && !allowedSlotRoles.includes(slot.slotRole)) {
      return Number.NEGATIVE_INFINITY;
    }

    const requiredTags = normalizeList(slot.requiredTags);
    const editorialTags = normalizeList(asset.editorialTags);
    const overlap = requiredTags.filter((tag) => editorialTags.includes(tag)).length;

    let score = overlap * 2.5;
    if (slot.currentAssetId && slot.currentAssetId === asset.id) score += 1.6;
    if (slot.fallbackAssetId && slot.fallbackAssetId === asset.id) score += 0.8;
    if (editorialTags.includes(normalizeText(slot.surface))) score += 0.8;
    if (editorialTags.includes(normalizeText(slot.pageKey))) score += 0.8;
    if (normalizeText(requestedTone) && normalizeText(asset.tone) === normalizeText(requestedTone)) {
      score += 1;
    }
    if (allowedSlotRoles.includes(slot.slotRole)) score += 1.4;

    return score;
  }

  private buildInspectionCard(
    slot: BrandSurfaceSlot,
    recommendation: BrandSurfaceRecommendation,
    draft: BrandAssetDraft | null
  ): BrandSurfaceInspectionCard {
    if (recommendation.mode === "reuse_existing") {
      return {
        now: `Approve the recommended asset for ${slot.slotId}.`,
        why: recommendation.rationale,
        risk: "The slot keeps its fallback imagery and the section intent stays underfit until approval happens.",
        whatReady: `A publication-ready recommendation is staged for asset ${recommendation.candidateAssetId}.`,
        approval: "Approve or edit the selection to export a BrandPublicationPacket for sync."
      };
    }

    return {
      now: `A new asset is required for ${slot.slotId}.`,
      why: recommendation.rationale,
      risk: "The page will continue on legacy fallback imagery until a public-safe replacement is generated and approved.",
      whatReady: `A generation brief and draft shell${draft ? ` (${draft.id})` : ""} are ready for rasterization and review.`,
      approval: "Approve only after the generated asset is materialized with a public-safe assetId."
    };
  }
}

export function createBrandSurfaceService(
  repository: PlatformRepository,
  options: BrandSurfaceServiceOptions = {}
) {
  return new BrandSurfaceService(repository, options);
}
