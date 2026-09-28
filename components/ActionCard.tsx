import type { ReactNode } from "react";

interface ActionCardProps {
  art: ReactNode;
  title: string;
  /** Shown as a tooltip; the reference card shows only the label. */
  description: string;
  onClick: () => void;
}

export function ActionCard({ art, title, description, onClick }: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={description}
      className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-4 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-violet-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
    >
      {art}
      <span className="text-[15px] font-medium text-slate-700">{title}</span>
    </button>
  );
}
