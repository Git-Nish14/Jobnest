"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { List, Columns3 } from "lucide-react";

export function ViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("view") ?? "list";

  function switchView(view: "list" | "kanban") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 bg-[#f4f3f1] dark:bg-white/8 rounded-lg p-1">
      <button
        type="button"
        onClick={() => switchView("list")}
        title="List view"
        aria-label="Switch to list view"
        aria-pressed={current === "list"}
        className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
          current === "list"
            ? "bg-white dark:bg-white/15 shadow-sm text-[#1a1c1b] dark:text-[#e8ddd9]"
            : "text-[#88726c] hover:text-[#1a1c1b] dark:hover:text-[#e8ddd9]"
        }`}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => switchView("kanban")}
        title="Kanban view"
        aria-label="Switch to Kanban view"
        aria-pressed={current === "kanban"}
        className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
          current === "kanban"
            ? "bg-white dark:bg-white/15 shadow-sm text-[#1a1c1b] dark:text-[#e8ddd9]"
            : "text-[#88726c] hover:text-[#1a1c1b] dark:hover:text-[#e8ddd9]"
        }`}
      >
        <Columns3 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
