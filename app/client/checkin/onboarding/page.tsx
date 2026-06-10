"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeToPush } from "@/lib/client/push";

type Moment = { moment: "morning" | "evening"; fields: string[] };

export default function CheckinOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [times, setTimes] = useState<Record<string, string>>({
    morning: "07:30",
    evening: "21:00",
  });

  useEffect(() => {
    // Guard — déjà configuré : aller directement au schedule/check-in
    if (typeof window !== "undefined" && localStorage.getItem("checkin_configured") === "1") {
      router.replace("/client/checkin/schedule");
      return;
    }
    async function loadConfig() {
      const res = await fetch("/api/client/checkin/config");
      if (!res.ok) return;
      const data = await res.json();
      setMoments((data?.moments ?? []) as Moment[]);
    }
    loadConfig();
  }, [router]);

  async function finishSetup() {
    setSaving(true);
    setPermissionDenied(false);

    let pushToken: string | null | undefined = undefined;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      pushToken = await subscribeToPush();
    } else {
      setPermissionDenied(true);
      pushToken = null;
    }

    const schedules = moments.map((m) => ({
      moment: m.moment,
      scheduled_time: times[m.moment] ?? (m.moment === "morning" ? "07:30" : "21:00"),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
    }));

    if (schedules.length > 0) {
      await fetch("/api/client/checkin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules, push_token: pushToken }),
      });
    }

    setSaving(false);
    if (typeof window !== "undefined") localStorage.setItem("checkin_configured", "1");
    router.push("/client");
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] px-6 py-10">
      <section className="max-w-sm mx-auto bg-white/[0.02] rounded-xl p-5">
        <div className="flex gap-1.5 mb-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full ${i === step ? "w-5 bg-[#f2f2f2]" : "w-1.5 bg-white/20"}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h1 className="text-white text-[22px] font-black">Tes rappels quotidiens</h1>
            <p className="text-white/60 text-[13px] leading-relaxed">
              Ton coach a activé les check-ins {moments.map((m) => m.moment === "morning" ? "matin" : "soir").join(" + ")}.
            </p>
            <button
              onClick={() => setStep(1)}
              className="w-full h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold"
            >
              Suivant
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-white text-[22px] font-black">Installe l'application</h1>
            <div className="text-white/60 text-[13px] space-y-2">
              <p>iOS: Safari → Partager → "Sur l'écran d'accueil"</p>
              <p>Android: Chrome → menu ⋮ → "Installer l'application"</p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold"
            >
              C'est fait, continuer
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-white text-[22px] font-black">Configure tes horaires</h1>
            {moments.map((m) => (
              <div key={m.moment} className="bg-white/[0.03] rounded-xl p-3">
                <p className="text-[12px] text-white/70 capitalize mb-2">{m.moment === "morning" ? "Matin" : "Soir"}</p>
                <input
                  type="time"
                  value={times[m.moment]}
                  onChange={(e) => setTimes((prev) => ({ ...prev, [m.moment]: e.target.value }))}
                  className="h-10 px-3 rounded-xl bg-[#222222] text-white text-[12px]"
                />
              </div>
            ))}

            {permissionDenied && (
              <p className="text-[11px] text-amber-300/90">
                Notifications refusées. Tu pourras les activer plus tard depuis ton profil.
              </p>
            )}

            <button
              onClick={finishSetup}
              disabled={saving}
              className="w-full h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold disabled:opacity-50"
            >
              {saving ? "Activation..." : "Activer mes rappels"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
