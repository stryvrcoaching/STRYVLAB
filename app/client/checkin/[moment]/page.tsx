"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const FIELD_META: Record<string, { label: string; min?: number; max?: number; step?: number }> = {
  sleep_hours:   { label: "Durée du sommeil (h)", min: 0, max: 14, step: 0.5 },
  sleep_quality: { label: "Qualité du sommeil", min: 1, max: 5, step: 1 },
  energy_level:  { label: "Niveau d'énergie", min: 1, max: 5, step: 1 },
  stress_level:  { label: "Niveau de stress", min: 1, max: 5, step: 1 },
  rhr_morning:   { label: "BPM au réveil", min: 30, max: 120, step: 1 },
  weight_kg:     { label: "Poids (kg)", min: 30, max: 200, step: 0.1 },
};

export default function ClientCheckinMomentPage() {
  const router = useRouter();
  const params = useParams();
  const moment = String(params.moment || "");

  useEffect(() => {
    if (moment !== "morning" && moment !== "evening") {
      router.replace("/client");
    }
  }, [moment, router]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [configId, setConfigId] = useState<string>("");
  const [fields, setFields] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);

  useEffect(() => {
    async function loadToday() {
      setLoading(true);
      const res = await fetch("/api/client/checkin/today");
      const data = await res.json();
      const current = (data?.moments ?? []).find((m: any) => m.moment === moment);
      setConfigId(data?.config_id ?? "");
      const activeFields: string[] = current?.fields ?? [];
      setFields(activeFields);
      // Pre-initialize values to min so slider starts valid, never NaN
      const defaults: Record<string, number> = {};
      for (const f of activeFields) {
        const meta = FIELD_META[f];
        defaults[f] = meta?.min ?? 1;
      }
      setValues(defaults);
      setLoading(false);
    }
    loadToday();
  }, [moment]);

  const title = useMemo(() => {
    if (moment === "morning") return "Check-in du matin";
    if (moment === "evening") return "Check-in du soir";
    return "Check-in";
  }, [moment]);

  function update(field: string, value: number) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  const currentField = fields[currentIndex];
  const isLast = currentIndex >= fields.length - 1;
  const canGoNext = typeof values[currentField] === "number";

  async function submit() {
    if (!configId || !fields.length) return;
    const payload: Record<string, number> = {};
    for (const field of fields) {
      const v = values[field];
      if (typeof v === "number") payload[field] = v;
    }
    if (Object.keys(payload).length !== fields.length) return;

    setSubmitting(true);
    const res = await fetch("/api/client/checkin/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config_id: configId,
        moment,
        responses: payload,
      }),
    });
    setSubmitting(false);

    if (res.ok) {
      const response = await res.json().catch(() => null);
      setPointsAwarded(response?.is_late ? 5 : 10);
      setDone(true);
      setTimeout(() => router.push("/client"), 2000);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] text-white px-4 pt-[88px]">
        Chargement check-in...
      </main>
    );
  }

  if (!fields.length) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] text-white px-4 pt-[88px]">
        <p className="text-white/60 text-sm">Aucun check-in actif pour ce moment.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-4 pt-[88px] pb-24">
      <section className="max-w-lg mx-auto bg-white/[0.02] rounded-2xl p-4 space-y-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-semibold">
          {new Date().toLocaleDateString("fr-FR")}
        </p>
        <h1 className="text-[20px] font-bold text-white">{title}</h1>

        <div className="text-[11px] text-white/45">
          Question {currentIndex + 1} / {fields.length}
        </div>

        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div
              key={currentField}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {(() => {
                const meta = FIELD_META[currentField] ?? { label: currentField, min: 1, max: 5, step: 1 };
                return (
                  <>
                    <label className="text-[13px] text-white/80">{meta.label}</label>
                    <input
                      type="range"
                      min={meta.min ?? 1}
                      max={meta.max ?? 5}
                      step={meta.step ?? 1}
                      value={values[currentField] ?? meta.min ?? 1}
                      onChange={(e) => update(currentField, parseFloat(e.target.value))}
                      className="w-full h-2 appearance-none rounded-full cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #f2f2f2 0%, #f2f2f2 ${
                          (((values[currentField] ?? meta.min ?? 1) - (meta.min ?? 1)) /
                            ((meta.max ?? 5) - (meta.min ?? 1))) *
                          100
                        }%, rgba(255,255,255,0.1) ${
                          (((values[currentField] ?? meta.min ?? 1) - (meta.min ?? 1)) /
                            ((meta.max ?? 5) - (meta.min ?? 1))) *
                          100
                        }%, rgba(255,255,255,0.1) 100%)`,
                      }}
                    />
                    <p className="text-[18px] text-white font-bold">{values[currentField] ?? meta.min ?? 1}</p>
                  </>
                );
              })()}
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl bg-[#f2f2f2]/12 border border-[#f2f2f2]/25 p-4 text-center"
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#f2f2f2] font-semibold">
                Check-in validé
              </p>
              <p className="text-[22px] font-black text-white mt-1">
                +{pointsAwarded ?? 10} points
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {!done && (
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="h-11 px-4 rounded-xl bg-white/[0.08] text-white/80 text-[12px] font-semibold disabled:opacity-40"
            >
              Retour
            </button>
            {isLast ? (
              <button
                onClick={submit}
                disabled={submitting || !canGoNext}
                className="flex-1 h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold disabled:opacity-50"
              >
                {submitting ? "Envoi..." : "Valider"}
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex((i) => Math.min(fields.length - 1, i + 1))}
                disabled={!canGoNext}
                className="flex-1 h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold disabled:opacity-50"
              >
                Suivant
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
