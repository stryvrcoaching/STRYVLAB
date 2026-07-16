import RewardsClientPage from './RewardsClientPage'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import { ct } from '@/lib/i18n/clientTranslations'
import { getProgressionSummary } from '@/lib/rewards/progression'
import { createClient as createServerClient } from '@/utils/supabase/server'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export const dynamic = 'force-dynamic'

export default async function ClientRewardsPage() {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black text-white p-6">
          <p className="text-center text-white/60">{ct('fr', 'rewards.auth.required')}</p>
        </div>
      )
    }

    const db = service()
    
    const clientData = await resolveClientFromUser(
      user.id,
      user.email,
      db,
      'id, coach_id, gender, first_name, last_name, shipping_recipient_name, shipping_address_line1, shipping_address_line2, shipping_postal_code, shipping_city, shipping_country, shipping_phone'
    )

    if (!clientData) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black text-white p-6">
          <p className="text-center text-white/60">{ct('fr', 'rewards.client.missing')}</p>
        </div>
      )
    }

    const coachId = typeof clientData.coach_id === 'string' ? clientData.coach_id : null
    const lang = await resolveClientLanguage(db, clientData.id)
    if (!coachId) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black text-white p-6">
          <p className="text-center text-white/60">{ct(lang, 'rewards.coach.missing')}</p>
        </div>
      )
    }

    const [{ data: progressionData, error: progressionError }, { data: walletData, error: walletError }, { data: streakData }, { data: rewards, error: rewardsError }, { data: redemptions, error: redemptionsError }] = await Promise.all([
      db
        .from('client_progression_profiles')
        .select('total_points, level')
        .eq('user_id', user.id)
        .maybeSingle(),
      db
        .from('client_reward_wallets')
        .select('earned_points, spent_points')
        .eq('client_id', clientData.id)
        .eq('coach_id', coachId)
        .maybeSingle(),
      db
        .from('client_streaks')
        .select('current_streak')
        .eq('client_id', clientData.id)
        .maybeSingle(),
      db
        .from('coach_rewards')
        .select('id, title, description, cost_points, icon_name, image_url, reward_type')
        .eq('coach_id', coachId)
        .eq('is_active', true)
        .order('cost_points', { ascending: true }),
      db
        .from('client_reward_redemptions')
        .select('id, reward_id, status, redeemed_at, delivery_url, coach_rewards(id, title, description, cost_points, icon_name, image_url, reward_type)')
        .eq('client_id', clientData.id),
    ])

    if (progressionError) console.error('[client-rewards-page] progression error', progressionError)
    if (walletError) console.error('[client-rewards-page] wallet error', walletError)
    if (rewardsError) {
      console.error('[client-rewards-page] rewards error', rewardsError)
    }
    if (redemptionsError) {
      console.error('[client-rewards-page] redemptions error', redemptionsError)
    }

    const availablePoints = Math.max(0, (walletData?.earned_points ?? 0) - (walletData?.spent_points ?? 0))
    const progression = getProgressionSummary(progressionData?.total_points ?? 0)
    const redeemedRewards = (redemptions ?? []).flatMap((redemption) => {
      const reward = Array.isArray(redemption.coach_rewards) ? redemption.coach_rewards[0] : redemption.coach_rewards
      return reward ? [reward] : []
    })
    const visibleRewards = [...(rewards ?? []), ...redeemedRewards].filter(
      (reward, index, all) => all.findIndex((candidate) => candidate.id === reward.id) === index
    )

    return (
      <div className="premium-dashboard-bg min-h-dvh text-white">
        <div className="premium-dashboard-content">
          <main className="mx-auto flex w-full max-w-lg flex-col px-4 pb-24 pt-0">
            <RewardsClientPage
              rewards={visibleRewards}
              redemptions={redemptions ?? []}
              availablePoints={availablePoints}
              level={progression.level}
              totalPoints={progressionData?.total_points ?? 0}
              currentStreak={streakData?.current_streak ?? 0}
              gender={clientData.gender === 'female' ? 'female' : 'male'}
              shippingDefaults={{
                recipientName: clientData.shipping_recipient_name ?? [clientData.first_name, clientData.last_name].filter(Boolean).join(' '),
                addressLine1: clientData.shipping_address_line1 ?? '',
                addressLine2: clientData.shipping_address_line2 ?? '',
                postalCode: clientData.shipping_postal_code ?? '',
                city: clientData.shipping_city ?? '',
                country: clientData.shipping_country ?? '',
                phone: clientData.shipping_phone ?? '',
              }}
            />
          </main>
        </div>
      </div>
    )
  } catch (error) {
    console.error('[client-rewards-page] unexpected error', error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-semibold text-white/80">{ct('fr', 'rewards.page.unavailable')}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/40">
            {ct('fr', 'rewards.page.unavailable.desc')}
          </p>
        </div>
      </div>
    )
  }
}
