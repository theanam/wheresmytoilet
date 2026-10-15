import { config } from '../config';
import type { SoundEvent } from './soundDirector';

export type Stinger = 'win' | 'lose' | 'nope';

const MUTE_KEY = 'wmt-muted';

/** Notes (Hz) for the soft "mall muzak" chords: Cmaj7, Am7, Fmaj7, G7. */
const CHORDS = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [196.0, 246.94, 293.66, 349.23],
];

/**
 * All game audio, synthesised with the Web Audio API: no sound files needed.
 * Browsers only allow audio after a user gesture, so call start() from a click.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambience: { stop(): void } | null = null;
  muted: boolean;

  constructor(
    private createContext: () => AudioContext = () => new AudioContext(),
    private storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
  ) {
    this.muted = this.storage?.getItem(MUTE_KEY) === '1';
  }

  /** Create or wake the audio context. Must run inside a click/keypress handler. */
  start(): void {
    try {
      if (!this.ctx) {
        this.ctx = this.createContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : config.audio.volume;
        this.master.connect(this.ctx.destination);
        this.noise = makeNoise(this.ctx);
      }
      void this.ctx.resume?.();
    } catch {
      this.ctx = null; // No Web Audio: the game still works, silently.
    }
  }

  get running(): boolean {
    return this.ctx !== null;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      this.storage?.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Storage blocked; the setting just won't be remembered.
    }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : config.audio.volume, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  pause(): void {
    void this.ctx?.suspend?.();
  }

  resume(): void {
    void this.ctx?.resume?.();
  }

  play(event: SoundEvent | Stinger): void {
    if (!this.ctx) return;
    switch (event) {
      case 'footstep': return this.footstep();
      case 'rumble': return this.rumble();
      case 'heartbeat': return this.heartbeat();
      case 'win': return this.win();
      case 'lose': return this.lose();
      case 'nope': return this.nope();
    }
  }

  startAmbience(): void {
    if (!this.ctx || this.ambience) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
    out.connect(this.master!);

    // Crowd murmur: looping noise, band-passed to voice range, slowly swelling.
    const murmur = ctx.createBufferSource();
    murmur.buffer = this.noise;
    murmur.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 450;
    band.Q.value = 0.7;
    const murmurGain = ctx.createGain();
    murmurGain.gain.value = 0.05;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.15;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.02;
    swell.connect(swellDepth).connect(murmurGain.gain);
    murmur.connect(band).connect(murmurGain).connect(out);
    murmur.start();
    swell.start();

    // Soft muzak: a gentle chord every 2.4 s.
    let chord = 0;
    const playChord = () => {
      if (ctx.state !== 'running') return;
      const t = ctx.currentTime;
      for (const f of CHORDS[chord % CHORDS.length]) this.tone(f, t, 2.6, 'triangle', 0.018, out, 0.6);
      this.tone(CHORDS[chord % CHORDS.length][0] / 2, t, 2.4, 'sine', 0.03, out, 0.05);
      chord++;
    };
    playChord();
    const timer = setInterval(playChord, 2400);

    this.ambience = {
      stop: () => {
        clearInterval(timer);
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        murmur.stop(ctx.currentTime + 1);
        swell.stop(ctx.currentTime + 1);
      },
    };
  }

  stopAmbience(): void {
    this.ambience?.stop();
    this.ambience = null;
  }

  // --- Synths -------------------------------------------------------------

  /** One enveloped oscillator note. */
  private tone(freq: number, at: number, length: number, type: OscillatorType, peak: number, dest: AudioNode = this.master!, attack = 0.01): OscillatorNode {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + length + 0.05);
    return osc;
  }

  /** A short burst of filtered noise. */
  private noiseBurst(at: number, length: number, filterType: BiquadFilterType, freq: number, peak: number): BiquadFilterNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(at, Math.random() * 0.5);
    src.stop(at + length + 0.05);
    return filter;
  }

  private footstep() {
    const t = this.ctx!.currentTime;
    this.noiseBurst(t, 0.08, 'lowpass', 700 + Math.random() * 300, 0.35);
    this.tone(90 + Math.random() * 20, t, 0.07, 'sine', 0.12);
  }

  private rumble() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.linearRampToValueAtTime(48, t + 1.3);
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 7;
    const depth = ctx.createGain();
    depth.gain.value = 14;
    wobble.connect(depth).connect(osc.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.25);
    g.gain.linearRampToValueAtTime(0.3, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    osc.connect(lp).connect(g).connect(this.master!);
    osc.start(t);
    wobble.start(t);
    osc.stop(t + 1.5);
    wobble.stop(t + 1.5);
  }

  private heartbeat() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const [offset, peak] of [[0, 0.7], [0.16, 0.5]]) {
      const osc = this.tone(70, t + offset, 0.18, 'sine', peak);
      osc.frequency.exponentialRampToValueAtTime(40, t + offset + 0.15);
    }
  }

  private win() {
    const t = this.ctx!.currentTime;
    // Flush: a noise swoosh sweeping down.
    const filter = this.noiseBurst(t, 1.6, 'bandpass', 2400, 0.6);
    filter.frequency.exponentialRampToValueAtTime(250, t + 1.5);
    // Happy arpeggio.
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + 0.25 + i * 0.12, 0.5, 'triangle', 0.2));
  }

  private lose() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // Sad trombone: wah, wah, wah, waaah.
    const notes: [number, number, number][] = [[392, 0, 0.45], [370, 0.5, 0.45], [349.2, 1.0, 0.45], [329.6, 1.5, 1.4]];
    for (const [f, at, len] of notes) {
      const osc = this.tone(f / 2, t + at, len, 'sawtooth', 0.25);
      if (len > 1) {
        const vib = ctx.createOscillator();
        vib.frequency.value = 5;
        const depth = ctx.createGain();
        depth.gain.value = 4;
        vib.connect(depth).connect(osc.frequency);
        vib.start(t + at + 0.2);
        vib.stop(t + at + len);
      }
    }
  }

  private nope() {
    const t = this.ctx!.currentTime;
    this.tone(180, t, 0.12, 'square', 0.08);
    this.tone(140, t + 0.1, 0.15, 'square', 0.08);
  }
}

function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
