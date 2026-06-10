'use client'

import { useParams } from 'next/navigation'
import NutritionStudio from '@/components/nutrition/studio/NutritionStudio'

export default function NewNutritionProtocolPage() {
  const params   = useParams()
  const clientId = params.clientId as string
  return <NutritionStudio clientId={clientId} />
}
