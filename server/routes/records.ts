import { Router, Request, Response } from "express";
import db from "../db.js";

const router = Router();

// 获取全部记录
router.get("/", (_req: Request, res: Response) => {
  const dateRows = db.prepare("SELECT DISTINCT date FROM daily_records ORDER BY date DESC").all() as Array<{ date: string }>;

  const stmt = db.prepare("SELECT * FROM daily_records WHERE date = ?");
  const records = dateRows.map((d) => {
    const tasks = stmt.all(d.date).map((r: any) => ({
      taskId: r.task_id,
      completed: !!r.completed,
      note: r.note || undefined,
    }));
    return { date: d.date, tasks };
  });

  res.json(records);
});

// 批量保存记录（空数组则清空全部）
router.put("/", (req: Request, res: Response) => {
  const records: Array<{
    date: string;
    tasks: Array<{ taskId: string; completed: boolean; note?: string }>;
  }> = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: "records must be an array" });

  if (records.length === 0) {
    db.exec("DELETE FROM daily_records");
    return res.json({ ok: true });
  }

  const upsert = db.prepare(
    "INSERT OR REPLACE INTO daily_records (date, task_id, completed, note) VALUES (?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    const dates = [...new Set(records.map((r) => r.date))];
    const deleteStmt = db.prepare("DELETE FROM daily_records WHERE date = ?");
    dates.forEach((d) => deleteStmt.run(d));

    records.forEach((r) => {
      r.tasks.forEach((t) => {
        upsert.run(r.date, t.taskId, t.completed ? 1 : 0, t.note || null);
      });
    });
  });
  tx();

  res.json({ ok: true });
});

export default router;