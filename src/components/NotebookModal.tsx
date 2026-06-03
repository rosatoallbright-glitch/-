import { useMemo, useState } from "react";
import { X, Download, Plus, Trash2, Filter } from "lucide-react";
import { NotebookEntry } from "../types";

interface Props {
  entries: NotebookEntry[];
  onClose: () => void;
  onAddEntry: (entry: NotebookEntry) => void;
  onDeleteEntry: (id: string) => void;
}

export default function NotebookModal({ entries, onClose, onAddEntry, onDeleteEntry }: Props) {
  const PRESET_SUBJECTS = ["数据结构", "计算机组成原理", "操作系统", "计算机网络"];
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [exportSubject, setExportSubject] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const list = Array.from(new Set(entries.map((entry) => entry.subject).filter(Boolean)));
    const sorted = [
      ...PRESET_SUBJECTS.filter((s) => list.includes(s)),
      ...list.filter((s) => !PRESET_SUBJECTS.includes(s)),
    ];
    return sorted;
  }, [entries]);

  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.subject] = (counts[e.subject] || 0) + 1;
    }
    return counts;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!activeFilter) return entries;
    return entries.filter((e) => e.subject === activeFilter);
  }, [entries, activeFilter]);

  const canAdd = subject.trim() !== "" && content.trim() !== "";

  const handleAdd = () => {
    const nextSubject = subject.trim();
    if (!nextSubject || !content.trim()) return;
    onAddEntry({
      id: "note_" + Date.now(),
      subject: nextSubject,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    });
    setContent("");
    setSubject("");
  };

  const toggleFilter = (sub: string) => {
    setActiveFilter((prev) => (prev === sub ? null : sub));
  };

  const handleExport = () => {
    const toExport = exportSubject
      ? entries.filter((e) => e.subject === exportSubject)
      : entries;
    const now = new Date();
    const header = [
      "错题本导出" + (exportSubject ? " - " + exportSubject : ""),
      "导出时间: " + now.toLocaleString(),
      "",
    ];
    const body: string[] = [];
    if (toExport.length > 0) {
      for (let i = 0; i < toExport.length; i++) {
        const entry = toExport[i];
        body.push((i + 1) + ". 科目: " + entry.subject);
        body.push("   时间: " + new Date(entry.createdAt).toLocaleString());
        body.push("   内容:");
        for (const line of entry.content.split("\n")) {
          body.push("     " + line);
        }
        body.push("");
      }
    } else {
      body.push("暂无错题记录");
    }
    const blob = new Blob([header.concat(body).join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "错题本" + (exportSubject ? "_" + exportSubject : "") + "_" + new Date().toISOString().slice(0, 10) + ".txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    if (window.confirm("确定要清空所有错题吗？此操作不可撤销。")) {
      for (const e of [...entries]) {
        onDeleteEntry(e.id);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-900/70 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 font-mono">错题本</h2>
            <p className="text-xs text-zinc-400 font-mono">记录错题、归类科目，导出 TXT 备份</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportSubject ?? ""}
              onChange={(e) => setExportSubject(e.target.value || null)}
              className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-2.5 py-2 text-[10px] font-mono text-zinc-400 outline-none focus:border-emerald-500"
            >
              <option value="">全部科目</option>
              {PRESET_SUBJECTS.map((sub) => (
                <option key={sub} value={sub}>{sub} ({subjectCounts[sub] || 0})</option>
              ))}
              {subjects.filter((s) => !PRESET_SUBJECTS.includes(s)).map((sub) => (
                <option key={sub} value={sub}>{sub} ({subjectCounts[sub] || 0})</option>
              ))}
            </select>
            <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-mono font-semibold text-emerald-50 hover:bg-emerald-500 transition-colors">
              <Download className="w-4 h-4" /> 导出 TXT
            </button>
            <button onClick={handleClearAll} className="rounded-xl p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors" title="清空全部错题">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 p-6 min-h-0">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4">
              <label className="text-xs font-mono text-zinc-400">选择科目</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-500">
                <option value="">-- 选择科目 --</option>
                {PRESET_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
                {subjects.filter((s) => !PRESET_SUBJECTS.includes(s)).map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
              <div className="mt-3">
                <label className="text-xs font-mono text-zinc-400">或输入自定义科目</label>
                <input
                  value={!PRESET_SUBJECTS.includes(subject) ? subject : ""}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="例如: 高数、英语、算法"
                  className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4">
              <label className="text-xs font-mono text-zinc-400">错题内容</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="记录错题、解析、考点、解题思路..." className="mt-2 w-full rounded-3xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-500 resize-none" />
              <button onClick={handleAdd} disabled={!canAdd} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors">
                <Plus className="w-4 h-4" /> 添加错题
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 overflow-y-auto">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">已记录</div>
                  <div className="text-2xl font-bold text-zinc-100">{entries.length}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveFilter(null)}
                  className={"text-[10px] font-mono px-2.5 py-1 rounded-full border transition-colors " +
                    (activeFilter === null
                      ? "bg-emerald-950/30 border-emerald-700 text-emerald-400"
                      : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600")}
                >
                  <Filter className="w-3 h-3 inline mr-1" />
                  全部 ({entries.length})
                </button>
                {subjects.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => toggleFilter(sub)}
                    className={"text-[10px] font-mono px-2.5 py-1 rounded-full border transition-colors " +
                      (activeFilter === sub
                        ? "bg-emerald-950/30 border-emerald-700 text-emerald-400"
                        : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600")}
                  >
                    {sub} ({subjectCounts[sub] || 0})
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredEntries.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-950/80 p-6 text-center text-sm text-zinc-400">
                  {activeFilter ? "\u201c" + activeFilter + "\u201d 科目暂无错题" : "还没有错题，马上添加一个科目和内容。"}
                </div>
              ) : filteredEntries.map((entry) => (
                <div key={entry.id} className="rounded-3xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{entry.subject}</div>
                      <div className="text-[11px] text-zinc-500 mt-1">{new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                    <button onClick={() => onDeleteEntry(entry.id)} className="rounded-xl p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{entry.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}