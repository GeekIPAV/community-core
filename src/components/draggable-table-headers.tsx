import type React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender, type Header, type Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from "lucide-react";
import { TableHead } from "@/components/ui/table";

function DraggableHead({ header }: { header: Header<any, unknown> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative",
  };
  const sort = header.column.getIsSorted();
  return (
    <TableHead ref={setNodeRef} style={style}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Reordenar coluna"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => header.column.toggleSorting()}
          className="flex items-center gap-1 font-medium hover:text-foreground"
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          {sort === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : sort === "desc" ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      </div>
    </TableHead>
  );
}

export function DraggableTableHeaders<T>({
  table,
  onOrderChange,
}: {
  table: Table<T>;
  onOrderChange: (order: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const ids = headers.map((h) => h.column.id);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const allIds = table.getAllLeafColumns().map((c) => c.id);
    const oldIndex = allIds.indexOf(String(active.id));
    const newIndex = allIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...allIds];
    next.splice(oldIndex, 1);
    next.splice(newIndex, 0, String(active.id));
    onOrderChange(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        {headers.map((header) => (
          <DraggableHead key={header.id} header={header as Header<any, unknown>} />
        ))}
      </SortableContext>
    </DndContext>
  );
}