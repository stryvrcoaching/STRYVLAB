import type { TestimonialsContent } from "@/types/coach-page";
import { resolveSectionPresentation } from "@/types/coach-page";
import { SectionShell } from "./section-primitives";

interface Props {
  content: TestimonialsContent;
  forceStack?: boolean;
}

export function TestimonialsSection({
  content,
  forceStack = false,
}: Props) {
  const items = (content.items ?? []).slice(0, 4);
  if (items.length === 0) return null;

  return (
    <SectionShell presentation={resolveSectionPresentation("testimonials", content.presentation)}>
      <div
        className={
          forceStack
            ? "flex w-full flex-col gap-3"
            : "grid w-full grid-cols-1 gap-3 md:grid-cols-2"
        }
      >
        {items.map((item) => (
          <figure
            className="flex h-full flex-col rounded-2xl border p-5 sm:p-6"
            key={item.id}
            style={{
              borderColor: "var(--cp-border)",
              backgroundColor: "var(--cp-surface-2)",
            }}
          >
            <blockquote className="text-[15px] leading-6 text-[color:var(--cp-text-muted)] text-pretty sm:text-sm sm:leading-6">
              “{item.text}”
            </blockquote>
            <figcaption className="mt-auto pt-5 text-sm font-medium text-[color:var(--cp-text)]">
              {item.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}
