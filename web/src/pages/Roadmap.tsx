import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useOutletContext } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { api } from "../lib/api";
import type { RoadmapCard, RoadmapColumn } from "../lib/types";
import { Button } from "../components/ui/Button";
import { confirmDialog } from "../components/ui/Dialog";
import { cn } from "../lib/cn";
import { relativeFromIso } from "../lib/format";
import type { HomeContext } from "./Home";

const COLUMNS: { key: RoadmapColumn; label: string; accent: string }[] = [
  { key: "idea", label: "Ideas", accent: "bg-neutral-200" },
  { key: "next_up", label: "Next up", accent: "bg-blue-300" },
  { key: "in_progress", label: "In progress", accent: "bg-indigo-400" },
  { key: "shipped", label: "Shipped", accent: "bg-emerald-400" },
];

export default function RoadmapPage() {
  const ctx = useOutletContext<HomeContext>();
  const [cards, setCards] = useState<RoadmapCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shippedCollapsed, setShippedCollapsed] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  useEffect(() => {
    api
      .getRoadmap()
      .then((b) => setCards(b.cards))
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    ctx.setSubtitle(cards ? `${cards.length} cards` : undefined);
    return () => ctx.setSubtitle(undefined);
  }, [cards, ctx]);

  const scheduleSave = useCallback((next: RoadmapCard[]) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api.saveRoadmap(next).catch((e) => setError(String(e)));
    }, 250);
  }, []);

  const byColumn = useMemo(() => {
    const m: Record<RoadmapColumn, RoadmapCard[]> = {
      idea: [],
      next_up: [],
      in_progress: [],
      shipped: [],
    };
    for (const c of cards ?? []) m[c.column].push(c);
    return m;
  }, [cards]);

  const findCard = (id: string) => (cards ?? []).find((c) => c.id === id);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragOver = (e: DragOverEvent) => {
    if (!cards) return;
    const activeIdStr = String(e.active.id);
    const overIdStr = e.over ? String(e.over.id) : null;
    if (!overIdStr) return;
    const activeCard = findCard(activeIdStr);
    if (!activeCard) return;

    // Determine the destination column: either a column key directly, or the
    // column of the card we're hovering over.
    let destCol: RoadmapColumn;
    if (
      overIdStr === "idea" ||
      overIdStr === "next_up" ||
      overIdStr === "in_progress" ||
      overIdStr === "shipped"
    ) {
      destCol = overIdStr;
    } else {
      const overCard = findCard(overIdStr);
      if (!overCard) return;
      destCol = overCard.column;
    }
    if (activeCard.column === destCol) return;

    // Move the card into the destination column at end (cleaner UX during drag)
    const next = cards.map((c) =>
      c.id === activeCard.id ? { ...c, column: destCol } : c,
    );
    setCards(next);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!cards) return;
    const activeIdStr = String(e.active.id);
    const overIdStr = e.over ? String(e.over.id) : null;
    if (!overIdStr) {
      scheduleSave(cards);
      return;
    }
    const activeIdx = cards.findIndex((c) => c.id === activeIdStr);
    if (activeIdx < 0) return;

    let next = cards;
    if (
      overIdStr === "idea" ||
      overIdStr === "next_up" ||
      overIdStr === "in_progress" ||
      overIdStr === "shipped"
    ) {
      // Drop on empty column space — just ensure column is set
      next = cards.map((c) =>
        c.id === activeIdStr ? { ...c, column: overIdStr } : c,
      );
    } else {
      const overIdx = cards.findIndex((c) => c.id === overIdStr);
      if (overIdx < 0) return;
      next = arrayMove(cards, activeIdx, overIdx);
    }
    setCards(next);
    scheduleSave(next);
  };

  const handleAdd = async (column: RoadmapColumn, title: string) => {
    if (!title.trim()) return;
    try {
      const { card } = await api.addRoadmapCard(column, title);
      setCards((prev) => (prev ? [card, ...prev] : [card]));
    } catch (e) {
      setError(String(e));
    }
  };

  const handleEdit = async (id: string, patch: Partial<RoadmapCard>) => {
    try {
      const { card } = await api.updateRoadmapCard(id, patch);
      setCards((prev) =>
        prev ? prev.map((c) => (c.id === id ? card : c)) : prev,
      );
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete this card?",
      description: "This can't be undone.",
      destructive: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await api.deleteRoadmapCard(id);
      setCards((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!cards ? (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
          Loading…
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
            {COLUMNS.map((col) => {
              const colCards = byColumn[col.key];
              const isShipped = col.key === "shipped";
              const collapsed = isShipped && shippedCollapsed;
              return (
                <Column
                  key={col.key}
                  id={col.key}
                  label={col.label}
                  accent={col.accent}
                  cards={colCards}
                  collapsed={collapsed}
                  onToggleCollapsed={
                    isShipped
                      ? () => setShippedCollapsed((s) => !s)
                      : undefined
                  }
                  onAdd={(title) => handleAdd(col.key, title)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeId ? (
              <CardView
                card={findCard(activeId)!}
                onEdit={() => {}}
                onDelete={() => {}}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function Column({
  id,
  label,
  accent,
  cards,
  collapsed,
  onToggleCollapsed,
  onAdd,
  onEdit,
  onDelete,
}: {
  id: RoadmapColumn;
  label: string;
  accent: string;
  cards: RoadmapCard[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onAdd: (title: string) => void;
  onEdit: (id: string, patch: Partial<RoadmapCard>) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [adding, setAdding] = useState(false);

  return (
    <div
      className={cn(
        "flex h-full shrink-0 flex-col rounded-lg border border-neutral-200 bg-neutral-50/60 transition-all",
        collapsed ? "w-[64px]" : "w-[300px]",
        isOver && !collapsed && "border-accent bg-indigo-50/30",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", accent)} />
          {!collapsed && (
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
              {label}
            </h2>
          )}
          <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded bg-neutral-200/70 px-1.5 font-mono text-[10.5px] text-neutral-700 tabular-nums">
            {cards.length}
          </span>
        </div>
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
            title={collapsed ? "Expand shipped" : "Collapse shipped"}
          >
            {collapsed ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronUp size={14} />
            )}
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <div
            ref={setNodeRef}
            className="flex-1 space-y-1.5 overflow-y-auto p-2"
          >
            <SortableContext
              items={cards.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {cards.map((c) => (
                <SortableCard
                  key={c.id}
                  card={c}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </SortableContext>
            {cards.length === 0 && !adding && (
              <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-neutral-200 text-[11px] text-neutral-400">
                Drag a card here
              </div>
            )}
          </div>

          <div className="border-t border-neutral-200 p-2">
            {adding ? (
              <AddCardInput
                onSubmit={(title) => {
                  onAdd(title);
                  setAdding(false);
                }}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <Plus size={13} /> Add a card
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AddCardInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-1.5">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSubmit(value);
            setValue("");
          }
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Card title…"
        className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!value.trim()}
          onClick={() => {
            onSubmit(value);
            setValue("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function SortableCard({
  card,
  onEdit,
  onDelete,
}: {
  card: RoadmapCard;
  onEdit: (id: string, patch: Partial<RoadmapCard>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  return (
    <CardView
      ref={setNodeRef}
      card={card}
      onEdit={onEdit}
      onDelete={onDelete}
      isDragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragHandle={{ attributes, listeners }}
    />
  );
}

type CardViewProps = {
  card: RoadmapCard;
  onEdit: (id: string, patch: Partial<RoadmapCard>) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  overlay?: boolean;
  style?: React.CSSProperties;
  // dnd-kit's attributes/listeners are pass-through props; use loose typing here.
  dragHandle?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attributes: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listeners: any;
  };
};

import { forwardRef } from "react";

const CardView = forwardRef<HTMLDivElement, CardViewProps>(function CardView(
  { card, onEdit, onDelete, isDragging, overlay, style, dragHandle },
  ref,
) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? "");
  }, [card.title, card.description]);

  const save = () => {
    const patch: Partial<RoadmapCard> = {};
    if (title.trim() && title !== card.title) patch.title = title.trim();
    if ((description.trim() || "") !== (card.description ?? "")) {
      patch.description = description.trim();
    }
    if (Object.keys(patch).length > 0) onEdit(card.id, patch);
    setEditing(false);
  };

  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "group rounded-md border border-neutral-200 bg-white p-2.5 shadow-sm transition-all",
        !overlay && !editing && "cursor-grab hover:border-neutral-300 hover:shadow-md",
        editing && "cursor-text shadow-md ring-1 ring-accent",
        isDragging && "opacity-30",
        overlay && "rotate-[0.5deg] shadow-xl ring-2 ring-accent",
      )}
      {...(!editing && dragHandle ? dragHandle.attributes : {})}
      {...(!editing && dragHandle ? dragHandle.listeners : {})}
      onClick={(e) => {
        if (editing) return;
        if ((e.target as HTMLElement).closest("button")) return;
        setEditing(true);
      }}
    >
      {editing ? (
        <div className="space-y-1.5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm font-semibold focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full resize-y rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex justify-between gap-1.5">
            <button
              onClick={() => onDelete(card.id)}
              className="rounded px-1.5 py-1 text-[11px] text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={save}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 text-sm font-medium text-neutral-900">
              {card.title}
            </h3>
            {!overlay && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(card.id);
                }}
                className="rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                aria-label="Delete card"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {card.description && (
            <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-neutral-600">
              {card.description}
            </p>
          )}
          {card.tags && card.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {card.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1.5 text-[10px] text-neutral-400">
            {relativeFromIso(card.updated_at)}
          </div>
        </>
      )}
    </div>
  );
});
