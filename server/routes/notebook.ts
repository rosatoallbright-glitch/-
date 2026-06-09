import { Router, Request, Response } from "express";
import db from "../db.js";

const router = Router();

// 获取全部错题本条目（蛇形 → 驼峰映射）
router.get("/", (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM notebook_entries ORDER BY created_at DESC").all() as Array<{
    id: string; subject: string; chapter: string; content: string; created_at: string;
  }>;
  const entries = rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    chapter: r.chapter || "",
    content: r.content,
    createdAt: r.created_at,
  }));
  res.json(entries);
});

// 添加条目（驼峰 → 蛇形映射）
router.post("/", (req: Request, res: Response) => {
  const { id, subject, chapter, content, createdAt } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  db.prepare("INSERT OR REPLACE INTO notebook_entries (id, subject, chapter, content, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    subject || "",
    chapter || "",
    content || "",
    createdAt || new Date().toISOString()
  );
  res.json({ ok: true });
});

// 删除条目
router.delete("/:id", (req: Request, res: Response) => {
  db.prepare("DELETE FROM notebook_entries WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
