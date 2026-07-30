"use client";

import { useEffect, useRef } from "react";
import {
  drawNotation,
  prepareCanvas,
  type NotationState,
} from "../lib/drawNotation";
import type { NoteQuestion, ThemeMode } from "../trainers/types";

type MusicStaffProps = {
  question: NoteQuestion;
  state: NotationState;
  theme: ThemeMode;
};

export function MusicStaff({ question, state, theme }: MusicStaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const prepared = prepareCanvas(canvas);
      if (!prepared) return;
      drawNotation(prepared.context, prepared.width, question, state);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [question, state, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="music-staff"
      aria-label={`${question.clef === "treble" ? "Скрипичный" : "Басовый"} ключ, нота для угадывания`}
    />
  );
}
