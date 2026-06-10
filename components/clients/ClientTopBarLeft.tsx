"use client";

import Image from "next/image";
import type { ClientData } from "@/lib/client-context";
import { getTransformationPhaseShortLabel } from "@/lib/coach/transformationPhase";

const TRAINING_GOALS: Record<string, string> = {
  hypertrophy: "Hypertrophie",
  strength: "Force",
  fat_loss: "Perte de gras",
  endurance: "Endurance",
  recomp: "Recomposition",
  maintenance: "Maintenance",
  athletic: "Athlétique",
};

const FITNESS_LEVELS: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
  elite: "Élite",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  suspended: "Suspendu",
  archived: "Archivé",
};

interface ClientTopBarLeftProps {
  pageLabel: string;
  client: ClientData;
}

export default function ClientTopBarLeft({ pageLabel, client }: ClientTopBarLeftProps) {

  const initials = `${client.first_name?.[0] ?? ""}${client.last_name?.[0] ?? ""}`.toUpperCase() || "?";
  const phase = getTransformationPhaseShortLabel(client.transformation_phase);
  const goal = client.training_goal ? TRAINING_GOALS[client.training_goal] : null;
  const level = client.fitness_level ? FITNESS_LEVELS[client.fitness_level] : null;

  return (
    <div className="flex items-center gap-3 min-w-0">
      {/* Avatar — photo ou initiales */}
      <div className="w-9 h-9 rounded-xl bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/20 flex items-center justify-center shrink-0 overflow-hidden">
        {client.profile_photo_url ? (
          <Image
            src={client.profile_photo_url}
            alt={`${client.first_name} ${client.last_name}`}
            width={36}
            height={36}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-[12px] font-bold text-[#1f8a65]">{initials}</span>
        )}
      </div>

      {/* Infos client + page active */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-white leading-tight truncate">
            {client.first_name} {client.last_name}
          </span>
          <span className="text-white/20 text-[10px]">·</span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
            {pageLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {phase && (
            <span className="text-[10px] text-[#7fe0b8] font-semibold">{phase}</span>
          )}
          {phase && goal && <span className="text-white/20 text-[9px]">·</span>}
          {goal && (
            <span className="text-[10px] text-white/40 font-medium">{goal}</span>
          )}
          {goal && level && <span className="text-white/20 text-[9px]">·</span>}
          {level && (
            <span className="text-[10px] text-white/40 font-medium">{level}</span>
          )}
          {client.status && (
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
              client.status === "active"
                ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                : client.status === "suspended"
                ? "bg-amber-500/10 text-amber-400"
                : "bg-white/[0.06] text-white/40"
            }`}>
              {STATUS_LABELS[client.status] ?? client.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
