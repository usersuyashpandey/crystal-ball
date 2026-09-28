import type { StreamMode } from "@/lib/schemas";

const LABEL: Record<StreamMode, string> = {
  live: "Live model",
  mock: "Offline mock",
  degraded: "Degraded fallback",
};

const STYLES: Record<StreamMode, string> = {
  live: "bg-emerald-100 text-emerald-700",
  mock: "bg-slate-200 text-slate-600",
  degraded: "bg-amber-100 text-amber-700",
};

/**
 * Small transparency badge so it's visible in the UI (not just the network
 * tab) which of the three code paths actually served a given answer —
 * useful when demoing the fallback behavior by killing an API key.
 */
export function ModeBadge({ mode }: { mode: StreamMode | null }) {
  if (!mode) return null;
  return (
    <span
      title="Which backend produced this response"
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[mode]}`}
    >
      {LABEL[mode]}
    </span>
  );
}
