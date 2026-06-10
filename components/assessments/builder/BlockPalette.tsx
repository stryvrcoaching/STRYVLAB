"use client";

import {
  User,
  Scale,
  Ruler,
  Camera,
  Utensils,
  Dumbbell,
  Heart,
  Moon,
  Target,
  Shield,
  Coffee,
  Trophy,
  Brain,
} from "lucide-react";
import { AssessmentModule } from "@/types/assessment";
import {
  MODULE_LABELS,
  MODULE_ORDER,
  MODULE_DESCRIPTIONS,
} from "@/lib/assessments/modules";

const ICONS: Record<AssessmentModule, React.ElementType> = {
  general: User,
  biometrics: Scale,
  measurements: Ruler,
  photos: Camera,
  nutrition: Utensils,
  training: Dumbbell,
  cardio: Heart,
  wellness: Moon,
  goals: Target,
  medical: Shield,
  lifestyle: Coffee,
  performance: Trophy,
  psychology: Brain,
};

interface Props {
  usedModules: AssessmentModule[];
  onAdd: (module: AssessmentModule) => void;
}

export default function BlockPalette({ usedModules, onAdd }: Props) {
  return (
    <div className="w-60 shrink-0 flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.16em] mb-2">
        Modules
      </p>
      {MODULE_ORDER.map((module) => {
        const Icon = ICONS[module];
        const used = usedModules.includes(module);
        return (
          <button
            key={module}
            onClick={() => !used && onAdd(module)}
            disabled={used}
            title={MODULE_DESCRIPTIONS[module]}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
              used
                ? "bg-white/[0.02] text-white/30 cursor-not-allowed"
                : "bg-white/[0.03] text-white hover:text-[#1f8a65] cursor-pointer hover:bg-white/[0.05]"
            }`}
          >
            <Icon size={14} className="shrink-0" />
            <span className="text-[11px] font-medium truncate">
              {MODULE_LABELS[module]}
            </span>
            {used && (
              <span className="ml-auto text-[9px] font-bold text-white/20 shrink-0">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
