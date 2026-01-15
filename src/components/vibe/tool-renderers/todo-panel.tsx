



"use client";

type TodoItem = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
};

export function TodoPanel({
  title,
  items,
}: {
  title: string;
  items: TodoItem[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-gray-900">{title}</div>
      <div className="space-y-2">
        {items.map((t) => (
          <div key={t.id} className="flex items-center gap-3">
            <div
              className={
                "h-2.5 w-2.5 rounded-full " +
                (t.status === "completed"
                  ? "bg-green-500"
                  : t.status === "in_progress"
                  ? "bg-blue-500"
                  : "bg-gray-300")
              }
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-gray-900">{t.title}</div>
              <div className="text-[11px] text-gray-500">
                {t.status} • {t.priority}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="text-sm text-gray-500">No tasks yet.</div>
        ) : null}
      </div>
    </div>
  );
}



