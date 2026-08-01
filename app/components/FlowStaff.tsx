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

type FlowStaffProps = {
  questions: NoteQuestion[];
  state: NotationState;
  theme: ThemeMode;
  bpm: number;
  paused: boolean;
  clefMode: ClefMode;
  duration: NoteDuration;
  onTimeout: () => void;
};

export function FlowStaff({
  questions,
  state,
  theme,
  bpm,
  paused,
  clefMode,
  duration,
  onTimeout,
}: FlowStaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const stateRef = useRef(state);
  const timeoutRef = useRef(onTimeout);
  const grandStaff = clefMode === "mixed";

  useEffect(() => {
    pausedRef.current = paused;
    stateRef.current = state;
    timeoutRef.current = onTimeout;
  }, [onTimeout, paused, state, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    let startedAt = performance.now();
    let pauseStartedAt: number | null = pausedRef.current
      ? performance.now()
      : null;
    let lastProgress = 0;
    let timedOut = false;

    const render = (now: number) => {
      if (pausedRef.current) {
        if (pauseStartedAt === null) pauseStartedAt = now;
      } else if (pauseStartedAt !== null) {
        startedAt += now - pauseStartedAt;
        pauseStartedAt = null;
      }

      if (!pausedRef.current) {
        lastProgress = Math.min((now - startedAt) / (60_000 / bpm), 1);
      }

      const prepared = prepareCanvas(canvas, grandStaff ? GRAND_STAFF_HEIGHT : SINGLE_STAFF_HEIGHT);
      if (prepared) {
        questions.slice(0, 5).forEach((question, index) => {
          drawNotation(
            prepared.context,
            prepared.width,
            question,
            index === 0 ? stateRef.current : "waiting",
            lastProgress,
            {
              flowIndex: index,
              notationOnly: index > 0,
              grandStaff,
              duration,
              noteOpacity: index === 0 && stateRef.current === "correct" ? 0.36 : 1,
            },
          );
        });
      }

      if (lastProgress >= 1 && !timedOut) {
        timedOut = true;
        timeoutRef.current();
        return;
      }

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
    // Скорость фиксируется для текущей ноты и меняется со следующего задания.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions[0]?.id, bpm, duration, grandStaff]);

  return (
    <canvas
      ref={canvasRef}
      className={`music-staff flow-staff ${grandStaff ? "grand-staff" : ""}`}
      aria-label="Очередь нот движется справа налево в ритме метронома"
    />
  );
}
