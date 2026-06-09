import { Router, Request, Response } from "express";
import db from "../db.js";

const router = Router();

// 获取全部作业
router.get("/", (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM homework ORDER BY deadline ASC").all();
  res.json(rows);
});

// 批量保存作业（全量替换）
router.put("/", (req: Request, res: Response) => {
  const items: Array<{ id: string; title: string; subject: string; deadline: string; done: number }> = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: "items must be an array" });

  if (items.length === 0) {
    db.exec("DELETE FROM homework");
    return res.json({ ok: true });
  }

  const upsert = db.prepare(
    "INSERT OR REPLACE INTO homework (id, title, subject, deadline, done) VALUES (?, ?, ?, ?, ?)"
  );
  const deleteOld = db.prepare("DELETE FROM homework WHERE id NOT IN (" + items.map(() => "?").join(",") + ")");

  const tx = db.transaction(() => {
    items.forEach((item) => {
      upsert.run(item.id, item.title, item.subject, item.deadline, item.done ? 1 : 0);
    });
    deleteOld.run(...items.map((i) => i.id));
  });
  tx();
  res.json({ ok: true });
});

export default router;