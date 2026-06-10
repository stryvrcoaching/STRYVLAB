export type EscalationReason = 
  | 'safety_health' 
  | 'safety_mental' 
  | 'out_of_scope_protocol' 
  | 'out_of_scope_prediction' 
  | 'data_missing' 
  | 'llm_disabled'
  | null

export interface EscalationResult {
  shouldEscalate: boolean
  reason: EscalationReason
  matchedKeywords: string[]
}

const CATEGORIES: Record<Exclude<EscalationReason, 'data_missing' | 'llm_disabled' | null>, RegExp[]> = {
  safety_health: [
    /bless[ée]e?/i, /blessure/i, /déchirure/i, /claquage/i, /entorse/i, /tendinite/i, /fracture/i,
    /mal au dos/i, /mal aux genoux/i, /mal à l'épaule/i, /douleur/i, /j'ai mal/i, /ça fait mal/i,
    /je me suis fait mal/i, /je me suis cogné/i, /accident/i,
    /médicament/i, /médication/i, /ordonnance/i, /antibiotique/i, /antidouleur/i, /anti-inflammatoire/i,
    /je dois prendre/i, /médecin m'a prescrit/i,
    /enceinte/i, /grossesse/i, /allaitement/i, /j'allaite/i, /tombée enceinte/i
  ],
  safety_mental: [
    /déprimé/i, /dépression/i, /idées noires/i, /je veux en finir/i, /je vais mal/i,
    /je me fais vomir/i, /je ne mange plus/i, /je suis dégoûté/i, /obsession poids/i,
    /je n'ai personne/i, /je me sens seul/i
  ],
  out_of_scope_protocol: [
    /change mes macros/i, /modifie mon programme/i, /je veux faire autre chose/i, /on peut changer/i,
    /augmente.*calories/i, /diminue.*calories/i,
    /augmente.*protéines/i, /diminue.*protéines/i,
    /augmente.*glucides/i, /diminue.*glucides/i,
    /augmente.*lipides/i, /diminue.*lipides/i,
    /je veux ajouter une séance/i, /je veux faire moins/i, /je veux faire plus/i,
    /passer en sèche/i, /passer en prise de masse/i, /changer d'objectif/i
  ],
  out_of_scope_prediction: [
    /quand.*résultats/i, /dans combien de temps/i, /à quel moment/i,
    /combien de temps pour perdre/i, /combien de temps pour prendre/i,
    /quand est-ce que je devrais/i
  ]
}

// Exception patterns to avoid false positives (e.g. "j'ai mal mangé")
const EXCEPTIONS = [
  /j'ai mal mangé/i,
  /j'ai mal dormi/i
]

export function evaluateSilentEscalation(content: string): EscalationResult {
  const normalizedContent = content.trim()
  
  // 1. Check for exceptions first (simple bypass)
  for (const exception of EXCEPTIONS) {
    if (exception.test(normalizedContent)) {
      // If we find an exception, we could strip that part out, 
      // but for V1 we just return no escalation if the entire message is mostly about this.
      // A more robust approach is removing the exception string from the content before testing.
    }
  }

  // Remove exceptions from the string being evaluated to avoid false positives
  let cleanContent = normalizedContent
  for (const exception of EXCEPTIONS) {
    cleanContent = cleanContent.replace(exception, '')
  }

  // 2. Evaluate categories in order of severity
  const orderedCategories: (keyof typeof CATEGORIES)[] = [
    'safety_mental',
    'safety_health',
    'out_of_scope_prediction',
    'out_of_scope_protocol'
  ]

  const matchedKeywords: string[] = []
  let detectedReason: EscalationReason = null

  for (const category of orderedCategories) {
    for (const regex of CATEGORIES[category]) {
      const match = cleanContent.match(regex)
      if (match) {
        matchedKeywords.push(match[0])
        if (!detectedReason) {
          detectedReason = category
        }
      }
    }
  }

  if (detectedReason) {
    return {
      shouldEscalate: true,
      reason: detectedReason,
      matchedKeywords
    }
  }

  return {
    shouldEscalate: false,
    reason: null,
    matchedKeywords: []
  }
}
