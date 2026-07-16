"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ClientTopBar from "@/components/client/ClientTopBar";
import { useClientT } from "@/components/client/ClientI18nProvider";

type Entry = { moment: "morning" | "evening"; scheduled_time: string; timezone: string };

export default function CheckinSchedulePage() {
  const router = useRouter();
  const { t } = useClientT();
  const [entries, setEntries] = useState<Entry[]>([
    { moment: "morning", scheduled_time: "07:30", timezone: "Europe/Paris" },
    { moment: "evening", scheduled_time: "21:00", timezone: "Europe/Paris" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/client/checkin/schedule");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        setEntries(
          data.map((s: any) => ({
            moment: s.moment,
            scheduled_time: s.scheduled_time?.slice(0, 5) ?? "07:30",
            timezone: s.timezone ?? "Europe/Paris",
          }))
        );
      }
    }
    load();
  }, []);

  function update(moment: "morning" | "evening", value: string) {
    setEntries((prev) =>
      prev.map((e) => (e.moment === moment ? { ...e, scheduled_time: value } : e))
    );
  }

  async function save() {
    setSaving(true);
    setError(false);
    const response = await fetch("/api/client/checkin/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedules: entries }),
    });
    setSaving(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    router.back();
  }

  return (
    <div className="min-h-dvh bg-[#0d0d0d]">
      <ClientTopBar
        section={t("checkin.schedule.section")}
        title={t("checkin.schedule.title")}
        backHref="/client/profil"
      />
    <main className="min-h-dvh px-4 pt-[88px] pb-24 overflow-x-hidden">
      <section className="max-w-lg mx-auto bg-white/[0.02] rounded-xl p-4 space-y-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-semibold">
          {t("checkin.schedule.section")}
        </p>
        <h1 className="text-[18px] font-bold text-white">{t("checkin.schedule.title")}</h1>

        {entries.map((entry) => (
          <div key={entry.moment} className="bg-white/[0.03] rounded-xl p-3">
            <p className="text-[12px] text-white/70 mb-2">{t(`checkin.schedule.${entry.moment}` as "checkin.schedule.morning" | "checkin.schedule.evening")}</p>
            <input
              type="time"
              value={entry.scheduled_time}
              onChange={(e) => update(entry.moment, e.target.value)}
              className="h-10 px-3 rounded-xl bg-[#222222] text-white text-[12px]"
            />
          </div>
        ))}

        {error && <p className="text-xs text-red-300">{t("checkin.schedule.error")}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="h-11 px-4 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold disabled:opacity-50"
        >
          {saving ? t("checkin.schedule.saving") : t("checkin.schedule.save")}
        </button>
      </section>
    </main>
    </div>
  );
}
