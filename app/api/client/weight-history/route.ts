import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = serviceClient()

  // 1. Resolve client details including gender and date_of_birth
  const clientData = await resolveClientFromUser(
    user.id,
    user.email,
    db,
    "id, coach_id, gender, date_of_birth"
  )

  if (!clientData) {
    return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })
  }

  const gender = clientData.gender || 'male'
  
  // Calculate age
  let age = 30 // fallback
  if (clientData.date_of_birth) {
    const birthDate = new Date(clientData.date_of_birth as string)
    const today = new Date()
    let calculatedAge = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--
    }
    if (calculatedAge > 10 && calculatedAge < 100) {
      age = calculatedAge
    }
  }

  // 2. Fetch all daily checkins with weight (asc by date)
  const { data: checkins, error: checkinsError } = await db
    .from('client_daily_checkins')
    .select('date, weight_kg')
    .eq('client_id', clientData.id)
    .not('weight_kg', 'is', null)
    .order('date', { ascending: true })

  if (checkinsError) {
    return NextResponse.json({ error: checkinsError.message }, { status: 500 })
  }

  // 3. Fetch completed morpho analyses (asc by date)
  const { data: morphos, error: morphosError } = await db
    .from('morpho_analyses')
    .select('analysis_date, body_composition, dimensions')
    .eq('client_id', clientData.id)
    .eq('status', 'completed')
    .order('analysis_date', { ascending: true })

  if (morphosError) {
    return NextResponse.json({ error: morphosError.message }, { status: 500 })
  }

  // 4. Fetch latest manual nutrition data for height and base fat fallback
  const { data: manualData } = await db
    .from('coach_client_nutrition_manual_data')
    .select('height_cm, body_fat_pct, weight_kg')
    .eq('client_id', clientData.id)
    .maybeSingle()

  const heightCm = Number(manualData?.height_cm) || 175 // fallback height
  const baseBodyFat = Number(manualData?.body_fat_pct) || null
  const baseWeight = Number(manualData?.weight_kg) || (checkins.length > 0 ? Number(checkins[0].weight_kg) : 80)

  // 5. Establish a reference point for dynamic body fat calculations
  let refWeight = baseWeight
  let refBodyFat = baseBodyFat

  const latestMorpho = morphos && morphos.length > 0 ? morphos[morphos.length - 1] : null
  if (latestMorpho?.body_composition?.body_fat_pct != null) {
    refBodyFat = Number(latestMorpho.body_composition.body_fat_pct)
    const morphoDateStr = latestMorpho.analysis_date
    const matchingCheckin = checkins.find(c => c.date === morphoDateStr)
    refWeight = matchingCheckin?.weight_kg ? Number(matchingCheckin.weight_kg) : baseWeight
  }

  // Create mapping of date -> morpho data
  const morphoMap = new Map<string, any>()
  if (morphos) {
    for (const m of morphos) {
      morphoMap.set(m.analysis_date, m)
    }
  }

  const history = checkins.map((checkin) => {
    const dateStr = checkin.date
    const weight = Number(checkin.weight_kg)
    
    // Check if there is an exact morpho entry on this day
    const morphoToday = morphoMap.get(dateStr)
    let bodyFat: number | null = null

    if (morphoToday?.body_composition?.body_fat_pct != null) {
      bodyFat = Number(morphoToday.body_composition.body_fat_pct)
    } else if (morphoToday?.dimensions) {
      // Calculate using US Navy method
      const dims = morphoToday.dimensions
      const waist = Number(dims.waist_cm || dims.waist)
      const neck = Number(dims.neck_cm || dims.neck)
      const hip = Number(dims.hip_cm || dims.hip || dims.hips_cm || dims.hips)
      
      if (gender === 'female' && waist > 0 && neck > 0 && hip > 0) {
        const density = 1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(heightCm)
        const calculatedBfp = 495 / density - 450
        if (!isNaN(calculatedBfp) && calculatedBfp > 3 && calculatedBfp < 60) {
          bodyFat = Number(calculatedBfp.toFixed(1))
        }
      } else if (gender === 'male' && waist > 0 && neck > 0) {
        const density = 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)
        const calculatedBfp = 495 / density - 450
        if (!isNaN(calculatedBfp) && calculatedBfp > 3 && calculatedBfp < 50) {
          bodyFat = Number(calculatedBfp.toFixed(1))
        }
      }
    }

    // If no direct morpho or Navy formula calculation, estimate dynamically based on weight delta from reference
    if (bodyFat == null && refBodyFat != null && refWeight > 0) {
      const weightDelta = weight - refWeight
      const refFatMass = refWeight * (refBodyFat / 100)
      // Forbes formula partitioning: 75% fat mass / 25% lean mass
      const estimatedFatMass = refFatMass + 0.75 * weightDelta
      const calculatedBfp = (estimatedFatMass / weight) * 100
      
      if (!isNaN(calculatedBfp) && calculatedBfp > 3 && calculatedBfp < 60) {
        bodyFat = Number(calculatedBfp.toFixed(1))
      }
    }

    // If still null, fallback to BMI calculation
    if (bodyFat == null && heightCm > 100) {
      const bmi = weight / ((heightCm / 100) ** 2)
      const calculatedBfp = (1.20 * bmi) + (0.23 * age) - (10.8 * (gender === 'female' ? 0 : 1)) - 5.4
      if (!isNaN(calculatedBfp) && calculatedBfp > 3 && calculatedBfp < 60) {
        bodyFat = Number(calculatedBfp.toFixed(1))
      }
    }

    return {
      date: dateStr,
      weight,
      bodyFat: bodyFat ? Number(bodyFat.toFixed(1)) : null
    }
  })

  return NextResponse.json({ history })
}
