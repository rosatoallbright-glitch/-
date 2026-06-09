import { useState, useRef, useEffect, useCallback, useMemo } from "react";

import { ApiSettings, TaskDef, ChatMessage, LuluState, QaItem } from "../types";


import { X, Send, BookOpen, FileText, User, Loader2, FolderOpen, Trash2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

import Lulu from "./Lulu";



const LULU_STATE_LABELS: Record<LuluState, string> = {

  peaceful: "平静",

  happy: "开心",

  thinking: "思考中",

  proud: "骄傲",


};



interface Props {

  apiSettings: ApiSettings;

  luluState?: LuluState;

  onClose: () => void;

  onTasksGenerated: (tasks: TaskDef[]) => void;

}



const TEXTBOOK_STORAGE_KEY = "lulu_textbook_content";

const BOOK_NAMES = ["数据结构", "计算机组成原理", "操作系统", "计算机网络"] as const;

const RAG_CONTEXT_LIMIT = 12000;

const READABLE_EXTENSIONS = ["txt", "md", "csv", "json", "xml", "html", "js", "ts", "py", "css"] as const;



type FolderFile = { path: string; name: string; content: string };

type FolderReadResult = { files: FolderFile[]; skipped: string[] };



type ReadableFileInfo = {

  path: string;

  name: string;

  content: string;

};

type LibraryChunk = {

  id: string;

  filePath: string;

  fileName: string;

  book: string;

  title: string;

  text: string;

  tokens: string[];

  section?: string;

  questionNo?: string;

  role: "content" | "question" | "answer";

  embedding?: number[];

};

type ExercisePair = {

  id: string;

  section: string;

  questionNo: string;

  questionText: string;

  answerText: string;

  filePath: string;

};

type LibraryDBSnapshot = {

  libraryName: string;

  libraryPath: string;

  files: FolderFile[];

  chunks: LibraryChunk[];

  exercises: ExercisePair[];

};



const RAG_DB_NAME = "lulu_rag_db";

const RAG_DB_VERSION = 1;

const RAG_STORE = "library";

const RAG_SNAPSHOT_KEY = "current";

const EMBEDDING_PROVIDER = "ollama" as const;

const EMBEDDING_ENDPOINT = "http://localhost:11434";

const EMBEDDING_MODEL = "bge-m3";

const EMBEDDING_TEXT_LIMIT = 1800;

const EMBEDDING_BATCH_LIMIT = 80;



const SYSTEM_PROMPT = `你是 Lulu，一个帮助 408 考研的学习助手，性格像水豚 (o.o)

1. 用户问教材/习题时，先理解他在问哪一章、哪一节、哪一题；若上一轮已经出现章节号，本轮“第2题/第四题/这题”要继承上下文。

2. 检索内容是优先参考资料。若其中有“答案与解析/解析/答案”，必须先按教材解析给出答案，再补充必要解释。

3. 你不是查书机器。必须基于教材材料进行推理、归纳和讲解，可以补充常见解法、易错点、概念关联，但不能改动标准答案，也不能编造教材依据。

4. 回答要短而有教学感，默认控制在 300 字以内；习题解析按“答案 → 教材依据 → 简要解释/易错点”输出。若材料充分，可用自己的语言解释清楚，但要以教材为准。

5. 当用户问“有几题/第几题/这一节题目数”时，优先输出准确统计结果，不要自行猜题数。

6. 不要长篇推导，不要反复自我纠错，不要主动生成学习任务，除非用户明确要求规划。

7. 语气温和，可少量使用 (o.o)，但专业内容优先。

`;



// 说明：以上为系统提示文本，不需要额外重复的说明块。



function openRagDB(): Promise<IDBDatabase> {

  return new Promise((resolve, reject) => {

    const req = indexedDB.open(RAG_DB_NAME, RAG_DB_VERSION);

    req.onupgradeneeded = () => {

      const db = req.result;

      if (!db.objectStoreNames.contains(RAG_STORE)) db.createObjectStore(RAG_STORE);

    };

    req.onsuccess = () => resolve(req.result);

    req.onerror = () => reject(req.error);

  });

}



async function saveLibrarySnapshot(snapshot: LibraryDBSnapshot): Promise<void> {

  const db = await openRagDB();

  await new Promise<void>((resolve, reject) => {

    const tx = db.transaction(RAG_STORE, "readwrite");

    tx.objectStore(RAG_STORE).put(snapshot, RAG_SNAPSHOT_KEY);

    tx.oncomplete = () => resolve();

    tx.onerror = () => reject(tx.error);

  });

  db.close();

}



async function loadLibrarySnapshot(): Promise<LibraryDBSnapshot | null> {

  const db = await openRagDB();

  const snapshot = await new Promise<LibraryDBSnapshot | null>((resolve, reject) => {

    const tx = db.transaction(RAG_STORE, "readonly");

    const req = tx.objectStore(RAG_STORE).get(RAG_SNAPSHOT_KEY);

    req.onsuccess = () => resolve((req.result as LibraryDBSnapshot) || null);

    req.onerror = () => reject(req.error);

  });

  db.close();

  return snapshot;

}



async function clearLibrarySnapshot(): Promise<void> {

  const db = await openRagDB();

  await new Promise<void>((resolve, reject) => {

    const tx = db.transaction(RAG_STORE, "readwrite");

    tx.objectStore(RAG_STORE).delete(RAG_SNAPSHOT_KEY);

    tx.oncomplete = () => resolve();

    tx.onerror = () => reject(tx.error);

  });

  db.close();

}



function cosineSimilarity(a: number[], b: number[]): number {

  const len = Math.min(a.length, b.length);

  let dot = 0;

  let normA = 0;

  let normB = 0;

  for (let i = 0; i < len; i++) {

    dot += a[i] * b[i];

    normA += a[i] * a[i];

    normB += b[i] * b[i];

  }

  if (!normA || !normB) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));

}



async function checkOllamaEmbedding(): Promise<boolean> {

  try {

    const embedding = await embedTextOllama("连接测试");

    return embedding.length > 0;

  } catch {

    return false;

  }

}



async function embedTextOllama(text: string): Promise<number[]> {

  const resp = await fetch(`${EMBEDDING_ENDPOINT.replace(/\/+$/, "")}/api/embeddings`, {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text.slice(0, EMBEDDING_TEXT_LIMIT) }),

  });

  if (!resp.ok) throw new Error(await resp.text());

  const json = await resp.json();

  return Array.isArray(json.embedding) ? json.embedding : [];

}



async function embedChunksLocal(chunks: LibraryChunk[]): Promise<LibraryChunk[]> {

  const result: LibraryChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {

    const chunk = chunks[i];

    if (i >= EMBEDDING_BATCH_LIMIT) {

      result.push(chunk);

      continue;

    }

    try {

      const embedding = await embedTextOllama(`${chunk.title}\n${chunk.text}`);

      result.push({ ...chunk, embedding });

    } catch {

      result.push(chunk);

    }

  }

  return result;

}



async function embedQueryLocal(query: string): Promise<number[] | null> {

  try {

    const embedding = await embedTextOllama(query);

    return embedding.length > 0 ? embedding : null;

  } catch {

    return null;

  }

}



function searchByEmbedding(queryEmbedding: number[], chunks: LibraryChunk[], topK = 8): RagChunk[] {

  return chunks

    .filter((chunk) => chunk.embedding && chunk.embedding.length > 0)

    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding!) }))

    .sort((a, b) => b.score - a.score)

    .slice(0, topK)

    .map(({ chunk }) => ({

      text: chunk.text,

      tokens: chunk.tokens,

      uniqueTokens: new Set(chunk.tokens),

      source: `${chunk.book} / ${chunk.filePath}`,

      title: chunk.title,

      kind: chunk.role === "answer" ? "exam" : "textbook",

    }));

}



function parseTaskPlan(text: string): TaskDef[] | null {

  const match = text.match(/\[TASK_PLAN\]\s*(\[[\s\S]*?\])\s*\[\/TASK_PLAN\]/);

  if (!match) return null;

  try {

    const parsed = JSON.parse(match[1]);

    if (Array.isArray(parsed)) {

      return parsed.map((t: any, i: number) => ({

        id: "lulu_" + Date.now() + "_" + i,

        title: t.title || "",

        description: t.description || "",

        status: "pending" as const,

      }));

    }

  } catch {}

  return null;

}



function renderMarkdown(text: string): string {

  // 1. 过滤掉大模型末尾带入的任务规划数据

  let clean = text.replace(/\[TASK_PLAN\][\s\S]*?\[\/TASK_PLAN\]/g, "").trim();

  if (!clean) return "";



  // 2. 对基础 HTML 敏感标签做转义，防止 XSS

  let escaped = clean.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");



  // 3. 多行代码块高亮提取处理 (支持 ```lang ... ```)

  const blocks: string[] = [];

  escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {

    blocks.push(`<pre class="bg-zinc-900 border border-zinc-800 rounded-lg p-3 my-2 font-mono text-xs overflow-x-auto"><code class="language-${lang}">${code.trim()}</code></pre>`);

    return `%%BLOCK_${blocks.length - 1}%%`;

  });



  // 4. 行内代码块处理 (支持 `code`)

  escaped = escaped.replace(/`([^`\n]+)`/g, (_, code) => {

    return `<code class="bg-zinc-900 text-amber-400 px-1.5 py-0.5 rounded font-mono text-xs mx-0.5 border border-zinc-800">${code}</code>`;

  });



  // 5. 核心行解析：支持加粗、列表、标题、引用

  const lns = escaped.split("\n");

  const result: string[] = [];

 

  let inList = false;

  const cL = () => { if (inList) { result.push("</ul>"); inList = false; } };



  for (let i = 0; i < lns.length; i++) {

    const l = lns[i];

    const t = l.trim();



    // 如果是提取出来的代码块占位符，直接还原

    if (t.startsWith("%%BLOCK_")) { cL(); result.push(t); continue; }



    // 空行处理

    if (t === "") { cL(); continue; }



    // 全局支持 Markdown 加粗核心修复：正确使用 $1 注入被加粗的文字内容

    // 同时兼容 KaTeX/MathJax 常见转义公式：\( ... \) 与 \[ ... \]

    const processInline = (str: string) => {

      const withMath = str

        .replace(/\\\[([\s\S]+?)\\\]/g, "<span class=\"font-mono text-emerald-300 bg-emerald-950/30 px-1 py-0.5 rounded border border-emerald-900/40\">$1</span>")

        .replace(/\\\(([^\n]+?)\\\)/g, "<span class=\"font-mono text-emerald-300 bg-emerald-950/30 px-1 py-0.5 rounded border border-emerald-900/40\">$1</span>");

      return withMath.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    };



    // 分割线处理 (--- 或 ***)

    if (/^---$/.test(t) || /^\*\*\*$/.test(t)) { cL(); result.push("<hr class=\"border-zinc-800 my-4\">\n"); continue; }



    // 标题处理 (# 到 ######)

    if (/^#{1,6}\s/.test(t)) {

      cL();

      const m = t.match(/^#+/);

      const n = m ? m[0].length : 1;

      const content = t.replace(/^#+\s*/, "");

      result.push(`<h${n} class=\"font-bold font-mono text-zinc-100 my-2\">${processInline(content)}</h${n}>`);

      continue;

    }



    // 无序列表处理 (- 或 * 或 +)

    if (/^[-*+]\s/.test(t)) {

      if (!inList) { result.push("<ul class=\"list-disc list-inside space-y-1 my-1 pl-2\">\n"); inList = true; }

      const content = t.replace(/^[-*+]\s*/, "");

      result.push(`<li>${processInline(content)}</li>`);

      continue;

    }



    // 有序列表处理 (1. 2. 3.)

    if (/^\d+\.\s/.test(t)) {

      cL();

      const content = t.replace(/^\d+\.\s*/, "");

      const num = t.match(/^\d+/)?.[0] || "1";

      result.push(`<div class=\"my-1 font-mono\"><span class=\"text-emerald-400 mr-1.5\">${num}.</span>${processInline(content)}</div>`);

      continue;

    }



    // 引用区块处理 (> )

    if (/^>\s/.test(t)) {

      cL();

      const content = t.replace(/^>\s*/, "");

      result.push(`<blockquote class="border-l-2 border-emerald-500 pl-3 italic text-zinc-400 font-mono my-2">${processInline(content)}</blockquote>`);

      continue;

    }



    // 修复误判：移除了原代码中只要包含 [、\、/ 就强行转成 pre 块的崩坏逻辑

    // 普通文本段落处理

    cL();

    result.push(`<p class="my-1.5">${processInline(l)}</p>`);

  }



  cL();

  return result.join("\n").replace(/%%BLOCK_(\d+)%%/g, (_, i) => blocks[+i] || "");

}



// RAG: 面向中文教材的轻量检索引擎

interface RagChunk {

  text: string;

  tokens: string[];

  uniqueTokens: Set<string>;

  source: string;

  title: string;

  kind: "textbook" | "exam";

}



interface RagIndex {

  chunks: RagChunk[];

  idf: Map<string, number>;

  postings: Map<string, Set<number>>;

}



let _ragCache: RagIndex | null = null;

let _ragCacheKey = "";



function normalizeText(text: string): string {

  return text

    .replace(/\r\n/g, "\n")

    .replace(/[\u3000\t]+/g, " ")

    .replace(/[ ]{2,}/g, " ")

    .replace(/\n{3,}/g, "\n\n")

    .trim();

}



function tokenizeChinese(text: string): string[] {

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



function inferSectionTitle(line: string): string | null {

  const trimmed = line.trim();

  if (!trimmed) return null;

  if (/^(第[一二三四五六七八九十百千0-9]+[章节编部分])|(^[一二三四五六七八九十]+[、.])/u.test(trimmed)) return trimmed.slice(0, 40);

  if (/^(\d+\.|\d+\)|\d+、|\d+\:|\d+：)/.test(trimmed)) return trimmed.slice(0, 40);

  if (/^[A-Z][A-Z0-9\-\s]{3,}$/.test(trimmed)) return trimmed.slice(0, 40);

  if (/^#{1,6}\s/.test(trimmed)) return trimmed.replace(/^#{1,6}\s*/, "").slice(0, 40);

  return null;

}



function splitIntoParagraphs(text: string): string[] {

  return normalizeText(text).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

}



function detectBookName(fileName: string): string {

  const lower = fileName.toLowerCase();

  if (lower.includes("数据结构")) return "数据结构";

  if (lower.includes("组成") || lower.includes("计组")) return "计算机组成原理";

  if (lower.includes("操作系统") || lower.includes("os")) return "操作系统";

  if (lower.includes("计算机网络") || lower.includes("网")) return "计算机网络";

  if (lower.includes("真题") || lower.includes("exam") || lower.includes("历年")) return "408真题";

  return "未分类";

}



async function pickTextbookFolder(): Promise<FileSystemDirectoryHandle | null> {

  const picker = (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;

  if (!picker) return null;

  try {

    return await picker.call(window);

  } catch {

    return null;

  }

}



function isReadableTextFile(name: string): boolean {

  const ext = name.toLowerCase().split('.').pop() || '';

  return READABLE_EXTENSIONS.includes(ext as (typeof READABLE_EXTENSIONS)[number]);

}



async function readFolderFiles(dir: FileSystemDirectoryHandle, basePath = ""): Promise<FolderReadResult> {

  const files: FolderFile[] = [];

  const skipped: string[] = [];

  for await (const [name, handle] of (dir as any)) {

    const fullPath = basePath ? `${basePath}/${name}` : name;

    if (handle.kind === "directory") {

      const children = await readFolderFiles(handle, fullPath);

      files.push(...children.files);

      skipped.push(...children.skipped);

    } else if (handle.kind === "file") {

      if (!isReadableTextFile(name)) {

        skipped.push(`${fullPath}（不支持的格式）`);

        continue;

      }

      const file = await handle.getFile();

      const content = stripTextNoise(await file.text());

      if (!content) {

        skipped.push(`${fullPath}（清洗后为空）`);

        continue;

      }

      files.push({ path: fullPath, name, content });

    }

  }

  return { files, skipped };

}



function buildCorpusFromFolder(files: FolderFile[]): { content: string; fileContents: Record<string, string>; fileKinds: Record<string, "textbook" | "exam">; uploadedFiles: string[]; libraryName: string; libraryPath: string } {

  const fileContents: Record<string, string> = {};

  const fileKinds: Record<string, "textbook" | "exam"> = {};

  const uploadedFiles: string[] = [];

  const rootName = files[0]?.path.split("/")[0] || "教材文件夹";

  const rootPath = rootName;

  for (const file of files) {

    const key = file.path;

    uploadedFiles.push(key);

    fileContents[key] = file.content;

    fileKinds[key] = "textbook";

  }

  return {

    content: buildTextbookCorpus(fileContents),

    fileContents,

    fileKinds,

    uploadedFiles,

    libraryName: rootName,

    libraryPath: rootPath,

  };

}



function stripTextNoise(text: string): string {

  return normalizeText(text)

    .split("\n")

    .filter((line) => {

      const t = line.trim();

      if (!t) return true;

      if (/^\d+\s*\/\s*\d+$/.test(t)) return false;

      if (/^(页码|Page|PAGE)[:：]?\s*\d+/i.test(t)) return false;

      if (/^(版权|Copyright|ISBN)/i.test(t)) return false;

      if (/^(目录|Contents)$/i.test(t)) return false;

      if (/^\.{3,}\s*\d+$/.test(t)) return false;

      if (/^[|\-_=]{5,}$/.test(t)) return false;

      if (/^https?:\/\//i.test(t)) return false;

      return true;

    })

    .join("\n")

    .replace(/\/\/[^\n]*/g, "")

    .replace(/\/\*[\s\S]*?\*\//g, "")

    .replace(/\{\s*\}/g, "")

    .trim();

}



function detectTopicFromText(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim()) || "";
  const title = inferSectionTitle(firstLine);
  return title || "未命名章节";
}



function chunkTextbook(text: string, maxLen = 1200): string[] {
  const paragraphs = splitIntoParagraphs(text);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const cleaned = para.trim();
    if (cleaned.length < 2) continue;
    const next = current ? `${current}\n${cleaned}` : cleaned;
    const isQuestionStart = /(?:^|\n)\s*(?:第\s*[一二三四五六七八九十0-9]+\s*题|\d{1,2}[\.、:)：]|\([0-9]{1,2}\))/.test(cleaned);

    if (current && (next.length > maxLen || isQuestionStart)) {
      chunks.push(current.trim());
      current = cleaned;
      continue;
    }

    if (next.length <= maxLen) {
      current = next;
      continue;
    }

    if (current) chunks.push(current.trim());
    if (cleaned.length <= maxLen) {
      current = cleaned;
    } else {
      const step = Math.max(600, Math.floor(maxLen * 0.7));
      for (let i = 0; i < cleaned.length; i += step) {
        chunks.push(cleaned.slice(i, i + maxLen).trim());
      }
      current = "";
    }
  }

  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}



function chunkCorpusByFile(corpus: string): string[] {

  const fileBlocks = normalizeText(corpus).split(/\n\n--- 文件分隔符 ---\n\n/g).map((block) => block.trim()).filter(Boolean);

  const chunks: string[] = [];



  for (const block of fileBlocks) {

    const lines = block.split("\n");

    const header = lines[0] || "";

    const body = lines.slice(1).join("\n").trim();

    if (!body) continue;



    if (body.length <= 3500) {

      chunks.push(`${header}\n\n${body}`);

      continue;

    }



    const subChunks = chunkTextbook(body, 2200);

    for (const subChunk of subChunks) {

      chunks.push(`${header}\n\n${subChunk}`);

    }

  }



  return chunks;

}



function buildTextbookCorpus(fileContents: Record<string, string>): string {

  const entries = Object.entries(fileContents);

  if (entries.length === 0) return "";



  return entries

    .map(([fileName, content]) => {

      const book = detectBookName(fileName);

      const topic = detectTopicFromText(content);

      const cleaned = stripTextNoise(content);

      return [

        `=== ${book} | ${fileName} | ${topic} ===`,

        "",

        cleaned,

      ].join("\n");

    })

    .join("\n\n--- 文件分隔符 ---\n\n");

}



function toChineseNumberValue(value: string): number | null {

  if (/^\d+$/.test(value)) return Number(value);

  const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

  if (value === "十") return 10;

  if (value.includes("十")) {

    const [left, right] = value.split("十");

    return (left ? map[left] : 1) * 10 + (right ? map[right] : 0);

  }

  return map[value] || null;

}



function normalizeQuestionNo(value: string): string {

  const n = toChineseNumberValue(value.trim());

  if (!n) return value.trim();

  return String(n).padStart(2, "0");

}



function extractSection(text: string): string | undefined {

  return text.match(/\d+(?:\.\d+)+/)?.[0];

}

function isSectionCountQuery(text: string): boolean {
  return /(有几题|有多少题|几道题|多少题|本节几题|这一节几题|这节几题)/.test(text);
}

function extractQuestionNo(text: string): string | undefined {

  if (isSectionCountQuery(text)) return undefined;

  const explicit = text.match(/第\s*([一二三四五六七八九十0-9]+)\s*题/)?.[1];

  if (explicit) return normalizeQuestionNo(explicit);

  const wrapped = text.match(/[（(]\s*([0-9]{1,2})\s*[)）]/)?.[1];

  if (wrapped) return normalizeQuestionNo(wrapped);

  const numbered = text.match(/(?:^|\n)\s*([0-9]{1,2})[\.、:：)](?!\d)/)?.[1];

  if (numbered) return normalizeQuestionNo(numbered);

  return undefined;

}



function inferChunkRole(text: string): LibraryChunk["role"] {

  if (/答案与解析|参考答案|答案解析|解析/.test(text)) return "answer";

  if (/本节试题精选|习题|单项选择题|综合应用题|\n\s*\d{1,2}[\.、]/.test(text)) return "question";

  return "content";

}



function buildLibraryChunks(files: FolderFile[]): LibraryChunk[] {
  const chunks: LibraryChunk[] = [];
  for (const file of files) {
    const book = detectBookName(file.path);
    const title = detectTopicFromText(file.content) || file.name;
    const section = extractSection(file.path) || extractSection(file.content);
    const pieces = file.content.length <= 2500 ? [file.content] : chunkTextbook(file.content, 1200);

    pieces.forEach((piece, index) => {
      const header = `=== ${book} | ${file.path} | ${title} ===`;
      chunks.push({
        id: `${file.path}#${index}`,
        filePath: file.path,
        fileName: file.name,
        book,
        title,
        text: `${header}\n\n${piece}`,
        tokens: tokenizeChinese(`${file.path}\n${title}\n${piece}`),
        section: extractSection(piece) || section,
        questionNo: extractQuestionNo(piece),
        role: inferChunkRole(piece),
      });
    });
  }
  return chunks;
}



function buildExercisePairs(files: FolderFile[], chunks: LibraryChunk[]): ExercisePair[] {
  const pairs: ExercisePair[] = [];

  const questionLike = chunks.filter((chunk) => chunk.role === "question" || /(?:^|\n)\s*(?:第\s*[一二三四五六七八九十0-9]+\s*题|\d{1,2}[\.、:)：]|\([0-9]{1,2}\))/.test(chunk.text));
  const answerLike = chunks.filter((chunk) => chunk.role === "answer" || /答案|解析/.test(chunk.text));

  for (const chunk of questionLike) {
    const section = chunk.section || extractSection(chunk.filePath) || extractSection(chunk.text) || "";
    const qMatches = Array.from(chunk.text.matchAll(/(?:^|\n)\s*(?:第\s*([一二三四五六七八九十0-9]+)\s*题|([0-9]{1,2}))[\.、:)：]?([\s\S]*?)(?=(?:\n\s*(?:第\s*[一二三四五六七八九十0-9]+\s*题|[0-9]{1,2}[\.、:)：]))|$)/g));

    for (const match of qMatches) {
      const rawNo = (match[1] || match[2] || "").trim();
      const questionNo = normalizeQuestionNo(rawNo);
      if (!questionNo) continue;
      const questionBody = (match[3] || "").trim();
      const answerCandidates = answerLike.filter((c) => {
        const cSection = c.section || extractSection(c.filePath) || extractSection(c.text) || "";
        const sectionOk = !section || !cSection || cSection === section || c.filePath.includes(section) || section.includes(cSection) || c.filePath.includes(section.split(".").slice(0, 2).join("."));
        return sectionOk;
      });
      const answer = answerCandidates.find((c) => new RegExp(`(?:^|\\n)\\s*(?:第\\s*)?${questionNo.replace(/^0/, "0?")}(?:\\s*题)?[\\.、:)：]?`).test(c.text)) || answerCandidates.find((c) => new RegExp(`(?:^|\\n)\\s*${questionNo.replace(/^0/, "0?")}[\\.、:)：]?`).test(c.text)) || answerCandidates[0];
      if (!answer) continue;
      const answerLine = answer.text.match(new RegExp(`(?:^|\\n)\\s*(?:第\\s*)?${questionNo.replace(/^0/, "0?")}(?:\\s*题)?[\\.、:)：]?([\\s\\S]*?)(?=\\n\\s*(?:第\\s*[一二三四五六七八九十0-9]+\\s*题|[0-9]{1,2}[\\.、:)：])|$)`))?.[0] || answer.text.slice(0, 1200);
      pairs.push({
        id: `${chunk.filePath}#${section}#${questionNo}#${pairs.length}`,
        section,
        questionNo,
        questionText: questionBody ? `${rawNo}.${questionBody}` : `${rawNo}.`,
        answerText: answerLine.trim(),
        filePath: chunk.filePath,
      });
    }
  }

  return pairs;
}



function findExercisePair(query: string, exercises: ExercisePair[], historyHint = ""): ExercisePair | null {
  const section = extractSection(query) || extractSection(historyHint);
  const questionNo = extractQuestionNo(query);
  if (!questionNo) return null;
  const normalizedSection = section ? section.replace(/[章节节篇部分\s]+/g, "") : "";
  const candidates = exercises.filter((ex) => ex.questionNo === questionNo);
  if (candidates.length === 0) return null;
  if (!normalizedSection || !section) return candidates[0];
  return candidates.find((ex) => {
    const exSection = (ex.section || "").replace(/[章节节篇部分\s]+/g, "");
    return exSection === normalizedSection || ex.filePath.includes(section) || section.includes(exSection);
  }) || candidates[0];
}



function formatRagContext(chunks: RagChunk[]): string {

  return chunks

    .map((chunk, i) => {

      const sourceLine = `【来源 ${i + 1}】${chunk.source}${chunk.title ? ` / ${chunk.title}` : ""}`;

      return `${sourceLine}\n${chunk.text}`;

    })

    .join("\n\n---\n\n");

}



function mergeChunks(...groups: RagChunk[][]): RagChunk[] {

  const seen = new Set<string>();

  const merged: RagChunk[] = [];

  for (const group of groups) {

    for (const chunk of group) {

      const key = `${chunk.source}\n${chunk.title}\n${chunk.text.slice(0, 120)}`;

      if (seen.has(key)) continue;

      seen.add(key);

      merged.push(chunk);

    }

  }

  return merged;

}



function buildLibrarySummary(libraryName: string, files: string[]): string {

  if (files.length === 0) return "当前没有加载教材资料库。";

  const shown = files.slice(0, 30).map((file) => `- ${file}`).join("\n");

  const more = files.length > 30 ? `\n- ……另有 ${files.length - 30} 个文件` : "";

  return `当前已经加载教材资料库：${libraryName || "教材文件夹"}\n已读取 ${files.length} 个文本文件：\n${shown}${more}`;

}



function buildExerciseQueryVariants(query: string, historyHint = ""): string[] {

  const current = normalizeText(query);

  const normalized = normalizeText(`${historyHint}\n${query}`);

  const variants = [normalized, current];

  const isExerciseQuery = /(习题|题|选择题|单项选择|答案|解析|第\s*[一二三四五六七八九十0-9]+\s*题|\b\d{1,2}\b)/.test(normalized);

  if (!isExerciseQuery) return variants;



  variants.push(`${normalized} 答案 解析`);

  variants.push(`${normalized} 答案与解析 单项选择题`);



  const section = current.match(/\d+(?:\.\d+)+/)?.[0] || historyHint.match(/\d+(?:\.\d+)+/)?.[0] || normalized.match(/\d+(?:\.\d+)+/)?.[0];

  if (section) {

    variants.push(`${section} 答案与解析`);

    variants.push(`${section} 本节试题精选 答案 解析`);

  }



  const questionNo = normalized.match(/第\s*([一二三四五六七八九十0-9]+)\s*题/)?.[1] || normalized.match(/\b(\d{1,2})\b/)?.[1];

  if (questionNo) {

    const padded = /^\d$/.test(questionNo) ? `0${questionNo}` : questionNo;

    variants.push(`${padded} 答案 解析`);

    variants.push(`${padded}. 答案 解析`);

  }



  return Array.from(new Set(variants));

}



function buildRagIndexFromLibrary(chunksInput: LibraryChunk[]): RagIndex {

  const chunks: RagChunk[] = chunksInput.map((chunk) => ({

    text: chunk.text,

    tokens: chunk.tokens,

    uniqueTokens: new Set(chunk.tokens),

    source: `${chunk.book} / ${chunk.filePath}`,

    title: chunk.title,

    kind: chunk.role === "answer" ? "exam" : "textbook",

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

    if (set.size < 1) continue;

    idf.set(token, Math.log((total + 1) / (set.size + 1)) + 1);

  }



  return { chunks, idf, postings };

}



function searchRag(query: string, index: RagIndex, topK = 6): RagChunk[] {

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



  const candidateScores = new Map<number, number>();

  const queryBoostTokens = Array.from(new Set(queryTokens.slice(0, 16)));

  for (const token of queryBoostTokens) {

    const postings = index.postings.get(token);

    if (!postings) continue;

    const idf = index.idf.get(token) || 0;

    for (const chunkIndex of postings) {

      candidateScores.set(chunkIndex, (candidateScores.get(chunkIndex) || 0) + idf);

    }

  }



  const candidateIndices = candidateScores.size > 0

    ? Array.from(candidateScores.keys())

    : index.chunks.map((_, i) => i);



  const scored = candidateIndices.map((i) => {

    const chunk = index.chunks[i];

    let dot = 0;

    let chunkNorm = 0;



    const chunkTokenCounts = new Map<string, number>();

    for (const token of chunk.tokens) {

      chunkTokenCounts.set(token, (chunkTokenCounts.get(token) || 0) + 1);

    }



    for (const [token, count] of chunkTokenCounts) {

      const weight = count * (index.idf.get(token) || 0);

      if (weight <= 0) continue;

      chunkNorm += weight * weight;

      const qWeight = queryWeights.get(token);

      if (qWeight) dot += weight * qWeight;

    }



    const overlap = queryBoostTokens.length > 0

      ? queryBoostTokens.filter((t) => chunk.uniqueTokens.has(t)).length / queryBoostTokens.length

      : 0;

    const phraseBonus = normalizedQuery.length >= 4 && chunk.text.includes(normalizedQuery.slice(0, Math.min(8, normalizedQuery.length))) ? 0.18 : 0;

    const headerBonus = chunk.text.startsWith("【") ? 0.06 : 0;

    const cos = queryNorm === 0 || chunkNorm === 0 ? 0 : dot / (Math.sqrt(queryNorm) * Math.sqrt(chunkNorm));

    const score = cos * 0.72 + overlap * 0.18 + phraseBonus + headerBonus;



    return { chunk, score };

  });



  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map((s) => s.chunk);

}



export default function LuluChat({ apiSettings, luluState, onClose, onTasksGenerated }: Props) {

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState("");

  const [loading, setLoading] = useState(false);

  const [textbookContent, setTextbookContent] = useState<string>("");

  const [libraryName, setLibraryName] = useState<string>("");

  const [libraryPath, setLibraryPath] = useState<string>("");

  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const [fileContents, setFileContents] = useState<Record<string, string>>({});

  const [fileKinds, setFileKinds] = useState<Record<string, "textbook" | "exam">>({});

  const [folderLoaded, setFolderLoaded] = useState(false);

  const [folderFiles, setFolderFiles] = useState<FolderFile[]>([]);

  const [libraryChunks, setLibraryChunks] = useState<LibraryChunk[]>([]);

  const [exercisePairs, setExercisePairs] = useState<ExercisePair[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [streamingContent, setStreamingContent] = useState("");

  const [actualModel, setActualModel] = useState<string | null>(null);

  const [modelMismatch, setModelMismatch] = useState(false);

  const [embeddingConnected, setEmbeddingConnected] = useState<boolean | null>(null);

  const [embeddingBuilding, setEmbeddingBuilding] = useState(false);

  const [libraryPanelCollapsed, setLibraryPanelCollapsed] = useState(true);

  const qaBank: QaItem[] = [];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const textbookCorpus = useMemo(() => buildTextbookCorpus(fileContents), [fileContents]);



  useEffect(() => {

    try {

      const saved = localStorage.getItem(TEXTBOOK_STORAGE_KEY);

      if (saved) {

        const data = JSON.parse(saved);

        setTextbookContent(data.content || "");

        setUploadedFiles(data.files || []);

        setFileContents(data.fileContents || {});

        setFileKinds(data.fileKinds || {});

        setLibraryName(data.libraryName || "");

        setLibraryPath(data.libraryPath || "");

        setFolderFiles(data.folderFiles || []);

        setFolderLoaded(Boolean(data.content));

      }

      loadLibrarySnapshot().then((snapshot) => {

        if (!snapshot) return;

        const fileContentsFromDB = Object.fromEntries(snapshot.files.map((file) => [file.path, file.content]));

        setLibraryName(snapshot.libraryName);

        setLibraryPath(snapshot.libraryPath);

        setFolderFiles(snapshot.files);

        setUploadedFiles(snapshot.files.map((file) => file.path));

        setFileContents(fileContentsFromDB);

        setFileKinds(Object.fromEntries(snapshot.files.map((file) => [file.path, "textbook" as const])));

        setLibraryChunks(snapshot.chunks);

        setExercisePairs(snapshot.exercises);

        setTextbookContent(buildTextbookCorpus(fileContentsFromDB));

        setFolderLoaded(snapshot.files.length > 0);

      }).catch(() => {});

    } catch {}

  }, []);



  useEffect(() => {

    if (messages.length === 0) {

      const hasTextbook = textbookCorpus.length > 0;

      setMessages([{

        role: "assistant",

        content: hasTextbook ? "(o.o) 教材已加载！Lulu 准备好帮你复习了！" : "(o.o) 你好！我是 Lulu，你的学习伙伴。你可以上传教材文件，也可以直接问我学习问题！",

      }]);

    }

  }, [textbookCorpus]);



  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  }, [messages, streamingContent]);



  useEffect(() => { inputRef.current?.focus(); }, []);



  const refreshEmbeddingStatus = useCallback(async () => {

    setEmbeddingConnected(null);

    const ok = await checkOllamaEmbedding();

    setEmbeddingConnected(ok);

    return ok;

  }, []);



  useEffect(() => {

    refreshEmbeddingStatus();

  }, [refreshEmbeddingStatus]);



  const loadFolder = useCallback(async () => {

    const dir = await pickTextbookFolder();

    if (!dir) return;

    try {

      const result = await readFolderFiles(dir);

      const files = result.files;

      if (files.length === 0) {

        setError(result.skipped.length > 0

          ? `没有匹配到可导入的文本文件，已跳过 ${result.skipped.length} 个文件。`

          : "这个文件夹里没有找到可读取的文本文件。");

        return;

      }

      const corpusData = buildCorpusFromFolder(files);

      const baseChunks = buildLibraryChunks(files);

      setEmbeddingBuilding(true);

      const embeddingOk = await refreshEmbeddingStatus();

      const chunks = embeddingOk ? await embedChunksLocal(baseChunks) : baseChunks;

      setEmbeddingBuilding(false);

      const exercises = buildExercisePairs(files, chunks);

      setLibraryName(corpusData.libraryName);

      setLibraryPath(corpusData.libraryPath);

      setTextbookContent(corpusData.content);

      setUploadedFiles(corpusData.uploadedFiles);

      setFileContents(corpusData.fileContents);

      setFileKinds(corpusData.fileKinds);

      setLibraryChunks(chunks);

      setExercisePairs(exercises);

      setFolderLoaded(true);

      setFolderFiles(files);

      await saveLibrarySnapshot({

        libraryName: corpusData.libraryName,

        libraryPath: corpusData.libraryPath,

        files,

        chunks,

        exercises,

      });

      localStorage.setItem(TEXTBOOK_STORAGE_KEY, JSON.stringify({

        content: corpusData.content,

        files: corpusData.uploadedFiles,

        fileContents: corpusData.fileContents,

        fileKinds: corpusData.fileKinds,

        libraryName: corpusData.libraryName,

        libraryPath: corpusData.libraryPath,

        folderFiles: files,

      }));

      const skippedSummary = result.skipped.length > 0 ? `，跳过 ${result.skipped.length} 个文件` : "";

      setMessages((prev) => [...prev, { role: "assistant", content: "(o.o) 已加载教材文件夹：" + corpusData.libraryName + "，共读取 " + files.length + " 个文件" + skippedSummary + "。Lulu 现在只读取这个资料库。" }]);

      if (embeddingOk) {

        setEmbeddingConnected(true);

      }

    } catch {

      setEmbeddingBuilding(false);

      setError("文件夹读取失败，请重试。");

      setTimeout(() => setError(null), 3000);

    }

  }, [refreshEmbeddingStatus]);



  const deleteFile = useCallback((fileName: string) => {

    const newFileContents = { ...fileContents };

    delete newFileContents[fileName];

    const newFileKinds = { ...fileKinds };

    delete newFileKinds[fileName];

    const newFiles = uploadedFiles.filter((f) => f !== fileName);

    const newFolderFiles = folderFiles.filter((f) => f.path !== fileName);

    const newCorpus = buildTextbookCorpus(newFileContents);

    setFileContents(newFileContents);

    setFileKinds(newFileKinds);

    setUploadedFiles(newFiles);

    setFolderFiles(newFolderFiles);

    setTextbookContent(newCorpus);

    localStorage.setItem(TEXTBOOK_STORAGE_KEY, JSON.stringify({ content: newCorpus, files: newFiles, fileContents: newFileContents, fileKinds: newFileKinds, libraryName, libraryPath, folderFiles: newFolderFiles }));

    setMessages((prev) => [...prev, { role: "assistant", content: "(o.o) 已删除文件「" + fileName + "」" }]);

  }, [fileContents, fileKinds, uploadedFiles, folderFiles, libraryName, libraryPath]);



  const clearTextbooks = useCallback(() => {

    setTextbookContent("");

    setUploadedFiles([]);

    setFileContents({});

    setFileKinds({});

    setFolderFiles([]);

    setLibraryChunks([]);

    setExercisePairs([]);

    clearLibrarySnapshot().catch(() => {});

    localStorage.removeItem(TEXTBOOK_STORAGE_KEY);

    setMessages((prev) => [...prev, { role: "assistant", content: "(o.o) 教材已清除！" }]);

  }, []);



  const sendMessage = useCallback(async () => {

    const text = input.trim();

    if (!text || loading) return;

    setInput("");

    setError(null);

    const userMsg: ChatMessage = { role: "user", content: text };

    const newMessages = [...messages, userMsg];

    setMessages(newMessages);

    setLoading(true);

    setStreamingContent("");

    setActualModel(null);

    setModelMismatch(false);



    try {

      let responseText = "";



      // Standard mode only

      const librarySummary = buildLibrarySummary(libraryName, uploadedFiles);

      const embeddingSummary = `Embedding 状态：${embeddingConnected === true ? `已连接 ${EMBEDDING_MODEL}` : embeddingConnected === false ? "未连接" : "检测中"}${embeddingBuilding ? " / 构建中" : ""}`;

      const sysMessages: ChatMessage[] = [

        { role: "system", content: SYSTEM_PROMPT },

        {

          role: "system",

          content: "资料库状态如下。你必须承认并使用这个状态，不要说用户没有上传/没有提供文件。若用户问“你是读取我的文件知道的吗/资料库里有什么/第几章有几节”，应优先根据资料库状态和检索内容回答：\n\n" + librarySummary + "\n\n" + embeddingSummary,

        },

      ];




      let structuredContext = "";
      let responseDirective = "";
      let qaHit = false;
      let directAnswer = "";
      // === PATH A: Structured question bank from JSON (stable source of truth) ===
      if (qaBank.length > 0) {
        const recentCtx = newMessages
          .filter((m: any) => m.role === "user")
          .slice(-4)
          .map((m: any) => m.content)
          .join("\n");

        const qaSection = extractSection(text) || extractSection(recentCtx);
        const qaQuestionNo = isSectionCountQuery(text) ? undefined : extractQuestionNo(text);
        const normalizedSection = qaSection ? qaSection.replace(/[^0-9.]/g, "") : "";
        const sectionQs = normalizedSection
          ? qaBank.filter((q: any) => (q.section || "").replace(/[^0-9.]/g, "") === normalizedSection)
          : [];
        const sectionTypes = (items: QaItem[]) => {
          const types: Record<string, number> = {};
          items.forEach((q: any) => { types[q.type] = (types[q.type] || 0) + 1; });
          return Object.entries(types).map(([k, v]) => `${v} ${k}`).join("; ");
        };

        if (normalizedSection && qaQuestionNo) {
          const hit = sectionQs.find((q: any) => q.questionNo === qaQuestionNo);
          if (hit) {
            console.debug("[Lulu] PATH_A exact hit:", hit.section, "#", hit.questionNo);
            structuredContext = `【结构化习题命中】${hit.section} 第${hit.questionNo}题\n题干：${hit.questionText}\n答案与解析：${hit.answerText}`;
            responseDirective = "请基于材料回答这道题。要有自己的理解，但不得改动标准答案；按“答案 → 教材依据 → 简要解释/易错点”输出。";
            directAnswer = hit.answerText;
            qaHit = true;
          }
        } else if ((normalizedSection && !qaQuestionNo && sectionQs.length > 0) || (isSectionCountQuery(text) && normalizedSection && sectionQs.length > 0)) {
          const typeSummary = sectionTypes(sectionQs);
          console.debug("[Lulu] PATH_A section summary:", normalizedSection, sectionQs.length, "questions");
          const questionNos = [...new Set(sectionQs.map((q: any) => q.questionNo))].sort((a, b) => Number(a) - Number(b));
          structuredContext = `【章节题目统计】${normalizedSection} 共 ${sectionQs.length} 题\n题号：${questionNos.join("、")}\n题型：${typeSummary || "未分类"}`;
          responseDirective = "请直接给出章节题目统计结果，不要编造题目，不要解释检索过程。";
          qaHit = true;
        } else if (!normalizedSection && qaQuestionNo) {
          const matches = qaBank.filter((q: any) => q.questionNo === qaQuestionNo);
          if (matches.length === 1) {
            const hit = matches[0];
            console.debug("[Lulu] PATH_A solo match:", hit.section, "#", hit.questionNo);
            structuredContext = `【结构化习题命中】${hit.section} 第${hit.questionNo}题\n题干：${hit.questionText}\n答案与解析：${hit.answerText}`;
            responseDirective = "请直接回答这道题。按“答案 → 教材依据 → 简要解释/易错点”输出，不要复述检索过程。";
            qaHit = true;
          } else if (matches.length > 1) {
            const sections = [...new Set(matches.map((q: any) => q.section))].slice(0, 10);
            structuredContext = `题号 ${qaQuestionNo} 在题库中有 ${matches.length} 处命中：${sections.join("、")}。请再补充章节号，我再帮你精确定位。`;
            responseDirective = "如果用户没有补充章节号，请先说明该题号在多个章节都出现，要求用户补充章节号。";
            qaHit = true;
          }
        }
      }

      if (qaHit && structuredContext) {
        sysMessages.push({ role: "system", content: `${responseDirective}\n\n${structuredContext}` });
      }

      if (!qaHit && (libraryChunks.length > 0 || textbookCorpus)) {
        const recentUserContext = newMessages
          .filter((msg) => msg.role === "user")
          .slice(-4)
          .map((msg) => msg.content)
          .join("\n");

        const chunksForIndex = libraryChunks.length > 0 ? libraryChunks : buildLibraryChunks(folderFiles);
        const isExerciseQ = /\d+\.\d+|第\s*[一二三四五六七八九十0-9]+\s*题/.test(recentUserContext + text);
        const searchChunks = isExerciseQ ? chunksForIndex : chunksForIndex.filter((c: any) => c.role !== "question" && c.role !== "answer");
        const effectiveChunks = searchChunks.length > 0 ? searchChunks : chunksForIndex;

        const cacheKey = `${libraryName}:${effectiveChunks.length}:${uploadedFiles.join("|")}`;
        if (_ragCacheKey !== cacheKey) { _ragCache = buildRagIndexFromLibrary(effectiveChunks); _ragCacheKey = cacheKey; }

        const directExercise = findExercisePair(text, exercisePairs, recentUserContext);
        const queryVariants = buildExerciseQueryVariants(text, recentUserContext);
        const chunkGroups = _ragCache ? queryVariants.map((query) => searchRag(query, _ragCache!, 6)) : [];

        const shouldUseEmbedding = !isSectionCountQuery(text) && !directExercise && !extractQuestionNo(text);
        const queryEmbedding = shouldUseEmbedding ? await embedQueryLocal(`${recentUserContext}\n${text}`) : null;
        const semanticChunks = queryEmbedding ? searchByEmbedding(queryEmbedding, effectiveChunks, 4) : [];
        const relevantChunks = mergeChunks(...chunkGroups, semanticChunks).slice(0, 8);

        const exerciseContext = directExercise
          ? `【结构化习题命中】${directExercise.section} 第${directExercise.questionNo}题\n题干：${directExercise.questionText}\n答案与解析：${directExercise.answerText}\n来源：${directExercise.filePath}\n\n---\n\n`
          : "";

        const context = relevantChunks.length > 0
          ? exerciseContext + formatRagContext(relevantChunks).slice(0, RAG_CONTEXT_LIMIT)
          : exerciseContext + textbookCorpus.slice(0, RAG_CONTEXT_LIMIT);

        sysMessages.push({
          role: "system",
          content: "以下是从教材库中检索到的相关内容。若出现【结构化习题命中】，必须优先按其中的题干和答案与解析回答。若用户问习题、选择题、答案或解析，优先使用教材中的“答案与解析/解析/答案”。若用户只说“第2题/第四题/这章第几题”，请结合最近对话中的章节号理解。回答必须简短，默认不超过300字，结构为：答案 → 教材依据 → 简要解释/易错点。\n\n" + context,
        });
      }

     

      const allMessages = [...sysMessages, ...newMessages];

      const endpoint = apiSettings.endpoint.replace(/\/+$/, "");

      const resp = await fetch(endpoint + "/chat/completions", {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          "Authorization": "Bearer " + apiSettings.key,

        },

        body: JSON.stringify({

          model: apiSettings.model || "gpt-4o-mini",

          messages: allMessages,

          stream: true,

          max_tokens: 4096,

        }),

      });



      if (!resp.ok) {

        const errText = await resp.text();

        throw new Error("API (" + resp.status + "): " + errText.substring(0, 200));

      }



      const reader = resp.body?.getReader();

      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();

      let buffer = "";



      while (true) {

        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");

        buffer = lines.pop() || "";

        for (const line of lines) {

          const trimmed = line.trim();

          if (!trimmed || trimmed === "data: [DONE]") continue;

          if (!trimmed.startsWith("data: ")) continue;

          try {

            const json = JSON.parse(trimmed.slice(6));

            // 检测 API 实际使用的模型名称

            if (!actualModel && json.model) {

              setActualModel(json.model);

            }

            const delta = json.choices?.[0]?.delta?.content || "";

            responseText += delta;

            setStreamingContent(responseText);

          } catch {}

        }

      }



      // 模型一致性检测

      let modelDiagNote = "";

      if (actualModel) {

        const configuredModel = apiSettings.model || "gpt-4o-mini";

        const actualLower = actualModel.toLowerCase();

        const configuredLower = configuredModel.toLowerCase();

        if (actualLower !== configuredLower && !actualLower.includes(configuredLower) && !configuredLower.includes(actualLower)) {

          setModelMismatch(true);

          modelDiagNote = "\n\n> :warning: **模型检测**: 配置为 `" + configuredModel + "`，但 API 实际使用了 `" + actualModel + "`。请检查 API 设置。";

        }

      }



      const tasks = parseTaskPlan(responseText);

      if (tasks) {

        onTasksGenerated(tasks);

        const displayText = responseText.replace(/\[TASK_PLAN\][\s\S]*?\[\/TASK_PLAN\]/g, "").trim();

        const note = displayText

          ? displayText + "\n\n_(o.o) 任务已添加到任务列表_"

          : "(o.o) 任务已添加到任务列表";

        setMessages((prev) => [...prev, { role: "assistant", content: note + modelDiagNote }]);

      } else {

        setMessages((prev) => [...prev, { role: "assistant", content: responseText + modelDiagNote }]);

      }

    } catch (err: any) {

      setError(err.message || "发送失败，请检查 API 配置。");

      setTimeout(() => setError(null), 5000);

    } finally {

      setLoading(false);

      setStreamingContent("");

    }

  }, [input, messages, loading, apiSettings, textbookContent, onTasksGenerated]);



  const handleKeyDown = (e: React.KeyboardEvent) => {

    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }

  };



  return (

    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-md p-2 sm:p-6" onClick={onClose}>

      <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-[linear-gradient(180deg,var(--bg2),var(--bg))] shadow-2xl" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-3 sm:px-5 sm:py-4 shrink-0">

          <div className="flex items-center gap-3 min-w-0">

            <div className="w-10 h-10 flex items-center justify-center shrink-0 rounded-2xl border border-zinc-800 bg-zinc-950/60">

              <div style={{ transform: "scale(0.8)" }}>

                <Lulu state={luluState || "peaceful"} onClick={() => {}} />

              </div>

            </div>

            <div className="min-w-0">

              <h2 className="truncate text-sm font-bold text-zinc-100 font-mono">Lulu{luluState ? ` (${LULU_STATE_LABELS[luluState]})` : ""}</h2>

              <p className="truncate text-[10px] text-zinc-500 font-mono">

                {textbookContent ? "教材已加载 (" + uploadedFiles.length + " 个文件)" : `水豚助手${luluState ? " • " + LULU_STATE_LABELS[luluState] : ""}`}

                {actualModel && !modelMismatch && <span className="text-[9px] text-emerald-400/70 font-mono ml-1">(API: {actualModel})</span>}

                {modelMismatch && <span className="text-[9px] text-amber-400 font-mono ml-1">(API: {actualModel} ≠ 配置)</span>}

              </p>

            </div>

          </div>

          <div className="flex items-center gap-2 shrink-0">

            {textbookContent && (

              <button onClick={clearTextbooks} className="p-2 text-zinc-500 hover:text-red-400 rounded-xl hover:bg-zinc-800 transition-colors" title="清除资料库">

                <Trash2 className="w-4 h-4" />

              </button>

            )}

            <button onClick={loadFolder} className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors" title="选择教材文件夹">

              <FolderOpen className="w-4 h-4" />

            </button>

            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors">

              <X className="w-4 h-4" />

            </button>

          </div>

        </div>



        <div className="px-4 sm:px-5 py-2 border-b border-zinc-800 bg-zinc-900/40 text-xs font-mono text-zinc-500 space-y-1.5">

          <div className="flex items-center justify-between gap-3">

            <button

              onClick={() => setLibraryPanelCollapsed((v) => !v)}

              className="inline-flex items-center gap-1 text-left hover:text-zinc-300 transition-colors"

              title="折叠/展开资料状态"

            >

              {libraryPanelCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}

              <span>{folderLoaded ? `已加载 ${uploadedFiles.length} 个文件` : "尚未选择教材文件夹"}</span>

            </button>

            <span className="inline-flex items-center gap-1">

              <span className={`inline-block w-1.5 h-1.5 rounded-full ${

                embeddingConnected === true ? "bg-emerald-400"

                : embeddingConnected === false ? "bg-amber-400"

                : "bg-zinc-500 animate-pulse"

              }`} />

              {embeddingConnected === true

                ? `Embedding 已连接 (${EMBEDDING_MODEL})`

                : embeddingConnected === false

                ? "Embedding 未连接"

                : "Embedding 检测中..."}

              {embeddingBuilding && <span className="text-emerald-400/70">· 向量构建中...</span>}

              <button onClick={refreshEmbeddingStatus} className="ml-1 text-zinc-600 hover:text-zinc-400 transition-colors" title="重新检测 Embedding">

                <RefreshCw className="w-3 h-3" />

              </button>

            </span>

          </div>

        </div>



        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5 space-y-4 bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,var(--accent)_8%,transparent),transparent_35%)]">

          {messages.map((msg, i) => (

            <div key={i} className={"flex gap-3 " + (msg.role === "user" ? "justify-end" : "justify-start")}>

              {msg.role === "assistant" && (

                <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center shrink-0">

                  <div style={{ transform: "scale(0.7)" }}>

                    <Lulu state={luluState || "peaceful"} onClick={() => {}} />

                  </div>

                </div>

              )}

              <div className={"max-w-[75%] rounded-xl p-3 text-sm leading-relaxed " + (msg.role === "user" ? "bg-emerald-600 text-emerald-50 rounded-tr-md" : "bg-zinc-800/80 text-zinc-200 rounded-tl-md border border-zinc-700/50")}>

                <div className="prose prose-invert prose-sm lulu-rendered max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />

              </div>

              {msg.role === "user" && (

                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">

                  <User className="w-4 h-4 text-zinc-400" />

                </div>

              )}

            </div>

          ))}

          {loading && streamingContent && (

            <div className="flex gap-3 justify-start">

              <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center shrink-0">

                <div style={{ transform: "scale(0.7)" }}>

                  <Lulu state={luluState || "peaceful"} onClick={() => {}} />

                </div>

              </div>

              <div className="max-w-[75%] rounded-xl p-3 text-sm leading-relaxed bg-zinc-800/80 text-zinc-200 rounded-tl-md border border-zinc-700/50">

                <div className="prose prose-invert prose-sm lulu-rendered max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />

                <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1" />

              </div>

            </div>

          )}

          {loading && !streamingContent && (

            <div className="flex gap-3 justify-start">

              <div className="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center shrink-0">

                <div style={{ transform: "scale(0.7)" }}>

                  <Lulu state={luluState || "peaceful"} onClick={() => {}} />

                </div>

              </div>

              <div className="rounded-xl p-3 bg-zinc-800/80 border border-zinc-700/50 flex items-center gap-2">

                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />

                <span className="text-xs text-zinc-400 font-mono">Lulu 思考中...</span>

              </div>

            </div>

          )}

          <div ref={messagesEndRef} />

        </div>



        {error && (

          <div className="px-4 py-2 bg-red-950/30 border-t border-red-900/50">

            <p className="text-xs text-red-400 font-mono">{"> " + error}</p>

          </div>

        )}



        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-900/50 shrink-0 space-y-2">

          <div className="flex gap-2">

            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}

              placeholder="..."

              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-500 resize-none font-mono placeholder:text-zinc-600"

              rows={1} style={{ minHeight: "42px", maxHeight: "120px" }}

            />

            <button onClick={sendMessage} disabled={!input.trim() || loading}

              className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-emerald-50 transition-colors self-end">

              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}

            </button>

          </div>

          <p className="text-[10px] text-zinc-600 mt-2 font-mono text-center">Enter  Shift+Enter </p>

        </div>

      </div>

    </div>

  );

}
