"use client";

import { useEffect, useRef } from "react";
import {
  GRAND_STAFF_HEIGHT,
  drawNotation,
  prepareCanvas,
  SINGLE_STAFF_HEIGHT,
  type NotationState,
} from "../lib/drawNotation";
import type { ClefMode, NoteDuration, NoteQuestion, ThemeMode } from "../trainers/types";

type MusicStaffProps = {
  question: NoteQuestion;
  state: NotationState;
  theme: ThemeMode;
  clefMode: ClefMode;
  duration: NoteDuration;
};

export function MusicStaff({ question, state, theme, clefMode, duration }: MusicStaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grandStaff = clefMode === "mixed";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const prepared = prepareCanvas(canvas, grandStaff ? GRAND_STAFF_HEIGHT : SINGLE_STAFF_HEIGHT);
      if (!prepared) return;
      drawNotation(prepared.context, prepared.width, question, state, undefined, { grandStaff, duration });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [duration, grandStaff, question, state, theme]);

  return (
    <canvas
      ref={canvasRef}
      className={`music-staff ${grandStaff ? "grand-staff" : ""}`}
      aria-label={`${question.clef === "treble" ? "Скрипичный" : "Басовый"} ключ, нота для угадывания`}
    />
  );
}
