import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import EditTemplateClient from './EditTemplateClient'

export default async function EditProgramTemplatePage({ params }: { params: { templateId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: template } = await db
    .from('coach_program_templates')
    .select(`
      id, name, description, goal, level, frequency, weeks, muscle_tags, notes,
      equipment_archetype, session_mode, is_system, coach_id,
      coach_program_template_sessions (
        id, name, day_of_week, position, notes,
        coach_program_template_exercises (
          id, name, sets, reps, rest_sec, rir, notes, position, image_url,
          movement_pattern, equipment_required
        )
      )
    `)
    .eq('id', params.templateId)
    .or(`coach_id.eq.${user.id},is_system.eq.true`)
    .single()

  if (!template) notFound()

  // Système ou non-propriétaire → vue lecture seule
  if ((template as any).is_system || (template as any).coach_id !== user.id) {
    const { redirect } = await import('next/navigation')
    redirect(`/coach/programs/templates/${params.templateId}/view`)
  }

  return <EditTemplateClient template={template} templateId={params.templateId} />
}
