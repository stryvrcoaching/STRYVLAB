"use client";

/**
 * Client booking flow — reserve a coaching call.
 * Flat Dark DA: soft surfaces, ultra-thin borders, progressive steps.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  Video,
  X,
} from "lucide-react";
import { type FreeSlot } from "@/lib/appointments/types";
import { cn } from "@/app/lib/utils";

interface ClientBookingFlowProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

function formatDayChip(dStr: string) {
  const d = new Date(`${dStr}T12:00:00`);
  return {
    weekday: new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(d),
    day: d.getDate(),
    month: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d),
    isToday: dStr === new Date().toISOString().slice(0, 10),
  };
}

function formatSlotTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatSelectedSummary(date: string, slot: FreeSlot) {
  const d = new Date(`${date}T12:00:00`);
  const dayLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return `${dayLabel} · ${formatSlotTime(slot.start)}`;
}

export default function ClientBookingFlow({
  onSuccess,
  onCancel,
}: ClientBookingFlowProps) {
  const next14Days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      }),
    [],
  );

  const [selectedDate, setSelectedDate] = useState<string>(next14Days[0] ?? "");
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<FreeSlot | null>(null);
  const [meetingKind, setMeetingKind] = useState<"video" | "phone">("video");
  const [clientMessage, setClientMessage] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    setError(null);

    fetch(`/api/client/appointments/slots?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setError("Impossible de charger les créneaux libres."))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate]);

  async function handleBook() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/client/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          starts_at: selectedSlot.start,
          ends_at: selectedSlot.end,
          meeting_kind: meetingKind,
          client_message: clientMessage.trim() || null,
        }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Erreur lors de la réservation.");
      }
    } catch {
      setError("Impossible de confirmer le rendez-vous.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="overflow-hidden rounded-[24px] border border-white/[0.04] bg-[#09090a]">
        <div className="flex flex-col items-center px-5 pb-6 pt-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f8a65]/12 text-[#5dba87]">
            <CheckCircle2 size={28} strokeWidth={1.75} />
          </div>
          <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-white">
            Appel réservé
          </h3>
          <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-white/45 text-pretty">
            Ton coach a été notifié. Le créneau est dans ton agenda.
          </p>
          {selectedSlot && selectedDate ? (
            <p className="mt-3 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white/70">
              {formatSelectedSummary(selectedDate, selectedSlot)}
              {" · "}
              {meetingKind === "video" ? "Visio" : "Téléphone"}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onSuccess}
            className="mt-6 flex min-h-11 w-full max-w-sm items-center justify-center rounded-2xl bg-[#1f8a65] text-[13px] font-semibold text-white transition-[transform,opacity] duration-150 active:scale-[0.96] hover:opacity-95"
          >
            Voir mes rendez-vous
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/[0.04] bg-[#09090a]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.04] px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1f8a65]/12 text-[#5dba87]">
            <CalendarIcon size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Nouvelle réservation
            </p>
            <h3 className="mt-1 text-[16px] font-semibold tracking-tight text-white">
              Réserver un appel
            </h3>
            <p className="mt-1 text-[12px] leading-snug text-white/40">
              Date → créneau → modalité
            </p>
          </div>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/70 active:scale-[0.96]"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="space-y-5 px-4 py-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2" aria-hidden>
          {[1, 2].map((n) => (
            <div key={n} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-200",
                  n === 1 || selectedSlot
                    ? "bg-[#1f8a65]"
                    : "bg-white/[0.06]",
                )}
              />
            </div>
          ))}
        </div>

        {/* ── Date ── */}
        <section className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              1 · Jour
            </p>
            {selectedDate ? (
              <p className="text-[11px] font-medium text-white/50">
                {formatDayChip(selectedDate).isToday
                  ? "Aujourd’hui"
                  : new Intl.DateTimeFormat("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    }).format(new Date(`${selectedDate}T12:00:00`))}
              </p>
            ) : null}
          </div>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {next14Days.map((dStr) => {
              const { weekday, day, month, isToday } = formatDayChip(dStr);
              const active = selectedDate === dStr;

              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => setSelectedDate(dStr)}
                  className={cn(
                    "flex min-w-[52px] shrink-0 flex-col items-center justify-center rounded-2xl px-2 py-2.5 transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
                    active
                      ? "bg-[#1f8a65] text-white shadow-[0_4px_16px_rgba(31,138,101,0.28)]"
                      : "bg-white/[0.03] text-white/50 hover:bg-white/[0.05] hover:text-white/70",
                  )}
                >
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-wide",
                      active ? "text-white/80" : "text-white/35",
                    )}
                  >
                    {isToday ? "Auj." : weekday.replace(".", "")}
                  </span>
                  <span className="mt-0.5 text-[15px] font-bold tabular-nums leading-none">
                    {day}
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-[9px] font-medium capitalize",
                      active ? "text-white/70" : "text-white/30",
                    )}
                  >
                    {month.replace(".", "")}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Slots ── */}
        {selectedDate ? (
          <section className="space-y-2.5">
            <div className="flex items-center gap-1.5 px-0.5">
              <Clock size={12} className="text-white/35" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                2 · Créneau
              </p>
            </div>

            {loadingSlots ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.02] py-8">
                <Loader2 size={16} className="animate-spin text-white/30" />
                <span className="text-[12px] text-white/35">Chargement…</span>
              </div>
            ) : null}

            {!loadingSlots && slots.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.02] px-4 py-6 text-center">
                <p className="text-[13px] font-medium text-white/50">
                  Aucun créneau libre
                </p>
                <p className="mt-1 text-[12px] text-white/30">
                  Essaie un autre jour.
                </p>
              </div>
            ) : null}

            {!loadingSlots && slots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot, idx) => {
                  const active = selectedSlot?.start === slot.start;
                  return (
                    <button
                      key={`${slot.start}-${idx}`}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "min-h-11 rounded-2xl text-[13px] font-semibold tabular-nums transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
                        active
                          ? "bg-[#1f8a65]/18 text-[#7fe0b8]"
                          : "bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white/80",
                      )}
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ── Modality + message + confirm ── */}
        {selectedSlot ? (
          <section className="space-y-4 border-t border-white/[0.04] pt-4">
            <div className="rounded-2xl bg-white/[0.03] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                Créneau choisi
              </p>
              <p className="mt-1 text-[13px] font-medium capitalize text-white">
                {formatSelectedSummary(selectedDate, selectedSlot)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                3 · Modalité
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setMeetingKind("video")}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-xl text-[12px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.98]",
                    meetingKind === "video"
                      ? "bg-[#121212] text-white shadow-sm"
                      : "text-white/40 hover:text-white/60",
                  )}
                >
                  <Video size={15} />
                  Visio
                </button>
                <button
                  type="button"
                  onClick={() => setMeetingKind("phone")}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-xl text-[12px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.98]",
                    meetingKind === "phone"
                      ? "bg-[#121212] text-white shadow-sm"
                      : "text-white/40 hover:text-white/60",
                  )}
                >
                  <Phone size={15} />
                  Téléphone
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="booking-message"
                className="block px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
              >
                Message{" "}
                <span className="font-medium normal-case tracking-normal text-white/25">
                  (optionnel)
                </span>
              </label>
              <textarea
                id="booking-message"
                value={clientMessage}
                onChange={(e) => setClientMessage(e.target.value)}
                placeholder="Objet de l’appel, points à aborder…"
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-2xl border-0 bg-[#0a0a0a] px-3.5 py-3 text-[13px] text-white placeholder:text-white/25 outline-none ring-1 ring-white/[0.06] transition-[box-shadow] focus:ring-[#1f8a65]/35"
              />
            </div>

            {error ? (
              <p className="rounded-xl bg-[#ff8660]/10 px-3 py-2 text-[12px] font-medium text-[#ff8660]">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2 pt-0.5">
              {onCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-2xl bg-white/[0.04] text-[13px] font-semibold text-white/55 transition-[background-color,transform] duration-150 hover:bg-white/[0.06] active:scale-[0.96]"
                >
                  Annuler
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleBook}
                disabled={submitting}
                className="flex min-h-11 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-[#1f8a65] text-[13px] font-semibold text-white transition-[transform,opacity] duration-150 active:scale-[0.96] hover:opacity-95 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : null}
                Confirmer
              </button>
            </div>
          </section>
        ) : null}

        {/* Hint when date selected but no slot yet */}
        {selectedDate && !selectedSlot && !loadingSlots && slots.length > 0 ? (
          <p className="text-center text-[12px] text-white/30">
            Choisis un horaire pour continuer
          </p>
        ) : null}
      </div>
    </div>
  );
}
