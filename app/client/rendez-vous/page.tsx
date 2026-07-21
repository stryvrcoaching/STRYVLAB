"use client";

/**
 * Page rendez-vous client STRYVR — liste, réservation, sheet détail.
 * DA alignée SurfaceCard / dashboard client.
 */

import { useEffect, useState } from "react";
import {
  Calendar,
  Video,
  Phone,
  MapPin,
  Clock,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  History,
  Plus,
} from "lucide-react";
import {
  appointmentStatusLabel,
  meetingKindLabel,
  type CoachingAppointmentClientView,
  type AppointmentStatus,
} from "@/lib/appointments/types";
import ClientBookingFlow from "@/components/client/appointments/ClientBookingFlow";
import ClientTopBar from "@/components/client/ClientTopBar";
import ClientAppointmentDetailSheet from "@/components/client/appointments/ClientAppointmentDetailSheet";
import { SurfaceCard } from "@/components/client/smart/SurfaceCard";
import { useClientT } from "@/components/client/ClientI18nProvider";
import { cn } from "@/app/lib/utils";

const STATUS_TONE: Record<AppointmentStatus, string> = {
  scheduled: "border-[#7aa7ff]/20 bg-[#7aa7ff]/10 text-[#7aa7ff]",
  awaiting_confirmation: "border-[#f2c94c]/20 bg-[#f2c94c]/10 text-[#f2c94c]",
  confirmed: "border-[#5dba87]/20 bg-[#5dba87]/10 text-[#5dba87]",
  reschedule_requested: "border-[#ff8660]/20 bg-[#ff8660]/10 text-[#ff8660]",
  cancelled: "border-white/10 bg-white/[0.04] text-white/40",
  completed: "border-white/10 bg-white/[0.04] text-white/40",
  no_show: "border-white/10 bg-white/[0.04] text-white/40",
};

const KIND_ICONS = {
  video: Video,
  phone: Phone,
  in_person: MapPin,
  other: Clock,
};

function formatDate(iso: string, lang: 'fr' | 'en' | 'es', timezone?: string) {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US', {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">
      {children}
    </p>
  );
}

function AppointmentCard({
  appt,
  prominent = false,
  onSelect,
}: {
  appt: CoachingAppointmentClientView;
  prominent?: boolean;
  onSelect: (id: string) => void;
}) {
  const { lang, t } = useClientT();
  const Icon = KIND_ICONS[appt.meeting_kind] ?? Clock;
  const isPast = new Date(appt.starts_at) < new Date();
  const canJoin =
    !!appt.meeting_url &&
    !isPast &&
    !["cancelled", "completed", "no_show"].includes(appt.status);
  const needsResponse = appt.status === "awaiting_confirmation";

  return (
    <SurfaceCard
      className={cn(
        "cursor-pointer border border-white/[0.04] bg-[#09090a] p-4 shadow-sm transition-transform active:scale-[0.99]",
        prominent && "border-[#5dba87]/20",
      )}
    >
      <button
        className="w-full text-left"
        onClick={() => onSelect(appt.id)}
        type="button"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.03]",
              prominent ? "text-[#5dba87]" : "text-white/50",
            )}
          >
            <Icon size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                  {meetingKindLabel(appt.meeting_kind, lang)}
                  {appt.coach_name ? ` · ${appt.coach_name}` : ""}
                </p>
                <p className="mt-1 text-[14px] font-medium leading-snug text-white">
                  {appt.title}
                </p>
                <p className="mt-1 text-[12px] capitalize text-white/50">
                  {formatDate(appt.starts_at, lang, appt.client_timezone)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                  STATUS_TONE[appt.status],
                )}
              >
                {appointmentStatusLabel(appt.status, lang)}
              </span>
            </div>

            {prominent && appt.client_message && (
              <p className="mt-3 line-clamp-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-white/45">
                {appt.client_message}
              </p>
            )}
          </div>
        </div>
      </button>

      <div className="mt-3 flex items-center gap-2 border-t border-white/[0.05] pt-3">
        {canJoin && (
          <a
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#1f8a65] px-3 text-[11px] font-semibold text-white transition-transform active:scale-[0.96]"
            href={appt.meeting_url!}
            onClick={(e) => e.stopPropagation()}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink size={12} />
            {t('rdv.join')}
          </a>
        )}
        {needsResponse && (
          <button
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#f2c94c]/20 bg-[#f2c94c]/10 px-3 text-[11px] font-semibold text-[#f2c94c] transition-transform active:scale-[0.96]"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(appt.id);
            }}
            type="button"
          >
            <AlertCircle size={12} />
            {t('rdv.reply')}
          </button>
        )}
        <button
          className="ml-auto inline-flex min-h-9 items-center gap-0.5 text-[11px] font-medium text-white/40 transition-colors hover:text-white/70"
          onClick={() => onSelect(appt.id)}
          type="button"
        >
          {t('rdv.viewDetail')} <ChevronRight size={12} />
        </button>
      </div>
    </SurfaceCard>
  );
}

export default function ClientRendezVousPage() {
  const { t } = useClientT();
  const [upcoming, setUpcoming] = useState<CoachingAppointmentClientView[]>(
    [],
  );
  const [history, setHistory] = useState<CoachingAppointmentClientView[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingMode, setBookingMode] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("booking") === "true") setBookingMode(true);
      const openId = params.get("appointmentId") || params.get("id");
      if (openId) setSelectedAppointmentId(openId);
    }
  }, []);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/client/appointments?scope=upcoming").then((r) => r.json()),
      fetch("/api/client/appointments?scope=history").then((r) => r.json()),
    ])
      .then(([up, hist]) => {
        setUpcoming(Array.isArray(up) ? up : []);
        setHistory(Array.isArray(hist) ? hist.slice(0, 10) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const [next, ...rest] = upcoming;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#121212] font-barlow">
      <ClientTopBar title={t("rdv.title")} />

      <main className="client-page-top mx-auto flex max-w-lg flex-col gap-5 px-4 pb-28">
        {bookingMode ? (
          <ClientBookingFlow
            onCancel={() => setBookingMode(false)}
            onSuccess={() => {
              setBookingMode(false);
              fetchAll();
            }}
          />
        ) : (
          <SurfaceCard className="border border-white/[0.04] bg-[#09090a] p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f8a65]/12 text-[#5dba87]">
              <Calendar size={20} strokeWidth={1.75} />
            </div>
            <h2 className="mt-3.5 text-[15px] font-semibold tracking-tight text-white">
              {t('rdv.bookPrompt.title')}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/45 text-pretty">
              {t('rdv.bookPrompt.desc')}
            </p>
            <button
              className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#1f8a65] text-[13px] font-semibold text-white transition-[transform,opacity] duration-150 active:scale-[0.96] hover:opacity-95"
              onClick={() => setBookingMode(true)}
              type="button"
            >
              <Plus size={15} strokeWidth={2.25} />
              {t('rdv.bookPrompt.action')}
            </button>
          </SurfaceCard>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                className="h-28 animate-pulse rounded-[24px] border border-white/[0.04] bg-[#09090a]"
                key={i}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {next && (
              <section className="space-y-2.5">
                <SectionLabel>{t('rdv.next')}</SectionLabel>
                <AppointmentCard
                  appt={next}
                  onSelect={setSelectedAppointmentId}
                  prominent
                />
              </section>
            )}

            {rest.length > 0 && (
              <section className="space-y-2.5">
                <SectionLabel>{t('rdv.upcoming')}</SectionLabel>
                <div className="space-y-2.5">
                  {rest.map((appt) => (
                    <AppointmentCard
                      appt={appt}
                      key={appt.id}
                      onSelect={setSelectedAppointmentId}
                    />
                  ))}
                </div>
              </section>
            )}

            {upcoming.length === 0 && !bookingMode && (
              <SurfaceCard className="border border-white/[0.04] bg-[#09090a] px-5 py-8 text-center">
                <p className="text-[13px] font-medium text-white/50">
                  {t('rdv.empty.title')}
                </p>
                <p className="mt-1 text-[12px] text-white/35">
                  {t('rdv.empty.desc')}
                </p>
              </SurfaceCard>
            )}

            {history.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 px-0.5">
                  <History size={11} className="text-white/35" />
                  <SectionLabel>{t('rdv.recentHistory')}</SectionLabel>
                </div>
                <div className="space-y-2.5">
                  {history.map((appt) => (
                    <AppointmentCard
                      appt={appt}
                      key={appt.id}
                      onSelect={setSelectedAppointmentId}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <ClientAppointmentDetailSheet
        appointmentId={selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
        onStatusChanged={fetchAll}
      />
    </div>
  );
}
