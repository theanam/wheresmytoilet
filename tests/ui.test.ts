// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { endScreen, pauseScreen, titleScreen } from '../src/scenes/screens';
import { GameSession } from '../src/systems/session';
import { Hud } from '../src/ui/hud';
import { LINKS } from '../src/ui/links';

function click(root: HTMLElement, label: string) {
  const btn = [...root.querySelectorAll('button')].find((b) => b.textContent === label);
  if (!btn) throw new Error(`No button "${label}"`);
  btn.click();
}

describe('title screen', () => {
  it('shows the name, a Play button, controls and help/about/issue links', () => {
    const onPlay = vi.fn();
    const el = titleScreen(onPlay);
    expect(el.textContent).toContain("Where's My Toilet?");
    expect(el.querySelectorAll('.controls tr').length).toBeGreaterThanOrEqual(7);
    expect(el.textContent).toContain('Sound on / off');
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining([LINKS.help, LINKS.about, LINKS.issues]));
    click(el, 'Play');
    expect(onPlay).toHaveBeenCalledOnce();
  });
});

describe('pause screen', () => {
  it('has Resume, Restart and Quit to title, and opens links in a new tab', () => {
    const actions = { onResume: vi.fn(), onRestart: vi.fn(), onQuit: vi.fn() };
    const el = pauseScreen(actions);
    click(el, 'Resume');
    click(el, 'Restart');
    click(el, 'Quit to title');
    expect(actions.onResume).toHaveBeenCalledOnce();
    expect(actions.onRestart).toHaveBeenCalledOnce();
    expect(actions.onQuit).toHaveBeenCalledOnce();
    el.querySelectorAll('a').forEach((a) => expect(a.getAttribute('target')).toBe('_blank'));
  });
});

describe('end screen', () => {
  it('shows a win with time and stars', () => {
    const el = endScreen({ outcome: 'won', seconds: 75, stars: 2 }, { onTryAgain: vi.fn(), onQuit: vi.fn() });
    expect(el.classList.contains('won')).toBe(true);
    expect(el.querySelector('[data-testid=end-time]')?.textContent).toBe('Time: 1:15');
    expect(el.querySelector('[data-testid=stars]')?.textContent).toBe('★★☆');
  });

  it('shows a comedic "Oh no." loss with Try Again', () => {
    const onTryAgain = vi.fn();
    const el = endScreen({ outcome: 'lost', seconds: 160, stars: 0 }, { onTryAgain, onQuit: vi.fn() });
    expect(el.classList.contains('lost')).toBe(true);
    expect(el.querySelector('h2')?.textContent).toBe('Oh no.');
    expect(el.querySelector('[data-testid=stars]')).toBeNull();
    click(el, 'Try Again');
    expect(onTryAgain).toHaveBeenCalledOnce();
  });
});

describe('HUD', () => {
  it('shows urgency, stamina, timer, messages and the toilet prompt', () => {
    const parent = document.createElement('div');
    const hud = new Hud(parent);
    const s = new GameSession();
    s.update(65, { sprinting: false, clenching: false, inFoodCourt: false });
    s.showMessage('Hello');
    hud.update(s, true);
    const fill = parent.querySelector<HTMLElement>('[data-testid=urgency-fill]')!;
    expect(fill.style.width).toBe('52.5%');
    expect(parent.textContent).toContain('Urgency 52%');
    expect(parent.querySelector('[data-testid=timer]')?.textContent).toBe('1:05');
    expect(parent.querySelector('[data-testid=message]')?.textContent).toBe('Hello');
    expect(parent.querySelector<HTMLElement>('.prompt')!.style.display).toBe('block');
    expect(parent.querySelector('.vignette.pulse')).toBeNull();

    s.meter.urgency = 95;
    hud.update(s, false);
    expect(parent.querySelector('.vignette.pulse')).not.toBeNull();
    expect(parent.querySelector<HTMLElement>('.prompt')!.style.display).toBe('none');
    expect(parent.querySelector('.crosshair')).not.toBeNull(); // first person by default
    hud.setMuted(true);
    expect(parent.querySelector('[data-testid=sound]')?.textContent).toContain('sound off');
    hud.setMuted(false);
    expect(parent.querySelector('[data-testid=sound]')?.textContent).toContain('sound on');
    hud.remove();
    expect(parent.children).toHaveLength(0);
    new Hud(parent, false);
    expect(parent.querySelector('.crosshair')).toBeNull();
  });
});
