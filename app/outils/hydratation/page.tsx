"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { BackButton } from "@/components/ui/BackButton";
import HydrationCalculator from "./HydratationCalculator";


export default function HydrationPage() {
  useSetTopBar(useMemo(() => <BackButton label="Retour outils" />, []));
  return <HydrationCalculator />;
}
