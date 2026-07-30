"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMidi } from "../hooks/useMidi";
import { useSessionTimer } from "../hooks/useSessionTimer";
import { AudioEngine } from "../lib/audioEngine";
import {
  loadSessionHistory,
  saveSessionRecord,
  type SessionRecord,
} from "../lib/sessionHistory";
import {
  formatNoteName,
  noteReadingTrainer,
} from "../trainers/noteReading";
import type {
  NoteQuestion,
  TrainerSettings,
} from "../trainers/types";
import { FlowStaff } from "./FlowStaff";
import { MusicStaff } from "./MusicStaff";
import { PianoKeyboard } from "./PianoKeyboard";
import {
  formatDuration,
  SessionHistory,
} from "./SessionHistory";
import { SettingsMenu } from "./SettingsMenu";

const STORAGE_KEY = "notewise.settings.v1";
const INITIAL_FLOW_DURATION = 5500;
const MIN_FLOW_DURATION = 1800;
const MAX_FLOW_DURATION = 8000;

const DEFAULT_SETTINGS: TrainerSettings = {
  practiceMode: "study",
  clefMode: "treble",
  range: "octave",
  sessionLength: "endless",
  soundEnabled: true,
  volume: 0.65,
  theme: "dark",
};

type FeedbackState = "waiting" | "correct" | "wrong" | "revealed";

type SessionStats = {
  answered: number;
  correct: number;
  firstTryCorrect: number;
  totalMistakes: number;
  streak: number;
  bestStreak: number;
  missed: number;
};

const EMPTY_STATS: SessionStats = {
  answered: 0,
  correct: 0,
  firstTryCorrect: 0,
  totalMistakes: 0,
  streak: 0,
  bestStreak: 0,
  missed: 0,
};

function newSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || "{}",
    );
    return { ...DEFAULT_SETTINGS, ...saved } as TrainerSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function calculateAccuracy(stats: SessionStats, mode: "study" | "flow") {
  if (!stats.answered) return 100;
  const successful =
    mode === "flow" ? stats.correct : stats.firstTryCorrect;
  return Math.round((successful / stats.answered) * 100);
}

export function PracticeApp() {
  const [settings, setSettings] = useState<TrainerSettings>(DEFAULT_SETTINGS);
  const [question, setQuestion] = useState<NoteQuestion>(() =>
    noteReadingTrainer.createQuestion(DEFAULT_SETTINGS),
  );
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>("waiting");
  const [feedbackText, setFeedbackText] = useState("Сыграй ноту на клавиатуре");
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [flowDurationMs, setFlowDurationMs] = useState(
    INITIAL_FLOW_DURATION,
  );

  const settingsRef = useRef(settings);
  const questionRef = useRef(question);
  const attemptRef = useRef(attempt);
  const statsRef = useRef(stats);
  const flowDurationRef = useRef(flowDurationMs);
  const sessionIdRef = useRef(newSessionId());
  const blockedRef = useRef(false);
  const audioRef = useRef<AudioEngine | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timerRunning = !paused && !settingsOpen && !completed;
  const {
    elapsedMs,
    readElapsed,
    reset: resetTimer,
  } = useSessionTimer(timerRunning);

  const updateStats = useCallback(
    (updater: (current: SessionStats) => SessionStats) => {
      const next = updater(statsRef.current);
      statsRef.current = next;
      setStats(next);
      return next;
    },
    [],
  );

  const archiveSession = useCallback(
    (statsOverride?: SessionStats) => {
      const finalStats = statsOverride || statsRef.current;
      if (!finalStats.answered) return;

      const activeSettings = settingsRef.current;
      const record: SessionRecord = {
        id: sessionIdRef.current,
        mode: activeSettings.practiceMode,
        finishedAt: new Date().toISOString(),
        durationSeconds: Math.max(1, Math.round(readElapsed() / 1000)),
        answered: finalStats.answered,
        accuracy: calculateAccuracy(
          finalStats,
          activeSettings.practiceMode,
        ),
        mistakes: finalStats.totalMistakes,
        bestStreak: finalStats.bestStreak,
        missed: finalStats.missed,
        clefMode: activeSettings.clefMode,
        range: activeSettings.range,
        finalFlowDurationMs:
          activeSettings.practiceMode === "flow"
            ? flowDurationRef.current
            : undefined,
      };

      setHistory(saveSessionRecord(record));
    },
    [readElapsed],
  );

  useEffect(() => {
    const loaded = loadSettings();
    settingsRef.current = loaded;
    setSettings(loaded);
    setQuestion(noteReadingTrainer.createQuestion(loaded));
    setHistory(loadSessionHistory());
    audioRef.current = new AudioEngine();
    audioRef.current.setVolume(loaded.volume);
    document.documentElement.dataset.theme = loaded.theme;
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    settingsRef.current = settings;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
    audioRef.current?.setVolume(settings.volume);
    if (!settings.soundEnabled) audioRef.current?.stopAll();
  }, [settings]);

  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  useEffect(() => {
    flowDurationRef.current = flowDurationMs;
  }, [flowDurationMs]);

  useEffect(() => {
    const handleBeforeUnload = () => archiveSession();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [archiveSession]);

  useEffect(
    () => () => {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      audioRef.current?.stopAll();
    },
    [],
  );

  const beginNextQuestion = useCallback(() => {
    setQuestion((current) =>
      noteReadingTrainer.createQuestion(settingsRef.current, current),
    );
    setAttempt(0);
    attemptRef.current = 0;
    setFeedback("waiting");
    setFeedbackText(
      settingsRef.current.practiceMode === "flow"
        ? "Успей сыграть до пунктирной черты"
        : "Сыграй ноту на клавиатуре",
    );
    blockedRef.current = false;
  }, []);

  const settleQuestion = useCallback(
    ({
      delay,
      correct,
      firstTry,
      missed = false,
    }: {
      delay: number;
      correct: boolean;
      firstTry: boolean;
      missed?: boolean;
    }) => {
      blockedRef.current = true;
      nextTimerRef.current = setTimeout(() => {
        const previousStreak = statsRef.current.streak;
        const nextStreak = correct ? previousStreak + 1 : 0;
        const nextStats = updateStats((current) => ({
          ...current,
          answered: current.answered + 1,
          correct: current.correct + (correct ? 1 : 0),
          firstTryCorrect:
            current.firstTryCorrect + (firstTry ? 1 : 0),
          streak: nextStreak,
          bestStreak: Math.max(current.bestStreak, nextStreak),
          missed: current.missed + (missed ? 1 : 0),
        }));

        const sessionLength = settingsRef.current.sessionLength;
        if (
          sessionLength !== "endless" &&
          nextStats.answered >= sessionLength
        ) {
          blockedRef.current = false;
          setCompleted(true);
          setPaused(true);
          archiveSession(nextStats);
          return;
        }

        beginNextQuestion();
      }, delay);
    },
    [archiveSession, beginNextQuestion, updateStats],
  );

  const handleFlowTimeout = useCallback(() => {
    if (
      blockedRef.current ||
      paused ||
      settingsOpen ||
      completed ||
      settingsRef.current.practiceMode !== "flow"
    ) {
      return;
    }

    const slowerDuration = Math.min(
      MAX_FLOW_DURATION,
      Math.round(flowDurationRef.current * 1.12),
    );
    flowDurationRef.current = slowerDuration;
    setFlowDurationMs(slowerDuration);
    updateStats((current) => ({
      ...current,
      totalMistakes: current.totalMistakes + 1,
      streak: 0,
    }));
    setFeedback("revealed");
    setFeedbackText(
      `Время вышло — это ${formatNoteName(questionRef.current.midiNote)} · темп снижен`,
    );
    settleQuestion({
      delay: 1250,
      correct: false,
      firstTry: false,
      missed: true,
    });
  }, [
    completed,
    paused,
    settingsOpen,
    settleQuestion,
    updateStats,
  ]);

  const submitNote = useCallback(
    (midiNote: number) => {
      if (
        blockedRef.current ||
        paused ||
        settingsOpen ||
        completed
      ) {
        return;
      }

      const isCorrect = noteReadingTrainer.isCorrect(questionRef.current, [
        midiNote,
      ]);
      const isFlow = settingsRef.current.practiceMode === "flow";

      if (isCorrect) {
        const firstTry = attemptRef.current === 0;
        setFeedback("correct");

        if (isFlow) {
          const fasterDuration = Math.max(
            MIN_FLOW_DURATION,
            Math.round(flowDurationRef.current * 0.94),
          );
          flowDurationRef.current = fasterDuration;
          setFlowDurationMs(fasterDuration);
          setFeedbackText(
            `Успел · следующий темп ${(fasterDuration / 1000).toFixed(1)} с`,
          );
          settleQuestion({
            delay: 280,
            correct: true,
            firstTry,
          });
        } else {
          setFeedbackText(firstTry ? "Верно" : "Получилось");
          settleQuestion({
            delay: 480,
            correct: true,
            firstTry,
          });
        }
        return;
      }

      const nextAttempt = attemptRef.current + 1;
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
      updateStats((current) => ({
        ...current,
        totalMistakes: current.totalMistakes + 1,
        streak: 0,
      }));
      setFeedback("wrong");

      if (isFlow) {
        setFeedbackText("Не та клавиша — нота продолжает двигаться");
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => {
          if (!blockedRef.current) {
            setFeedback("waiting");
            setFeedbackText("Успей сыграть до пунктирной черты");
          }
        }, 450);
      } else if (nextAttempt === 1) {
        setFeedbackText("Не та клавиша. Попробуй ещё");
      } else if (nextAttempt === 2) {
        setFeedbackText("Ещё одна попытка — ответ пока не показываю");
      } else {
        setFeedback("revealed");
        setFeedbackText(`Это ${formatNoteName(questionRef.current.midiNote)}`);
        settleQuestion({
          delay: 1900,
          correct: false,
          firstTry: false,
        });
      }
    },
    [
      completed,
      paused,
      settingsOpen,
      settleQuestion,
      updateStats,
    ],
  );

  const noteOn = useCallback(
    (midiNote: number) => {
      setActiveNotes((current) => new Set(current).add(midiNote));
      if (settingsRef.current.soundEnabled) {
        void audioRef.current?.noteOn(midiNote);
      }
      submitNote(midiNote);
    },
    [submitNote],
  );

  const noteOff = useCallback((midiNote: number) => {
    setActiveNotes((current) => {
      const next = new Set(current);
      next.delete(midiNote);
      return next;
    });
    audioRef.current?.noteOff(midiNote);
  }, []);

  const { status: midiStatus, deviceName, connect } = useMidi(
    noteOn,
    noteOff,
  );

  const restartSession = useCallback(
    (
      nextSettings = settingsRef.current,
      shouldArchive = true,
    ) => {
      if (shouldArchive) archiveSession();
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

      blockedRef.current = false;
      settingsRef.current = nextSettings;
      statsRef.current = EMPTY_STATS;
      sessionIdRef.current = newSessionId();
      flowDurationRef.current = INITIAL_FLOW_DURATION;
      setFlowDurationMs(INITIAL_FLOW_DURATION);
      setQuestion(noteReadingTrainer.createQuestion(nextSettings));
      setAttempt(0);
      attemptRef.current = 0;
      setStats(EMPTY_STATS);
      setFeedback("waiting");
      setFeedbackText(
        nextSettings.practiceMode === "flow"
          ? "Успей сыграть до пунктирной черты"
          : "Сыграй ноту на клавиатуре",
      );
      setCompleted(false);
      setPaused(false);
      resetTimer();
    },
    [archiveSession, resetTimer],
  );

  const updateSettings = useCallback(
    (nextSettings: TrainerSettings) => {
      const exerciseChanged =
        nextSettings.practiceMode !== settingsRef.current.practiceMode ||
        nextSettings.clefMode !== settingsRef.current.clefMode ||
        nextSettings.range !== settingsRef.current.range ||
        nextSettings.sessionLength !== settingsRef.current.sessionLength;

      if (exerciseChanged) {
        archiveSession();
      }
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      if (exerciseChanged) restartSession(nextSettings, false);
    },
    [archiveSession, restartSession],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen) return;
      if (event.target instanceof HTMLInputElement) {
        return;
      }

      if (event.code === "Escape") {
        event.preventDefault();
        setSettingsOpen(true);
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (!completed) setPaused((current) => !current);
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        restartSession();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        updateSettings({
          ...settingsRef.current,
          soundEnabled: !settingsRef.current.soundEnabled,
        });
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        updateSettings({
          ...settingsRef.current,
          practiceMode:
            settingsRef.current.practiceMode === "study" ? "flow" : "study",
        });
      }
      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        updateSettings({
          ...settingsRef.current,
          theme: settingsRef.current.theme === "dark" ? "light" : "dark",
        });
      }
      if (
        event.code === "Equal" ||
        event.code === "NumpadAdd"
      ) {
        event.preventDefault();
        updateSettings({
          ...settingsRef.current,
          volume: Math.min(1, settingsRef.current.volume + 0.1),
        });
      }
      if (
        event.code === "Minus" ||
        event.code === "NumpadSubtract"
      ) {
        event.preventDefault();
        updateSettings({
          ...settingsRef.current,
          volume: Math.max(0, settingsRef.current.volume - 0.1),
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completed, restartSession, settingsOpen, updateSettings]);

  const accuracy = calculateAccuracy(stats, settings.practiceMode);
  const currentPosition =
    settings.sessionLength === "endless"
      ? `${stats.answered + 1} · ∞`
      : `${Math.min(stats.answered + 1, settings.sessionLength)} / ${settings.sessionLength}`;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  const midiCopy = useMemo(() => {
    if (midiStatus === "connected") return deviceName;
    if (midiStatus === "connecting") return "Ищем MIDI…";
    if (midiStatus === "unsupported") return "Web MIDI недоступен";
    if (midiStatus === "denied") return "Разрешить MIDI";
    return "Подключить MIDI";
  }, [deviceName, midiStatus]);

  const clefLabel =
    settings.clefMode === "treble"
      ? "Скрипичный"
      : settings.clefMode === "bass"
        ? "Басовый"
        : "Ключи вперемешку";
  const rangeLabel =
    settings.range === "octave"
      ? "1 октава"
      : settings.range === "octave-half"
        ? "1½ октавы"
        : "2 октавы";
  const practiceTitle =
    settings.practiceMode === "flow"
      ? "Чтение на скорость"
      : "Чтение нот";

  return (
    <main className="app-shell" data-theme={settings.theme}>
      <header className="topbar">
        <div className="brand" aria-label="Notewise">
          <span className="brand-mark">N</span>
          <span>notewise</span>
        </div>

        <div className="top-actions">
          <button
            className={`status-pill ${midiStatus === "connected" ? "is-connected" : ""}`}
            onClick={() => {
              void audioRef.current?.activate();
              void connect();
            }}
          >
            <span className="status-dot" />
            {midiCopy}
          </button>
          <button
            className="theme-toggle"
            onClick={() =>
              updateSettings({
                ...settings,
                theme: settings.theme === "dark" ? "light" : "dark",
              })
            }
            aria-label="Сменить тему"
          >
            {settings.theme === "dark" ? "☼" : "☾"}
          </button>
          <button
            className={`sound-toggle ${settings.soundEnabled ? "is-on" : ""}`}
            onClick={() => {
              void audioRef.current?.activate();
              updateSettings({
                ...settings,
                soundEnabled: !settings.soundEnabled,
              });
            }}
            aria-label={
              settings.soundEnabled
                ? "Выключить звук приложения"
                : "Включить звук приложения"
            }
          >
            {settings.soundEnabled
              ? `Звук ${Math.round(settings.volume * 100)}%`
              : "Звук выкл."}
          </button>
          <button
            className="menu-trigger"
            onClick={() => setSettingsOpen(true)}
          >
            <span>Настройки</span>
            <kbd>Esc</kbd>
          </button>
        </div>
      </header>

      <div className="workspace-layout">
        <SessionHistory
          sessions={history}
          elapsedSeconds={elapsedSeconds}
          currentAccuracy={accuracy}
          currentAnswered={stats.answered}
          currentMode={settings.practiceMode}
        />

        <section className="practice-stage">
          <div className="practice-meta">
            <div>
              <p className="eyebrow">{practiceTitle}</p>
              <h1>
                {clefLabel}
                <span> · {rangeLabel}</span>
              </h1>
            </div>
            <div className="session-summary">
              {settings.practiceMode === "flow" && (
                <span className="tempo-badge">
                  {(flowDurationMs / 1000).toFixed(1)} с
                </span>
              )}
              <span className="session-clock">
                {formatDuration(elapsedSeconds)}
              </span>
              <span className="session-counter" aria-label="Номер задания">
                {currentPosition}
              </span>
            </div>
          </div>

          <div className={`notation-card feedback-${feedback}`}>
            {settings.practiceMode === "flow" ? (
              <FlowStaff
                question={question}
                state={feedback}
                theme={settings.theme}
                durationMs={flowDurationMs}
                paused={paused || settingsOpen || completed}
                onTimeout={handleFlowTimeout}
              />
            ) : (
              <MusicStaff
                question={question}
                state={feedback}
                theme={settings.theme}
              />
            )}
            <div className="feedback-line" aria-live="polite">
              <span className={`feedback-icon feedback-${feedback}`}>
                {feedback === "correct"
                  ? "✓"
                  : feedback === "wrong"
                    ? "↺"
                    : feedback === "revealed"
                      ? "→"
                      : "·"}
              </span>
              <span>{feedbackText}</span>
            </div>
          </div>

          <PianoKeyboard
            activeNotes={activeNotes}
            revealedNote={
              feedback === "revealed" ? question.midiNote : undefined
            }
            disabled={paused || settingsOpen || completed}
            onNoteOn={noteOn}
            onNoteOff={noteOff}
          />

          <div className="practice-footer">
            <div className="stats-row">
              <span>
                Точность <strong>{accuracy}%</strong>
              </span>
              <span>
                Ошибки <strong>{stats.totalMistakes}</strong>
              </span>
              {settings.practiceMode === "flow" && (
                <span>
                  Пропущено <strong>{stats.missed}</strong>
                </span>
              )}
              <span>
                Серия <strong>{stats.streak}</strong>
              </span>
            </div>
            <p className="footer-hint">
              <kbd>Esc</kbd> настройки и управление
            </p>
          </div>
        </section>
      </div>

      {paused && !settingsOpen && !completed && (
        <div className="pause-overlay">
          <button
            className="pause-card"
            onClick={() => setPaused(false)}
          >
            <span className="pause-symbol">Ⅱ</span>
            <strong>Пауза</strong>
            <small>Space или нажми здесь, чтобы продолжить</small>
          </button>
        </div>
      )}

      {completed && (
        <div className="settings-backdrop">
          <section className="completion-card" role="dialog" aria-modal="true">
            <p className="eyebrow">Сессия завершена</p>
            <h2>{accuracy}% точности</h2>
            <p>
              {stats.answered} нот · {formatDuration(elapsedSeconds)} · лучшая
              серия {stats.bestStreak}
            </p>
            <button className="primary-button" onClick={() => restartSession()}>
              Новая сессия <kbd>R</kbd>
            </button>
          </section>
        </div>
      )}

      {settingsOpen && (
        <SettingsMenu
          settings={settings}
          onChange={updateSettings}
          onClose={() => {
            setSettingsOpen(false);
            setPaused(false);
          }}
        />
      )}
    </main>
  );
}
