"use client";

import { useMemo } from "react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { BackButton } from "@/components/ui/BackButton";
import OneRMCalculator from "./OneRMCalculator";


export default function Page() {
  useSetTopBar(useMemo(() => <BackButton label="Retour outils" />, []));
  return <OneRMCalculator />;
}
