"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { BackButton } from "@/components/ui/BackButton";
import CycleSyncCalculator from "./CycleSyncCalculator";


export default function CycleSyncPage() {
  useSetTopBar(useMemo(() => <BackButton label="Retour outils" />, []));
  return <CycleSyncCalculator />;
}
