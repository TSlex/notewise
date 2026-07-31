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

export type MidiDevice = { id: string; name: string };

export function useMidi(
  onNoteOn: (midiNote: number, velocity: number) => void,
  onNoteOff: (midiNote: number) => void,
  selectedInputId = "",
) {
  const [status, setStatus] = useState<MidiStatus>("connecting");
  const [deviceName, setDeviceName] = useState("");
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const accessRef = useRef<MIDIAccess | null>(null);
  const activeNotesRef = useRef(new Set<number>());
  const noteOnRef = useRef(onNoteOn);
  const noteOffRef = useRef(onNoteOff);
  const selectedInputRef = useRef(selectedInputId);
  const bindInputsRef = useRef<(access: MIDIAccess) => void>(() => undefined);

  useEffect(() => {
    noteOnRef.current = onNoteOn;
    noteOffRef.current = onNoteOff;
  }, [onNoteOn, onNoteOff]);

  useEffect(() => {
    selectedInputRef.current = selectedInputId;
    if (accessRef.current) bindInputsRef.current(accessRef.current);
  }, [selectedInputId]);

  const bindInputs = useCallback((access: MIDIAccess) => {
    const connectedInputs = Array.from(access.inputs.values()).filter(
      (input) => input.state === "connected",
    );

    const selected = connectedInputs.find((input) => input.id === selectedInputRef.current);
    const activeInputs = selected ? [selected] : connectedInputs.slice(0, 1);

    for (const input of connectedInputs) input.onmidimessage = null;
    activeNotesRef.current.clear();
    setDevices(connectedInputs.map((input) => ({
      id: input.id,
      name: input.name || input.manufacturer || "MIDI-клавиатура",
    })));

    for (const input of activeInputs) {
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

    if (activeInputs.length) {
      const input = activeInputs[0];
      setDeviceName(
        input.name || input.manufacturer || "MIDI-клавиатура",
      );
      setStatus("connected");
    } else {
      setDeviceName("");
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    bindInputsRef.current = bindInputs;
  }, [bindInputs]);

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
    const frame = window.requestAnimationFrame(() => void connect());
    return () => {
      window.cancelAnimationFrame(frame);
      const access = accessRef.current;
      if (!access) return;
      access.onstatechange = null;
      for (const input of access.inputs.values()) {
        input.onmidimessage = null;
      }
    };
  }, [connect]);

  return { status, deviceName, devices, connect };
}
