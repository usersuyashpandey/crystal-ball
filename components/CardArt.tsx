import { AudioLines, CircleHelp, FileText, GraduationCap, Hand, Headset, Mic, Tablet, Users } from "lucide-react";
import type { AssistantView } from "@/lib/store";

/**
 * Original card illustrations in the spirit of the reference (a figure in
 * the brand's warm yellow, with a floating badge for the action). The
 * reference uses its own 3D character artwork, which isn't reproduced here.
 */
export function CardArt({ kind }: { kind: Exclude<AssistantView, "home"> }) {
  const figure = "h-14 w-14 text-amber-500";
  const badge =
    "absolute flex items-center gap-1 rounded-lg border border-slate-100 bg-white px-1.5 py-1 text-violet-600 shadow-sm";

  return (
    <div className="relative mx-auto flex h-28 w-32 items-center justify-center" aria-hidden>
      <div className="absolute inset-3 rounded-full bg-gradient-to-br from-amber-50 to-amber-100" />
      {kind === "summary" && (
        <>
          <Tablet className={`relative ${figure}`} strokeWidth={1.6} />
          <span className={`${badge} right-0 top-1`}>
            <FileText className="h-4 w-4" />
            <span className="flex flex-col gap-0.5">
              <span className="h-0.5 w-5 rounded bg-violet-300" />
              <span className="h-0.5 w-4 rounded bg-violet-200" />
              <span className="h-0.5 w-5 rounded bg-violet-200" />
            </span>
          </span>
        </>
      )}
      {kind === "chat" && (
        <>
          <Headset className={`relative ${figure}`} strokeWidth={1.6} />
          <span className={`${badge} -right-1 top-4`}>
            <Mic className="h-4 w-4" />
            <AudioLines className="h-4 w-4" />
          </span>
        </>
      )}
      {kind === "help" && (
        <>
          <Hand className={`relative ${figure}`} strokeWidth={1.6} />
          <CircleHelp className="absolute right-3 top-0 h-6 w-6 text-amber-500" strokeWidth={2.2} />
        </>
      )}
      {kind === "teach" && (
        <>
          <Users className={`relative ${figure}`} strokeWidth={1.6} />
          <span className={`${badge} left-1/2 top-0 -translate-x-1/2`}>
            <GraduationCap className="h-4 w-4" />
          </span>
        </>
      )}
    </div>
  );
}
