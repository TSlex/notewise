"use client";

import { useEffect, useRef } from "react";
import { getDiatonicIndex } from "../trainers/noteReading";
import type { NoteQuestion } from "../trainers/types";

type MusicStaffProps = {
  question: NoteQuestion;
  state: "waiting" | "correct" | "wrong" | "revealed";
};

const CLEF_BOTTOM_LINE_MIDI = {
  treble: 64,
  bass: 43,
} as const;

export function MusicStaff({ question, state }: MusicStaffProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(rect.width, 320);
      const height = 240;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(dpr, dpr);
      context.clearRect(0, 0, width, height);

      const ink =
        state === "correct"
          ? "#88f0c8"
          : state === "wrong"
            ? "#ff9f8f"
            : state === "revealed"
              ? "#ffd786"
              : "#f5f4ef";
      const lineColor = "rgba(245, 244, 239, 0.64)";
      const spacing = 18;
      const topLine = 76;
      const bottomLine = topLine + spacing * 4;
      const staffLeft = Math.max(78, width * 0.13);
      const staffRight = width - Math.max(42, width * 0.07);
      const noteX = staffLeft + (staffRight - staffLeft) * 0.62;

      context.strokeStyle = lineColor;
      context.lineWidth = 1.25;
      for (let line = 0; line < 5; line += 1) {
        const y = topLine + line * spacing;
        context.beginPath();
        context.moveTo(staffLeft, y);
        context.lineTo(staffRight, y);
        context.stroke();
      }

      context.fillStyle = "#f5f4ef";
      context.font =
        question.clef === "treble"
          ? "76px 'Segoe UI Symbol', 'Noto Music', serif"
          : "64px 'Segoe UI Symbol', 'Noto Music', serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        question.clef === "treble" ? "𝄞" : "𝄢",
        staffLeft + 39,
        question.clef === "treble" ? topLine + 36 : topLine + 35,
      );

      const baseIndex = getDiatonicIndex(
        CLEF_BOTTOM_LINE_MIDI[question.clef],
      );
      const noteIndex = getDiatonicIndex(question.midiNote);
      const noteY = bottomLine - (noteIndex - baseIndex) * (spacing / 2);

      context.strokeStyle = lineColor;
      context.lineWidth = 1.4;
      if (noteY <= topLine - spacing) {
        for (let y = topLine - spacing; y >= noteY - 1; y -= spacing) {
          context.beginPath();
          context.moveTo(noteX - 20, y);
          context.lineTo(noteX + 20, y);
          context.stroke();
        }
      }
      if (noteY >= bottomLine + spacing) {
        for (let y = bottomLine + spacing; y <= noteY + 1; y += spacing) {
          context.beginPath();
          context.moveTo(noteX - 20, y);
          context.lineTo(noteX + 20, y);
          context.stroke();
        }
      }

      context.save();
      context.translate(noteX, noteY);
      context.rotate(-0.2);
      context.fillStyle = ink;
      context.beginPath();
      context.ellipse(0, 0, 12, 8.5, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();

      context.strokeStyle = ink;
      context.lineWidth = 2.3;
      context.beginPath();
      if (noteY < topLine + spacing * 2) {
        context.moveTo(noteX - 10, noteY + 1);
        context.lineTo(noteX - 10, noteY + 55);
      } else {
        context.moveTo(noteX + 10, noteY - 1);
        context.lineTo(noteX + 10, noteY - 55);
      }
      context.stroke();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [question, state]);

  return (
    <canvas
      ref={canvasRef}
      className="music-staff"
      aria-label={`${question.clef === "treble" ? "Скрипичный" : "Басовый"} ключ, нота для угадывания`}
    />
  );
}
