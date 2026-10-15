# Shopping Mall Toilet Search — Game Spec

Oct 15, 2026 · @Anam

## Overview

A short, funny 3D browser game: you are desperate for a toilet and must find one in a crowded, maze-like shopping mall before your Urgency meter hits 100%. A round lasts 2–4 minutes.

**Goals for version 1**

- Playable in Chrome, Firefox and Safari on a laptop, no install.
- One mall floor, one working toilet, crowds, and a clear win/lose screen.
- Built by someone with no coding experience, using Claude Code to write all the code.

**How to use this doc with Claude Code**

1. Save this doc as `SPEC.md` in an empty project folder.
2. Open Claude Code in that folder and say: "Read SPEC.md. We are building Milestone 1 only."
3. Work one milestone at a time. Test in the browser after each one before moving on.
4. When something breaks, describe what you see (or paste the error from the browser console) rather than guessing at fixes.

## Tech stack and setup

The game uses Babylon.js with Vite: free, beginner-friendly, and it includes collisions, cameras and physics out of the box.

| Piece | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | Catches mistakes early; Claude Code handles it well |
| 3D engine | Babylon.js | Built-in collisions, first-person camera, crowd navigation plugin |
| Build tool | Vite | One command runs the game locally with instant reload |
| Pathfinding | Babylon RecastJS navigation plugin | NPCs walk around walls without custom code |
| Hosting | itch.io or Netlify (free) | Upload a folder, get a public link |

**One-time setup (you do this)**

1. Install Node.js (LTS version) from nodejs.org.
2. Install Claude Code and log in.
3. Create an empty folder, e.g. `mall-toilet-search`, and put `SPEC.md` in it.

**Folder structure (Claude Code creates this)**

- `src/main.ts` — starts the game
- `src/scenes/` — title screen, game, end screen
- `src/world/` — mall layout, toilets, props
- `src/actors/` — player, shoppers
- `src/systems/` — urgency meter, audio, input
- `public/assets/` — models, sounds, textures

Run the game with `npm run dev` and open the address it prints (usually http://localhost:5173).

## Core gameplay

The loop: spawn at a random mall entrance, search the floor for a working toilet, reach it before Urgency hits 100%.

**Controls (keyboard + mouse, first-person view)**

| Input | Action |
| --- | --- |
| W A S D | Walk |
| Mouse | Look around (click the game to lock the pointer) |
| Shift (hold) | Sprint — faster, but Urgency rises 2× |
| Space (hold) | Clench — stand still, Urgency rise pauses, Clench stamina drains |
| E | Interact with a toilet door |
| Esc | Pause |

**Urgency meter**

- Starts at 20%, rises 0.5% per second while walking (about 160 seconds to fail with no sprinting).
- Sprinting: +1% per second. Bumping into a shopper: +2% instantly.
- Passing the food court: +0.5% per second extra while inside it.
- Clench stamina: 100 points, drains 20 per second while clenching, refills 5 per second when not.
- At 75% the screen wobbles slightly and footsteps get faster; at 90% a heartbeat sound plays.

**Win and lose**

- Win: press E at a working, unoccupied toilet. Show time taken and a 1–3 star rating (under 60 s = 3 stars, under 120 s = 2, otherwise 1).
- Lose: Urgency reaches 100%. Show a comedic "Oh no." screen with a fade to brown (no graphic imagery) and a Try Again button.
- All numbers above live in one file, `src/config.ts`, so they can be tuned without touching game logic.

## World

Version 1 is one mall floor, roughly 80 × 80 metres, generated from a grid so each round's layout differs.

**Mall layout**

- A 10 × 10 grid of 8 m cells. Each cell is corridor, shop, kiosk, food court, or wall.
- A maze algorithm carves the corridors, then extra openings are added so there are loops (pure mazes feel unfair).
- Shops are boxes with a coloured sign and an open front you cannot enter in v1.
- Landmarks help navigation: a fountain in the centre, a food court on one side, an escalator (decorative) in a corner.
- Use a fixed "seed" option in `config.ts` so a layout can be replayed while testing.

**Toilets and signs**

| Toilet type | Count per round | What happens on E |
| --- | --- | --- |
| Working | 1 | Win |
| Closed for cleaning | 2 | Message "Closed for cleaning!", +3% Urgency |
| Occupied | 1–2 | Message "Occupied..."; becomes free after 20 s |

- 6–8 wall signs with a toilet icon and an arrow. Most point toward a toilet; one or two point the wrong way.
- Toilets are always placed at dead ends or corridor edges, at least 30 m from the spawn point.

**Shoppers (NPCs)**

- 30 shoppers in v1, simple low-poly people in random clothing colours.
- They walk between random points using the navigation plugin, pause at shop fronts, and sometimes stand in groups.
- They block your path physically; walking into one adds Urgency and plays a "sorry!" sound.
- Performance target: 60 frames per second on a mid-range laptop. If it drops, reduce shopper count first.

## UI, audio and art

The look is bright, low-poly and cartoonish, so the toilet humour stays silly rather than gross.

**Screens**

- Title: game name, Play button, short controls list.
- In-game HUD: Urgency bar (top centre, green → yellow → red), Clench stamina bar under it, round timer (top right), small message line for toilet feedback.
- Pause: Resume, Restart, Quit to title.
- End: win or lose message, time, stars, Try Again.

**Art**

- Free CC0 asset packs: Kenney.nl (furniture, signs), Quaternius (low-poly people), Poly Pizza (props). Record each asset's source in `public/assets/CREDITS.md`.
- Flat colours, no detailed textures; soft ambient light plus one overhead light keeps it fast.
- Every shop gets a made-up silly name (e.g. "Socks & Rocks", "Bean There"); no real brands.

**Audio**

- Mall ambience loop (crowd chatter, soft music).
- Footsteps that speed up with Urgency, a stomach rumble at random intervals above 50%, heartbeat above 90%.
- Short stingers for win, lose, "Closed for cleaning" and bumping a shopper.
- Free sounds from freesound.org (CC0 only) or Kenney audio packs. Browsers block sound until the first click, so audio starts when Play is pressed.

## Milestones

Six milestones, each ending in something you can play and check. Paste the prompt into Claude Code, then test before moving on.

1. **Walk around a box.** Prompt: "Set up a Vite + TypeScript + Babylon.js project per SPEC.md. Make a flat floor, four walls and a first-person camera with WASD movement, mouse look and wall collisions." Done when: you can walk around and can't pass through walls.
2. **The maze mall.** Prompt: "Build the mall layout generator from the World section of SPEC.md, with a seed in config.ts. Add placeholder coloured boxes for shops, a fountain and a food court." Done when: each refresh gives a new, fully connected layout.
3. **Urgency and winning.** Prompt: "Add the Urgency meter, sprint, clench, the HUD bars, one working toilet, and the win/lose screens from SPEC.md." Done when: you can win and lose a full round.
4. **Shoppers.** Prompt: "Add 30 shoppers using the Babylon navigation plugin as described in SPEC.md, with bump penalties. Show an FPS counter while testing." Done when: shoppers walk around walls and the game stays near 60 FPS.
5. **Toilet tricks and signs.** Prompt: "Add closed and occupied toilets, wall signs including wrong-way ones, and the toilet placement rules from SPEC.md." Done when: a round feels like a search, not a stroll.
6. **Polish and ship.** Prompt: "Replace placeholders with the free assets in public/assets, add audio per SPEC.md, add title and pause screens, then make a production build and explain how to upload it to itch.io." Done when: a friend can play from a link.

**Tips for working with Claude Code**

- Ask it to use git and commit after each milestone, so you can undo a bad change with "go back to the last commit".
- If a bug appears, ask: "Explain what's wrong in plain words, then fix it."
- Change gameplay numbers yourself in `config.ts`; it's the easiest way to learn what the code does.

## Scope, risks and shipping

Keep v1 small; everything below "Later" waits until the six milestones are done and fun.

**Later (not in v1)**

- Multiple floors with working escalators and lifts.
- Mobile touch controls.
- Enterable shops, security guards who chase you, a mall map you can buy.
- Online leaderboard, multiple characters, difficulty levels.

**Risks and fixes**

| Risk | Fix |
| --- | --- |
| Game runs slowly | Fewer shoppers, simpler models, turn off shadows |
| Maze feels unfair or boring | Tune loop count and sign accuracy in config.ts; playtest with friends |
| Code gets messy as features pile up | Ask Claude Code to tidy and explain the structure between milestones |
| Losing motivation | Share a playable link after Milestone 3, even if ugly |

**Testing checklist (every milestone)**

- [ ] Game starts with no errors in the browser console (F12 → Console)
- [ ] Works in Chrome and one other browser
- [ ] A full round can be won and lost
- [ ] Frame rate stays near 60 FPS

**Shipping**

Run `npm run build`, zip the `dist` folder, and upload it to itch.io as an HTML game (or drag it into Netlify Drop). Both are free and give you a shareable link.
