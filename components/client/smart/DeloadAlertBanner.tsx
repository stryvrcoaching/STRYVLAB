"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import type { DeloadSignal } from "@/lib/training/deloadDetection";
import { useClientT } from "@/components/client/ClientI18nProvider";
import { DashboardSignalCard } from "@/components/client/smart/DashboardSignalCard";

interface DeloadAlertBannerProps {
  clientId: string;
}

export default function DeloadAlertBanner({ clientId }: DeloadAlertBannerProps) {
  const { t } = useClientT();
  const [signals, setSignals] = useState<DeloadSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchDeloadStatus = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/client/deload-status");
        if (!res.ok) throw new Error("Failed to fetch deload status");
        const data = await res.json();
        setSignals(data.signals ?? []);
      } catch (err) {
        console.error("Fetch error:", err);
        setSignals([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchDeloadStatus();
  }, [clientId]);

  if (loading || dismissed || signals.length === 0) return null;

  const prioritySignal =
    signals.find((s) => s.severity === "critical") || signals[0];
  const isCritical = prioritySignal.severity === "critical";

  return (
    <DashboardSignalCard
      body={prioritySignal.body}
      eyebrow={isCritical ? "Alerte récupération" : "Signal récupération"}
      icon={AlertTriangle}
      onDismiss={() => setDismissed(true)}
      title={prioritySignal.title}
      tone={isCritical ? "attention" : "warning"}
    >
      <p className="mt-2 flex items-start gap-2 text-[11px] font-medium text-white/50">
        <Zap size={12} className="mt-0.5 shrink-0 text-white/35" />
        <span className="text-pretty">{prioritySignal.recommendation}</span>
      </p>
      {signals.length > 1 && (
        <p className="mt-2 text-[11px] text-white/35">
          {t("smart.deload.signals", { n: String(signals.length - 1) })}
        </p>
      )}
    </DashboardSignalCard>
  );
}
