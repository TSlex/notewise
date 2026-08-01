"use client";

import { useEffect, useState } from "react";
import type { MidiDevice } from "../hooks/useMidi";
import { KEY_SIGNATURES } from "../trainers/noteReading";
import type {
  ClefMode,
  KeySignature,
  NoteDuration,
  OscillatorWaveform,
  PracticeMode,
  RangePreset,
  SessionLength,
  SynthPreset,
  ThemeMode,
  ToolMode,
  TrainerSettings,
} from "../trainers/types";

type SettingsMenuProps = {
  settings: TrainerSettings;
  tool: ToolMode;
  launch?: boolean;
  midiDevices: MidiDevice[];
  onChange: (settings: TrainerSettings) => void;
  onToolChange: (tool: ToolMode) => void;
  onPreviewSound: () => void;
  onClose: () => void;
};

const KEY_OPTIONS = Object.entries(KEY_SIGNATURES) as Array<
  [KeySignature, { label: string; fifths: number }]
>;

const SYNTH_PRESETS: Record<Exclude<SynthPreset, "custom">, Pick<TrainerSettings, "waveform" | "attack" | "decay" | "sustain" | "release">> = {
  clean: { waveform: "triangle", attack: 0.018, decay: 0.092, sustain: 0.57, release: 0.12 },
  "soft-keys": { waveform: "sine", attack: 0.035, decay: 0.55, sustain: 0.32, release: 0.75 },
  organ: { waveform: "square", attack: 0.008, decay: 0.08, sustain: 0.88, release: 0.18 },
  "synth-lead": { waveform: "sawtooth", attack: 0.025, decay: 0.18, sustain: 0.64, release: 0.32 },
};

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" className={`switch-control ${checked ? "is-on" : ""}`} role="switch" aria-checked={checked} onClick={onChange}>
      <span />{label}
    </button>
  );
}

export function SettingsMenu({
  settings,
  tool,
  launch = false,
  midiDevices,
  onChange,
  onToolChange,
  onPreviewSound,
  onClose,
}: SettingsMenuProps) {
  const [soundOpen, setSoundOpen] = useState(false);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape" && !launch) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [launch, onClose]);

  const set = <K extends keyof TrainerSettings>(key: K, value: TrainerSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };
  const showTrainingSettings = tool === "training";
  const showTempo = tool === "free" || settings.practiceMode === "flow";
  const setSoundParameter = <K extends "waveform" | "attack" | "decay" | "sustain" | "release">(key: K, value: TrainerSettings[K]) => {
    onChange({ ...settings, [key]: value, synthPreset: "custom" });
  };
  const applyPreset = (preset: SynthPreset) => {
    if (preset === "custom") return onChange({ ...settings, synthPreset: preset });
    onChange({ ...settings, ...SYNTH_PRESETS[preset], synthPreset: preset });
  };

  return (
    <div className="settings-backdrop" role="presentation">
      <section className={`settings-menu ${launch ? "launch-menu" : ""}`} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="settings-heading">
          <div>
            <p className="eyebrow">{launch ? "Добро пожаловать" : "Пауза"}</p>
            <h2 id="settings-title">{launch ? "Выбери инструмент" : "Настройки"}</h2>
          </div>
          {!launch && <button className="key-button" onClick={onClose} aria-label="Закрыть">Esc</button>}
        </div>

        <div className="tool-picker" aria-label="Инструмент">
          <button className={tool === "training" ? "is-selected" : ""} onClick={() => onToolChange("training")}>
            <strong>Тренировка</strong><span>Упражнения, статистика и история сессий</span>
          </button>
          <button className={tool === "free" ? "is-selected" : ""} onClick={() => onToolChange("free")}>
            <strong>Свободный режим</strong><span>Играй и наблюдай за нотами без оценки</span>
          </button>
        </div>

        <div className="settings-grid">
          <div className="setting-list">
            {showTrainingSettings && (
              <label className="setting-row">
                <span>Упражнение</span>
                <select value={settings.practiceMode} onChange={(event) => set("practiceMode", event.target.value as PracticeMode)}>
                  <option value="study">Чтение нот</option>
                  <option value="flow">Чтение на скорость</option>
                  <option value="placement">Расстановка нот</option>
                </select>
              </label>
            )}
            <label className="setting-row">
              <span>Ключ</span>
              <select value={settings.clefMode} onChange={(event) => set("clefMode", event.target.value as ClefMode)}>
                <option value="treble">Скрипичный</option>
                <option value="bass">Басовый</option>
                <option value="mixed">Большой стан: оба ключа</option>
              </select>
            </label>
            <label className="setting-row">
              <span>Внешний вид ноты</span>
              <select value={settings.noteDuration} onChange={(event) => set("noteDuration", event.target.value as NoteDuration)}>
                <option value="whole">Целая</option>
                <option value="half">Половинная</option>
                <option value="quarter">Четвертная</option>
                <option value="eighth">Восьмая</option>
                <option value="sixteenth">Шестнадцатая</option>
              </select>
            </label>
            {showTrainingSettings && (
              <>
                <label className="setting-row">
                  <span>Тональность</span>
                  <select value={settings.keySignature} onChange={(event) => set("keySignature", event.target.value as KeySignature)}>
                    <optgroup label="Мажор">
                      {KEY_OPTIONS.filter(([key]) => !key.endsWith("m")).map(([key, item]) => <option value={key} key={key}>{item.label}</option>)}
                    </optgroup>
                    <optgroup label="Минор">
                      {KEY_OPTIONS.filter(([key]) => key.endsWith("m")).map(([key, item]) => <option value={key} key={key}>{item.label}</option>)}
                    </optgroup>
                  </select>
                </label>
                <div className="setting-row">
                  <span>Альтерации вне тональности</span>
                  <Toggle checked={settings.accidentalsEnabled} label={settings.accidentalsEnabled ? "Включены" : "Выключены"} onChange={() => set("accidentalsEnabled", !settings.accidentalsEnabled)} />
                </div>
                <label className="setting-row">
                  <span>Диапазон</span>
                  <select value={settings.range} onChange={(event) => set("range", event.target.value as RangePreset)}>
                    <option value="octave">1 октава</option>
                    <option value="octave-half">1½ октавы</option>
                    <option value="two-octaves">2 октавы</option>
                  </select>
                </label>
                <label className="setting-row">
                  <span>Серия</span>
                  <select value={String(settings.sessionLength)} onChange={(event) => set("sessionLength", event.target.value === "endless" ? "endless" : Number(event.target.value) as SessionLength)}>
                    <option value="10">10 нот</option><option value="20">20 нот</option><option value="endless">Без конца</option>
                  </select>
                </label>
              </>
            )}
            {showTempo && (
              <>
                <label className="setting-row setting-slider">
                  <span>Темп <strong>{settings.flowBpm} BPM</strong></span>
                  <input aria-label="Темп" type="range" min="1" max="200" step="1" value={settings.flowBpm} onChange={(event) => set("flowBpm", Number(event.target.value))} />
                </label>
                <label className="setting-row bpm-number-row">
                  <span>Точное значение BPM</span>
                  <input aria-label="Точное значение BPM" type="number" min="1" max="200" value={settings.flowBpm} onChange={(event) => set("flowBpm", Math.max(1, Math.min(200, Number(event.target.value) || 1)))} />
                </label>
              </>
            )}
            {showTrainingSettings && settings.practiceMode === "flow" && (
              <div className="setting-row">
                <span>Фиксированный BPM</span>
                <Toggle checked={!settings.adaptiveFlowBpm} label={!settings.adaptiveFlowBpm ? "Фиксированный" : "Адаптивный"} onChange={() => set("adaptiveFlowBpm", !settings.adaptiveFlowBpm)} />
              </div>
            )}
            <label className="setting-row">
              <span>MIDI-вход</span>
              <select value={settings.midiInputId} onChange={(event) => set("midiInputId", event.target.value)}>
                <option value="">Автоматически</option>
                {midiDevices.map((device) => <option value={device.id} key={device.id}>{device.name}</option>)}
              </select>
            </label>
            <div className="setting-row">
              <span>Звук приложения</span>
              <Toggle checked={settings.soundEnabled} label={settings.soundEnabled ? "Включён" : "Выключен"} onChange={() => set("soundEnabled", !settings.soundEnabled)} />
            </div>
            <label className="setting-row setting-slider">
              <span>Громкость <strong>{Math.round(settings.volume * 100)}%</strong></span>
              <input aria-label="Громкость" type="range" min="0" max="100" step="5" value={Math.round(settings.volume * 100)} onChange={(event) => set("volume", Number(event.target.value) / 100)} />
            </label>
            <button type="button" className="setting-row sound-designer-button" onClick={() => setSoundOpen(true)}>
              <span>Тембр и огибающая</span><strong>Настроить →</strong>
            </button>
            {showTrainingSettings && settings.practiceMode === "flow" && (
              <div className="setting-row">
                <span>Метроном</span>
                <Toggle checked={settings.metronomeEnabled} label={settings.metronomeEnabled ? "Слышен" : "Без звука"} onChange={() => set("metronomeEnabled", !settings.metronomeEnabled)} />
              </div>
            )}
            <label className="setting-row">
              <span>Цветовая тема</span>
              <select value={settings.theme} onChange={(event) => set("theme", event.target.value as ThemeMode)}>
                <option value="dark">Тёмная</option>
                <option value="light">Светлая</option>
                <option value="lilac">Сиреневая</option>
                <option value="sky">Голубая</option>
                <option value="orange">Оранжевая</option>
              </select>
            </label>
            <p className="setting-note">Старые настройки сохраняются. Параметры упражнения начинают новую сессию, если в текущей уже были ответы.</p>
          </div>

          <div className="shortcuts">
            <p className="eyebrow">Управление</p>
            <dl>
              <div><dt>Esc</dt><dd>Настройки / закрыть</dd></div>
              <div><dt>Space</dt><dd>Пауза / продолжить</dd></div>
              <div><dt>R</dt><dd>Новая сессия</dd></div>
              <div><dt>M</dt><dd>Сменить упражнение</dd></div>
              <div><dt>T</dt><dd>Сменить тему</dd></div>
              <div><dt>S</dt><dd>Включить / выключить звук</dd></div>
              <div><dt>− +</dt><dd>Громкость</dd></div>
            </dl>
            <p className="shortcut-note">Буквенные команды работают по физическому расположению клавиш при любой раскладке.</p>
          </div>
        </div>
        {soundOpen && (
          <div className="sound-designer-page">
            <div className="settings-heading">
              <div><p className="eyebrow">Web Audio синтезатор</p><h2>Настройка звука</h2></div>
              <button type="button" className="key-button" onClick={() => setSoundOpen(false)} aria-label="Вернуться к настройкам">← Назад</button>
            </div>
            <div className="sound-designer-grid">
              <label className="setting-row">
                <span>Пресет</span>
                <select value={settings.synthPreset} onChange={(event) => applyPreset(event.target.value as SynthPreset)}>
                  <option value="clean">Чистый · по умолчанию</option>
                  <option value="soft-keys">Мягкие клавиши</option>
                  <option value="organ">Орган</option>
                  <option value="synth-lead">Синт-лид</option>
                  <option value="custom">Пользовательский</option>
                </select>
              </label>
              <label className="setting-row">
                <span>Форма волны</span>
                <select value={settings.waveform} onChange={(event) => setSoundParameter("waveform", event.target.value as OscillatorWaveform)}>
                  <option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="sawtooth">Sawtooth</option>
                </select>
              </label>
              {([
                ["attack", "Attack", 0.005, 2, 0.005],
                ["decay", "Decay", 0.01, 2, 0.01],
                ["sustain", "Sustain", 0, 1, 0.01],
                ["release", "Release", 0.02, 3, 0.01],
              ] as const).map(([key, label, min, max, step]) => (
                <label className="setting-row setting-slider" key={key}>
                  <span>{label} <strong>{settings[key].toFixed(key === "sustain" ? 2 : 3)}{key === "sustain" ? "" : " с"}</strong></span>
                  <input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key]} onChange={(event) => setSoundParameter(key, Number(event.target.value))} />
                </label>
              ))}
            </div>
            <div className="sound-designer-actions">
              <button type="button" className="secondary-button" onClick={onPreviewSound}>Прослушать до первой</button>
              <button type="button" className="primary-button" onClick={() => setSoundOpen(false)}>Готово</button>
            </div>
          </div>
        )}
        {launch && <button className="primary-button launch-button" onClick={onClose}>Начать</button>}
      </section>
    </div>
  );
}
