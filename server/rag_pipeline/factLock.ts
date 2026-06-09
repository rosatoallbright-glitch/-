// 事实锁定器 —— 四层架构第三层
import type { ParsedQuestion, QaItem } from "./types";
import type { ExercisePair } from "./retrieval";
import { extractSection, extractQuestionNo, isSectionCountQuery } from "./questionParser";

export interface FactLockResult { hit: boolean; entries: FactLockEntry[]; structuredContext: string; responseDirective: string; }
export interface FactLockEntry { section: string; questionNo: string; questionText: string; answerText: string; type: string; }

export function lookupQaBank(parsed: ParsedQuestion, qaBank: QaItem[]): FactLockResult {
  const empty: FactLockResult = { hit: false, entries: [], structuredContext: "", responseDirective: "" };
  if (qaBank.length === 0) return empty;
  const normalizedSection = parsed.section ? parsed.section.replace(/[^0-9.]/g, "") : "";
  const sectionQs = normalizedSection ? qaBank.filter((q: QaItem) => (q.section || "").replace(/[^0-9.]/g, "") === normalizedSection) : [];
  if (parsed.isMultiQuestion && parsed.questionNos.length > 0) {
    const entries: FactLockEntry[] = []; const notFound: string[] = [];
    for (const qn of parsed.questionNos) { const hit = sectionQs.find((q) => q.questionNo === qn); if (hit) entries.push({ section: hit.section, questionNo: hit.questionNo, questionText: hit.questionText, answerText: hit.answerText, type: hit.type }); else notFound.push(qn); }
    if (entries.length > 0) {
      const ctx = entries.map(e => `${e.section} 第${e.questionNo}题\n题干：${e.questionText}\n答案与解析：${e.answerText}`).join("\n\n");
      return { hit: true, entries, structuredContext: ctx, responseDirective: parsed.needAnswer ? "逐题回答，按答案→教材依据→简要解释输出。不能改动题号、章节、标准答案。" : "逐题输出思路+易错点，不展示答案。" };
    }
  }
  if (parsed.questionNos.length === 1 && normalizedSection) {
    const hit = sectionQs.find((q) => q.questionNo === parsed.questionNos[0]);
    if (hit) return { hit: true, entries: [{ section: hit.section, questionNo: hit.questionNo, questionText: hit.questionText, answerText: hit.answerText, type: hit.type }], structuredContext: `${hit.section} 第${hit.questionNo}题\n题干：${hit.questionText}\n答案与解析：${hit.answerText}`, responseDirective: parsed.needAnswer ? "按答案→教材依据→解释输出，不改题号章节答案。" : "只输出思路和易错点，不展示答案。" };
  }
  if (normalizedSection && (parsed.isCountQuery || !parsed.questionNos.length) && sectionQs.length > 0) {
    const qNos = [...new Set(sectionQs.map((q) => q.questionNo))].sort((a,b)=>Number(a)-Number(b));
    return { hit: true, entries: [], structuredContext: `${normalizedSection} 共 ${sectionQs.length} 题\n题号：${qNos.join("、")}`, responseDirective: "直接给出准确统计。" };
  }
  return empty;
}

export function buildFactLockSummary(hit: ExercisePair|null, structuredContext: string): string {
  if (!hit) return structuredContext;
  return ["【事实锁定】",`章节：${hit.section||"未知"}`,`题号：第${hit.questionNo}题`,`题干：${hit.questionText}`,`标准答案与解析：${hit.answerText}`,structuredContext?`补充：${structuredContext}`:""].filter(Boolean).join("\n");
}

export function findExercisePair(query: string, exercises: ExercisePair[], historyHint = ""): ExercisePair|null {
  const section = extractSection(query)||extractSection(historyHint);
  const questionNo = extractQuestionNo(query); if (!questionNo) return null;
  const ns = section?section.replace(/[章节节篇部分\s]+/g,""):"";
  const candidates = exercises.filter(ex=>ex.questionNo===questionNo); if(candidates.length===0)return null;
  if(!ns||!section)return candidates[0];
  return candidates.find(ex=>(ex.section||"").replace(/[章节节篇部分\s]+/g,"")===ns||ex.filePath.includes(section)||section.includes(ex.section||""))||candidates[0];
}
