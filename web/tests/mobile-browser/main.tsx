import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { ApplicationFilters } from "@/components/applications/application-filters";
import { ApplicationsList } from "@/components/applications/applications-list";
import { ApplicationsHeader } from "@/components/applications/applications-header";
import { KanbanBoard } from "@/components/applications/kanban-board";
import { ApplicationForm } from "@/components/forms/application-form";
import { StatusPicker } from "@/components/applications/status-picker";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { TouchScrollGuard } from "@/components/layout/TouchScrollGuard";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
  Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui";
import type { ApplicationStatus } from "@/config/constants";
import { usePathname, useSearchParams } from "./mocks/navigation";
import { applications } from "./fixtures";
import "@/app/globals.css";
import "@/app/(dashboard)/dashboard.css";
import { DashboardFixture } from "./dashboard-fixture";

function Controls() {
  const [status, setStatus] = useState<ApplicationStatus>("Applied");
  const [selection, setSelection] = useState("Option 1");
  const [changes, setChanges] = useState(0);
  const [controlledOpen, setControlledOpen] = useState(false);
  const [pointerDowns, setPointerDowns] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  return <main className="mx-auto max-w-xl space-y-5 p-6">
    <h1>Touch regression controls</h1>
    <output data-testid="changes">{changes}</output>
    <output data-testid="pointer-downs">{pointerDowns}</output>
    <div className="h-40" aria-hidden="true" />
    <div data-testid="status-control"><StatusPicker status={status} company="Fixture" position="Engineer" onChange={(value) => { setStatus(value); setChanges((n) => n + 1); }} /></div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="db-btn-page-primary" ref={trigger} onPointerDown={() => setPointerDowns((n) => n + 1)}>Uncontrolled actions</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-48 overflow-y-auto" align="start">
        {Array.from({ length: 20 }, (_, n) => <DropdownMenuItem key={n} onSelect={() => setChanges((value) => value + 1)}>Action {n + 1}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu open={controlledOpen} onOpenChange={setControlledOpen}>
      <DropdownMenuTrigger className="db-btn-page-primary">Controlled actions</DropdownMenuTrigger>
      <DropdownMenuContent><DropdownMenuItem onSelect={() => setChanges((n) => n + 1)}>Controlled action</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
    <Select value={selection} onValueChange={(value) => { setSelection(value); setChanges((n) => n + 1); }}>
      <SelectTrigger aria-label="Fixture select"><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-48">
        {Array.from({ length: 20 }, (_, n) => <SelectItem key={n} value={`Option ${n + 1}`}>Option {n + 1}</SelectItem>)}
      </SelectContent>
    </Select>
    <button type="button" className="db-btn-page-primary" onClick={() => trigger.current?.focus()}>Focus action trigger</button>
    <Dialog>
      <DialogTrigger className="db-btn-page-primary">Open centered dialog</DialogTrigger>
      <DialogContent>
        <DialogTitle>Centered dialog fixture</DialogTitle>
        <DialogDescription>The default dialog placement remains centered.</DialogDescription>
      </DialogContent>
    </Dialog>
    <div className="h-[1600px]" aria-hidden="true" />
  </main>;
}

function App() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isControls = pathname === "/controls";
  const isEdit = pathname.endsWith("/edit");
  const isNew = pathname.endsWith("/new");
  return <div className="db-root min-h-screen">
    <TouchScrollGuard />
    <Toaster />
    {isControls ? <Controls /> : <>
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background px-4 sm:h-16"><span className="font-semibold">Jobnest</span></header>
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        {pathname === "/dashboard" ? <DashboardFixture /> : isEdit || isNew ? <div className="application-page-shell mx-auto max-w-3xl">
          <ApplicationForm application={isEdit ? applications[0] : undefined} userId="fixture-user" initialDocuments={isEdit ? [{ id: "fixture-resume", label: "Resume", storage_path: "fixture/resume.pdf", original_name: "Senior_Software_Engineer_Developer_Experience_and_Infrastructure_Resume_2026.pdf" }] : undefined} />
        </div> : <>
          <ApplicationsHeader />
          <ApplicationFilters statusCounts={{ Applied: 4, Interview: 2, "Phone Screen": 1 }} />
          {searchParams.get("view") === "kanban"
            ? <KanbanBoard applications={applications} />
            : <ApplicationsList applications={applications} total={87} currentPage={1} totalPages={9} pageSize={10} />}
        </>}
      </main>
      <BottomTabBar />
    </>}
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
