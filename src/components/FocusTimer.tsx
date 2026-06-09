import { useState, useEffect, useRef, useCallback } from "react";
import { X, Play, Pause, Check } from "lucide-react";

const BREAK_SEC = 5 * 60;

export interface TimerResult {
  elapsedSeconds: number;
  startTime: number;
  endTime: number;
}

interface Props {
  taskName: string;
  focusMinutes: number;
  timerMode?: "countdown" | "countup";
  onEnd: (result: TimerResult) => void;
  onClose: () => void;
}

export default function FocusTimer({ taskName, focusMinutes, timerMode = "countdown", onEnd, onClose }: Props) {
  const focusSeconds =
    timerMode === "countup"
      ? Math.max(1, Math.round(focusMinutes || 120)) * 60
      : Math.max(1, Math.round(focusMinutes)) * 60;

  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [seconds, setSeconds] = useState(timerMode === "countdown" ? focusSeconds : 0);
  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false); // 新增状态：确保 UI 瞬间响应
  const intervalRef = useRef<number | null>(null);

  const firstStartRef = useRef(0);
  const blockStartRef = useRef(0);
  const blockPausedRef = useRef(0);
  const completedRef = useRef(0);
  const endedRef = useRef(false);

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finish = useCallback((now: number) => {
    if (endedRef.current) return;
    endedRef.current = true;
    clearTimer();
    if (running) {
      blockPausedRef.current += Math.floor((now - blockStartRef.current) / 1000);
    }
    const totalSec = completedRef.current + blockPausedRef.current;
    const start = firstStartRef.current || now;
    
    // 触发结束并传回数据
    onEndRef.current({ elapsedSeconds: totalSec, startTime: start, endTime: now });
  }, [running, clearTimer]);

  /** 组件卸载时自动保存未结束的 session (安全网) */
  useEffect(() => {
    return () => {
      if (!endedRef.current && firstStartRef.current > 0) {
        const now = Date.now();
        if (running) {
          blockPausedRef.current += Math.floor((now - blockStartRef.current) / 1000);
        }
        const totalSec = completedRef.current + blockPausedRef.current;
        if (totalSec > 0) {
          try { onEndRef.current({ elapsedSeconds: totalSec, startTime: firstStartRef.current, endTime: now }); } catch {}
        }
      }
    };
  }, []);

  const tick = useCallback(() => {
    if (!running) return;
    const now = Date.now();
    const blockSec = blockPausedRef.current + Math.floor((now - blockStartRef.current) / 1000);
    const totalSec = completedRef.current + blockSec;

    if (timerMode === "countdown") {
      if (phase === "focus") {
        const remaining = focusSeconds - blockSec;
        if (remaining <= 0) {
          clearTimer();
          completedRef.current += blockSec;
          blockPausedRef.current = 0;
          blockStartRef.current = now;
          setPhase("break");
          setSeconds(BREAK_SEC);
        } else {
          setSeconds(remaining);
        }
      } else {
        const remaining = BREAK_SEC - blockSec;
        if (remaining <= 0) {
          clearTimer();
          completedRef.current += blockSec;
          setRunning(false);
          onEndRef.current({ elapsedSeconds: completedRef.current, startTime: firstStartRef.current, endTime: now });
        } else {
          setSeconds(remaining);
        }
      }
    } else {
      setSeconds(totalSec);
    }
  }, [running, timerMode, phase, focusSeconds, clearTimer]);

  useEffect(() => {
    clearTimer();
    if (running) {
      intervalRef.current = window.setInterval(tick, 1000);
    }
    return clearTimer;
  }, [running, phase, clearTimer, tick]);

  const toggleRun = () => {
    const now = Date.now();
    if (!hasStarted) setHasStarted(true); // 瞬间更新 UI 状态
    
    if (running) {
      blockPausedRef.current += Math.floor((now - blockStartRef.current) / 1000);
      setRunning(false);
    } else {
      if (firstStartRef.current === 0) firstStartRef.current = now;
      blockStartRef.current = now;
      setRunning(true);
    }
  };

  const handleEnd = () => finish(Date.now());

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const totalSeconds = phase === "focus" ? focusSeconds : BREAK_SEC;
  const progress =
    timerMode === "countdown"
      ? 1 - seconds / totalSeconds
      : Math.min(seconds / focusSeconds, 1);

  const ringColor =
    timerMode === "countup" || phase === "focus" ? "text-emerald-500" : "text-amber-500";

  const phaseLabel = timerMode === "countup" ? "正向计时" : phase === "focus" ? "专注中" : "休息中";

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-3xl border border-zinc-800 bg-[linear-gradient(180deg,rgba(30,41,59,0.96),rgba(17,24,39,0.98))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">{phaseLabel}</div>
          <div className="truncate text-xs text-zinc-300">{taskName}</div>
        </div>
        {/* X 按钮现在纯粹负责关闭面板 */}
        <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300" title="隐藏面板">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" className="text-zinc-800" strokeWidth="8" />
            <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" className={ringColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 70}`} strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress)}`}
              style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-mono font-bold tabular-nums text-zinc-100">{formatTime(seconds)}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full rounded-full ${ringColor.replace("text-", "bg-")}`}
              style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, transition: "width 1s linear" }} />
          </div>
          
          {/* 新增了并排的按钮组 */}
          <div className="flex items-center gap-2">
            <button onClick={toggleRun}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-emerald-50 transition-colors hover:bg-emerald-500">
              {running ? (<><Pause className="w-4 h-4" /> 暂停</>) : (<><Play className="w-4 h-4" /> {hasStarted ? "继续" : "开始"}</>)}
            </button>
            
            {/* 只有点击过开始，才会显示“完成”按钮 */}
            {hasStarted && (
              <button onClick={handleEnd} title="完成并结算"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-2.5 text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white">
                <Check className="w-4 h-4" /> 完成
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}