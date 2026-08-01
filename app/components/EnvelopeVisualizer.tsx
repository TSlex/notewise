"use client";

import { useEffect, useRef } from "react";
import type { ThemeMode } from "../trainers/types";

type EnvelopeVisualizerProps = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  theme: ThemeMode;
};

function color(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function EnvelopeVisualizer({ attack, decay, sustain, release, theme }: EnvelopeVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(280, rect.width);
      const height = 180;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const padX = 24;
      const top = 20;
      const bottom = 145;
      const graphWidth = width - padX * 2;
      const hold = 0.55;
      const total = attack + decay + hold + release;
      const minSegment = 34;
      const flexibleWidth = Math.max(1, graphWidth - minSegment * 4);
      const segmentWidth = (seconds: number) => minSegment + flexibleWidth * (seconds / total);
      const rawWidths = [attack, decay, hold, release].map(segmentWidth);
      const scale = graphWidth / rawWidths.reduce((sum, value) => sum + value, 0);
      const [attackWidth, decayWidth, holdWidth, releaseWidth] = rawWidths.map((value) => value * scale);
      const sustainY = bottom - (bottom - top) * sustain;
      const points = [
        [padX, bottom],
        [padX + attackWidth, top],
        [padX + attackWidth + decayWidth, sustainY],
        [padX + attackWidth + decayWidth + holdWidth, sustainY],
        [padX + attackWidth + decayWidth + holdWidth + releaseWidth, bottom],
      ] as const;

      context.strokeStyle = color("--border", "rgba(255,255,255,.14)");
      context.lineWidth = 1;
      context.setLineDash([4, 6]);
      for (let row = 0; row <= 4; row += 1) {
        const y = top + ((bottom - top) / 4) * row;
        context.beginPath();
        context.moveTo(padX, y);
        context.lineTo(width - padX, y);
        context.stroke();
      }
      context.setLineDash([]);

      const gradient = context.createLinearGradient(padX, top, width - padX, bottom);
      gradient.addColorStop(0, color("--accent", "#b9f759"));
      gradient.addColorStop(1, color("--success", "#88f0c8"));
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => context.lineTo(x, y));
      context.lineTo(width - padX, bottom);
      context.closePath();
      context.globalAlpha = 0.12;
      context.fillStyle = gradient;
      context.fill();
      context.globalAlpha = 1;
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => context.lineTo(x, y));
      context.strokeStyle = gradient;
      context.lineWidth = 3;
      context.lineJoin = "round";
      context.stroke();

      context.fillStyle = color("--surface-elevated", "#181d1b");
      context.strokeStyle = color("--accent", "#b9f759");
      context.lineWidth = 2;
      points.slice(1, -1).forEach(([x, y]) => {
        context.beginPath();
        context.arc(x, y, 4.5, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });

      const boundaries = [padX, points[1][0], points[2][0], points[3][0], width - padX];
      const labels = ["A", "D", "S", "R"];
      context.fillStyle = color("--muted", "#909a94");
      context.font = "11px ui-monospace, monospace";
      context.textAlign = "center";
      labels.forEach((label, index) => context.fillText(label, (boundaries[index] + boundaries[index + 1]) / 2, 166));
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [attack, decay, release, sustain, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="envelope-visualizer"
      role="img"
      aria-label={`Огибающая: attack ${attack.toFixed(3)} секунды, decay ${decay.toFixed(3)} секунды, sustain ${sustain.toFixed(2)}, release ${release.toFixed(3)} секунды`}
    />
  );
}
