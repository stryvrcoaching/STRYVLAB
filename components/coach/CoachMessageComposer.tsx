"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import CoachConversationSheet from "@/components/coach/CoachConversationSheet";

export default function CoachMessageComposer({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-[#1f8a65] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#217356]"
      >
        <MessageSquare size={12} /> Message
      </button>

      <CoachConversationSheet
        notification={open ? { clientId, clientName, messageExcerpt: null } : null}
        onClose={() => setOpen(false)}
        onSent={() => undefined}
      />
    </>
  );
}
