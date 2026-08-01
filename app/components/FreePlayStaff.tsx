"use client";

import { useEffect, useRef } from "react";
import { drawNotation, getStaffMetrics, prepareCanvas } from "../lib/drawNotation";
import type { NoteQuestion, ThemeMode } from "../trainers/types";

export type PlayedNote = {
  id: string;
  question: NoteQuestion;
  startedAt: number;
};

type FreePlayStaffProps = {
  notes: PlayedNote[];
  referenceQuestion: NoteQuestion;
  bpm: number;
  paused: boolean;
  theme: ThemeMode;
  onExpire: (ids: string[]) => void;
};

export function FreePlayStaff({
  notes,
  referenceQuestion,
  bpm,
  paused,
  theme,
  onExpire,
}: FreePlayStaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef(notes);
  const pausedRef = useRef(paused);
  const pauseStartedRef = useRef<number | null>(null);
  const totalPausedRef = useRef(0);
  const virtualStartsRef = useRef(new Map<string, number>());
  const expireRef = useRef(onExpire);

  useEffect(() => {
    notesRef.current = notes;
    pausedRef.current = paused;
    expireRef.current = onExpire;
  }, [notes, onExpire, paused, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;

    const render = (now: number) => {
      if (pausedRef.current && pauseStartedRef.current === null) pauseStartedRef.current = now;
      if (!pausedRef.current && pauseStartedRef.current !== null) {
        totalPausedRef.current += now - pauseStartedRef.current;
        pauseStartedRef.current = null;
      }
      const visualNow = (pauseStartedRef.current ?? now) - totalPausedRef.current;
      const prepared = prepareCanvas(canvas);
      if (prepared) {
        drawNotation(prepared.context, prepared.width, referenceQuestion, "waiting", undefined, { hideNote: true });
        const { staffLeft, staffRight } = getStaffMetrics(prepared.width);
        const beatMs = 60_000 / Math.max(1, bpm);
        const travelPerBeat = Math.max(70, (staffRight - staffLeft) / 5);
        const expired: string[] = [];
        notesRef.current.forEach((note) => {
          if (!virtualStartsRef.current.has(note.id)) {
            virtualStartsRef.current.set(note.id, note.startedAt - totalPausedRef.current);
          }
          const virtualStart = virtualStartsRef.current.get(note.id) ?? note.startedAt;
          const x = staffRight - 18 - ((visualNow - virtualStart) / beatMs) * travelPerBeat;
          if (x < staffLeft + 62) {
            expired.push(note.id);
            virtualStartsRef.current.delete(note.id);
            return;
          }
          drawNotation(prepared.context, prepared.width, note.question, "waiting", undefined, {
            notationOnly: true,
            noteX: x,
          });
        });
        if (expired.length) expireRef.current(expired);
      }
      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [bpm, referenceQuestion]);

  return (
    <canvas
      ref={canvasRef}
      className="music-staff free-play-staff"
      aria-label="Ноты, сыгранные в свободном режиме, движутся справа налево"
    />
  );
}
