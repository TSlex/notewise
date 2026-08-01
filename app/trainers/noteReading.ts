import type {
  Clef,
  KeySignature,
  NoteQuestion,
  RangePreset,
  TrainerModule,
  TrainerSettings,
} from "./types";

export const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
export const NOTE_NAMES = ["до", "ре", "ми", "фа", "соль", "ля", "си"];

export const KEY_SIGNATURES: Record<KeySignature, { label: string; fifths: number }> = {
  C: { label: "До мажор", fifths: 0 }, G: { label: "Соль мажор", fifths: 1 },
  D: { label: "Ре мажор", fifths: 2 }, A: { label: "Ля мажор", fifths: 3 },
  E: { label: "Ми мажор", fifths: 4 }, B: { label: "Си мажор", fifths: 5 },
  "F#": { label: "Фа♯ мажор", fifths: 6 }, Db: { label: "Ре♭ мажор", fifths: -5 },
  Ab: { label: "Ля♭ мажор", fifths: -4 }, Eb: { label: "Ми♭ мажор", fifths: -3 },
  Bb: { label: "Си♭ мажор", fifths: -2 }, F: { label: "Фа мажор", fifths: -1 },
  Am: { label: "Ля минор", fifths: 0 }, Em: { label: "Ми минор", fifths: 1 },
  Bm: { label: "Си минор", fifths: 2 }, "F#m": { label: "Фа♯ минор", fifths: 3 },
  "C#m": { label: "До♯ минор", fifths: 4 }, "G#m": { label: "Соль♯ минор", fifths: 5 },
  "D#m": { label: "Ре♯ минор", fifths: 6 }, Bbm: { label: "Си♭ минор", fifths: -5 },
  Fm: { label: "Фа минор", fifths: -4 }, Cm: { label: "До минор", fifths: -3 },
  Gm: { label: "Соль минор", fifths: -2 }, Dm: { label: "Ре минор", fifths: -1 },
};

const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // фа, до, соль, ре, ля, ми, си
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3]; // си, ми, ля, ре, соль, до, фа

export function keyAccidentals(keySignature: KeySignature) {
  const result: (-1 | 0 | 1)[] = [0, 0, 0, 0, 0, 0, 0];
  const fifths = KEY_SIGNATURES[keySignature].fifths;
  const order = fifths >= 0 ? SHARP_ORDER : FLAT_ORDER;
  const accidental = fifths >= 0 ? 1 : -1;
  for (let index = 0; index < Math.abs(fifths); index += 1) {
    result[order[index]] = accidental;
  }
  return result;
}

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

export function getDiatonicIndex(question: Pick<NoteQuestion, "letterIndex" | "octave">) {
  return question.octave * 7 + question.letterIndex;
}

export function formatNoteName(question: Pick<NoteQuestion, "noteName" | "octave" | "accidental">) {
  const accidental = question.accidental === 1 ? "♯" : question.accidental === -1 ? "♭" : "";
  return `${question.noteName}${accidental} · ${question.octave}-я октава`;
}

function notesForRange(clef: Clef, range: RangePreset, settings: TrainerSettings) {
  const [from, to] = RANGES[clef][range];
  const notes: Array<Omit<NoteQuestion, "id" | "kind" | "clef">> = [];
  const signature = keyAccidentals(settings.keySignature);
  for (let octave = Math.floor(from / 12) - 1; octave <= Math.floor(to / 12); octave += 1) {
    for (let letterIndex = 0; letterIndex < 7; letterIndex += 1) {
      const naturalMidi = (octave + 1) * 12 + NATURAL_PITCH_CLASSES[letterIndex];
      const baseAccidental = signature[letterIndex];
      const candidates: (-1 | 0 | 1)[] = settings.accidentalsEnabled
        ? [-1, 0, 1]
        : [baseAccidental];
      for (const accidental of candidates) {
        const midiNote = naturalMidi + accidental;
        if (midiNote < from || midiNote > to) continue;
        const displayAccidental = accidental === baseAccidental
          ? undefined
          : accidental === 0 ? "♮" : accidental === 1 ? "♯" : "♭";
        notes.push({
          midiNote,
          noteName: NOTE_NAMES[letterIndex],
          octave,
          letterIndex,
          accidental,
          displayAccidental,
          keySignature: settings.keySignature,
        });
      }
    }
  }
  return notes;
}

function chooseClef(settings: TrainerSettings): Clef {
  if (settings.clefMode !== "mixed") return settings.clefMode;
  return Math.random() > 0.5 ? "treble" : "bass";
}

export function createQuestionForMidi(midiNote: number, settings: TrainerSettings): NoteQuestion {
  const clef = settings.clefMode === "mixed"
    ? (midiNote >= 60 ? "treble" : "bass")
    : settings.clefMode;
  const signature = keyAccidentals(settings.keySignature);
  const candidates: Array<{ letterIndex: number; octave: number; accidental: -1 | 0 | 1 }> = [];

  for (let octave = Math.floor(midiNote / 12) - 2; octave <= Math.floor(midiNote / 12); octave += 1) {
    NATURAL_PITCH_CLASSES.forEach((pitchClass, letterIndex) => {
      const naturalMidi = (octave + 1) * 12 + pitchClass;
      const accidental = midiNote - naturalMidi;
      if (accidental >= -1 && accidental <= 1) {
        candidates.push({ letterIndex, octave, accidental: accidental as -1 | 0 | 1 });
      }
    });
  }

  const selected = candidates.find((candidate) => signature[candidate.letterIndex] === candidate.accidental)
    ?? candidates.find((candidate) => candidate.accidental === 0)
    ?? candidates[0];
  const baseAccidental = signature[selected.letterIndex];

  return {
    id: `played-${midiNote}-${Date.now()}-${Math.random()}`,
    kind: "single-note",
    clef,
    midiNote,
    noteName: NOTE_NAMES[selected.letterIndex],
    octave: selected.octave,
    letterIndex: selected.letterIndex,
    accidental: selected.accidental,
    displayAccidental: selected.accidental === baseAccidental
      ? undefined
      : selected.accidental === 0 ? "♮" : selected.accidental === 1 ? "♯" : "♭",
    keySignature: settings.keySignature,
  };
}

export const noteReadingTrainer: TrainerModule<NoteQuestion> = {
  id: "note-reading",
  title: "Чтение нот",

  createQuestion(settings, previousQuestion) {
    const clef = chooseClef(settings);
    const availableNotes = notesForRange(clef, settings.range, settings);
    const alternatives = availableNotes.filter(
      (note) =>
        note.midiNote !== previousQuestion?.midiNote ||
        note.letterIndex !== previousQuestion?.letterIndex ||
        clef !== previousQuestion?.clef,
    );
    const pool = alternatives.length ? alternatives : availableNotes;
    const selected = pool[Math.floor(Math.random() * pool.length)];

    return {
      id: `${clef}-${selected.midiNote}-${Date.now()}-${Math.random()}`,
      kind: "single-note",
      clef,
      ...selected,
    };
  },

  isCorrect(question, playedNotes) {
    return playedNotes.length === 1 && playedNotes[0] === question.midiNote;
  },
};
