"use client";

/**
 * Bottom sheet détail RDV client — DA SurfaceCard / sheet system STRYVR.
 * Actions : confirmer, demander un report, se désister, rejoindre l’appel.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  X,
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
import useBodyScrollLock from "@/components/client/useBodyScrollLock";
import { SurfaceCard } from "@/components/client/smart/SurfaceCard";

const STATUS_TONE: Record<
  AppointmentStatus,
  { badge: string; text: string }
> = {
  scheduled: {
    badge: "border-[#7aa7ff]/20 bg-[#7aa7ff]/10",
    text: "text-[#7aa7ff]",
  },
  awaiting_confirmation: {
    badge: "border-[#f2c94c]/20 bg-[#f2c94c]/10",
    text: "text-[#f2c94c]",
  },
  confirmed: {
    badge: "border-[#5dba87]/20 bg-[#5dba87]/10",
    text: "text-[#5dba87]",
  },
  reschedule_requested: {
    badge: "border-[#ff8660]/20 bg-[#ff8660]/10",
    text: "text-[#ff8660]",
  },
  cancelled: {
    badge: "border-white/10 bg-white/[0.04]",
    text: "text-white/45",
  },
  completed: {
    badge: "border-white/10 bg-white/[0.04]",
    text: "text-white/40",
  },
  no_show: {
    badge: "border-white/10 bg-white/[0.04]",
    text: "text-white/40",
  },
};

const KIND_ICONS = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
  other: Clock,
};

function formatFullDate(iso: string, tz?: string) {
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

interface Props {
  appointmentId: string | null;
  onClose: () => void;
  onStatusChanged?: () => void;
}

export default function ClientAppointmentDetailSheet({
  appointmentId,
  onClose,
  onStatusChanged,
}: Props) {
  const isOpen = Boolean(appointmentId);
  useBodyScrollLock(isOpen);

  const [mounted, setMounted] = useState(false);
  const [appt, setAppt] = useState<CoachingAppointmentClientView | null>(null);
  const [loading, setLoading] = useState(false);
  const [respondLoading, setRespondLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("default");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!appointmentId) {
      setAppt(null);
      setMode("default");
      setReason("");
      setFeedback(null);
      return;
    }

    setLoading(true);
    setFeedback(null);
    setMode("default");
    setReason("");
    fetch(`/api/client/appointments/${appointmentId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Impossible de charger le rendez-vous.");
        return r.json();
      })
      .then((data) => setAppt(data))
      .catch((err) => {
        setFeedback({
          type: "error",
          message: err instanceof Error ? err.message : "Erreur",
        });
      })
      .finally(() => setLoading(false));
  }, [appointmentId]);

  async function handleRespond(
    action: "confirm" | "request_reschedule" | "cancel",
  ) {
    if (!appointmentId) return;
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
      if (!res.ok) throw new Error(json?.error ?? "Une erreur est survenue.");

      const messages = {
        confirm: "Rendez-vous confirmé.",
        request_reschedule: "Demande de report envoyée à ton coach.",
        cancel: "Tu t’es désisté·e. Ton coach a été prévenu.",
      } as const;

      setFeedback({ type: "success", message: messages[action] });
      onStatusChanged?.();

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

  if (!isOpen || !mounted) return null;

  const Icon = appt ? (KIND_ICONS[appt.meeting_kind] ?? Clock) : Clock;
  const statusTone = appt ? STATUS_TONE[appt.status] : null;
  const isPast = appt ? new Date(appt.starts_at) < new Date() : false;
  const canJoin = appt
    ? !!appt.meeting_url &&
      !isPast &&
      !["cancelled", "completed", "no_show"].includes(appt.status)
    : false;
  const durationMin = appt
    ? appointmentDurationMinutes(appt as { starts_at: string; ends_at: string })
    : 0;
  const showRespond = appt ? canClientRespond(appt) : false;
  const showCancel = appt ? canClientCancel(appt) : false;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-[70] flex max-h-[88dvh] flex-col rounded-t-[28px] border-t border-white/[0.08] bg-[#0d0d0d] shadow-2xl"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/[0.10]" />

        <div className="flex shrink-0 items-center justify-between px-5 pb-4 pt-5">
          <p className="font-barlow-condensed text-[15px] font-bold uppercase tracking-[0.12em] text-white">
            Rendez-vous
          </p>
          <button
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/45 transition-colors active:bg-white/[0.08]"
            onClick={onClose}
            type="button"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
              <Loader2 size={22} className="animate-spin text-[#1f8a65]" />
              <p className="text-xs text-white/40">Chargement…</p>
            </div>
          ) : !appt ? (
            <div className="py-12 text-center">
              <AlertCircle size={22} className="mx-auto text-white/25" />
              <p className="mt-2 text-xs text-white/40">
                Impossible de charger ce rendez-vous.
              </p>
            </div>
          ) : (
            <>
              <SurfaceCard className="border border-white/[0.04] bg-[#09090a] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.03] text-[#5dba87]">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                          {meetingKindLabel(appt.meeting_kind)}
                        </p>
                        <h3 className="mt-1 text-[15px] font-medium leading-snug text-white">
                          {appt.title}
                        </h3>
                        {appt.coach_name && (
                          <p className="mt-0.5 text-[12px] text-white/40">
                            avec {appt.coach_name}
                          </p>
                        )}
                      </div>
                      {statusTone && (
                        <span
                          className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusTone.badge} ${statusTone.text}`}
                        >
                          {appointmentStatusLabel(appt.status)}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 space-y-2 border-t border-white/[0.05] pt-3">
                      <div className="flex items-center gap-2.5">
                        <Calendar size={13} className="shrink-0 text-white/30" />
                        <span className="text-[12px] font-medium capitalize text-white/70">
                          {formatFullDate(appt.starts_at, appt.client_timezone)}
                        </span>
                      </div>
                      {durationMin > 0 && (
                        <div className="flex items-center gap-2.5">
                          <Clock size={13} className="shrink-0 text-white/30" />
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
                  <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-white/55 text-pretty">
                    {appt.client_message}
                  </p>
                </SurfaceCard>
              )}

              {feedback && (
                <div
                  className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 ${
                    feedback.type === "success"
                      ? "border-[#5dba87]/20 bg-[#5dba87]/10 text-[#5dba87]"
                      : "border-[#ff8660]/20 bg-[#ff8660]/10 text-[#ff8660]"
                  }`}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 size={14} className="shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="shrink-0" />
                  )}
                  <p className="text-[12px] font-medium">{feedback.message}</p>
                </div>
              )}

              {appt.status === "cancelled" && appt.cancel_reason && (
                <SurfaceCard className="border border-white/[0.04] bg-[#09090a] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Motif d’annulation
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/55">
                    {appt.cancel_reason}
                  </p>
                </SurfaceCard>
              )}

              {appt.status === "reschedule_requested" &&
                appt.reschedule_reason && (
                  <SurfaceCard className="border border-white/[0.04] bg-[#09090a] p-4">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                      Ta demande de report
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-white/55">
                      {appt.reschedule_reason}
                    </p>
                  </SurfaceCard>
                )}

              {/* Confirm / reschedule */}
              {showRespond && mode === "default" && !feedback && (
                <SurfaceCard className="border border-[#f2c94c]/15 bg-[#09090a] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#f2c94c]">
                    Réponse requise
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/50">
                    Confirme ta présence ou propose un autre créneau à ton
                    coach.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f8a65] text-[12px] font-semibold text-white transition-[transform,opacity] duration-150 active:scale-[0.96] disabled:opacity-50"
                      disabled={respondLoading}
                      onClick={() => void handleRespond("confirm")}
                      type="button"
                    >
                      {respondLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      Confirmer l’appel
                    </button>
                    <button
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[12px] font-medium text-white/70 transition-[transform,background-color] duration-150 active:scale-[0.96]"
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
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Demande de report
                  </p>
                  <textarea
                    className="mt-3 w-full resize-none rounded-xl border border-white/[0.08] bg-[#0a0a0a] px-3 py-2.5 text-[12px] text-white placeholder:text-white/30 focus:border-[#1f8a65]/40 focus:outline-none"
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Indique pourquoi ou propose d’autres créneaux (optionnel)"
                    rows={3}
                    value={reason}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      className="min-h-11 flex-1 rounded-xl text-[12px] font-medium text-white/45"
                      onClick={() => {
                        setMode("default");
                        setReason("");
                      }}
                      type="button"
                    >
                      Retour
                    </button>
                    <button
                      className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#ff8660]/25 bg-[#ff8660]/10 text-[12px] font-semibold text-[#ff8660] transition-transform active:scale-[0.96] disabled:opacity-50"
                      disabled={respondLoading}
                      onClick={() => void handleRespond("request_reschedule")}
                      type="button"
                    >
                      {respondLoading && (
                        <Loader2 size={12} className="animate-spin" />
                      )}
                      Envoyer
                    </button>
                  </div>
                </SurfaceCard>
              )}

              {mode === "cancel" && (
                <SurfaceCard className="border border-white/[0.04] bg-[#09090a] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Se désister
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/50">
                    L’appel sera annulé et ton coach sera prévenu. Tu pourras
                    réserver un nouveau créneau ensuite.
                  </p>
                  <textarea
                    className="mt-3 w-full resize-none rounded-xl border border-white/[0.08] bg-[#0a0a0a] px-3 py-2.5 text-[12px] text-white placeholder:text-white/30 focus:border-[#1f8a65]/40 focus:outline-none"
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Motif (optionnel)"
                    rows={2}
                    value={reason}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      className="min-h-11 flex-1 rounded-xl text-[12px] font-medium text-white/45"
                      onClick={() => {
                        setMode("default");
                        setReason("");
                      }}
                      type="button"
                    >
                      Garder l’appel
                    </button>
                    <button
                      className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] text-[12px] font-semibold text-white/80 transition-transform active:scale-[0.96] disabled:opacity-50"
                      disabled={respondLoading}
                      onClick={() => void handleRespond("cancel")}
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
            </>
          )}
        </div>

        {/* Sticky footer actions */}
        {appt && !loading && mode === "default" && (
          <div className="shrink-0 space-y-2 border-t border-white/[0.06] px-5 pt-3">
            {canJoin && (
              <a
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f8a65] text-[12px] font-semibold text-white transition-[transform,opacity] duration-150 active:scale-[0.96] hover:opacity-95"
                href={appt.meeting_url!}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink size={13} />
                Rejoindre l’appel
              </a>
            )}
            {showCancel && !feedback && (
              <button
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent text-[12px] font-medium text-white/45 transition-colors hover:text-white/70"
                onClick={() => setMode("cancel")}
                type="button"
              >
                <UserX size={13} />
                Se désister de cet appel
              </button>
            )}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
