export type QualitySeverity = 'info'|'warn'|'error';

export interface QualityEvent {
  type: 'missing_data'|'out_of_range'|'axis_nan'|'drift_alert';
  severity: QualitySeverity;
  details?: Record<string, any>;
}

/**
 * V1.1 — contrat qualité minimal.
 * - détecte réponses manquantes
 * - détecte valeurs hors plage (si min/max fournis)
 * - détecte NaN/Inf
 */
export function runQualityChecks(params: {
  answers: Record<string, any>;
  required_question_ids: string[];
  ipt_global: number;
  axes: Record<string, { normalized: number }>;
}): QualityEvent[] {
  const ev: QualityEvent[] = [];
  const { answers, required_question_ids, ipt_global, axes } = params;

  const missing = required_question_ids.filter((id) => answers[id] === undefined || answers[id] === null);
  if (missing.length) {
    ev.push({ type: 'missing_data', severity: 'warn', details: { missing_count: missing.length, missing } });
  }

  if (!Number.isFinite(ipt_global) || ipt_global < 0 || ipt_global > 100) {
    ev.push({ type: 'axis_nan', severity: 'error', details: { ipt_global } });
  }

  for (const [k, v] of Object.entries(axes)) {
    const n = (v as any).normalized;
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ev.push({ type: 'axis_nan', severity: 'error', details: { axis: k, normalized: n } });
    }
  }

  return ev;
}
