import { useState } from "react";
import { TaskDef, LuluState } from "../types";
import { cn } from "../api/utils";
import {
  CheckCircle2, Circle, XCircle, BarChart3, Plus, Trash2,
  Edit3, Check, X, Settings, Key, BookOpen, Calendar,
} from "lucide-react";

interface Props {
  tasks: TaskDef[];
  onSelectTask: (id: string) => void;
  activeTaskId: string | null;
  onOpenStats: () => void;
  onTasksChange: (tasks: TaskDef[]) => void;
  onOpenApiSettings: () => void;
  onOpenNotebook: () => void;
  onOpenChat: () => void;
  onOpenHomework: () => void;
  luluState?: LuluState;
}

export default function Sidebar(props: Props) {
  const { tasks, onSelectTask, activeTaskId, onOpenStats, onTasksChange, onOpenApiSettings, onOpenNotebook, onOpenHomework } = props;
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const deleteTask = (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id));
  };

  const startEdit = (task: TaskDef) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditUrl(task.url || "");
  };

  const saveEdit = () => {
    if (!editTitle.trim() || !editingId) return;
    onTasksChange(
      tasks.map((t) =>
        t.id === editingId
          ? {
              ...t,
              title: editTitle.trim(),
              description: editDesc.trim(),
              url: editUrl.trim() || undefined,
            }
          : t
      )
    );
    setEditingId(null);
  };

  const addNewTask = () => {
    const id = "task_" + Date.now();
    const newTask: TaskDef = {
      id,
      title: "新任务",
      status: "pending",
      description: "点击编辑修改任务内容",
    };
    onTasksChange([...tasks, newTask]);
    setEditingId(id);
    setEditTitle("新任务");
    setEditDesc("点击编辑修改任务内容");
    setEditUrl("");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="relative group/task">
            {editingId === task.id ? (
              <div className="bg-zinc-800/80 border border-zinc-700 rounded-lg p-3 space-y-2 animate-in fade-in duration-150">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-400 font-medium"
                  placeholder="任务名称"
                  autoFocus
                />
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-400 outline-none focus:border-zinc-400"
                  placeholder="描述"
                />
                <div className="flex gap-2">
                  <input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-600 rounded px-2 py-1.5 text-xs text-zinc-400 outline-none focus:border-zinc-400"
                    placeholder="链接 (可选)"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-300 p-1">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={saveEdit} className="text-emerald-500 hover:text-emerald-400 p-1">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onSelectTask(task.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all duration-200 flex flex-col gap-2",
                  activeTaskId === task.id
                    ? "bg-zinc-800/80 border-zinc-700 shadow-md"
                    : "bg-zinc-900/40 border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700/50",
                  task.status === "completed" && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="font-medium text-zinc-200 leading-tight text-sm pr-6">
                    {task.title}
                  </span>
                  <TaskIcon status={task.status} />
                </div>
                <div className="flex items-center justify-between mt-auto">
                  {task.url ? (
                    <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[120px]">
                      {task.url.replace(/https?:\/\//, "").replace(/\/$/, "").slice(0, 24)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-zinc-600">无链接</span>
                  )}
                </div>
              </button>
            )}

            {editMode && editingId !== task.id && (
              <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover/task:opacity-100 transition-opacity z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(task); }}
                  className="p-1 text-zinc-500 hover:text-zinc-300 bg-zinc-800/90 rounded"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                  className="p-1 text-zinc-500 hover:text-red-400 bg-zinc-800/90 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {editMode && (
          <button
            onClick={addNewTask}
            className="w-full p-3 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors flex items-center justify-center gap-2 text-xs font-mono"
          >
            <Plus className="w-4 h-4" />
            添加任务
          </button>
        )}
      </div>

      <div className="p-3 border-t border-zinc-800 space-y-1">
        <button
          onClick={onOpenNotebook}
          className="w-full text-left p-2.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-800/50 transition-colors flex items-center gap-3 text-xs font-mono text-zinc-500 hover:text-zinc-300"
        >
          <BookOpen className="w-4 h-4" />
          <span>错题本</span>
        </button>
        <button
          onClick={() => setEditMode(!editMode)}
          className={cn(
            "w-full text-left p-2.5 rounded-lg border transition-colors flex items-center gap-3 text-xs font-mono",
            editMode
              ? "border-amber-700 bg-amber-950/20 text-amber-400"
              : "border-zinc-800/50 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
          )}
        >
          <Settings className="w-4 h-4" />
          <span>{editMode ? "完成编辑" : "编辑任务"}</span>
        </button>
        <button
          onClick={onOpenApiSettings}
          className="w-full text-left p-2.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-800/50 transition-colors flex items-center gap-3 text-zinc-500 hover:text-zinc-300 text-xs font-mono"
        >
          <Key className="w-4 h-4" />
          <span>API 设置</span>
        </button>
        <button
          onClick={onOpenHomework}
          className="w-full text-left p-2.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-800/50 transition-colors flex items-center gap-3 text-zinc-500 hover:text-zinc-300 text-xs font-mono"
        >
          <Calendar className="w-4 h-4" />
          <span>作业记录</span>
        </button>
        <button
          onClick={onOpenStats}
          className="w-full text-left p-2.5 rounded-lg border border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-800/50 transition-colors flex items-center gap-3 text-zinc-500 hover:text-zinc-300 text-xs font-mono"
        >
          <BarChart3 className="w-4 h-4" />
          <span>学习统计</span>
        </button>
      </div>
    </div>
  );
}

function TaskIcon({ status }: { status: TaskDef["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    default:
      return <Circle className="w-4 h-4 text-zinc-600 shrink-0" />;
  }
}