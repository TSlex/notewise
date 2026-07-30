"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ClefMode,
  PracticeMode,
  RangePreset,
  SessionLength,
  ThemeMode,
  TrainerSettings,
} from "../trainers/types";

type SettingsMenuProps = {
  settings: TrainerSettings;
  onChange: (settings: TrainerSettings) => void;
  onClose: () => void;
};

const rows = [
  "mode",
  "clef",
  "range",
  "length",
  "theme",
  "sound",
  "volume",
] as const;
type Row = (typeof rows)[number];

const MODES: PracticeMode[] = ["study", "flow"];
const CLEFS: ClefMode[] = ["treble", "bass", "mixed"];
const RANGES: RangePreset[] = ["octave", "octave-half", "two-octaves"];
const LENGTHS: SessionLength[] = [10, 20, "endless"];
const THEMES: ThemeMode[] = ["dark", "light"];

const clefLabels: Record<ClefMode, string> = {
  treble: "Скрипичный",
  bass: "Басовый",
  mixed: "Вперемешку",
};
const rangeLabels: Record<RangePreset, string> = {
  octave: "1 октава",
  "octave-half": "1½ октавы",
  "two-octaves": "2 октавы",
};

function nextValue<T>(values: T[], current: T, direction: number) {
  const currentIndex = values.indexOf(current);
  return values[(currentIndex + direction + values.length) % values.length];
}

export function SettingsMenu({
  settings,
  onChange,
  onClose,
}: SettingsMenuProps) {
  const [activeRow, setActiveRow] = useState(0);

  const cycleRow = useCallback(
    (row: Row, direction: number) => {
      if (row === "mode") {
        onChange({
          ...settings,
          practiceMode: nextValue(
            MODES,
            settings.practiceMode,
            direction,
          ),
        });
      }
      if (row === "clef") {
        onChange({
          ...settings,
          clefMode: nextValue(CLEFS, settings.clefMode, direction),
        });
      }
      if (row === "range") {
        onChange({
          ...settings,
          range: nextValue(RANGES, settings.range, direction),
        });
      }
      if (row === "length") {
        onChange({
          ...settings,
          sessionLength: nextValue(
            LENGTHS,
            settings.sessionLength,
            direction,
          ),
        });
      }
      if (row === "theme") {
        onChange({
          ...settings,
          theme: nextValue(THEMES, settings.theme, direction),
        });
      }
      if (row === "sound") {
        onChange({ ...settings, soundEnabled: !settings.soundEnabled });
      }
      if (row === "volume") {
        onChange({
          ...settings,
          volume: Math.max(
            0,
            Math.min(1, Math.round((settings.volume + direction * 0.1) * 10) / 10),
          ),
        });
      }
    },
    [onChange, settings],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveRow((row) => (row + 1) % rows.length);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveRow((row) => (row - 1 + rows.length) % rows.length);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        cycleRow(rows[activeRow], 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycleRow(rows[activeRow], -1);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeRow, cycleRow, onClose]);

  const menuRows = [
    {
      id: "mode" as const,
      label: "Режим",
      value:
        settings.practiceMode === "flow"
          ? "Чтение на скорость"
          : "Чтение нот",
    },
    {
      id: "clef" as const,
      label: "Ключ",
      value: clefLabels[settings.clefMode],
    },
    {
      id: "range" as const,
      label: "Диапазон",
      value: rangeLabels[settings.range],
    },
    {
      id: "length" as const,
      label: "Серия",
      value:
        settings.sessionLength === "endless"
          ? "Без конца"
          : `${settings.sessionLength} нот`,
    },
    {
      id: "theme" as const,
      label: "Тема",
      value: settings.theme === "light" ? "Светлая" : "Тёмная",
    },
    {
      id: "sound" as const,
      label: "Звук приложения",
      value: settings.soundEnabled ? "Включён" : "Выключен",
    },
    {
      id: "volume" as const,
      label: "Громкость",
      value: `${Math.round(settings.volume * 100)}%`,
    },
  ];

  return (
    <div className="settings-backdrop" role="presentation">
      <section
        className="settings-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="settings-heading">
          <div>
            <p className="eyebrow">Пауза</p>
            <h2 id="settings-title">Настройки тренировки</h2>
          </div>
          <button className="key-button" onClick={onClose} aria-label="Закрыть">
            Esc
          </button>
        </div>

        <div className="settings-grid">
          <div className="setting-list">
            {menuRows.map((row, index) => (
              <button
                className={`setting-row ${activeRow === index ? "is-selected" : ""}`}
                key={row.id}
                onMouseEnter={() => setActiveRow(index)}
                onClick={() => cycleRow(row.id, 1)}
              >
                <span>{row.label}</span>
                <strong>
                  <span className="setting-arrow">‹</span>
                  {row.value}
                  <span className="setting-arrow">›</span>
                </strong>
              </button>
            ))}
            <p className="setting-note">
              Режим, ключ и диапазон начинают новую сессию. Тема, звук и
              громкость меняются сразу.
            </p>
          </div>

          <div className="shortcuts">
            <p className="eyebrow">Управление</p>
            <dl>
              <div>
                <dt>Esc</dt>
                <dd>Настройки / закрыть</dd>
              </div>
              <div>
                <dt>Space</dt>
                <dd>Пауза / продолжить</dd>
              </div>
              <div>
                <dt>↑ ↓</dt>
                <dd>Выбрать настройку</dd>
              </div>
              <div>
                <dt>← →</dt>
                <dd>Изменить значение</dd>
              </div>
              <div>
                <dt>Enter</dt>
                <dd>Применить и продолжить</dd>
              </div>
              <div>
                <dt>R</dt>
                <dd>Завершить и начать заново</dd>
              </div>
              <div>
                <dt>M</dt>
                <dd>Сменить режим</dd>
              </div>
              <div>
                <dt>T</dt>
                <dd>Сменить тему</dd>
              </div>
              <div>
                <dt>S</dt>
                <dd>Включить / выключить звук</dd>
              </div>
              <div>
                <dt>− +</dt>
                <dd>Громкость</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
