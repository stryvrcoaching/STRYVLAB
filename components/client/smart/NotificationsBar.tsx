"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Sparkles,
  MessageSquare,
  Clock,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { emitClientInboxUpdated } from "@/lib/client/inboxEvents";
import { sendClientMutation } from "@/lib/client/offline-mutations";
import { DashboardSignalCard } from "@/components/client/smart/DashboardSignalCard";

export type Notification = {
  id: string;
  type:
    | "coach_note"
    | "coach_message"
    | "bilan_pending"
    | "program_assigned"
    | "program_updated"
    | "system_reminder"
    | "tdee_updated"
    | "coach_feedback";
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICON: Record<Notification["type"], React.ElementType> = {
  coach_note: MessageSquare,
  coach_message: MessageSquare,
  bilan_pending: ClipboardList,
  program_assigned: Sparkles,
  program_updated: Sparkles,
  system_reminder: Clock,
  tdee_updated: TrendingUp,
  coach_feedback: MessageSquare,
};

function toneFor(n: Notification) {
  if (n.payload?.event === "payment_reminder") return "warning" as const;
  if (n.type === "bilan_pending") return "attention" as const;
  if (
    n.type === "coach_message" ||
    n.type === "coach_note" ||
    n.type === "coach_feedback"
  ) {
    return "info" as const;
  }
  if (n.type === "system_reminder" || n.type === "tdee_updated") {
    return "warning" as const;
  }
  return "success" as const;
}

export default function NotificationsBar({
  initial,
}: {
  initial: Notification[];
}) {
  const [items, setItems] = useState(initial);
  const router = useRouter();

  if (items.length === 0) return null;

  const dismiss = async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    emitClientInboxUpdated();
    const result = await sendClientMutation({
      kind: "notification",
      url: `/api/client/notifications/${id}`,
      method: "PATCH",
    });
    if (!result.queued && !result.response?.ok) emitClientInboxUpdated();
  };

  const handleClick = (n: Notification) => {
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === n.id
            ? { ...item, read_at: new Date().toISOString() }
            : item,
        ),
      );
      emitClientInboxUpdated();
      void sendClientMutation({
        kind: "notification",
        url: `/api/client/notifications/${n.id}`,
        method: "PATCH",
      }).then((result) => {
        if (!result.queued && !result.response?.ok) emitClientInboxUpdated();
      });
    }
    const actionUrl =
      n.payload && typeof n.payload.action_url === "string"
        ? n.payload.action_url
        : null;
    if (actionUrl) {
      const isExternal =
        actionUrl.startsWith("http://") || actionUrl.startsWith("https://");
      const isStripe =
        isExternal &&
        (actionUrl.includes("checkout.stripe.com") ||
          actionUrl.includes("stripe.com/c/pay"));

      // Never open raw Stripe Checkout inside the PWA from a notification card.
      if (isStripe || n.payload?.event === "payment_reminder") {
        const params = new URLSearchParams();
        if (typeof n.payload?.payment_id === "string") {
          params.set("payment_id", n.payload.payment_id);
        }
        if (typeof n.payload?.subscription_id === "string") {
          params.set("subscription_id", n.payload.subscription_id);
        }
        if (typeof n.payload?.formula_id === "string") {
          params.set("formula_id", n.payload.formula_id);
        }
        const qs = params.toString();
        router.push(qs ? `/client/paiement?${qs}` : "/client/paiement");
        return;
      }

      if (isExternal) {
        window.open(actionUrl, "_blank", "noopener,noreferrer");
      } else {
        router.push(actionUrl);
      }
      return;
    }
    if (n.payload?.event === "payment_reminder") {
      const params = new URLSearchParams();
      if (typeof n.payload?.payment_id === "string") {
        params.set("payment_id", n.payload.payment_id);
      }
      router.push(
        params.toString()
          ? `/client/paiement?${params.toString()}`
          : "/client/paiement",
      );
      return;
    }
    if (n.type === "bilan_pending" && n.payload?.assessment_submission_id) {
      router.push(`/client/bilans/${n.payload.assessment_submission_id}`);
    } else if (n.type === "program_assigned" || n.type === "program_updated") {
      router.push("/client/programme");
    } else if (n.type === "coach_note") {
      if (n.payload?.entity_type === "nutrition_smoothing") {
        router.push("/client/nutrition");
      } else {
        router.push("/client/metrics");
      }
    } else if (n.type === "tdee_updated") {
      router.push("/client/nutrition");
    } else if (n.type === "coach_feedback") {
      const payload = n.payload as Record<string, unknown>;
      if (!payload?.entity_type || !payload?.entity_id) {
        router.push("/client");
        return;
      }
      switch (payload.entity_type) {
        case "session":
          router.push(`/client/programme/recap/${payload.entity_id}`);
          break;
        case "bilan":
          router.push(`/client/bilans/${payload.entity_id}`);
          break;
        case "checkin":
          router.push("/client/checkin");
          break;
        case "morpho":
          router.push("/client/metrics");
          break;
        default:
          router.push("/client");
      }
    } else {
      void sendClientMutation({
        kind: "notification",
        url: "/api/client/notifications",
        method: "PATCH",
      });
    }
  };

  return (
    <div className="space-y-2.5">
      {items.map((n) => {
        const isPayment = n.payload?.event === "payment_reminder";
        const Icon = isPayment
          ? CreditCard
          : (TYPE_ICON[n.type] ?? ClipboardList);
        return (
          <DashboardSignalCard
            body={n.body}
            icon={Icon}
            key={n.id}
            label="Ouvrir"
            onClick={() => handleClick(n)}
            onDismiss={() => void dismiss(n.id)}
            title={n.title}
            tone={toneFor(n)}
          />
        );
      })}
    </div>
  );
}
