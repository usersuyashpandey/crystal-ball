"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Eye, FolderOpen, Sparkles } from "lucide-react";
import type { ApprovalItem } from "@/lib/queue";
import { shortDate, slaPosition } from "@/lib/sla";
import { TYPE_STYLE, folderParts } from "./typeStyles";

type Tab = "snapshot" | "media";

/** The right-hand detail pane from the reference screenshot. */
export function ApprovalDetail({ item }: { item: ApprovalItem }) {
  const [tab, setTab] = useState<Tab>("snapshot");
  const crumbs = [...folderParts(item.folderPath), item.title];
  const sla = slaPosition(item.submittedAt, item.slaHours);

  return (
    <div
      data-testid="approval-detail"
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 bg-slate-50/60 px-6 pb-4 pt-5">
        <nav aria-label="Location" className="flex flex-wrap items-center gap-2 text-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
              <span
                className={
                  i === 0
                    ? "rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-900"
                    : i === crumbs.length - 1
                      ? "font-medium text-slate-900"
                      : "text-slate-500"
                }
              >
                {c}
              </span>
            </span>
          ))}
        </nav>
        <h2 className="mt-3 text-xl font-semibold text-slate-900">{item.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{item.description}</p>

        <div role="tablist" aria-label="Request detail" className="mt-4 flex gap-2 text-sm">
          <TabButton active={tab === "snapshot"} onClick={() => setTab("snapshot")} Icon={Eye} label="Snapshot & Control" />
          <TabButton active={tab === "media"} onClick={() => setTab("media")} Icon={FolderOpen} label="Media / Content" />
        </div>
      </div>

      <div className="flex-1 px-6 py-5" role="tabpanel">
        {tab === "snapshot" ? (
          <>
            <h3 className="flex items-center gap-2 font-medium text-slate-900">
              <Sparkles className="h-4 w-4 text-violet-600" aria-hidden /> Screen Snapshot Target
            </h3>
            <SnapshotPreview item={item} />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Meta label="Review SLA">
                <span className={sla.overdue ? "font-medium text-red-600" : "text-slate-700"} suppressHydrationWarning>
                  {sla.slaStatus} ({item.slaHours}h target)
                </span>
              </Meta>
              <Meta label="Flags">
                {item.flags.length ? (
                  <span className="flex flex-wrap gap-1">
                    {item.flags.map((f) => (
                      <span key={f} className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        {f}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-slate-500">None</span>
                )}
              </Meta>
            </dl>
          </>
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Meta label="Type">{TYPE_STYLE[item.type].label}</Meta>
            <Meta label="Size">{item.sizeLabel}</Meta>
            <Meta label="Submitted by">{item.submittedBy}</Meta>
            <Meta label="Submitted">{shortDate(item.submittedAt)}</Meta>
            <Meta label="Folder">{folderParts(item.folderPath).join(" › ")}</Meta>
            <Meta label="Status">Pending Review</Meta>
          </dl>
        )}
      </div>

      <p className="truncate border-t border-slate-100 px-6 py-3 text-sm text-slate-500">
        Help Admin View — Approvals and rejections are recorded with a one-line reason for the submitter.
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Eye;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 font-medium transition ${
        active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{children}</dd>
    </div>
  );
}

/** A miniature of the target screen the item belongs to, with the item's
 * location highlighted, echoing the reference's snapshot image. */
function SnapshotPreview({ item }: { item: ApprovalItem }) {
  const [area] = folderParts(item.folderPath);
  const tabs = ["My Drawings", "Drawing-Videos", "My Site Patrol", "Site Recordings"];
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100" aria-hidden>
      <div className="flex items-center justify-between bg-slate-900 px-3 py-2 text-[11px] text-white">
        <span>My Site Time Machine</span>
        <span className="rounded bg-violet-600 px-2 py-0.5 font-semibold">{item.title}</span>
      </div>
      <div className="flex gap-3 border-b border-slate-200 bg-white px-3 py-1.5 text-[10px] text-slate-500">
        {tabs.map((t) => (
          <span
            key={t}
            className={t === area ? "rounded px-1 font-semibold text-violet-600 ring-2 ring-violet-400" : ""}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-2 p-3">
        <div className="space-y-1.5 rounded-lg bg-white p-2">
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className={`flex gap-2 rounded px-1 py-1 ${r === 3 ? "bg-orange-100" : ""}`}>
              <span className="h-2 w-6 rounded bg-slate-200" />
              <span className="h-2 flex-1 rounded bg-slate-200" />
              <span className="h-2 w-8 rounded bg-rose-200" />
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-gradient-to-b from-slate-300 to-slate-500" />
      </div>
    </div>
  );
}
