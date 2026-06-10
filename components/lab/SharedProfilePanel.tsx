'use client';

/**
 * SharedProfilePanel — Le Cockpit du Performance Lab
 *
 * Dark island (#343434) floating at the top of every tool page.
 * Any edit here triggers recalculateAll() in <100ms — all open calculators
 * update their displayed results without requiring a manual "Calculate" click.
 *
 * Design: STRYVR v2.1 — Card Dark, accent #D1FE02, Font-Mono values, ghost inputs.
 */

import React, { useState } from 'react';
import { User, Weight, Ruler, Zap, Target, AlertTriangle, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useAlertCounts } from '@/lib/hooks/useSmartAlerts';
import type { MacroGoal, MacroGender } from '@/lib/formulas';
import type { HydrationActivity, HydrationClimate } from '@/lib/formulas';

// ─── Inline ghost input ───────────────────────────────────────────────────────

function GhostInput({
  label,
  value,
  onChange,
  placeholder,
  unit,
  type = 'number',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  unit?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold tracking-widest text-[#888] uppercase">{label}</span>
      <div className="flex items-baseline gap-1">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent border-b border-[#444] focus:border-[#D1FE02] outline-none text-[#D1FE02] font-mono text-base font-bold placeholder:text-[#555] transition-colors pb-0.5"
        />
        {unit && <span className="text-[10px] text-[#888] shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Segmented toggle ─────────────────────────────────────────────────────────

function DarkToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 bg-[#2a2a2a] rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${
            value === opt.value
              ? 'bg-[#D1FE02] text-[#1a1a1a]'
              : 'text-[#888] hover:text-[#ccc]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Alert badge ──────────────────────────────────────────────────────────────

function AlertBadge() {
  const counts = useAlertCounts();
  if (counts.total === 0) return null;
  const color = counts.danger > 0 ? 'bg-red-500' : counts.warning > 0 ? 'bg-yellow-400' : 'bg-blue-400';
  return (
    <span className={`${color} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1`}>
      {counts.total}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SharedProfilePanel() {
  const { profile, setProfile, results } = useClientStore();
  const alerts = useClientStore((s) => s.alerts);

  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local controlled state — flush to store on blur for performance
  const [localWeight, setLocalWeight] = useState(profile.weight?.toString() ?? '');
  const [localHeight, setLocalHeight] = useState(profile.height?.toString() ?? '');
  const [localAge, setLocalAge] = useState(profile.age?.toString() ?? '');
  const [localBF, setLocalBF] = useState(profile.bodyFat?.toString() ?? '');

  const flush = () => {
    setProfile({
      weight: localWeight ? parseFloat(localWeight) : null,
      height: localHeight ? parseFloat(localHeight) : null,
      age: localAge ? parseFloat(localAge) : null,
      bodyFat: localBF ? parseFloat(localBF) : null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const macros = results.macros;
  const hydration = results.hydration;

  return (
    <div className="w-full bg-[#2b2b2b] border border-[#3a3a3a] rounded-2xl overflow-hidden shadow-2xl mb-8">

      {/* ── Collapsed header ──────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#313131] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#D1FE02]/10 flex items-center justify-center">
            <User size={13} className="text-[#D1FE02]" />
          </div>
          <span className="text-[11px] font-bold tracking-widest text-[#aaa] uppercase">Profil Client</span>
          <AlertBadge />
        </div>

        {/* Quick readout when collapsed */}
        <div className="flex items-center gap-4">
          {profile.weight && (
            <span className="hidden sm:flex items-baseline gap-1">
              <span className="font-mono text-sm font-bold text-[#D1FE02]">{profile.weight}</span>
              <span className="text-[9px] text-[#666]">kg</span>
            </span>
          )}
          {macros && (
            <span className="hidden md:flex items-baseline gap-1">
              <span className="font-mono text-sm font-bold text-[#D1FE02]">{macros.calories}</span>
              <span className="text-[9px] text-[#666]">kcal</span>
            </span>
          )}
          {hydration && (
            <span className="hidden md:flex items-baseline gap-1">
              <span className="font-mono text-sm font-bold text-[#D1FE02]">{hydration.liters}</span>
              <span className="text-[9px] text-[#666]">L</span>
            </span>
          )}
          {profile.gender === 'female' && profile.cyclePhase && (
            <span className="text-[9px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-medium capitalize">
              {profile.cyclePhase}
            </span>
          )}
          <div className="text-[#555]">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>

      {/* ── Expanded body ─────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-[#3a3a3a] px-5 py-5 space-y-5">

          {/* Row 1: Biometrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <GhostInput
              label="Poids"
              value={localWeight}
              onChange={setLocalWeight}
              placeholder="75"
              unit="kg"
              type="number"
            />
            <GhostInput
              label="Taille"
              value={localHeight}
              onChange={setLocalHeight}
              placeholder="175"
              unit="cm"
              type="number"
            />
            <GhostInput
              label="Âge"
              value={localAge}
              onChange={setLocalAge}
              placeholder="28"
              unit="ans"
              type="number"
            />
            <GhostInput
              label="BF%"
              value={localBF}
              onChange={setLocalBF}
              placeholder="15"
              unit="%"
              type="number"
            />
          </div>

          {/* Row 2: Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold tracking-widest text-[#888] uppercase">Sexe</span>
              <DarkToggle<MacroGender>
                options={[{ value: 'male', label: 'H' }, { value: 'female', label: 'F' }]}
                value={profile.gender}
                onChange={(v) => setProfile({ gender: v })}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold tracking-widest text-[#888] uppercase">Objectif</span>
              <DarkToggle<MacroGoal>
                options={[
                  { value: 'deficit', label: 'Cut' },
                  { value: 'maintenance', label: 'Maint' },
                  { value: 'surplus', label: 'Bulk' },
                ]}
                value={profile.macroGoal}
                onChange={(v) => setProfile({ macroGoal: v })}
              />
            </div>
          </div>

          {/* Row 3: Activity + Climate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold tracking-widest text-[#888] uppercase">Activité</span>
              <DarkToggle<HydrationActivity>
                options={[
                  { value: 'sedentary', label: 'Séd' },
                  { value: 'light', label: 'Léger' },
                  { value: 'moderate', label: 'Mod' },
                  { value: 'intense', label: 'Int' },
                  { value: 'athlete', label: 'Ath' },
                ]}
                value={profile.activityLevel}
                onChange={(v) => setProfile({ activityLevel: v })}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold tracking-widest text-[#888] uppercase">Climat</span>
              <DarkToggle<HydrationClimate>
                options={[
                  { value: 'cold', label: 'Froid' },
                  { value: 'temperate', label: 'Temp' },
                  { value: 'hot', label: 'Chaud' },
                  { value: 'veryHot', label: 'Ext' },
                ]}
                value={profile.climate}
                onChange={(v) => setProfile({ climate: v })}
              />
            </div>
          </div>

          {/* Row 4: Save button + live computed summary */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-[#3a3a3a]">
            <button
              onMouseDown={flush}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                saved
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-[#D1FE02] text-[#1a1a1a] hover:opacity-90 active:scale-95'
              }`}
            >
              {saved ? <Check size={12} /> : <Zap size={12} />}
              {saved ? 'Mis à jour' : 'Appliquer'}
            </button>

            {macros && (
              <div className="flex flex-wrap gap-4 text-right">
                <div>
                  <div className="font-mono text-lg font-bold text-[#D1FE02]">{macros.calories}</div>
                  <div className="text-[9px] text-[#666] uppercase">kcal</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-bold text-white">{macros.macros.p}g</div>
                  <div className="text-[9px] text-[#666] uppercase">prot</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-bold text-white">{macros.macros.c}g</div>
                  <div className="text-[9px] text-[#666] uppercase">gluc</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-bold text-white">{macros.macros.f}g</div>
                  <div className="text-[9px] text-[#666] uppercase">lip</div>
                </div>
                {hydration && (
                  <div>
                    <div className="font-mono text-lg font-bold text-blue-400">{hydration.liters}L</div>
                    <div className="text-[9px] text-[#666] uppercase">eau</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Smart Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#3a3a3a]">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg ${
                    alert.level === 'danger'
                      ? 'bg-red-900/30 text-red-300 border border-red-800/40'
                      : alert.level === 'warning'
                      ? 'bg-yellow-900/20 text-yellow-300 border border-yellow-800/30'
                      : 'bg-blue-900/20 text-blue-300 border border-blue-800/30'
                  }`}
                >
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
