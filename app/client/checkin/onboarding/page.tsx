"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeToPush } from "@/lib/client/push";
import { useClientT } from "@/components/client/ClientI18nProvider";

type Moment = { moment: "morning" | "evening"; fields: string[] };

export default function CheckinOnboardingPage() {
  const router = useRouter();
  const { t } = useClientT();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [times, setTimes] = useState<Record<string, string>>({
    morning: "07:30",
    evening: "21:00",
  });
  const showInstallStep = !isStandalone;
  const totalSteps = showInstallStep ? 3 : 2;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(standalone));
    }
    // Guard — déjà configuré : aller directement au schedule/check-in
    if (typeof window !== "undefined" && localStorage.getItem("checkin_configured") === "1") {
      router.replace("/client/checkin/schedule");
      return;
    }
    async function loadConfig() {
      const res = await fetch("/api/client/checkin/config");
      if (!res.ok) return;
      const data = await res.json();
      const nextMoments = (data?.moments ?? []) as Moment[];
      setMoments(nextMoments);
      if (nextMoments.length === 0) router.replace("/client");
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
    <main className="min-h-dvh bg-[#0d0d0d] px-6 py-10 overflow-x-hidden" style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))', paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
      <section className="max-w-sm mx-auto bg-white/[0.02] rounded-xl p-5">
        <div className="flex gap-1.5 mb-5">
          {Array.from({ length: totalSteps }, (_, i) => i).map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full ${i === step ? "w-5 bg-[#f2f2f2]" : "w-1.5 bg-white/20"}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h1 className="text-white text-[22px] font-black">{t('checkin.onboarding.title')}</h1>
            <p className="text-white/60 text-[13px] leading-relaxed">
              {t('checkin.onboarding.desc', {
                moments: moments.map((m) => m.moment === "morning" ? t('checkin.onboarding.morning') : t('checkin.onboarding.evening')).join(" + "),
              })}
            </p>
            <button
              onClick={() => setStep(1)}
              className="w-full h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold"
            >
              {t('onboarding.welcome.cta.next')}
            </button>
          </div>
        )}

        {showInstallStep && step === 1 && (
          <div className="space-y-4">
            <h1 className="text-white text-[22px] font-black">{t('checkin.onboarding.install.title')}</h1>
            <div className="text-white/60 text-[13px] space-y-2">
              <p>{t('checkin.onboarding.install.desc1')}</p>
              <p>{t('checkin.onboarding.install.ios')}</p>
              <p>{t('checkin.onboarding.install.android')}</p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold"
            >
              {t('checkin.onboarding.install.done')}
            </button>
          </div>
        )}

        {step === (showInstallStep ? 2 : 1) && (
          <div className="space-y-4">
            <h1 className="text-white text-[22px] font-black">{t('checkin.onboarding.times.title')}</h1>
            <p className="text-white/60 text-[13px] leading-relaxed">
              {t('checkin.onboarding.times.desc')}
            </p>
            {moments.map((m) => (
              <div key={m.moment} className="bg-white/[0.03] rounded-xl p-3">
                <p className="text-[12px] text-white/70 capitalize mb-2">{m.moment === "morning" ? t('checkin.title.morning') : t('checkin.title.evening')}</p>
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
                {t('checkin.onboarding.denied')}
              </p>
            )}

            <button
              onClick={finishSetup}
              disabled={saving}
              className="w-full h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold disabled:opacity-50"
            >
              {saving ? t('checkin.onboarding.activating') : t('checkin.onboarding.activate')}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
