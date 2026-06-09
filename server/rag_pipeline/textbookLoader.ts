// 教材加载器 —— 从 server/assets/教材库/ 加载所有教材
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { LibraryChunkLike, tokenizeChinese, normalizeText } from "./retrieval";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LoadedTextbook {
  filePath: string;
  fileName: string;
  content: string;
  book: string;
}

const TEXTBOOK_DIR = path.join(__dirname, "..", "assets", "教材库");

function detectBookName(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.includes("数据结构")) return "数据结构";
  if (lower.includes("组成") || lower.includes("计组")) return "计算机组成原理";
  return "未分类";
}

function chunkText(text: string, maxLen = 1200): string[] {
  const paragraphs = normalizeText(text).split(/\n{2,}/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    const next = current ? current + "\n" + para : para;
    if (next.length <= maxLen) {
      current = next;
      continue;
    }
    if (current) chunks.push(current.trim());
    current = para.length <= maxLen ? para : para.slice(0, maxLen);
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

export function loadAllTextbooks(): LoadedTextbook[] {
  const result: LoadedTextbook[] = [];
  if (!fs.existsSync(TEXTBOOK_DIR)) return result;
  const dirs = fs.readdirSync(TEXTBOOK_DIR);
  for (const dir of dirs) {
    const dirPath = path.join(TEXTBOOK_DIR, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".txt"));
    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
      result.push({
        filePath,
        fileName: file,
        content: normalizeText(content),
        book: detectBookName(file),
      });
    }
  }
  return result;
}

export function buildChunksFromTextbooks(textbooks: LoadedTextbook[]): LibraryChunkLike[] {
  const chunks: LibraryChunkLike[] = [];
  for (const tb of textbooks) {
    const pieces = tb.content.length <= 2500 ? [tb.content] : chunkText(tb.content);
    for (let i = 0; i < pieces.length; i++) {
      const header = "=== " + tb.book + " | " + tb.filePath + " ===";
      const text = header + "\n\n" + pieces[i];
      chunks.push({
        text,
        tokens: tokenizeChinese(tb.filePath + "\n" + pieces[i]),
        source: tb.book + " / " + tb.filePath,
        title: tb.fileName,
        kind: /答案|解析/.test(pieces[i]) ? "exam" as const : "textbook" as const,
      });
    }
  }
  return chunks;
}
