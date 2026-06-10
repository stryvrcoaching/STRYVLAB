import type { Axis } from './weights';

/**
 * Normalisation 0–100 (V1.1).
 * IMPORTANT: rawScale dépend du nombre de questions et des poids.
 * Ici: clamp + compression douce, robuste aux heuristiques initiales.
 */
export function normalizeAxisScore(axis: Axis, raw: number): number {
  // 1) clamp brut raisonnable
  const clamped = Math.max(-100, Math.min(100, raw));

  // 2) sigmoïde centrée: -100..100 -> ~0..100
  const k = 0.035; // pente (à calibrer empiriquement)
  const normalized = 100 / (1 + Math.exp(-k * clamped));

  // 3) round
  return Math.round(normalized);
}
