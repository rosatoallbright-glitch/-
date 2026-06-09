// 聊天路由 —— 服务端 RAG 流水线
import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseQuestion } from "../rag_pipeline/questionParser";
import { buildRagIndex, retrieve, RagIndex, LibraryChunkLike } from "../rag_pipeline/retrieval";
import { lookupQaBank } from "../rag_pipeline/factLock";
import { buildSystemPrompt } from "../rag_pipeline/promptBuilder";
import { loadAllTextbooks, buildChunksFromTextbooks } from "../rag_pipeline/textbookLoader";
import type { QaItem, ChatMessage } from "../rag_pipeline/types";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QA_PATH = path.join(__dirname, "..", "data", "textbook_qa_all.json");
const SYSTEM_PROMPT = `你是 Lulu，408 考研学习助手。根据教材检索内容回答，不改动标准答案和题号。语气温和(o.o)，回答控制在300字以内。`;

let qaBank: QaItem[] = [];
let ragIndex: RagIndex | null = null;
let chunks: LibraryChunkLike[] = [];

function initPipeline() {
  try {
    if (fs.existsSync(QA_PATH)) qaBank = JSON.parse(fs.readFileSync(QA_PATH, "utf-8"));
    const textbooks = loadAllTextbooks();
    chunks = buildChunksFromTextbooks(textbooks);
    if (chunks.length > 0) ragIndex = buildRagIndex(chunks);
    console.log(`RAG 初始化：${qaBank.length} 题, ${chunks.length} chunks`);
  } catch (e) { console.error("RAG 初始化失败:", e); }
}
initPipeline();

router.post("/", async (req: Request, res: Response) => {
  const { text, history, apiSettings } = req.body;
  if (!text || !apiSettings?.endpoint || !apiSettings?.key) {
    return res.status(400).json({ error: "缺少 text 或 apiSettings" });
  }

  const historyHint = (history || []).filter((m: ChatMessage) => m.role === "user").slice(-4).map((m: ChatMessage) => m.content).join("\n");
  const parsed = parseQuestion(text, historyHint);
  const factResult = lookupQaBank(parsed, qaBank);
  const retrievedChunks = !factResult.hit && ragIndex ? retrieve(parsed, ragIndex, chunks, null) : [];
  const promptMsgs = buildSystemPrompt({ parsed, factResult, chunks: retrievedChunks });

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `已加载 ${chunks.length} 个教材块，${qaBank.length} 道题库。` },
    ...promptMsgs,
    ...(history || []).slice(-10),
  ];

  try {
    const endpoint = apiSettings.endpoint.replace(/\/+$/, "");
    const resp = await fetch(endpoint + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiSettings.key },
      body: JSON.stringify({ model: apiSettings.model || "gpt-4o-mini", messages, stream: true, max_tokens: 4096 }),
    });
    if (!resp.ok) { const err = await resp.text(); return res.status(resp.status).send(err); }
    res.setHeader("Content-Type", "text/event-stream");
    const reader = resp.body?.getReader();
    if (!reader) return res.status(500).send("No stream");
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
