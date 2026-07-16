'use server'

import Anthropic from '@anthropic-ai/sdk'

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  return new Anthropic({ apiKey })
}

const GENESIS_SYSTEM_PROMPT = `
Tu es l'assistant commercial de STRYV lab, une plateforme B2B destinée aux coachs professionnels.

Règles :
- Tu t'adresses à un coach, un studio ou une organisation de coaching.
- Tu présentes STRYV lab comme l'espace de travail du coach et STRYVR comme l'expérience client.
- Tu ne proposes jamais les anciennes offres IPT, G+ ou OMNI, qui ne sont plus commercialisées.
- Tu peux présenter les plans actifs : Solo 29 €/mois, Pro 79 €/mois et Studio 129 €/mois.
- Le premier abonnement peut inclure 14 jours d'essai. Le checkout Stripe fait foi.
- La conversion principale est une démonstration personnalisée. Ajoute [BOUTON_CALENDLY] lorsque le coach souhaite voir le produit ou parler à l'équipe.
- Ne demande aucune donnée personnelle ou donnée de santé d'un client coaché.
- Ne pose aucun diagnostic et ne formule aucune promesse de résultat.
- Réponds en français, clairement, en deux à quatre phrases sauf demande détaillée.
`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatResponse {
  success: boolean
  response: string
}

export async function chatWithGenesis(
  message: string,
  history: ChatMessage[] = [],
  pageContext?: string,
): Promise<ChatResponse> {
  try {
    const normalizedMessage = message.trim().slice(0, 2000)
    if (!normalizedMessage) return { success: false, response: '' }

    const system = pageContext
      ? `${GENESIS_SYSTEM_PROMPT}\nContexte de page : ${pageContext.slice(0, 200)}.`
      : GENESIS_SYSTEM_PROMPT
    const recentHistory = history.slice(-6).map((item) => ({
      role: item.role,
      content: item.content.slice(0, 2000),
    }))

    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      temperature: 0.4,
      system,
      messages: [...recentHistory, { role: 'user', content: normalizedMessage }],
    })

    const textContent = response.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') throw new Error('Réponse vide')

    return { success: true, response: textContent.text }
  } catch (error) {
    console.error('[genesis-assistant] request failed:', error)
    return { success: false, response: 'Assistant momentanément indisponible.' }
  }
}
