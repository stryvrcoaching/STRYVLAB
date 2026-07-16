"use client";

import { useCallback } from "react";
import type { ActionFeedbackTone } from "@/components/ui/ActionFeedbackBadge";

interface UseActionRequestOptions<TScope extends string> {
  setLoadingKey: (value: string | null) => void;
  pushFeedback: (scope: TScope, tone: ActionFeedbackTone, message: string) => void;
}

interface RunActionParams<TScope extends string, TResult> {
  scope: TScope;
  loadingKey: string;
  loadingMessage: string;
  successMessage: string;
  request: () => Promise<TResult>;
  onSuccess?: (result: TResult) => void | Promise<void>;
  getErrorMessage?: (error: unknown) => string;
}

export default function useActionRequest<TScope extends string>({
  setLoadingKey,
  pushFeedback,
}: UseActionRequestOptions<TScope>) {
  const runAction = useCallback(async <TResult>({
    scope,
    loadingKey,
    loadingMessage,
    successMessage,
    request,
    onSuccess,
    getErrorMessage,
  }: RunActionParams<TScope, TResult>) => {
    setLoadingKey(loadingKey);
    pushFeedback(scope, "loading", loadingMessage);
    try {
      const result = await request();
      await onSuccess?.(result);
      pushFeedback(scope, "success", successMessage);
      return result;
    } catch (error) {
      pushFeedback(
        scope,
        "error",
        getErrorMessage?.(error) ??
          (error instanceof Error ? error.message : "Action impossible pour le moment."),
      );
      return null;
    } finally {
      setLoadingKey(null);
    }
  }, [pushFeedback, setLoadingKey]);

  return { runAction };
}
