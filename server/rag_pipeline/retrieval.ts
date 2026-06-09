// 检索器 —— 四层架构第二层（服务端）
import type { UserIntent, ParsedQuestion } from "./types";
import { extractSection, extractQuestionNo } from "./questionParser";

export interface RagChunk {
  text: string;
  tokens: string[];
  uniqueTokens: Set<string>;
  source: string;
  title: string;
  kind: "textbook" | "exam";
}

export interface RagIndex {
  chunks: RagChunk[];
  idf: Map<string, number>;
  postings: Map<string, Set<number>>;
}

export interface LibraryChunkLike {
  text: string;
  tokens: string[];
  source: string;
  title: string;
  kind: "textbook" | "exam";
}

export interface ExercisePair {
  id: string;
  section: string;
  questionNo: string;
  questionText: string;
  answerText: string;
  filePath: string;
}

export function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[\u3000\t]+/g, " ").replace(/[ ]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function tokenizeChinese(text: string): string[] {
  const normalized = text.toLowerCase();
  const raw = normalized.match(/[\u4e00-\u9fff]+|\d+(?:\.\d+)+|[a-z0-9]+/g) || [];
  const tokens: string[] = [];
  for (const part of raw) {
    if (/^\d+(?:\.\d+)+$/.test(part)) {
      tokens.push(part);
      tokens.push(part.replace(/\./g, ""));
      const segments = part.split(".");
      for (const seg of segments) {
        if (seg.length >= 1) tokens.push(seg);
      }
      continue;
    }
    if (/^[\u4e00-\u9fff]+$/.test(part)) {
      for (let i = 0; i < part.length; i++) {
        tokens.push(part[i]);
        if (i < part.length - 1) tokens.push(part.slice(i, i + 2));
        if (i < part.length - 2) tokens.push(part.slice(i, i + 3));
      }
    } else if (part.length >= 2) {
      tokens.push(part);
    }
  }
  return tokens;
}

export function buildRagIndex(chunksInput: LibraryChunkLike[]): RagIndex {
  const chunks: RagChunk[] = chunksInput.map((ch) => ({
    text: ch.text,
    tokens: ch.tokens,
    uniqueTokens: new Set(ch.tokens),
    source: ch.source,
    title: ch.title,
    kind: ch.kind,
  }));
  const postings = new Map<string, Set<number>>();
  for (let i = 0; i < chunks.length; i++) {
    for (const token of chunks[i].uniqueTokens) {
      let set = postings.get(token);
      if (!set) {
        set = new Set<number>();
        postings.set(token, set);
      }
      set.add(i);
    }
  }
  const idf = new Map<string, number>();
  const total = Math.max(chunks.length, 1);
  for (const [token, set] of postings) {
    if (set.size >= 1) {
      idf.set(token, Math.log((total + 1) / (set.size + 1)) + 1);
    }
  }
  return { chunks, idf, postings };
}

export function searchRag(query: string, index: RagIndex, topK = 6): RagChunk[] {
  if (index.chunks.length === 0) return [];
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return index.chunks.slice(0, topK);
  const queryTokens = tokenizeChinese(normalizedQuery);
  if (queryTokens.length === 0) return index.chunks.slice(0, topK);
  const queryCounts = new Map<string, number>();
  for (const token of queryTokens) {
    queryCounts.set(token, (queryCounts.get(token) || 0) + 1);
  }
  const queryWeights = new Map<string, number>();
  let queryNorm = 0;
  for (const [token, tf] of queryCounts) {
    const idf = index.idf.get(token) || 0;
    const weight = tf * idf;
    if (weight > 0) {
      queryWeights.set(token, weight);
      queryNorm += weight * weight;
    }
  }
  if (Math.abs(queryNorm) < 1e-9) return index.chunks.slice(0, topK);
  const scores: { idx: number; score: number }[] = [];
  for (let i = 0; i < index.chunks.length; i++) {
    const chunk = index.chunks[i];
    let dot = 0;
    for (const [token, qWeight] of queryWeights) {
      if (chunk.uniqueTokens.has(token)) {
        const chunkTf = chunk.tokens.filter((t) => t === token).length;
        dot += qWeight * chunkTf * (index.idf.get(token) || 0);
      }
    }
    if (dot > 0) {
      const chunkNorm = Math.max(chunk.tokens.length, 1);
      scores.push({ idx: i, score: dot / (Math.sqrt(queryNorm) * Math.sqrt(chunkNorm)) });
    }
  }
  return scores.sort((a, b) => b.score - a.score).slice(0, topK).map(({ idx }) => index.chunks[idx]);
}

export function rankChunksForIntent(chunks: RagChunk[], query: string, intent: UserIntent | string): RagChunk[] {
  const section = extractSection(query) || "";
  const questionNo = extractQuestionNo(query) || "";
  return [...chunks].sort((a, b) => {
    const score = (chunk: RagChunk) => {
      let s = 0;
      if (section && chunk.source.includes(section)) s += 3;
      if (questionNo && chunk.text.includes(questionNo)) s += 2;
      if (/answer|analysis/i.test(chunk.text)) s += 2;
      if (chunk.kind === "exam") s += 1.5;
      if (intent === "knowledge" && chunk.kind === "textbook") s += 1;
      if (intent === "count" && /question|answer/i.test(chunk.text)) s += 1;
      return s;
    };
    return score(b) - score(a);
  });
}

export function mergeChunks(...groups: RagChunk[][]): RagChunk[] {
  const merged: RagChunk[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const chunk of group) {
      const key = chunk.source + "|" + chunk.text.slice(0, 80);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(chunk);
      }
    }
  }
  return merged;
}

export function formatRagContext(chunks: RagChunk[]): string {
  return chunks.map((c, i) => {
    const src = "[Source " + (i + 1) + "] " + c.source + (c.title ? " / " + c.title : "");
    return src + "\n" + c.text;
  }).join("\n\n---\n\n");
}

export function retrieve(
  parsed: ParsedQuestion,
  ragIndex: RagIndex | null,
  embeddingChunks: LibraryChunkLike[],
  queryEmbedding: number[] | null
): RagChunk[] {
  const recallQueries = [parsed.rawText, parsed.historyHint].filter(Boolean);
  if (parsed.section) {
    recallQueries.push(parsed.section);
    recallQueries.push(parsed.section + " ");
    recallQueries.push(parsed.section + " ");
  }
  for (const qn of parsed.questionNos) {
    recallQueries.push(" " + qn + " ");
    if (parsed.section) {
      recallQueries.push(parsed.section + " " + qn + " ");
    }
  }
  const tfidf = ragIndex
    ? recallQueries.map((q) => rankChunksForIntent(searchRag(q, ragIndex, 6), q, parsed.intent))
    : [];
  return mergeChunks(...tfidf).slice(0, 8);
}
