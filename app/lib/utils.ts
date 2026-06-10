// =====================================================
// UTILS — CLASSNAME MERGE
// File: lib/utils.ts
// =====================================================
// Purpose:
// - Fusionner des className conditionnelles proprement
// - Alternative minimaliste à clsx / classnames
// - Sans dépendance externe
// - Utilisé par les composants UI
// =====================================================

export function cn(
  ...classes: Array<string | undefined | null | false>
): string {
  return classes.filter(Boolean).join(' ');
}
