import type {
  ClefMode,
  PracticeMode,
  RangePreset,
  KeySignature,
} from "../trainers/types";

const HISTORY_KEY = "notewise.sessions.v1";
const COUNT_KEY = "notewise.session-count.v1";
const MAX_SESSIONS = 20;

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
  keySignature?: KeySignature;
  finalBpm?: number;
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

export function loadSessionCount() {
  if (typeof window === "undefined") return 0;
  const stored = Number(window.localStorage.getItem(COUNT_KEY));
  return Number.isFinite(stored) && stored >= 0 ? stored : loadSessionHistory().length;
}

export function saveSessionRecord(record: SessionRecord) {
  const currentHistory = loadSessionHistory();
  const isNew = !currentHistory.some((session) => session.id === record.id);
  const history = currentHistory.filter(
    (session) => session.id !== record.id,
  );
  const nextHistory = [record, ...history].slice(0, MAX_SESSIONS);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  const totalCount = loadSessionCount() + (isNew ? 1 : 0);
  window.localStorage.setItem(COUNT_KEY, String(totalCount));
  return { history: nextHistory, totalCount };
}
