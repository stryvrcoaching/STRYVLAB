import type { AboutContent } from "@/types/coach-page";
import { resolveSectionPresentation } from "@/types/coach-page";
import {
  normalizePhotoFrame,
  photoFrameClasses,
} from "@/lib/coach-page/photo-frame";
import { cn } from "@/lib/utils";
import { SectionShell } from "./section-primitives";

interface Props {
  content: AboutContent;
  /** Builder mobile preview — never split into two narrow columns. */
  forceStack?: boolean;
}

export function AboutSection({ content, forceStack = false }: Props) {
  if (!content.text && !content.photo_url) return null;

  const hasPhoto = Boolean(content.photo_url);
  const frame = normalizePhotoFrame(content.photo_frame, "portrait_4_5");
  const presentation = resolveSectionPresentation("about", content.presentation);
  const mediaPosition = content.media_position ?? "right";
  const centered = presentation.text_align === "center";

  return (
    <SectionShell presentation={presentation}>
      <div
        className={
          hasPhoto
            ? forceStack
              ? "flex w-full flex-col gap-6"
              : mediaPosition === "top"
                ? "flex w-full flex-col gap-6"
                : "flex w-full flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-10"
            : "w-full max-w-2xl"
        }
      >
        {hasPhoto && (
          <div
            className={cn(
              "relative overflow-hidden border-[0.3px]",
              forceStack || mediaPosition === "top"
                ? cn(photoFrameClasses(frame, { size: "full" }), "max-h-[min(78vw,480px)]")
                : cn(
                    mediaPosition === "left" ? "order-1 md:order-1" : "order-1 md:order-2",
                    photoFrameClasses(frame, { size: "full" }),
                    "max-h-[min(78vw,480px)] md:max-h-none",
                  ),
            )}
            style={{
              borderColor: "var(--cp-border)",
              backgroundColor: "var(--cp-input)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Photo du coach"
              className="absolute inset-0 h-full w-full object-cover"
              src={content.photo_url!}
            />
          </div>
        )}

        {content.text && (
          <div
            className={
              hasPhoto
                ? forceStack
                  ? cn("w-full text-[15px] leading-7 text-[color:var(--cp-text-muted)] text-pretty whitespace-pre-wrap", centered && "text-center")
                  : cn(
                      mediaPosition === "left" ? "order-2 w-full md:order-2" : "order-2 w-full md:order-1",
                      "text-[15px] leading-7 text-[color:var(--cp-text-muted)] text-pretty whitespace-pre-wrap md:text-sm md:leading-7 lg:text-[15px]",
                      centered && "text-center",
                    )
                : cn("text-[15px] leading-7 text-[color:var(--cp-text-muted)] text-pretty whitespace-pre-wrap sm:text-sm sm:leading-7", centered && "text-center")
            }
          >
            {content.text}
          </div>
        )}
      </div>
    </SectionShell>
  );
}
