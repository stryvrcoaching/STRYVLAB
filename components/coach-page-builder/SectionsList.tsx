"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  GripVertical,
  User,
  FileText,
  Briefcase,
  Images,
  MessageSquareQuote,
  Mail,
  PanelsTopLeft,
} from "lucide-react";
import type { BuilderSection, SectionType } from "@/types/coach-page";
import { SECTION_META } from "@/types/coach-page";
import { cn } from "@/lib/utils";

interface Props {
  sections: BuilderSection[];
  selectedType: SectionType | null;
  onSelect: (type: SectionType) => void;
  onToggle: (type: SectionType, enabled: boolean) => void;
  onReorderList: (orderedTypes: SectionType[]) => void;
  accentColor: string;
}

const SECTION_ICONS: Record<
  SectionType,
  React.ComponentType<{ className?: string; size?: number }>
> = {
  hero: User,
  about: FileText,
  formulas: Briefcase,
  gallery: Images,
  testimonials: MessageSquareQuote,
  contact: Mail,
  custom: PanelsTopLeft,
};

function SortableRow({
  section,
  isSelected,
  accentColor,
  onSelect,
  onToggle,
}: {
  section: BuilderSection;
  isSelected: boolean;
  accentColor: string;
  onSelect: (type: SectionType) => void;
  onToggle: (type: SectionType, enabled: boolean) => void;
}) {
  const meta = SECTION_META[section.type];
  const Icon = SECTION_ICONS[section.type];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.type });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.88 : section.is_enabled ? 1 : 0.5,
    "--row-accent": accentColor,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1.5 rounded-xl border p-1.5",
        "transition-[border-color,background-color,opacity] duration-150",
        isSelected
          ? "border-[color:var(--row-accent)] bg-[color:var(--row-accent)]/10"
          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.035]",
        isDragging && "z-10 shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
      )}
    >
      <button
        type="button"
        aria-label={`Réordonner ${meta.label}`}
        className={cn(
          "inline-flex h-10 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-white/30",
          "transition-[background-color,color] duration-150",
          "hover:bg-white/[0.05] hover:text-white/55 active:cursor-grabbing",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => onSelect(section.type)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1.5 text-left",
          "transition-[background-color,transform] duration-150 active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        )}
      >
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]"
          style={{
            color: isSelected ? accentColor : "rgba(255,255,255,0.45)",
          }}
        >
          <Icon size={15} aria-hidden />
        </span>
        <span className="min-w-0">
          <span
            className="block truncate text-[13px] font-medium leading-tight"
            style={{ color: isSelected ? accentColor : "#fff" }}
          >
            {meta.label}
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-white/40">
            {meta.description}
          </span>
        </span>
      </button>

      {/* Larger hit area around the switch (min ~40px) */}
      <button
        type="button"
        role="switch"
        aria-checked={section.is_enabled}
        aria-label={`${meta.label} ${section.is_enabled ? "activée" : "désactivée"}`}
        onClick={() => onToggle(section.type, !section.is_enabled)}
        className={cn(
          "relative flex h-10 w-12 shrink-0 items-center justify-center rounded-lg",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        )}
      >
        <span
          className="relative h-[18px] w-8 rounded-full transition-colors duration-150"
          style={{
            background: section.is_enabled
              ? accentColor
              : "rgba(255,255,255,0.1)",
          }}
        >
          <span
            className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-[left] duration-150 ease-out"
            style={{ left: section.is_enabled ? 16 : 2 }}
          />
        </span>
      </button>
    </div>
  );
}

export function SectionsList({
  sections,
  selectedType,
  onSelect,
  onToggle,
  onReorderList,
  accentColor,
}: Props) {
  const sorted = [...sections].sort((a, b) => a.position - b.position);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex((s) => s.type === active.id);
    const newIndex = sorted.findIndex((s) => s.type === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(sorted, oldIndex, newIndex).map((s) => s.type);
    onReorderList(next);
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext
        items={sorted.map((s) => s.type)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-1.5" role="list">
          {sorted.map((section) => (
            <div key={section.type} role="listitem">
              <SortableRow
                accentColor={accentColor}
                isSelected={selectedType === section.type}
                onSelect={onSelect}
                onToggle={onToggle}
                section={section}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
