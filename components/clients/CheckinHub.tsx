"use client";

import { useEffect, useState, type ElementType } from "react";
import {
  Activity,
  BatteryCharging,
  CalendarCheck,
  Flame,
  Moon,
  Brain,
  Utensils,
  Dumbbell,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Heatmap = Record<string, { morning?: boolean; evening?: boolean; late?: boolean }>;
type SummaryResponse = {
  field_averages: Record<string, number>;
  response_rate: number | null;
  configured_days_count: number;
  streak: Record<string, unknown> | null;
  config: { is_active?: boolean; days_of_week?: number[]; moments?: Array<{ moment: string; fields: string[] }> } | null;
  heatmap: Heatmap;
  responses_by_date: Record<string, Array<{ moment: string; responses: Record<string, number>; is_late?: boolean }>>;
};

type HistoryResponse = {
  data: Array<{ moment: "morning" | "evening"; responses: Record<string, number>; responded_at: string }>;
  total: number;
};

const PERIODS = [30, 60, 90] as const;
type Period = (typeof PERIODS)[number];

const FIELD_META: Record<string, { label: string; icon: ElementType; suffix: string }> = {
  energy: { label: "Énergie", icon: BatteryCharging, suffix: "/5" },
  sleep_duration: { label: "Sommeil", icon: Moon, suffix: "h" },
  sleep_quality: { label: "Qualité sommeil", icon: Moon, suffix: "/4" },
  stress: { label: "Stress", icon: Brain, suffix: "/5" },
  hunger: { label: "Faim", icon: Utensils, suffix: "/4" },
  muscle_soreness: { label: "Courbatures", icon: Dumbbell, suffix: "/4" },
  weight_kg: { label: "Poids", icon: Activity, suffix: " kg" },
  rhr_morning: { label: "FC repos", icon: Activity, suffix: " bpm" },
  daily_steps: { label: "Pas", icon: Flame, suffix: "" },
};

function fmtDateShort(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  const months = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

function buildPeriodDays(period: Period): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">{eyebrow}</p>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        {detail ? <p className="text-[11px] text-white/40">{detail}</p> : null}
      </div>
    </div>
  );
}

function StatTile({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: ElementType }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04]">
          <Icon size={14} className="text-white/55" />
        </div>
      </div>
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/45">{detail}</p>
    </div>
  );
}

function streakValue(streak: Record<string, unknown> | null): number {
  if (!streak) return 0;
  return Number(streak.current_streak ?? streak.current ?? streak.streak ?? 0) || 0;
}

export default function CheckinHub({ clientId }: { clientId: string }) {
  const [period, setPeriod] = useState<Period>(30);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillDate, setDrillDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/clients/${clientId}/checkin-summary?days=${period}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`/api/clients/${clientId}/checkin-history?limit=30`).then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([s, h]) => {
        if (cancelled) return;
        setSummary(s);
        setHistory(h);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Impossible de charger les check-ins");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, period]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <p className="text-[13px] text-white/50">{error ?? "Aucune donnée"}</p>
      </div>
    );
  }

  if (!summary.config?.is_active) {
    return (
      <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-2">
        <CalendarCheck size={22} className="mx-auto text-white/30" />
        <p className="text-[14px] font-semibold text-white">Check-ins non activés</p>
        <p className="text-[12px] text-white/45 max-w-[40ch] mx-auto leading-relaxed">
          Active et configure les check-ins quotidiens depuis la section <strong>IA Coach</strong> du profil client.
        </p>
      </div>
    );
  }

  const days = buildPeriodDays(period);
  const respondedDays = days.filter((d) => {
    const c = summary.heatmap[d];
    return c && (c.morning || c.evening);
  }).length;
  const avgKeys = Object.keys(summary.field_averages);

  return (
    <div className="space-y-6">
      {/* Header + period selector */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <SectionHeader
          eyebrow="Suivi quotidien"
          title="Check-ins"
          detail={`${respondedDays}/${days.length} jours renseignés`}
        />
        <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                period === p ? "bg-[#1f8a65]/15 text-[#7fe2bf]" : "text-white/45 hover:text-white/70"
              }`}
            >
              {p}j
            </button>
          ))}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Taux de réponse"
          value={summary.response_rate != null ? `${summary.response_rate}%` : "—"}
          detail={`sur ${summary.configured_days_count} jours configurés`}
          icon={Activity}
        />
        <StatTile
          label="Série en cours"
          value={`${streakValue(summary.streak)} j`}
          detail="jours consécutifs"
          icon={Flame}
        />
        <StatTile
          label="Jours renseignés"
          value={`${respondedDays}`}
          detail={`sur ${days.length} derniers jours`}
          icon={CalendarCheck}
        />
        {avgKeys.length > 0 && (
          <StatTile
            label={FIELD_META[avgKeys[0]]?.label ?? avgKeys[0]}
            value={`${summary.field_averages[avgKeys[0]]}${FIELD_META[avgKeys[0]]?.suffix ?? ""}`}
            detail="moyenne période"
            icon={FIELD_META[avgKeys[0]]?.icon ?? Activity}
          />
        )}
      </div>

      {/* Field averages */}
      {avgKeys.length > 0 && (
        <div className="space-y-3">
          <SectionHeader eyebrow="Moyennes" title="Ressenti moyen" detail={`${period} derniers jours`} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {avgKeys.map((key) => {
              const meta = FIELD_META[key];
              const Icon = meta?.icon ?? Activity;
              return (
                <div key={key} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] shrink-0">
                    <Icon size={14} className="text-white/55" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 truncate">{meta?.label ?? key}</p>
                    <p className="text-[15px] font-semibold text-white">
                      {summary.field_averages[key]}
                      <span className="text-[11px] text-white/40">{meta?.suffix ?? ""}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="space-y-3">
        <SectionHeader eyebrow="Calendrier" title="Régularité" detail={`${period} derniers jours`} />
        <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {days.map((date) => {
              const cell = summary.heatmap[date];
              const responded = cell && (cell.morning || cell.evening);
              const late = cell?.late;
              const active = drillDate === date;
              return (
                <button
                  key={date}
                  onClick={() => setDrillDate(active ? null : date)}
                  title={date}
                  className={`h-7 w-7 rounded-md transition-colors ${
                    responded && !late
                      ? "bg-[#1f8a65]/60"
                      : late
                        ? "bg-amber-500/50"
                        : "bg-white/[0.04]"
                  } ${active ? "ring-1 ring-white/40" : ""}`}
                />
              );
            })}
          </div>
          <div className="flex gap-4">
            {[
              { color: "bg-[#1f8a65]/60", label: "Complet" },
              { color: "bg-amber-500/50", label: "Tardif" },
              { color: "bg-white/[0.04]", label: "Manqué" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded-sm ${color}`} />
                <span className="text-[10px] text-white/35">{label}</span>
              </div>
            ))}
          </div>

          {drillDate && (
            <div className="mt-2 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[11px] font-semibold text-white mb-2">{fmtDateShort(drillDate)}</p>
              {(summary.responses_by_date[drillDate] ?? []).length === 0 ? (
                <p className="text-[11px] text-white/40">Aucune réponse ce jour.</p>
              ) : (
                <div className="space-y-2">
                  {(summary.responses_by_date[drillDate] ?? []).map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-white/35 w-12">
                        {r.moment === "morning" ? "Matin" : "Soir"}
                      </span>
                      {Object.entries(r.responses).map(([k, v]) => (
                        <span key={k} className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/60">
                          {FIELD_META[k]?.label ?? k} {v}
                          {FIELD_META[k]?.suffix ?? ""}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="space-y-3">
        <SectionHeader eyebrow="Historique" title="Derniers check-ins" detail={history ? `${history.total} au total` : undefined} />
        <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
          {(history?.data ?? []).length === 0 ? (
            <p className="p-5 text-[12px] text-white/40">Aucun check-in enregistré.</p>
          ) : (
            (history?.data ?? []).map((entry, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="text-[11px] text-white/50 w-16">{fmtDateShort(entry.responded_at.slice(0, 10))}</span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-white/35 w-12">
                  {entry.moment === "morning" ? "Matin" : "Soir"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(entry.responses).map(([k, v]) => (
                    <span key={k} className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/60">
                      {FIELD_META[k]?.label ?? k} {v}
                      {FIELD_META[k]?.suffix ?? ""}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
