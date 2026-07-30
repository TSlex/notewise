import { getDiatonicIndex } from "../trainers/noteReading";
import type { NoteQuestion } from "../trainers/types";

export type NotationState = "waiting" | "correct" | "wrong" | "revealed";

const CLEF_BOTTOM_LINE_MIDI = {
  treble: 64,
  bass: 43,
} as const;

function cssColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

export function prepareCanvas(
  canvas: HTMLCanvasElement,
  height = 240,
) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width, 320);
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

export function drawNotation(
  context: CanvasRenderingContext2D,
  width: number,
  question: NoteQuestion,
  state: NotationState,
  progress?: number,
) {
  const text = cssColor("--text", "#f5f4ef");
  const lineColor = cssColor("--staff-line", "rgba(245, 244, 239, 0.64)");
  const colors: Record<NotationState, string> = {
    waiting: text,
    correct: cssColor("--success", "#88f0c8"),
    wrong: cssColor("--error", "#ff9f8f"),
    revealed: cssColor("--warning", "#ffd786"),
  };
  const ink = colors[state];
  const spacing = 18;
  const topLine = 76;
  const bottomLine = topLine + spacing * 4;
  const staffLeft = Math.max(78, width * 0.09);
  const staffRight = width - Math.max(38, width * 0.05);
  const fixedNoteX = staffLeft + (staffRight - staffLeft) * 0.62;
  const flowStartX = staffLeft + 104;
  const finishLineX = staffLeft + (staffRight - staffLeft) * 0.84;
  const noteX =
    progress === undefined
      ? fixedNoteX
      : flowStartX + (finishLineX - flowStartX) * Math.min(progress, 1);

  context.strokeStyle = lineColor;
  context.lineWidth = 1.25;
  for (let line = 0; line < 5; line += 1) {
    const y = topLine + line * spacing;
    context.beginPath();
    context.moveTo(staffLeft, y);
    context.lineTo(staffRight, y);
    context.stroke();
  }

  if (progress !== undefined) {
    context.save();
    context.strokeStyle = cssColor("--accent", "#b9f759");
    context.lineWidth = 2;
    context.setLineDash([5, 6]);
    context.beginPath();
    context.moveTo(finishLineX, topLine - 29);
    context.lineTo(finishLineX, bottomLine + 30);
    context.stroke();
    context.restore();
  }

  context.fillStyle = text;
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

  const baseIndex = getDiatonicIndex(CLEF_BOTTOM_LINE_MIDI[question.clef]);
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
}
