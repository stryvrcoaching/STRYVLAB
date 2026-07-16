import RegularityCalendarCard from '@/components/client/smart/RegularityCalendarCard'
import { useClientT } from '@/components/client/ClientI18nProvider'

type Props = {
  loggedDates: Set<string>
  today: string
}

export default function NutritionStreakCard({ loggedDates, today }: Props) {
  const { t } = useClientT()

  return (
    <RegularityCalendarCard
      loggedDates={loggedDates}
      today={today}
      title={t('nutrition.consistency')}
      streakLabel={t('common.days')}
    />
  )
}
