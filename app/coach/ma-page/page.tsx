"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { Palette, LayoutList, Eye, Copy, Check, ExternalLink } from "lucide-react";
import { AppearancePanel } from "@/components/coach-page-builder/AppearancePanel";
import { SectionsList } from "@/components/coach-page-builder/SectionsList";
import { SectionEditor } from "@/components/coach-page-builder/SectionEditor";
import { LivePreview } from "@/components/coach-page-builder/LivePreview";
import { PublishChecklist } from "@/components/coach-page-builder/PublishChecklist";
import { QrShareCard } from "@/components/coach-page-builder/QrShareCard";
import { AnalyticsCard } from "@/components/coach-page-builder/AnalyticsCard";
import {
  canPublish,
  getPublishReadiness,
} from "@/lib/coach-page/publish-readiness";
import type {
  CoachPage,
  BuilderSection,
  SectionType,
  PublicFormula,
  FontChoice,
  BgChoice,
} from "@/types/coach-page";
import { DEFAULT_SECTIONS_ORDER } from "@/types/coach-page";

type Tab = "sections" | "appearance";

export default function MaPageBuilderPage() {
  // Fixed layout without fullscreen shell (fullscreen hides NavDock).
  // Height = viewport − top bar (88) − dock reserve (138). Only inner panels scroll.
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState<CoachPage | null>(null);
  const [sections, setSections] = useState<BuilderSection[]>([]);
  const [formulas, setFormulas] = useState<PublicFormula[]>([]);
  const [coachId, setCoachId] = useState<string>("");
  const [profileName, setProfileName] = useState<string>("");
  const [profileBrand, setProfileBrand] = useState<string>("");
  const [profileLogo, setProfileLogo] = useState<string>("");

  const [activeTab, setActiveTab] = useState<Tab>("sections");
  const [selectedSection, setSelectedSection] = useState<SectionType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);

  // Link Editor state (stored in left sidebar)
  const [slugInput, setSlugInput] = useState("");
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── Resizable columns state ───────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(380);
  const startXRef = useRef(0);
  const startLeftWidthRef = useRef(300);
  const startRightWidthRef = useRef(380);
  const draggingRef = useRef<"left" | "right" | null>(null);

  const onMouseDownLeft = useCallback((e: React.MouseEvent) => {
    draggingRef.current = "left";
    startXRef.current = e.clientX;
    startLeftWidthRef.current = leftWidth;
    e.preventDefault();
  }, [leftWidth]);

  const onMouseDownRight = useCallback((e: React.MouseEvent) => {
    draggingRef.current = "right";
    startXRef.current = e.clientX;
    startRightWidthRef.current = rightWidth;
    e.preventDefault();
  }, [rightWidth]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const dx = e.clientX - startXRef.current;
      if (draggingRef.current === "left") {
        const next = Math.min(Math.max(startLeftWidthRef.current + dx, 240), 450);
        setLeftWidth(next);
      } else {
        const next = Math.min(Math.max(startRightWidthRef.current - dx, 260), 650);
        setRightWidth(next);
      }
    }
    function onMouseUp() {
      draggingRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // ─── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const supabase = createClient();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setCoachId(user.id);

        // Fetch coach profile to get name + contact defaults
        const { data: profile } = await supabase
          .from("coach_profiles")
          .select("full_name, brand_name, logo_url, pro_email, phone")
          .eq("coach_id", user.id)
          .maybeSingle();

        setProfileName(profile?.full_name ?? "");
        setProfileBrand(profile?.brand_name ?? "");
        setProfileLogo(profile?.logo_url ?? "");

        // Load page + sections from API (auto-creates if none)
        const res = await fetch("/api/coach-page");
        if (!res.ok) throw new Error("Failed to load page");
        const { page: loadedPage, sections: loadedSections } = await res.json();
        setPage(loadedPage);
        setSlugInput(loadedPage.slug);

        // Parse sections & pre-fill contact info if empty
        const parsedSections = DEFAULT_SECTIONS_ORDER.map((type) => {
          const existing = loadedSections.find(
            (s: { type: string } & BuilderSection) => s.type === type
          );
          let content = existing?.content ?? {};

          if (type === "contact") {
            const contactContent = content as any;
            if (!contactContent.email && profile?.pro_email) {
              contactContent.email = profile.pro_email;
            }
            if (!contactContent.whatsapp && profile?.phone) {
              contactContent.whatsapp = profile.phone;
            }
          }

          return (
            existing ?? {
              type,
              is_enabled: ["hero", "about", "contact"].includes(type),
              position: DEFAULT_SECTIONS_ORDER.indexOf(type),
              content,
            }
          );
        });
        setSections(parsedSections);

        // Load formulas that are marked show_on_page
        const { data: allFormulas } = await supabase
          .from("coach_formulas")
          .select(
            "id, name, description, price_eur, billing_cycle, duration_months, features, color, show_on_page"
          )
          .eq("coach_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true });
        setFormulas(allFormulas ?? []);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // ─── Page settings ──────────────────────────────────────────────────────────
  const handlePageFieldChange = useCallback(
    async (
      field: "accent_color" | "font_choice" | "bg_choice" | "is_private",
      value: string | boolean
    ) => {
      if (!page) return;
      setPage((prev) => (prev ? { ...prev, [field]: value } : prev));
      await fetch("/api/coach-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    },
    [page]
  );

  const readinessItems = useMemo(
    () =>
      getPublishReadiness(sections, formulas, {
        full_name: profileName,
        brand_name: profileBrand,
      }),
    [sections, formulas, profileName, profileBrand],
  );
  const publishReady = canPublish(readinessItems);

  const handlePublishToggle = useCallback(
    async (published: boolean) => {
      if (!page) return;
      if (published && !publishReady) return;
      setPage((prev) => (prev ? { ...prev, is_published: published } : prev));
      await fetch("/api/coach-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: published }),
      });
    },
    [page, publishReady]
  );

  const handleSlugSave = useCallback(async () => {
    if (!page) return;
    setSlugError(null);
    const clean = slugInput
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    if (!clean) {
      setSlugError("Le lien ne peut pas être vide");
      return;
    }

    const res = await fetch("/api/coach-page", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: clean }),
    });

    if (res.status === 409) {
      setSlugError("Ce lien est déjà pris par un autre coach");
    } else if (!res.ok) {
      setSlugError("Erreur serveur");
    } else {
      const { page: updated } = await res.json();
      setPage(updated);
      setSlugInput(updated.slug);
      setIsEditingSlug(false);
    }
  }, [slugInput, page]);

  const publicPageUrl = page
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "https://stryvlab.com")}/p/${page.slug}`
    : "";

  const handleCopy = useCallback(() => {
    if (!page) return;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const url = `${siteUrl}/p/${page.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      void fetch(
        `/api/public/coach-page/${encodeURIComponent(page.slug)}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: "share",
            meta: { source: "builder_copy" },
          }),
        },
      ).catch(() => {});
    });
  }, [page]);

  // ─── Section management ──────────────────────────────────────────────────────
  const handleSectionToggle = useCallback(
    async (type: SectionType, enabled: boolean) => {
      const section = sections.find((s) => s.type === type);
      setSections((prev: BuilderSection[]) =>
        prev.map((s: BuilderSection) =>
          s.type === type ? { ...s, is_enabled: enabled } : s
        )
      );
      await fetch("/api/coach-page/sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, is_enabled: enabled, position: section?.position }),
      });
      // Enabling formulas section without selection → flag all active formulas public
      if (type === "formulas" && enabled && formulas.length > 0) {
        const missing = formulas.filter((f) => !f.show_on_page);
        if (missing.length > 0) {
          await Promise.all(
            missing.map((f) =>
              fetch(`/api/formulas/${f.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ show_on_page: true }),
              }),
            ),
          );
          setFormulas((prev) =>
            prev.map((f) => ({ ...f, show_on_page: true })),
          );
        }
      }
    },
    [formulas, sections],
  );

  const handleReorderList = useCallback(async (orderedTypes: SectionType[]) => {
    setSections((prev) => {
      const byType = Object.fromEntries(prev.map((s) => [s.type, s]));
      return orderedTypes.map((type, i) => ({
        ...byType[type],
        position: i,
      }));
    });

    await fetch("/api/coach-page/sections/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: orderedTypes }),
    });
  }, []);

  const handleApplyTemplate = useCallback(
    async (template: {
      accent_color: string;
      font_choice: FontChoice;
      bg_choice: BgChoice;
    }) => {
      if (!page) return;
      setPage((prev) =>
        prev
          ? {
              ...prev,
              accent_color: template.accent_color,
              font_choice: template.font_choice,
              bg_choice: template.bg_choice,
            }
          : prev,
      );
      await fetch("/api/coach-page", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
    },
    [page],
  );

  const handleSectionContentChange = useCallback(
    (type: SectionType, content: BuilderSection["content"]) => {
      setSections((prev) =>
        prev.map((s) => (s.type === type ? { ...s, content, isDirty: true } : s))
      );
    },
    []
  );

  const handleSectionSave = useCallback(
    async (
      type: SectionType,
      /** Pass content when saving immediately after a local change (avoids stale state). */
      contentOverride?: BuilderSection["content"],
    ) => {
      const section = sections.find((s) => s.type === type);
      const content = contentOverride ?? section?.content;
      if (!content) return;
      setIsSaving(true);
      try {
        const res = await fetch("/api/coach-page/sections", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content, position: section?.position }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Enregistrement impossible");
        }

        // Formulas section: ensure selected formulas are visible on the public page
        if (type === "formulas") {
          const ids = Array.isArray(
            (content as { formula_ids?: string[] }).formula_ids,
          )
            ? (content as { formula_ids: string[] }).formula_ids
            : [];
          const toFlag =
            ids.length > 0
              ? ids
              : formulas.filter((f) => f.show_on_page).map((f) => f.id);
          // If still empty, flag all active formulas so publish matches preview
          const ensureIds =
            toFlag.length > 0 ? toFlag : formulas.map((f) => f.id);
          await Promise.all(
            ensureIds.map((id) =>
              fetch(`/api/formulas/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ show_on_page: true }),
              }),
            ),
          );
          setFormulas((prev) =>
            prev.map((f) =>
              ensureIds.includes(f.id) ? { ...f, show_on_page: true } : f,
            ),
          );
        }

        setSections((prev) =>
          prev.map((s) =>
            s.type === type ? { ...s, content, isDirty: false } : s,
          ),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [sections, formulas],
  );

  // ─── Header Injection (useSetTopBar) ──────────────────────────────────────────
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stryvlab.com";

  const topBarLeft = useMemo(
    () => (
      <p className="text-[13px] font-semibold text-white leading-none">
        Ma page
      </p>
    ),
    []
  );

  const topBarRight = useMemo(() => {
    if (!page) return null;
    return (
      <div className="flex items-center gap-2">
        {page.is_published ? (
          <span className="hidden sm:inline-flex items-center rounded-md bg-[#1f8a65]/10 px-2 py-0.5 text-[10px] font-bold text-[#1f8a65]">
            {page.is_private ? "Publié · non indexé" : "En ligne"}
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-white/40">
            Brouillon
          </span>
        )}

        <button
          className={`flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-[transform,background-color,color] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
            previewMode || !selectedSection
              ? "bg-white/[0.08] text-[#1f8a65]"
              : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/75"
          }`}
          onClick={() => {
            setSelectedSection(null);
            setPreviewMode(true);
          }}
          type="button"
          aria-pressed={previewMode || !selectedSection}
        >
          <Eye size={13} aria-hidden />
          Aperçu
        </button>

        <button
          className={`flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition-[transform,background-color,color,opacity] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65]/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
            page.is_published
              ? "bg-red-500/10 text-[#ef4444] hover:bg-red-500/20"
              : "bg-[#1f8a65] text-white hover:bg-[#217356]"
          }`}
          disabled={isSaving || (!page.is_published && !publishReady)}
          onClick={() => handlePublishToggle(!page.is_published)}
          title={
            !page.is_published && !publishReady
              ? "Complétez la checklist avant de publier"
              : undefined
          }
          type="button"
        >
          {page.is_published ? "Dépublier" : "Publier ma page"}
        </button>
      </div>
    );
  }, [
    page,
    previewMode,
    selectedSection,
    isSaving,
    handlePublishToggle,
    publishReady,
  ]);

  useSetTopBar(topBarLeft, topBarRight);

  // ─── Loading states ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="relative w-full bg-[#121212]" style={{ minHeight: "100dvh" }}>
        {/* Left builder skeleton — full height under top bar to screen bottom */}
        <div
          className="fixed bottom-0 left-0 top-[88px] z-30 flex w-[300px] flex-col overflow-hidden border-r-[0.3px] border-white/[0.06] bg-[#181818]"
        >
          <div className="space-y-3 border-b border-white/[0.06] p-5">
            <div className="h-3 w-28 animate-pulse rounded-full bg-white/[0.08]" />
            <div className="h-10 animate-pulse rounded-xl bg-white/[0.05]" />
            <div className="flex gap-3">
              <div className="h-3 w-16 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="h-3 w-14 animate-pulse rounded-full bg-white/[0.04]" />
            </div>
          </div>
          <div className="flex shrink-0 border-b border-white/[0.06]">
            <div className="h-11 flex-1 animate-pulse bg-white/[0.04]" />
            <div className="h-11 flex-1 animate-pulse bg-white/[0.02]" />
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.03]"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
          <div className="shrink-0 space-y-2 border-t border-white/[0.06] p-3">
            <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
            <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
            <div className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
          </div>
        </div>
        {/* Preview skeleton — full height like left rail */}
        <div className="fixed bottom-0 left-[300px] right-0 top-[88px] z-20 flex min-h-0 flex-col bg-[#121212]">
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="h-3 w-24 animate-pulse rounded-full bg-white/[0.08]" />
            <div className="h-9 w-36 animate-pulse rounded-xl bg-white/[0.05]" />
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-6 pb-[calc(138px+24px)]">
            <div className="flex w-full max-w-[390px] flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0e0e0e] shadow-[0_20px_50px_rgba(0,0,0,.4)]">
              <div className="flex justify-center border-b border-white/[0.06] bg-[#0a0a0a] py-2">
                <div className="h-1.5 w-20 rounded-full bg-white/10" />
              </div>
              <div className="flex flex-1 flex-col items-center gap-4 px-6 py-10">
                <div className="h-28 w-28 animate-pulse rounded-2xl bg-white/[0.06]" />
                <div className="h-7 w-40 animate-pulse rounded-full bg-white/[0.08]" />
                <div className="h-3 w-52 animate-pulse rounded-full bg-white/[0.05]" />
                <div className="mt-2 h-3 w-full max-w-[240px] animate-pulse rounded-full bg-white/[0.04]" />
                <div className="h-3 w-full max-w-[200px] animate-pulse rounded-full bg-white/[0.03]" />
                <div className="mt-4 h-11 w-full max-w-[200px] animate-pulse rounded-xl bg-[#1f8a65]/25" />
                <div className="mt-6 w-full space-y-2">
                  <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
                  <div className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          color: "rgba(255,255,255,0.35)",
          fontSize: "0.875rem",
        }}
      >
        Une erreur est survenue. Recharge la page.
      </div>
    );
  }

  const activeSection = selectedSection
    ? sections.find((s) => s.type === selectedSection)
    : null;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "sections", label: "Sections", icon: <LayoutList size={15} /> },
    { id: "appearance", label: "Apparence", icon: <Palette size={15} /> },
  ];

  const aggregatedProfile = {
    full_name: profileName,
    brand_name: profileBrand,
    logo_url: profileLogo,
  };

  return (
    <div className="relative w-full bg-[#121212]" style={{ minHeight: "100dvh" }}>
      {/*
        Left config — full viewport height under top bar (to screen bottom).
        Split: UPPER (link + tabs + sections, scrollable remainder)
               LOWER (publish stack, natural height, never scrolls — takes priority)
        Extra vertical space goes to the upper zone only.
      */}
      <div
        className="fixed bottom-0 left-0 top-[88px] z-30 flex flex-col overflow-hidden border-r-[0.3px] border-white/[0.06] bg-[#181818]"
        style={{ width: `${leftWidth}px` }}
      >
        {/* ── UPPER ZONE — can shrink; only this zone scrolls ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Link editor */}
        <div className="shrink-0 border-b border-white/[0.06] px-4 py-4">
          <label
            htmlFor="coach-page-slug"
            className="mb-2 block text-[11px] font-semibold text-white/50"
          >
            Lien public
          </label>
          <div className="flex flex-col gap-2">
            <div className="flex min-h-10 items-center gap-1.5 rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-3">
              <span className="shrink-0 text-[13px] text-white/25">/p/</span>
              {isEditingSlug ? (
                <input
                  id="coach-page-slug"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSlugSave();
                    if (e.key === "Escape") {
                      setSlugInput(page.slug);
                      setIsEditingSlug(false);
                      setSlugError(null);
                    }
                  }}
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/25"
                  aria-invalid={Boolean(slugError)}
                  aria-describedby={slugError ? "slug-error" : undefined}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-[13px] text-white">
                  {page.slug}
                </span>
              )}

              {!isEditingSlug ? (
                <button
                  type="button"
                  onClick={() => {
                    setSlugInput(page.slug);
                    setIsEditingSlug(true);
                  }}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  style={{ color: page.accent_color }}
                >
                  Modifier
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={handleSlugSave}
                    className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#1f8a65] transition-[background-color,transform] duration-150 hover:bg-white/[0.04] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65]/40"
                  >
                    Sauver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSlugInput(page.slug);
                      setIsEditingSlug(false);
                      setSlugError(null);
                    }}
                    className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-white/40 transition-[background-color,color,transform] duration-150 hover:bg-white/[0.04] hover:text-white/70 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    aria-label="Annuler"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>

            {slugError ? (
              <p id="slug-error" className="text-[11px] leading-snug text-[#ef4444]" role="alert">
                {slugError}
              </p>
            ) : null}

            {page.is_published && !isEditingSlug ? (
              <div className="flex items-center gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg text-[11px] font-medium transition-[color,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  style={{ color: copied ? "#1f8a65" : "rgba(255,255,255,0.45)" }}
                >
                  {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                  {copied ? "Copié" : "Copier le lien"}
                </button>
                <a
                  href={`${siteUrl}/p/${page.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg text-[11px] font-medium text-white/45 transition-[color,transform] duration-150 hover:text-white/70 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                >
                  <ExternalLink size={12} aria-hidden />
                  Visiter
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex shrink-0 border-b border-white/[0.06]"
          role="tablist"
          aria-label="Configuration de la page"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== "sections") setSelectedSection(null);
                  setPreviewMode(false);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 px-2 py-3 text-[13px] transition-[color,background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/15"
                style={{
                  borderBottom: selected
                    ? `2px solid ${page.accent_color}`
                    : "2px solid transparent",
                  color: selected
                    ? page.accent_color
                    : "rgba(255,255,255,0.45)",
                  fontWeight: selected ? 600 : 500,
                  background: selected
                    ? `${page.accent_color}12`
                    : "transparent",
                }}
              >
                <span aria-hidden className="inline-flex">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Sections / appearance — only this area scrolls when space is tight */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {activeTab === "sections" && (
            <SectionsList
              accentColor={page.accent_color}
              onReorderList={handleReorderList}
              onSelect={(type) => {
                setSelectedSection(type);
                setPreviewMode(false);
              }}
              onToggle={handleSectionToggle}
              sections={sections}
              selectedType={selectedSection}
            />
          )}
          {activeTab === "appearance" && (
            <AppearancePanel
              accentColor={page.accent_color}
              bgChoice={page.bg_choice}
              fontChoice={page.font_choice}
              onApplyTemplate={handleApplyTemplate}
              onChange={(field, value) =>
                handlePageFieldChange(field, value)
              }
            />
          )}
        </div>
        </div>

        {/*
          LOWER ZONE — natural height, never scrolls.
          Takes vertical priority over the upper zone (upper shrinks / scrolls instead).
        */}
        {/* Bottom padding reduced to pb-3 to lower the entire section and give more space to sections/appearance */}
        <div className="shrink-0 space-y-3 border-t border-white/[0.06] bg-[#181818] p-3 pb-3">
          <PublishChecklist canPublish={publishReady} items={readinessItems} />
          <AnalyticsCard />
          {publicPageUrl && (
            <QrShareCard
              accentColor={page.accent_color}
              pageUrl={publicPageUrl}
            />
          )}
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#0a0a0a] px-3 py-2.5 transition-colors duration-150 hover:bg-white/[0.02] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/20">
            <span className="text-[11px] leading-snug text-white/55 text-pretty">
              Masquer des moteurs de recherche
            </span>
            <input
              checked={page.is_private}
              className="h-4 w-4 shrink-0 accent-[#1f8a65] focus-visible:outline-none"
              onChange={(e) =>
                handlePageFieldChange("is_private", e.target.checked)
              }
              type="checkbox"
            />
          </label>
        </div>
      </div>

      {/*
        Right area — same full-height band as left rail (top bar → bottom of screen).
        Scroll panes keep pb for the floating NavDock so content never sits under it.
        - Aperçu: LivePreview full width
        - Section edit: editor | continuous mobile preview
      */}
      {/* Left resize handle */}
      <div
        onMouseDown={onMouseDownLeft}
        className="fixed bottom-0 top-[88px] z-40 w-1 cursor-col-resize bg-white/[0.04] hover:bg-[#1f8a65]/50 active:bg-[#1f8a65] transition-colors border-r border-white/[0.06]"
        style={{ left: `${leftWidth - 2}px` }}
      />

      <div
        className="fixed bottom-0 right-0 top-[88px] z-20 flex min-h-0 overflow-hidden bg-[#121212]"
        style={{ left: `${leftWidth}px` }}
      >
        {activeSection && selectedSection && !previewMode ? (
          <>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-white/[0.06]">
              <SectionEditor
                coachId={coachId}
                formulas={formulas}
                isSaving={isSaving}
                profileDefaultName={
                  profileBrand.trim() || profileName.trim() || undefined
                }
                onChange={(content) =>
                  handleSectionContentChange(selectedSection, content)
                }
                onSave={(contentOverride) =>
                  handleSectionSave(selectedSection, contentOverride)
                }
                section={activeSection}
                type={selectedSection}
              />
            </div>

            {/* Right resize handle */}
            <div
              onMouseDown={onMouseDownRight}
              className="w-1 z-30 flex-none cursor-col-resize bg-white/[0.04] hover:bg-[#1f8a65]/50 active:bg-[#1f8a65] transition-colors border-l border-white/[0.06]"
            />

            <aside
              className="hidden min-h-0 flex-col overflow-hidden border-l border-white/[0.04] bg-[#0f0f0f] lg:flex"
              style={{ width: `${rightWidth}px`, flexShrink: 0 }}
              aria-label="Aperçu en direct"
            >
              <LivePreview
                formulas={formulas}
                page={page}
                profile={aggregatedProfile}
                sections={sections}
                variant="full"
              />
            </aside>
          </>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <LivePreview
              formulas={formulas}
              page={page}
              profile={aggregatedProfile}
              sections={sections}
              variant="full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
