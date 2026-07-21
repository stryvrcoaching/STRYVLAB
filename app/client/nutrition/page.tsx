import NutritionPageContent, { type NutritionSearchParams } from './NutritionPageContent'

export default function ClientNutritionPage({
  searchParams,
}: {
  searchParams: Promise<NutritionSearchParams>
}) {
  return <NutritionPageContent searchParams={searchParams} />
}
