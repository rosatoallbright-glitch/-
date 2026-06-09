import { useMemo, useState } from "react";
import { X, Download, Plus, Trash2, Filter, Pencil, ChevronDown, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react";
import { NotebookEntry } from "../types";

interface Props {
  entries: NotebookEntry[];
  onClose: () => void;
  onAddEntry: (entry: NotebookEntry) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateEntry: (entry: NotebookEntry) => void;
  onExport?: () => void;
}

const PRESET_SUBJECTS = ["数据结构", "计算机组成原理", "操作系统", "计算机网络"];

export default function NotebookModal({ entries, onClose, onAddEntry, onDeleteEntry, onUpdateEntry, onExport }: Props) {
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [content, setContent] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [exportSubject, setExportSubject] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandId, setExpandId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const chaptersBySubject = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const entry of entries) {
      if (!map.has(entry.subject)) map.set(entry.subject, new Set());
      if (entry.chapter) map.get(entry.subject)?.add(entry.chapter);
    }
    return map;
  }, [entries]);

  const subjects = useMemo(() => {
    const list = Array.from(new Set(entries.map((entry) => entry.subject).filter(Boolean)));
    return [...PRESET_SUBJECTS.filter((s) => list.includes(s)), ...list.filter((s) => !PRESET_SUBJECTS.includes(s))];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!activeFilter) return entries;
    const [sub, ch] = activeFilter.split("::");
    return entries.filter((e) => e.subject === sub && e.chapter === ch);
  }, [entries, activeFilter]);

  const isEditing = editingId !== null;
  const canSubmit = subject.trim() !== "" && chapter.trim() !== "" && content.trim() !== "";

  const startEdit = (entry: NotebookEntry) => {
    setEditingId(entry.id);
    setSubject(entry.subject);
    setChapter(entry.chapter || "");
    setContent(entry.content);
    setShowEditModal(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSubject("");
    setChapter("");
    setContent("");
    setShowEditModal(false);
  };

  const handleSubmit = () => {
    const nextSubject = subject.trim();
    const nextChapter = chapter.trim();
    if (!nextSubject || !nextChapter || !content.trim()) return;
    if (isEditing) {
      const originalEntry = entries.find((e) => e.id === editingId);
      onUpdateEntry({
        id: editingId!,
        subject: nextSubject,
        chapter: nextChapter,
        content: content.trim(),
        createdAt: originalEntry?.createdAt || new Date().toISOString(),
      });
      cancelEdit();
    } else {
      onAddEntry({
        id: `note_${Date.now()}`,
        subject: nextSubject,
        chapter: nextChapter,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      });
      setContent("");
      setShowAddPanel(false); setShowEditModal(false);
    }
  };

  const toggleFilter = (sub: string, ch: string) => {
    const key = `${sub}::${ch}`;
    setActiveFilter((prev) => (prev === key ? null : key));
  };

  const handleBatchDeleteChapter = (sub: string, ch: string) => {
    if (!window.confirm(`确定要清空「${sub} - ${ch}」下的所有错题吗？`)) return;
    if (activeFilter === `${sub}::${ch}`) setActiveFilter(null);
    entries.filter((e) => e.subject === sub && e.chapter === ch).forEach((e) => onDeleteEntry(e.id));
  };

  const toggleExpand = (id: string) => {
    setExpandId((prev) => (prev === id ? null : id));
    // Don't enter edit mode automatically; user must click pencil
  };

  const getPreview = (text: string) => {
    const lines = text.split("\n");
    return lines.slice(0, 2).join("\n") + (lines.length > 2 ? "..." : "");
  };

  const handleExport = () => {
    const toExport = exportSubject ? entries.filter((e) => e.subject === exportSubject) : entries;
    const lines: string[] = [`错题本导出${exportSubject ? ` - ${exportSubject}` : ""}`, `导出时间: ${new Date().toLocaleString()}`, ""];
    if (toExport.length > 0) {
      const grouped = new Map<string, NotebookEntry[]>();
      for (const entry of toExport) {
        const key = `${entry.subject}::${entry.chapter}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(entry);
      }
      let index = 1;
      for (const [key, items] of grouped.entries()) {
        const [sub, ch] = key.split("::");
        lines.push(`[${sub} / ${ch}]`);
        for (const entry of items) {
          lines.push(`${index}. ${new Date(entry.createdAt).toLocaleString()}`);
          for (const line of entry.content.split("\n")) lines.push(`   ${line}`);
          lines.push("");
          index++;
        }
      }
    } else { lines.push("暂无错题记录"); }
    const blob = new Blob(["\uFEFF", lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `错题本${exportSubject ? `_${exportSubject}` : ""}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-7xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden h-[92vh] flex flex-row" onClick={(e) => e.stopPropagation()}>
        
        {/* ====== 左侧导航栏（可折叠） ====== */}
        <div className={`shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "w-0 overflow-hidden border-r-0" : "w-[240px]"}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">筛选</span>
            <button onClick={() => setSidebarCollapsed(true)} className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" title="收起侧栏">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <button onClick={() => setActiveFilter(null)} className={`w-full text-left text-xs font-mono px-3 py-2 rounded-xl transition-colors ${activeFilter === null ? "bg-emerald-950/30 text-emerald-400 border border-emerald-800/50" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}>
              <Filter className="w-3 h-3 inline mr-1.5" />全部 ({entries.length})
            </button>
            {subjects.map((sub) => {
              const chapterSet = chaptersBySubject.get(sub);
              if (!chapterSet) return null;
              return (
                <div key={sub}>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase px-3 py-1 mt-1">{sub}</div>
                  {Array.from(chapterSet).map((ch) => {
                    const key = `${sub}::${ch}`;
                    const count = entries.filter((e) => e.subject === sub && e.chapter === ch).length;
                    return (
                      <button key={key} onClick={() => toggleFilter(sub, ch)} className={`w-full text-left flex items-center justify-between text-xs font-mono px-3 py-1.5 rounded-lg transition-colors ${activeFilter === key ? "bg-emerald-950/30 text-emerald-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"}`}>
                        <span className="truncate">{ch}</span>
                        <span className="flex items-center gap-1 ml-1 shrink-0">
                          <span className="text-zinc-600">{count}</span>
                          <span className="font-sans text-zinc-500 hover:text-red-400 cursor-pointer px-0.5" title="清空此章节" onClick={(e) => { e.stopPropagation(); handleBatchDeleteChapter(sub, ch); }}>&times;</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ====== 右侧主工作区 ====== */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* 顶部栏 */}
          <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-zinc-800 bg-zinc-900/70 shrink-0">
            <div className="flex items-center gap-3">
              {sidebarCollapsed && (
                <button onClick={() => setSidebarCollapsed(false)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" title="展开侧栏">
                  <PanelLeft className="w-4 h-4" />
                </button>
              )}
              <div>
                <h2 className="text-lg font-bold text-zinc-100 font-mono">错题本</h2>
                <p className="text-[10px] text-zinc-500 font-mono">{entries.length} 条记录</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select value={exportSubject ?? ""} onChange={(e) => setExportSubject(e.target.value || null)} className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-2.5 py-2 text-[10px] font-mono text-zinc-400 outline-none">
                <option value="">全部科目</option>
                {subjects.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <button onClick={() => { cancelEdit(); setShowAddPanel(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-mono font-semibold text-emerald-50 hover:bg-emerald-500 transition-colors"><Plus className="w-3.5 h-3.5" /> 新增错题</button>
              <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"><Download className="w-3.5 h-3.5" /> 导出</button>
              <button onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"><X className="w-4 h-4" /></button>
            </div>
          </div>

          

          {/* 录入面板（折叠展开） */}
          {showAddPanel && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddPanel(false); setShowEditModal(false); setContent(""); }}>
              <div className="w-[92%] h-[95vh] rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/70 shrink-0">
                  <h3 className="text-xs font-bold text-zinc-400 font-mono">新增错题</h3>
                  <button onClick={() => { setShowAddPanel(false); setShowEditModal(false); setContent(""); }} className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-mono text-zinc-400">科目</label>
                      <select value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(""); }} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-500">
                        <option value="">-- 选择科目 --</option>
                        {PRESET_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-mono text-zinc-400">章节</label>
                      <input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="如: 5.5 树与二叉树" className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col min-h-0">
                    <label className="text-xs font-mono text-zinc-400">错题内容</label>
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={18} placeholder="输入题干、错因分析、考点总结..." className="mt-2 w-full flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none focus:border-emerald-500 resize-none min-h-[300px]" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-zinc-800 bg-zinc-900/70 shrink-0">
                  <button onClick={() => { setShowAddPanel(false); setShowEditModal(false); setContent(""); }} className="rounded-xl border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors">取消</button>
                  <button onClick={handleSubmit} disabled={!canSubmit} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-emerald-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors">保存错题</button>
                </div>
              </div>
            </div>
          )}

          {/* 编辑错题弹窗 */}
          {showEditModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={cancelEdit}>
              <div className="w-[92%] h-[95vh] rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/70 shrink-0">
                  <h3 className="text-xs font-bold text-zinc-400 font-mono">编辑错题</h3>
                  <button onClick={cancelEdit} className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex-1 p-3 flex flex-col min-h-0">
                  <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="修改错题内容..." className="w-full flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-base text-zinc-100 outline-none focus:border-emerald-500 resize-none min-h-[500px]" />
                </div>
                <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-zinc-800 bg-zinc-900/70 shrink-0">
                  <button onClick={cancelEdit} className="rounded-xl border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors">取消</button>
                  <button onClick={() => { handleSubmit(); setShowEditModal(false); }} disabled={!canSubmit} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-emerald-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors">保存修改</button>
                </div>
              </div>
            </div>
          )}

          {/* 错题列表（手风琴卡片） */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {filteredEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/50 p-10 text-center text-sm text-zinc-500">
                {activeFilter ? "当前筛选下暂无错题" : "点击上方「+ 新增错题」开始记录"}
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isExpanded = expandId === entry.id;
                const isEditingThis = editingId === entry.id;
                return (
                  <div key={entry.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/50 transition-all">
                    {/* 折叠状态：标题栏 */}
                    <div className="flex items-start justify-between gap-3 p-4 cursor-pointer" onClick={() => { if (!isEditingThis) toggleExpand(entry.id); }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-200">{entry.subject} / {entry.chapter}</span>
                          <span className="text-[10px] text-zinc-600">{new Date(entry.createdAt).toLocaleString()}</span>
                        </div>
                        {!isExpanded && <div className="mt-1 text-xs text-zinc-500 line-clamp-2 whitespace-pre-wrap">{getPreview(entry.content)}</div>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => startEdit(entry)} className="rounded-xl p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 transition-colors" title="编辑"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => onDeleteEntry(entry.id)} className="rounded-xl p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800/50 transition-colors" title="删除"><Trash2 className="w-4 h-4" /></button>
                        <button className="rounded-xl p-2 text-zinc-500 hover:text-zinc-300 transition-colors">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                      </div>
                    </div>

                    {/* 展开状态：编辑/详情区 */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-zinc-800/50 pt-3">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{entry.content}</div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
