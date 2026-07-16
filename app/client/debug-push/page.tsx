"use client";

import { useCallback, useEffect, useState } from "react";
import { useClientT } from "@/components/client/ClientI18nProvider";

type Diagnostic = {
  timestamp: string;
  userAgent: string;
  secureContext: boolean;
  standalone: boolean;
  notificationSupported: boolean;
  permission: NotificationPermission | "unsupported";
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerScope: string | null;
  serviceWorkerState: string | null;
  serviceWorkerScript: string | null;
  pushSupported: boolean;
  subscriptionExists: boolean;
  endpointDomain: string | null;
  hasP256dh: boolean;
  hasAuth: boolean;
  error: string | null;
};

export default function DebugPushPage() {
  const { t } = useClientT();
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const runDiagnostic = useCallback(async () => {
    setLoading(true);
    setCopied(false);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone,
      );

    const result: Diagnostic = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      secureContext: window.isSecureContext,
      standalone,
      notificationSupported: "Notification" in window,
      permission:
        "Notification" in window
          ? Notification.permission
          : "unsupported",
      serviceWorkerSupported: "serviceWorker" in navigator,
      serviceWorkerRegistered: false,
      serviceWorkerScope: null,
      serviceWorkerState: null,
      serviceWorkerScript: null,
      pushSupported: "PushManager" in window,
      subscriptionExists: false,
      endpointDomain: null,
      hasP256dh: false,
      hasAuth: false,
      error: null,
    };

    try {
      if ("serviceWorker" in navigator) {
        const registration =
          await navigator.serviceWorker.getRegistration();

        result.serviceWorkerRegistered = Boolean(registration);
        result.serviceWorkerScope = registration?.scope ?? null;

        const worker =
          registration?.active ??
          registration?.waiting ??
          registration?.installing ??
          null;

        result.serviceWorkerState = worker?.state ?? null;
        result.serviceWorkerScript = worker?.scriptURL ?? null;

        if (registration && "pushManager" in registration) {
          const subscription =
            await registration.pushManager.getSubscription();

          result.subscriptionExists = Boolean(subscription);

          if (subscription) {
            result.endpointDomain =
              new URL(subscription.endpoint).hostname;
            result.hasP256dh =
              Boolean(subscription.getKey("p256dh"));
            result.hasAuth =
              Boolean(subscription.getKey("auth"));
          }
        }
      }
    } catch (error) {
      result.error =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
    }

    setDiagnostic(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void runDiagnostic();
  }, [runDiagnostic]);

  async function copyDiagnostic() {
    if (!diagnostic) return;

    const text = JSON.stringify(diagnostic, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt(t('debug.push.prompt'), text);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "24px 16px 48px",
        background: "#f4f4f5",
        color: "#18181b",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <button
          type="button"
          onClick={() => history.back()}
          style={{
            border: 0,
            background: "transparent",
            padding: "8px 0",
            fontSize: 15,
          }}
        >
          ← Retour
        </button>

        <h1 style={{ marginBottom: 8 }}>
          Diagnostic Push
        </h1>

        <p style={{ marginTop: 0, color: "#52525b" }}>
          Cette page vérifie la permission, le service worker et
          la subscription Web Push de cet iPhone.
        </p>

        <div
          style={{
            display: "grid",
            gap: 10,
            margin: "20px 0",
          }}
        >
          <button
            type="button"
            onClick={() => void runDiagnostic()}
            disabled={loading}
            style={{
              minHeight: 48,
              border: 0,
              borderRadius: 12,
              background: "#18181b",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {loading ? "Analyse en cours…" : "Relancer le diagnostic"}
          </button>

          <button
            type="button"
            onClick={() => void copyDiagnostic()}
            disabled={!diagnostic}
            style={{
              minHeight: 48,
              border: "1px solid #d4d4d8",
              borderRadius: 12,
              background: "#fff",
              color: "#18181b",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {copied ? t('debug.push.copied') : t('debug.push.copy')}
          </button>
        </div>

        <pre
          style={{
            overflowX: "auto",
            padding: 16,
            borderRadius: 14,
            background: "#18181b",
            color: "#f4f4f5",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {diagnostic
            ? JSON.stringify(diagnostic, null, 2)
            : "Chargement…"}
        </pre>
      </div>
    </main>
  );
}
