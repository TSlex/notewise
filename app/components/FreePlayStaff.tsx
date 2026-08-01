"use client";

import { useEffect, useRef } from "react";
import { drawNotation, getStaffMetrics, GRAND_STAFF_HEIGHT, prepareCanvas, SINGLE_STAFF_HEIGHT } from "../lib/drawNotation";
import { getDiatonicIndex } from "../trainers/noteReading";
import type { ClefMode, NoteDuration, NoteQuestion, ThemeMode } from "../trainers/types";

const CHORD_WINDOW_MS = 45;

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
  clefMode: ClefMode;
  duration: NoteDuration;
  onExpire: (ids: string[]) => void;
};

export function FreePlayStaff({
  notes,
  referenceQuestion,
  bpm,
  paused,
  theme,
  clefMode,
  duration,
  onExpire,
}: FreePlayStaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef(notes);
  const pausedRef = useRef(paused);
  const pauseStartedRef = useRef<number | null>(null);
  const totalPausedRef = useRef(0);
  const virtualStartsRef = useRef(new Map<string, number>());
  const expireRef = useRef(onExpire);
  const grandStaff = clefMode === "mixed";

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
      const prepared = prepareCanvas(canvas, grandStaff ? GRAND_STAFF_HEIGHT : SINGLE_STAFF_HEIGHT);
      if (prepared) {
        drawNotation(prepared.context, prepared.width, referenceQuestion, "waiting", undefined, { hideNote: true, grandStaff, duration });
        const { staffLeft, staffRight } = getStaffMetrics(prepared.width, referenceQuestion.clef, grandStaff);
        const beatMs = 60_000 / Math.max(1, bpm);
        const travelPerBeat = Math.max(70, (staffRight - staffLeft) / 5);
        const expired: string[] = [];
        const groups: PlayedNote[][] = [];
        notesRef.current
          .slice()
          .sort((a, b) => a.startedAt - b.startedAt)
          .forEach((note) => {
            const group = groups[groups.length - 1];
            if (group && group[0].question.clef === note.question.clef && note.startedAt - group[0].startedAt <= CHORD_WINDOW_MS) group.push(note);
            else groups.push([note]);
          });

        groups.forEach((group) => {
          group.forEach((note) => {
            if (!virtualStartsRef.current.has(note.id)) virtualStartsRef.current.set(note.id, group[0].startedAt - totalPausedRef.current);
          });
          const virtualStart = virtualStartsRef.current.get(group[0].id) ?? group[0].startedAt;
          const x = staffRight - 18 - ((visualNow - virtualStart) / beatMs) * travelPerBeat;
          if (x < staffLeft + 62) {
            group.forEach((note) => {
              expired.push(note.id);
              virtualStartsRef.current.delete(note.id);
            });
            return;
          }
          const sorted = group.slice().sort((a, b) => getDiatonicIndex(a.question) - getDiatonicIndex(b.question));
          const averageMidi = sorted.reduce((sum, note) => sum + note.question.midiNote, 0) / sorted.length;
          const stemDirection = averageMidi >= (sorted[0].question.clef === "treble" ? 71 : 50) ? "down" : "up";
          let previousIndex: number | null = null;
          let offset = 0;
          sorted.forEach((note) => {
            const index = getDiatonicIndex(note.question);
            if (previousIndex !== null && index - previousIndex === 1) offset = offset === 0 ? 13 : 0;
            else offset = 0;
            drawNotation(prepared.context, prepared.width, note.question, "waiting", undefined, {
              notationOnly: true,
              noteX: x,
              grandStaff,
              duration,
              stemDirection,
              headOffset: offset,
            });
            previousIndex = index;
          });
        });
        if (expired.length) expireRef.current(expired);
      }
      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [bpm, duration, grandStaff, referenceQuestion]);

  return (
    <canvas
      ref={canvasRef}
      className={`music-staff free-play-staff ${grandStaff ? "grand-staff" : ""}`}
      aria-label="Ноты, сыгранные в свободном режиме, движутся справа налево"
    />
  );
}
