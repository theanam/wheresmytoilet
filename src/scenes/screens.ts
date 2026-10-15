import { formatTime } from '../systems/scoring';
import type { RoundResult } from '../systems/session';
import { h } from '../ui/dom';
import { LINKS } from '../ui/links';

const CONTROLS: [string, string][] = [
  ['W A S D', 'Walk'],
  ['Mouse', 'Look around'],
  ['Shift (hold)', 'Sprint — urgency rises 2×'],
  ['Space (hold)', 'Clench — stand still, urgency pauses'],
  ['E', 'Use a toilet door'],
  ['M', 'Sound on / off'],
  ['Esc', 'Pause'],
];

const TOUCH_CONTROLS: [string, string][] = [
  ['Left thumb', 'Drag to walk'],
  ['Right thumb', 'Drag to look around'],
  ['RUN', 'Sprint on / off — urgency rises 2×'],
  ['HOLD', 'Clench — stand still, urgency pauses'],
  ['USE', 'Use a toilet door'],
  ['🔊', 'Sound on / off'],
];

function screen(className: string, ...children: (Node | string)[]): HTMLElement {
  return h('div', { class: `screen ${className}` }, h('div', { class: 'panel' }, ...children));
}

function button(label: string, onClick: () => void, primary = false): HTMLElement {
  return h('button', { class: primary ? 'btn primary' : 'btn', type: 'button', onclick: onClick }, label);
}

function footerLinks(newTab: boolean): HTMLElement {
  const target: Record<string, string> = newTab ? { target: '_blank', rel: 'noopener' } : {};
  return h(
    'nav',
    { class: 'links' },
    h('a', { href: LINKS.help, ...target }, 'Help'),
    h('a', { href: LINKS.about, ...target }, 'About'),
    h('a', { href: LINKS.issues, target: '_blank', rel: 'noopener' }, 'Report an issue'),
  );
}

export function titleScreen(onPlay: () => void, touch = false): HTMLElement {
  const controls = touch ? TOUCH_CONTROLS : CONTROLS;
  return screen(
    'title',
    h('h1', {}, "Where's My Toilet?"),
    h('p', { class: 'tagline' }, 'You need to go. Badly. Find the toilet before your Urgency hits 100%.'),
    button('Play', onPlay, true),
    touch ? h('p', { class: 'hint' }, 'Tip: turn your phone sideways for the best view.') : '',
    h(
      'table',
      { class: 'controls' },
      ...controls.map(([key, action]) => h('tr', {}, h('td', {}, h('kbd', {}, key)), h('td', {}, action))),
    ),
    footerLinks(false),
  );
}

export function pauseScreen(actions: { onResume: () => void; onRestart: () => void; onQuit: () => void }): HTMLElement {
  return screen(
    'pause',
    h('h2', {}, 'Paused'),
    h('p', {}, 'Your bladder is not paused. Okay, it is. But hurry.'),
    button('Resume', actions.onResume, true),
    button('Restart', actions.onRestart),
    button('Quit to title', actions.onQuit),
    footerLinks(true),
  );
}

export function endScreen(result: RoundResult, actions: { onTryAgain: () => void; onQuit: () => void }): HTMLElement {
  const won = result.outcome === 'won';
  const stars = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
  return screen(
    won ? 'end won' : 'end lost',
    h('h2', {}, won ? 'Phew! You made it.' : 'Oh no.'),
    h('p', {}, won ? 'Sweet, sweet relief.' : "You didn't make it. Nobody saw. Probably."),
    h('p', { class: 'time', 'data-testid': 'end-time' }, `Time: ${formatTime(result.seconds)}`),
    won ? h('p', { class: 'stars', 'data-testid': 'stars', 'aria-label': `${result.stars} of 3 stars` }, stars) : '',
    button('Try Again', actions.onTryAgain, true),
    button('Quit to title', actions.onQuit),
  );
}
