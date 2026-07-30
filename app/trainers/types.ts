export type Clef = "treble" | "bass";
export type ClefMode = Clef | "mixed";
export type RangePreset = "octave" | "octave-half" | "two-octaves";
export type SessionLength = 10 | 20 | "endless";
export type PracticeMode = "study" | "flow";
export type ThemeMode = "dark" | "light";

export type TrainerSettings = {
  practiceMode: PracticeMode;
  clefMode: ClefMode;
  range: RangePreset;
  sessionLength: SessionLength;
  soundEnabled: boolean;
  volume: number;
  theme: ThemeMode;
};

export type NoteQuestion = {
  id: string;
  kind: "single-note";
  clef: Clef;
  midiNote: number;
  noteName: string;
  octave: number;
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
