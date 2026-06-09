import express from "express";
import cors from "cors";
import tasksRouter from "./routes/tasks.js";
import recordsRouter from "./routes/records.js";
import homeworkRouter from "./routes/homework.js";
import notebookRouter from "./routes/notebook.js";
import chatRouter from "./routes/chat.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/tasks", tasksRouter);
app.use("/api/records", recordsRouter);
app.use("/api/homework", homeworkRouter);
app.use("/api/notebook", notebookRouter);
app.use("/api/chat", chatRouter);

app.get("/api/ping", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`SQLite API 服务器已启动: http://localhost:${PORT}`);
  console.log(`数据库文件: server/data/data.db`);
});
