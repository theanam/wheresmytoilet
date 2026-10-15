import { config } from '../config';
import { formatTime } from '../systems/scoring';
import type { GameSession } from '../systems/session';
import { urgencyColor } from '../systems/urgency';
import { h } from './dom';

/** In-game heads-up display: urgency bar, clench stamina, timer and message line. */
export class Hud {
  readonly root: HTMLElement;
  private urgencyFill: HTMLElement;
  private urgencyText: HTMLElement;
  private staminaFill: HTMLElement;
  private timer: HTMLElement;
  private message: HTMLElement;
  private prompt: HTMLElement;
  private vignette: HTMLElement;
  private sound: HTMLElement;

  constructor(parent: HTMLElement, showCrosshair = config.camera.mode === 'first') {
    this.urgencyFill = h('div', { class: 'bar-fill', 'data-testid': 'urgency-fill' });
    this.urgencyText = h('span', { class: 'bar-label' }, 'Urgency');
    this.staminaFill = h('div', { class: 'bar-fill stamina', 'data-testid': 'stamina-fill' });
    this.timer = h('div', { class: 'timer', 'data-testid': 'timer' }, '0:00');
    this.message = h('div', { class: 'message', 'data-testid': 'message' });
    this.prompt = h('div', { class: 'prompt' }, 'Press E to use the toilet');
    this.vignette = h('div', { class: 'vignette' });
    this.sound = h('div', { class: 'sound', 'data-testid': 'sound' });
    this.root = h(
      'div',
      { class: 'hud' },
      this.vignette,
      h(
        'div',
        { class: 'bars' },
        h('div', { class: 'bar urgency' }, this.urgencyFill, this.urgencyText),
        h('div', { class: 'bar small' }, this.staminaFill, h('span', { class: 'bar-label' }, 'Clench')),
      ),
      this.timer,
      this.sound,
      showCrosshair ? h('div', { class: 'crosshair' }) : '',
      this.prompt,
      this.message,
    );
    parent.append(this.root);
  }

  update(session: GameSession, nearToilet: boolean): void {
    const u = session.meter.urgency;
    this.urgencyFill.style.width = `${u}%`;
    this.urgencyFill.style.background = urgencyColor(u);
    this.urgencyText.textContent = `Urgency ${Math.floor(u)}%`;
    this.staminaFill.style.width = `${(session.meter.stamina / config.clench.max) * 100}%`;
    this.timer.textContent = formatTime(session.elapsed);
    this.message.textContent = session.message;
    this.prompt.style.display = nearToilet ? 'block' : 'none';
    this.vignette.classList.toggle('pulse', u >= config.urgency.heartbeatAt);
  }

  setMuted(muted: boolean): void {
    this.sound.textContent = muted ? '🔇 M: sound off' : '🔊 M: sound on';
  }

  remove(): void {
    this.root.remove();
  }
}
