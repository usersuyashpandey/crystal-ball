interface ActionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function ActionCard({ icon, title, subtitle, onClick }: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-violet-300 hover:bg-violet-50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-lg" aria-hidden>
        {icon}
      </span>
      <span className="text-sm font-semibold text-slate-800">{title}</span>
      <span className="text-xs leading-snug text-slate-500">{subtitle}</span>
    </button>
  );
}
