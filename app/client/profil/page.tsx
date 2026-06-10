import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { resolveClientFromUser } from "@/lib/client/resolve-client";
import { listClientNotificationItems } from "@/lib/client/inbox";
import ClientTopBar from "@/components/client/ClientTopBar";
import ProfilAccordion from "@/components/client/profile/ProfilAccordion";
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations";
import { getCycleStateFromLogs } from "@/lib/cycle/cycleEngine";
import type { CycleState, CycleLog } from "@/lib/cycle/cycleEngine";

export const metadata = { title: "Mon profil" };

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

  const [{ data: prefs }, notifData, { data: streakData }, cycleLogsResult, cycleBilanResult] =
    await Promise.all([
      client
        ? service
            .from("client_preferences")
            .select("*")
            .eq("client_id", client.id)
            .single()
        : Promise.resolve({ data: null }),
      client
        ? listClientNotificationItems(service, user.id, client.id, false)
        : Promise.resolve([]),
      client
        ? service
            .from("client_streaks")
            .select("current_streak, longest_streak, total_points, level")
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
  };

  const lang: ClientLang = ["fr", "en", "es"].includes(
    preferences.language as string,
  )
    ? (preferences.language as ClientLang)
    : "fr";
  const dateLocale =
    lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-GB";

  const notifications = notifData ?? [];
  const unreadCount = notifications.filter((n: (typeof notifications)[number]) => !n.read_at).length;

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
    <div className="min-h-screen bg-[#0d0d0d] font-barlow">
      <ClientTopBar
        section={ct(lang, "profil.section")}
        title={ct(lang, "profil.title")}
        right={
          <div className="w-8 h-8 rounded-full bg-[#222222] flex items-center justify-center shrink-0 overflow-hidden">
            {client?.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.profile_photo_url}
                alt={fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[11px] font-bold text-[#f2f2f2]">
                {initials}
              </span>
            )}
          </div>
        }
      />

      <main className="max-w-lg mx-auto px-4 pt-[88px] pb-24">
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
          notifications={notifications}
          notifPrefs={{
            notif_session_reminder: preferences.notif_session_reminder,
            notif_bilan_received: preferences.notif_bilan_received,
            notif_program_updated: preferences.notif_program_updated,
          }}
          unreadCount={unreadCount}
          streak={streakData ?? null}
          cycleState={cycleState}
        />
      </main>
    </div>
  );
}
