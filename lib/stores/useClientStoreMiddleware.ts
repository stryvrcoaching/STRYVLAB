// ============================================================
// lib/stores/useClientStoreMiddleware.ts
// Middleware integration for Phase 2: Safety Rules + Feedback
// Extends useClientStore with automatic rule evaluation
// ============================================================

import { useCallback, useEffect, useRef } from "react";
import { useClientStore, type ClientProfile } from "./useClientStore";
import {
  evaluateSafetyRules,
  getNewlyActivatedAlerts,
  type SafetyRuleAlert,
} from "./safety-rules";
import { feedbackEmitter } from "./feedback-emitter";

/**
 * useClientStoreMiddleware — Hook to integrate safety rules
 * Call this once in a top-level layout or context provider
 *
 * Usage:
 *   export function RootLayout({ children }) {
 *     useClientStoreMiddleware()
 *     return <>{children}</>
 *   }
 */
export function useClientStoreMiddleware() {
  const previousAlertsRef = useRef<SafetyRuleAlert[]>([]);

  // Subscribe to profile and results changes
  const profile = useClientStore((state) => state.profile);
  const results = useClientStore((state) => state.results);

  // Main effect: evaluate rules on profile/results change
  useEffect(() => {
    if (!profile) return;

    // Evaluate all safety rules
    const currentAlerts = evaluateSafetyRules(profile, results);

    // Find newly activated alerts
    const newlyActivated = getNewlyActivatedAlerts(
      currentAlerts,
      previousAlertsRef.current,
    );

    // Emit feedback for each newly activated alert
    newlyActivated.forEach((alert) => {
      feedbackEmitter.emit(alert.id, alert.level, alert.message);
    });

    // Update previous state for next evaluation
    previousAlertsRef.current = currentAlerts;
  }, [profile, results]);
}

/**
 * useClientStoreAlerts — Hook to subscribe to safety rule changes
 *
 * Usage:
 *   const alerts = useClientStoreAlerts()
 *   return (
 *     <div>
 *       {alerts.map(alert => (
 *         <AlertCard key={alert.id} alert={alert} />
 *       ))}
 *     </div>
 *   )
 */
export function useClientStoreAlerts() {
  const profile = useClientStore((state) => state.profile);
  const results = useClientStore((state) => state.results);

  if (!profile) return [];

  return evaluateSafetyRules(profile, results).filter((alert) => alert.active);
}

/**
 * useClientProfileUpdate — Convenience hook for updating profile
 * Automatically triggers recalculateAll
 *
 * Usage:
 *   const updateProfile = useClientProfileUpdate()
 *   updateProfile({ weight: 85 })
 */
export function useClientProfileUpdate() {
  const setProfile = useClientStore((state) => state.setProfile);
  const recalculateAll = useClientStore((state) => state.recalculateAll);

  return useCallback(
    (partial: Partial<ClientProfile>) => {
      setProfile(partial);
      // recalculateAll is called automatically by the store's internal logic
      // (via the computeAlerts function which runs on profile change)
    },
    [setProfile],
  );
}

/**
 * useFeedbackListener — Subscribe to UI feedback events
 *
 * Usage:
 *   useFeedbackListener((event) => {
 *     console.log(`Alert ${event.intensity}: ${event.message}`)
 *   })
 */
export function useFeedbackListener(
  callback: Parameters<typeof feedbackEmitter.on>[0],
) {
  useEffect(() => {
    return feedbackEmitter.on(callback);
  }, [callback]);
}

/**
 * useCardFlash — Hook to flash a card on safety alert
 * Attach to alert card component
 *
 * Usage:
 *   const cardRef = useRef<HTMLDivElement>(null)
 *   useCardFlash(cardRef, alertId)
 *   return <div ref={cardRef} className={flashClass}>...</div>
 */
export function useCardFlash(
  cardRef: React.RefObject<HTMLElement>,
  ruleId: string,
) {
  useEffect(() => {
    const handleFlash = (event: CustomEvent) => {
      if (event.detail.ruleId === ruleId && cardRef.current) {
        const flashClass = event.detail.flashClass;

        // Remove any existing flash class
        cardRef.current.classList.remove(
          "animate-flash-critical",
          "animate-flash-warning",
          "animate-flash-advice",
        );

        // Trigger reflow to restart animation
        // eslint-disable-next-line no-unused-expressions
        cardRef.current.offsetHeight;

        // Add new flash class
        cardRef.current.classList.add(flashClass);

        // Remove after animation completes
        setTimeout(() => {
          if (cardRef.current) {
            cardRef.current.classList.remove(flashClass);
          }
        }, 600); // Match CSS animation duration
      }
    };

    window.addEventListener("safety-alert-flash", handleFlash as EventListener);

    return () => {
      window.removeEventListener(
        "safety-alert-flash",
        handleFlash as EventListener,
      );
    };
  }, [cardRef, ruleId]);
}
