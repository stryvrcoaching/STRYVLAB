import type { BlockConfig } from "@/types/assessment";

type TemplateSnapshotObject = {
  name?: string | null;
  blocks?: BlockConfig[] | null;
};

export type TemplateSnapshotLike =
  | BlockConfig[]
  | TemplateSnapshotObject
  | null
  | undefined;

export const SYSTEM_ASSESSMENT_TEMPLATE_NAMES = new Set([
  "__csv_import__",
  "__checkin_realtime__",
  "__client_live_metrics__",
]);

const SYSTEM_BLOCK_IDS = new Set([
  "checkin_realtime_block",
  "client_live_metrics_block",
]);

function sanitizeBlock(block: unknown, index: number): BlockConfig | null {
  if (!block || typeof block !== "object") return null;
  const candidate = block as Partial<BlockConfig> & { title?: string | null; fields?: unknown };
  const fields = Array.isArray(candidate.fields) ? candidate.fields : [];
  const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : `block_${index}`;
  const labelSource = candidate.label ?? candidate.title;
  const label =
    typeof labelSource === "string" && labelSource.trim() ? labelSource : `Bloc ${index + 1}`;

  return {
    id,
    module: (candidate.module ?? "general") as BlockConfig["module"],
    label,
    order: typeof candidate.order === "number" ? candidate.order : index,
    fields,
  };
}

export function extractTemplateBlocks(
  snapshot: TemplateSnapshotLike,
): BlockConfig[] {
  const rawBlocks = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(snapshot?.blocks)
      ? snapshot.blocks
      : [];

  return rawBlocks
    .map((block, index) => sanitizeBlock(block, index))
    .filter((block): block is BlockConfig => block !== null);
}

export function extractTemplateName(
  snapshot: TemplateSnapshotLike,
  fallback = "Bilan",
): string {
  if (!snapshot) return fallback;
  if (!Array.isArray(snapshot) && typeof snapshot.name === "string" && snapshot.name.trim()) {
    return snapshot.name;
  }
  return fallback;
}

export function isSystemAssessmentTemplateName(name: string | null | undefined) {
  return !!name && SYSTEM_ASSESSMENT_TEMPLATE_NAMES.has(name);
}

export function isSystemAssessmentSnapshot(snapshot: TemplateSnapshotLike) {
  return extractTemplateBlocks(snapshot).some((block) => SYSTEM_BLOCK_IDS.has(block.id));
}

export function hasTemplateBlock(
  snapshot: TemplateSnapshotLike,
  blockId: string,
): boolean {
  return extractTemplateBlocks(snapshot).some((block) => block?.id === blockId);
}
