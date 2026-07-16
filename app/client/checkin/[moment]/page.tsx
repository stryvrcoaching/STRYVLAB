"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useClientT } from "@/components/client/ClientI18nProvider";
import {
  formatCheckinStepValue,
  getCheckinUiSteps,
  getDefaultCheckinStepValue,
  type CheckinUiStep,
} from "@/lib/client/checkin/presentation";
import { emitClientInboxUpdated } from "@/lib/client/inboxEvents";
import StrivrToken from "@/components/client/StrivrToken";
import CheckinSavingOverlay from "@/components/client/checkin/CheckinSavingOverlay";

export default function ClientCheckinMomentPage() {
  const router = useRouter();
  const params = useParams();
  const { lang, t } = useClientT();
  const moment = String(params.moment || "");
  const uiCopy = useMemo(() => ({
    section: "Check-in",
    back: t('checkin.modal.action.back'),
    response: t('checkin.response'),
    skip: t('checkin.action.skip'),
    saved: t('checkin.saved'),
    empty: t('checkin.modal.empty'),
    loading: t('checkin.modal.loading'),
    submit: t('checkin.modal.action.submit'),
    next: t('common.continue'),
    sending: t('common.sending'),
    inputHint: t('checkin.inputHint'),
  }), [t]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [configId, setConfigId] = useState("");
  const [steps, setSteps] = useState<CheckinUiStep[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (moment !== "morning" && moment !== "evening") {
      router.replace("/client");
    }
  }, [moment, router]);

  useEffect(() => {
    async function loadToday() {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/client/checkin/today");
      const data = await res.json();
      const current = (data?.moments ?? []).find((entry: any) => entry.moment === moment);
      const activeFields: string[] = current?.fields ?? [];
      const nextSteps = getCheckinUiSteps(moment as "morning" | "evening", activeFields, lang);

      setConfigId(data?.config_id ?? "");
      setSteps(nextSteps);
      setCurrentIndex(0);

      const defaults: Record<string, number> = {};
      const prefills = data?.prefills ?? {};
      for (const step of nextSteps) {
        const defaultValue = prefills[step.key] ?? getDefaultCheckinStepValue(step);
        if (typeof defaultValue === "number") defaults[step.key] = defaultValue;
      }
      setValues(defaults);
      setLoading(false);
    }

    if (moment === "morning" || moment === "evening") {
      loadToday();
    }
  }, [lang, moment]);

  const title = useMemo(() => {
    if (moment === "morning") return t('checkin.title.morning');
    if (moment === "evening") return t('checkin.title.evening');
    return "Check-in";
  }, [moment, t]);

  const subtitle = useMemo(() => {
    if (moment === "morning") return t('checkin.subtitle.morning');
    return t('checkin.subtitle.evening');
  }, [moment, t]);

  const currentStep = steps[currentIndex] ?? null;
  const currentValue = currentStep ? values[currentStep.key] : undefined;
  const isLast = currentIndex >= steps.length - 1;
  const canContinue = Boolean(currentStep) && (typeof currentValue === "number" || currentStep.optional);
  const pct =
    currentStep &&
    typeof currentValue === "number" &&
    typeof currentStep.min === "number" &&
    typeof currentStep.max === "number"
      ? ((currentValue - currentStep.min) / (currentStep.max - currentStep.min)) * 100
      : 0;

  function setNumericValue(stepKey: string, rawValue: string) {
    const trimmed = rawValue.replace(",", ".").trim();
    setValues((prev) => {
      const next = { ...prev };
      if (!trimmed.length) {
        delete next[stepKey];
        return next;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return next;
      next[stepKey] = stepKey === "daily_steps" ? Math.max(0, Math.round(parsed)) : parsed;
      return next;
    });
  }

  function advanceAfterChoice(nextValue: number) {
    if (!currentStep) return;

    setValues((prev) => ({ ...prev, [currentStep.key]: nextValue }));

    window.setTimeout(() => {
      if (isLast) {
        void submit();
        return;
      }
      setCurrentIndex((index) => Math.min(steps.length - 1, index + 1));
    }, 120);
  }

  async function submit() {
    if (!configId || !steps.length) return;

    const payload = Object.fromEntries(
      Object.entries(values).filter(([, value]) => typeof value === "number" && Number.isFinite(value)),
    );

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/client/checkin/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config_id: configId,
          moment,
          responses: payload,
        }),
      });

      if (res.ok) {
        const response = await res.json().catch(() => null);
        setPointsAwarded(response?.points_awarded ?? (response?.is_late ? 5 : 10));
        setDone(true);
        emitClientInboxUpdated();
        setTimeout(() => router.push("/client"), 2800);
        return;
      }

      const body = await res.json().catch(() => null);
      setError(body?.error ?? t('checkin.error.save'));
    } catch {
      setError(t('checkin.error.save'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#0d0d0d] px-4 pt-[88px] text-white">
        {uiCopy.loading}
      </main>
    );
  }

  if (!steps.length) {
    return (
      <main className="min-h-dvh bg-[#0d0d0d] px-4 pt-[88px] text-white">
        <p className="text-sm text-white/60">{uiCopy.empty}</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#0d0d0d] px-4 pt-[max(24px,env(safe-area-inset-top))] text-white" style={{ paddingBottom: "var(--client-sheet-bottom-padding)" }}>
      <section className="relative mx-auto flex min-h-[calc(100dvh-40px-env(safe-area-inset-top))] w-full max-w-lg flex-col rounded-[28px] border border-white/[0.06] bg-white/[0.03]">
        <div className="border-b border-white/[0.06] px-5 pb-4 pt-5">
          <button
            onClick={() => router.push("/client")}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-2 text-[12px] font-semibold text-white/72"
          >
            <ArrowLeft size={14} />
            {uiCopy.back}
          </button>

          <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">{uiCopy.section}</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-white">{title}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/52">{subtitle}</p>

          <div className="mt-5 flex items-center gap-1.5">
            {steps.map((_, index) => (
              <div
                key={index}
                className="h-[4px] rounded-full transition-all duration-300"
                style={{
                  background: index <= currentIndex ? "#f2f2f2" : "rgba(255,255,255,0.12)",
                  flex: index === currentIndex ? 2 : 1,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <AnimatePresence mode="wait">
            {!done && currentStep ? (
              <motion.div
                key={currentStep.key}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[32px] leading-none">{currentStep.emoji}</span>
                    <p className="text-[20px] font-bold leading-snug text-white">{currentStep.question}</p>
                  </div>
                  {currentStep.helperText ? (
                    <p className="text-[12px] leading-relaxed text-white/50">{currentStep.helperText}</p>
                  ) : null}
                </div>

                {typeof currentValue === "number" ? (
                  <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{uiCopy.response}</p>
                    <p className="mt-1 text-[30px] font-black text-white">
                      {formatCheckinStepValue(currentStep, currentValue, lang)}
                    </p>
                  </div>
                ) : null}

                {currentStep.component === "chips" ? (
                  <div className="grid grid-cols-2 gap-3">
                    {(currentStep.options ?? []).map((option) => {
                      const selected = values[currentStep.key] === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => advanceAfterChoice(option.value)}
                          className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                            selected
                              ? "border-white/30 bg-white/[0.10] text-white"
                              : "border-white/[0.06] bg-white/[0.03] text-white/72"
                          }`}
                        >
                          <p className="text-[24px] leading-none">{option.emoji ?? currentStep.emoji}</p>
                          <p className="mt-3 text-[13px] font-semibold">{option.label}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : currentStep.component === "number" ? (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                    <label className="block text-[11px] uppercase tracking-[0.14em] text-white/35">
                      {uiCopy.inputHint}
                    </label>
                    <div className="mt-3 flex items-end gap-3">
                      <input
                        type="number"
                        inputMode={currentStep.step && currentStep.step < 1 ? "decimal" : "numeric"}
                        min={currentStep.min}
                        max={currentStep.max}
                        step={currentStep.step ?? 1}
                        value={typeof currentValue === "number" ? String(currentValue) : ""}
                        onChange={(event) => setNumericValue(currentStep.key, event.target.value)}
                        placeholder={currentStep.unit === "kg" ? "79.2" : currentStep.key === "daily_steps" ? "8432" : "60"}
                        className="h-14 flex-1 rounded-2xl border border-white/[0.08] bg-[#111111] px-4 text-[24px] font-black text-white outline-none placeholder:text-white/20"
                      />
                      {currentStep.unit ? (
                        <span className="pb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-white/45">
                          {currentStep.unit}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={currentStep.min}
                      max={currentStep.max}
                      step={currentStep.step}
                      value={currentValue ?? currentStep.min}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [currentStep.key]: parseFloat(event.target.value) }))
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-full"
                      style={{
                        background: `linear-gradient(to right, #f2f2f2 0%, #f2f2f2 ${pct}%, rgba(255,255,255,0.10) ${pct}%, rgba(255,255,255,0.10) 100%)`,
                      }}
                    />
                    <div className="flex justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
                        {currentStep.lowLabel ?? "Bas"}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
                        {currentStep.highLabel ?? "Haut"}
                      </span>
                    </div>
                  </div>
                )}

                {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
              </motion.div>
            ) : (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-10 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f2f2f2]">
                  <CheckCircle2 size={28} className="text-[#080808]" />
                </div>
                <p className="text-[15px] font-bold uppercase tracking-[0.14em] text-white">{uiCopy.saved}</p>
                <p className="flex items-center justify-center gap-2 text-[28px] font-black text-white">+{pointsAwarded ?? 0}<StrivrToken size={26} /></p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!done && currentStep ? (
          <div
            className="border-t border-white/[0.06] bg-[#111111]/96 px-5 pt-4 backdrop-blur"
            style={{ paddingBottom: "var(--client-sheet-bottom-padding)" }}
          >
            <div className="flex gap-2">
              {currentIndex > 0 ? (
                <button
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  className="h-12 rounded-xl bg-white/[0.06] px-5 text-[12px] font-bold uppercase tracking-[0.1em] text-white/72"
                >
                  {uiCopy.back}
                </button>
              ) : null}

              {currentStep.optional ? (
                <button
                  onClick={() => {
                    setValues((prev) => {
                      const next = { ...prev };
                      delete next[currentStep.key];
                      return next;
                    });
                    if (isLast) submit();
                    else setCurrentIndex((index) => Math.min(steps.length - 1, index + 1));
                  }}
                  className="h-12 rounded-xl bg-white/[0.06] px-5 text-[12px] font-bold uppercase tracking-[0.1em] text-white/72"
                >
                  {uiCopy.skip}
                </button>
              ) : null}

              {isLast ? (
                <button
                  onClick={submit}
                  disabled={submitting || !canContinue}
                  className="flex-1 h-12 rounded-xl bg-[#f2f2f2] text-[12px] font-bold uppercase tracking-[0.1em] text-[#080808] disabled:opacity-50"
                >
                  {submitting ? uiCopy.sending : uiCopy.submit}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIndex((index) => Math.min(steps.length - 1, index + 1))}
                  disabled={!canContinue}
                  className="flex-1 h-12 rounded-xl bg-[#f2f2f2] text-[12px] font-bold uppercase tracking-[0.1em] text-[#080808] disabled:opacity-50"
                >
                  {uiCopy.next}
                </button>
              )}
            </div>
          </div>
        ) : null}
        <CheckinSavingOverlay open={submitting} />
      </section>
    </main>
  );
}
