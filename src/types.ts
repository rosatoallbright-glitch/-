export type TaskStatus = "pending" | "active" | "completed" | "failed";
export type LuluState = "peaceful" | "happy" | "thinking" | "proud" | "alert";
export type Theme = "dark" | "light";

export interface TaskDef {
  id: string;
  title: string;
  status: TaskStatus;
  description: string;
  url?: string;
  estimatedMinutes: number;
}

export interface FocusSession {
  startTime: number;
  endTime?: number;
  durationMinutes?: number;
}

export interface NotebookEntry {
  id: string;
  subject: string;
  content: string;
  createdAt: string;
}

export interface DailyRecord {
  date: string;
  tasks: Array<{
    taskId: string;
    completed: boolean;
    sessions: FocusSession[];
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
  return "dark";
}

export function saveTheme(t: Theme) {
  localStorage.setItem("kaoyan_theme", t);
}

export function loadCustomTasks(): TaskDef[] {
  try {
    const raw = localStorage.getItem("kaoyan_custom_tasks");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [
    { id: "math", title: "B站数学课", status: "pending", description: "打开B站观看今天的数学课程视频", url: "https://www.bilibili.com", estimatedMinutes: 90 },
    { id: "cs", title: "数据结构与计算机组成原理", status: "pending", description: "打开百度网盘学习专业课资料", url: "https://pan.baidu.com", estimatedMinutes: 120 },
    { id: "vocab", title: "红宝书单词（1单元）", status: "pending", description: "背诵一个单元的单词并自测", estimatedMinutes: 30 },
  ];
}

export function saveCustomTasks(tasks: TaskDef[]) {
  localStorage.setItem("kaoyan_custom_tasks", JSON.stringify(tasks));
}




