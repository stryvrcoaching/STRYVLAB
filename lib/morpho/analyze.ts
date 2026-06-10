// lib/morpho/analyze.ts
// OpenAI Vision integration for morphological photo analysis

import OpenAI from 'openai'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  return new OpenAI({ apiKey })
}

const MORPHO_ANALYSIS_PROMPT = `You are a biomechanics expert analyzing body composition and posture from photos.

Analyze the provided photo and extract the following measurements and observations:

1. Body Composition:
   - Estimated body fat percentage (e.g., "Body fat: 18%")
   - Visible muscularity level

2. Postural Assessment:
   - Posture alignment (e.g., "Posture: Slight forward head position")
   - Shoulder alignment

3. Asymmetries (if visible):
   - Shoulder height difference (e.g., "Shoulder imbalance: 2cm")
   - Arm size difference (e.g., "Arm difference: 1.2cm")
   - Leg size difference (e.g., "Leg difference: 0.8cm")
   - Hip alignment (e.g., "Hip imbalance: 1.5cm")

4. Approximate Measurements (if estimable):
   - Waist circumference (e.g., "Waist: 78cm")
   - Hip circumference (e.g., "Hip: 96cm")
   - Left arm (e.g., "Left arm: 33cm")
   - Right arm (e.g., "Right arm: 34cm")

Be conservative. If something is not clearly visible, say "not visible in photo" rather than guessing.
Always use the exact format shown in parentheses above for values you can estimate.`

export async function analyzePhotoWithOpenAI(photoUrl: string): Promise<string> {
  const openai = getOpenAIClient()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: photoUrl, detail: 'high' },
          },
          {
            type: 'text',
            text: MORPHO_ANALYSIS_PROMPT,
          },
        ],
      },
    ],
    max_tokens: 1000,
    temperature: 0.3,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI Vision API')
  }
  return content
}

export async function getPhotoUrlsFromSubmission(
  submissionId: string,
  supabase: SupabaseClientAny
): Promise<string[]> {
  const { data: responses, error } = await supabase
    .from('assessment_responses')
    .select('storage_path, field_key')
    .eq('submission_id', submissionId)
    .like('field_key', 'photo_%')

  if (error) throw new Error(`Failed to fetch submission responses: ${error.message}`)
  if (!responses || responses.length === 0) return []

  const urls: string[] = []
  for (const r of responses as Array<{ storage_path: string | null; field_key: string }>) {
    if (!r.storage_path) continue
    const { data: signedUrl } = await supabase.storage
      .from('assessment-photos')
      .createSignedUrl(r.storage_path, 600) // 10min TTL
    if (signedUrl?.signedUrl) urls.push(signedUrl.signedUrl)
  }
  return urls
}

export async function getLatestClientBiometrics(
  clientId: string,
  supabase: SupabaseClientAny
): Promise<{ weight_kg?: number; height_cm?: number }> {
  const { data: latestSubmission } = await supabase
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'completed')
    .order('bilan_date', { ascending: false })
    .limit(1)
    .single()

  if (!latestSubmission) return {}

  const { data: responses } = await supabase
    .from('assessment_responses')
    .select('field_key, value_number')
    .eq('submission_id', (latestSubmission as { id: string }).id)
    .in('field_key', ['weight_kg', 'height_cm'])

  const biometrics: { weight_kg?: number; height_cm?: number } = {}
  for (const r of (responses ?? []) as Array<{ field_key: string; value_number: string | null }>) {
    if (r.field_key === 'weight_kg' && r.value_number != null) {
      biometrics.weight_kg = parseFloat(r.value_number)
    }
    if (r.field_key === 'height_cm' && r.value_number != null) {
      biometrics.height_cm = parseFloat(r.value_number)
    }
  }
  return biometrics
}
