"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  Clock3,
  Dumbbell,
  Droplets,
  Loader2,
  Smartphone,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useClientT } from "@/components/client/ClientI18nProvider";
import { subscribeToPush } from "@/lib/client/push";
import { buildHydrationReminderTimes } from "@/lib/client/reminders";
import { cn } from "@/app/lib/utils";

interface NotifPrefs {
  notif_session_reminder: boolean;
  notif_bilan_received: boolean;
  notif_program_updated: boolean;
  notif_checkin_reminder: boolean;
  notif_hydration_reminder: boolean;
  notif_meal_reminder: boolean;
  notif_protein_reminder: boolean;
  notif_coach_messages: boolean;
  notif_progress_updates: boolean;
  training_reminder_times: string[];
  hydration_reminder_first_time: string;
  hydration_reminder_count: number;
  meal_reminder_breakfast_time: string;
  meal_reminder_lunch_time: string;
  protein_reminder_time: string;
}

interface ReminderSchedule {
  training_reminder_times: string[];
  hydration_reminder_first_time: string;
  hydration_reminder_count: number;
  meal_reminder_breakfast_time: string;
  meal_reminder_lunch_time: string;
  protein_reminder_time: string;
}

interface Props {
  preferences: NotifPrefs;
}

const inputClass =
  "mt-2 block h-12 w-full min-w-0 rounded-xl border-[0.3px] border-white/[0.08] bg-[#0a0a0a] px-3.5 text-[14px] font-medium tabular-nums text-white [color-scheme:dark] outline-none transition-[border-color,background-color,box-shadow] hover:border-white/[0.14] focus:border-[#1f8a65]/70 focus:bg-white/[0.04] focus:ring-2 focus:ring-[#1f8a65]/20";

type PushStatus = {
  subscription: boolean;
  serverReady: boolean;
  clientAppEnabled: boolean;
  latestScheduledDelivery: {
    status?: "sent" | "failed";
    attempted_at?: string;
    kind?: string;
    created_at?: string;
  } | null;
};

export default function NotificationsPanel({ preferences: initialPrefs }: Props) {
  const { t } = useClientT();
  const [prefs, setPrefs] = useState<NotifPrefs>(initialPrefs);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsError, setPrefsError] = useState(false);
  const [schedule, setSchedule] = useState<ReminderSchedule>(() => ({
    training_reminder_times: initialPrefs.training_reminder_times?.length
      ? initialPrefs.training_reminder_times.slice(0, 2)
      : ["08:00", "18:00"],
    hydration_reminder_first_time:
      initialPrefs.hydration_reminder_first_time || "09:00",
    hydration_reminder_count: Math.min(
      10,
      Math.max(1, initialPrefs.hydration_reminder_count || 3),
    ),
    meal_reminder_breakfast_time:
      initialPrefs.meal_reminder_breakfast_time || "10:30",
    meal_reminder_lunch_time: initialPrefs.meal_reminder_lunch_time || "14:30",
    protein_reminder_time: initialPrefs.protein_reminder_time || "20:00",
  }));
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleState, setScheduleState] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const [testingPush, setTestingPush] = useState(false);
  const [pushTestResult, setPushTestResult] = useState<"ok" | "error" | null>(
    null,
  );
  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const [activatingPush, setActivatingPush] = useState(false);
  const [pushActivationError, setPushActivationError] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);

  async function refreshPushStatus() {
    try {
      const response = await fetch("/api/client/push/status", { cache: "no-store" });
      if (response.ok) setPushStatus(await response.json());
    } catch {
      // The settings remain usable if the status check is temporarily unavailable.
    }
  }

  useEffect(() => {
    void refreshPushStatus();
  }, []);

  const showTrainingSchedule = prefs.notif_session_reminder;
  const showHydrationSchedule = prefs.notif_hydration_reminder;
  const showNutritionSchedule =
    prefs.notif_meal_reminder || prefs.notif_protein_reminder;
  const showAnySchedule =
    showTrainingSchedule || showHydrationSchedule || showNutritionSchedule;
  const hydrationTimes = useMemo(
    () =>
      buildHydrationReminderTimes(
        schedule.hydration_reminder_first_time,
        schedule.hydration_reminder_count,
      ),
    [schedule.hydration_reminder_first_time, schedule.hydration_reminder_count],
  );
  const pushReady = Boolean(
    pushPermission === "granted"
    && pushStatus?.subscription
    && pushStatus.serverReady
    && pushStatus.clientAppEnabled,
  );

  async function togglePref(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSavingPrefs(true);
    setPrefsError(false);
    const response = await fetch("/api/client/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });
    if (!response.ok) {
      setPrefs(prefs);
      setPrefsError(true);
    }
    setSavingPrefs(false);
  }

  function setTrainingReminderCount(count: number) {
    setSchedule((current) => ({
      ...current,
      training_reminder_times:
        count === 1
          ? [current.training_reminder_times[0] || "08:00"]
          : [
              current.training_reminder_times[0] || "08:00",
              current.training_reminder_times[1] || "18:00",
            ],
    }));
    setScheduleState("idle");
  }

  function setTrainingReminderTime(index: number, value: string) {
    setSchedule((current) => ({
      ...current,
      training_reminder_times: current.training_reminder_times.map(
        (time, timeIndex) => (timeIndex === index ? value : time),
      ),
    }));
    setScheduleState("idle");
  }

  async function saveReminderSchedule() {
    setSavingSchedule(true);
    setScheduleState("idle");
    const response = await fetch("/api/client/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    });
    setSavingSchedule(false);
    setScheduleState(response.ok ? "saved" : "error");
  }

  async function testPush() {
    setTestingPush(true);
    setPushTestResult(null);
    try {
      let response = await fetch("/api/client/push/test", { method: "POST" });
      let result = await response.json().catch(() => null);

      if (!response.ok && result?.reason === "web_push_rejected") {
        const renewedToken = await subscribeToPush({ forceRenew: true });
        if (renewedToken) {
          const saved = await fetch("/api/client/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ push_token: renewedToken }),
          });
          if (saved.ok) {
            response = await fetch("/api/client/push/test", { method: "POST" });
            result = await response.json().catch(() => null);
          }
        }
      }

      setPushTestResult(response.ok ? "ok" : "error");
    } catch {
      setPushTestResult("error");
    } finally {
      setTestingPush(false);
      void refreshPushStatus();
    }
  }

  async function activatePush() {
    if (pushPermission === "unsupported") return;
    setActivatingPush(true);
    setPushActivationError(false);
    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") return;

      const pushToken = await subscribeToPush();
      if (!pushToken) throw new Error("subscription_unavailable");
      const response = await fetch("/api/client/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push_token: pushToken }),
      });
      if (!response.ok) throw new Error("subscription_save_failed");
      await refreshPushStatus();
    } catch {
      setPushActivationError(true);
    } finally {
      setActivatingPush(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── 1. Types de notifications ── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Bell size={13} className="text-white/40" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {t("notif.prefsTitle")}
          </p>
          {savingPrefs ? (
            <Loader2 size={12} className="animate-spin text-white/40" />
          ) : null}
        </div>
        {prefsError ? (
          <p className="mb-2 text-[11px] text-[#ff8660]">
            {t("notif.preferenceError")}
          </p>
        ) : null}
        <div className="space-y-3">
          <NotificationPreferenceGroup title={t("notif.coachingGroup")}>
            <PrefToggle
              label={t("notif.coachMessages")}
              value={prefs.notif_coach_messages}
              onChange={() => togglePref("notif_coach_messages")}
            />
            <PrefToggle
              label={t("notif.bilanReceived")}
              value={prefs.notif_bilan_received}
              onChange={() => togglePref("notif_bilan_received")}
            />
            <PrefToggle
              label={t("notif.programUpdated")}
              value={prefs.notif_program_updated}
              onChange={() => togglePref("notif_program_updated")}
            />
          </NotificationPreferenceGroup>

          <NotificationPreferenceGroup title={t("notif.dailyGroup")}>
            <PrefToggle
              label={t("notif.sessionReminder")}
              value={prefs.notif_session_reminder}
              onChange={() => togglePref("notif_session_reminder")}
            />
            <PrefToggle
              label={t("notif.checkinReminder")}
              value={prefs.notif_checkin_reminder}
              onChange={() => togglePref("notif_checkin_reminder")}
            />
            <PrefToggle
              label={t("notif.hydrationReminder")}
              value={prefs.notif_hydration_reminder}
              onChange={() => togglePref("notif_hydration_reminder")}
            />
            <PrefToggle
              label={t("notif.mealReminder")}
              value={prefs.notif_meal_reminder}
              onChange={() => togglePref("notif_meal_reminder")}
            />
            <PrefToggle
              label={t("notif.proteinReminder")}
              value={prefs.notif_protein_reminder}
              onChange={() => togglePref("notif_protein_reminder")}
            />
          </NotificationPreferenceGroup>

          <NotificationPreferenceGroup title={t("notif.progressGroup")}>
            <PrefToggle
              label={t("notif.progressUpdates")}
              value={prefs.notif_progress_updates}
              onChange={() => togglePref("notif_progress_updates")}
            />
          </NotificationPreferenceGroup>
        </div>
      </section>

      {/* ── 2. Horaires (uniquement si rappels concernés actifs) ── */}
      {(showAnySchedule || prefs.notif_checkin_reminder) && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Clock3 size={13} className="text-white/40" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              {t("notif.scheduleTitle")}
            </p>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-white/40">
            {t("notif.scheduleDescription")}
          </p>

          <div className="space-y-3">
            {prefs.notif_checkin_reminder ? (
              <ScheduleCard icon={Bell} title={t("checkin.schedule.section")}>
                <p className="text-[12px] leading-snug text-white/45">
                  {t("notif.checkinDescription")}
                </p>
                <Link
                  href="/client/checkin/schedule"
                  className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-white/[0.07] px-3 text-[12px] font-semibold text-white/80 transition-[background-color,color,transform] hover:bg-white/[0.1] hover:text-white active:scale-[0.98]"
                >
                  {t("notif.configureCheckins")}
                </Link>
              </ScheduleCard>
            ) : null}

            {showTrainingSchedule ? (
              <ScheduleCard icon={Dumbbell} title={t("notif.trainingTitle")}>
                <p className="text-[12px] leading-snug text-white/45">
                  {t("notif.trainingDescription")}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-[12px] text-white/50">
                    {schedule.training_reminder_times.length === 1
                      ? t("notif.reminderCount", { n: 1 })
                      : t("notif.reminderCountPlural", { n: schedule.training_reminder_times.length })}
                  </span>
                  <div className="flex rounded-xl bg-[#121212] p-1">
                    {[1, 2].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setTrainingReminderCount(n)}
                        className={cn(
                          "min-w-9 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
                          schedule.training_reminder_times.length === n
                            ? "bg-white/[0.1] text-white"
                            : "text-white/40",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {schedule.training_reminder_times.map((time, index) => (
                    <ReminderTimeField
                      key={index}
                      label={index === 0 ? t("notif.planned") : t("notif.ifNotDone")}
                      value={time}
                      onChange={(value) => setTrainingReminderTime(index, value)}
                    />
                  ))}
                </div>
              </ScheduleCard>
            ) : null}

            {showHydrationSchedule ? (
              <ScheduleCard icon={Droplets} title={t("notif.hydrationTitle")}>
                <p className="text-[12px] leading-snug text-white/45">
                  {t("notif.hydrationDescription")}
                </p>
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_108px] items-end gap-2.5">
                  <ReminderTimeField
                    label={t("notif.firstAlert")}
                    value={schedule.hydration_reminder_first_time}
                    onChange={(value) => {
                      setSchedule((c) => ({
                        ...c,
                        hydration_reminder_first_time: value,
                      }));
                      setScheduleState("idle");
                    }}
                  />
                  <div className="rounded-xl border-[0.3px] border-white/[0.08] bg-[#0a0a0a] px-3 py-2.5 text-right">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">{t("notif.perDay")}</p>
                    <p className="mt-0.5 text-[17px] font-bold tabular-nums text-white">
                      {schedule.hydration_reminder_count}
                    </p>
                  </div>
                </div>
                <input
                  aria-label="Nombre de rappels d’hydratation"
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={schedule.hydration_reminder_count}
                  onChange={(e) => {
                    setSchedule((c) => ({
                      ...c,
                      hydration_reminder_count: Number(e.target.value),
                    }));
                    setScheduleState("idle");
                  }}
                  className="mt-4 w-full accent-[#1f8a65]"
                />
                <div className="mt-4 rounded-xl border-[0.3px] border-white/[0.06] bg-[#0a0a0a] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                    {t("notif.schedulePreview")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hydrationTimes.map((time) => (
                      <span
                        key={time}
                        className="rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] tabular-nums text-white/65"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              </ScheduleCard>
            ) : null}

            {showNutritionSchedule ? (
              <ScheduleCard icon={Utensils} title={t("notif.nutritionTitle")}>
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {prefs.notif_meal_reminder ? (
                    <>
                      <ReminderTimeField
                        label={t("notif.breakfast")}
                        value={schedule.meal_reminder_breakfast_time}
                        onChange={(value) => {
                          setSchedule((c) => ({
                            ...c,
                            meal_reminder_breakfast_time: value,
                          }));
                          setScheduleState("idle");
                        }}
                      />
                      <ReminderTimeField
                        label={t("notif.lunch")}
                        value={schedule.meal_reminder_lunch_time}
                        onChange={(value) => {
                          setSchedule((c) => ({
                            ...c,
                            meal_reminder_lunch_time: value,
                          }));
                          setScheduleState("idle");
                        }}
                      />
                    </>
                  ) : null}
                  {prefs.notif_protein_reminder ? (
                    <ReminderTimeField
                      label={t("notif.protein")}
                      value={schedule.protein_reminder_time}
                      onChange={(value) => {
                        setSchedule((c) => ({
                          ...c,
                          protein_reminder_time: value,
                        }));
                        setScheduleState("idle");
                      }}
                    />
                  ) : null}
                </div>
              </ScheduleCard>
            ) : null}

            {showAnySchedule ? (
              <div>
                <button
                  type="button"
                  onClick={saveReminderSchedule}
                  disabled={savingSchedule}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f8a65] text-[13px] font-semibold text-white transition-[opacity,transform] active:scale-[0.98] hover:opacity-95 disabled:opacity-50"
                >
                  {savingSchedule ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    t("notif.saveTimes")
                  )}
                </button>
                {scheduleState === "saved" ? (
                  <p className="mt-2 text-center text-[11px] text-[#5dba87]">
                    {t("notif.timesSaved")}
                  </p>
                ) : null}
                {scheduleState === "error" ? (
                  <p className="mt-2 text-center text-[11px] text-[#ff8660]">
                    {t("notif.timesError")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {/* ── 3. Push appareil ── */}
      <section>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {t("notif.deviceTitle")}
        </p>
        <div className="rounded-2xl bg-white/[0.035] p-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1f8a65]/15 text-[#5dba87]">
              <Smartphone size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">{t("notif.pushTitle")}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                {pushPermission === "unsupported"
                  ? t("notif.pushUnsupported")
                  : pushPermission !== "granted"
                    ? t("notif.pushPermissionMissing")
                    : !pushStatus?.subscription
                      ? t("notif.pushSubscriptionMissing")
                      : !pushStatus.serverReady || !pushStatus.clientAppEnabled
                        ? t("notif.pushServiceUnavailable")
                        : pushStatus.latestScheduledDelivery?.status === "failed"
                          ? t("notif.pushDeliveryFailed")
                          : pushStatus.latestScheduledDelivery?.status === "sent"
                            ? t("notif.pushScheduledSent")
                            : t("notif.pushScheduledPending")}
              </p>
            </div>
          </div>

          {pushReady ? (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[#5dba87]">
              <Check size={13} strokeWidth={2.5} />
              <span>{t("notif.pushEnabledOnDevice")}</span>
            </div>
          ) : null}

          <div className="mt-3 flex flex-col gap-2">
            {pushPermission !== "granted" &&
            pushPermission !== "unsupported" ? (
              <button
                type="button"
                onClick={activatePush}
                disabled={activatingPush}
                className="flex min-h-10 items-center justify-center rounded-xl bg-white/[0.06] text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/[0.09] disabled:opacity-50"
              >
                {activatingPush
                  ? t("notif.activatingPush")
                  : t("notif.activatePush")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={testPush}
              disabled={testingPush || pushPermission === "unsupported"}
              className="flex min-h-10 items-center justify-center rounded-xl bg-white/[0.04] text-[12px] font-semibold text-white/60 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              {testingPush ? t("notif.testingPush") : t("notif.testPush")}
            </button>
          </div>

          {pushActivationError ? (
            <p className="mt-2 text-[11px] text-[#ff8660]">
              {t("notif.pushActivationError")}
            </p>
          ) : null}
          {pushTestResult === "ok" ? (
            <p className="mt-2 text-[11px] text-[#5dba87]">
              {t("notif.pushTestSuccess")}
            </p>
          ) : null}
          {pushTestResult === "error" ? (
            <p className="mt-2 text-[11px] text-[#ff8660]">
              {t("notif.pushTestError")}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ReminderTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[11px] font-medium text-white/50">
      {label}
      <input
        type="time"
        step="300"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

function ScheduleCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border-[0.3px] border-white/[0.07] bg-white/[0.035] p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1f8a65]/12 text-[#5dba87]">
          <Icon size={15} strokeWidth={2.2} />
        </div>
        <p className="text-[14px] font-semibold text-white">{title}</p>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function PrefToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3.5"
    >
      <span className="text-[13px] font-medium leading-snug text-white/80">
        {label}
      </span>
      <button
        type="button"
        onClick={onChange}
        aria-pressed={value}
        aria-label={label}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-[background-color,transform] active:scale-[0.96]",
          value ? "bg-[#1f8a65]" : "bg-white/[0.12]",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            value ? "left-6" : "left-1",
          )}
        />
      </button>
    </div>
  );
}

function NotificationPreferenceGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border-[0.3px] border-white/[0.07] bg-white/[0.035]">
      <p className="border-b-[0.3px] border-white/[0.07] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {title}
      </p>
      <div>{children}</div>
    </section>
  );
}
