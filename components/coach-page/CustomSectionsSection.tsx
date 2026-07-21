import type { CustomSectionItem, CustomSectionsContent } from "@/types/coach-page";
import {
  normalizePhotoFrame,
  photoFrameClasses,
} from "@/lib/coach-page/photo-frame";
import { cn } from "@/lib/utils";
import { AccentButton, SectionShell } from "./section-primitives";

interface Props {
  content: CustomSectionsContent;
  forceStack?: boolean;
}

const spacingClasses = {
  compact: "py-5 sm:py-8 lg:py-10",
  regular: "",
  generous: "py-10 sm:py-16 lg:py-24",
} as const;

function hasVisibleContent(item: CustomSectionItem) {
  return Boolean(
    item.eyebrow?.trim() ||
      item.title?.trim() ||
      item.text?.trim() ||
      (item.image_position !== "hidden" && item.photo_url),
  );
}

function safeExternalUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function CustomSectionsSection({ content, forceStack = false }: Props) {
  const items = (content.items ?? [])
    .slice(0, 5)
    .filter((item) => item.is_enabled !== false && hasVisibleContent(item));

  if (items.length === 0) return null;

  return (
    <>
      {items.map((item) => {
        const hasPhoto = Boolean(item.photo_url) && item.image_position !== "hidden";
        const imagePosition = item.image_position ?? "right";
        const isTop = hasPhoto && imagePosition === "top";
        const centered = item.text_align === "center";
        const card = item.surface_style === "card";
        const frame = normalizePhotoFrame(item.photo_frame, "rounded");
        const ctaUrl = safeExternalUrl(item.cta_url);

        return (
          <SectionShell
            className={spacingClasses[item.spacing ?? "regular"]}
            key={item.id}
            narrow={centered && !hasPhoto}
          >
            <div
              className={cn(
                card && "rounded-2xl border border-[color:var(--cp-border)] bg-[color:var(--cp-surface)] p-5 sm:p-7 lg:p-9",
                hasPhoto && !isTop
                  ? forceStack
                    ? "flex flex-col gap-6"
                    : "grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10"
                  : "flex flex-col gap-6",
              )}
            >
              {hasPhoto && (
                <div
                  className={cn(
                    "relative overflow-hidden border-[0.3px]",
                    photoFrameClasses(frame, { size: "full" }),
                    !isTop && imagePosition === "left" && "md:order-1",
                    !isTop && imagePosition === "right" && "md:order-2",
                    isTop && "w-full",
                  )}
                  style={{
                    borderColor: "var(--cp-border)",
                    backgroundColor: "var(--cp-input)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={item.title?.trim() || "Photo de présentation"}
                    className="absolute inset-0 h-full w-full object-cover"
                    src={item.photo_url!}
                  />
                </div>
              )}

              <div
                className={cn(
                  !isTop && imagePosition === "left" && "md:order-2",
                  !isTop && imagePosition === "right" && "md:order-1",
                  centered && "mx-auto max-w-2xl text-center",
                )}
              >
                {item.eyebrow?.trim() && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--cp-accent)]/90 sm:text-xs sm:font-medium sm:normal-case sm:tracking-wide">
                    {item.eyebrow.trim()}
                  </p>
                )}
                {item.title?.trim() && (
                  <h2 className="mt-2 text-[1.65rem] font-semibold leading-[1.1] tracking-[-0.03em] text-[color:var(--cp-text)] text-balance sm:text-3xl sm:leading-[1.08]">
                    {item.title.trim()}
                  </h2>
                )}
                {item.text?.trim() && (
                  <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-[color:var(--cp-text-muted)] text-pretty sm:text-sm sm:leading-7">
                    {item.text.trim()}
                  </p>
                )}
                {ctaUrl && item.cta_label?.trim() && (
                  <AccentButton className="mt-5" external href={ctaUrl}>
                    {item.cta_label.trim()}
                  </AccentButton>
                )}
              </div>
            </div>
          </SectionShell>
        );
      })}
    </>
  );
}
