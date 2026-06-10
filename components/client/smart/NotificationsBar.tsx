"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, ClipboardList, Sparkles, MessageSquare, Clock, TrendingUp } from "lucide-react";

export type Notification = {
  id: string;
  type: "coach_note" | "bilan_pending" | "program_assigned" | "system_reminder" | "tdee_updated" | "coach_feedback";
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICON: Record<Notification["type"], React.ElementType> = {
  coach_note: MessageSquare,
  bilan_pending: ClipboardList,
  program_assigned: Sparkles,
  system_reminder: Clock,
  tdee_updated: TrendingUp,
  coach_feedback: MessageSquare,
};

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
    await fetch(`/api/client/notifications/${id}`, { method: "PATCH" });
  };

  const handleClick = (n: Notification) => {
    if (n.type === "bilan_pending" && n.payload?.assessment_submission_id) {
      router.push(`/client/bilans/${n.payload.assessment_submission_id}`);
    } else if (n.type === "program_assigned") {
      router.push("/client/programme");
    } else if (n.type === "coach_note") {
      router.push("/client/metrics");
    } else if (n.type === "tdee_updated") {
      router.push("/client/nutrition");
    } else if (n.type === "coach_feedback") {
      const payload = n.payload as any
      if (!payload?.entity_type || !payload?.entity_id) {
        router.push("/client")
        return
      }
      switch (payload.entity_type) {
        case 'session':
          router.push(`/client/programme/recap/${payload.entity_id}`)
          break
        case 'bilan':
          router.push(`/client/bilans/${payload.entity_id}`)
          break
        case 'checkin':
          router.push('/client/checkin')
          break
        case 'morpho':
          router.push('/client/metrics')
          break
        default:
          router.push('/client')
      }
    } else {
      fetch("/api/client/notifications", { method: "PATCH" });
    }
  };

  return (
    <div className="space-y-2">
      {items.map((n) => {
        const Icon = TYPE_ICON[n.type] ?? ClipboardList;
        return (
          <div
            key={n.id}
            className="flex items-start gap-3 bg-[#111111] rounded-2xl p-3 active:scale-[0.99] transition-transform cursor-pointer"
            onClick={() => handleClick(n)}
          >
            <div className="w-9 h-9 rounded-lg bg-[#f2f2f2]/10 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-[#f2f2f2]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white">{n.title}</p>
              {n.body && (
                <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                  {n.body}
                </p>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(n.id);
              }}
              className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0"
            >
              <X size={14} className="text-white/40" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
