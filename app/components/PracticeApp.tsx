"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMidi } from "../hooks/useMidi";
import { useSessionTimer } from "../hooks/useSessionTimer";
import { AudioEngine } from "../lib/audioEngine";
import { loadSessionCount, loadSessionHistory, saveSessionRecord, type SessionRecord } from "../lib/sessionHistory";
import { createQuestionForMidi, formatNoteName, getDiatonicIndex, KEY_SIGNATURES, noteReadingTrainer } from "../trainers/noteReading";
import type { NoteQuestion, PracticeMode, ToolMode, TrainerSettings } from "../trainers/types";
import { FlowStaff } from "./FlowStaff";
import { FreePlayStaff, type PlayedNote } from "./FreePlayStaff";
import { MusicStaff } from "./MusicStaff";
import { PianoKeyboard } from "./PianoKeyboard";
import { PlacementStaff } from "./PlacementStaff";
import { formatDuration, SessionHistory } from "./SessionHistory";
import { SettingsMenu } from "./SettingsMenu";

const STORAGE_KEY = "notewise.settings.v1";
const MIN_FLOW_BPM = 1;
const MAX_FLOW_BPM = 200;
const FLOW_STEP_BPM = 4;
const FLOW_QUEUE_SIZE = 6;

const DEFAULT_SETTINGS: TrainerSettings = {
  practiceMode: "study",
  clefMode: "treble",
  range: "octave",
  sessionLength: "endless",
  soundEnabled: true,
  volume: 0.65,
  metronomeEnabled: false,
  flowBpm: 72,
  adaptiveFlowBpm: true,
  keySignature: "C",
  accidentalsEnabled: false,
  midiInputId: "",
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
  recognitionTotalMs: number;
};

const EMPTY_STATS: SessionStats = {
  answered: 0, correct: 0, firstTryCorrect: 0, totalMistakes: 0,
  streak: 0, bestStreak: 0, missed: 0, recognitionTotalMs: 0,
};

function newSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadSettings(): TrainerSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const merged = { ...DEFAULT_SETTINGS, ...saved } as TrainerSettings;
    if (!(merged.keySignature in KEY_SIGNATURES)) merged.keySignature = "C";
    if (!["study", "flow", "placement"].includes(merged.practiceMode)) merged.practiceMode = "study";
    merged.flowBpm = Math.max(MIN_FLOW_BPM, Math.min(MAX_FLOW_BPM, Number(merged.flowBpm) || 72));
    merged.adaptiveFlowBpm = merged.adaptiveFlowBpm !== false;
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function calculateAccuracy(stats: SessionStats, mode: PracticeMode) {
  if (!stats.answered) return 100;
  const successful = mode === "flow" ? stats.correct : stats.firstTryCorrect;
  return Math.round((successful / stats.answered) * 100);
}

function createFlowQueue(settings: TrainerSettings, count = FLOW_QUEUE_SIZE) {
  const first = noteReadingTrainer.createQuestion(settings);
  const fixedSettings = { ...settings, clefMode: first.clef };
  const result = [first];
  while (result.length < count) result.push(noteReadingTrainer.createQuestion(fixedSettings, result[result.length - 1]));
  return result;
}

function promptForMode(mode: PracticeMode, question?: NoteQuestion) {
  if (mode === "flow") return "Играй первую ноту на следующем тике";
  if (mode === "placement" && question) return `Поставь на стан: ${formatNoteName(question)}`;
  return "Сыграй ноту на клавиатуре";
}

export function PracticeApp() {
  const [settings, setSettings] = useState<TrainerSettings>(DEFAULT_SETTINGS);
  const [tool, setTool] = useState<ToolMode>("training");
  const [launchOpen, setLaunchOpen] = useState(true);
  const [question, setQuestion] = useState<NoteQuestion>(() => noteReadingTrainer.createQuestion(DEFAULT_SETTINGS));
  const [flowQueue, setFlowQueue] = useState<NoteQuestion[]>(() => createFlowQueue(DEFAULT_SETTINGS));
  const [freeNotes, setFreeNotes] = useState<PlayedNote[]>([]);
  const [placedIndex, setPlacedIndex] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>("waiting");
  const [feedbackText, setFeedbackText] = useState("Сыграй ноту на клавиатуре");
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [flowBpm, setFlowBpm] = useState(DEFAULT_SETTINGS.flowBpm);

  const settingsRef = useRef(settings);
  const toolRef = useRef<ToolMode>(tool);
  const questionRef = useRef(question);
  const flowQueueRef = useRef(flowQueue);
  const attemptRef = useRef(attempt);
  const statsRef = useRef(stats);
  const flowBpmRef = useRef(flowBpm);
  const questionStartedElapsedRef = useRef(0);
  const sessionIdRef = useRef(newSessionId());
  const blockedRef = useRef(false);
  const flowAnsweredRef = useRef(false);
  const flowHadMistakeRef = useRef(false);
  const flowWindowRef = useRef<boolean[]>([]);
  const hydratedRef = useRef(false);
  const audioRef = useRef<AudioEngine | null>(null);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timerRunning = tool === "training" && !launchOpen && !paused && !settingsOpen && !completed;
  const { elapsedMs, readElapsed, reset: resetTimer } = useSessionTimer(timerRunning);

  const updateStats = useCallback((updater: (current: SessionStats) => SessionStats) => {
    const next = updater(statsRef.current);
    statsRef.current = next;
    setStats(next);
    return next;
  }, []);

  const archiveSession = useCallback((statsOverride?: SessionStats) => {
    if (toolRef.current !== "training") return;
    const finalStats = statsOverride || statsRef.current;
    if (!finalStats.answered) return;
    const activeSettings = settingsRef.current;
    const record: SessionRecord = {
      id: sessionIdRef.current,
      mode: activeSettings.practiceMode,
      finishedAt: new Date().toISOString(),
      durationSeconds: Math.max(1, Math.round(readElapsed() / 1000)),
      answered: finalStats.answered,
      accuracy: calculateAccuracy(finalStats, activeSettings.practiceMode),
      mistakes: finalStats.totalMistakes,
      bestStreak: finalStats.bestStreak,
      missed: finalStats.missed,
      clefMode: activeSettings.clefMode,
      range: activeSettings.range,
      keySignature: activeSettings.keySignature,
      finalBpm: activeSettings.practiceMode === "flow" ? flowBpmRef.current : undefined,
      averageRecognitionMs: activeSettings.practiceMode === "study"
        ? Math.round(finalStats.recognitionTotalMs / finalStats.answered)
        : undefined,
    };
    const saved = saveSessionRecord(record);
    setHistory(saved.history);
    setTotalSessions(saved.totalCount);
  }, [readElapsed]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded = loadSettings();
      const firstQuestion = noteReadingTrainer.createQuestion(loaded);
      settingsRef.current = loaded;
      questionRef.current = firstQuestion;
      flowBpmRef.current = loaded.flowBpm;
      setSettings(loaded);
      setQuestion(firstQuestion);
      setFeedbackText(promptForMode(loaded.practiceMode, firstQuestion));
      setFlowQueue(createFlowQueue(loaded));
      setFlowBpm(loaded.flowBpm);
      setHistory(loadSessionHistory());
      setTotalSessions(loadSessionCount());
      audioRef.current = new AudioEngine();
      audioRef.current.setVolume(loaded.volume);
      document.documentElement.dataset.theme = loaded.theme;
      hydratedRef.current = true;
      resetTimer();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resetTimer]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    settingsRef.current = settings;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
    audioRef.current?.setVolume(settings.volume);
    if (!settings.soundEnabled) audioRef.current?.stopAll();
  }, [settings]);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { questionRef.current = question; }, [question]);
  useEffect(() => { flowQueueRef.current = flowQueue; }, [flowQueue]);
  useEffect(() => { attemptRef.current = attempt; }, [attempt]);
  useEffect(() => { flowBpmRef.current = flowBpm; }, [flowBpm]);

  useEffect(() => {
    const handleBeforeUnload = () => archiveSession();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [archiveSession]);

  useEffect(() => {
    const silence = () => { audioRef.current?.stopAll(); setActiveNotes(new Set()); };
    const handleVisibility = () => { if (document.hidden) silence(); else void audioRef.current?.activate(); };
    window.addEventListener("blur", silence);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { window.removeEventListener("blur", silence); document.removeEventListener("visibilitychange", handleVisibility); };
  }, []);

  useEffect(() => () => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    audioRef.current?.stopAll();
  }, []);

  const beginNextQuestion = useCallback(() => {
    const next = noteReadingTrainer.createQuestion(settingsRef.current, questionRef.current);
    questionRef.current = next;
    setQuestion(next);
    setPlacedIndex(null);
    setAttempt(0);
    attemptRef.current = 0;
    setFeedback("waiting");
    setFeedbackText(promptForMode(settingsRef.current.practiceMode, next));
    blockedRef.current = false;
    questionStartedElapsedRef.current = readElapsed();
  }, [readElapsed]);

  const settleQuestion = useCallback(({ delay, correct, firstTry, recognitionMs = 0 }: { delay: number; correct: boolean; firstTry: boolean; recognitionMs?: number }) => {
    blockedRef.current = true;
    nextTimerRef.current = setTimeout(() => {
      const previousStreak = statsRef.current.streak;
      const nextStreak = correct ? previousStreak + 1 : 0;
      const nextStats = updateStats((current) => ({
        ...current,
        answered: current.answered + 1,
        correct: current.correct + (correct ? 1 : 0),
        firstTryCorrect: current.firstTryCorrect + (firstTry ? 1 : 0),
        streak: nextStreak,
        bestStreak: Math.max(current.bestStreak, nextStreak),
        recognitionTotalMs: current.recognitionTotalMs + recognitionMs,
      }));
      const length = settingsRef.current.sessionLength;
      if (length !== "endless" && nextStats.answered >= length) {
        blockedRef.current = false;
        setCompleted(true);
        setPaused(true);
        archiveSession(nextStats);
        return;
      }
      beginNextQuestion();
    }, delay);
  }, [archiveSession, beginNextQuestion, updateStats]);

  const handleFlowTick = useCallback(() => {
    if (paused || settingsOpen || launchOpen || completed || settingsRef.current.practiceMode !== "flow" || toolRef.current !== "training") return;
    if (settingsRef.current.metronomeEnabled) void audioRef.current?.metronomeTick();
    const currentQuestion = flowQueueRef.current[0];
    const correct = flowAnsweredRef.current;
    const firstTry = correct && !flowHadMistakeRef.current;
    const previousStreak = statsRef.current.streak;
    const nextStreak = correct ? previousStreak + 1 : 0;
    const nextStats = updateStats((current) => ({
      ...current,
      answered: current.answered + 1,
      correct: current.correct + (correct ? 1 : 0),
      firstTryCorrect: current.firstTryCorrect + (firstTry ? 1 : 0),
      totalMistakes: current.totalMistakes + (correct ? 0 : 1),
      streak: nextStreak,
      bestStreak: Math.max(current.bestStreak, nextStreak),
      missed: current.missed + (correct ? 0 : 1),
    }));
    if (!correct && currentQuestion) { setFeedback("revealed"); setFeedbackText(`Пропуск — ${formatNoteName(currentQuestion)} · ритм продолжается`); }
    else { setFeedback("waiting"); setFeedbackText("Следующая нота — держи пульс"); }

    flowWindowRef.current.push(correct);
    let rebuildQueue = false;
    if (flowWindowRef.current.length === 5) {
      if (settingsRef.current.adaptiveFlowBpm) {
        const correctCount = flowWindowRef.current.filter(Boolean).length;
        const nextBpm = correctCount >= 4
          ? Math.min(MAX_FLOW_BPM, flowBpmRef.current + FLOW_STEP_BPM)
          : correctCount <= 2 ? Math.max(MIN_FLOW_BPM, flowBpmRef.current - FLOW_STEP_BPM) : flowBpmRef.current;
        flowBpmRef.current = nextBpm;
        setFlowBpm(nextBpm);
      }
      flowWindowRef.current = [];
      rebuildQueue = settingsRef.current.clefMode === "mixed";
    }

    flowAnsweredRef.current = false;
    flowHadMistakeRef.current = false;
    const length = settingsRef.current.sessionLength;
    if (length !== "endless" && nextStats.answered >= length) {
      setCompleted(true); setPaused(true); archiveSession(nextStats); return;
    }
    const nextQueue = rebuildQueue ? createFlowQueue(settingsRef.current) : (() => {
      const remaining = flowQueueRef.current.slice(1);
      const clefMode = remaining[0]?.clef ?? currentQuestion?.clef ?? "treble";
      const tail = noteReadingTrainer.createQuestion({ ...settingsRef.current, clefMode }, remaining[remaining.length - 1]);
      return [...remaining, tail];
    })();
    flowQueueRef.current = nextQueue;
    setFlowQueue(nextQueue);
  }, [archiveSession, completed, launchOpen, paused, settingsOpen, updateStats]);

  const submitNote = useCallback((midiNote: number) => {
    if (toolRef.current !== "training" || settingsRef.current.practiceMode === "placement" || blockedRef.current || paused || settingsOpen || launchOpen || completed) return;
    const isFlow = settingsRef.current.practiceMode === "flow";
    const activeQuestion = isFlow ? flowQueueRef.current[0] : questionRef.current;
    if (!activeQuestion) return;
    const isCorrect = noteReadingTrainer.isCorrect(activeQuestion, [midiNote]);
    if (isFlow) {
      if (flowAnsweredRef.current) return;
      if (isCorrect) { flowAnsweredRef.current = true; setFeedback("correct"); setFeedbackText("Верно — держи ритм"); }
      else {
        flowHadMistakeRef.current = true;
        updateStats((current) => ({ ...current, totalMistakes: current.totalMistakes + 1, streak: 0 }));
        setFeedback("wrong"); setFeedbackText("Не та клавиша — поток продолжается");
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => { if (!flowAnsweredRef.current) { setFeedback("waiting"); setFeedbackText("Попробуй текущую ноту ещё раз"); } }, 360);
      }
      return;
    }
    const recognitionMs = Math.max(0, readElapsed() - questionStartedElapsedRef.current);
    if (isCorrect) {
      const firstTry = attemptRef.current === 0;
      setFeedback("correct"); setFeedbackText(firstTry ? "Верно" : "Получилось");
      settleQuestion({ delay: 480, correct: true, firstTry, recognitionMs });
      return;
    }
    const nextAttempt = attemptRef.current + 1;
    attemptRef.current = nextAttempt; setAttempt(nextAttempt);
    updateStats((current) => ({ ...current, totalMistakes: current.totalMistakes + 1, streak: 0 }));
    setFeedback("wrong");
    if (nextAttempt === 1) setFeedbackText("Не та клавиша. Попробуй ещё");
    else if (nextAttempt === 2) setFeedbackText("Ещё одна попытка — ответ пока не показываю");
    else { setFeedback("revealed"); setFeedbackText(`Это ${formatNoteName(activeQuestion)}`); settleQuestion({ delay: 1900, correct: false, firstTry: false, recognitionMs }); }
  }, [completed, launchOpen, paused, readElapsed, settingsOpen, settleQuestion, updateStats]);

  const submitPlacement = useCallback((diatonicIndex: number) => {
    if (blockedRef.current || paused || settingsOpen || launchOpen || completed || settingsRef.current.practiceMode !== "placement") return;
    const target = questionRef.current;
    const correct = diatonicIndex === getDiatonicIndex(target);
    setPlacedIndex(diatonicIndex);
    if (correct) {
      const firstTry = attemptRef.current === 0;
      setFeedback("correct"); setFeedbackText(firstTry ? "Верно" : "Получилось");
      settleQuestion({ delay: 650, correct: true, firstTry });
      return;
    }
    const nextAttempt = attemptRef.current + 1;
    attemptRef.current = nextAttempt; setAttempt(nextAttempt);
    updateStats((current) => ({ ...current, totalMistakes: current.totalMistakes + 1, streak: 0 }));
    setFeedback("wrong");
    if (nextAttempt >= 3) {
      setFeedback("revealed"); setFeedbackText(`Правильное положение: ${formatNoteName(target)}`);
      settleQuestion({ delay: 1900, correct: false, firstTry: false });
    } else {
      setFeedbackText(nextAttempt === 1 ? "Не здесь. Попробуй ещё" : "Ещё одна попытка");
      feedbackTimerRef.current = setTimeout(() => { setPlacedIndex(null); setFeedback("waiting"); setFeedbackText(`Поставь на стан: ${formatNoteName(target)}`); }, 520);
    }
  }, [completed, launchOpen, paused, settingsOpen, settleQuestion, updateStats]);

  const noteOn = useCallback((midiNote: number) => {
    setActiveNotes((current) => new Set(current).add(midiNote));
    if (settingsRef.current.soundEnabled) void audioRef.current?.noteOn(midiNote);
    if (toolRef.current === "free" && !paused && !settingsOpen && !launchOpen) {
      const freeSettings = { ...settingsRef.current, clefMode: settingsRef.current.clefMode === "mixed" ? "treble" as const : settingsRef.current.clefMode };
      const played: PlayedNote = { id: `free-${midiNote}-${Date.now()}-${Math.random()}`, question: createQuestionForMidi(midiNote, freeSettings), startedAt: performance.now() };
      setFreeNotes((current) => [...current.slice(-39), played]);
    } else submitNote(midiNote);
  }, [launchOpen, paused, settingsOpen, submitNote]);

  const noteOff = useCallback((midiNote: number) => {
    setActiveNotes((current) => { const next = new Set(current); next.delete(midiNote); return next; });
    audioRef.current?.noteOff(midiNote);
  }, []);

  const { status: midiStatus, deviceName, devices: midiDevices, connect } = useMidi(noteOn, noteOff, settings.midiInputId);

  const restartSession = useCallback((nextSettings = settingsRef.current, shouldArchive = true) => {
    if (shouldArchive) archiveSession();
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    audioRef.current?.stopAll();
    const nextQuestion = noteReadingTrainer.createQuestion(nextSettings);
    const nextQueue = createFlowQueue(nextSettings);
    blockedRef.current = false; flowAnsweredRef.current = false; flowHadMistakeRef.current = false; flowWindowRef.current = [];
    settingsRef.current = nextSettings; statsRef.current = EMPTY_STATS; sessionIdRef.current = newSessionId();
    flowBpmRef.current = nextSettings.flowBpm; questionRef.current = nextQuestion; flowQueueRef.current = nextQueue;
    setFlowBpm(nextSettings.flowBpm); setQuestion(nextQuestion); setFlowQueue(nextQueue); setPlacedIndex(null); setFreeNotes([]);
    setAttempt(0); attemptRef.current = 0; setStats(EMPTY_STATS); setFeedback("waiting");
    setFeedbackText(promptForMode(nextSettings.practiceMode, nextQuestion)); setCompleted(false); setPaused(false);
    resetTimer(); questionStartedElapsedRef.current = 0;
  }, [archiveSession, resetTimer]);

  const updateSettings = useCallback((nextSettings: TrainerSettings) => {
    const previous = settingsRef.current;
    const exerciseChanged = nextSettings.practiceMode !== previous.practiceMode || nextSettings.clefMode !== previous.clefMode ||
      nextSettings.range !== previous.range || nextSettings.sessionLength !== previous.sessionLength || nextSettings.keySignature !== previous.keySignature ||
      nextSettings.accidentalsEnabled !== previous.accidentalsEnabled || nextSettings.flowBpm !== previous.flowBpm || nextSettings.adaptiveFlowBpm !== previous.adaptiveFlowBpm;
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    if (nextSettings.flowBpm !== previous.flowBpm) { flowBpmRef.current = nextSettings.flowBpm; setFlowBpm(nextSettings.flowBpm); }
    if (toolRef.current === "training" && exerciseChanged) restartSession(nextSettings);
    if (toolRef.current === "free" && nextSettings.clefMode !== previous.clefMode) setFreeNotes([]);
  }, [restartSession]);

  const changeTool = useCallback((nextTool: ToolMode) => {
    if (nextTool === toolRef.current) return;
    if (toolRef.current === "training") archiveSession();
    toolRef.current = nextTool; setTool(nextTool); setPaused(false); setCompleted(false); setFreeNotes([]);
    if (nextTool === "training") restartSession(settingsRef.current, false);
  }, [archiveSession, restartSession]);

  const closeMenu = useCallback(() => {
    void audioRef.current?.activate();
    setLaunchOpen(false); setSettingsOpen(false); setPaused(false);
    if (launchOpen) questionStartedElapsedRef.current = readElapsed();
  }, [launchOpen, readElapsed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (launchOpen || settingsOpen || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === "Escape") { event.preventDefault(); setSettingsOpen(true); }
      if (event.code === "Space") { event.preventDefault(); if (!completed) setPaused((current) => !current); }
      if (event.code === "KeyR") { event.preventDefault(); if (toolRef.current === "training") restartSession(); else setFreeNotes([]); }
      if (event.code === "KeyS") { event.preventDefault(); updateSettings({ ...settingsRef.current, soundEnabled: !settingsRef.current.soundEnabled }); }
      if (event.code === "KeyM" && toolRef.current === "training") {
        event.preventDefault();
        const modes: PracticeMode[] = ["study", "flow", "placement"];
        updateSettings({ ...settingsRef.current, practiceMode: modes[(modes.indexOf(settingsRef.current.practiceMode) + 1) % modes.length] });
      }
      if (event.code === "KeyT") { event.preventDefault(); updateSettings({ ...settingsRef.current, theme: settingsRef.current.theme === "dark" ? "light" : "dark" }); }
      if (event.code === "Equal" || event.code === "NumpadAdd") { event.preventDefault(); updateSettings({ ...settingsRef.current, volume: Math.min(1, settingsRef.current.volume + 0.1) }); }
      if (event.code === "Minus" || event.code === "NumpadSubtract") { event.preventDefault(); updateSettings({ ...settingsRef.current, volume: Math.max(0, settingsRef.current.volume - 0.1) }); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completed, launchOpen, restartSession, settingsOpen, updateSettings]);

  const accuracy = calculateAccuracy(stats, settings.practiceMode);
  const averageRecognitionMs = stats.answered && settings.practiceMode === "study" ? stats.recognitionTotalMs / stats.answered : 0;
  const currentPosition = settings.sessionLength === "endless" ? `${stats.answered + 1} · ∞` : `${Math.min(stats.answered + 1, settings.sessionLength)} / ${settings.sessionLength}`;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const activeQuestion = settings.practiceMode === "flow" ? flowQueue[0] : question;
  const freeReferenceQuestion = useMemo(() => createQuestionForMidi(settings.clefMode === "bass" ? 48 : 60, { ...settings, clefMode: settings.clefMode === "mixed" ? "treble" : settings.clefMode }), [settings]);

  const midiCopy = useMemo(() => {
    if (midiStatus === "connected") return deviceName;
    if (midiStatus === "connecting") return "Ищем MIDI…";
    if (midiStatus === "unsupported") return "Web MIDI недоступен";
    if (midiStatus === "denied") return "Разрешить MIDI";
    return "Подключить MIDI";
  }, [deviceName, midiStatus]);

  const clefLabel = settings.clefMode === "treble" ? "Скрипичный" : settings.clefMode === "bass" ? "Басовый" : "Ключи вперемешку";
  const rangeLabel = settings.range === "octave" ? "1 октава" : settings.range === "octave-half" ? "1½ октавы" : "2 октавы";
  const practiceTitle = settings.practiceMode === "flow" ? "Чтение на скорость" : settings.practiceMode === "placement" ? "Расстановка нот" : "Чтение нот";
  const adjustFlowBpm = (delta: number) => { const next = Math.max(MIN_FLOW_BPM, Math.min(MAX_FLOW_BPM, flowBpmRef.current + delta)); flowBpmRef.current = next; setFlowBpm(next); };

  return (
    <main className="app-shell" data-theme={settings.theme}>
      <header className="topbar">
        <div className="brand" aria-label="Notewise"><span className="brand-mark">N</span><span>notewise</span></div>
        <nav className="tool-nav" aria-label="Инструменты">
          <button className={tool === "training" ? "is-active" : ""} onClick={() => changeTool("training")}>Тренировка</button>
          <button className={tool === "free" ? "is-active" : ""} onClick={() => changeTool("free")}>Свободный режим</button>
        </nav>
        <div className="top-actions">
          <button className={`status-pill ${midiStatus === "connected" ? "is-connected" : ""}`} onClick={() => { void audioRef.current?.activate(); void connect(); }}><span className="status-dot" />{midiCopy}</button>
          <button className="theme-toggle" onClick={() => updateSettings({ ...settings, theme: settings.theme === "dark" ? "light" : "dark" })} aria-label="Сменить тему">{settings.theme === "dark" ? "☼" : "☾"}</button>
          <button className={`sound-toggle ${settings.soundEnabled ? "is-on" : ""}`} onClick={() => { void audioRef.current?.activate(); updateSettings({ ...settings, soundEnabled: !settings.soundEnabled }); }} aria-label={settings.soundEnabled ? "Выключить звук приложения" : "Включить звук приложения"}>{settings.soundEnabled ? `Звук ${Math.round(settings.volume * 100)}%` : "Звук выкл."}</button>
          <button className="menu-trigger" onClick={() => setSettingsOpen(true)}><span>Настройки</span><kbd>Esc</kbd></button>
        </div>
      </header>

      {tool === "training" ? (
        <div className="workspace-layout">
          <SessionHistory sessions={history} totalSessions={totalSessions} elapsedSeconds={elapsedSeconds} currentAccuracy={accuracy} currentAnswered={stats.answered} currentMode={settings.practiceMode} currentRecognitionMs={averageRecognitionMs} />
          <section className="practice-stage">
            <div className="practice-meta">
              <div><p className="eyebrow">{practiceTitle}</p><h1>{clefLabel}<span> · {rangeLabel} · {KEY_SIGNATURES[settings.keySignature].label}</span></h1></div>
              <div className="session-summary">
                {settings.practiceMode === "flow" && <span className="tempo-control"><button aria-label="Замедлить" onClick={() => adjustFlowBpm(-1)}>−</button><span className="tempo-badge">{flowBpm} BPM{settings.adaptiveFlowBpm ? " · авто" : " · фикс."}</span><button aria-label="Ускорить" onClick={() => adjustFlowBpm(1)}>+</button></span>}
                <span className="session-clock">{formatDuration(elapsedSeconds)}</span><span className="session-counter" aria-label="Номер задания">{currentPosition}</span>
              </div>
            </div>
            <div className={`notation-card feedback-${feedback}`}>
              {settings.practiceMode === "flow" ? <FlowStaff questions={flowQueue} state={feedback} theme={settings.theme} bpm={flowBpm} paused={paused || settingsOpen || launchOpen || completed} onTimeout={handleFlowTick} />
                : settings.practiceMode === "placement" ? <PlacementStaff question={question} state={feedback} theme={settings.theme} placedIndex={placedIndex} disabled={paused || settingsOpen || launchOpen || completed} onPlace={submitPlacement} />
                  : <MusicStaff question={question} state={feedback} theme={settings.theme} />}
              <div className="feedback-line" aria-live="polite"><span className={`feedback-icon feedback-${feedback}`}>{feedback === "correct" ? "✓" : feedback === "wrong" ? "↺" : feedback === "revealed" ? "→" : "·"}</span><span>{feedbackText}</span></div>
            </div>
            {settings.practiceMode !== "placement" && <PianoKeyboard activeNotes={activeNotes} revealedNote={feedback === "revealed" && settings.practiceMode === "study" ? activeQuestion?.midiNote : undefined} disabled={paused || settingsOpen || launchOpen || completed} onNoteOn={noteOn} onNoteOff={noteOff} />}
            <div className="practice-footer"><div className="stats-row"><span>Точность <strong>{accuracy}%</strong></span><span>Ошибки <strong>{stats.totalMistakes}</strong></span>{settings.practiceMode === "study" && <span>Распознавание <strong>{averageRecognitionMs ? `${(averageRecognitionMs / 1000).toFixed(1)} с` : "—"}</strong></span>}{settings.practiceMode === "flow" && <span>Пропущено <strong>{stats.missed}</strong></span>}<span>Серия <strong>{stats.streak}</strong></span></div><p className="footer-hint"><kbd>Esc</kbd> настройки и управление</p></div>
          </section>
        </div>
      ) : (
        <section className="practice-stage free-stage">
          <div className="practice-meta"><div><p className="eyebrow">Свободный режим</p><h1>{clefLabel}<span> · без статистики</span></h1></div><div className="session-summary"><span className="tempo-control"><button aria-label="Замедлить" onClick={() => adjustFlowBpm(-1)}>−</button><span className="tempo-badge">{flowBpm} BPM</span><button aria-label="Ускорить" onClick={() => adjustFlowBpm(1)}>+</button></span></div></div>
          <div className="notation-card free-card"><FreePlayStaff notes={freeNotes} referenceQuestion={freeReferenceQuestion} bpm={flowBpm} paused={paused || settingsOpen || launchOpen} theme={settings.theme} onExpire={(ids) => setFreeNotes((current) => current.filter((note) => !ids.includes(note.id)))} /><div className="feedback-line"><span className="feedback-icon">♪</span><span>Играй — нажатые ноты появятся на стане</span></div></div>
          <PianoKeyboard activeNotes={activeNotes} disabled={paused || settingsOpen || launchOpen} onNoteOn={noteOn} onNoteOff={noteOff} />
          <div className="practice-footer"><div className="stats-row"><span>Сыграно на экране <strong>{freeNotes.length}</strong></span></div><p className="footer-hint"><kbd>R</kbd> очистить поток</p></div>
        </section>
      )}

      {paused && !settingsOpen && !launchOpen && !completed && <div className="pause-overlay"><button className="pause-card" onClick={() => setPaused(false)}><span className="pause-symbol">Ⅱ</span><strong>Пауза</strong><small>Space или нажми здесь, чтобы продолжить</small></button></div>}
      {completed && <div className="settings-backdrop"><section className="completion-card" role="dialog" aria-modal="true"><p className="eyebrow">Сессия завершена</p><h2>{accuracy}% точности</h2><p>{stats.answered} нот · {formatDuration(elapsedSeconds)} · лучшая серия {stats.bestStreak}</p><button className="primary-button" onClick={() => restartSession()}>Новая сессия <kbd>R</kbd></button></section></div>}
      {(launchOpen || settingsOpen) && <SettingsMenu settings={settings} tool={tool} launch={launchOpen} midiDevices={midiDevices} onChange={updateSettings} onToolChange={changeTool} onClose={closeMenu} />}
    </main>
  );
}
