"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionFeedbackTone } from "@/components/ui/ActionFeedbackBadge";

export interface TimedActionFeedback<TScope extends string | null = string | null> {
  scope: TScope;
  tone: ActionFeedbackTone;
  message: string;
}

export default function useTimedActionFeedback<TScope extends string | null = string | null>(
  timeoutMs = 2200,
) {
  const [feedback, setFeedback] = useState<TimedActionFeedback<TScope> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushFeedback = useCallback((scope: TScope, tone: ActionFeedbackTone, message: string) => {
    setFeedback({ scope, tone, message });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (tone === "loading") return;
    timeoutRef.current = setTimeout(() => {
      setFeedback((current) => (current?.scope === scope ? null : current));
    }, timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const clearFeedback = useCallback((scope?: TScope) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFeedback((current) => {
      if (!current) return null;
      if (scope === undefined || current.scope === scope) return null;
      return current;
    });
  }, []);

  return {
    feedback,
    pushFeedback,
    clearFeedback,
  };
}
