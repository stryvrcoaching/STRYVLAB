"use client";

import { Utensils } from "lucide-react";
import { useClientT } from "@/components/client/ClientI18nProvider";
import { DashboardSignalCard } from "@/components/client/smart/DashboardSignalCard";

interface NewProtocolBannerProps {
  unviewedCount: number;
  protocolName?: string;
}

export default function NewProtocolBanner({
  unviewedCount,
  protocolName,
}: NewProtocolBannerProps) {
  const { t } = useClientT();
  if (unviewedCount === 0) return null;

  const label =
    unviewedCount === 1
      ? t("protocol.banner.single", {
          name: protocolName || t("protocol.banner.defaultName"),
        })
      : t("protocol.banner.multiple", { n: unviewedCount });

  return (
    <DashboardSignalCard
      eyebrow={t("protocol.banner.new")}
      href="/client/nutrition"
      icon={Utensils}
      label="Ouvrir"
      title={label}
      tone="info"
    />
  );
}
