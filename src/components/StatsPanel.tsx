import React from "react";
import { DailyRecord, TaskDef } from "../types";
import { todayStr } from "../lib/utils";
import { ArrowLeft, Sparkles, Clock, Calendar, CheckCircle2, Play, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  records: DailyRecord[];
  tasks: TaskDef[];
  onBack: () => void;
  onStartTask: (taskId: string) => void;
  onDeleteRecord: (date: string) => void;
  onDeleteTaskFromRecord: (date: string, taskId: string) => void;
}

export default function StatsPanel({ records, tasks, onBack, onStartTask, onDeleteRecord, onDeleteTaskFromRecord }: Props) {
  // Compute streak
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

  const taskTitleMap = Object.fromEntries(tasks.map((t) => [t.id, t.title]));

  // --- Total focus minutes and sessions
  let totalMinutes = 0;
  let totalSessions = 0;
  for (const r of records) {
    for (const t of r.tasks) {
      totalSessions += t.sessions.length;
      for (const s of t.sessions) {
        totalMinutes += s.durationMinutes || 0;
      }
    }
  }

  const completedDayCount = records.filter((r) => r.tasks.every((t) => t.completed)).length;
  const averageDailyMinutes = records.length ? Math.round((totalMinutes / records.length) * 10) / 10 : 0;
  const completionRate = records.length ? Math.round((completedDayCount / records.length) * 100) : 0;

  // Aggregate per-task stats from records
  const taskAgg: Record<string, { completed: number; mins: number }> = {};
  for (const r of records) {
    for (const t of r.tasks) {
      // Map missing or ephemeral task IDs into a single bucket
      const rawTitle = taskTitleMap[t.taskId];
      const isEphemeral = !rawTitle || /^task_\d{5,}$/.test(rawTitle) || /^lulu_/.test(t.taskId);
      const key = isEphemeral ? "__deleted_temp__" : t.taskId;
      if (!taskAgg[key]) taskAgg[key] = { completed: 0, mins: 0 };
      if (t.completed) taskAgg[key].completed++;
      for (const s of t.sessions) {
        taskAgg[key].mins += s.durationMinutes || 0;
      }
    }
  }
  // Convert aggregation into displayable stats; merge ephemeral bucket into a labeled entry
  const taskStats = Object.entries(taskAgg)
    .map(([taskId, stat]) => {
      if (taskId === "__deleted_temp__") return { taskId, title: "已删除的临时任务", ...stat };
      return { taskId, title: taskTitleMap[taskId] || taskId, ...stat };
    })
    .filter((stat) => stat.completed > 0 || stat.mins > 0)
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 10);

  // Last 7 days
  // Last 7 days data with minutes
  const last7: { date: string; minutes: number; done: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d2 = new Date(today);
    d2.setDate(d2.getDate() - i);
    const ds = d2.toISOString().slice(0, 10);
    const r = records.find((rr) => rr.date === ds);
    const mins = r
      ? r.tasks.reduce((sum, t) => sum + t.sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0), 0)
      : 0;
    last7.push({ date: ds, minutes: mins, done: r ? r.tasks.every((t) => t.completed) : false });
  }

  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set());

  // helpers
  const fmtMinutes = (m: number) => {
    if (m < 1) return "少于 1 分钟";
    if (m < 60) return `${Math.round(m)} 分钟`;
    const h = Math.floor(m / 60);
    const rem = Math.round(m % 60);
    return `${h} 小时${rem > 0 ? ` ${rem} 分钟` : ""}`;
  };

  const maxLast7 = Math.max(...last7.map((d) => d.minutes), 1);

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
          <Clock className="w-6 h-6 text-cyan-400" />
          <div>
            <div className="text-2xl font-bold text-cyan-400">{totalMinutes >= 60 ? `${Math.round((totalMinutes/60)*10)/10} 小时` : fmtMinutes(totalMinutes)}</div>
            <div className="text-xs text-zinc-500 font-mono">总专注时间</div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center gap-3">
          <Calendar className="w-6 h-6 text-amber-400" />
          <div>
            <div className="text-2xl font-bold text-amber-400">{records.length}</div>
            <div className="text-xs text-zinc-500 font-mono">记录天数</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center gap-3">
          <Play className="w-6 h-6 text-cyan-400" />
          <div>
            <div className="text-2xl font-bold text-cyan-400">{totalSessions}</div>
            <div className="text-xs text-zinc-500 font-mono">总专注次数</div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          <div>
            <div className="text-2xl font-bold text-emerald-400">{averageDailyMinutes < 1 ? '少于 1 分钟' : `${Math.round(averageDailyMinutes)} 分钟`}</div>
            <div className="text-xs text-zinc-500 font-mono">日均专注分钟</div>
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

      <div className="mb-8">
        <h3 className="text-sm font-bold text-zinc-300 mb-3">最近 7 天</h3>
        <div className="flex items-end gap-3 h-36 px-2">
          {last7.map((day) => {
            const dayDate = new Date(day.date + "T00:00:00");
            const heightPct = Math.round((day.minutes / maxLast7) * 100);
            return (
              <div key={day.date} className="flex-1 text-center">
                <div className="relative h-full flex items-end">
                  <div className="mx-auto w-8 flex items-end justify-center">
                    <div
                      className={`w-full bg-emerald-500 rounded-t-lg transition-all relative hover:brightness-110`}
                      style={{ height: `${heightPct}%` }}
                      title={`${fmtMinutes(day.minutes)}`}
                    >
                      <div className="text-[10px] text-zinc-800 font-mono pt-1 opacity-90" style={{ transform: "translateY(-100%)" }}>{day.minutes > 0 ? Math.round(day.minutes) : ""}</div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-2">{dayLabels[dayDate.getDay()]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {taskStats.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-zinc-300 mb-3">各任务统计</h3>
          <div className="space-y-2">
            {taskStats.map((stat) => (
              <div
                key={stat.taskId}
                className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg group/taskStat"
              >
                <div>
                  <div className="text-sm text-zinc-200 font-mono">{stat.title}</div>
                  <div className="text-xs text-zinc-500 font-mono">完成 {stat.completed} 天 • 累计 {Math.round(stat.mins)} 分钟</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onStartTask(stat.taskId)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded hidden group-hover/taskStat:block"
                  >
                    ▶ 继续专注
                  </button>
                  <div className="text-xs text-zinc-500 font-mono">{stat.title === '已删除的临时任务' ? '' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-zinc-300 mb-3">历史记录</h3>
        {records.length === 0 ? (
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-500 text-sm">
            当前还没有专注记录。完成任务或开始番茄钟后，会在这里生成真实学习统计。
          </div>
        ) : (
          <div className="space-y-2">
            {records.slice(-30).reverse().map((record) => {
              const completedCount = record.tasks.filter((t) => t.completed).length;
              const focusMinutes = record.tasks.reduce(
                (sum, t) => sum + t.sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0),
                0
              );
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
                  <button
                    onClick={toggleExpand}
                    className="w-full p-3 flex items-center justify-between gap-4 hover:bg-zinc-800/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                      <div>
                        <div className="text-sm text-zinc-200 font-semibold">{record.date}</div>
                        <div className="text-xs text-zinc-500">{completedCount} / {record.tasks.length} 个任务完成</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-mono text-zinc-400">
                        {focusMinutes} 分钟专注
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteRecord(record.date); }}
                        className="text-zinc-600 hover:text-red-400 opacity-0 group-hover/record:opacity-100 transition-all p-1"
                        title="删除此日期全部记录"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-zinc-800 px-3 py-2 space-y-1">
                      {record.tasks.map((task, idx) => {
                        const taskTitle = taskTitleMap[task.taskId] || task.taskId;
                        const sessMinutes = task.sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
                        const sessCount = task.sessions.length;
                        return (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-800/30 group/task">
                            <div className="flex items-center gap-2 min-w-0">
                              {task.completed ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> : <div className="w-3 h-3 rounded-full border border-zinc-600 shrink-0" />}
                              <span className="text-xs text-zinc-300 truncate">{taskTitle}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] text-zinc-500 font-mono">{sessCount > 0 ? `${sessMinutes} 分钟` : "未计时"}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeleteTaskFromRecord(record.date, task.taskId); }}
                                className="text-zinc-600 hover:text-red-400 opacity-0 group-hover/task:opacity-100 transition-all p-0.5"
                                title="删除此任务记录"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
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
