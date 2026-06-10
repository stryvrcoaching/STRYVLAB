import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { resolveClientFromUser } from "@/lib/client/resolve-client";
import { ct, ctp, type ClientLang } from '@/lib/i18n/clientTranslations'
import Link from "next/link";
import {
  ClipboardList,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  PenLine,
  Clock,
} from "lucide-react";
import ClientTopBar from "@/components/client/ClientTopBar";

function StatusBadge({ status, lang }: { status: string; lang: ClientLang }) {
  const labelMap: Record<string, string> = {
    pending:     ct(lang, 'bilans.status.pending'),
    in_progress: ct(lang, 'bilans.status.in_progress'),
    completed:   ct(lang, 'bilans.status.completed'),
    expired:     ct(lang, 'bilans.status.expired'),
  }
  const classMap: Record<string, string> = {
    pending:     'bg-amber-500/15 text-amber-400',
    in_progress: 'bg-blue-500/15 text-blue-400',
    completed:   'bg-[#f2f2f2]/15 text-[#f2f2f2]',
    expired:     'bg-white/[0.06] text-white/30',
  }
  const label = labelMap[status] ?? labelMap.pending
  const cls   = classMap[status] ?? classMap.pending
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  )
}

export default async function ClientBilansPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  if (!user) redirect('/client/login');

  const client = await resolveClientFromUser(user.id, user.email, service);

  const prefsRes = client
    ? await service.from('client_preferences').select('language').eq('client_id', client.id).maybeSingle()
    : { data: null }
  const rawLang = (prefsRes as any)?.data?.language
  const lang: ClientLang = ['fr', 'en', 'es'].includes(rawLang) ? rawLang as ClientLang : 'fr'
  const dateLocale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB'

  const { data: submissionsData } = client
    ? await service
        .from("assessment_submissions")
        .select(
          "id, status, created_at, submitted_at, template_snapshot, token, token_expires_at",
        )
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const submissions = (submissionsData || []) as any[];

  const pending = submissions.filter((s) => {
    const expired =
      s.status === "expired" ||
      (s.token_expires_at && new Date(s.token_expires_at) < new Date());
    return (s.status === "pending" || s.status === "in_progress") && !expired;
  });

  const history = submissions.filter((s) => {
    const expired =
      s.status === "expired" ||
      (s.token_expires_at && new Date(s.token_expires_at) < new Date());
    return s.status === "completed" || s.status === "expired" || expired;
  });

  return (
    <div className="min-h-screen bg-[#0d0d0d] font-barlow">
      <ClientTopBar
        section={ct(lang, 'bilans.section')}
        title={ct(lang, 'bilans.title')}
        right={
          <span className="text-[11px] font-medium text-white/30">
            {ctp(lang, 'bilans.count', submissions.length)}
          </span>
        }
      />

      <main className="max-w-lg mx-auto px-4 pt-[88px] pb-5 flex flex-col gap-6">

        {/* ── État vide ── */}
        {submissions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center">
              <ClipboardList size={22} className="text-white/20" />
            </div>
            <p className="text-[13px] font-medium text-white/40">
              {ct(lang, 'bilans.empty.title')}
            </p>
            <p className="text-[11px] text-white/20 text-center max-w-[200px]">
              {ct(lang, 'bilans.empty.desc')}
            </p>
          </div>
        )}

        {/* ── À faire ── */}
        {pending.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/80">
                {ct(lang, 'bilans.todo.section')}
              </p>
              <span className="w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pending.length}
              </span>
            </div>
            {pending.map((sub) => {
              const name = sub.template_snapshot?.name ?? "Bilan";
              const date = new Date(sub.created_at).toLocaleDateString(
                dateLocale,
                { day: "numeric", month: "long" },
              );
              return (
                <div
                  key={sub.id}
                  className="bg-amber-500/[0.04] rounded-xl border-[0.3px] border-amber-500/20 overflow-hidden"
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Clock size={18} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">
                        {name}
                      </p>
                      <p className="text-[11px] text-white/40 mt-0.5">
                        {ct(lang, 'bilans.todo.sentOn')} {date}
                      </p>
                    </div>
                    <StatusBadge status={sub.status} lang={lang} />
                  </div>
                  <div className="px-4 pb-4">
                    <Link
                      href={`/bilan/${sub.token}`}
                      className="flex h-10 items-center justify-between rounded-xl bg-amber-500 pl-4 pr-2 transition-all hover:bg-amber-400 active:scale-[0.99]"
                    >
                      <span className="text-[12px] font-bold uppercase tracking-[0.10em] text-white">
                        {ct(lang, 'bilans.todo.cta')}
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-black/[0.12]">
                        <PenLine size={13} className="text-white" />
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ── Historique ── */}
        {history.length > 0 && (
          <section className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 px-1">
              {ct(lang, 'bilans.history.section')}
            </p>
            <div className="bg-[#161616] rounded-xl overflow-hidden">
              {history.map((sub) => {
                const name = sub.template_snapshot?.name ?? "Bilan";
                const isExpired =
                  sub.status === "expired" ||
                  (sub.token_expires_at &&
                    new Date(sub.token_expires_at) < new Date());
                const effectiveStatus = isExpired ? "expired" : sub.status;
                const date = new Date(
                  sub.submitted_at ?? sub.created_at,
                ).toLocaleDateString(dateLocale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });

                return (
                  <div
                    key={sub.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                      {effectiveStatus === "completed" ? (
                        <CheckCircle2 size={15} className="text-[#f2f2f2]" />
                      ) : (
                        <AlertCircle size={15} className="text-white/20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white/80 truncate">
                        {name}
                      </p>
                      <p className="text-[11px] text-white/30 mt-0.5">{date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={effectiveStatus} lang={lang} />
                      {effectiveStatus === "completed" && (
                        <Link
                          href={`/client/bilans/${sub.id}`}
                          className="text-white/20 hover:text-white/50 transition-colors"
                        >
                          <ChevronRight size={15} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
