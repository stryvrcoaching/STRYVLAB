"use client";

/**
 * Profil → Pilotage mirror of the primary cockpit direction.
 * Same language, same dismiss state, optional message prefill.
 */

import { useCallback, useEffect, useState } from "react";
import { computeCockpitSignals, type CockpitRawData } from "@/lib/coach/cockpit-signals";
import {
  filterActiveDirections,
  markDirectionTreated,
  snoozeDirection,
} from "@/lib/coach/cockpit-direction-dismiss";
import type { CockpitDirection } from "@/lib/coach/cockpit-directions";
import { CockpitDirectionsPanel } from "@/components/coach/CockpitDirectionsPanel";
import CoachConversationSheet from "@/components/coach/CoachConversationSheet";

export default function CockpitPilotMirror({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [directions, setDirections] = useState<CockpitDirection[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissTick, setDismissTick] = useState(0);
  const [messageDraft, setMessageDraft] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/clients/${clientId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/clients/${clientId}/nutrition-hub?window=7`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/clients/${clientId}/nutrition-data?mode=realtime`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/clients/${clientId}/checkin-summary?days=30`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/clients/${clientId}/performance-summary?weeks=8`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`/api/clients/${clientId}/cycle/status`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([clientResponse, nutrition, nutritionData, checkin, performance, cycle]) => {
        if (cancelled || !clientResponse?.client) {
          if (!cancelled) setDirections([]);
          return;
        }
        const raw: CockpitRawData = {
          client: clientResponse.client,
          nutrition,
          nutritionData,
          checkin,
          performance,
          cycleState: cycle?.cycleState ?? null,
        };
        const signals = computeCockpitSignals(clientId, raw);
        const active = filterActiveDirections(clientId, signals.directions);
        setDirections(active);
      })
      .catch(() => {
        if (!cancelled) setDirections([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, dismissTick]);

  useEffect(() => {
    const cancel = reload();
    return cancel;
  }, [reload]);

  if (loading && directions.length === 0) {
    return (
      <div className="h-[88px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
    );
  }

  if (directions.length === 0) return null;

  return (
    <>
      <CockpitDirectionsPanel
        compact
        directions={directions}
        onMessage={(dir) => {
          if (dir.clientMessage) setMessageDraft(dir.clientMessage);
        }}
        onTreated={(id) => {
          markDirectionTreated(clientId, id);
          setDismissTick((t) => t + 1);
        }}
        onSnooze={(id) => {
          snoozeDirection(clientId, id, 7);
          setDismissTick((t) => t + 1);
        }}
      />
      <CoachConversationSheet
        notification={
          messageDraft
            ? {
                clientId,
                clientName,
                messageExcerpt: null,
                draftContent: messageDraft,
              }
            : null
        }
        onClose={() => setMessageDraft(null)}
        onSent={() => setMessageDraft(null)}
      />
    </>
  );
}
