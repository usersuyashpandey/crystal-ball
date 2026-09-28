const STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

export function UrgencyBadge({ urgency }: { urgency: "high" | "medium" | "low" }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STYLES[urgency]}`}>
      {urgency}
    </span>
  );
}
