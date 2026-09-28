import type { ReactNode } from "react";

/**
 * Renders the light markdown live models add anyway (**bold**, `code`,
 * numbered and dash lists) as real elements. Everything else is plain
 * text: model output is never interpreted as HTML, and React escapes it.
 * An unclosed ** or ` (common mid-stream) simply shows as typed until the
 * closing mark arrives.
 *
 * `trailing` (e.g. the streaming cursor) is placed at the end of the last
 * block so it sits after the last word rather than on its own line.
 */

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ol" | "ul"; items: string[] };

const ORDERED = /^\s*\d+[.)]\s+/;
const BULLET = /^\s*[-*•]\s+/;

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const kind = ORDERED.test(line) ? "ol" : BULLET.test(line) ? "ul" : "p";
    const last = blocks[blocks.length - 1];
    if (kind === "p") {
      if (last?.kind === "p") last.lines.push(line);
      else blocks.push({ kind: "p", lines: [line] });
    } else {
      const content = line.replace(kind === "ol" ? ORDERED : BULLET, "");
      if (last?.kind === kind) last.items.push(content);
      else blocks.push({ kind, items: [content] });
    }
  }
  // Drop paragraphs that are only blank lines (e.g. between a list and text).
  return blocks.filter((b) => b.kind !== "p" || b.lines.some((l) => l.trim()));
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-slate-200/70 px-1 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function RichText({ text, trailing }: { text: string; trailing?: ReactNode }) {
  const blocks = toBlocks(text);
  if (blocks.length === 0) return <>{trailing}</>;

  return (
    <>
      {blocks.map((block, bi) => {
        const isLast = bi === blocks.length - 1;
        if (block.kind === "p") {
          return (
            <p key={bi} className="whitespace-pre-wrap [&:not(:first-child)]:mt-2">
              {inline(block.lines.join("\n").trim())}
              {isLast && trailing}
            </p>
          );
        }
        const List = block.kind;
        return (
          <List
            key={bi}
            className={`${block.kind === "ol" ? "list-decimal" : "list-disc"} space-y-1 pl-5 [&:not(:first-child)]:mt-2`}
          >
            {block.items.map((item, ii) => (
              <li key={ii}>
                {inline(item)}
                {isLast && ii === block.items.length - 1 && trailing}
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
}
