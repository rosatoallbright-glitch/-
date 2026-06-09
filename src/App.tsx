import { useState, useEffect, useCallback } from "react";
import {
  TaskDef, TaskStatus, LuluState, DailyRecord, Theme,
  NotebookEntry, loadApiSettings, saveApiSettings, ApiSettings, loadTheme, saveTheme, 
} from "./types";
import { todayStr } from "./api/utils";
import { api } from "./api/index";
import Sidebar from "./components/Sidebar";
import Lulu from "./components/Lulu";
import LuluChat from "./components/LuluChat";
import StatsPanel from "./components/StatsPanel";
import NotebookModal from "./components/NotebookModal";
import HomeworkModal from "./components/HomeworkModal";
import Workspace from "./components/Workspace";
import { Terminal, ShieldBan, Sparkles, Sun, Moon, Key, X, ChevronDown } from "lucide-react";

const API_PRESETS: { label: string; endpoint: string; models: string[] }[] = [
  { label: "OpenAI", endpoint: "https://api.openai.com/v1", models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"] },
  { label: "DeepSeek", endpoint: "https://api.deepseek.com/v1", models: ["deepseek-v4-flash", "deepseek-v4-pro"] },
  { label: "通义千问", endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen-plus", "qwen-max"] },
  { label: "智谱 GLM", endpoint: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-4-flash", "glm-4"] },
  { label: "Moonshot", endpoint: "https://api.moonshot.cn/v1", models: ["moonshot-v1-8k", "moonshot-v1-32k"] },
  { label: "自定义", endpoint: "", models: [] },
];

export default function App() {
  const [tasks, setTasks] = useState<TaskDef[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [luluState, setLuluState] = useState<LuluState>("peaceful");
  const [view, setView] = useState<"main" | "stats">("main");
  const [showChat, setShowChat] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
  const [showHomework, setShowHomework] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiSettings, setApiSettings] = useState<ApiSettings>(loadApiSettings);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>([]);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [loaded, setLoaded] = useState(false);

  // --- 从 SQLite API 加载所有数据 ---
  useEffect(() => {
    (async () => {
      try {
        const [t, r, n] = await Promise.all([
          api.tasks.getAll(),
          api.records.getAll(),
          api.notebook.getAll(),
        ]);
        setTasks(t);
        setRecords(r);
        setNotebookEntries(n);
      } catch {
        // API 不可用时使用默认任务
        
      }
      setLoaded(true);
    })();
  }, []);

  // --- 保存 tasks 到 API ---
  const saveTasks = useCallback(async (ts: TaskDef[]) => {
    try { await api.tasks.saveAll(ts); } catch {}
  }, []);

  // --- 保存 records 到 API ---
  const saveRecords = useCallback(async (recs: DailyRecord[]) => {
    try { await api.records.saveAll(recs); } catch {}
  }, []);

  // --- Lulu state ---
  useEffect(() => {
    const allDone = tasks.length > 0 && tasks.every((t) => t.status === "completed");
    if (showChat) { setLuluState("thinking"); return; }
    if (allDone) { setLuluState("proud"); return; }
    setLuluState("peaceful");
  }, [showChat, tasks]);

  // --- 根据今日记录恢复任务状态 ---
  useEffect(() => {
    if (!loaded) return;
    const date = todayStr();
    const today = records.find((r) => r.date === date);
    if (today) {
      setTasks((prev) => prev.map((t) => {
        const ts = today.tasks.find((s) => s.taskId === t.id);
        if (ts?.completed) return { ...t, status: "completed" as TaskStatus };
        return t;
      }));
    }
  }, [loaded]);

  useEffect(() => { document.documentElement.classList.toggle("light", theme === "light"); }, [theme]);

  const toggleTheme = () => { const n = theme === "dark" ? "light" : "dark"; setTheme(n); saveTheme(n); };
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  const handleTasksChange = (ts: TaskDef[]) => {
    setTasks(ts);
    saveTasks(ts);
  };

  const removeTask = useCallback((taskId: string) => {
    const taskTitle = tasks.find((t) => t.id === taskId)?.title;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    saveTasks(tasks.filter((t) => t.id !== taskId));
    if (taskTitle) {
      setRecords((prev) => {
        const next = prev.map((r) => ({
          ...r,
          tasks: r.tasks.map((s) => s.taskId === taskId ? { ...s, taskTitle: s.taskTitle || taskTitle } : s),
        }));
        saveRecords(next.slice(0, 365));
        return next.slice(0, 365);
      });
    }
  }, [tasks, saveTasks, saveRecords]);

  const handleTasksFromLulu = (ts: TaskDef[]) => {
    setTasks(ts); saveTasks(ts); setActiveTaskId(null); setLuluState("happy");
    const d = todayStr();
    setRecords((p) => {
      const nr = [{ date: d, tasks: ts.map((t) => ({ taskId: t.id, taskTitle: t.title, completed: false, note: undefined })) }, ...p.filter((r) => r.date !== d)];
      saveRecords(nr.slice(0, 365));
      return nr.slice(0, 365);
    });
  };

  const handleApiSettingsSave = (s: ApiSettings) => { setApiSettings(s); saveApiSettings(s); setShowApiSettings(false); };

  const handleOpenNotebook = () => setShowNotebook(true);
  const handleCloseNotebook = () => setShowNotebook(false);

  const handleAddNotebookEntry = (entry: NotebookEntry) => {
    setNotebookEntries((prev) => [entry, ...prev]);
    void (async () => { try { await api.notebook.add(entry); } catch {} })();
  };

  const handleDeleteNotebookEntry = (id: string) => {
    setNotebookEntries((prev) => prev.filter((item) => item.id !== id));
    try { api.notebook.remove(id); } catch {}
  };

  const handleUpdateNotebookEntry = (entry: NotebookEntry) => {
    setNotebookEntries((prev) => prev.map((item) => (item.id === entry.id ? entry : item)));
    api.notebook.add(entry);
  };

  const markComplete = useCallback((taskId: string, notes: string) => {
    const finishedTask = tasks.find((t) => t.id === taskId);
    setLuluState("happy");
    const d = todayStr();
    setRecords((p) => {
      const ex = p.find((r) => r.date === d);
      const nr = ex
        ? p.map((r) => r.date !== d ? r : { ...r, tasks: r.tasks.map((s) => s.taskId === taskId ? { ...s, completed: true, note: notes || undefined, taskTitle: s.taskTitle || finishedTask?.title } : s) })
        : [{ date: d, tasks: tasks.map((t) => ({ taskId: t.id, taskTitle: t.title, completed: t.id === taskId, note: t.id === taskId ? (notes || undefined) : undefined })) }, ...p];
      saveRecords(nr.slice(0, 365));
      return nr.slice(0, 365);
    });
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId);
      saveTasks(next);
      return next;
    });
    setActiveTaskId(null);
  }, [tasks, saveTasks, saveRecords]);

  const handleTaskComplete = (id: string, notes: string) => {
    markComplete(id, notes);
    setTimeout(() => setActiveTaskId(null), 1500);
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const allDone = completedCount === tasks.length && tasks.length > 0;

  return (
    <div className="flex h-screen w-full overflow-hidden text-sm selection:bg-emerald-500/30">
      <div className="w-80 border-r border-zinc-800 bg-zinc-950/40 flex flex-col backdrop-blur-xl shrink-0">
        <div className="p-5 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/30">
          <div className="bg-zinc-800 p-2.5 rounded-lg shadow-inner border border-zinc-700/50"><Terminal className="text-emerald-400 w-5 h-5" /></div>
          <div className="flex-1">
            <h1 className="font-mono font-bold tracking-tight text-zinc-100 text-lg">考研专注</h1>
            <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
              {activeTask ? `当前任务: ${activeTask.title}` : tasks.length === 0 ? "暂无任务" : "选择一个任务开始"}
            </p>
          </div>
          <button onClick={toggleTheme} className="p-1.5 rounded-lg border border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors" title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
        <div className="p-4 border-b border-zinc-800/50 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400"><span className="flex items-center gap-1"><ShieldBan className="w-3 h-3" /> 监督模式</span><span className="text-emerald-400/80">{allDone ? "ALL CLEAR" : "ONLINE"}</span></div>
          <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }} /></div>
          <div className="text-[10px] text-zinc-600 font-mono w-full text-right">完成: {completedCount}/{tasks.length}</div>
        </div>
        <Sidebar tasks={tasks} onSelectTask={(id) => { setActiveTaskId(id); setView("main"); }} activeTaskId={activeTaskId} onOpenStats={() => setView("stats")} onTasksChange={handleTasksChange} onDeleteTask={removeTask} onOpenApiSettings={() => setShowApiSettings(true)} onOpenNotebook={handleOpenNotebook} onOpenHomework={() => setShowHomework(true)} onOpenChat={() => setShowChat(true)} luluState={luluState} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/20 via-zinc-950 to-zinc-950">
        <header className="h-16 border-b border-zinc-800/60 bg-zinc-950/80 flex items-center justify-between px-8 z-10 backdrop-blur-md shrink-0">
          <div className="font-mono text-zinc-500 flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500/50" /><span className="text-zinc-300">{view === "stats" ? "学习统计" : activeTask ? activeTask.title : "仪表盘"}</span>{!activeTask && view !== "stats" && <span className="animate-pulse">_</span>}</div>
          <div className="flex items-center gap-3">
            <Lulu state={luluState} onClick={() => setShowChat(true)} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-10">
          {view === "stats" ? (
            <StatsPanel records={records} tasks={tasks} onBack={() => setView("main")} onStartTask={(id: string) => { setActiveTaskId(id); setView("main"); }} onDeleteRecord={(date) => {
              setRecords((prev) => {
                const next = prev.filter(r => r.date !== date);
                saveRecords(next.slice(0, 365));
                return next.slice(0, 365);
              });
            }} onDeleteTaskFromRecord={(date, taskId) => {
              setRecords((prev) => {
                const next = prev.map(r => r.date === date ? { ...r, tasks: r.tasks.filter(t => t.taskId !== taskId) } : r).filter(r => r.tasks.length > 0);
                saveRecords(next.slice(0, 365));
                return next.slice(0, 365);
              });
            }} />
          ) : !activeTask ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 font-mono">
              <button onClick={() => setShowChat(true)} className="mb-6 text-5xl opacity-20 hover:opacity-40 transition-opacity select-none cursor-pointer">(o.o)</button>
              <div className="text-xl tracking-widest text-zinc-400 mb-2 font-bold uppercase">Lulu 已就绪</div>
              <div className="text-xs tracking-widest text-zinc-600 mb-8">选择一个任务，或点击 Lulu 让我帮你规划</div>
              <div className="flex gap-4 text-[10px] border border-zinc-800 p-4 rounded bg-zinc-900/30"><div>总任务: {tasks.length}</div><div>待完成: {tasks.filter((t) => t.status !== "completed").length}</div><div className="text-emerald-400/80">已完成: {completedCount}</div></div>
              {allDone && <div className="mt-8 border border-emerald-900/50 bg-emerald-950/20 p-6 rounded-lg text-center"><div className="text-3xl mb-2">&#10003;</div><div className="text-emerald-400 font-mono text-sm">今日全部完成！Lulu 为你感到骄傲。</div><button onClick={() => setView("stats")} className="mt-3 text-xs text-emerald-500/70 hover:text-emerald-400 font-mono underline underline-offset-4">查看统计数据</button></div>}
            </div>
          ) : (
            <div className="max-w-5xl mx-auto h-full flex flex-col">
              <div className="mb-10"><div className="flex items-center gap-3 mb-2">{activeTask.status === "completed" && <span className="text-[10px] bg-emerald-950/50 border border-emerald-900 text-emerald-400 font-mono px-2 py-0.5 rounded">VERIFIED</span>}</div><h2 className="text-3xl font-bold text-zinc-100 mb-1 tracking-tight">{activeTask.title}</h2><p className="text-zinc-400 text-sm">{activeTask.description}</p></div>
              {activeTask.status === "completed" ? (
                <div className="border border-emerald-900/50 bg-emerald-950/20 p-8 rounded-lg flex flex-col items-center justify-center text-emerald-500 font-mono">
                  <div className="text-4xl mb-4">&#10003;</div>
                  <div>任务完成</div>
                </div>
              ) : <Workspace task={activeTask} onComplete={(notes) => handleTaskComplete(activeTask.id, notes)} />}
            </div>
          )}
        </main>
      </div>
      {showNotebook && <NotebookModal entries={notebookEntries} onClose={handleCloseNotebook} onAddEntry={handleAddNotebookEntry} onDeleteEntry={handleDeleteNotebookEntry} onUpdateEntry={handleUpdateNotebookEntry} />}
      {showHomework && <HomeworkModal onClose={() => setShowHomework(false)} />}
      {showChat && <LuluChat apiSettings={apiSettings} luluState={luluState} onClose={() => setShowChat(false)} onTasksGenerated={handleTasksFromLulu} />}
      {showApiSettings && <ApiSettingsModal settings={apiSettings} onSave={handleApiSettingsSave} onClose={() => setShowApiSettings(false)} />}
    </div>
  );
}

function ApiSettingsModal({ settings, onSave, onClose }: { settings: ApiSettings; onSave: (s: ApiSettings) => void; onClose: () => void }) {
  const [key, setKey] = useState(settings.key);
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [model, setModel] = useState(settings.model);
  const [presetIdx, setPresetIdx] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const currentModels = presetIdx >= 0 ? API_PRESETS[presetIdx].models : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6 shadow-2xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-3"><Key className="w-5 h-5 text-amber-400" /><h2 className="font-mono font-bold text-zinc-100">API 设置</h2></div><button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div><label className="block text-xs font-mono text-zinc-400 mb-1.5">服务商预设</label><div className="grid grid-cols-3 gap-2">{API_PRESETS.map((p, i) => (<button key={p.label} onClick={() => { setPresetIdx(i); if (p.endpoint) setEndpoint(p.endpoint); setModel(p.models[0] || ""); setShowDropdown(false); }} className={`text-xs font-mono py-2 px-2 rounded border transition-colors ${presetIdx === i ? "border-emerald-500 bg-emerald-950/30 text-emerald-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"}`}>{p.label}</button>))}</div></div>
          <div><label className="block text-xs font-mono text-zinc-400 mb-1.5">API Key</label><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-..." className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 font-mono" /></div>
          <div><label className="block text-xs font-mono text-zinc-400 mb-1.5">API 地址</label><input value={endpoint} onChange={(e) => { setEndpoint(e.target.value); setPresetIdx(-1); }} placeholder="https://api.openai.com/v1" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 font-mono" /></div>
          <div className="relative"><label className="block text-xs font-mono text-zinc-400 mb-1.5">模型</label>{currentModels.length > 0 ? (<><button onClick={() => setShowDropdown(!showDropdown)} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none font-mono flex items-center justify-between"><span>{model}</span><ChevronDown className="w-4 h-4 text-zinc-500" /></button>{showDropdown && <div className="absolute top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden z-10">{currentModels.map((m) => (<button key={m} onClick={() => { setModel(m); setShowDropdown(false); }} className={`w-full text-left px-4 py-2 text-sm font-mono hover:bg-zinc-800 transition-colors ${model === m ? "text-emerald-400" : "text-zinc-400"}`}>{m}</button>))}</div>}</>) : <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 font-mono" />}</div>
        </div>
        <div className="flex gap-3 mt-6"><button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 font-mono text-sm transition-colors">取消</button><button onClick={() => onSave({ key: key.trim(), endpoint: endpoint.trim() || "https://api.openai.com/v1", model: model.trim() || "gpt-4o-mini" })} disabled={!key.trim()} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-emerald-50 font-mono font-bold text-sm transition-colors">保存</button></div>
      </div>
    </div>
  );
}
