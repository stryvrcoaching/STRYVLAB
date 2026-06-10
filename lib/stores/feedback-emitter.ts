// ============================================================
// lib/stores/feedback-emitter.ts
// UI Feedback System: Haptic Vibration + Card Flash Events
// Triggered when safety rules activate (CRITICAL/WARNING/ADVICE)
// ============================================================

export type FeedbackIntensity = "CRITICAL" | "WARNING" | "ADVICE";

export interface FeedbackEvent {
  ruleId: string;
  intensity: FeedbackIntensity;
  message: string;
  timestamp: number;
  dismissed: boolean;
}

/**
 * Haptic feedback patterns mapped to alert intensity
 */
const HAPTIC_PATTERNS: Record<FeedbackIntensity, number[]> = {
  CRITICAL: [200, 100, 200, 100, 200], // Long, strong vibrations
  WARNING: [100, 50, 100], // Medium vibrations
  ADVICE: [50, 50, 50], // Short, light vibrations
};

/**
 * CSS class names for card flash animations
 */
const FLASH_CLASSES: Record<FeedbackIntensity, string> = {
  CRITICAL: "animate-flash-critical",
  WARNING: "animate-flash-warning",
  ADVICE: "animate-flash-advice",
};

/**
 * FeedbackEmitter — Singleton event system
 * Handles haptic vibration, sound cues, and card flashing
 */
class FeedbackEmitter {
  private listeners: Set<(event: FeedbackEvent) => void> = new Set();
  private recentEvents: Map<string, number> = new Map(); // Rule ID → timestamp
  private readonly COOLDOWN_MS = 3000; // Prevent rapid re-triggers

  /**
   * Register a listener for feedback events
   */
  on(callback: (event: FeedbackEvent) => void): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Emit a feedback event (haptic + visual + sound)
   */
  emit(ruleId: string, intensity: FeedbackIntensity, message: string) {
    // Check cooldown (prevent feedback spam for same rule)
    const lastEmit = this.recentEvents.get(ruleId);
    const now = Date.now();
    if (lastEmit && now - lastEmit < this.COOLDOWN_MS) {
      return; // Too soon, skip
    }

    this.recentEvents.set(ruleId, now);

    const event: FeedbackEvent = {
      ruleId,
      intensity,
      message,
      timestamp: now,
      dismissed: false,
    };

    // 1. Haptic vibration (mobile devices)
    this.triggerHaptic(intensity);

    // 2. Sound cue
    this.playSound(intensity);

    // 3. Dispatch custom event for card flashing
    this.flashCard(ruleId, intensity);

    // 4. Notify all listeners
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Feedback listener error:", error);
      }
    });

    // 5. Log for debugging
    console.log(`[SafetyAlert ${intensity}] ${ruleId}: ${message}`);
  }

  /**
   * Trigger haptic feedback via Vibration API
   */
  private triggerHaptic(intensity: FeedbackIntensity) {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
      return; // Not available
    }

    const pattern = HAPTIC_PATTERNS[intensity];
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn("Haptic feedback failed:", error);
    }
  }

  /**
   * Play sound cue (Web Audio API)
   * Simple sine wave tones at different frequencies
   */
  private playSound(intensity: FeedbackIntensity) {
    try {
      // Create audio context if not available
      if (
        typeof (window as any).AudioContext === "undefined" &&
        typeof (window as any).webkitAudioContext === "undefined"
      ) {
        return; // No support
      }

      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Frequency mapped by intensity
      const frequencies: Record<FeedbackIntensity, number> = {
        CRITICAL: 800, // High frequency
        WARNING: 600, // Medium
        ADVICE: 400, // Low
      };

      oscillator.frequency.value = frequencies[intensity];
      oscillator.type = "sine";

      // Duration by intensity
      const durations: Record<FeedbackIntensity, number> = {
        CRITICAL: 0.2,
        WARNING: 0.15,
        ADVICE: 0.1,
      };

      const duration = durations[intensity];

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + duration,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      // Silent fail (audio might be disabled by browser)
    }
  }

  /**
   * Dispatch custom event to trigger card flashing
   */
  private flashCard(ruleId: string, intensity: FeedbackIntensity) {
    const customEvent = new CustomEvent("safety-alert-flash", {
      detail: {
        ruleId,
        intensity,
        flashClass: FLASH_CLASSES[intensity],
      },
      bubbles: true,
    });

    window.dispatchEvent(customEvent);
  }

  /**
   * Clear cooldown for a rule (force re-trigger if needed)
   */
  clearCooldown(ruleId?: string) {
    if (ruleId) {
      this.recentEvents.delete(ruleId);
    } else {
      this.recentEvents.clear();
    }
  }
}

// Singleton instance
export const feedbackEmitter = new FeedbackEmitter();
