import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config';
import { GameAudio } from '../src/systems/audio';

/** Minimal stand-in for the Web Audio API that records what gets created. */
class FakeParam {
  value = 0;
  setValueAtTime(v: number) { this.value = v; return this; }
  linearRampToValueAtTime(v: number) { this.value = v; return this; }
  exponentialRampToValueAtTime(v: number) { this.value = v; return this; }
  setTargetAtTime(v: number) { this.value = v; return this; }
}
class FakeNode {
  connected: unknown[] = [];
  started = 0;
  stopped = 0;
  constructor(public kind: string) {}
  connect<T>(n: T): T { this.connected.push(n); return n; }
  start() { this.started++; }
  stop() { this.stopped++; }
}
class FakeContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode('destination');
  nodes: FakeNode[] = [];
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  private make(kind: string, params: string[], extra: object = {}) {
    const n = Object.assign(new FakeNode(kind), extra) as FakeNode & Record<string, unknown>;
    for (const p of params) n[p] = new FakeParam();
    this.nodes.push(n);
    return n;
  }
  createGain() { return this.make('gain', ['gain']); }
  createOscillator() { return this.make('osc', ['frequency'], { type: 'sine' }); }
  createBiquadFilter() { return this.make('filter', ['frequency', 'Q'], { type: 'lowpass' }); }
  createBufferSource() { return this.make('source', ['playbackRate'], { buffer: null, loop: false }); }
  createBuffer(_c: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  count(kind: string) { return this.nodes.filter((n) => n.kind === kind).length; }
}

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, store };
}

function setup(storage = memoryStorage()) {
  const ctx = new FakeContext();
  const audio = new GameAudio(() => ctx as unknown as AudioContext, storage);
  return { ctx, audio, storage };
}

afterEach(() => vi.useRealTimers());

describe('game audio', () => {
  it('stays silent and safe before start()', () => {
    const { ctx, audio } = setup();
    audio.play('footstep');
    audio.startAmbience();
    audio.pause();
    expect(audio.running).toBe(false);
    expect(ctx.nodes).toHaveLength(0);
  });

  it('creates one context and a master volume on start()', () => {
    const create = vi.fn(() => new FakeContext() as unknown as AudioContext);
    const audio = new GameAudio(create, memoryStorage());
    audio.start();
    audio.start();
    expect(create).toHaveBeenCalledOnce();
    expect(audio.running).toBe(true);
  });

  it('keeps working silently if Web Audio is unavailable', () => {
    const audio = new GameAudio(() => { throw new Error('no audio'); }, memoryStorage());
    audio.start();
    expect(audio.running).toBe(false);
    expect(() => audio.play('win')).not.toThrow();
  });

  it.each(['footstep', 'rumble', 'heartbeat', 'win', 'lose', 'nope'] as const)('synthesises "%s" and schedules it to stop', (event) => {
    const { ctx, audio } = setup();
    audio.start();
    const before = ctx.nodes.length;
    audio.play(event);
    const made = ctx.nodes.slice(before);
    const sources = made.filter((n) => n.kind === 'osc' || n.kind === 'source');
    expect(sources.length).toBeGreaterThan(0);
    for (const s of sources) {
      expect(s.started).toBe(1);
      expect(s.stopped).toBe(1);
    }
  });

  it('mutes and unmutes the master volume and remembers the choice', () => {
    const { ctx, audio, storage } = setup();
    audio.start();
    const master = ctx.nodes[0] as unknown as { gain: FakeParam };
    expect(master.gain.value).toBe(config.audio.volume);
    expect(audio.toggleMute()).toBe(true);
    expect(master.gain.value).toBe(0);
    expect(storage.store['wmt-muted']).toBe('1');
    audio.toggleMute();
    expect(master.gain.value).toBe(config.audio.volume);
  });

  it('starts muted if it was muted last time', () => {
    const { ctx, audio } = setup(memoryStorage({ 'wmt-muted': '1' }));
    expect(audio.muted).toBe(true);
    audio.start();
    expect((ctx.nodes[0] as unknown as { gain: FakeParam }).gain.value).toBe(0);
  });

  it('suspends and resumes the context for pause', () => {
    const { ctx, audio } = setup();
    audio.start();
    audio.pause();
    expect(ctx.suspend).toHaveBeenCalled();
    audio.resume();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('plays ambience chords on a timer only once, and stops cleanly', () => {
    vi.useFakeTimers();
    const { ctx, audio } = setup();
    audio.start();
    audio.startAmbience();
    audio.startAmbience(); // ignored: already playing
    const loops = ctx.nodes.filter((n) => n.kind === 'source');
    expect(loops).toHaveLength(1);
    const oscAfterStart = ctx.count('osc');
    vi.advanceTimersByTime(2400);
    expect(ctx.count('osc')).toBeGreaterThan(oscAfterStart);

    ctx.state = 'suspended'; // paused: no new chords pile up
    const oscPaused = ctx.count('osc');
    vi.advanceTimersByTime(4800);
    expect(ctx.count('osc')).toBe(oscPaused);

    audio.stopAmbience();
    expect(loops[0].stopped).toBe(1);
    ctx.state = 'running';
    const oscStopped = ctx.count('osc');
    vi.advanceTimersByTime(4800);
    expect(ctx.count('osc')).toBe(oscStopped);
  });
});
