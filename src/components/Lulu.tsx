import { useEffect, useState } from "react";
import { LuluState } from "../types";
import { cn } from "../api/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  state: LuluState;
  onClick: () => void;
}

const EXPRESSIONS: Record<LuluState, { face: string; color: string; border: string; bg: string; label: string }> = {
  peaceful: { face: "(o.o)",  color: "text-cyan-300",    border: "border-cyan-800",    bg: "bg-cyan-950",    label: "平静" },
  happy:    { face: "(^o^)",  color: "text-emerald-300",  border: "border-emerald-700", bg: "bg-emerald-950",  label: "开心" },
  thinking: { face: "(o.o?)", color: "text-amber-300",   border: "border-amber-700",   bg: "bg-amber-950",   label: "思考中" },
  proud:    { face: "(^.^)",  color: "text-purple-300",  border: "border-purple-700",  bg: "bg-purple-950",  label: "骄傲" },
};

const HAPPY_MSGS = ["干得漂亮！", "Lulu 很满意。", "继续保持！", "太棒了！"];

export default function Lulu({ state, onClick }: Props) {
  const [message, setMessage] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [winking, setWinking] = useState(false);
  const expr = EXPRESSIONS[state] || EXPRESSIONS.peaceful;

  // 随机眨眼
  useEffect(() => {
    if (state === "peaceful" || state === "happy" || state === "proud") {
      const t = setInterval(() => {
        setWinking(true);
        setTimeout(() => setWinking(false), 200);
      }, 4000 + Math.random() * 6000);
      return () => clearInterval(t);
    }
  }, [state]);

  // 对话气泡
  useEffect(() => {
    if (state === "happy" || state === "proud") {
      setMessage(HAPPY_MSGS[Math.floor(Math.random() * HAPPY_MSGS.length)]);
      setShowBubble(true);
      const t = setTimeout(() => setShowBubble(false), 3000);
      return () => clearTimeout(t);
    } else {
      setShowBubble(false);
    }
  }, [state]);

  const face = winking && (state === "peaceful" || state === "happy") ? "(-.o)" : expr.face;

  const anim = state === "thinking"
    ? { rotate: [0, -5, 5, 0] }
    : state === "proud"
    ? { scale: [1, 1.1, 1] }
    : { y: [0, -2, 0] };

  const animDuration = state === "thinking" ? 1.5 : 2;

  return (
    <div className="flex items-center gap-4">
      <AnimatePresence>
        {showBubble && message && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.9 }}
            className="font-mono text-xs px-3 py-1.5 rounded-lg whitespace-nowrap border backdrop-blur-sm text-emerald-400 bg-emerald-950/40 border-emerald-900/50"
          >
            {">"} {message}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onClick}
        className={cn(
          "h-11 w-11 rounded-lg overflow-hidden flex items-center justify-center font-mono text-lg transition-all duration-300 relative cursor-pointer hover:scale-110 border",
          expr.border, expr.bg
        )}
        title={`Lulu (${expr.label}) - 点击聊天`}
      >
        <motion.div
          animate={anim}
          transition={{ repeat: Infinity, duration: animDuration, ease: "easeInOut" }}
          className={cn("relative z-10 tracking-tighter", expr.color)}
        >
          {face}
        </motion.div>

        {(state === "peaceful" || state === "happy") && (
          <motion.div
            animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className={cn("absolute bottom-0 w-full h-1/3", state === "happy" ? "bg-emerald-500/15" : "bg-cyan-500/15")}
          />
        )}
      </button>
    </div>
  );
}