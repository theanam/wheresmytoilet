import { Engine } from '@babylonjs/core/Engines/engine';
import { config } from './config';
import { endScreen, pauseScreen, titleScreen } from './scenes/screens';
import { GameRound } from './scenes/game';
import { GameAudio } from './systems/audio';
import { InputState } from './systems/input';
import { randomSeed } from './systems/rng';
import { Hud } from './ui/hud';
import { prefersTouch, TouchControls } from './ui/touchControls';
import './style.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: false });
const input = new InputState();
input.attach(window);
const audio = new GameAudio();

let round: GameRound | null = null;
let hud: Hud | null = null;
let overlay: HTMLElement | null = null;
let touch: TouchControls | null = null;
/** Phone/tablet mode: on-screen controls instead of keyboard + pointer lock. */
let touchMode = prefersTouch();

function showOverlay(el: HTMLElement | null) {
  overlay?.remove();
  overlay = el;
  if (el) ui.append(el);
}

function lockPointer() {
  if (touchMode) return;
  try {
    // Returns a promise in Chrome/Firefox, undefined in Safari; either may reject/fail.
    const result = canvas.requestPointerLock() as unknown;
    if (result instanceof Promise) result.catch(() => undefined);
  } catch {
    // Pointer lock unavailable; mouse look still works by click-dragging.
  }
}

function releasePointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}

function endRound() {
  audio.stopAmbience();
  touch?.remove();
  touch = null;
  round?.dispose();
  round = null;
  hud?.remove();
  hud = null;
}

function startRound() {
  endRound();
  input.clear();
  hud = new Hud(ui, config.camera.mode === 'first', touchMode, toggleSound);
  hud.setMuted(audio.muted);
  // Starting a round always comes from a click, so the browser lets audio start here.
  audio.start();
  audio.resume();
  audio.startAmbience();
  round = new GameRound(engine, config.seed ?? randomSeed(), input, {
    onEnd: (result) => {
      releasePointer();
      audio.stopAmbience();
      audio.play(result.outcome === 'won' ? 'win' : 'lose');
      showOverlay(endScreen(result, { onTryAgain: startRound, onQuit: showTitle }));
    },
    onFrame: (r) => {
      hud?.update(r.session, r.nearToilet);
      touch?.setNearToilet(r.nearToilet);
    },
    onSound: (e) => audio.play(e),
  });
  round.player.fitAspect(engine.getAspectRatio(round.player.camera));
  if (touchMode) {
    const r = round;
    touch = new TouchControls(ui, input, { onLook: (dx, dy) => r.player.look(dx, dy), onPause: pause });
    goFullscreen();
  } else {
    round.player.camera.attachControl(canvas, true);
  }
  showOverlay(null);
  lockPointer();
}

function pause() {
  if (round?.session.status !== 'playing') return;
  round.session.pause();
  input.clear();
  touch?.reset();
  // The menu needs a visible mouse pointer, however we got here (Esc, blur, lost lock).
  releasePointer();
  audio.pause();
  showOverlay(
    pauseScreen({
      onResume: () => {
        showOverlay(null);
        round?.session.resume();
        audio.resume();
        lockPointer();
      },
      onRestart: startRound,
      onQuit: showTitle,
    }),
  );
}

function showTitle() {
  endRound();
  releasePointer();
  showOverlay(titleScreen(startRound, touchMode));
}

function toggleSound() {
  hud?.setMuted(audio.toggleMute());
}

/** On phones, use the whole screen where the browser allows it (not iPhone Safari). */
function goFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
  } catch {
    // Not supported; the game still fits the visible area.
  }
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) pause();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') pause();
  if (e.code === 'KeyM' && !e.repeat) toggleSound();
});
canvas.addEventListener('click', () => {
  if (round?.session.status === 'playing' && document.pointerLockElement !== canvas) lockPointer();
});
window.addEventListener('blur', pause);
window.addEventListener('resize', () => {
  engine.resize();
  round?.player.fitAspect(engine.getAspectRatio(round.player.camera));
});
// A touchscreen laptop or a phone the media query missed: switch to touch controls on first touch.
window.addEventListener(
  'touchstart',
  () => {
    if (touchMode) return;
    touchMode = true;
    if (!round) showTitle();
  },
  { passive: true },
);

engine.runRenderLoop(() => {
  if (round) round.scene.render();
});

showTitle();

// Handy for debugging in the browser console.
(window as unknown as { game: unknown }).game = { get round() { return round; }, input, audio };
