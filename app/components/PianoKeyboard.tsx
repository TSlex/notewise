"use client";

import { isNaturalNote } from "../trainers/noteReading";

type PianoKeyboardProps = {
  activeNotes: Set<number>;
  revealedNote?: number;
  disabled?: boolean;
  onNoteOn: (midiNote: number) => void;
  onNoteOff: (midiNote: number) => void;
};

const FROM_NOTE = 36;
const TO_NOTE = 84;

const NOTES = Array.from(
  { length: TO_NOTE - FROM_NOTE + 1 },
  (_, index) => FROM_NOTE + index,
);
const WHITE_NOTES = NOTES.filter(isNaturalNote);
const BLACK_NOTES = NOTES.filter((note) => !isNaturalNote(note));
const WHITE_KEY_WIDTH = 100 / WHITE_NOTES.length;
const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.62;

function noteLabel(midiNote: number) {
  const pitchNames = [
    "C",
    "C♯",
    "D",
    "D♯",
    "E",
    "F",
    "F♯",
    "G",
    "G♯",
    "A",
    "A♯",
    "B",
  ];
  return `${pitchNames[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`;
}

export function PianoKeyboard({
  activeNotes,
  revealedNote,
  disabled,
  onNoteOn,
  onNoteOff,
}: PianoKeyboardProps) {
  return (
    <div className="piano-shell">
      <div className="piano-keyboard" aria-label="Экранная клавиатура">
        <div className="white-keys">
          {WHITE_NOTES.map((note) => (
            <button
              className={[
                "piano-key white-key",
                activeNotes.has(note) ? "is-active" : "",
                revealedNote === note ? "is-revealed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              key={note}
              aria-label={noteLabel(note)}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                onNoteOn(note);
              }}
              onPointerUp={() => onNoteOff(note)}
              onPointerCancel={() => onNoteOff(note)}
            >
              {note % 12 === 0 && (
                <span className="octave-label">{noteLabel(note)}</span>
              )}
            </button>
          ))}
        </div>

        {BLACK_NOTES.map((note) => {
          const whiteBefore = WHITE_NOTES.filter(
            (whiteNote) => whiteNote < note,
          ).length;
          const left = whiteBefore * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;

          return (
            <button
              className={[
                "piano-key black-key",
                activeNotes.has(note) ? "is-active" : "",
                revealedNote === note ? "is-revealed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                left: `${left}%`,
                width: `${BLACK_KEY_WIDTH}%`,
              }}
              disabled={disabled}
              key={note}
              aria-label={noteLabel(note)}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                onNoteOn(note);
              }}
              onPointerUp={() => onNoteOff(note)}
              onPointerCancel={() => onNoteOff(note)}
            />
          );
        })}
      </div>
    </div>
  );
}
