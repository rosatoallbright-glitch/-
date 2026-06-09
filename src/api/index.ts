// API 客户端 — 与 Express + SQLite 后端通信
// 所有请求经 Vite proxy 转发到 localhost:3001

import type { TaskDef, DailyRecord, NotebookEntry } from "../types";

const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`${options?.method || "GET"} ${url}: ${res.status}`);
  }
  return res.json();
}

export interface HomeworkItem {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  done: boolean;
}

export const api = {
  tasks: {
    getAll: () => request<TaskDef[]>("/tasks"),
    saveAll: (tasks: TaskDef[]) =>
      request<{ ok: true }>("/tasks", { method: "PUT", body: JSON.stringify(tasks) }),
  },
  records: {
    getAll: () => request<DailyRecord[]>("/records"),
    saveAll: (records: DailyRecord[]) =>
      request<{ ok: true }>("/records", { method: "PUT", body: JSON.stringify(records) }),
  },
  homework: {
    getAll: () => request<HomeworkItem[]>("/homework"),
    saveAll: (items: HomeworkItem[]) =>
      request<{ ok: true }>("/homework", { method: "PUT", body: JSON.stringify(items) }),
  },
  notebook: {
    getAll: () => request<NotebookEntry[]>("/notebook"),
    add: (entry: NotebookEntry) =>
      request<{ ok: true }>("/notebook", { method: "POST", body: JSON.stringify(entry) }),
    remove: (id: string) =>
      request<{ ok: true }>(`/notebook/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
};