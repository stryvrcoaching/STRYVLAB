const WRITE_INTENT = /\b(modifie|modifier|remplace|retire|supprime|baisse|augmente|ajoute|change|envoie(?:-lui)?|applique)\b/i

export function needsWriteConfirmation(message: string): boolean {
  return WRITE_INTENT.test(message)
}

export function unsupportedMessageReply(type: 'audio' | 'unsupported'): string {
  return type === 'audio'
    ? "Je ne peux pas encore traiter les messages vocaux. Envoyez-moi votre demande par texte."
    : "Je peux actuellement traiter les messages texte."
}

export function blockedWriteReply(): string {
  return "J’ai bien compris la demande de modification. Pour protéger vos clients, cet accès WhatsApp est actuellement en lecture seule : aucune prescription, macro ou séance n’a été modifiée."
}
