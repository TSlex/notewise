"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  drawNotation,
  getDiatonicIndexAtY,
  prepareCanvas,
  type NotationState,
} from "../lib/drawNotation";
import { NOTE_NAMES } from "../trainers/noteReading";
import type { NoteQuestion, ThemeMode } from "../trainers/types";

type PlacementStaffProps = {
  question: NoteQuestion;
  state: NotationState;
  theme: ThemeMode;
  placedIndex: number | null;
  disabled: boolean;
  onPlace: (diatonicIndex: number) => void;
};

function candidateAt(question: NoteQuestion, diatonicIndex: number): NoteQuestion {
  const letterIndex = ((diatonicIndex % 7) + 7) % 7;
  return {
    ...question,
    id: `${question.id}-candidate-${diatonicIndex}`,
    letterIndex,
    noteName: NOTE_NAMES[letterIndex],
    octave: Math.floor(diatonicIndex / 7),
  };
}

export function PlacementStaff({
  question,
  state,
  theme,
  placedIndex,
  disabled,
  onPlace,
}: PlacementStaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const visibleIndex = state === "revealed"
    ? question.octave * 7 + question.letterIndex
    : placedIndex ?? hoveredIndex;
  const visibleQuestion = useMemo(
    () => visibleIndex === null ? null : candidateAt(question, visibleIndex),
    [question, visibleIndex],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const prepared = prepareCanvas(canvas);
      if (!prepared) return;
      drawNotation(prepared.context, prepared.width, question, "waiting", undefined, { hideNote: true });
      if (visibleQuestion) {
        const preview = placedIndex === null && state === "waiting";
        drawNotation(
          prepared.context,
          prepared.width,
          visibleQuestion,
          preview ? "waiting" : state,
          undefined,
          { notationOnly: true, noteOpacity: preview ? 0.42 : 1 },
        );
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [placedIndex, question, state, theme, visibleQuestion]);

  const indexFromPointer = (clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const y = ((clientY - rect.top) / rect.height) * 240;
    return getDiatonicIndexAtY(question.clef, Math.max(12, Math.min(222, y)), rect.width);
  };

  return (
    <canvas
      ref={canvasRef}
      className="music-staff placement-staff"
      aria-label="Нотный стан для расстановки ноты мышью"
      onPointerMove={(event) => {
        if (disabled || placedIndex !== null) return;
        setHoveredIndex(indexFromPointer(event.clientY));
      }}
      onPointerLeave={() => setHoveredIndex(null)}
      onClick={(event) => {
        if (disabled || placedIndex !== null) return;
        const index = indexFromPointer(event.clientY);
        if (index !== null) onPlace(index);
      }}
    />
  );
}
