import { useState } from "react";
import { TaskDef } from "../types";
import { ExternalLink, CheckCircle } from "lucide-react";

interface Props {
  task: TaskDef;
  onComplete: (notes: string) => void;
}

export default function Workspace({ task, onComplete }: Props) {
  const [notes, setNotes] = useState("");

  return (
    <div className="relative overflow-hidden w-full max-w-3xl mx-auto flex flex-col text-left">
      <div className="w-8 h-8 rounded-full bg-emerald-950/30 border border-emerald-900/30 flex items-center justify-center mb-3">
        <CheckCircle className="w-3.5 h-3.5 text-zinc-400" />
      </div>

      <div className="mb-2">
        <span className="text-xs text-zinc-500 font-mono">学习心得</span>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full bg-[#0A0A0B] border border-white/5 rounded-xl p-5 text-zinc-300 font-mono text-sm outline-none resize-y min-h-[360px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] focus:border-emerald-500/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_0_0_1px_rgba(16,185,129,0.2)] transition-[border-color,box-shadow]"
        placeholder="记录你的心得、疑问或收获..."
      />

      <div className="mt-4 flex flex-col gap-2 max-w-md">
        <button
          onClick={() => onComplete(notes)}
          className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-bold transition-colors bg-zinc-100 hover:bg-white text-zinc-900 border border-transparent"
        >
          <CheckCircle className="w-5 h-5" />
          完成打卡
        </button>

        {task.url && (
          <a
            href={task.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-emerald-50 px-6 py-2.5 rounded-lg font-mono font-bold text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            打开链接
          </a>
        )}
      </div>

      <p className="text-[10px] text-zinc-600 mt-4 font-mono">
        诚实打卡 — Lulu 相信你
      </p>
    </div>
  );
}