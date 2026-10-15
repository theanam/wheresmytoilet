type Attrs = Record<string, string | ((e: Event) => void)>;

/** Tiny helper for building DOM elements: h('button', { class: 'btn', onclick: fn }, 'Play'). */
export function h(tag: string, attrs: Attrs = {}, ...children: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') el.addEventListener(key.replace(/^on/, ''), value);
    else el.setAttribute(key, value);
  }
  el.append(...children);
  return el;
}
