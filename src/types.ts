export type TaskStatus = "pending" | "active" | "completed" | "failed";
export type LuluState = "peaceful" | "happy" | "thinking" | "proud";
export type Theme = "dark" | "light";

// --- 意图分类 ---
export type UserIntent = "count" | "locate" | "knowledge" | "fuzzy" | "mixed";

// --- 解析后的用户问题统一结构（四层架构第一层输入） ---
export interface ParsedQuestion {
  rawText: string;
  section?: string;
  chapter?: string;
  topic?: string;
  questionNos: string[];
  intent: UserIntent;
  needAnswer: boolean;
  needExplanation: boolean;
  isMultiQuestion: boolean;
  isCountQuery: boolean;
  historyHint: string;
}

export interface TaskDef {
  id: string;
  title: string;
  status: TaskStatus;
  description: string;
  url?: string;
}

export interface NotebookEntry {
  id: string;
  subject: string;
  chapter: string;
  content: string;
  createdAt: string;
}

export interface DailyRecord {
  date: string;
  tasks: Array<{
    taskId: string;
    taskTitle?: string;
    completed: boolean;
    note?: string;
  }>;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ApiSettings {
  key: string;
  endpoint: string;
  model: string;
}

// --- API 设置和主题保留在 localStorage（不含敏感数据进数据库） ---

export function loadApiSettings(): ApiSettings {
  try {
    const raw = localStorage.getItem("kaoyan_api_settings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { key: "", endpoint: "https://api.openai.com/v1", model: "gpt-4o-mini" };
}

export function saveApiSettings(s: ApiSettings) {
  localStorage.setItem("kaoyan_api_settings", JSON.stringify(s));
}

export function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem("kaoyan_theme");
    if (raw === "light" || raw === "dark") return raw;
  } catch {}
  return "light";
}

export function saveTheme(t: Theme) {
  localStorage.setItem("kaoyan_theme", t);
}

// --- 默认任务（API 为空时使用） ---

export const DEFAULT_TASKS: TaskDef[] = [
  { id: "math", title: "B站数学课", status: "pending", description: "打开B站观看今天的数学课程视频", url: "https://www.bilibili.com" },
  { id: "cs", title: "数据结构与计算机组成原理", status: "pending", description: "打开百度网盘学习专业课资料", url: "https://pan.baidu.com" },
  { id: "vocab", title: "红宝书单词（1单元）", status: "pending", description: "背诵一个单元的单词并自测" },

];
// 结构化题库条目
export interface QaItem {
  id: string;
  book: string;
  chapter: string;
  section: string;
  questionNo: string;
  type: string;
  questionText: string;
  answerText: string;
}
