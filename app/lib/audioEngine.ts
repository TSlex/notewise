type ActiveVoice = {
  oscillator: OscillatorNode;
  gain: GainNode;
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private voices = new Map<number, ActiveVoice>();
  private volume = 0.65;

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  async activate() {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async noteOn(midiNote: number) {
    await this.activate();
    if (!this.context || this.voices.has(midiNote)) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = 440 * 2 ** ((midiNote - 69) / 12);
    gain.gain.setValueAtTime(0.0001, now);
    const peak = Math.max(0.0001, 0.28 * this.volume);
    const sustain = Math.max(0.0001, 0.16 * this.volume);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(sustain, now + 0.11);

    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    this.voices.set(midiNote, { oscillator, gain });
  }

  noteOff(midiNote: number) {
    const voice = this.voices.get(midiNote);
    if (!voice || !this.context) return;

    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(
      Math.max(voice.gain.gain.value, 0.0001),
      now,
    );
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    voice.oscillator.stop(now + 0.14);
    this.voices.delete(midiNote);
  }

  stopAll() {
    for (const midiNote of this.voices.keys()) {
      this.noteOff(midiNote);
    }
  }
}
