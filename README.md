# Where's My Toilet?

A short, silly 3D browser game: you're desperate for a toilet and must find one in a crowded, maze-like
shopping mall before your Urgency meter hits 100%. Runs entirely in the browser; hosted on GitHub Pages.

See [SPEC.md](SPEC.md) for the full game design. The game is first-person for now; a third-person
camera is built in (`camera.mode` in `src/config.ts`) and will become the default once the character has walk animations.

## Run it locally

```sh
npm install
npm run dev      # http://localhost:5181
```

## Test and build

```sh
npm test         # unit + headless 3D tests (Vitest)
npm run build    # type-check and build to dist/
npm run preview  # serve the built game on http://localhost:5181
```

## Deploying

Pushing to `main` runs the tests, builds, and deploys to GitHub Pages via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml). One-time setup: in the repository's
**Settings → Pages**, set **Source** to **GitHub Actions**.

## Tuning

Every gameplay number (urgency rates, speeds, star times, maze loops, a fixed layout seed) lives in
[src/config.ts](src/config.ts).

## Project layout

- `src/main.ts` — starts the game, switches between title, round, pause and end screens
- `src/scenes/` — the game round and the title/pause/end screens
- `src/world/` — mall layout generator (pure logic) and the 3D builder
- `src/actors/` — the player
- `src/systems/` — urgency meter, input, collisions, scoring, RNG
- `src/ui/` — HUD and DOM helpers
- `help.html`, `about.html` — help and about pages
- `tests/` — Vitest suites

## Feedback

Bugs and ideas: [GitHub issues](https://github.com/theanam/wheresmytoilet/issues).
Everything else: [anam.ahmed.a@gmail.com](mailto:anam.ahmed.a@gmail.com).
