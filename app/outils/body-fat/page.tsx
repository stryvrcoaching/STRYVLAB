"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { BackButton } from "@/components/ui/BackButton";
import BodyFatCalculator from "./BodyFatCalculator";


export default function BodyFatPage() {
  useSetTopBar(useMemo(() => <BackButton label="Retour outils" />, []));
  return <BodyFatCalculator />;
}
