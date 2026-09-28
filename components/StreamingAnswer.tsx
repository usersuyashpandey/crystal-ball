export type StreamingAnswerStatus = "idle" | "loading" | "streaming" | "done" | "error";

interface StreamingAnswerProps {
  status: StreamingAnswerStatus;
  narrative: string;
  error?: string | null;
  onRetry?: () => void;
  /** Shown before anything has been requested yet. */
  idleLabel?: string;
}

/**
 * The shared "answer area" for every assistant action — this is what the
 * loading/streaming/error-state requirement (brief §3, "Loading and error
 * states are visibly handled, not just happy path") is actually about, and
 * it's the component covered by the Vitest + Testing Library test
 * (__tests__/component/StreamingAnswer.test.tsx).
 */
export function StreamingAnswer({ status, narrative, error, onRetry, idleLabel }: StreamingAnswerProps) {
  if (status === "idle") {
    return <p className="text-sm text-slate-400">{idleLabel ?? " "}</p>;
  }

  if (status === "loading" && !narrative) {
    return (
      <div data-testid="answer-loading" className="space-y-2" role="status" aria-label="Loading">
        <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div data-testid="answer-error" className="space-y-2 rounded-lg bg-red-50 p-3">
        <p className="text-sm text-red-700">{error ?? "Something went wrong."}</p>
        {onRetry && (
          <button
            type="button"
            data-testid="retry-button"
            onClick={onRetry}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <p data-testid="answer-text" className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
      {narrative}
      {status === "streaming" && (
        <span
          data-testid="streaming-cursor"
          className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-slate-400 align-middle"
          aria-hidden
        />
      )}
    </p>
  );
}
