import type { SupabaseClient } from "@supabase/supabase-js";

type ProtocolAnnotationDb = SupabaseClient;

export async function ensureProtocolSharedAnnotation(
  db: ProtocolAnnotationDb,
  {
    clientId,
    coachId,
    protocolId,
    protocolName,
  }: {
    clientId: string;
    coachId: string;
    protocolId: string;
    protocolName: string;
  },
) {
  const sharedBody = "Protocole partage avec le client";
  const { data: existingAnnotation } = await db
    .from("metric_annotations")
    .select("id")
    .eq("client_id", clientId)
    .eq("event_type", "nutrition")
    .eq("source_id", protocolId)
    .eq("body", sharedBody)
    .limit(1)
    .maybeSingle();

  if ((existingAnnotation as any)?.id) {
    await db
      .from("metric_annotations")
      .update({ label: `Protocole nutritionnel : ${protocolName}` })
      .eq("id", (existingAnnotation as any).id);
    return (existingAnnotation as any).id as string;
  }

  const today = new Date().toISOString().split("T")[0];
  const { data } = await db.from("metric_annotations").insert({
    client_id: clientId,
    coach_id: coachId,
    event_type: "nutrition",
    event_date: today,
    label: `Protocole nutritionnel : ${protocolName}`,
    body: sharedBody,
    source_id: protocolId,
  }).select('id').single();

  return (data as any)?.id as string | undefined;
}

export async function upsertProtocolUpdatedAnnotation(
  db: ProtocolAnnotationDb,
  {
    clientId,
    coachId,
    protocolId,
    protocolName,
  }: {
    clientId: string;
    coachId: string;
    protocolId: string;
    protocolName: string;
  },
) {
  const today = new Date().toISOString().split("T")[0];
  const label = `Mise a jour du protocole nutritionnel : ${protocolName}`;
  const body = "Protocole partage mis a jour";

  const { data: existing } = await db
    .from("metric_annotations")
    .select("id")
    .eq("client_id", clientId)
    .eq("event_type", "nutrition")
    .eq("source_id", protocolId)
    .eq("event_date", today)
    .eq("label", label)
    .limit(1)
    .maybeSingle();

  if ((existing as any)?.id) {
    await db
      .from("metric_annotations")
      .update({ body })
      .eq("id", (existing as any).id);
    return;
  }

  await db.from("metric_annotations").insert({
    client_id: clientId,
    coach_id: coachId,
    event_type: "nutrition",
    event_date: today,
    label,
    body,
    source_id: protocolId,
  });
}
