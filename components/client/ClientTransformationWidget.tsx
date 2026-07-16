"use client";

import useSWR from "swr";
import { Lightning, Warning } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import type { TransformationScoreResult } from "@/lib/coach/transformationScore";
import { SurfaceCard } from "@/components/client/smart/SurfaceCard";
import { useClientT } from "@/components/client/ClientI18nProvider";

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

// ── Horizontal tick-bar meter ─────────────────────────────────────────────────
const TICK_COUNT = 45; // slightly fewer ticks for mobile screen

function ScoreMeter({ score }: { score: number }) {
  const activeTicks = Math.round((Math.max(0, Math.min(100, score)) / 100) * TICK_COUNT);

  return (
    <div className="w-full mt-2">
      <div className="flex items-end gap-[2px]" style={{ height: '36px' }}>
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
                backgroundColor: active ? tickColor(t) : 'rgba(255,255,255,0.05)',
                transformOrigin: 'bottom',
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.008, duration: 0.3, ease: 'easeOut' }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-bold text-white/20 tabular-nums">0</span>
        <span className="text-[9px] font-bold text-white/20 tabular-nums">100</span>
      </div>
    </div>
  );
}

export default function ClientTransformationWidget({ clientId, lang = 'fr' }: { clientId: string, lang?: 'fr'|'en'|'es' }) {
  const { t } = useClientT();
  const { data, error, isLoading } = useSWR<TransformationScoreResult & { error?: string }>(
    `/api/clients/${clientId}/transformation-score?window=7`,
    fetcher
  );

  if (error || data?.error) return null;
  
  if (isLoading) {
    return (
      <SurfaceCard className="bg-[#09090a] border border-white/[0.04]">
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white/10 rounded-full" />
            <div className="w-32 h-3 bg-white/10 rounded" />
          </div>
          <div className="w-16 h-8 bg-white/10 rounded" />
          <div className="h-9 w-full bg-white/[0.03] rounded mt-2" />
        </div>
      </SurfaceCard>
    );
  }

  const isInsufficient = data?.analysisState === 'insufficient_data';
  const score = isInsufficient ? 0 : (data?.score ?? 0);
  const displayScore = isInsufficient ? "—" : String(score);
  const label = isInsufficient ? t("dashboard.transformation.insufficient") : (data?.label ?? t("dashboard.transformation.inProgress"));
  
  let scoreColor = isInsufficient ? "#5d5d5d" : "#5dba87"; // gray or green
  if (!isInsufficient) {
    if (score < 50) scoreColor = "#f59e0b"; // amber
    if (score < 25) scoreColor = "#ef4444"; // red
  }

  return (
    <SurfaceCard className="bg-[#09090a] border border-white/[0.04] p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.03]">
            <Lightning size={14} weight="fill" style={{ color: scoreColor }} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              {t("dashboard.transformationScore")}
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex items-end gap-3 mt-1">
        <span className="text-[44px] font-bold leading-none tracking-tight text-white tabular-nums">
          {displayScore}
        </span>
        <div className="flex flex-col pb-1.5">
          <span className="text-[14px] font-medium text-white/80">{label}</span>
          <span className="text-[10px] text-white/40">{t("dashboard.transformation.basedOn7d")}</span>
        </div>
      </div>

      <ScoreMeter score={score} />
      
      {isInsufficient && data?.analysisStateReason && (
        <div className="mt-3 pt-3 border-t border-white/[0.04] flex flex-col gap-2">
          <div className="flex items-start gap-2.5 bg-white/[0.02] rounded-lg p-2.5">
            <Warning size={14} className="shrink-0 mt-[2px] text-amber-500/80" />
            <p className="text-[11px] leading-snug text-white/50">
              {data.analysisStateReason}
            </p>
          </div>
          <p className="text-[10px] text-white/30 leading-snug">
            {t("dashboard.transformation.activateHint")}
          </p>
        </div>
      )}

      {!isInsufficient && data?.alerts && data.alerts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.04] flex flex-col gap-2">
          {data.alerts.slice(0, 2).map((alert, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-white/[0.02] rounded-lg p-2.5">
              <Warning size={14} className="shrink-0 mt-[2px] text-amber-500/80" />
              <p className="text-[11px] leading-snug text-white/70">
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
