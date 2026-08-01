import { getDiatonicIndex, KEY_SIGNATURES } from "../trainers/noteReading";
import type { Clef, NoteDuration, NoteQuestion } from "../trainers/types";

export type NotationState = "waiting" | "correct" | "wrong" | "revealed";
export type StemDirection = "up" | "down";

const CLEF_BOTTOM_LINE = {
  treble: { letterIndex: 2, octave: 4 },
  bass: { letterIndex: 4, octave: 2 },
} as const;

const SHARP_STEPS = { treble: [8, 5, 9, 6, 3, 7, 4], bass: [6, 3, 7, 4, 1, 5, 2] };
const FLAT_STEPS = { treble: [4, 7, 3, 6, 2, 5, 1], bass: [2, 5, 1, 4, 0, 3, -1] };

export const SINGLE_STAFF_HEIGHT = 240;
export const GRAND_STAFF_HEIGHT = 320;

export function getStaffMetrics(width: number, clef: Clef = "treble", grandStaff = false) {
  const spacing = 18;
  const topLine = grandStaff ? (clef === "treble" ? 35 : 206) : 76;
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

export function getDiatonicIndexAtY(clef: Clef, y: number, width: number, grandStaff = false) {
  const { spacing, bottomLine } = getStaffMetrics(width, clef, grandStaff);
  const baseIndex = getDiatonicIndex(CLEF_BOTTOM_LINE[clef]);
  return baseIndex + Math.round((bottomLine - y) / (spacing / 2));
}

function cssColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function prepareCanvas(canvas: HTMLCanvasElement, height = SINGLE_STAFF_HEIGHT) {
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

function drawStaffLines(context: CanvasRenderingContext2D, width: number, clef: Clef, grandStaff: boolean, lineColor: string) {
  const { spacing, topLine, bottomLine, staffLeft, staffRight } = getStaffMetrics(width, clef, grandStaff);
  context.strokeStyle = lineColor;
  context.lineWidth = 1.25;
  for (let line = 0; line < 5; line += 1) {
    const y = topLine + line * spacing;
    context.beginPath();
    context.moveTo(staffLeft, y);
    context.lineTo(staffRight, y);
    context.stroke();
  }

  context.fillStyle = cssColor("--text", "#f5f4ef");
  context.font = clef === "treble"
    ? "76px 'Segoe UI Symbol', 'Noto Music', serif"
    : "64px 'Segoe UI Symbol', 'Noto Music', serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(clef === "treble" ? "𝄞" : "𝄢", staffLeft + 39, clef === "treble" ? topLine + 36 : topLine + 35);

  return { spacing, topLine, bottomLine, staffLeft, staffRight };
}

function drawKeySignature(context: CanvasRenderingContext2D, width: number, question: NoteQuestion, clef: Clef, grandStaff: boolean) {
  const { spacing, bottomLine, staffLeft } = getStaffMetrics(width, clef, grandStaff);
  const fifths = KEY_SIGNATURES[question.keySignature].fifths;
  if (!fifths) return;
  const symbols = fifths > 0 ? SHARP_STEPS[clef] : FLAT_STEPS[clef];
  context.fillStyle = cssColor("--text", "#f5f4ef");
  context.font = "30px 'Segoe UI Symbol', 'Noto Music', serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let index = 0; index < Math.abs(fifths); index += 1) {
    context.fillText(fifths > 0 ? "♯" : "♭", staffLeft + 82 + index * 16, bottomLine - symbols[index] * (spacing / 2));
  }
}

function drawBackground(context: CanvasRenderingContext2D, width: number, question: NoteQuestion, grandStaff: boolean, progress?: number) {
  const lineColor = cssColor("--staff-line", "rgba(245, 244, 239, 0.64)");
  const clefs: Clef[] = grandStaff ? ["treble", "bass"] : [question.clef];
  clefs.forEach((clef) => {
    drawStaffLines(context, width, clef, grandStaff, lineColor);
    drawKeySignature(context, width, question, clef, grandStaff);
  });

  if (grandStaff) {
    const treble = getStaffMetrics(width, "treble", true);
    const bass = getStaffMetrics(width, "bass", true);
    context.save();
    context.strokeStyle = lineColor;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(treble.staffLeft, treble.topLine);
    context.lineTo(treble.staffLeft, bass.bottomLine);
    context.stroke();
    context.restore();
  }

  if (progress !== undefined) {
    const treble = getStaffMetrics(width, "treble", grandStaff);
    const bass = getStaffMetrics(width, grandStaff ? "bass" : question.clef, grandStaff);
    const finishLineX = treble.staffLeft + Math.max(122, width * 0.16);
    context.save();
    context.strokeStyle = cssColor("--accent", "#b9f759");
    context.lineWidth = 2;
    context.setLineDash([5, 6]);
    context.beginPath();
    context.moveTo(finishLineX, treble.topLine - 25);
    context.lineTo(finishLineX, bass.bottomLine + 25);
    context.stroke();
    context.restore();
  }
}

function drawLedgerLines(context: CanvasRenderingContext2D, noteX: number, noteY: number, topLine: number, bottomLine: number, spacing: number, lineColor: string) {
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
}

function drawStemAndFlags(context: CanvasRenderingContext2D, noteX: number, noteY: number, direction: StemDirection, duration: NoteDuration, ink: string) {
  if (duration === "whole") return;
  const stemX = direction === "up" ? noteX + 11.8 : noteX - 11.8;
  const stemEndY = noteY + (direction === "up" ? -55 : 55);
  context.strokeStyle = ink;
  context.lineWidth = 2.3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(stemX, noteY + (direction === "up" ? -1.5 : 1.5));
  context.lineTo(stemX, stemEndY);
  context.stroke();

  const flagCount = duration === "sixteenth" ? 2 : duration === "eighth" ? 1 : 0;
  for (let flag = 0; flag < flagCount; flag += 1) {
    const startY = stemEndY + (direction === "up" ? flag * 11 : -flag * 11);
    const sign = direction === "up" ? 1 : -1;
    context.beginPath();
    context.moveTo(stemX, startY);
    context.bezierCurveTo(stemX + 14, startY + 4 * sign, stemX + 20, startY + 18 * sign, stemX + 11, startY + 27 * sign);
    context.stroke();
  }
}

function drawHead(context: CanvasRenderingContext2D, noteX: number, noteY: number, duration: NoteDuration, ink: string) {
  const open = duration === "whole" || duration === "half";
  context.save();
  context.translate(noteX, noteY);
  context.rotate(-0.2);
  context.fillStyle = open ? cssColor("--surface", "#121615") : ink;
  context.strokeStyle = ink;
  context.lineWidth = open ? 2.6 : 1.2;
  context.beginPath();
  context.ellipse(0, 0, duration === "whole" ? 13.5 : 12.5, duration === "whole" ? 8.2 : 8.7, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
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
    grandStaff?: boolean;
    duration?: NoteDuration;
    stemDirection?: StemDirection;
    headOffset?: number;
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
  const grandStaff = options.grandStaff ?? false;
  const duration = options.duration ?? "quarter";
  const { spacing, topLine, bottomLine, staffLeft, staffRight } = getStaffMetrics(width, question.clef, grandStaff);
  const finishLineX = staffLeft + Math.max(122, width * 0.16);
  const flowIndex = options.flowIndex ?? 0;
  const flowSpacing = Math.min(135, (staffRight - finishLineX) / 4.2);
  const baseX = options.noteX ?? (progress === undefined
    ? width / 2
    : finishLineX + (1 - Math.min(progress, 1) + flowIndex) * flowSpacing);
  const noteX = baseX + (options.headOffset ?? 0);

  if (!options.notationOnly) drawBackground(context, width, question, grandStaff, progress);
  if (options.hideNote) return;

  const baseIndex = getDiatonicIndex(CLEF_BOTTOM_LINE[question.clef]);
  const noteIndex = getDiatonicIndex(question);
  const noteY = bottomLine - (noteIndex - baseIndex) * (spacing / 2);
  const direction = options.stemDirection ?? (noteY < topLine + spacing * 2 ? "down" : "up");

  context.save();
  context.globalAlpha = options.noteOpacity ?? 1;
  drawLedgerLines(context, noteX, noteY, topLine, bottomLine, spacing, lineColor);
  drawStemAndFlags(context, noteX, noteY, direction, duration, ink);
  drawHead(context, noteX, noteY, duration, ink);

  if (question.displayAccidental) {
    context.fillStyle = ink;
    context.font = "34px 'Segoe UI Symbol', 'Noto Music', serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(question.displayAccidental, noteX - 24, noteY + 1);
  }
  context.restore();
}
