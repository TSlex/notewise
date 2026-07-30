"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: () => Promise<MIDIAccess>;
};

export type MidiStatus =
  | "unsupported"
  | "connecting"
  | "connected"
  | "disconnected"
  | "denied";

export function useMidi(
  onNoteOn: (midiNote: number, velocity: number) => void,
  onNoteOff: (midiNote: number) => void,
) {
  const [status, setStatus] = useState<MidiStatus>("connecting");
  const [deviceName, setDeviceName] = useState("");
  const accessRef = useRef<MIDIAccess | null>(null);
  const activeNotesRef = useRef(new Set<number>());
  const noteOnRef = useRef(onNoteOn);
  const noteOffRef = useRef(onNoteOff);

  useEffect(() => {
    noteOnRef.current = onNoteOn;
    noteOffRef.current = onNoteOff;
  }, [onNoteOn, onNoteOff]);

  const bindInputs = useCallback((access: MIDIAccess) => {
    const connectedInputs = Array.from(access.inputs.values()).filter(
      (input) => input.state === "connected",
    );

    for (const input of connectedInputs) {
      input.onmidimessage = ({ data }) => {
        if (!data || data.length < 2) return;
        const command = data[0] & 0xf0;
        const midiNote = data[1];
        const velocity = data[2] ?? 0;
        const isNoteOn = command === 0x90 && velocity > 0;
        const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0);

        if (isNoteOn && !activeNotesRef.current.has(midiNote)) {
          activeNotesRef.current.add(midiNote);
          noteOnRef.current(midiNote, velocity);
        }

        if (isNoteOff) {
          activeNotesRef.current.delete(midiNote);
          noteOffRef.current(midiNote);
        }
      };
    }

    if (connectedInputs.length) {
      const input = connectedInputs[0];
      setDeviceName(
        input.name || input.manufacturer || "MIDI-клавиатура",
      );
      setStatus("connected");
    } else {
      setDeviceName("");
      setStatus("disconnected");
    }
  }, []);

  const connect = useCallback(async () => {
    const midiNavigator = navigator as NavigatorWithMidi;
    if (!midiNavigator.requestMIDIAccess) {
      setStatus("unsupported");
      return;
    }

    setStatus("connecting");
    try {
      const access = await midiNavigator.requestMIDIAccess();
      accessRef.current = access;
      bindInputs(access);
      access.onstatechange = () => bindInputs(access);
    } catch {
      setStatus("denied");
    }
  }, [bindInputs]);

  useEffect(() => {
    void connect();
    return () => {
      const access = accessRef.current;
      if (!access) return;
      access.onstatechange = null;
      for (const input of access.inputs.values()) {
        input.onmidimessage = null;
      }
    };
  }, [connect]);

  return { status, deviceName, connect };
}
