import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { resolveClientFromUser } from "@/lib/client/resolve-client";
import ClientTopBar from "@/components/client/ClientTopBar";
import { CheckCircle2, Clock } from "lucide-react";
import FeedbackThread from "@/components/client/smart/FeedbackThread";
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations";
import {
  extractTemplateBlocks,
  extractTemplateName,
} from "@/lib/assessments/templateSnapshot";

export default async function BilanDetailPage({
  params,
}: {
  params: { submissionId: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  if (!user) redirect('/client/login');

  const client = await resolveClientFromUser(user.id, user.email, service);
  if (!client) notFound();

  const prefsRes = await service.from("client_preferences").select("language").eq("client_id", client.id).maybeSingle();
  const rawLang = (prefsRes as any)?.data?.language;
  const lang: ClientLang = ["fr", "en", "es"].includes(rawLang) ? (rawLang as ClientLang) : "fr";
  const dateLocale = lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-GB";

  const { data: submissionData, error } = await service
    .from("assessment_submissions")
    .select("id, status, created_at, submitted_at, template_snapshot")
    .eq("id", params.submissionId)
    .eq("client_id", client.id)
    .single();

  if (error || !submissionData) notFound();

  const { data: responses } = await service
    .from("assessment_responses")
    .select("block_id, field_key, value_text, value_number, value_json, storage_path")
    .eq("submission_id", params.submissionId);

  const responseMap: Record<string, Record<string, any>> = {};
  for (const r of responses ?? []) {
    if (!responseMap[r.block_id]) responseMap[r.block_id] = {};
    responseMap[r.block_id][r.field_key] =
      r.value_text ?? r.value_number ?? r.value_json ?? r.storage_path;
  }

  const blocks: any[] = extractTemplateBlocks(submissionData.template_snapshot as any);
  const templateName = extractTemplateName(submissionData.template_snapshot as any);
  const date = new Date(submissionData.created_at).toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statusBadge = submissionData.status === "completed" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#f2f2f2]/15 text-[#f2f2f2]">
      <CheckCircle2 size={11} />
      {ct(lang, "bilans.status.completed")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400">
      <Clock size={11} />
      {ct(lang, "bilans.status.in_progress")}
    </span>
  );

  const hasAnyResponse = blocks.some(
    (b: any) => Object.keys(responseMap[b.id] ?? {}).length > 0
  );

  return (
    <div className="min-h-dvh bg-[#0d0d0d] font-barlow overflow-x-hidden">
      <ClientTopBar
        section={ct(lang, "nav.bilans")}
        title={templateName}
        backHref="/client/bilans"
        right={statusBadge}
      />

      <main className="max-w-lg mx-auto flex flex-col gap-3 px-4 pb-5 pt-[104px]">

        {/* Date */}
        <p className="text-[11px] text-white/30 px-1">{date}</p>

        {/* Blocs */}
        {hasAnyResponse ? (
          blocks.map((block: any) => {
            const blockResponses = responseMap[block.id] ?? {};
            const filledFields = block.fields?.filter(
              (f: any) => blockResponses[f.key] !== undefined
            ) ?? [];
            if (filledFields.length === 0) return null;

            return (
              <div
                key={block.id}
                className="bg-white/[0.02] rounded-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b-[0.3px] border-white/[0.06]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    {block.label}
                  </p>
                </div>
                <div className="divide-y-[0.3px] divide-white/[0.06]">
                  {filledFields.map((field: any) => {
                    const val = blockResponses[field.key];
                    let display = String(val);
                    if (Array.isArray(val)) display = val.join(", ");
                    if (field.input_type === "photo_upload") display = ct(lang, "bilans.photoUploaded");

                    return (
                      <div
                        key={field.key}
                        className="flex justify-between items-start gap-4 px-4 py-3"
                      >
                        <span className="text-[12px] text-white/40 flex-1 leading-snug">
                          {field.label}
                        </span>
                        <span className="text-[12px] font-medium text-white text-right max-w-[55%] break-words leading-snug">
                          {display}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-[13px] text-white/30">{ct(lang, "bilans.noResponses")}</p>
          </div>
        )}

        {/* Coach feedback thread */}
        <div className="px-4 pb-6">
          <FeedbackThread entityType="bilan" entityId={params.submissionId} />
        </div>
      </main>
    </div>
  );
}
