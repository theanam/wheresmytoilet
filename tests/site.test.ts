import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const ISSUES = 'https://github.com/theanam/wheresmytoilet/issues';
const EMAIL = 'mailto:anam.ahmed.a@gmail.com';

describe('help and about pages', () => {
  it.each(['help.html', 'about.html'])('%s links to the issue tracker and the contact email', (page) => {
    const html = read(page);
    expect(html).toContain(`href="${ISSUES}"`);
    expect(html).toContain(`href="${EMAIL}"`);
    expect(html).toContain('href="./index.html"');
  });
});

describe('mobile', () => {
  it('index.html fits the phone screen without zooming', () => {
    const html = read('index.html');
    expect(html).toMatch(/name="viewport" content="[^"]*width=device-width/);
    expect(html).toMatch(/name="viewport" content="[^"]*user-scalable=no/);
    expect(html).toMatch(/name="viewport" content="[^"]*viewport-fit=cover/);
  });

  it('help explains the touch controls', () => {
    const html = read('help.html');
    expect(html).toContain('On a phone or tablet');
    expect(html).toContain('USE');
  });
});

describe('build config', () => {
  it('uses relative asset paths so it works on GitHub Pages', () => {
    expect(viteConfig.base).toBe('./');
  });

  it('serves locally on port 5181', () => {
    expect(viteConfig.server?.port).toBe(5181);
  });

  it('builds the game, help and about pages', () => {
    const input = viteConfig.build?.rollupOptions?.input as Record<string, string>;
    expect(Object.keys(input).sort()).toEqual(['about', 'help', 'main']);
  });
});
