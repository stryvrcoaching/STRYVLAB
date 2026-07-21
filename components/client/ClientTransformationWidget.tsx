"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import {
  CaretRight,
  ChartLineUp,
  CheckCircle,
  Lightning,
  Person,
  Pulse,
  Target,
  Warning,
  X,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import type {
  DimensionResult,
  TransformationScoreResult,
} from "@/lib/coach/transformationScore";
import { useClientT } from "@/components/client/ClientI18nProvider";
import useBodyScrollLock from "@/components/client/useBodyScrollLock";
import { cn } from "@/app/lib/utils";
import {
  DASHBOARD_SIGNAL_COLORS,
  DashboardSectionIcon,
} from "@/components/client/DashboardSectionIcon";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ── Color interpolation: 0=red → 0.5=amber → 1=green ─────────────────────────
function tickColor(t: number): string {
  if (t < 0.5) {
    const g = Math.round(t * 2 * 155);
    return `rgb(215,${g},35)`;
  }
  const r = Math.round(215 * (1 - (t - 0.5) * 2));
  return `rgb(${r},185,35)`;
}

function scoreTone(score: number, empty = false): string {
  if (empty) return DASHBOARD_SIGNAL_COLORS.neutral;
  if (score < 35) return DASHBOARD_SIGNAL_COLORS.critical;
  if (score < 55) return DASHBOARD_SIGNAL_COLORS.attention;
  if (score < 75) return DASHBOARD_SIGNAL_COLORS.warning;
  return DASHBOARD_SIGNAL_COLORS.success;
}

// ── Horizontal tick-bar meter ─────────────────────────────────────────────────
const TICK_COUNT = 45;

function ScoreMeter({ score }: { score: number }) {
  const activeTicks = Math.round(
    (Math.max(0, Math.min(100, score)) / 100) * TICK_COUNT,
  );

  return (
    <div className="mt-2 w-full">
      <div className="flex items-end gap-[2px]" style={{ height: "36px" }}>
        {Array.from({ length: TICK_COUNT }).map((_, i) => {
          const t = i / (TICK_COUNT - 1);
          const active = i < activeTicks;
          const h = 14 + Math.round(Math.sin(t * Math.PI) * 10);
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                height: `${h}px`,
                backgroundColor: active ? tickColor(t) : "rgba(255,255,255,0.05)",
                transformOrigin: "bottom",
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.008, duration: 0.3, ease: "easeOut" }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between">
        <span className="text-[9px] font-bold tabular-nums text-white/20">0</span>
        <span className="text-[9px] font-bold tabular-nums text-white/20">100</span>
      </div>
    </div>
  );
}

type DimKey = keyof TransformationScoreResult["dimensions"];

const DIM_META: Record<
  DimKey,
  {
    labelKey:
      | 'dashboard.transformation.dimension.adherence.label'
      | 'dashboard.transformation.dimension.recovery.label'
      | 'dashboard.transformation.dimension.bodyProgress.label'
      | 'dashboard.transformation.dimension.performance.label';
    descKey:
      | 'dashboard.transformation.dimension.adherence.desc'
      | 'dashboard.transformation.dimension.recovery.desc'
      | 'dashboard.transformation.dimension.bodyProgress.desc'
      | 'dashboard.transformation.dimension.performance.desc';
    Icon: typeof Target;
  }
> = {
  adherence: {
    labelKey: 'dashboard.transformation.dimension.adherence.label',
    descKey: 'dashboard.transformation.dimension.adherence.desc',
    Icon: CheckCircle,
  },
  recovery: {
    labelKey: 'dashboard.transformation.dimension.recovery.label',
    descKey: 'dashboard.transformation.dimension.recovery.desc',
    Icon: Pulse,
  },
  bodyProgress: {
    labelKey: 'dashboard.transformation.dimension.bodyProgress.label',
    descKey: 'dashboard.transformation.dimension.bodyProgress.desc',
    Icon: Person,
  },
  performance: {
    labelKey: 'dashboard.transformation.dimension.performance.label',
    descKey: 'dashboard.transformation.dimension.performance.desc',
    Icon: ChartLineUp,
  },
};

/** Rewrite any residual coach-facing wording before showing it to the coached user. */
function toUserFacingCopy(text: string): string {
  return text
    .replace(/\bobjectif principal du client\b/gi, "ton objectif")
    .replace(/\bdu client\b/gi, "")
    .replace(/\ble client\b/gi, "tu")
    .replace(/\bau client\b/gi, "à toi")
    .replace(/\bson objectif\b/gi, "ton objectif")
    .replace(/\bsa progression\b/gi, "ta progression")
    .replace(/planifier un bilan/gi, "faire un bilan")
    .replace(/check-in coach/gi, "check-in")
    .replace(/Lecture de transformation indisponible/gi, "Score encore indisponible")
    .replace(
      /Aucun signal de transformation interprétable[^.]*\./gi,
      "Pas encore assez de données pour calculer ton score.",
    )
    .replace(/événements de surcharge détectés/gi, "progressions de charge")
    .replace(/moteur de double progression/gi, "règle de progression de ton programme")
    .replace(/exercices jugés stagnants/gi, "exercices en stagnation")
    .replace(/Séances détectées/gi, "Tes séances")
    .replace(/Exercices analysables/gi, "Exercices analysés")
    .replace(/^Lecture cible$/i, "Ton objectif")
    .replace(/^Tendance poids$/i, "Tendance de ton poids")
    .replace(/^Masse grasse$/i, "Ta masse grasse")
    .replace(/^Masse maigre$/i, "Ta masse maigre")
    .replace(/^Niveau de confiance$/i, "Fiabilité de la lecture")
    .replace(/poids attendu en baisse/gi, "ton poids devrait baisser")
    .replace(/poids attendu en hausse/gi, "ton poids devrait augmenter")
    .replace(/poids attendu stable/gi, "ton poids devrait rester stable")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function localizedAlertMessage(
  alert: TransformationScoreResult['alerts'][number],
  t: ReturnType<typeof useClientT>['t'],
): string {
  if (alert.dimension === 'adherence' && /Check-ins complétés à (\d+)%/.test(alert.message)) {
    const rate = alert.message.match(/Check-ins complétés à (\d+)%/)?.[1] ?? ''
    return t('dashboard.transformation.alert.checkinsIncomplete', { rate })
  }
  return toUserFacingCopy(alert.message)
}

function CardShell({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border-[0.3px] border-white/[0.04] bg-white/[0.02] p-5 text-left",
        onClick &&
          "transition-transform duration-150 active:scale-[0.99] hover:bg-white/[0.02] active:bg-white/[0.02]",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

function DimRow({
  dimKey,
  dim,
}: {
  dimKey: DimKey;
  dim: DimensionResult;
}) {
  const meta = DIM_META[dimKey];
  const Icon = meta.Icon;
  const { t } = useClientT();
  const noData = dim.weight === 0 || dim.dataPoints < 1;
  const color = scoreTone(dim.score, noData);
  const weightPct = Math.round(dim.weight * 100);

  return (
    <div className="rounded-2xl bg-white/[0.03] px-3.5 py-3">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <Icon size={16} weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-white">{t(meta.labelKey)}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/40">
                {t(meta.descKey)}
              </p>
            </div>
            <span
              className="shrink-0 text-[18px] font-bold tabular-nums leading-none"
              style={{ color }}
            >
              {noData ? "—" : dim.score}
            </span>
          </div>

          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: noData ? "0%" : `${Math.min(100, dim.score)}%`,
                backgroundColor: color,
              }}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/35">
            <span>{t('dashboard.transformation.weight', { n: weightPct })}</span>
            <span>
              {dim.dataPoints > 0
                ? t(
                    dim.dataPoints > 1
                      ? 'dashboard.transformation.dataPointsPlural'
                      : 'dashboard.transformation.dataPoints',
                    { n: dim.dataPoints },
                  )
                : t('dashboard.transformation.noData')}
            </span>
          </div>

          {dim.explanation ? (
            <p className="mt-2 text-[11px] leading-snug text-white/50">
              {toUserFacingCopy(dim.explanation)}
            </p>
          ) : null}

          {dim.metrics && dim.metrics.length > 0 ? (
            <div className="mt-2 space-y-1 border-t border-white/[0.04] pt-2">
              {dim.metrics.map((m) => (
                <div
                  key={m.label}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="text-[10px] text-white/35">
                    {toUserFacingCopy(m.label)}
                  </span>
                  <span className="text-right text-[10px] font-medium text-white/55">
                    {toUserFacingCopy(m.value)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TransformationDetailSheet({
  open,
  onClose,
  data,
  isInsufficient,
}: {
  open: boolean;
  onClose: () => void;
  data: TransformationScoreResult;
  isInsufficient: boolean;
}) {
  const { t } = useClientT();
  useBodyScrollLock(open);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const score = isInsufficient ? 0 : data.score;
  const label = isInsufficient
    ? t("dashboard.transformation.insufficient")
    : data.label;

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Fermer"
        className="fixed inset-0 z-[60] bg-black/55"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transformation-sheet-title"
        className="client-native-bottom-sheet fixed inset-x-0 bottom-0 z-[70] flex max-h-[88dvh] flex-col rounded-t-[28px] bg-[#0d0d0d]"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
        }}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/[0.10]" />

        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {t('dashboard.transformation.understand')}
            </p>
            <h2
              id="transformation-sheet-title"
              className="mt-1 font-barlow-condensed text-[18px] font-bold uppercase tracking-[0.08em] text-white"
            >
              {t("dashboard.transformationScore")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/55 transition-colors hover:text-white"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-4">
          {/* Hero score */}
          <div className="rounded-2xl bg-white/[0.03] px-4 py-4">
            <div className="flex items-end gap-3">
              <span className="text-[48px] font-bold leading-none tabular-nums tracking-tight text-white">
                {isInsufficient ? "—" : score}
              </span>
              <div className="pb-1.5">
                <p className="text-[14px] font-medium text-white/85">{label}</p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {t("dashboard.transformation.basedOn7d")}
                </p>
              </div>
            </div>
            <ScoreMeter score={score} />
            <p className="mt-3 text-[12px] leading-relaxed text-white/45">
              {t('dashboard.transformation.summary')}
            </p>
          </div>

          {isInsufficient ? (
            <div className="flex items-start gap-2.5 rounded-2xl bg-white/[0.03] p-3.5">
              <Warning
                size={16}
                className="mt-0.5 shrink-0 text-amber-500/80"
                weight="fill"
              />
              <div>
                <p className="text-[13px] font-medium text-white/80">
                  {t('dashboard.transformation.noData')}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-white/45">
                  {toUserFacingCopy(
                    data.analysisStateReason ||
                      t("dashboard.transformation.activateHint"),
                  )}
                </p>
              </div>
            </div>
          ) : null}

          {/* Dimensions only — no coaching prescriptions */}
          <section className="space-y-2.5">
            <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              {t('dashboard.transformation.pillars')}
            </p>
            <div className="space-y-2">
              {(Object.keys(DIM_META) as DimKey[]).map((key) => (
                <DimRow key={key} dimKey={key} dim={data.dimensions[key]} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default function ClientTransformationWidget({
  clientId,
}: {
  clientId: string;
  lang?: "fr" | "en" | "es";
}) {
  const { t } = useClientT();
  const [open, setOpen] = useState(false);
  const { data, error, isLoading } = useSWR<
    TransformationScoreResult & { error?: string }
  >(`/api/clients/${clientId}/transformation-score?window=7`, fetcher);

  if (error || data?.error) return null;

  if (isLoading) {
    return (
      <CardShell>
        <div className="flex animate-pulse flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-white/10" />
            <div className="h-3 w-32 rounded bg-white/10" />
          </div>
          <div className="h-8 w-16 rounded bg-white/10" />
          <div className="mt-2 h-9 w-full rounded bg-white/[0.03]" />
        </div>
      </CardShell>
    );
  }

  if (!data) return null;

  const isInsufficient = data.analysisState === "insufficient_data";
  const score = isInsufficient ? 0 : data.score;
  const displayScore = isInsufficient ? "—" : String(score);
  const label = isInsufficient
    ? t("dashboard.transformation.insufficient")
    : (data.label ?? t("dashboard.transformation.inProgress"));
  const scoreColor = scoreTone(score, isInsufficient);

  return (
    <>
      <CardShell onClick={() => setOpen(true)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <DashboardSectionIcon color={scoreColor}>
              <Lightning size={15} weight="fill" />
            </DashboardSectionIcon>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              {t("dashboard.transformationScore")}
            </p>
          </div>
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-white/35">
            {t('dashboard.transformation.detail')}
            <CaretRight size={12} weight="bold" />
          </span>
        </div>

        <div className="mt-1 flex items-end gap-3">
          <span className="text-[44px] font-bold leading-none tracking-tight text-white tabular-nums">
            {displayScore}
          </span>
          <div className="flex flex-col pb-1.5">
            <span className="text-[14px] font-medium text-white/80">{label}</span>
            <span className="text-[10px] text-white/40">
              {t("dashboard.transformation.basedOn7d")}
            </span>
          </div>
        </div>

        <ScoreMeter score={score} />

        {isInsufficient && data.analysisStateReason ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-white/[0.03] p-2.5">
            <Warning
              size={14}
              className="mt-[2px] shrink-0 text-amber-500/80"
              weight="fill"
            />
            <p className="text-[11px] leading-snug text-white/50">
              {toUserFacingCopy(data.analysisStateReason)}
            </p>
          </div>
        ) : null}

        {!isInsufficient && data.alerts && data.alerts.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {data.alerts.slice(0, 1).map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] p-2.5"
              >
                <Warning
                  size={14}
                  className="mt-[2px] shrink-0 text-amber-500/80"
                  weight="fill"
                />
                <p className="text-[11px] leading-snug text-white/65">
                  {localizedAlertMessage(alert, t)}
                </p>
              </div>
            ))}
            {data.alerts.length > 1 ? (
              <p className="text-[10px] text-white/30">
                {t('dashboard.transformation.moreSignals', {
                  n: data.alerts.length - 1,
                  suffix: data.alerts.length - 1 > 1 ? 'x' : '',
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        {!isInsufficient && (!data.alerts || data.alerts.length === 0) ? (
          <p className="mt-3 text-[11px] text-white/35">
            {t('dashboard.transformation.viewHint')}
          </p>
        ) : null}
      </CardShell>

      <TransformationDetailSheet
        open={open}
        onClose={() => setOpen(false)}
        data={data}
        isInsufficient={isInsufficient}
      />
    </>
  );
}
