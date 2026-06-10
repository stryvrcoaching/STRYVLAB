export type Severity = 'critical'|'high'|'moderate'|'info';

export interface Pattern {
  pattern_id: string;
  severity: Severity;
  title: string;
  description: string;
  evidence_keys: string[]; // keys from derived/scores used as evidence
  recommendations: string[];
  do: string[];
  dont: string[];
}
