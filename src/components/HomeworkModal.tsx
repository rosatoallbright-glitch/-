import { useState, useEffect } from "react";
import { Plus, X, Calendar, Clock, Trash2, CheckCircle2, Circle } from "lucide-react";

interface HomeworkItem {
  id: string;
  title: string;
  deadline: string;
  done: boolean;
}

const STORAGE_KEY = "kaoyan_homework";

function loadHomework(): HomeworkItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHomework(items: HomeworkItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function HomeworkModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState(() => loadHomework());
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");

  useEffect(() => {
    const timer = setInterval(() => {
      setItems((prev) => [...prev]);
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const persist = (next: HomeworkItem[]) => {
    setItems(next);
    saveHomework(next);
  };

  const handleAdd = () => {
    if (!title.trim() || !deadlineDate) return;
    const deadline = new Date(`${deadlineDate}T${deadlineTime}:00`).toISOString();
    const item: HomeworkItem = {
      id: "hw_" + Date.now(),
      title: title.trim(),
      deadline,
      done: false,
    };
    persist([item, ...items]);
    setTitle("");
    setDeadlineDate("");
    setDeadlineTime("23:59");
    setShowForm(false);
  };

  const toggleDone = (id: string) => {
    persist(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const deleteItem = (id: string) => {
    persist(items.filter((i) => i.id !== id));
  };

  const getDeadlineStatus = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff < 0) return "overdue";
    if (diff < 3_600_000) return "urgent";
    if (diff < 86_400_000) return "soon";
    return "ok";
  };

  const statusColors: Record<string, string> = {
    overdue: "text-red-400",
    urgent: "text-amber-400",
    soon: "text-yellow-400",
    ok: "text-zinc-500",
  };

  const formatDeadline = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const absMin = Math.abs(Math.round(diff / 60_000));

    if (diff < 0) {
      if (absMin < 60) return `${absMin} 分钟前`;
      if (absMin < 1440) return `${Math.floor(absMin / 60)} 小时前`;
      return `${Math.floor(absMin / 1440)} 天前`;
    }
    if (absMin < 60) return `还剩 ${absMin} 分钟`;
    if (absMin < 1440) return `还剩 ${Math.floor(absMin / 60)} 小时`;
    return `${Math.floor(absMin / 1440)} 天后截止`;
  };

  const pendingItems = items.filter((i) => !i.done).sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  );
  const doneItems = items.filter((i) => i.done);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl p-6 shadow-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="font-mono font-bold text-zinc-100">作业记录</h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">{pendingItems.length} 待完成</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="w-5 h-5" /></button>
        </div>

        {/* 弹窗内容区 */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* 添加表单 */}
          {showForm && (
            <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-950/50 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="作业标题"
                className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600 font-mono border-b border-zinc-700 pb-2"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 outline-none font-mono"
                />
                <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  className="w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 outline-none font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 px-4 py-2 rounded-lg font-mono transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!title.trim() || !deadlineDate}
                  className="text-xs bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-emerald-50 px-4 py-2 rounded-lg font-mono font-bold transition-colors"
                >
                  添加
                </button>
              </div>
            </div>
          )}

          {/* 待完成列表 */}
          {pendingItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-mono text-zinc-500 uppercase px-2">待完成 ({pendingItems.length})</div>
              {pendingItems.map((item) => {
                const status = getDeadlineStatus(item.deadline);
                const isOverdue = status === "overdue" && !item.done;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg group hover:bg-zinc-800/30 transition-colors ${isOverdue ? "bg-red-950/20 border border-red-900/30" : "border border-zinc-800"}`}
                  >
                    <button onClick={() => toggleDone(item.id)} className="shrink-0">
                      <Circle className={`w-4 h-4 ${isOverdue ? "text-red-400" : "text-zinc-600 hover:text-emerald-400"} transition-colors`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-300 truncate font-mono">{item.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[11px] font-mono ${statusColors[status]}`}>
                          {formatDeadline(item.deadline)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="shrink-0 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 已完成列表 */}
          {doneItems.length > 0 && (
            <details className="group">
              <summary className="text-xs font-mono text-zinc-600 cursor-pointer hover:text-zinc-400 select-none px-2 py-1">
                已完成 ({doneItems.length})
              </summary>
              <div className="mt-2 space-y-1 pl-2">
                {doneItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-2 py-1 rounded group/done hover:bg-zinc-800/20">
                    <button onClick={() => toggleDone(item.id)} className="shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </button>
                    <span className="flex-1 text-xs text-zinc-500 line-through truncate font-mono">{item.title}</span>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="shrink-0 text-zinc-600 hover:text-red-400 opacity-0 group-done/done:opacity-100 transition-all p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

          {items.length === 0 && !showForm && (
            <div className="text-xs text-zinc-600 text-center py-8 font-mono">
              暂无作业记录
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-emerald-400 transition-colors px-3 py-2 rounded-lg hover:bg-zinc-800"
          >
            <Plus className="w-4 h-4" />
            {showForm ? "收起" : "添加作业"}
          </button>
          <button
            onClick={onClose}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-2 rounded-lg hover:bg-zinc-800"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}