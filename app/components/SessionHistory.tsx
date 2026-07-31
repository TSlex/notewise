"use client";

import type { SessionRecord } from "../lib/sessionHistory";

type SessionHistoryProps = {
  sessions: SessionRecord[];
  totalSessions: number;
  elapsedSeconds: number;
  currentAccuracy: number;
  currentAnswered: number;
  currentMode: "study" | "flow";
};

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, Math.floor(totalSeconds % 60));
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return `Сегодня, ${time}`;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionHistory({
  sessions,
  totalSessions,
  elapsedSeconds,
  currentAccuracy,
  currentAnswered,
  currentMode,
}: SessionHistoryProps) {
  return (
    <aside className="history-sidebar">
      <div className="history-heading">
        <p className="eyebrow">Практика</p>
        <h2>Сессии</h2>
      </div>

      <section className="current-session-card">
        <div className="current-session-top">
          <span className="live-indicator">Сейчас</span>
          <strong>{formatDuration(elapsedSeconds)}</strong>
        </div>
        <p>
          {currentMode === "flow" ? "Чтение на скорость" : "Чтение нот"}
        </p>
        <div className="current-session-metrics">
          <span>
            <strong>{currentAccuracy}%</strong>
            точность
          </span>
          <span>
            <strong>{currentAnswered}</strong>
            нот
          </span>
        </div>
      </section>

      <div className="history-list-heading">
        <span>Последние {sessions.length}</span>
        <span>Всего {totalSessions}</span>
      </div>

      <div className="history-list">
        {sessions.length === 0 ? (
          <div className="history-empty">
            <span>∿</span>
            <p>Завершённые сессии появятся здесь.</p>
            <small>Нажми R, чтобы закончить текущую и начать новую.</small>
          </div>
        ) : (
          sessions.map((session) => (
            <article className="history-item" key={session.id}>
              <div className="history-item-top">
                <strong>
                  {session.mode === "flow"
                    ? "Чтение на скорость"
                    : "Чтение нот"}
                </strong>
                <span>{formatSessionDate(session.finishedAt)}</span>
              </div>
              <div className="history-item-metrics">
                <span>
                  <strong>{session.accuracy}%</strong> точность
                </span>
                <span>
                  <strong>{formatDuration(session.durationSeconds)}</strong>{" "}
                  время
                </span>
                <span>
                  <strong>{session.answered}</strong> нот
                </span>
              </div>
              {session.mode === "flow" && (
                <p className="history-detail">
                  Пропущено: {session.missed} · финальный темп:{" "}
                  {session.finalBpm
                    ? `${session.finalBpm} BPM`
                    : session.finalFlowDurationMs
                      ? `${(session.finalFlowDurationMs / 1000).toFixed(1)} с`
                      : "—"}
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
