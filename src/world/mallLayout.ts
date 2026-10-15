import { config } from '../config';
import { createRng, pick, randomInt, shuffle, type Rng } from '../systems/rng';

export type CellType = 'corridor' | 'shop' | 'kiosk' | 'foodcourt' | 'fountain' | 'escalator' | 'wall';
export type Dir = 'N' | 'S' | 'E' | 'W';

export interface Cell {
  x: number;
  y: number;
}

export interface Shop extends Cell {
  front: Dir;
  name: string;
  color: string;
}

export interface MallLayout {
  seed: number;
  size: number;
  cellSize: number;
  /** cells[y][x] */
  cells: CellType[][];
  shops: Shop[];
  /** `entrance` is the outer wall the player came in through; `facing` is a walkable direction. */
  spawn: Cell & { facing: Dir; entrance: Dir };
  toilet: Cell & { side: Dir };
}

/** +y on the grid is north, which is +z in the 3D world. */
export const DIRS: Record<Dir, { dx: number; dy: number }> = {
  N: { dx: 0, dy: 1 },
  S: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};
export const ALL_DIRS: Dir[] = ['N', 'S', 'E', 'W'];
export const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

const WALKABLE: ReadonlySet<CellType> = new Set(['corridor', 'kiosk', 'foodcourt', 'fountain', 'escalator']);

export const SHOP_NAMES = [
  'Socks & Rocks', 'Bean There', 'Hat Trick', 'Lettuce Pray', 'Planet of the Grapes',
  'Spoon Collectors Unite', 'Thyme Machine', 'Sofa So Good', 'Wok This Way', 'Brews Brothers',
  'Pane in the Glass', 'Fit Happens', 'The Mug Shot', 'Knit Wits', 'Wick Ed Candles',
  'Lamp Shady', 'Scone With the Wind', 'Pho Real', 'Tea Rex', 'Totally Toasted',
  'Shoe-pid Prices', 'Clock Block', 'Bagel Eagle', 'Sweater Weather', 'Rug Life',
  'Cereal Killers', 'Crumb & Get It', 'Dough Nation', 'Gnome Sweet Gnome', 'Specs Appeal',
];

const SHOP_COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac'];

export function isWalkable(type: CellType | undefined): boolean {
  return type !== undefined && WALKABLE.has(type);
}

export function getCell(layout: MallLayout, x: number, y: number): CellType | undefined {
  return layout.cells[y]?.[x];
}

export function neighbor(cell: Cell, dir: Dir): Cell {
  return { x: cell.x + DIRS[dir].dx, y: cell.y + DIRS[dir].dy };
}

export function walkableNeighbors(layout: MallLayout, cell: Cell): Dir[] {
  return ALL_DIRS.filter((d) => {
    const n = neighbor(cell, d);
    return isWalkable(getCell(layout, n.x, n.y));
  });
}

/** World-space centre (x, z) of a grid cell. The mall is centred on the origin. */
export function cellCenter(layout: Pick<MallLayout, 'size' | 'cellSize'>, x: number, y: number): { x: number; z: number } {
  const half = (layout.size * layout.cellSize) / 2;
  return { x: (x + 0.5) * layout.cellSize - half, z: (y + 0.5) * layout.cellSize - half };
}

/** Grid cell containing a world position, or null if outside the mall. */
export function cellAtWorld(layout: MallLayout, wx: number, wz: number): Cell | null {
  const half = (layout.size * layout.cellSize) / 2;
  const x = Math.floor((wx + half) / layout.cellSize);
  const y = Math.floor((wz + half) / layout.cellSize);
  if (x < 0 || y < 0 || x >= layout.size || y >= layout.size) return null;
  return { x, y };
}

export function cellDistance(layout: MallLayout, a: Cell, b: Cell): number {
  return Math.hypot(a.x - b.x, a.y - b.y) * layout.cellSize;
}

/** Number of walkable cells reachable from `start` (breadth-first search). */
export function reachableCount(layout: MallLayout, start: Cell): number {
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue: Cell[] = [start];
  while (queue.length) {
    const c = queue.shift()!;
    for (const d of walkableNeighbors(layout, c)) {
      const n = neighbor(c, d);
      const key = `${n.x},${n.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(n);
      }
    }
  }
  return seen.size;
}

export function generateMall(seed: number, opts = config.mall): MallLayout {
  const rng = createRng(seed);
  const size = opts.gridSize;
  const cells: CellType[][] = Array.from({ length: size }, () => Array<CellType>(size).fill('wall'));
  const set = (x: number, y: number, t: CellType) => {
    if (x >= 0 && y >= 0 && x < size && y < size) cells[y][x] = t;
  };

  carveMaze(rng, cells, size);
  addLoops(rng, cells, size, opts.extraOpenings);

  // Landmarks: a fountain plaza in the centre and a food court on one side.
  const mid = Math.floor(size / 2) - 1;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(mid + dx, mid + dy, 'fountain');
  const lastNode = size % 2 === 0 ? size - 2 : size - 1;
  const foodOrigins: [number, number][] = [[0, mid], [lastNode - 1, mid], [mid, 0], [mid, lastNode - 1]];
  const [fx, fy] = pick(rng, foodOrigins);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(fx + dx, fy + dy, 'foodcourt');
  set(lastNode, lastNode, 'escalator');

  const layout: MallLayout = {
    seed,
    size,
    cellSize: opts.cellSize,
    cells,
    shops: [],
    spawn: { x: 0, y: 0, facing: 'N', entrance: 'S' },
    toilet: { x: 0, y: 0, side: 'N' },
  };

  layout.spawn = chooseSpawn(rng, layout);
  layout.toilet = chooseToilet(rng, layout);
  placeKiosks(rng, layout, opts.kioskCount);
  layout.shops = placeShops(rng, layout);
  return layout;
}

/** Recursive-backtracker maze over the even-coordinate "node" cells. */
function carveMaze(rng: Rng, cells: CellType[][], size: number) {
  const isNode = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && x % 2 === 0 && y % 2 === 0;
  const visited = new Set<string>(['0,0']);
  const stack: Cell[] = [{ x: 0, y: 0 }];
  cells[0][0] = 'corridor';
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = ALL_DIRS.map((d) => ({ d, x: cur.x + DIRS[d].dx * 2, y: cur.y + DIRS[d].dy * 2 })).filter(
      (n) => isNode(n.x, n.y) && !visited.has(`${n.x},${n.y}`),
    );
    if (!options.length) {
      stack.pop();
      continue;
    }
    const next = pick(rng, options);
    cells[cur.y + DIRS[next.d].dy][cur.x + DIRS[next.d].dx] = 'corridor';
    cells[next.y][next.x] = 'corridor';
    visited.add(`${next.x},${next.y}`);
    stack.push({ x: next.x, y: next.y });
  }
}

/** Knock out extra walls between nodes so the maze has loops (pure mazes feel unfair). */
function addLoops(rng: Rng, cells: CellType[][], size: number, count: number) {
  const lastNode = size % 2 === 0 ? size - 2 : size - 1;
  const candidates: Cell[] = [];
  for (let y = 0; y <= lastNode; y++) {
    for (let x = 0; x <= lastNode; x++) {
      if ((x % 2) + (y % 2) === 1 && cells[y][x] === 'wall') candidates.push({ x, y });
    }
  }
  for (const c of shuffle(rng, candidates).slice(0, count)) cells[c.y][c.x] = 'corridor';
}

function chooseSpawn(rng: Rng, layout: MallLayout): MallLayout['spawn'] {
  const options: Cell[] = [];
  for (let y = 0; y < layout.size; y++) {
    for (let x = 0; x < layout.size; x++) {
      if (layout.cells[y][x] === 'corridor' && (x === 0 || y === 0)) options.push({ x, y });
    }
  }
  const c = pick(rng, options);
  const entrance: Dir = c.x === 0 ? 'W' : 'S';
  // Face into the mall if that way is open, otherwise along the corridor.
  const open = walkableNeighbors(layout, c);
  const facing = open.includes(OPPOSITE[entrance]) ? OPPOSITE[entrance] : pick(rng, open);
  return { ...c, facing, entrance };
}

function chooseToilet(rng: Rng, layout: MallLayout): MallLayout['toilet'] {
  const far: Cell[] = [];
  for (let y = 0; y < layout.size; y++) {
    for (let x = 0; x < layout.size; x++) {
      const c = { x, y };
      if (layout.cells[y][x] === 'corridor' && cellDistance(layout, c, layout.spawn) >= config.toilets.minDistanceFromSpawn) {
        far.push(c);
      }
    }
  }
  const deadEnds = far.filter((c) => walkableNeighbors(layout, c).length === 1);
  if (deadEnds.length) {
    const c = pick(rng, deadEnds);
    // The door sits on the wall facing the only way in, so it is visible on approach.
    return { ...c, side: OPPOSITE[walkableNeighbors(layout, c)[0]] };
  }
  const edges = far.filter((c) => walkableNeighbors(layout, c).length < 4);
  const c = pick(rng, edges);
  const blocked = ALL_DIRS.filter((d) => !walkableNeighbors(layout, c).includes(d));
  return { ...c, side: pick(rng, blocked) };
}

/** Kiosks go in straight corridor segments, away from spawn and toilet. */
function placeKiosks(rng: Rng, layout: MallLayout, count: number) {
  const options: Cell[] = [];
  for (let y = 0; y < layout.size; y++) {
    for (let x = 0; x < layout.size; x++) {
      if (layout.cells[y][x] !== 'corridor') continue;
      const c = { x, y };
      const open = walkableNeighbors(layout, c);
      const straight = open.length === 2 && OPPOSITE[open[0]] === open[1];
      const clear = cellDistance(layout, c, layout.spawn) > layout.cellSize && cellDistance(layout, c, layout.toilet) > layout.cellSize;
      if (straight && clear) options.push(c);
    }
  }
  for (const c of shuffle(rng, options).slice(0, count)) layout.cells[c.y][c.x] = 'kiosk';
}

/** Every solid cell next to a walkable one becomes a shop facing that walkable cell. */
function placeShops(rng: Rng, layout: MallLayout): Shop[] {
  const names = shuffle(rng, [...SHOP_NAMES]);
  const shops: Shop[] = [];
  const toiletWall = neighbor(layout.toilet, layout.toilet.side);
  for (let y = 0; y < layout.size; y++) {
    for (let x = 0; x < layout.size; x++) {
      if (layout.cells[y][x] !== 'wall') continue;
      let fronts = walkableNeighbors(layout, { x, y });
      // Don't put a shop front on the wall that holds the toilet door.
      if (x === toiletWall.x && y === toiletWall.y) fronts = fronts.filter((d) => d !== OPPOSITE[layout.toilet.side]);
      if (!fronts.length) continue;
      layout.cells[y][x] = 'shop';
      shops.push({
        x,
        y,
        front: pick(rng, fronts),
        name: names[shops.length % names.length],
        color: SHOP_COLORS[randomInt(rng, SHOP_COLORS.length)],
      });
    }
  }
  return shops;
}
