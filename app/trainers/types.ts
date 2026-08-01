export type Clef = "treble" | "bass";
export type ClefMode = Clef | "mixed";
export type RangePreset = "octave" | "octave-half" | "two-octaves";
export type SessionLength = 10 | 20 | "endless";
export type PracticeMode = "study" | "flow" | "placement";
export type ToolMode = "training" | "free";
export type ThemeMode = "dark" | "light" | "lilac" | "sky" | "orange";
export type NoteDuration = "whole" | "half" | "quarter" | "eighth" | "sixteenth";
export type OscillatorWaveform = "sine" | "triangle" | "square" | "sawtooth";
export type SynthPreset = "clean" | "soft-keys" | "organ" | "synth-lead" | "custom";
export type KeySignature =
  | "C" | "G" | "D" | "A" | "E" | "B" | "F#" | "Db" | "Ab" | "Eb" | "Bb" | "F"
  | "Am" | "Em" | "Bm" | "F#m" | "C#m" | "G#m" | "D#m" | "Bbm" | "Fm" | "Cm" | "Gm" | "Dm";

export type TrainerSettings = {
  practiceMode: PracticeMode;
  clefMode: ClefMode;
  range: RangePreset;
  sessionLength: SessionLength;
  soundEnabled: boolean;
  volume: number;
  metronomeEnabled: boolean;
  flowBpm: number;
  adaptiveFlowBpm: boolean;
  keySignature: KeySignature;
  accidentalsEnabled: boolean;
  midiInputId: string;
  theme: ThemeMode;
  noteDuration: NoteDuration;
  synthPreset: SynthPreset;
  waveform: OscillatorWaveform;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
};

export type NoteQuestion = {
  id: string;
  kind: "single-note";
  clef: Clef;
  midiNote: number;
  noteName: string;
  octave: number;
  letterIndex: number;
  accidental: -1 | 0 | 1;
  displayAccidental?: "♭" | "♮" | "♯";
  keySignature: KeySignature;
};

export type TrainerModule<TQuestion> = {
  id: string;
  title: string;
  createQuestion: (
    settings: TrainerSettings,
    previousQuestion?: TQuestion,
  ) => TQuestion;
  isCorrect: (question: TQuestion, playedNotes: number[]) => boolean;
};
