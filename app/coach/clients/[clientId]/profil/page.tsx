// app/coach/clients/[clientId]/profil/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useClient } from "@/lib/client-context";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import ClientAccessToken from "@/components/clients/ClientAccessToken";
import RestrictionsWidget from "@/components/clients/RestrictionsWidget";
import ClientFormulasTab from "@/components/crm/ClientFormulasTab";
import DeleteClientModal from "@/components/clients/DeleteClientModal";
import { useRouter } from "next/navigation";
import {
  Mail, Phone, Calendar, Edit2, Save, Loader2, User,
  Tag, Plus, X, Check, MapPin, User2, StickyNote, PhoneCall, ChevronDown, ShieldAlert,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TransformationScoreWidget from "@/components/coach/TransformationScoreWidget";
import PhaseOptimizationWidget from "@/components/coach/PhaseOptimizationWidget";
import AiCoachSettingsWidget from "@/components/coach/AiCoachSettingsWidget";
import CheckinConfigWidget from "@/components/coach/CheckinConfigWidget";
import CoachMessageComposer from "@/components/coach/CoachMessageComposer";
import ClientAppointmentsWidget from "@/components/appointments/ClientAppointmentsWidget";
import {
  TRANSFORMATION_PHASE_OPTIONS,
  getTransformationPhaseLabel,
  transformationPhaseToFamily,
  transformationPhaseToMacroGoal,
} from "@/lib/coach/transformationPhase";
import { publishClientImpact } from "@/lib/coach/client-impact-events";
import { isMinor, type MinorAuthorizationStatus } from "@/lib/privacy/minor-authorization";

// ── Constants ──────────────────────────────────────────────────────────────────

const TRAINING_GOALS = [
  { value: "hypertrophy", label: "Hypertrophie" },
  { value: "strength", label: "Force" },
  { value: "fat_loss", label: "Perte de gras" },
  { value: "endurance", label: "Endurance" },
  { value: "recomp", label: "Recomposition" },
  { value: "maintenance", label: "Maintenance" },
  { value: "athletic", label: "Athlétique" },
];
const TRANSFORMATION_PHASES = TRANSFORMATION_PHASE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  description: option.description,
}));
const FITNESS_LEVELS = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
  { value: "elite", label: "Élite" },
];
const SPORT_PRACTICES = [
  { value: "sedentary", label: "Sédentaire" },
  { value: "light", label: "Légèrement actif" },
  { value: "moderate", label: "Modérément actif" },
  { value: "active", label: "Actif" },
  { value: "athlete", label: "Athlète" },
];
const EQUIPMENT_CATEGORIES = [
  { value: "bodyweight", label: "Poids du corps" },
  { value: "home_dumbbells", label: "Domicile — Haltères" },
  { value: "home_full", label: "Domicile — Complet" },
  { value: "home_rack", label: "Rack à domicile" },
  { value: "functional_box", label: "Box / Fonctionnel" },
  { value: "commercial_gym", label: "Salle de sport" },
];
const GENDER_LABELS: Record<string, string> = {
  male: "Homme", female: "Femme", other: "Autre", prefer_not_to_say: "Non précisé",
};
const SOURCE_LABELS: Record<string, string> = {
  referral: "Parrainage", social_media: "Réseaux sociaux", website: "Site web",
  word_of_mouth: "Bouche à oreille", other: "Autre",
};
const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#0ea5e9", "#10b981",
  "#f59e0b", "#ef4444", "#14b8a6", "#f97316", "#6b7280",
];

// ── Shared UI ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-3">
      {children}
    </p>
  );
}

function SubSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25 mb-2 mt-4">
      {children}
    </p>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

// Collapsible section. Body stays mounted (hidden when closed) so edit state is
// preserved; the header-right slot (edit/save controls) only shows when open to
// avoid editing a collapsed section.
function CollapsibleCard({
  title,
  defaultOpen = false,
  headerRight,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{title}</span>
          <ChevronDown size={13} className={`text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && headerRight}
      </div>
      <div className={open ? "" : "hidden"}>{children}</div>
    </Card>
  );
}

const inputCls = "w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 h-9 text-[12px] text-white outline-none placeholder:text-white/20";
const selectCls = "w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 h-9 text-[12px] text-white outline-none";

function InfoCell({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
        <Icon size={12} className="text-white/40" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium">{label}</p>
        {value
          ? <p className="text-[12px] text-white font-medium truncate">{value}</p>
          : <p className="text-[11px] text-white/25 italic">Non renseigné</p>
        }
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

type CrmFields = {
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  internal_notes?: string | null;
  acquisition_source?: string | null;
  minor_authorization_status?: MinorAuthorizationStatus;
  minor_guardian_name?: string | null;
  minor_guardian_email?: string | null;
  minor_authorization_confirmed_at?: string | null;
};

type TagObj = { id: string; name: string; color: string };

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const { client, clientId, refetch } = useClient();
  const router = useRouter();

  // ── Access onboarding cue: new client (not yet active/suspended) needs an invite ──
  const accessSectionRef = useRef<HTMLDivElement>(null);
  const [accessStatus, setAccessStatus] = useState(client.status ?? "inactive");
  useEffect(() => { setAccessStatus(client.status ?? "inactive"); }, [client.status]);
  const needsInvite = accessStatus !== "active" && accessStatus !== "suspended";
  const [phaseOpen, setPhaseOpen] = useState(false);
  const scrollToAccess = useCallback(() => {
    accessSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useClientTopBar(
    "Profil",
    <div className="flex items-center gap-2">
      <CoachMessageComposer clientId={clientId} clientName={`${client.first_name} ${client.last_name}`} />
      {needsInvite && (
        <button
          type="button"
          onClick={scrollToAccess}
          className="flex items-center gap-1.5 rounded-lg bg-[#1f8a65] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#217356]"
        >
          <Mail size={12} /> Envoyer l'accès
        </button>
      )}
    </div>,
  );

  // Sport profile editing
  const [editingSport, setEditingSport] = useState(false);
  const [savingSport, setSavingSport] = useState(false);
  const [saveErrorSport, setSaveErrorSport] = useState("");
  const [savingPhase, setSavingPhase] = useState(false);
  const [saveErrorPhase, setSaveErrorPhase] = useState("");
  const [sportDraft, setSportDraft] = useState({
    transformation_phase: client.transformation_phase ?? "",
    training_goal: client.training_goal ?? "",
    fitness_level: client.fitness_level ?? "",
    sport_practice: client.sport_practice ?? "",
    weekly_frequency: client.weekly_frequency?.toString() ?? "",
    equipment_category: client.equipment_category ?? "",
    notes: client.notes ?? "",
    step_target: client.step_target?.toString() ?? "",
  });

  useEffect(() => {
    setSportDraft({
      transformation_phase: client.transformation_phase ?? "",
      training_goal: client.training_goal ?? "",
      fitness_level: client.fitness_level ?? "",
      sport_practice: client.sport_practice ?? "",
      weekly_frequency: client.weekly_frequency?.toString() ?? "",
      equipment_category: client.equipment_category ?? "",
      notes: client.notes ?? "",
      step_target: client.step_target?.toString() ?? "",
    });
  }, [
    client.transformation_phase,
    client.training_goal,
    client.fitness_level,
    client.sport_practice,
    client.weekly_frequency,
    client.equipment_category,
    client.notes,
    client.step_target,
  ]);

  // CRM editing
  const [editingCrm, setEditingCrm] = useState(false);
  const [savingCrm, setSavingCrm] = useState(false);
  const [saveErrorCrm, setSaveErrorCrm] = useState("");
  const [crm, setCrm] = useState<CrmFields>({});
  const [crmDraft, setCrmDraft] = useState<CrmFields>({});

  // Tags
  const [clientTags, setClientTags] = useState<TagObj[]>([]);
  const [allTags, setAllTags] = useState<TagObj[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [creatingTag, setCreatingTag] = useState(false);

  const [showDelete, setShowDelete] = useState(false);

  // Load CRM data — API retourne { client: {...} }, pas flat
  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        const data = res?.client ?? res;
        if (!data) return;
        const fields: CrmFields = {
          date_of_birth: data.date_of_birth ?? null,
          gender: data.gender ?? null,
          address: data.address ?? null,
          city: data.city ?? null,
          emergency_contact_name: data.emergency_contact_name ?? null,
          emergency_contact_phone: data.emergency_contact_phone ?? null,
          internal_notes: data.internal_notes ?? null,
          acquisition_source: data.acquisition_source ?? null,
          minor_authorization_status: data.minor_authorization_status ?? "not_required",
          minor_guardian_name: data.minor_guardian_name ?? null,
          minor_guardian_email: data.minor_guardian_email ?? null,
          minor_authorization_confirmed_at: data.minor_authorization_confirmed_at ?? null,
        };
        setCrm(fields);
      })
      .catch(() => {});
  }, [clientId]);

  // Load tags
  const loadTags = useCallback(async () => {
    setTagLoading(true);
    const [clientRes, allRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/tags`),
      fetch("/api/tags"),
    ]);
    if (clientRes.ok) setClientTags((await clientRes.json()).tags ?? []);
    if (allRes.ok) setAllTags((await allRes.json()).tags ?? []);
    setTagLoading(false);
  }, [clientId]);

  useEffect(() => { loadTags(); }, [loadTags]);

  // Sport save
  async function saveSport() {
    setSavingSport(true);
    setSaveErrorSport("");
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          training_goal: sportDraft.training_goal || null,
          fitness_level: sportDraft.fitness_level || null,
          sport_practice: sportDraft.sport_practice || null,
          weekly_frequency: sportDraft.weekly_frequency ? Number(sportDraft.weekly_frequency) : null,
          equipment_category: sportDraft.equipment_category || null,
          notes: sportDraft.notes || null,
          step_target: sportDraft.step_target ? Number(sportDraft.step_target) : null,
        }),
      });
      if (!res.ok) { setSaveErrorSport("Erreur lors de la sauvegarde"); return; }
      await refetch();
      publishClientImpact({ clientId, kind: "refresh" });
      setEditingSport(false);
    } catch {
      setSaveErrorSport("Erreur réseau");
    } finally {
      setSavingSport(false);
    }
  }

  async function saveTransformationPhase() {
    setSavingPhase(true);
    setSaveErrorPhase("");
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transformation_phase: sportDraft.transformation_phase || null,
        }),
      });
      if (!res.ok) {
        setSaveErrorPhase("Erreur lors de la sauvegarde de la phase");
        return;
      }
      await refetch();
    } catch {
      setSaveErrorPhase("Erreur réseau");
    } finally {
      setSavingPhase(false);
    }
  }

  // CRM save
  async function saveCrm() {
    setSavingCrm(true);
    setSaveErrorCrm("");
    const clientIsMinor = isMinor(crmDraft.date_of_birth);
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date_of_birth: crmDraft.date_of_birth || null,
        gender: crmDraft.gender || null,
        address: crmDraft.address || null,
        city: crmDraft.city || null,
        emergency_contact_name: crmDraft.emergency_contact_name || null,
        emergency_contact_phone: crmDraft.emergency_contact_phone || null,
        internal_notes: crmDraft.internal_notes || null,
        acquisition_source: crmDraft.acquisition_source || null,
        minor_guardian_authorization_confirmed:
          clientIsMinor && crmDraft.minor_authorization_status === "authorized",
        minor_guardian_name: clientIsMinor ? crmDraft.minor_guardian_name || null : null,
        minor_guardian_email: clientIsMinor ? crmDraft.minor_guardian_email || null : null,
      }),
    });
    if (res.ok) {
      const payload = await res.json();
      const saved = payload?.client ?? {};
      setCrm({
        ...crmDraft,
        minor_authorization_status: saved.minor_authorization_status ?? crmDraft.minor_authorization_status,
        minor_guardian_name: saved.minor_guardian_name ?? null,
        minor_guardian_email: saved.minor_guardian_email ?? null,
        minor_authorization_confirmed_at: saved.minor_authorization_confirmed_at ?? null,
      });
      setEditingCrm(false);
    } else {
      const payload = await res.json().catch(() => null);
      setSaveErrorCrm(payload?.error || "Erreur lors de la sauvegarde");
    }
    setSavingCrm(false);
  }

  // Tag actions
  async function addTag(tagId: string) {
    const res = await fetch(`/api/clients/${clientId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_id: tagId }),
    });
    if (res.ok) {
      const tag = allTags.find(t => t.id === tagId);
      if (tag) setClientTags(prev => [...prev, tag]);
    }
  }

  async function removeTag(tagId: string) {
    const res = await fetch(`/api/clients/${clientId}/tags?tag_id=${tagId}`, { method: "DELETE" });
    if (res.ok) setClientTags(prev => prev.filter(t => t.id !== tagId));
  }

  async function createTag() {
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
    });
    if (res.ok) {
      const { tag } = await res.json();
      setAllTags(prev => [...prev, tag]);
      await addTag(tag.id);
      setNewTagName("");
      setNewTagColor(TAG_COLORS[0]);
    }
    setCreatingTag(false);
  }

  // Derived display values
  const sportFields = [
    { label: "Objectif", value: TRAINING_GOALS.find(g => g.value === client.training_goal)?.label },
    { label: "Niveau", value: FITNESS_LEVELS.find(l => l.value === client.fitness_level)?.label },
    { label: "Activité", value: SPORT_PRACTICES.find(s => s.value === client.sport_practice)?.label },
    { label: "Disponibilité", value: client.weekly_frequency ? `${client.weekly_frequency} séances/sem.` : null },
    { label: "Catégorie", value: EQUIPMENT_CATEGORIES.find(e => e.value === client.equipment_category)?.label },
    { label: "Objectif Pas", value: client.step_target ? `${client.step_target.toLocaleString("fr-FR")} pas/jour` : null },
  ].filter(f => f.value);
  const activePhaseMeta = TRANSFORMATION_PHASES.find(
    (phase) => phase.value === sportDraft.transformation_phase,
  );
  const phaseDirty =
    (sportDraft.transformation_phase || "") !==
    (client.transformation_phase || "");
  const phaseDirection = transformationPhaseToMacroGoal(
    activePhaseMeta?.value,
  );
  const phaseFamily = transformationPhaseToFamily(activePhaseMeta?.value);

  const unassignedTags = allTags.filter(t => !clientTags.some(ct => ct.id === t.id));

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24">
        <div className="grid grid-cols-2 items-start gap-4">

          {/* ── COLONNE GAUCHE : score + fiche client ── */}
          <div className="flex flex-col gap-4">
            <TransformationScoreWidget clientId={clientId} />

            <Card>
              <div className="flex items-center justify-between gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setPhaseOpen((o) => !o)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Phase actuelle</span>
                  <ChevronDown size={13} className={`text-white/30 transition-transform ${phaseOpen ? "rotate-180" : ""}`} />
                </button>
                {phaseOpen && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSportDraft((draft) => ({
                          ...draft,
                          transformation_phase: client.transformation_phase ?? "",
                        }))
                      }
                      disabled={!phaseDirty || savingPhase}
                      className="text-[11px] text-white/40 hover:text-white transition-colors disabled:opacity-30"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={saveTransformationPhase}
                      disabled={!phaseDirty || savingPhase}
                      className="flex items-center gap-1.5 bg-[#1f8a65] hover:bg-[#217356] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {savingPhase ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Save size={11} />
                      )}
                      Enregistrer
                    </button>
                  </div>
                )}
              </div>

              {phaseOpen && (<>
              {saveErrorPhase && (
                <p className="text-[11px] text-red-400/80 mb-3">
                  {saveErrorPhase}
                </p>
              )}

              <p className="text-[12px] leading-relaxed text-white/60 mb-4">
                Décision stratégique du coach pour la phase actuelle du client.
                Elle aligne Nutrition Studio, Phase Optimization et la direction
                des ajustements.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {TRANSFORMATION_PHASES.map((phase) => {
                  const isActive = sportDraft.transformation_phase === phase.value;
                  return (
                    <button
                      key={phase.value}
                      onClick={() =>
                        setSportDraft((draft) => ({
                          ...draft,
                          transformation_phase: phase.value,
                        }))
                      }
                      className={`rounded-xl border px-3 py-3 text-left transition-all ${
                        isActive
                          ? "border-[#1f8a65]/35 bg-[#1f8a65]/12"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <p
                        className={`text-[12px] font-semibold ${
                          isActive ? "text-[#7fe0b8]" : "text-white/85"
                        }`}
                      >
                        {phase.label}
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-white/42">
                        {phase.description}
                      </p>
                    </button>
                  );
                })}
              </div>
              </>)}

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/[0.02] px-3 py-2.5">
                  <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium mb-0.5">
                    Phase active
                  </p>
                  <p className="text-[12px] text-white font-semibold">
                    {activePhaseMeta?.label ?? "Non définie"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.02] px-3 py-2.5">
                  <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium mb-0.5">
                    Direction nutrition
                  </p>
                  <p className="text-[12px] text-white font-semibold">
                    {phaseDirection === "deficit"
                      ? "Déficit"
                      : phaseDirection === "surplus"
                        ? "Surplus"
                        : "Maintenance"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.02] px-3 py-2.5">
                  <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium mb-0.5">
                    Famille de phase
                  </p>
                  <p className="text-[12px] text-white font-semibold">
                    {phaseFamily === "cut"
                      ? "Sèche"
                      : phaseFamily === "bulk"
                        ? "Prise de masse"
                        : phaseFamily === "maintenance"
                          ? "Maintenance"
                          : "Recomposition"}
                  </p>
                </div>
              </div>
            </Card>

            {/* ── Informations ── */}
            <CollapsibleCard
              title="Informations"
              headerRight={!editingCrm ? (
                <button
                  onClick={() => { setCrmDraft({ ...crm }); setEditingCrm(true); }}
                  className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                >
                  <Edit2 size={11} /> Modifier
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingCrm(false)} className="text-[11px] text-white/40 hover:text-white transition-colors">
                    Annuler
                  </button>
                  <button
                    onClick={saveCrm}
                    disabled={savingCrm}
                    className="flex items-center gap-1.5 bg-[#1f8a65] hover:bg-[#217356] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {savingCrm ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    Enregistrer
                  </button>
                </div>
              )}
            >
              {/* Contact fields (always read-only) */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {client.email && <InfoCell icon={Mail} label="Email" value={client.email} />}
                {client.phone && <InfoCell icon={Phone} label="Téléphone" value={client.phone} />}
                <InfoCell icon={Calendar} label="Client depuis" value={new Date(client.created_at).toLocaleDateString("fr-FR")} />
              </div>

              {/* Separator */}
              <div className="mt-4 mb-1 h-px bg-white/[0.05]" />
              <SubSectionLabel>Informations complémentaires</SubSectionLabel>

              {!editingCrm ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <InfoCell icon={User} label="Date de naissance"
                    value={crm.date_of_birth ? new Date(crm.date_of_birth).toLocaleDateString("fr-FR") : null} />
                  {isMinor(crm.date_of_birth) && (
                    <InfoCell
                      icon={ShieldAlert}
                      label="Autorisation représentant légal"
                      value={crm.minor_authorization_status === "authorized"
                        ? `Confirmée${crm.minor_guardian_name ? ` — ${crm.minor_guardian_name}` : ""}`
                        : "À confirmer"}
                    />
                  )}
                  <InfoCell icon={User2} label="Genre"
                    value={crm.gender ? GENDER_LABELS[crm.gender] : null} />
                  <InfoCell icon={MapPin} label="Adresse"
                    value={[crm.address, crm.city].filter(Boolean).join(", ") || null} />
                  <InfoCell icon={PhoneCall} label="Contact urgence"
                    value={crm.emergency_contact_name
                      ? `${crm.emergency_contact_name}${crm.emergency_contact_phone ? ` — ${crm.emergency_contact_phone}` : ""}`
                      : null} />
                  <InfoCell icon={Tag} label="Acquisition"
                    value={crm.acquisition_source ? SOURCE_LABELS[crm.acquisition_source] : null} />
                  {crm.internal_notes && (
                    <div className="col-span-2">
                      <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium mb-1 flex items-center gap-1.5">
                        <StickyNote size={10} /> Notes internes
                      </p>
                      <div className="bg-white/[0.03] rounded-xl p-3">
                        <p className="text-[12px] text-white/70 whitespace-pre-wrap">{crm.internal_notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Date de naissance</label>
                    <input
                      type="date"
                      value={crmDraft.date_of_birth ?? ""}
                      onChange={e => setCrmDraft(d => ({
                        ...d,
                        date_of_birth: e.target.value,
                        minor_authorization_status: isMinor(e.target.value)
                          ? (d.minor_authorization_status === "authorized" ? "authorized" : "authorization_required")
                          : "not_required",
                      }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Genre</label>
                    <select value={crmDraft.gender ?? ""} onChange={e => setCrmDraft(d => ({ ...d, gender: e.target.value }))} className={selectCls}>
                      <option value="">— Non renseigné</option>
                      <option value="male">Homme</option>
                      <option value="female">Femme</option>
                      <option value="other">Autre</option>
                      <option value="prefer_not_to_say">Préfère ne pas dire</option>
                    </select>
                  </div>
                  {isMinor(crmDraft.date_of_birth) && (
                    <div className="col-span-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 space-y-3">
                      <div>
                        <p className="text-[11px] font-bold text-amber-100/80">Client mineur</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-white/40">
                          Confirmez avoir vérifié l’identité et l’accord du titulaire de l’autorité parentale,
                          et avoir informé le mineur dans un langage adapté.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Représentant légal — Nom</label>
                          <input
                            type="text"
                            value={crmDraft.minor_guardian_name ?? ""}
                            onChange={e => setCrmDraft(d => ({ ...d, minor_guardian_name: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Représentant légal — Email</label>
                          <input
                            type="email"
                            value={crmDraft.minor_guardian_email ?? ""}
                            onChange={e => setCrmDraft(d => ({ ...d, minor_guardian_email: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-relaxed text-white/60">
                        <input
                          type="checkbox"
                          checked={crmDraft.minor_authorization_status === "authorized"}
                          onChange={e => setCrmDraft(d => ({
                            ...d,
                            minor_authorization_status: e.target.checked ? "authorized" : "authorization_required",
                          }))}
                          className="mt-0.5 h-4 w-4 accent-[#c6b48b]"
                        />
                        J’atteste avoir vérifié l’autorisation du représentant légal pour le suivi et le traitement des données nécessaires.
                      </label>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Adresse</label>
                    <input type="text" placeholder="Rue, numéro..." value={crmDraft.address ?? ""} onChange={e => setCrmDraft(d => ({ ...d, address: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Ville</label>
                    <input type="text" placeholder="Paris" value={crmDraft.city ?? ""} onChange={e => setCrmDraft(d => ({ ...d, city: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Contact urgence — Nom</label>
                    <input type="text" placeholder="Marie Dupont" value={crmDraft.emergency_contact_name ?? ""} onChange={e => setCrmDraft(d => ({ ...d, emergency_contact_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Contact urgence — Tél.</label>
                    <input type="tel" placeholder="+33 6 ..." value={crmDraft.emergency_contact_phone ?? ""} onChange={e => setCrmDraft(d => ({ ...d, emergency_contact_phone: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Source d'acquisition</label>
                    <select value={crmDraft.acquisition_source ?? ""} onChange={e => setCrmDraft(d => ({ ...d, acquisition_source: e.target.value }))} className={selectCls}>
                      <option value="">— Non renseigné</option>
                      <option value="referral">Parrainage</option>
                      <option value="social_media">Réseaux sociaux</option>
                      <option value="website">Site web</option>
                      <option value="word_of_mouth">Bouche à oreille</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Notes internes (privées)</label>
                    <textarea
                      value={crmDraft.internal_notes ?? ""}
                      onChange={e => setCrmDraft(d => ({ ...d, internal_notes: e.target.value }))}
                      rows={2}
                      placeholder="Notes visibles uniquement par vous..."
                      className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 py-2.5 text-[12px] text-white outline-none resize-none placeholder:text-white/20"
                    />
                  </div>
                  {saveErrorCrm && (
                    <p className="col-span-2 text-[11px] text-red-300/80">{saveErrorCrm}</p>
                  )}
                </div>
              )}
            </CollapsibleCard>

            {/* ── Profil sportif + équipement + restrictions ── */}
            <CollapsibleCard
              title="Profil sportif"
              headerRight={!editingSport ? (
                <button
                  onClick={() => setEditingSport(true)}
                  className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                >
                  <Edit2 size={11} /> Modifier
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingSport(false)} className="text-[11px] text-white/40 hover:text-white transition-colors">
                    Annuler
                  </button>
                  <button
                    onClick={saveSport}
                    disabled={savingSport}
                    className="flex items-center gap-1.5 bg-[#1f8a65] hover:bg-[#217356] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {savingSport ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    Enregistrer
                  </button>
                </div>
              )}
            >
              {saveErrorSport && <p className="text-[11px] text-red-400/80 mb-3">{saveErrorSport}</p>}

              {/* Restrictions — toujours visibles en haut */}
              <SubSectionLabel>Restrictions physiques</SubSectionLabel>
              <RestrictionsWidget clientId={clientId} section="restrictions" />

              {/* Separator */}
              <div className="mt-4 mb-1 h-px bg-white/[0.05]" />
              <SubSectionLabel>Paramètres</SubSectionLabel>

              {!editingSport ? (
                <div className="grid grid-cols-3 gap-3">
                  {sportFields.map(field => (
                    <div key={field.label} className="bg-white/[0.02] rounded-xl px-3 py-2.5">
                      <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium mb-0.5">{field.label}</p>
                      <p className="text-[12px] text-white font-semibold">{field.value}</p>
                    </div>
                  ))}
                  {sportFields.length === 0 && (
                    <p className="text-[12px] text-white/30 col-span-3">Aucune donnée sportive renseignée.</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Objectif entraînement</label>
                    <select value={sportDraft.training_goal} onChange={e => setSportDraft(d => ({ ...d, training_goal: e.target.value }))} className={selectCls}>
                      <option value="">—</option>
                      {TRAINING_GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Niveau</label>
                    <select value={sportDraft.fitness_level} onChange={e => setSportDraft(d => ({ ...d, fitness_level: e.target.value }))} className={selectCls}>
                      <option value="">—</option>
                      {FITNESS_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Activité</label>
                    <select value={sportDraft.sport_practice} onChange={e => setSportDraft(d => ({ ...d, sport_practice: e.target.value }))} className={selectCls}>
                      <option value="">—</option>
                      {SPORT_PRACTICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Disponibilité (séances/sem)</label>
                    <input
                      type="number" min={1} max={7}
                      value={sportDraft.weekly_frequency}
                      onChange={e => setSportDraft(d => ({ ...d, weekly_frequency: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Objectif Pas (par jour)</label>
                    <input
                      type="number" min={0} step={500}
                      placeholder="10000"
                      value={sportDraft.step_target}
                      onChange={e => setSportDraft(d => ({ ...d, step_target: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Catégorie d'équipement</label>
                    <select value={sportDraft.equipment_category} onChange={e => setSportDraft(d => ({ ...d, equipment_category: e.target.value }))} className={selectCls}>
                      <option value="">—</option>
                      {EQUIPMENT_CATEGORIES.map(eq => <option key={eq.value} value={eq.value}>{eq.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1.5">Notes</label>
                    <textarea
                      value={sportDraft.notes}
                      onChange={e => setSportDraft(d => ({ ...d, notes: e.target.value }))}
                      rows={2}
                      className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 py-2.5 text-[12px] text-white outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Separator */}
              <div className="mt-4 mb-1 h-px bg-white/[0.05]" />
              <SubSectionLabel>Équipement disponible</SubSectionLabel>
              <RestrictionsWidget clientId={clientId} section="equipment" />
            </CollapsibleCard>

            {/* Paramètres IA Coach */}
            <AiCoachSettingsWidget clientId={clientId} />

            {/* Configuration check-in quotidien */}
            <CheckinConfigWidget clientId={clientId} />

            {/* Gestion des rendez-vous */}
            <ClientAppointmentsWidget
              clientId={clientId}
              clientFirstName={client?.first_name ?? null}
              clientLastName={client?.last_name ?? null}
            />

            {/* Espace client STRYVR */}
            <div
              ref={accessSectionRef}
              className={`rounded-2xl transition-[box-shadow,border-color] ${
                needsInvite ? "ring-1 ring-[#1f8a65]/50 rounded-2xl" : ""
              }`}
            >
              <Card>
                <div className="flex items-center justify-between mb-1">
                  <SectionLabel>Espace client STRYVR</SectionLabel>
                  {needsInvite && (
                    <span className="flex items-center gap-1 rounded-full bg-[#1f8a65]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#7fe2bf]">
                      Action requise
                    </span>
                  )}
                </div>
                <ClientAccessToken
                  clientId={clientId}
                  clientStatus={client.status ?? "inactive"}
                  clientEmail={client.email ?? null}
                  onStatusChange={setAccessStatus}
                />
              </Card>
            </div>

            {/* Formules & abonnement */}
            <Card>
              <SectionLabel>Formules & abonnement</SectionLabel>
              <ClientFormulasTab clientId={clientId} />
            </Card>

            {/* Tags */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Tags</SectionLabel>
                <button
                  onClick={() => setShowTagPicker(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors -mt-3"
                >
                  <Plus size={11} /> Gérer
                </button>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[28px]">
                {tagLoading ? (
                  <>
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </>
                ) : clientTags.length === 0 ? (
                  <p className="text-[12px] text-white/30 italic">Aucun tag assigné</p>
                ) : (
                  clientTags.map(tag => (
                    <span
                      key={tag.id}
                      className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <button onClick={() => removeTag(tag.id)} className="opacity-70 hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {showTagPicker && (
                <div className="mt-4 space-y-3">
                  <div className="h-px bg-white/[0.07]" />
                  {unassignedTags.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.16em] mb-2">Ajouter un tag existant</p>
                      <div className="flex flex-wrap gap-1.5">
                        {unassignedTags.map(tag => (
                          <button
                            key={tag.id}
                            onClick={() => addTag(tag.id)}
                            className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-white hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: tag.color }}
                          >
                            <Plus size={9} /> {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.16em] mb-2">Créer un nouveau tag</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nom du tag..."
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && createTag()}
                        className="flex-1 h-9 px-3 bg-[#0a0a0a] rounded-xl text-[12px] text-white outline-none placeholder:text-white/20"
                      />
                      <div className="flex gap-1">
                        {TAG_COLORS.slice(0, 5).map(c => (
                          <button
                            key={c}
                            onClick={() => setNewTagColor(c)}
                            className={`w-5 h-5 rounded-full transition-transform ${newTagColor === c ? "scale-125 ring-2 ring-offset-1 ring-white/30" : "hover:scale-110"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={createTag}
                        disabled={!newTagName.trim() || creatingTag}
                        className="h-9 px-3 bg-[#1f8a65] hover:bg-[#217356] text-white rounded-xl text-[12px] font-bold disabled:opacity-40 transition-colors flex items-center gap-1"
                      >
                        {creatingTag ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Créer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Zone dangereuse — toujours tout en bas de la colonne gauche */}
            <div className="bg-red-950/20 border-[0.3px] border-red-500/20 rounded-2xl px-4 py-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-400/60">Zone dangereuse</p>
              <button
                onClick={() => setShowDelete(true)}
                className="text-[12px] text-red-400/60 hover:text-red-400 transition-colors font-medium"
              >
                Supprimer ou archiver →
              </button>
            </div>
          </div>

          {/* ── COLONNE DROITE : optimisation de phase ── */}
          <div className="flex flex-col gap-4">
            <PhaseOptimizationWidget clientId={clientId} />
          </div>
        </div>
      </div>

      {showDelete && (
        <DeleteClientModal
          clientId={clientId}
          clientName={`${client.first_name} ${client.last_name}`}
          onClose={() => setShowDelete(false)}
          onSuccess={() => router.push("/coach/clients")}
        />
      )}
    </main>
  );
}
