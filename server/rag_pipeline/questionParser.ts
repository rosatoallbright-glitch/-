// 问题解析器 —— 四层架构第一层

import type { ParsedQuestion, UserIntent } from "./types";

export function toChineseNumberValue(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  const map: Record<string, number> = { 一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10 };
  if (value === "十") return 10;
  if (value.includes("十")) { const [l,r] = value.split("十"); return (l?map[l]:1)*10+(r?map[r]:0); }
  return map[value]||null;
}

export function normalizeQuestionNo(value: string): string {
  const n = toChineseNumberValue(value.trim());
  if (!n) return value.trim();
  return String(n).padStart(2, "0");
}

export function extractSection(text: string): string | undefined {
  const matches = text.match(/\d+(?:\.\d+)+/g);
  if (!matches) return undefined;
  for (const m of matches) { if (m.split(".").length <= 4) return m; }
  return undefined;
}

export function isSectionCountQuery(text: string): boolean {
  return /(有几题|有多少题|几道题|多少题|本节几题|这一节几题|这节几题|共.*题)/.test(text);
}

export function extractQuestionNo(text: string): string | undefined {
  if (isSectionCountQuery(text)) return undefined;
  const explicit = text.match(/第\s*([一二三四五六七八九十0-9]+)\s*题/)?.[1];
  if (explicit) return normalizeQuestionNo(explicit);
  const wrapped = text.match(/[（(]\s*([0-9]{1,2})\s*[)）]/)?.[1];
  if (wrapped) return normalizeQuestionNo(wrapped);
  return undefined;
}

export function extractQuestionNos(text: string): string[] {
  if (isSectionCountQuery(text)) return [];
  const dotListMatch = text.match(/[试题]的\s*(\d{1,2}(?:[.,，.。]\d{1,2})+)/);
  if (dotListMatch) {
    const parts = dotListMatch[1].split(/[.,，.。]/);
    const nos = parts.map((p) => normalizeQuestionNo(p.trim())).filter(Boolean);
    if (nos.length > 1) return nos;
  }
  const single = extractQuestionNo(text);
  if (!single) return [];
  const multiMatch = text.match(/第\s*([一二三四五六七八九十0-9]+(?:\s*[,，、和及]\s*[一二三四五六七八九十0-9]+)+)\s*题/);
  if (multiMatch) {
    const parts = multiMatch[1].split(/[,，、和及]/);
    return parts.map((p) => normalizeQuestionNo(p.trim())).filter(Boolean);
  }
  const rangeMatch = text.match(/第\s*(\d{1,2})\s*[-–—至到]\s*(\d{1,2})\s*题/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (start > 0 && end > 0 && start <= end && end - start <= 20) {
      const result: string[] = [];
      for (let i = start; i <= end; i++) result.push(String(i).padStart(2, "0"));
      return result;
    }
  }
  return [single];
}

export function detectNoAnswerRequest(text: string): boolean {
  return /(不用答案|不要答案|不输出答案|别给答案|只讲思路|只讲易错点|不要.*结果)/.test(text);
}

export function classifyUserIntent(text: string, historyHint = ""): UserIntent {
  const merged = (historyHint + "\n" + text).replace(/\r\n/g, "\n").replace(/[\u3000\t]+/g, " ").trim();
  const hasSection = Boolean(extractSection(merged));
  const hasQuestionNo = Boolean(extractQuestionNo(merged));
  const countIntent = isSectionCountQuery(merged);
  const locateIntent = /(第\s*[一二三四五六七八九十0-9]+\s*题|第几题|哪题|哪一道题|题号|定位)/.test(merged);
  if (countIntent) return "count";
  if ((hasSection && hasQuestionNo) || locateIntent) return "locate";
  if (hasSection || hasQuestionNo) return "mixed";
  return "knowledge";
}

export function parseQuestion(text: string, historyHint = ""): ParsedQuestion {
  const questionNos = extractQuestionNos(text);
  const intent = classifyUserIntent(text, historyHint);
  return {
    rawText: text,
    section: extractSection(text) || extractSection(historyHint),
    questionNos, intent,
    needAnswer: !detectNoAnswerRequest(text),
    needExplanation: intent === "knowledge" || intent === "mixed",
    isMultiQuestion: questionNos.length > 1,
    isCountQuery: isSectionCountQuery(text),
    historyHint,
  };
}
