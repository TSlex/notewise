import type {
  ClefMode,
  PracticeMode,
  RangePreset,
} from "../trainers/types";

const HISTORY_KEY = "notewise.sessions.v1";
const MAX_SESSIONS = 16;

export type SessionRecord = {
  id: string;
  mode: PracticeMode;
  finishedAt: string;
  durationSeconds: number;
  answered: number;
  accuracy: number;
  mistakes: number;
  bestStreak: number;
  missed: number;
  clefMode: ClefMode;
  range: RangePreset;
  finalFlowDurationMs?: number;
};

export function loadSessionHistory(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(HISTORY_KEY) || "[]",
    );
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SESSIONS) : [];
  } catch {
    return [];
  }
}

export function saveSessionRecord(record: SessionRecord) {
  const history = loadSessionHistory().filter(
    (session) => session.id !== record.id,
  );
  const nextHistory = [record, ...history].slice(0, MAX_SESSIONS);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}
