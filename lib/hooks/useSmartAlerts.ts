'use client';

/**
 * useSmartAlerts — Rules engine hook
 * Scans the client store on every change and returns active alerts.
 * Prepared for Smart Starters: alerts update reactively without manual triggers.
 */

import { useClientStore, SmartAlert } from '@/lib/stores/useClientStore';

export type { SmartAlert, SmartAlertLevel } from '@/lib/stores/useClientStore';

/**
 * Returns current smart alerts derived from the client profile + results.
 * Alerts are recomputed inside the store on every setProfile() call.
 */
export function useSmartAlerts(): SmartAlert[] {
  return useClientStore((state) => state.alerts);
}

/**
 * Returns count of alerts by level — useful for badge indicators.
 */
export function useAlertCounts(): { info: number; warning: number; danger: number; total: number } {
  const alerts = useClientStore((state) => state.alerts);
  return {
    info: alerts.filter((a) => a.level === 'info').length,
    warning: alerts.filter((a) => a.level === 'warning').length,
    danger: alerts.filter((a) => a.level === 'danger').length,
    total: alerts.length,
  };
}
