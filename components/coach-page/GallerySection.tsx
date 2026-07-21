import type { GalleryContent } from "@/types/coach-page";
import { resolveSectionPresentation } from "@/types/coach-page";
import {
  normalizePhotoFrame,
  photoFrameClasses,
} from "@/lib/coach-page/photo-frame";
import { cn } from "@/lib/utils";
import { SectionShell } from "./section-primitives";

interface Props {
  content: GalleryContent;
  forceStack?: boolean;
}

export function GallerySection({ content, forceStack = false }: Props) {
  const photos = (content.photo_urls ?? []).slice(0, 6);
  if (photos.length === 0) return null;

  const frame = normalizePhotoFrame(content.photo_frame, "portrait_4_5");

  const gridClass = forceStack
    ? "flex w-full flex-col gap-3"
    : photos.length === 1
      ? "grid w-full grid-cols-1 gap-3"
      : photos.length === 2
        ? "grid w-full grid-cols-1 gap-3 md:grid-cols-2"
        : "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <SectionShell presentation={resolveSectionPresentation("gallery", content.presentation)}>
      <div className={gridClass}>
        {photos.map((url, i) => (
          <div
            className={cn(
              "relative overflow-hidden border-[0.3px]",
              photoFrameClasses(frame, { size: "full" }),
            )}
            key={`${url}-${i}`}
            style={{
              borderColor: "var(--cp-border)",
              backgroundColor: "var(--cp-input)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`Photo galerie ${i + 1}`}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-[1.02]"
              src={url}
            />
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
