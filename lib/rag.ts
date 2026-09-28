import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Deliberately not a vector store. The brief is explicit that "a simple
 * in-memory similarity or even keyword retrieval over 3-5 chunks is
 * sufficient to demonstrate the pattern" — so this is keyword/TF scoring
 * over a handful of markdown sections, no embeddings, no pgvector. Swapping
 * this module for a real vector index later would not require touching the
 * route handler, which only depends on `retrieveChunks`.
 */

export interface PolicyChunk {
  heading: string;
  body: string;
}

let cachedChunks: PolicyChunk[] | null = null;

function loadChunks(): PolicyChunk[] {
  if (cachedChunks) return cachedChunks;

  const filePath = path.join(process.cwd(), "content", "approval-policy.md");
  const raw = readFileSync(filePath, "utf-8");

  // Split on level-2 headings ("## ..."); the level-1 title/preamble is
  // dropped since it's meta-commentary about the file, not policy content.
  const sections = raw.split(/\n(?=## )/g).filter((s) => s.startsWith("## "));

  cachedChunks = sections.map((section) => {
    const [headingLine, ...rest] = section.split("\n");
    return {
      heading: headingLine.replace(/^##\s*/, "").trim(),
      body: rest.join("\n").trim(),
    };
  });

  return cachedChunks;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "was",
  "were",
  "this",
  "that",
  "with",
  "from",
  "have",
  "has",
  "not",
  "can",
  "what",
  "who",
  "how",
  "does",
  "should",
  "when",
]);

/**
 * Scores each chunk by overlapping (non-stopword) token count with the
 * query, weighted lightly toward heading matches. Returns the top `limit`
 * chunks whose score is above zero; an empty result means nothing in the
 * policy doc is relevant, which callers should treat as "not grounded"
 * rather than falling back to the model's general knowledge.
 */
export function retrieveChunks(query: string, limit = 3): PolicyChunk[] {
  const chunks = loadChunks();
  const queryTokens = tokenize(query).filter((t) => !STOPWORDS.has(t));

  if (queryTokens.length === 0) return [];

  const scored = chunks.map((chunk) => {
    const headingTokens = new Set(tokenize(chunk.heading));
    const bodyTokens = tokenize(chunk.body);
    const bodyTokenCounts = new Map<string, number>();
    for (const t of bodyTokens) {
      bodyTokenCounts.set(t, (bodyTokenCounts.get(t) ?? 0) + 1);
    }

    let score = 0;
    for (const qt of queryTokens) {
      if (headingTokens.has(qt)) score += 3;
      score += bodyTokenCounts.get(qt) ?? 0;
    }

    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.chunk);
}

export function getAllChunkHeadings(): string[] {
  return loadChunks().map((c) => c.heading);
}
