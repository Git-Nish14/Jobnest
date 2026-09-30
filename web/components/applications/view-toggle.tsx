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
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="application-view-toggle flex w-full items-center gap-1 rounded-xl bg-[#f4f3f1] p-1 dark:bg-white/8 md:w-auto md:rounded-lg">
      <button
        type="button"
        onClick={() => switchView("list")}
        title="List view"
        aria-label="Switch to list view"
        aria-pressed={current === "list"}
        className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors md:h-7 md:min-h-0 md:w-7 md:flex-none md:rounded-md ${
          current === "list"
            ? "bg-white dark:bg-white/15 shadow-sm text-[#1a1c1b] dark:text-[#e8ddd9]"
            : "text-[#88726c] hover:text-[#1a1c1b] dark:hover:text-[#e8ddd9]"
        }`}
      >
        <List className="h-3.5 w-3.5" />
        <span className="md:hidden">List</span>
      </button>
      <button
        type="button"
        onClick={() => switchView("kanban")}
        title="Kanban view"
        aria-label="Switch to Kanban view"
        aria-pressed={current === "kanban"}
        className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors md:h-7 md:min-h-0 md:w-7 md:flex-none md:rounded-md ${
          current === "kanban"
            ? "bg-white dark:bg-white/15 shadow-sm text-[#1a1c1b] dark:text-[#e8ddd9]"
            : "text-[#88726c] hover:text-[#1a1c1b] dark:hover:text-[#e8ddd9]"
        }`}
      >
        <Columns3 className="h-3.5 w-3.5" />
        <span className="md:hidden">Board</span>
      </button>
    </div>
  );
}
