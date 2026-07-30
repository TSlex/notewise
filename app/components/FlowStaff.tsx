"use client";

import { useEffect, useRef } from "react";
import {
  drawNotation,
  prepareCanvas,
  type NotationState,
} from "../lib/drawNotation";
import type { NoteQuestion, ThemeMode } from "../trainers/types";

type FlowStaffProps = {
  question: NoteQuestion;
  state: NotationState;
  theme: ThemeMode;
  durationMs: number;
  paused: boolean;
  onTimeout: () => void;
};

export function FlowStaff({
  question,
  state,
  theme,
  durationMs,
  paused,
  onTimeout,
}: FlowStaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const stateRef = useRef(state);
  const timeoutRef = useRef(onTimeout);

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

      const settled =
        stateRef.current === "correct" || stateRef.current === "revealed";
      if (!pausedRef.current && !settled) {
        lastProgress = Math.min((now - startedAt) / durationMs, 1);
      }

      const prepared = prepareCanvas(canvas);
      if (prepared) {
        drawNotation(
          prepared.context,
          prepared.width,
          question,
          stateRef.current,
          lastProgress,
        );
      }

      if (lastProgress >= 1 && !timedOut && !settled) {
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
  }, [question.id]);

  return (
    <canvas
      ref={canvasRef}
      className="music-staff flow-staff"
      aria-label={`${question.clef === "treble" ? "Скрипичный" : "Басовый"} ключ, движущаяся нота`}
    />
  );
}
