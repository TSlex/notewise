"use client";

import { useEffect } from "react";
import type { MidiDevice } from "../hooks/useMidi";
import { KEY_SIGNATURES } from "../trainers/noteReading";
import type {
  ClefMode,
  KeySignature,
  PracticeMode,
  RangePreset,
  SessionLength,
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
  onClose: () => void;
};

const KEY_OPTIONS = Object.entries(KEY_SIGNATURES) as Array<
  [KeySignature, { label: string; fifths: number }]
>;

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
  onClose,
}: SettingsMenuProps) {
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
                <option value="mixed">Вперемешку</option>
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
            {showTrainingSettings && settings.practiceMode === "flow" && (
              <div className="setting-row">
                <span>Метроном</span>
                <Toggle checked={settings.metronomeEnabled} label={settings.metronomeEnabled ? "Слышен" : "Без звука"} onChange={() => set("metronomeEnabled", !settings.metronomeEnabled)} />
              </div>
            )}
            <div className="setting-row">
              <span>Светлая тема</span>
              <Toggle checked={settings.theme === "light"} label={settings.theme === "light" ? "Включена" : "Выключена"} onChange={() => set("theme", settings.theme === "light" ? "dark" : "light")} />
            </div>
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
        {launch && <button className="primary-button launch-button" onClick={onClose}>Начать</button>}
      </section>
    </div>
  );
}
