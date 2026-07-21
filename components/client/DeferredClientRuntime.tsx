"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const OfflineMutationSync = dynamic(
  () => import("@/components/client/OfflineMutationSync"),
  { ssr: false },
);
const ClientRealtimeSync = dynamic(
  () => import("@/components/client/ClientRealtimeSync"),
  { ssr: false },
);
const ClientNotificationDeepLinkHandler = dynamic(
  () => import("@/components/client/ClientNotificationDeepLinkHandler"),
  { ssr: false },
);

/**
 * Non-critical client runtime (realtime, offline queue, deep-links).
 * Mounted after idle so first paint / navigation isn't blocked by extra JS.
 */
export default function DeferredClientRuntime({
  clientId,
}: {
  clientId: string | null;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const enable = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(enable, { timeout: 2000 });
    } else {
      timeoutId = window.setTimeout(enable, 800);
    }

    return () => {
      cancelled = true;
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      <OfflineMutationSync />
      <ClientRealtimeSync clientId={clientId} />
      <ClientNotificationDeepLinkHandler />
    </>
  );
}
