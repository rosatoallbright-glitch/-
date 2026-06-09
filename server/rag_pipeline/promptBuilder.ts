// 提示词构建器 —— 四层架构第四层
import type { ParsedQuestion, ChatMessage } from "./types";
import type { FactLockResult } from "./factLock";
import type { RagChunk } from "./retrieval";
import { formatRagContext } from "./retrieval";

const INTENT_HINTS: Record<string, string> = {
  count: "用户在统计题数，必须优先输出准确数量，不要补充无关解释。",
  locate: "用户在定位题号，优先给出题目位置、章节和标准答案，不能乱改题号。",
  knowledge: "用户在问概念或知识点，优先结合教材解释，可补常识，但不能改题库事实。",
  fuzzy: "用户提问较模糊，优先做相关召回并结合上下文解释，不确定时要说明不确定。",
  mixed: "混合型问题，需要同时兼顾结构化事实和教材理解。",
};

export interface PromptContext { parsed: ParsedQuestion; factResult: FactLockResult; chunks: RagChunk[]; }

export function buildSystemPrompt(ctx: PromptContext): ChatMessage[] {
  const sysMessages: ChatMessage[] = [];
  const { parsed, factResult, chunks } = ctx;
  if (factResult.hit && factResult.structuredContext) {
    const factLockPrompt = ["【事实锁定 —— JSON 题库作为唯一事实源】","以下信息来自题库，**不可更改**：",factResult.structuredContext,"","模型必须遵守：","- 题号不可改","- 章节不可改","- 标准答案不可改",...(parsed.isMultiQuestion?["- 多题必须逐题回答"]:[])].join("\n");
    sysMessages.push({ role: "system", content: factResult.responseDirective + "\n\n" + factLockPrompt });
    if (!parsed.needAnswer) sysMessages.push({ role: "system", content: ["【输出约束】","用户要求不要答案：不输出标准答案，只输出解题思路、易错点",...(parsed.isMultiQuestion?[`${parsed.questionNos.length}道题逐题输出`]:[])].join("\n") });
  }
  if (chunks.length > 0) {
    const contextText = formatRagContext(chunks).slice(0, 12000);
    const intentHint = INTENT_HINTS[parsed.intent] || INTENT_HINTS.knowledge;
    sysMessages.push({ role: "system", content: "以下是从教材库中检索到的相关内容：\n\n" + intentHint + "\n\n" + contextText });
  }
  if (parsed.isMultiQuestion) sysMessages.push({ role: "system", content: ["【多题输出格式】",...parsed.questionNos.map(qn=>`第${qn}题：${parsed.needAnswer?"答案+思路":"思路+易错点"}`),parsed.needAnswer?"有题库命中的答案须与题库一致":"只输出思路和易错点"].join("\n") });
  if (parsed.isCountQuery) sysMessages.push({ role: "system", content: "直接给出统计结果和准确题号列表。" });
  return sysMessages;
}
