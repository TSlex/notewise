type ActiveVoice = {
  oscillator: OscillatorNode;
  gain: GainNode;
};

export type SoundSettings = {
  waveform: OscillatorType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  audioLatency: AudioContextLatencyCategory;
};

export class AudioEngine {
  private context: AudioContext | null = null;
  private voices = new Map<number, ActiveVoice>();
  private volume = 0.65;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private pendingNotes = new Set<number>();
  private generation = 0;
  private sound: SoundSettings = {
    waveform: "triangle",
    attack: 0.018,
    decay: 0.092,
    sustain: 0.57,
    release: 0.12,
    audioLatency: "balanced",
  };

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.context && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.012);
    }
  }

  setSound(settings: SoundSettings) {
    const latencyChanged = this.sound.audioLatency !== settings.audioLatency;
    this.sound = {
      waveform: settings.waveform,
      attack: Math.max(0.005, Math.min(2, settings.attack)),
      decay: Math.max(0.01, Math.min(2, settings.decay)),
      sustain: Math.max(0, Math.min(1, settings.sustain)),
      release: Math.max(0.02, Math.min(3, settings.release)),
      audioLatency: settings.audioLatency,
    };
    if (latencyChanged && this.context) this.recreateContext();
  }

  private recreateContext() {
    this.stopAll();
    const context = this.context;
    this.context = null;
    this.masterGain = null;
    this.compressor = null;
    if (context && context.state !== "closed") void context.close();
  }

  private createOutputGraph(context: AudioContext) {
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    const masterGain = context.createGain();
    masterGain.gain.value = this.volume;
    compressor.connect(masterGain);
    masterGain.connect(context.destination);
    this.compressor = compressor;
    this.masterGain = masterGain;
  }

  async activate() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: this.sound.audioLatency });
      this.createOutputGraph(this.context);
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async noteOn(midiNote: number) {
    this.pendingNotes.add(midiNote);
    const generation = this.generation;
    await this.activate();
    if (!this.context || this.voices.has(midiNote) || !this.pendingNotes.has(midiNote) || generation !== this.generation) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = this.sound.waveform;
    oscillator.frequency.value = 440 * 2 ** ((midiNote - 69) / 12);
    gain.gain.setValueAtTime(0.0001, now);
    const peak = 0.2;
    const sustain = Math.max(0.0001, peak * this.sound.sustain);
    gain.gain.exponentialRampToValueAtTime(peak, now + this.sound.attack);
    gain.gain.exponentialRampToValueAtTime(sustain, now + this.sound.attack + this.sound.decay);

    oscillator.connect(gain);
    gain.connect(this.compressor ?? this.context.destination);
    oscillator.start(now);
    this.voices.set(midiNote, { oscillator, gain });
  }

  noteOff(midiNote: number) {
    this.pendingNotes.delete(midiNote);
    const voice = this.voices.get(midiNote);
    if (!voice || !this.context) return;

    const now = this.context.currentTime;
    if (typeof voice.gain.gain.cancelAndHoldAtTime === "function") {
      voice.gain.gain.cancelAndHoldAtTime(now);
    } else {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
    }
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + this.sound.release);
    voice.oscillator.stop(now + this.sound.release + 0.02);
    this.voices.delete(midiNote);
  }

  async preview(midiNote: number, duration = 0.42) {
    await this.noteOn(midiNote);
    window.setTimeout(() => this.noteOff(midiNote), duration * 1000);
  }

  stopAll() {
    this.generation += 1;
    this.pendingNotes.clear();
    for (const midiNote of [...this.voices.keys()]) {
      this.noteOff(midiNote);
    }
  }

  async metronomeTick() {
    await this.activate();
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(92, now);
    oscillator.frequency.exponentialRampToValueAtTime(52, now + 0.08);
    const peak = 0.045;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    oscillator.connect(gain);
    gain.connect(this.compressor ?? this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.14);
  }
}
