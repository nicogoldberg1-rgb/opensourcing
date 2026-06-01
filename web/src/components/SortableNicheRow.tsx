import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Niche } from "../lib/types";
import { NicheRow, type QuickAction } from "./NicheRow";

export function SortableNicheRow({
  niche,
  rank,
  onOpen,
  onQuickAction,
  showStatusBadge,
}: {
  niche: Niche;
  rank?: number;
  onOpen: (n: Niche) => void;
  onQuickAction: (n: Niche, a: QuickAction) => Promise<void>;
  showStatusBadge?: boolean;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: niche.id });

  return (
    <NicheRow
      ref={setNodeRef}
      niche={niche}
      onOpen={onOpen}
      onQuickAction={onQuickAction}
      showStatusBadge={showStatusBadge}
      isDragging={isDragging}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      leadingSlot={
        <div className="flex items-center gap-0.5">
          {rank !== undefined && (
            <span
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-neutral-100 px-1 font-mono text-[10.5px] font-semibold tabular-nums text-neutral-600"
              title={`Rank ${rank}`}
            >
              {rank}
            </span>
          )}
          <button
            type="button"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab rounded p-0.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600 active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
        </div>
      }
    />
  );
}
