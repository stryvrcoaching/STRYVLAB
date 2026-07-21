import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { resolveClientFromUser } from "@/lib/client/resolve-client";
import ClientTopBar from "@/components/client/ClientTopBar";
import ProfilAccordion from "@/components/client/profile/ProfilAccordion";
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations";
import { resolveClientLanguage } from "@/lib/client/resolve-language";
import { getCycleStateFromLogs } from "@/lib/cycle/cycleEngine";
import type { CycleState, CycleLog } from "@/lib/cycle/cycleEngine";

export async function generateMetadata() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { title: ct("fr", "profil.title") };
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const client = await resolveClientFromUser(user.id, user.email, service, "id");
  const lang = client ? await resolveClientLanguage(service, client.id) : "fr";

  return { title: ct(lang, "profil.title") };
}

export default async function ClientProfilPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/client/login");

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const client = (await resolveClientFromUser(
    user.id,
    user.email,
    service,
    "id, first_name, last_name, email, phone, goal, date_of_birth, gender, training_goal, fitness_level, sport_practice, weekly_frequency, status, profile_photo_url, created_at",
  )) as any;

  const isFemale = (client as any)?.gender === "female";

  const [{ data: prefs }, { data: streakData }, cycleLogsResult, cycleBilanResult] =
    await Promise.all([
      client
        ? service
            .from("client_preferences")
            .select("*")
            .eq("client_id", client.id)
            .single()
        : Promise.resolve({ data: null }),
      client
        ? service
            .from("client_streaks")
            .select("current_streak, longest_streak, total_points, spent_points, level")
            .eq("client_id", client.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      client && isFemale
        ? service
            .from("menstrual_cycle_logs")
            .select("period_start_date, period_end_date, computed_cycle_length_days")
            .eq("client_id", client.id)
            .order("period_start_date", { ascending: false })
            .limit(7)
        : Promise.resolve({ data: null }),
      client && isFemale
        ? service
            .from("assessment_responses")
            .select("value_text")
            .eq("client_id", client.id)
            .eq("field_key", "menstrual_cycle")
            .not("value_text", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const firstName = client?.first_name ?? "";
  const lastName = client?.last_name ?? "";
  const initials =
    [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "?";
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") || (user.email ?? "Client");

  const preferences = prefs ?? {
    weight_unit: "kg",
    height_unit: "cm",
    language: "fr",
    notif_session_reminder: true,
    notif_bilan_received: true,
    notif_program_updated: true,
    notif_checkin_reminder: true,
    notif_hydration_reminder: true,
    notif_meal_reminder: true,
    notif_protein_reminder: true,
    notif_coach_messages: true,
    notif_progress_updates: true,
    training_reminder_times: ['08:00', '18:00'],
    hydration_reminder_first_time: '09:00',
    hydration_reminder_count: 3,
    meal_reminder_breakfast_time: '10:30',
    meal_reminder_lunch_time: '14:30',
    protein_reminder_time: '20:00',
  };

  const lang: ClientLang = ["fr", "en", "es"].includes(
    preferences.language as string,
  )
    ? (preferences.language as ClientLang)
    : "fr";
  const dateLocale =
    lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-GB";

  let cycleState: CycleState | null = null;
  if (isFemale && client) {
    const cycleLogs: CycleLog[] = (cycleLogsResult as any)?.data ?? [];
    const bilanValue: string | null = (cycleBilanResult as any)?.data?.value_text ?? null;
    cycleState = getCycleStateFromLogs(cycleLogs, bilanValue);
  }

  const memberSince = new Date(
    client?.created_at ?? Date.now(),
  ).toLocaleDateString(dateLocale, { month: "long", year: "numeric" });

  return (
    <div className="min-h-dvh bg-[#121212] font-barlow overflow-x-hidden">
      <ClientTopBar
        title={ct(lang, "profil.title")}
        right={
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#222222]">
            {client?.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.profile_photo_url}
                alt={fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[11px] font-bold text-[#f2f2f2]">
                {initials}
              </span>
            )}
          </div>
        }
      />

      <main className="client-page-top mx-auto max-w-lg px-4 pb-24">
        <ProfilAccordion
          clientId={client?.id ?? ""}
          profilePhotoUrl={client?.profile_photo_url ?? null}
          initials={initials}
          fullName={fullName}
          email={user.email ?? ""}
          status={client?.status ?? null}
          memberSince={memberSince}
          profileInitial={{
            first_name: client?.first_name ?? "",
            last_name: client?.last_name ?? "",
            phone: client?.phone ?? "",
            goal: client?.goal ?? "",
            date_of_birth: client?.date_of_birth ?? "",
            gender: client?.gender ?? "",
            training_goal: client?.training_goal ?? "",
            fitness_level: client?.fitness_level ?? "",
            sport_practice: client?.sport_practice ?? "",
            weekly_frequency: client?.weekly_frequency ?? null,
          }}
          prefsInitial={{
            weight_unit: preferences.weight_unit as "kg" | "lbs",
            height_unit: preferences.height_unit as "cm" | "ft",
            language: preferences.language as "fr" | "en" | "es",
          }}
          notifPrefs={{
            notif_session_reminder: preferences.notif_session_reminder,
            notif_bilan_received: preferences.notif_bilan_received,
            notif_program_updated: preferences.notif_program_updated,
            notif_checkin_reminder: preferences.notif_checkin_reminder,
            notif_hydration_reminder: preferences.notif_hydration_reminder,
            notif_meal_reminder: preferences.notif_meal_reminder,
            notif_protein_reminder: preferences.notif_protein_reminder,
            notif_coach_messages: preferences.notif_coach_messages,
            notif_progress_updates: preferences.notif_progress_updates,
            training_reminder_times: preferences.training_reminder_times,
            hydration_reminder_first_time: preferences.hydration_reminder_first_time,
            hydration_reminder_count: preferences.hydration_reminder_count,
            meal_reminder_breakfast_time: preferences.meal_reminder_breakfast_time,
            meal_reminder_lunch_time: preferences.meal_reminder_lunch_time,
            protein_reminder_time: preferences.protein_reminder_time,
          }}
          streak={streakData ?? null}
          cycleState={cycleState}
        />
      </main>
    </div>
  );
}
