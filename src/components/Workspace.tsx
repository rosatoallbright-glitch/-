import { useState } from "react";
import { TaskDef } from "../types";
import { cn } from "../lib/utils";
import { ExternalLink, CheckCircle, Timer } from "lucide-react";

interface Props {
  task: TaskDef;
  onComplete: () => void;
  onStartTimer: () => void;
  timerActive: boolean;
}

export default function Workspace({ task, onComplete, onStartTimer, timerActive }: Props) {
  const [notes, setNotes] = useState("");

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 max-w-2xl flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center mb-5">
        <CheckCircle className="w-6 h-6 text-emerald-400" />
      </div>

      <h3 className="text-xl font-bold text-zinc-100 mb-2">{task.title}</h3>
      <p className="text-zinc-400 text-sm mb-6 max-w-md">{task.description}</p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
        {task.url && (
          <a
            href={task.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-emerald-50 px-6 py-2.5 rounded-lg font-mono font-bold text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            打开链接
          </a>
        )}
        <button
          onClick={onStartTimer}
          disabled={timerActive}
          className={cn(
            "inline-flex items-center gap-2 border px-6 py-2.5 rounded-lg font-mono font-bold text-sm transition-colors",
            timerActive
              ? "border-zinc-700 bg-zinc-950/70 text-zinc-500 cursor-not-allowed"
              : "border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Timer className="w-4 h-4" />
          {timerActive ? "专注已启动" : "开始计时"}
        </button>
      </div>

      <div className="w-full max-w-md mb-8">
        <p className="text-xs text-zinc-500 font-mono mb-2 text-left">学习笔记</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-4 text-zinc-300 font-mono text-sm outline-none focus:border-zinc-500 resize-none h-32"
          placeholder="记录你的笔记、疑问或心得..."
        />
      </div>

      <button
        onClick={onComplete}
        disabled={timerActive}
        className={cn(
          "inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold transition-colors",
          timerActive
            ? "bg-zinc-950/70 text-zinc-500 cursor-not-allowed border border-zinc-700"
            : "bg-zinc-100 hover:bg-white text-zinc-900 border border-transparent"
        )}
      >
        <CheckCircle className="w-5 h-5" />
        {timerActive ? "请完成专注后打卡" : "完成打卡"}
      </button>

      <p className="text-[10px] text-zinc-600 mt-4 font-mono">
        诚实打卡 — Lulu 相信你
      </p>
    </div>
  );
}
