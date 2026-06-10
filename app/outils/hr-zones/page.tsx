"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { BackButton } from "@/components/ui/BackButton";
import HRZonesCalculator from "./HRZonesCalculator";


export default function HRZonesPage() {
  useSetTopBar(useMemo(() => <BackButton label="Retour outils" />, []));
  return <HRZonesCalculator />;
}
