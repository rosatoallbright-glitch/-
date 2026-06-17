import React from "react";
import { DailyRecord } from "../types";
import { todayStr } from "../api/utils";
import { ArrowLeft, Sparkles, Clock, Calendar, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  records: DailyRecord[];
  onBack: () => void;
  onDeleteRecord: (date: string) => void;
  onDeleteTaskFromRecord: (date: string, taskId: string) => void;
}

export default function StatsPanel({ records, onBack, onDeleteRecord, onDeleteTaskFromRecord }: Props) {
  // 计算连续天数
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(today);

  const todayRec = records.find((r) => r.date === todayStr());
  if (todayRec && todayRec.tasks.every((t) => t.completed)) streak++;

  for (let i = 1; i < 365; i++) {
    d.setDate(d.getDate() - 1);
    const ds = d.toISOString().slice(0, 10);
    const rec = records.find((r) => r.date === ds);
    if (rec && rec.tasks.every((t) => t.completed)) streak++;
    else break;
  }

  const completedDayCount = records.filter((r) => r.tasks.every((t) => t.completed)).length;
  const completionRate = records.length ? Math.round((completedDayCount / records.length) * 100) : 0;

  const getTaskTitle = (taskId: string, fallbackTitle?: string) => fallbackTitle || taskId;

  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = React.useState<Set<string>>(new Set());

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-zinc-100">学习统计</h2>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-amber-400" />
          <div>
            <div className="text-2xl font-bold text-emerald-400">{streak}</div>
            <div className="text-xs text-zinc-500 font-mono">连续天数</div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center gap-3">
          <Calendar className="w-6 h-6 text-amber-400" />
          <div>
            <div className="text-2xl font-bold text-amber-400">{records.length}</div>
            <div className="text-xs text-zinc-500 font-mono">记录天数</div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center gap-3">
          <Clock className="w-6 h-6 text-amber-400" />
          <div>
            <div className="text-2xl font-bold text-amber-400">{completionRate}%</div>
            <div className="text-xs text-zinc-500 font-mono">完成率</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-zinc-300 mb-3">历史记录</h3>
        {records.length === 0 ? (
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-500 text-sm">
            当前还没有记录。完成任务后，会在这里生成学习统计。
          </div>
        ) : (
          <div className="space-y-2">
            {records.slice(-30).reverse().map((record) => {
              const completedCount = record.tasks.filter((t) => t.completed).length;
              const isExpanded = expandedDates.has(record.date);
              const toggleExpand = () => {
                setExpandedDates((prev) => {
                  const next = new Set(prev);
                  if (next.has(record.date)) next.delete(record.date);
                  else next.add(record.date);
                  return next;
                });
              };
              return (
                <div key={record.date} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden group/record">
                  <div
                    onClick={toggleExpand}
                    className="w-full p-3 flex items-center justify-between gap-4 hover:bg-zinc-800/50 transition-colors text-left cursor-pointer select-none"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleExpand(); }}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                      <div>
                        <div className="text-sm text-zinc-200 font-semibold">{record.date}</div>
                        <div className="text-xs text-zinc-500">{completedCount} / {record.tasks.length} 个任务完成</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteRecord(record.date); }}
                      className="text-zinc-600 hover:text-red-400 opacity-0 group-hover/record:opacity-100 transition-all p-1"
                      title="删除此日期全部记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-zinc-800 px-3 py-2 space-y-1">
                      {record.tasks.map((task, idx) => {
                        const taskTitle = getTaskTitle(task.taskId, task.taskTitle);
                        const taskKey = `${record.date}-${idx}`;
                        const isTaskExpanded = expandedTasks.has(taskKey);
                        const toggleTask = () => {
                          setExpandedTasks((prev) => {
                            const next = new Set(prev);
                            if (next.has(taskKey)) next.delete(taskKey);
                            else next.add(taskKey);
                            return next;
                          });
                        };
                        return (
                          <div key={idx} className="rounded hover:bg-zinc-800/30 group/task">
                            <div
                              onClick={task.completed && task.note ? toggleTask : undefined}
                              className={`flex items-center justify-between py-1.5 px-2 ${task.completed && task.note ? "cursor-pointer select-none" : ""}`}
                              role={task.completed && task.note ? "button" : undefined}
                              tabIndex={task.completed && task.note ? 0 : undefined}
                              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && task.completed && task.note) toggleTask(); }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {task.completed ? <Calendar className="w-3 h-3 text-emerald-400 shrink-0" /> : <div className="w-3 h-3 rounded-full border border-zinc-600 shrink-0" />}
                                <span className="text-xs text-zinc-300 truncate">{taskTitle}</span>
                                {task.completed && task.note && (
                                  <span className="text-[9px] text-zinc-600 ml-1 shrink-0">{isTaskExpanded ? "▲" : "▼"}</span>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeleteTaskFromRecord(record.date, task.taskId); }}
                                className="text-zinc-600 hover:text-red-400 opacity-0 group-hover/task:opacity-100 transition-all p-0.5"
                                title="删除此任务记录"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {isTaskExpanded && task.note && (
                              <div className="pb-2 ml-5 pl-3 border-l-2 border-emerald-800/50">
                                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{task.note}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}