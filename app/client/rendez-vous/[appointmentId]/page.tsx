"use client";

/**
 * Deep-link détail RDV — même DA que le sheet, actions alignées.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  Video,
  Phone,
  MapPin,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
  UserX,
} from "lucide-react";
import {
  appointmentStatusLabel,
  appointmentDurationMinutes,
  canClientRespond,
  canClientCancel,
  meetingKindLabel,
  type CoachingAppointmentClientView,
  type AppointmentStatus,
} from "@/lib/appointments/types";
import ClientTopBar from "@/components/client/ClientTopBar";
import { useClientT } from "@/components/client/ClientI18nProvider";
import { SurfaceCard } from "@/components/client/smart/SurfaceCard";

const STATUS_TONE: Record<AppointmentStatus, string> = {
  scheduled: "border-[#7aa7ff]/20 bg-[#7aa7ff]/10 text-[#7aa7ff]",
  awaiting_confirmation: "border-[#f2c94c]/20 bg-[#f2c94c]/10 text-[#f2c94c]",
  confirmed: "border-[#5dba87]/20 bg-[#5dba87]/10 text-[#5dba87]",
  reschedule_requested: "border-[#ff8660]/20 bg-[#ff8660]/10 text-[#ff8660]",
  cancelled: "border-white/10 bg-white/[0.04] text-white/40",
  completed: "border-white/10 bg-white/[0.04] text-white/40",
  no_show: "border-white/10 bg-white/[0.04] text-white/40",
};

const KIND_ICONS = { video: Video, phone: Phone, in_person: MapPin, other: Clock };

function formatFull(iso: string, tz?: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

type Mode = "default" | "reschedule" | "cancel";

export default function AppointmentDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const { t } = useClientT();

  const [appt, setAppt] = useState<CoachingAppointmentClientView | null>(null);
  const [loading, setLoading] = useState(true);
  const [respondLoading, setRespondLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("default");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/client/appointments/${appointmentId}`)
      .then((r) => r.json())
      .then((data) => setAppt(data))
      .catch(() => setAppt(null))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  async function respond(action: "confirm" | "request_reschedule" | "cancel") {
    setRespondLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/client/appointments/${appointmentId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            reason: reason.trim() || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erreur");

      const messages = {
        confirm: "Rendez-vous confirmé.",
        request_reschedule: "Demande de report envoyée à ton coach.",
        cancel: "Tu t’es désisté·e. Ton coach a été prévenu.",
      } as const;

      setFeedback({ type: "success", message: messages[action] });
      const updated = await fetch(
        `/api/client/appointments/${appointmentId}`,
      ).then((r) => r.json());
      setAppt(updated);
      setMode("default");
      setReason("");
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur",
      });
    } finally {
      setRespondLoading(false);
    }
  }

  const Icon = appt ? (KIND_ICONS[appt.meeting_kind] ?? Clock) : Clock;
  const isPast = appt ? new Date(appt.starts_at) < new Date() : false;
  const canJoin = appt
    ? !!appt.meeting_url &&
      !isPast &&
      !["cancelled", "completed", "no_show"].includes(appt.status)
    : false;
  const durationMin = appt
    ? appointmentDurationMinutes(appt as { starts_at: string; ends_at: string })
    : 0;

  return (
    <div className="min-h-dvh bg-[#121212] font-barlow">
      <ClientTopBar title={t("rdv.detail")} backHref="/client/rendez-vous" />

      <main className="client-page-top mx-auto flex max-w-lg flex-col gap-3 px-4 pb-28">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={22} className="animate-spin text-[#1f8a65]" />
            <p className="text-xs text-white/40">Chargement…</p>
          </div>
        ) : !appt ? (
          <SurfaceCard className="border border-white/[0.04] bg-[#09090a] py-12 text-center">
            <AlertCircle size={22} className="mx-auto text-white/25" />
            <p className="mt-2 text-xs text-white/40">Rendez-vous introuvable.</p>
          </SurfaceCard>
        ) : (
          <>
            <SurfaceCard className="border border-white/[0.04] bg-[#09090a] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.03] text-[#5dba87]">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                        {meetingKindLabel(appt.meeting_kind)}
                      </p>
                      <h1 className="mt-1 text-[16px] font-medium text-white">
                        {appt.title}
                      </h1>
                      {appt.coach_name && (
                        <p className="mt-0.5 text-[12px] text-white/40">
                          avec {appt.coach_name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_TONE[appt.status]}`}
                    >
                      {appointmentStatusLabel(appt.status)}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 border-t border-white/[0.05] pt-3">
                    <div className="flex items-center gap-2.5">
                      <Calendar size={13} className="text-white/30" />
                      <span className="text-[12px] capitalize text-white/70">
                        {formatFull(appt.starts_at, appt.client_timezone)}
                      </span>
                    </div>
                    {durationMin > 0 && (
                      <div className="flex items-center gap-2.5">
                        <Clock size={13} className="text-white/30" />
                        <span className="text-[12px] text-white/50">
                          {durationMin} min
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SurfaceCard>

            {appt.client_message && (
              <SurfaceCard className="border border-white/[0.04] bg-[#09090a] p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare size={13} className="text-[#5dba87]" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Préparation
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-white/55">
                  {appt.client_message}
                </p>
              </SurfaceCard>
            )}

            {feedback && (
              <div
                className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-[12px] font-medium ${
                  feedback.type === "success"
                    ? "border-[#5dba87]/20 bg-[#5dba87]/10 text-[#5dba87]"
                    : "border-[#ff8660]/20 bg-[#ff8660]/10 text-[#ff8660]"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <AlertCircle size={14} />
                )}
                {feedback.message}
              </div>
            )}

            {canJoin && (
              <a
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f8a65] text-[12px] font-semibold text-white active:scale-[0.96]"
                href={appt.meeting_url!}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink size={13} />
                Rejoindre l’appel
              </a>
            )}

            {canClientRespond(appt) && mode === "default" && !feedback && (
              <SurfaceCard className="border border-[#f2c94c]/15 bg-[#09090a] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#f2c94c]">
                  Réponse requise
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1f8a65] text-[12px] font-semibold text-white disabled:opacity-50"
                    disabled={respondLoading}
                    onClick={() => void respond("confirm")}
                    type="button"
                  >
                    {respondLoading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}
                    Confirmer
                  </button>
                  <button
                    className="flex min-h-11 items-center justify-center rounded-xl border border-white/[0.08] text-[12px] font-medium text-white/70"
                    onClick={() => setMode("reschedule")}
                    type="button"
                  >
                    Proposer un report
                  </button>
                </div>
              </SurfaceCard>
            )}

            {mode === "reschedule" && (
              <SurfaceCard className="border border-white/[0.04] bg-[#09090a] p-4">
                <textarea
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#0a0a0a] px-3 py-2.5 text-[12px] text-white placeholder:text-white/30 focus:border-[#1f8a65]/40 focus:outline-none"
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motif ou autres créneaux (optionnel)"
                  rows={3}
                  value={reason}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    className="min-h-11 flex-1 text-[12px] text-white/45"
                    onClick={() => {
                      setMode("default");
                      setReason("");
                    }}
                    type="button"
                  >
                    Retour
                  </button>
                  <button
                    className="min-h-11 flex-1 rounded-xl border border-[#ff8660]/25 bg-[#ff8660]/10 text-[12px] font-semibold text-[#ff8660] disabled:opacity-50"
                    disabled={respondLoading}
                    onClick={() => void respond("request_reschedule")}
                    type="button"
                  >
                    Envoyer
                  </button>
                </div>
              </SurfaceCard>
            )}

            {mode === "cancel" && (
              <SurfaceCard className="border border-white/[0.04] bg-[#09090a] p-4">
                <p className="text-[12px] text-white/50">
                  L’appel sera annulé et ton coach sera prévenu.
                </p>
                <textarea
                  className="mt-3 w-full resize-none rounded-xl border border-white/[0.08] bg-[#0a0a0a] px-3 py-2.5 text-[12px] text-white placeholder:text-white/30 focus:outline-none"
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motif (optionnel)"
                  rows={2}
                  value={reason}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    className="min-h-11 flex-1 text-[12px] text-white/45"
                    onClick={() => {
                      setMode("default");
                      setReason("");
                    }}
                    type="button"
                  >
                    Garder l’appel
                  </button>
                  <button
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 text-[12px] font-semibold text-white/80 disabled:opacity-50"
                    disabled={respondLoading}
                    onClick={() => void respond("cancel")}
                    type="button"
                  >
                    {respondLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <UserX size={12} />
                    )}
                    Confirmer
                  </button>
                </div>
              </SurfaceCard>
            )}

            {canClientCancel(appt) && mode === "default" && !feedback && (
              <button
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] text-[12px] font-medium text-white/45 hover:text-white/70"
                onClick={() => setMode("cancel")}
                type="button"
              >
                <UserX size={13} />
                Se désister de cet appel
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
