"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { BackButton } from "@/components/ui/BackButton";
import CarbCyclingCalculator from "./CarbCyclingCalculator";


export default function CarbCyclingPage() {
  useSetTopBar(useMemo(() => <BackButton label="Retour outils" />, []));
  return <CarbCyclingCalculator />;
}
