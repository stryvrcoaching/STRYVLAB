import type { SupabaseClient } from '@supabase/supabase-js'
import { callLLM } from '@/lib/llm/callLLM'
import { blockedWriteReply, needsWriteConfirmation, unsupportedMessageReply } from '@/lib/whatsapp/messages'
import type { WhatsAppInboundMessage } from '@/lib/whatsapp/webhook'

type CoachClient = { first_name: string; last_name: string; goal: string | null; status: string }

function buildClientDirectory(clients: CoachClient[]): string {
  if (!clients.length) return 'Aucun client actif trouvé.'
  return clients
    .slice(0, 80)
    .map((client) => `- ${client.first_name} ${client.last_name}: objectif ${client.goal ?? 'non renseigné'}`)
    .join('\n')
}

export async function buildWhatsAppReply(
  db: SupabaseClient,
  coachId: string,
  message: WhatsAppInboundMessage,
): Promise<string> {
  if (message.type !== 'text' || !message.text) return unsupportedMessageReply(message.type)
  if (needsWriteConfirmation(message.text)) return blockedWriteReply()

  const { data: clients, error } = await db
    .from('coach_clients')
    .select('first_name,last_name,goal,status')
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .order('first_name')

  if (error) throw new Error(`Unable to load coach context: ${error.message}`)

  const response = await callLLM({
    coachId,
    userMessage: message.text,
    contextSummary: { source: 'whatsapp', mode: 'read_only', active_client_count: clients?.length ?? 0 },
    maxTokens: 240,
    systemPrompt: `Tu es l'assistant STRYV lab d'un coach sportif, dans WhatsApp. Réponds en français, clairement et en moins de 1 000 caractères.\n\nMode de sécurité : lecture seule. Ne prétends jamais avoir modifié une prescription, des macros, un programme, un objectif ou envoyé un message. Ne donne pas de diagnostic médical. Si les données ci-dessous ne permettent pas de répondre, dis-le franchement.\n\nRépertoire minimal des clients actifs (seules données disponibles pour cette réponse) :\n${buildClientDirectory((clients ?? []) as CoachClient[])}`,
  }, { db })

  return response?.content.trim() || "Je n’ai pas pu préparer une réponse fiable pour le moment. Réessayez dans quelques instants."
}
