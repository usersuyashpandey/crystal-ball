import type { ApprovalItem } from "@/lib/queue";

const TYPE_ICON: Record<ApprovalItem["type"], string> = {
  folder: "\u{1F4C1}",
  video: "\u{1F3A5}",
  pdf: "\u{1F4C4}",
  image: "\u{1F5BC}️",
};

function statusLabel(item: ApprovalItem): string {
  const submitted = new Date(item.submittedAt);
  const dateLabel = submitted.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Pending Review — ${dateLabel}`;
}

/**
 * A simplified stand-in for the rest of OomniEye's dashboard (brief §1 only
 * asks us to rebuild the assistant panel itself, not the whole app) — just
 * enough backdrop that the panel doesn't look like it's floating over a
 * blank page, and so the queue data it's reasoning about is visible too.
 */
export function QueueDashboard({ queue }: { queue: ApprovalItem[] }) {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">OomniEye · Digital Twin Solutions</p>
          <h1 className="text-2xl font-bold text-slate-900">Approvals &amp; Review</h1>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
          {queue.length} items pending
        </span>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span>Folder / content name</span>
          <span>Type</span>
          <span>Submitted by</span>
          <span>Status</span>
        </div>
        {queue.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-2 border-b border-slate-50 px-4 py-3 text-sm last:border-none"
          >
            <div>
              <p className="font-medium text-slate-800">{item.title}</p>
              <p className="text-xs text-slate-400">{item.folderPath}</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs capitalize text-slate-600">
              <span aria-hidden>{TYPE_ICON[item.type]}</span>
              {item.type}
            </span>
            <span className="text-slate-600">{item.submittedBy}</span>
            <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {statusLabel(item)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
