import { useState, useEffect, useRef, useCallback } from "react";
import { X, Play, Pause } from "lucide-react";

const BREAK_SEC = 5 * 60;

interface Props {
  taskName: string;
  focusMinutes: number;
  onEnd: (elapsedSeconds: number) => void;
  onClose: () => void;
}

export default function FocusTimer({ taskName, focusMinutes, onEnd, onClose }: Props) {
  const focusSeconds = Math.max(1, Math.round(focusMinutes)) * 60;
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [seconds, setSeconds] = useState(focusSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  const totalSeconds = phase === "focus" ? focusSeconds : BREAK_SEC;
  const progress = 1 - seconds / totalSeconds;

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setSeconds((s) => (s <= 1 ? 0 : s - 1));
    elapsedRef.current += 1;
  }, []);

  useEffect(() => {
    clearTimer();
    if (running) {
      intervalRef.current = window.setInterval(tick, 1000);
    }
    return clearTimer;
  }, [running, phase, clearTimer, tick]);

  useEffect(() => {
    if (seconds === 0 && running) {
      clearTimer();
      if (phase === "focus") {
        setPhase("break");
        setSeconds(BREAK_SEC);
      } else {
        onEnd(elapsedRef.current);
      }
    }
  }, [seconds, phase, running, clearTimer, onEnd]);

  const toggleRun = () => setRunning(!running);
  const handleEnd = () => onEnd(elapsedRef.current);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl w-full max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-zinc-500">
            {phase === "focus" ? "专注中" : "休息"}
          </span>
          <button
            onClick={handleEnd}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-zinc-300 mb-4 truncate">{taskName}</div>

        {/* Timer ring */}
        <div className="relative w-40 h-40 mx-auto mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
            <circle
              cx="80" cy="80" r="70"
              fill="none"
              stroke="currentColor"
              className="text-zinc-800"
              strokeWidth="6"
            />
            <circle
              cx="80" cy="80" r="70"
              fill="none"
              stroke="currentColor"
              className={phase === "focus" ? "text-emerald-500" : "text-amber-500"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 70}`}
              strokeDashoffset={`${2 * Math.PI * 70 * (1 - progress)}`}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-mono font-bold text-zinc-100 tabular-nums">
              {formatTime(seconds)}
            </span>
          </div>
        </div>

        <button
          onClick={toggleRun}
          className="w-full py-2.5 rounded-lg font-mono font-bold text-sm flex items-center justify-center gap-2 transition-colors bg-emerald-600 hover:bg-emerald-500 text-emerald-50"
        >
          {running ? (
            <>
              <Pause className="w-4 h-4" /> 暂停
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> {seconds < totalSeconds ? "继续" : "开始"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
