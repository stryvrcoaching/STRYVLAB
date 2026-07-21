"use client";

import { useState, useEffect } from "react";
import type { ElementType } from "react";
import { Brain, ChevronDown, Loader2, Moon, Sunrise } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoachEntitlements } from "@/components/coach/useCoachEntitlements";
import PlanUpgradeCard from "@/components/coach/PlanUpgradeCard";

type CoachingFreedom = "none" | "safe" | "extended";

type AiSettings = {
  ai_llm_enabled: boolean;
  ai_tone: string | null;
  monthly_quota: number | null;
  ai_morning_routine_enabled: boolean;
  ai_evening_routine_enabled: boolean;
  coaching_freedom: CoachingFreedom;
  ai_chat_lang: 'fr' | 'es' | 'en' | null;
  nutrition_generation_enabled: boolean;
  nutrition_publication_mode: 'coach_review' | 'coach_auto';
  nutrition_allow_phase_adjustment: boolean;
};

const FREEDOM_OPTIONS: { value: CoachingFreedom; label: string; hint: string }[] = [
  { value: "none", label: "Aucun", hint: "Faits seulement, zéro conseil au client" },
  { value: "safe", label: "Sécurisé", hint: "Tips lifestyle sûrs, sans présomption" },
  { value: "extended", label: "Étendu", hint: "Tips lifestyle proactifs" },
];

export default function AiCoachSettingsWidget({ clientId }: { clientId: string }) {
  const { entitlements, loading: entitlementsLoading } = useCoachEntitlements();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [globalAiEnabled, setGlobalAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const appEnabled = entitlements?.clientAppEnabled === true;

  useEffect(() => {
    if (entitlementsLoading) return;
    if (!appEnabled) {
      setLoading(false);
      return;
    }
    fetch(`/api/clients/${clientId}/ai-settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
        if (data.global_ai_enabled !== undefined) setGlobalAiEnabled(data.global_ai_enabled);
        setLoading(false);
      })
      .catch(() => {
        setError("Erreur réseau");
        setLoading(false);
      });
  }, [clientId, appEnabled, entitlementsLoading]);

  async function updateSettings(updates: Partial<AiSettings>) {
    if (!settings) return;
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings); // optimistic update
    setSaving(true);
    
    try {
      const res = await fetch(`/api/clients/${clientId}/ai-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSettings(settings); // revert
      setError("Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  function ToggleRow({
    title,
    description,
    enabled,
    onToggle,
    Icon,
  }: {
    title: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
    Icon?: ElementType;
  }) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-2">
          {Icon && (
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/45">
              <Icon size={13} />
            </div>
          )}
          <div>
            <p className="text-[12px] font-semibold text-white">{title}</p>
            <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-[#1f8a65]" : "bg-white/[0.10]"
          }`}
        >
          <span
            className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
              enabled ? "left-5" : "left-1"
            }`}
          />
        </button>
      </div>
    );
  }

  if (!entitlementsLoading && !appEnabled) {
    return (
      <PlanUpgradeCard
        title="IA coach (routines client)"
        reason={
          entitlements?.clientAppBlockedReason ??
          "Les routines IA matinée/soirée s’exécutent dans l’app client STRYVR (plan Pro+)."
        }
      />
    );
  }

  if (loading || entitlementsLoading) {
    return (
      <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4 space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 flex-1 text-left">
          <Brain size={14} className="text-[#1f8a65]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
            IA Coach
          </p>
          <ChevronDown size={13} className={`text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {saving && <Loader2 size={12} className="animate-spin text-white/40" />}
      </div>

      {open && (<>
      {error && <p className="text-[11px] text-red-400 mb-3">{error}</p>}

      {!globalAiEnabled && (
        <div className="mb-4 p-3 bg-red-950/20 border border-red-500/20 rounded-xl">
          <p className="text-[11px] text-red-400/80 leading-relaxed">
            L'IA Coach est <strong>désactivée globalement</strong> dans vos paramètres Coach. 
            Vous devez l'activer là-bas pour que cette fonctionnalité prenne effet.
          </p>
        </div>
      )}

      <div className="mb-4">
        <ToggleRow
          title="Activer l'IA"
          description="L'IA répondra aux messages de ce client et pourra lancer les routines automatiques activées ci-dessous."
          enabled={settings.ai_llm_enabled}
          onToggle={() => updateSettings({ ai_llm_enabled: !settings.ai_llm_enabled })}
        />
      </div>

      {settings.ai_llm_enabled && (
        <div className="space-y-3 pt-3 border-t border-white/[0.05]">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5">
              Surcharge du Ton
            </label>
            <select
              value={settings.ai_tone || ""}
              onChange={(e) => updateSettings({ ai_tone: e.target.value || null })}
              className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 h-9 text-[12px] text-white outline-none"
            >
              <option value="">(Hériter des paramètres globaux)</option>
              <option value="strict">Strict</option>
              <option value="bienveillant">Bienveillant</option>
              <option value="motivant">Motivant</option>
              <option value="neutre">Neutre</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5">
              Liberté de coaching IA
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {FREEDOM_OPTIONS.map((opt) => {
                const active = (settings.coaching_freedom ?? "safe") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateSettings({ coaching_freedom: opt.value })}
                    className={`rounded-xl border-[0.3px] px-2 py-2 text-left transition-colors ${
                      active
                        ? "border-[#1f8a65]/40 bg-[#1f8a65]/[0.08]"
                        : "border-white/[0.06] bg-[#0a0a0a] hover:bg-white/[0.03]"
                    }`}
                  >
                    <p className={`text-[11px] font-semibold ${active ? "text-[#1f8a65]" : "text-white/70"}`}>
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-[9px] leading-snug text-white/35">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[9px] leading-relaxed text-white/30">
              Ne touche jamais à la programmation. Gère uniquement le volume de tips lifestyle.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5">
              Langue du chat IA
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { value: null,  label: 'Auto',     hint: 'Langue du client' },
                { value: 'fr',  label: 'Français', hint: 'Toujours FR' },
                { value: 'es',  label: 'Español',  hint: 'Toujours ES' },
                { value: 'en',  label: 'English',  hint: 'Toujours EN' },
              ] as Array<{ value: 'fr' | 'es' | 'en' | null; label: string; hint: string }>).map((opt) => {
                const active = (settings.ai_chat_lang ?? null) === opt.value
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => updateSettings({ ai_chat_lang: opt.value })}
                    className={`rounded-xl border-[0.3px] px-2 py-2 text-left transition-colors ${
                      active
                        ? 'border-[#1f8a65]/40 bg-[#1f8a65]/[0.08]'
                        : 'border-white/[0.06] bg-[#0a0a0a] hover:bg-white/[0.03]'
                    }`}
                  >
                    <p className={`text-[11px] font-semibold ${active ? 'text-[#1f8a65]' : 'text-white/70'}`}>
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-[9px] leading-snug text-white/35">{opt.hint}</p>
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-[9px] leading-relaxed text-white/30">
              "Auto" utilise la langue choisie par le client dans ses préférences.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5">
              Quota Mensuel
            </label>
            <input
              type="number"
              placeholder="(Défaut: Illimité)"
              value={settings.monthly_quota || ""}
              onChange={(e) => updateSettings({ monthly_quota: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 h-9 text-[12px] text-white outline-none placeholder:text-white/20"
            />
          </div>

          <div className="space-y-3 pt-3 border-t border-white/[0.05]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                Routines automatiques
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                Ces messages existent en dehors des check-ins. Si un check-in est configuré, il s'insère dans la routine.
              </p>
            </div>

            <ToggleRow
              title="Routine du matin"
              description="Salutation, contexte de la journée et check-in du matin si le coach l'a configuré."
              enabled={settings.ai_morning_routine_enabled}
              onToggle={() => updateSettings({ ai_morning_routine_enabled: !settings.ai_morning_routine_enabled })}
              Icon={Sunrise}
            />

            <ToggleRow
              title="Routine du soir"
              description="Débrief de fin de journée, check-in du soir si configuré, puis rappel naturel pour demain matin."
              enabled={settings.ai_evening_routine_enabled}
              onToggle={() => updateSettings({ ai_evening_routine_enabled: !settings.ai_evening_routine_enabled })}
              Icon={Moon}
            />
          </div>

          <div className="space-y-3 pt-3 border-t border-white/[0.05]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                Nutrition IA
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                Génère des brouillons dans Nutrition Studio en respectant allergies, cadres et préférences.
              </p>
            </div>
            <ToggleRow
              title="Activer la génération nutritionnelle"
              description="Autorise la génération manuelle et prépare les ajustements automatiques futurs."
              enabled={settings.nutrition_generation_enabled ?? false}
              onToggle={() => updateSettings({
                nutrition_generation_enabled: !settings.nutrition_generation_enabled,
              })}
              Icon={Brain}
            />
            {settings.nutrition_generation_enabled && (
              <>
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
                    Publication
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      {
                        value: 'coach_review',
                        label: 'Validation coach',
                        hint: 'Toujours relire avant publication',
                      },
                      {
                        value: 'coach_auto',
                        label: 'Automatique',
                        hint: 'Publication future si tous les contrôles passent',
                      },
                    ] as const).map((option) => {
                      const active = settings.nutrition_publication_mode === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateSettings({ nutrition_publication_mode: option.value })}
                          className={`rounded-xl border-[0.3px] px-2.5 py-2 text-left ${
                            active
                              ? 'border-[#1f8a65]/40 bg-[#1f8a65]/[0.08]'
                              : 'border-white/[0.06] bg-[#0a0a0a]'
                          }`}
                        >
                          <p className={`text-[11px] font-semibold ${active ? 'text-[#1f8a65]' : 'text-white/70'}`}>
                            {option.label}
                          </p>
                          <p className="mt-0.5 text-[9px] leading-snug text-white/35">{option.hint}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <ToggleRow
                  title="Autoriser les changements de phase"
                  description="Désactivé par défaut. Les générations manuelles ne changent jamais la phase silencieusement."
                  enabled={settings.nutrition_allow_phase_adjustment ?? false}
                  onToggle={() => updateSettings({
                    nutrition_allow_phase_adjustment: !settings.nutrition_allow_phase_adjustment,
                  })}
                />
              </>
            )}
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
