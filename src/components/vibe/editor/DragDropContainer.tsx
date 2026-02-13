"use client";

import React from "react";
import { Reorder, useDragControls } from "framer-motion";

interface DragDropContainerProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
}

export function DragDropContainer<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: DragDropContainerProps<T>) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={onReorder}
      className="space-y-2"
    >
      {items.map((item) => (
        <Reorder.Item
          key={item.id}
          value={item}
          onDragStart={() => setDraggingId(item.id)}
          onDragEnd={() => setDraggingId(null)}
          className="list-none"
          whileDrag={{
            scale: 1.02,
            boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
            zIndex: 50,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
          }}
        >
          {renderItem(item, draggingId === item.id)}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}
