"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity, Library, Plus, ArrowLeft } from "lucide-react";
import { useClient } from "@/lib/client-context";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import ClientTopBarLeft from "@/components/clients/ClientTopBarLeft";
import ClientProgramsList from "@/components/programs/ClientProgramsList";
import ProgramTemplateBuilder from "@/components/programs/ProgramTemplateBuilder";
import AssignTemplateModal from "@/components/programs/AssignTemplateModal";
import StudioPerformancePanel from "@/components/programs/studio/StudioPerformancePanel";
import NutritionAlignModal from "@/components/programs/NutritionAlignModal";
import ProgramPdfModal from "@/components/programs/ProgramPdfModal";
import { type ClientProfile } from "@/lib/matching/template-matcher";
import ContextDocsMenu from "@/components/docs/ContextDocsMenu";
import { getDocsForAudienceAndContext } from "@/lib/docs/registry";
import HeaderIconButton from "@/components/layout/HeaderIconButton";
import { publishClientImpact } from "@/lib/coach/client-impact-events";

interface Program {
  id: string;
  name: string;
  description: string | null;
  weeks: number;
  status: "active" | "archived";
  is_client_visible: boolean;
  created_at: string;
  goal?: string;
  level?: string;
  frequency?: number;
  muscle_tags?: string[];
  equipment_archetype?: string;
  session_mode?: string;
  volume_focus?: Record<string, "priority" | "progression" | "maintenance" | "off">;
  program_sessions?: any[];
}

export default function EntrainementPage() {
  const router = useRouter();
  const { client, clientId } = useClient();
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPerformanceRail, setShowPerformanceRail] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [alignModalProgram, setAlignModalProgram] = useState<Program | null>(null);
  const [alignSource, setAlignSource] = useState<"save" | "toggle" | null>(null);
  const [pdfProgram, setPdfProgram] = useState<Program | null>(null);
  const workoutStudioDocs = useMemo(
    () => getDocsForAudienceAndContext("coach", "workout-studio"),
    [],
  );

  // Bloquer le scroll de la page quand le builder est ouvert
  useEffect(() => {
    if (selectedProgram) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedProgram]);

  const clientProfile: ClientProfile = useMemo(
    () => ({
      equipment_category: (client as any)?.equipment_category ?? null,
      fitness_level: (client as any)?.fitness_level ?? null,
      training_goal: (client as any)?.training_goal ?? null,
      weekly_frequency: (client as any)?.weekly_frequency ?? null,
    }),
    [client],
  );

  const clientName = client
    ? `${(client as any).first_name ?? ""} ${(client as any).last_name ?? ""}`.trim()
    : "";

  const handleAssigned = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const listTopBarRight = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <ContextDocsMenu docs={workoutStudioDocs} compact />
        <HeaderIconButton
          onClick={() => setShowPerformanceRail((value) => !value)}
          icon={<Activity size={12} />}
          label="Afficher le rail performance"
          active={showPerformanceRail}
        />
        <HeaderIconButton
          onClick={() => setShowAssignModal(true)}
          icon={<Library size={12} />}
          label="Assigner un template"
        />
        <HeaderIconButton
          onClick={async () => {
            const res = await fetch("/api/programs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                client_id: clientId,
                name: "Nouveau programme",
                weeks: 4,
              }),
            });
            const d = await res.json();
            if (res.ok && d.program) {
              setSelectedProgram({
                ...d.program,
                is_client_visible: d.program.is_client_visible ?? false,
              });
            }
          }}
          icon={<Plus size={12} />}
          label="Nouveau programme"
          variant="accent"
        />
      </div>
    ),
    [clientId, showPerformanceRail, workoutStudioDocs],
  );

  // Builder left node — back button + client info
  const builderTopBarLeft = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <HeaderIconButton
          onClick={() => setSelectedProgram(null)}
          icon={<ArrowLeft size={15} />}
          label="Retour"
          className="shrink-0"
        />
        <ClientTopBarLeft pageLabel="Workout Studio" client={client} />
      </div>
    ),
    [client],
  );

  // Show list TopBar when no program selected; Builder owns TopBar when editing
  useClientTopBar(
    selectedProgram ? "" : "Workout Studio",
    selectedProgram ? undefined : listTopBarRight,
  );

  return (
    <main
      className={
        selectedProgram
          ? "h-[calc(100vh-88px)] overflow-hidden bg-[#121212] flex flex-col"
          : "min-h-screen bg-[#121212]"
      }
    >
      <div className={selectedProgram ? "flex-1 min-h-0 h-full" : "px-6 pb-24"}>
        {selectedProgram ? (
          <ProgramTemplateBuilder
            initial={selectedProgram}
            programId={selectedProgram.id}
            clientId={clientId}
            topBarLeft={builderTopBarLeft}
            noFullscreen
            onSaved={(saved) => {
              publishClientImpact({ clientId, kind: "refresh" });
              if (saved?.is_client_visible) {
                setAlignModalProgram({ ...selectedProgram!, ...saved });
                setAlignSource("save");
              } else {
                setSelectedProgram(null);
                setRefreshKey((k) => k + 1);
              }
            }}
            onCancel={() => setSelectedProgram(null)}
          />
        ) : (
          <>
            <div className="pt-5 pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
                Workout Studio
              </p>
            </div>
            <div className={`grid gap-5 ${showPerformanceRail ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"}`}>
              <ClientProgramsList
                key={refreshKey}
                clientId={clientId}
                onSelectProgram={(p) => setSelectedProgram(p as Program)}
                onRequestAlign={(p) => {
                  setAlignModalProgram(p as Program);
                  setAlignSource("toggle");
                }}
                onRequestPdf={(p) => setPdfProgram(p as Program)}
              />
              {showPerformanceRail && (
                <aside className="rounded-2xl border border-white/[0.06] bg-[#181818] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                        Performance
                      </p>
                      <h2 className="mt-1 text-sm font-semibold text-white">
                        Vue coach intégrée
                      </h2>
                    </div>
                    <button
                      onClick={() => setShowPerformanceRail(false)}
                      className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45 hover:text-white/70"
                    >
                      Fermer
                    </button>
                  </div>
                  <StudioPerformancePanel clientId={clientId} />
                </aside>
              )}
            </div>
          </>
        )}
      </div>

      {showAssignModal && (
        <AssignTemplateModal
          clientId={clientId}
          clientProfile={clientProfile}
          clientName={clientName}
          onClose={() => setShowAssignModal(false)}
          onAssigned={handleAssigned}
        />
      )}

      {alignModalProgram && (
        <NutritionAlignModal
          clientId={clientId}
          program={alignModalProgram}
          source={alignSource!}
          onClose={() => {
            setAlignModalProgram(null);
            setAlignSource(null);
            if (alignSource === "save") setSelectedProgram(null);
            setRefreshKey((k) => k + 1);
          }}
          onConfirm={() => {
            setAlignModalProgram(null);
            setAlignSource(null);
            if (alignSource === "save") setSelectedProgram(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {pdfProgram && (
        <ProgramPdfModal
          mode="program"
          entityId={pdfProgram.id}
          title={pdfProgram.name}
          programClient={{
            firstName: client.first_name,
            lastName: client.last_name,
            email: client.email ?? null,
          }}
          onClose={() => setPdfProgram(null)}
        />
      )}
    </main>
  );
}
