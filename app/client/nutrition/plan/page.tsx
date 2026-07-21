import NutritionPageContent, { type NutritionSearchParams } from '../NutritionPageContent'

export default function ClientNutritionPlanPage({
  searchParams,
}: {
  searchParams: Promise<NutritionSearchParams>
}) {
  return <NutritionPageContent searchParams={searchParams} mode="plan" />
}
