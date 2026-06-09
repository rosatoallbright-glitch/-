// RAG Pipeline 共享类型（服务端）

export type UserIntent = "count" | "locate" | "knowledge" | "fuzzy" | "mixed";

export interface ParsedQuestion {
  rawText: string;
  section?: string;
  questionNos: string[];
  intent: UserIntent;
  needAnswer: boolean;
  needExplanation: boolean;
  isMultiQuestion: boolean;
  isCountQuery: boolean;
  historyHint: string;
}

export interface QaItem {
  id: string;
  book: string;
  chapter: string;
  section: string;
  questionNo: string;
  type: string;
  questionText: string;
  answerText: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
