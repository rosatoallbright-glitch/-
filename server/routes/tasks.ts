import { Router, Request, Response } from "express";
import db from "../db.js";

const router = Router();

// 获取全部任务
router.get("/", (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM tasks ORDER BY sort_order, rowid").all();
  // 转换为前端 TaskDef 格式
  const tasks = rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    description: r.description || "",
    url: r.url || undefined,
  }));
  res.json(tasks);
});

// 批量保存任务（全量替换）
router.put("/", (req: Request, res: Response) => {
  const tasks: Array<{ id: string; title: string; status: string; description?: string; url?: string }> = req.body;
  if (!Array.isArray(tasks)) return res.status(400).json({ error: "tasks must be an array" });

  const insert = db.prepare("INSERT OR REPLACE INTO tasks (id, title, status, description, url, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
  const deleteOld = db.prepare("DELETE FROM tasks WHERE id NOT IN (" + tasks.map(() => "?").join(",") + ")");

  const tx = db.transaction(() => {
    tasks.forEach((t, i) => {
      insert.run(t.id, t.title, t.status, t.description || "", t.url || null, i);
    });
    deleteOld.run(...tasks.map((t) => t.id));
  });
  tx();

  res.json({ ok: true });
});

export default router;