import { useState, useRef, useEffect, useCallback } from "react";
import { ApiSettings, TaskDef, ChatMessage, LuluState } from "../types";
import { X, Send, Upload, BookOpen, FileText, User, Loader2, Paperclip, Trash2 } from "lucide-react";
import Lulu from "./Lulu";

const LULU_STATE_LABELS: Record<LuluState, string> = {
  peaceful: "平静",
  happy: "开心",
  thinking: "思考中",
  proud: "骄傲",
  alert: "警觉",
};

interface Props {
  apiSettings: ApiSettings;
  luluState?: LuluState;
  onClose: () => void;
  onTasksGenerated: (tasks: TaskDef[]) => void;
}

const TEXTBOOK_STORAGE_KEY = "lulu_textbook_content";

const SYSTEM_PROMPT = `你是 Lulu，一个帮助 408 考研的监督学习伙伴，性格像水獭 (o.o)
1. 使用温和且鼓励的语气回答学习相关问题，必要时提供步骤化解答。
2. 当用户上传教材时，优先基于教材内容作答，并指出来源段落或页码（若可行）。
3. 给出练习建议、典型错题解析或解题思路时，保持简洁并列出关键步骤。
4. 回答中可适度使用表情符号以提高亲和力，但不要影响专业性。

当需要为用户规划学习任务时，请在回复末尾输出一个任务规划块（机器可读 JSON），格式如下：

[TASK_PLAN]
[{"title":"任务标题","description":"任务描述","estimatedMinutes":90}]
[/TASK_PLAN]
`;

// 说明：以上为系统提示文本，不需要额外重复的说明块。

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
        estimatedMinutes: t.estimatedMinutes || 30,
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
    const processInline = (str: string) => str.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

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

// RAG: TF-IDF 检索引擎
interface RagIndex {
  chunks: string[];
  vocabulary: Map<string, number>;
  idf: number[];
  tfidf: number[][];
}

let _ragCache: RagIndex | null = null;
let _ragCacheKey = "";

function tokenizeChinese(text: string): string[] {
  const m = text.match(/[\u4e00-\u9fff]|[a-zA-Z0-9]+/g);
  return m || [];
}

function chunkTextbook(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 30) continue;
    if (trimmed.length <= 600) {
      current = current ? current + "\n" + trimmed : trimmed;
    } else {
      if (current) chunks.push(current);
      current = trimmed;
    }
    if (current.length > 600) { chunks.push(current); current = ""; }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildRagIndex(text: string): RagIndex {
  const chunks = chunkTextbook(text);
  if (chunks.length === 0) return { chunks: [], vocabulary: new Map(), idf: [], tfidf: [] };
  const docFreq = new Map<string, number>();
  const chunkTokens: string[][] = [];
  for (const chunk of chunks) {
    const tokens = tokenizeChinese(chunk);
    chunkTokens.push(tokens);
    const unique = new Set(tokens);
    for (const t of unique) { docFreq.set(t, (docFreq.get(t) || 0) + 1); }
  }
  const vocabulary = new Map<string, number>();
  let idx = 0;
  for (const [term, df] of docFreq) {
    if (df >= 2) { vocabulary.set(term, idx++); }
  }
  const N = chunks.length;
  const idf: number[] = new Array(idx).fill(0);
  for (const [term, vi] of vocabulary) {
    idf[vi] = Math.log((N + 1) / ((docFreq.get(term) || 1) + 1)) + 1;
  }
  const tfidf: number[][] = chunks.map(() => new Array(idx).fill(0));
  for (let i = 0; i < chunks.length; i++) {
    const termFreq = new Map<string, number>();
    for (const t of chunkTokens[i]) { termFreq.set(t, (termFreq.get(t) || 0) + 1); }
    for (const [term, tf] of termFreq) {
      const vi = vocabulary.get(term);
      if (vi !== undefined) { tfidf[i][vi] = tf * idf[vi]; }
    }
  }
  return { chunks, vocabulary, idf, tfidf };
}

function searchRag(query: string, index: RagIndex, topK = 8): string[] {
  if (index.chunks.length === 0) return [];
  if (!query.trim()) return index.chunks.slice(0, topK);
  const queryTokens = tokenizeChinese(query);
  const queryVec = new Array(index.idf.length).fill(0);
  const termFreq = new Map<string, number>();
  for (const t of queryTokens) { termFreq.set(t, (termFreq.get(t) || 0) + 1); }
  for (const [term, tf] of termFreq) {
    const vi = index.vocabulary.get(term);
    if (vi !== undefined) { queryVec[vi] = tf * index.idf[vi]; }
  }
  const scored = index.tfidf.map((vec, i) => {
    let dot = 0, normA = 0, normB = 0;
    for (let j = 0; j < vec.length; j++) { dot += vec[j] * queryVec[j]; normA += vec[j] * vec[j]; normB += queryVec[j] * queryVec[j]; }
    return { chunk: index.chunks[i], score: (normA === 0 || normB === 0) ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB)) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.chunk);
}

export default function LuluChat({ apiSettings, luluState, onClose, onTasksGenerated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [textbookContent, setTextbookContent] = useState<string>("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [actualModel, setActualModel] = useState<string | null>(null);
  const [modelMismatch, setModelMismatch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEXTBOOK_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setTextbookContent(data.content || "");
        setUploadedFiles(data.files || []);
        setFileContents(data.fileContents || {});
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      const hasTextbook = textbookContent.length > 0;
      setMessages([{
        role: "assistant",
        content: hasTextbook ? "(o.o) 教材已加载！Lulu 准备好帮你复习了！" : "(o.o) 你好！我是 Lulu，你的学习伙伴。你可以上传教材文件，也可以直接问我学习问题！",
      }]);
    }
  }, [textbookContent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".js", ".ts", ".py", ".css"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(ext) && !file.type.startsWith("text/")) {
      setError("目前只支持文本文件：.txt, .md, .csv 等，PDF 文件请通过 AnythingLLM 上传");
      setTimeout(() => setError(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    try {
      const content = await file.text();
      const newContent = textbookContent
        ? textbookContent + "\n\n--- 以下是上传的教材文件: " + file.name + " ---\n\n" + content
        : "=== 教材文件: " + file.name + " ===\n\n" + content;
      setTextbookContent(newContent);
      const newFiles = [...uploadedFiles, file.name];
      setUploadedFiles(newFiles);
      const newFileContents = { ...fileContents, [file.name]: content };
      setFileContents(newFileContents);
      localStorage.setItem(TEXTBOOK_STORAGE_KEY, JSON.stringify({ content: newContent, files: newFiles, fileContents: newFileContents }));
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "(o.o) 已读取教材文件：" + file.name + "，已加载到 Lulu 的知识库。现在可以问我关于教材的问题了。",
      }]);
    } catch {
      setError("文件读取失败，请重试。");
      setTimeout(() => setError(null), 3000);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [textbookContent, uploadedFiles, fileContents]);

  const deleteFile = useCallback((fileName: string) => {
    const newFileContents = { ...fileContents };
    delete newFileContents[fileName];
    setFileContents(newFileContents);
    const newFiles = uploadedFiles.filter(f => f !== fileName);
    setUploadedFiles(newFiles);
    const entries = Object.entries(newFileContents);
    let reconstructed = "";
    for (let i = 0; i < entries.length; i++) {
      if (i > 0) reconstructed += "\n\n--- 文件分隔符: " + entries[i][0] + " ---\n\n";
      reconstructed += "=== 文件: " + entries[i][0] + " ===\n\n" + entries[i][1];
    }
    setTextbookContent(reconstructed);
    localStorage.setItem(TEXTBOOK_STORAGE_KEY, JSON.stringify({ content: reconstructed, files: newFiles, fileContents: newFileContents }));
    setMessages((prev) => [...prev, { role: "assistant", content: "(o.o) 已删除文件「" + fileName + "」" }]);
  }, [fileContents, uploadedFiles]);

  const clearTextbooks = useCallback(() => {
    setTextbookContent("");
    setUploadedFiles([]);
    setFileContents({});
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
      const sysMessages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
      ];

      if (textbookContent) {
        if (_ragCacheKey !== textbookContent) { _ragCache = buildRagIndex(textbookContent); _ragCacheKey = textbookContent; }
        const relevantChunks = _ragCache ? searchRag(text, _ragCache, 8) : [];
        const context = relevantChunks.length > 0
          ? relevantChunks.join("\n\n---\n\n")
          : textbookContent.slice(0, 30000);
        
        sysMessages.push({
          role: "system",
          content: "以下是教材中与你的问题最相关的内容：\n\n" + context,
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl h-[80vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center">
              <div style={{ transform: "scale(0.8)" }}>
                <Lulu state={luluState || "peaceful"} onClick={() => {}} />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100 font-mono">Lulu{luluState ? ` (${LULU_STATE_LABELS[luluState]})` : ""}</h2>
              <p className="text-[10px] text-zinc-500 font-mono">
                {textbookContent ? "教材已加载 (" + uploadedFiles.length + " 个文件)" : `水獭助手${luluState ? " • " + LULU_STATE_LABELS[luluState] : ""}`}
                {actualModel && !modelMismatch && <span className="text-[9px] text-emerald-400/70 font-mono ml-1">(API: {actualModel})</span>}
                {modelMismatch && <span className="text-[9px] text-amber-400 font-mono ml-1">(API: {actualModel} ≠ 配置)</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {textbookContent && (
              <button onClick={clearTextbooks} className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors" title="清除教材">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setShowUpload(!showUpload)} className={"p-1.5 rounded-lg transition-colors " + (showUpload ? "text-emerald-400 bg-emerald-950/30" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800")} title="上传教材">
              <Upload className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showUpload && (
          <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono text-zinc-400">上传教材文件</span>
            </div>
            <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json,.xml,.html,.js,.ts,.py" onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full p-2.5 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors text-xs font-mono">
              <Paperclip className="w-4 h-4 inline mr-1" /> 选择文件 (.txt, .md, .csv...)
            </button>
            {uploadedFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {uploadedFiles.map((f, i) => (
                  <span key={i} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono inline-flex items-center gap-1">
                    <FileText className="w-3 h-3 inline" />{f}
                    <button onClick={(e) => { e.stopPropagation(); deleteFile(f); }} className="ml-0.5 text-zinc-500 hover:text-red-400 transition-colors" title="删除文件">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 shrink-0">
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