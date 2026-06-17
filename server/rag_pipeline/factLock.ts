// 事实锁定器 —— 四层架构第三层
import type { ParsedQuestion, QaItem } from "./types";
import type { ExercisePair } from "./retrieval";
import { extractSection, extractQuestionNo, isSectionCountQuery } from "./questionParser";

export interface FactLockResult { hit: boolean; entries: FactLockEntry[]; structuredContext: string; responseDirective: string; }
export interface FactLockEntry { section: string; questionNo: string; questionText: string; answerText: string; type: string; }

function normalizeNumericText(value: string): string {
  return (value || "").replace(/[^0-9.]/g, "").replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
}

function normalizeQuestionNoValue(value: string): string {
  return value.replace(/^0+/, "") || "0";
}

function matchesQuestionNo(candidate: string, target: string): boolean {
  return normalizeQuestionNoValue(candidate) === normalizeQuestionNoValue(target);
}

function buildEntry(q: QaItem): FactLockEntry {
  return { section: q.section, questionNo: q.questionNo, questionText: q.questionText, answerText: q.answerText, type: q.type };
}

function findSectionCandidates(qaBank: QaItem[], parsed: ParsedQuestion): QaItem[] {
  const normalizedSection = parsed.section ? normalizeNumericText(parsed.section) : "";
  if (!normalizedSection) return [];
  const normalizedChapter = parsed.section ? parsed.section.split(".")[0] : "";
  return qaBank.filter((q: QaItem) => {
    const qSection = normalizeNumericText(q.section || "");
    const qChapter = String(q.chapter || "").trim();
    if (qSection && qSection === normalizedSection) return true;
    if (qSection && (qSection.startsWith(normalizedSection) || normalizedSection.startsWith(qSection))) return true;
    if (normalizedChapter && qChapter && qChapter === normalizedChapter) return true;
    return false;
  });
}

export function lookupQaBank(parsed: ParsedQuestion, qaBank: QaItem[]): FactLockResult {
  const empty: FactLockResult = { hit: false, entries: [], structuredContext: "", responseDirective: "" };
  if (qaBank.length === 0) return empty;

  const sectionQs = findSectionCandidates(qaBank, parsed);
  const allMatches = parsed.section ? sectionQs : qaBank;

  if (parsed.questionNos.length > 0) {
    const entries: FactLockEntry[] = [];
    for (const qn of parsed.questionNos) {
      const hit = allMatches.find((q) => matchesQuestionNo(q.questionNo, qn));
      if (hit && !entries.some((e) => e.section === hit.section && e.questionNo === hit.questionNo)) {
        entries.push(buildEntry(hit));
      }
    }
    if (entries.length > 0) {
      const ctx = entries.map((e) => `${e.section} 第${e.questionNo}题\n题干：${e.questionText}\n答案与解析：${e.answerText}`).join("\n\n");
      return {
        hit: true,
        entries,
        structuredContext: ctx,
        responseDirective: parsed.needAnswer ? "逐题回答，按答案→教材依据→简要解释输出。不能改动题号、章节、标准答案。" : "逐题输出思路+易错点，不展示答案。",
      };
    }
  }

  if (parsed.section && (parsed.isCountQuery || !parsed.questionNos.length) && sectionQs.length > 0) {
    const qNos = [...new Set(sectionQs.map((q) => q.questionNo))].sort((a, b) => Number(a) - Number(b));
    const normalizedSection = normalizeNumericText(parsed.section);
    return {
      hit: true,
      entries: [],
      structuredContext: `${normalizedSection} 共 ${sectionQs.length} 题\n题号：${qNos.join("、")}`,
      responseDirective: "直接给出准确统计。",
    };
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
