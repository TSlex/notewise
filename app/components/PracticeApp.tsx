"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioEngine } from "../lib/audioEngine";
import { useMidi } from "../hooks/useMidi";
import {
  formatNoteName,
  noteReadingTrainer,
} from "../trainers/noteReading";
import type {
  NoteQuestion,
  TrainerSettings,
} from "../trainers/types";
import { MusicStaff } from "./MusicStaff";
import { PianoKeyboard } from "./PianoKeyboard";
import { SettingsMenu } from "./SettingsMenu";

const STORAGE_KEY = "notewise.settings.v1";
const DEFAULT_SETTINGS: TrainerSettings = {
  clefMode: "treble",
  range: "octave",
  sessionLength: "endless",
  soundEnabled: true,
};

type FeedbackState = "waiting" | "correct" | "wrong" | "revealed";

type SessionStats = {
  answered: number;
  firstTryCorrect: number;
  totalMistakes: number;
  streak: number;
};

const EMPTY_STATS: SessionStats = {
  answered: 0,
  firstTryCorrect: 0,
  totalMistakes: 0,
  streak: 0,
};

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const settingsRef = useRef(settings);
  const questionRef = useRef(question);
  const attemptRef = useRef(attempt);
  const blockedRef = useRef(false);
  const audioRef = useRef<AudioEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loaded = loadSettings();
    settingsRef.current = loaded;
    setSettings(loaded);
    setQuestion(noteReadingTrainer.createQuestion(loaded));
    audioRef.current = new AudioEngine();
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (!settings.soundEnabled) audioRef.current?.stopAll();
  }, [settings]);

  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      audioRef.current?.stopAll();
    },
    [],
  );

  const scheduleNext = useCallback(
    (delay: number, settledAsCorrect: boolean, firstTry: boolean) => {
      blockedRef.current = true;
      timerRef.current = setTimeout(() => {
        setStats((current) => {
          const nextStats = {
            answered: current.answered + 1,
            firstTryCorrect:
              current.firstTryCorrect + (firstTry ? 1 : 0),
            totalMistakes: current.totalMistakes,
            streak: settledAsCorrect ? current.streak + 1 : 0,
          };
          const sessionLength = settingsRef.current.sessionLength;
          if (
            sessionLength !== "endless" &&
            nextStats.answered >= sessionLength
          ) {
            setCompleted(true);
            setPaused(true);
            blockedRef.current = false;
            return nextStats;
          }
          return nextStats;
        });

        setQuestion((current) =>
          noteReadingTrainer.createQuestion(settingsRef.current, current),
        );
        setAttempt(0);
        attemptRef.current = 0;
        setFeedback("waiting");
        setFeedbackText("Сыграй ноту на клавиатуре");
        blockedRef.current = false;
      }, delay);
    },
    [],
  );

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

      if (isCorrect) {
        const firstTry = attemptRef.current === 0;
        setFeedback("correct");
        setFeedbackText(firstTry ? "Верно" : "Получилось");
        scheduleNext(480, true, firstTry);
        return;
      }

      const nextAttempt = attemptRef.current + 1;
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
      setStats((current) => ({
        ...current,
        totalMistakes: current.totalMistakes + 1,
        streak: 0,
      }));

      if (nextAttempt === 1) {
        setFeedback("wrong");
        setFeedbackText("Не та клавиша. Попробуй ещё");
      } else if (nextAttempt === 2) {
        setFeedback("wrong");
        setFeedbackText("Ещё одна попытка — ответ пока не показываю");
      } else {
        setFeedback("revealed");
        setFeedbackText(`Это ${formatNoteName(questionRef.current.midiNote)}`);
        scheduleNext(1900, false, false);
      }
    },
    [completed, paused, scheduleNext, settingsOpen],
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
    (nextSettings = settingsRef.current) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      blockedRef.current = false;
      settingsRef.current = nextSettings;
      setQuestion(noteReadingTrainer.createQuestion(nextSettings));
      setAttempt(0);
      attemptRef.current = 0;
      setStats(EMPTY_STATS);
      setFeedback("waiting");
      setFeedbackText("Сыграй ноту на клавиатуре");
      setCompleted(false);
      setPaused(false);
    },
    [],
  );

  const updateSettings = useCallback(
    (nextSettings: TrainerSettings) => {
      const exerciseChanged =
        nextSettings.clefMode !== settingsRef.current.clefMode ||
        nextSettings.range !== settingsRef.current.range ||
        nextSettings.sessionLength !== settingsRef.current.sessionLength;
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      if (exerciseChanged) restartSession(nextSettings);
    },
    [restartSession],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen) return;
      if (
        event.target instanceof HTMLButtonElement ||
        event.target instanceof HTMLInputElement
      ) {
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completed, restartSession, settingsOpen, updateSettings]);

  const accuracy = stats.answered
    ? Math.round((stats.firstTryCorrect / stats.answered) * 100)
    : 100;
  const currentPosition =
    settings.sessionLength === "endless"
      ? `${stats.answered + 1} · ∞`
      : `${Math.min(stats.answered + 1, settings.sessionLength)} / ${settings.sessionLength}`;

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

  return (
    <main className="app-shell">
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
            {settings.soundEnabled ? "Звук вкл." : "Звук выкл."}
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

      <section className="practice-stage">
        <div className="practice-meta">
          <div>
            <p className="eyebrow">Чтение нот</p>
            <h1>
              {clefLabel}
              <span> · {rangeLabel}</span>
            </h1>
          </div>
          <div className="session-counter" aria-label="Номер задания">
            {currentPosition}
          </div>
        </div>

        <div className={`notation-card feedback-${feedback}`}>
          <MusicStaff question={question} state={feedback} />
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
            <span>
              Серия <strong>{stats.streak}</strong>
            </span>
          </div>
          <p className="footer-hint">
            <kbd>Esc</kbd> настройки и управление
          </p>
        </div>
      </section>

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
            <p className="eyebrow">Серия завершена</p>
            <h2>{accuracy}% с первой попытки</h2>
            <p>
              {stats.firstTryCorrect} из {stats.answered} нот сразу верно ·{" "}
              {stats.totalMistakes} ошибок
            </p>
            <button className="primary-button" onClick={() => restartSession()}>
              Новая серия <kbd>R</kbd>
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
