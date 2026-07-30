import type {
  Clef,
  NoteQuestion,
  RangePreset,
  TrainerModule,
  TrainerSettings,
} from "./types";

const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
const NOTE_NAMES = ["до", "ре", "ми", "фа", "соль", "ля", "си"];

const RANGES: Record<Clef, Record<RangePreset, [number, number]>> = {
  treble: {
    octave: [60, 72],
    "octave-half": [57, 76],
    "two-octaves": [60, 84],
  },
  bass: {
    octave: [48, 60],
    "octave-half": [45, 64],
    "two-octaves": [36, 60],
  },
};

export function isNaturalNote(midiNote: number) {
  return NATURAL_PITCH_CLASSES.includes(midiNote % 12);
}

export function getNoteParts(midiNote: number) {
  const pitchClass = midiNote % 12;
  const nameIndex = NATURAL_PITCH_CLASSES.indexOf(pitchClass);
  return {
    nameIndex,
    noteName: NOTE_NAMES[nameIndex],
    octave: Math.floor(midiNote / 12) - 1,
  };
}

export function getDiatonicIndex(midiNote: number) {
  const { nameIndex, octave } = getNoteParts(midiNote);
  return octave * 7 + nameIndex;
}

export function formatNoteName(midiNote: number) {
  const { noteName, octave } = getNoteParts(midiNote);
  return `${noteName} · ${octave}-я октава`;
}

function notesForRange(clef: Clef, range: RangePreset) {
  const [from, to] = RANGES[clef][range];
  const notes: number[] = [];

  for (let note = from; note <= to; note += 1) {
    if (isNaturalNote(note)) notes.push(note);
  }

  return notes;
}

function chooseClef(settings: TrainerSettings): Clef {
  if (settings.clefMode !== "mixed") return settings.clefMode;
  return Math.random() > 0.5 ? "treble" : "bass";
}

export const noteReadingTrainer: TrainerModule<NoteQuestion> = {
  id: "note-reading",
  title: "Чтение нот",

  createQuestion(settings, previousQuestion) {
    const clef = chooseClef(settings);
    const availableNotes = notesForRange(clef, settings.range);
    const alternatives = availableNotes.filter(
      (note) =>
        note !== previousQuestion?.midiNote ||
        clef !== previousQuestion?.clef,
    );
    const pool = alternatives.length ? alternatives : availableNotes;
    const midiNote = pool[Math.floor(Math.random() * pool.length)];
    const { noteName, octave } = getNoteParts(midiNote);

    return {
      id: `${clef}-${midiNote}-${Date.now()}-${Math.random()}`,
      kind: "single-note",
      clef,
      midiNote,
      noteName,
      octave,
    };
  },

  isCorrect(question, playedNotes) {
    return playedNotes.length === 1 && playedNotes[0] === question.midiNote;
  },
};
