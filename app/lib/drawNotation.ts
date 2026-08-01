import { getDiatonicIndex, KEY_SIGNATURES } from "../trainers/noteReading";
import type { NoteQuestion } from "../trainers/types";

export type NotationState = "waiting" | "correct" | "wrong" | "revealed";

const CLEF_BOTTOM_LINE = {
  treble: { letterIndex: 2, octave: 4 },
  bass: { letterIndex: 4, octave: 2 },
} as const;

const SHARP_STEPS = { treble: [8, 5, 9, 6, 3, 7, 4], bass: [6, 3, 7, 4, 1, 5, 2] };
const FLAT_STEPS = { treble: [4, 7, 3, 6, 2, 5, 1], bass: [2, 5, 1, 4, 0, 3, -1] };

export function getStaffMetrics(width: number) {
  const spacing = 18;
  const topLine = 76;
  const bottomLine = topLine + spacing * 4;
  const staffMargin = Math.max(48, width * 0.055);
  return {
    spacing,
    topLine,
    bottomLine,
    staffLeft: staffMargin,
    staffRight: width - staffMargin,
  };
}

export function getDiatonicIndexAtY(clef: NoteQuestion["clef"], y: number, width: number) {
  const { spacing, bottomLine } = getStaffMetrics(width);
  const baseIndex = getDiatonicIndex(CLEF_BOTTOM_LINE[clef]);
  return baseIndex + Math.round((bottomLine - y) / (spacing / 2));
}

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
  options: {
    flowIndex?: number;
    notationOnly?: boolean;
    hideNote?: boolean;
    noteX?: number;
    noteOpacity?: number;
  } = {},
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
  const { spacing, topLine, bottomLine, staffLeft, staffRight } = getStaffMetrics(width);
  const fixedNoteX = width / 2;
  const finishLineX = staffLeft + Math.max(122, width * 0.16);
  const flowIndex = options.flowIndex ?? 0;
  const flowSpacing = Math.min(135, (staffRight - finishLineX) / 4.2);
  const noteX = options.noteX ?? (
    progress === undefined
      ? fixedNoteX
      : finishLineX + (1 - Math.min(progress, 1) + flowIndex) * flowSpacing
  );

  if (!options.notationOnly) {
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

  const fifths = KEY_SIGNATURES[question.keySignature].fifths;
  if (fifths !== 0) {
    const symbols = fifths > 0 ? SHARP_STEPS[question.clef] : FLAT_STEPS[question.clef];
    context.font = "28px 'Segoe UI Symbol', serif";
    context.textAlign = "center";
    for (let index = 0; index < Math.abs(fifths); index += 1) {
      context.fillText(
        fifths > 0 ? "♯" : "♭",
        staffLeft + 82 + index * 16,
        bottomLine - symbols[index] * (spacing / 2),
      );
    }
  }
  }

  if (options.hideNote) return;

  const baseIndex = getDiatonicIndex(CLEF_BOTTOM_LINE[question.clef]);
  const noteIndex = getDiatonicIndex(question);
  const noteY = bottomLine - (noteIndex - baseIndex) * (spacing / 2);

  context.save();
  context.globalAlpha = options.noteOpacity ?? 1;
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

  if (question.displayAccidental) {
    context.fillStyle = ink;
    context.font = "29px 'Segoe UI Symbol', serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(question.displayAccidental, noteX - 29, noteY + 1);
  }
  context.restore();
}
