"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, EllipsisVertical, Info, Layers, ListFilter, MessageSquare, Plus, Search } from "lucide-react";
import type { ApprovalItem } from "@/lib/queue";
import { shortDate } from "@/lib/sla";
import { useAssistantStore } from "@/lib/store";
import { TYPE_STYLE, folderParts } from "./typeStyles";
import { ApprovalDetail } from "./ApprovalDetail";

type ViewMode = "queue" | "hierarchy";

/**
 * The Approvals & Review page from the reference screenshot: header card
 * with search, the pending-requests table (Queue or Hierarchy view), and
 * the detail pane for the selected request. Search, both views, selection,
 * the detail tabs and the row menu all work; the assistant panel sits on
 * top of this page.
 */
export function ApprovalsWorkspace({ queue }: { queue: ApprovalItem[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("queue");
  const [selectedId, setSelectedId] = useState(queue[0]?.id ?? null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const askAbout = useAssistantStore((s) => s.askAbout);
  const openOn = useAssistantStore((s) => s.openOn);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((i) =>
      [i.title, i.submittedBy, i.folderPath.replace(/›/g, " ")].some((field) => field.toLowerCase().includes(q)),
    );
  }, [queue, query]);

  const groups = useMemo(() => {
    const map = new Map<string, ApprovalItem[]>();
    for (const item of filtered) {
      const top = folderParts(item.folderPath)[0] ?? "Other";
      map.set(top, [...(map.get(top) ?? []), item]);
    }
    return [...map.entries()];
  }, [filtered]);

  const selected = queue.find((i) => i.id === selectedId) ?? null;

  const rowProps = {
    selectedId,
    menuFor,
    onSelect: setSelectedId,
    onToggleMenu: (id: string) => setMenuFor((cur) => (cur === id ? null : id)),
    onAsk: (item: ApprovalItem) => {
      setMenuFor(null);
      void askAbout(item.title);
    },
  };

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-4">
      {/* Header card */}
      <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              aria-disabled
              title="The dashboard isn't part of this demo"
              className="flex cursor-default items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </button>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              Approvals &amp; Review
              <Info
                className="h-4 w-4 text-slate-400"
                aria-label="Review and approve content submitted by site admins"
              />
            </h1>
          </div>
          <button
            type="button"
            onClick={() => openOn("help")}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" /> Add help
          </button>
        </div>
        <label className="mt-4 flex max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-violet-400">
          <Search className="h-4 w-4 text-slate-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search approvals by title, author, folder, or page..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
        </label>
      </section>

      <div className="flex flex-col gap-4 min-[1400px]:flex-row">
        {/* Pending requests */}
        <section className="min-w-0 flex-[1.45] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <ListFilter className="h-5 w-5 text-violet-600" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Pending Approval Requests</h2>
              <span data-testid="request-count" className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                {filtered.length} item{filtered.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm">
              <ViewToggle active={view === "queue"} onClick={() => setView("queue")} Icon={ListFilter} label="Queue View" />
              <ViewToggle
                active={view === "hierarchy"}
                onClick={() => setView("hierarchy")}
                Icon={Layers}
                label="Hierarchy View"
              />
            </div>
          </div>

          <div role="grid" aria-label="Pending approval requests" className="overflow-x-auto">
            <div role="row" className={`${GRID} border-b border-slate-100 bg-slate-50/70 text-xs font-medium uppercase tracking-wide text-slate-500`}>
              <span role="columnheader">Folder / Content name</span>
              <span role="columnheader">Type</span>
              <span role="columnheader">Submitted by</span>
              <span role="columnheader">Date</span>
              <span role="columnheader">Status</span>
              <span role="columnheader" className="text-right">Actions</span>
            </div>

            {filtered.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-slate-500">No approvals match &ldquo;{query}&rdquo;.</p>
            )}

            {view === "queue" && filtered.map((item) => <ApprovalRow key={item.id} item={item} {...rowProps} />)}

            {view === "hierarchy" &&
              groups.map(([folder, items]) => (
                <div key={folder} data-testid="folder-group" data-folder={folder}>
                  <div className="flex items-center gap-2 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-600">
                    <Layers className="h-3.5 w-3.5 text-violet-500" aria-hidden />
                    {folder}
                    <span className="font-normal text-slate-400">({items.length})</span>
                  </div>
                  {items.map((item) => (
                    <ApprovalRow key={item.id} item={item} {...rowProps} />
                  ))}
                </div>
              ))}
          </div>
        </section>

        {/* Detail pane */}
        <section className="min-w-0 flex-1">{selected && <ApprovalDetail item={selected} />}</section>
      </div>

      {menuFor && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setMenuFor(null)}
        />
      )}
    </div>
  );
}

const GRID =
  "grid min-w-[760px] grid-cols-[minmax(240px,2.4fr)_0.9fr_1.2fr_0.7fr_1fr_0.5fr] items-center gap-3 px-5 py-3";

function ViewToggle({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Layers;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium transition ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
}

function ApprovalRow({
  item,
  selectedId,
  menuFor,
  onSelect,
  onToggleMenu,
  onAsk,
}: {
  item: ApprovalItem;
  selectedId: string | null;
  menuFor: string | null;
  onSelect: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onAsk: (item: ApprovalItem) => void;
}) {
  const style = TYPE_STYLE[item.type];
  const selected = item.id === selectedId;
  const parts = folderParts(item.folderPath);

  return (
    <div
      role="row"
      data-testid="approval-row"
      aria-selected={selected}
      onClick={() => onSelect(item.id)}
      className={`${GRID} relative cursor-pointer border-b border-slate-100 border-l-4 text-sm transition ${
        selected ? "border-l-violet-600 bg-violet-50" : "border-l-transparent hover:bg-slate-50"
      }`}
    >
      <div role="gridcell" className="flex min-w-0 items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.tile}`}>
          <style.Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={`truncate text-slate-900 ${selected ? "font-semibold" : "font-medium"}`}>{item.title}</p>
          <p className="truncate text-xs text-slate-500">{parts.join(" › ")}</p>
        </div>
      </div>
      <div role="gridcell">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-700">
          <style.Icon className="h-3.5 w-3.5" aria-hidden />
          {style.label}
        </span>
      </div>
      <div role="gridcell" className={`whitespace-nowrap ${selected ? "font-semibold text-slate-700" : "text-slate-600"}`}>
        {item.submittedBy}
      </div>
      <div role="gridcell" className={`whitespace-nowrap ${selected ? "font-semibold text-slate-700" : "text-slate-600"}`}>
        {shortDate(item.submittedAt)}
      </div>
      <div role="gridcell">
        <span className="whitespace-nowrap rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-600 shadow-sm">
          Pending Review
        </span>
      </div>
      <div role="gridcell" className="relative flex justify-end">
        <button
          type="button"
          aria-label={`Actions for ${item.title}`}
          aria-haspopup="menu"
          aria-expanded={menuFor === item.id}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu(item.id);
          }}
          className="rounded-md p-1 text-slate-700 hover:bg-slate-200"
        >
          <EllipsisVertical className="h-4 w-4" />
        </button>
        {menuFor === item.id && (
          <div
            role="menu"
            className="absolute right-0 top-8 z-40 w-60 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onAsk(item);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-violet-50"
            >
              <MessageSquare className="h-4 w-4 text-violet-600" aria-hidden />
              Ask the assistant about this item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
