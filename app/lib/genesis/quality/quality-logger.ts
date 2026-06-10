import type { QualityEvent } from './quality-contract';

export function logQualityEvents(events: QualityEvent[]) {
  // Remplace ceci par insertion DB (ipt_quality_events) si branché.
  for (const e of events) {
    const tag = e.severity.toUpperCase();
    console.log(`[IPT_QUALITY][${tag}]`, e.type, e.details ?? {});
  }
}
