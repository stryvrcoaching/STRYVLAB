"use client";

import { useEffect } from "react";

export function CoachPageTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    const key = `cp_view_${slug}`;
    // Avoid double-count on React strict mode / quick remount in same session tab
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    void fetch(`/api/public/coach-page/${encodeURIComponent(slug)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "view" }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}

export function trackCoachPageEvent(
  slug: string,
  eventType: "cta_click" | "formula_click" | "share",
  meta?: Record<string, string>,
) {
  if (!slug) return;
  void fetch(`/api/public/coach-page/${encodeURIComponent(slug)}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: eventType, meta: meta ?? {} }),
    keepalive: true,
  }).catch(() => {});
}
