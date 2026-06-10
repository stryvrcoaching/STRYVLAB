// ============================================================
// components/labs/SafetyAlertsPanel.tsx
// Phase 2 Demo: Safety Rules + Feedback System
// Shows all active alerts with card flashing on trigger
// ============================================================

"use client";

import React, { useRef } from "react";
import {
  useClientStoreAlerts,
  useCardFlash,
} from "@/lib/stores/useClientStoreMiddleware";
import type { SafetyRuleAlert } from "@/lib/stores/safety-rules";

/**
 * Alert card component with flashing animation
 */
function AlertCard({ alert }: { alert: SafetyRuleAlert }) {
  const cardRef = useRef<HTMLDivElement>(null);
  useCardFlash(cardRef, alert.id);

  const levelColors: Record<string, string> = {
    CRITICAL: "bg-red-100 border-red-500 text-red-900",
    WARNING: "bg-yellow-100 border-yellow-500 text-yellow-900",
    ADVICE: "bg-blue-100 border-blue-500 text-blue-900",
  };

  const levelBadgeColors: Record<string, string> = {
    CRITICAL: "bg-red-500 text-white",
    WARNING: "bg-yellow-500 text-white",
    ADVICE: "bg-blue-500 text-white",
  };

  const iconsMap = {
    CRITICAL: "⚠️",
    WARNING: "⚡",
    ADVICE: "ℹ️",
  };

  return (
    <div
      ref={cardRef}
      className={`rounded-lg border-l-4 p-4 mb-3 transition-all ${levelColors[alert.level]}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 pt-1">
          {iconsMap[alert.level]}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${levelBadgeColors[alert.level]}`}
            >
              {alert.level}
            </span>
            <span className="text-xs font-mono opacity-70">{alert.id}</span>
          </div>
          <h3 className="font-semibold text-sm mb-1">{alert.message}</h3>
          <p className="text-xs opacity-75 mb-2 font-mono">{alert.logicFix}</p>
          <button
            className={`px-3 py-1.5 rounded text-xs font-semibold ${
              alert.level === "CRITICAL"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : alert.level === "WARNING"
                  ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {alert.actionLabel}
          </button>
        </div>
        {alert.emittedAt && (
          <div className="text-right flex-shrink-0">
            <div className="text-xs opacity-60">
              {new Date(alert.emittedAt).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main panel showing all active alerts
 */
export function SafetyAlertsPanel() {
  const alerts = useClientStoreAlerts();

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-sm text-green-700">
        ✅ Aucune alerte de sécurité. Profil cohérent.
      </div>
    );
  }

  // Group by level
  const critical = alerts.filter((a) => a.level === "CRITICAL");
  const warnings = alerts.filter((a) => a.level === "WARNING");
  const advice = alerts.filter((a) => a.level === "ADVICE");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">🚨 Alertes de Sécurité</h2>
        <div className="text-sm text-gray-600">
          {critical.length} critique{critical.length !== 1 ? "s" : ""} •{" "}
          {warnings.length} avertissement{warnings.length !== 1 ? "s" : ""} •{" "}
          {advice.length} conseil{advice.length !== 1 ? "s" : ""}
        </div>
      </div>

      {critical.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-red-700 mb-2">CRITIQUE</h3>
          <div className="space-y-2">
            {critical.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-yellow-700 mb-2">
            AVERTISSEMENT
          </h3>
          <div className="space-y-2">
            {warnings.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {advice.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-blue-700 mb-2">CONSEIL</h3>
          <div className="space-y-2">
            {advice.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-200">
        💡 Chaque alerte déclenche :
        <ul className="mt-2 space-y-1 ml-4">
          <li>• Vibration haptique (mobile)</li>
          <li>• Son de notification</li>
          <li>• Animation de scintillement sur la carte</li>
        </ul>
      </div>
    </div>
  );
}

export default SafetyAlertsPanel;
