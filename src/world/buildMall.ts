import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { config } from '../config';
import { CollisionWorld } from '../systems/collision';
import { ALL_DIRS, cellCenter, DIRS, OPPOSITE, type Dir, type MallLayout } from './mallLayout';

export interface BuiltMall {
  /** World position of the working toilet door (at floor level). */
  toiletDoor: Vector3;
  /** Where the player starts, and the yaw (radians) they face. */
  spawnPosition: Vector3;
  spawnYaw: number;
  /** Meshes the player collides with. */
  colliders: Mesh[];
  /** Floor-plan shapes of those meshes, used for player movement. */
  collision: CollisionWorld;
}

/** Yaw (rotation around y) that looks along a grid direction. 0 looks toward +z (north). */
export const DIR_YAW: Record<Dir, number> = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 };

const PALETTE = {
  floor: '#e9dcc6',
  floorAlt: '#d6c6ab',
  foodFloor: '#ffe3b3',
  ceiling: '#fbfaf7',
  outerWall: '#d9cdb8',
  solidWall: '#cfc3ae',
  shopBody: '#e8e2d8',
  window: '#7fb6d9',
  toiletDoor: '#2f7de1',
  kiosk: '#ff8c42',
  water: '#59c3f0',
  stone: '#bfb6a8',
  table: '#ffffff',
};

function flat(scene: Scene, name: string, hex: string, alpha = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = Color3.Black();
  m.alpha = alpha;
  return m;
}

/**
 * Material showing text on a coloured background. Falls back to a plain colour
 * where canvas text isn't available (e.g. headless tests).
 */
function labelMaterial(scene: Scene, name: string, text: string, bg: string, fg = '#ffffff'): StandardMaterial {
  const m = flat(scene, name, bg);
  try {
    const tex = new DynamicTexture(`${name}-tex`, { width: 512, height: 128 }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D | null;
    if (!ctx) return m;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 64;
    do {
      ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`;
      size -= 4;
    } while (ctx.measureText(text).width > 480 && size > 20);
    ctx.fillText(text, 256, 68);
    tex.update();
    m.diffuseColor = Color3.White();
    m.diffuseTexture = tex;
    m.emissiveColor = new Color3(0.25, 0.25, 0.25);
  } catch {
    // Plain colour is fine.
  }
  return m;
}

/**
 * A sign: a coloured board with readable text on the side facing `facing`
 * (the direction a viewer looks from, toward the sign is the opposite).
 */
function makeSign(
  scene: Scene,
  name: string,
  text: string,
  color: string,
  at: Vector3,
  facing: Dir,
  width: number,
  height: number,
): Mesh {
  const board = MeshBuilder.CreateBox(name, { width, height, depth: 0.15 }, scene);
  board.position.copyFrom(at);
  board.rotation.y = DIR_YAW[facing];
  board.material = flat(scene, `${name}-board`, color);
  const face = MeshBuilder.CreatePlane(`${name}-text`, { width: width - 0.1, height: height - 0.1 }, scene);
  face.parent = board;
  face.position.z = 0.08;
  face.rotation.y = Math.PI;
  face.material = labelMaterial(scene, `${name}-mat`, text, color);
  return board;
}

/** Checkerboard floor tiles (2 m) so you can judge distance and speed. */
function tileMaterial(scene: Scene, span: number): StandardMaterial {
  const m = flat(scene, 'floor-mat', PALETTE.floor);
  try {
    const tex = new DynamicTexture('floor-tex', { width: 128, height: 128 }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D | null;
    if (!ctx) return m;
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = PALETTE.floorAlt;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillRect(64, 64, 64, 64);
    tex.update();
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.uScale = tex.vScale = span / 4;
    m.diffuseColor = Color3.White();
    m.diffuseTexture = tex;
  } catch {
    // Plain colour is fine.
  }
  return m;
}

/** Point on the inside face of a cell edge, `inset` metres from the edge toward the centre. */
function edgePoint(layout: MallLayout, x: number, y: number, dir: Dir, inset: number): Vector3 {
  const c = cellCenter(layout, x, y);
  const reach = layout.cellSize / 2 - inset;
  return new Vector3(c.x + DIRS[dir].dx * reach, 0, c.z + DIRS[dir].dy * reach);
}

export function buildMall(scene: Scene, layout: MallLayout): BuiltMall {
  const { cellSize, size } = layout;
  const height = config.mall.wallHeight;
  const span = cellSize * size;
  const colliders: Mesh[] = [];
  const collision = new CollisionWorld();
  /** Register a mesh as solid: as a circle of `radius` if given, otherwise as its bounding box. */
  const solid = (mesh: Mesh, radius?: number) => {
    mesh.checkCollisions = true;
    colliders.push(mesh);
    mesh.computeWorldMatrix(true);
    if (radius !== undefined) {
      collision.addCircle(mesh.position.x, mesh.position.z, radius);
    } else {
      const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox;
      collision.addBox(min.x, max.x, min.z, max.z);
    }
    return mesh;
  };

  const floor = MeshBuilder.CreateGround('floor', { width: span, height: span }, scene);
  floor.material = tileMaterial(scene, span);

  const ceiling = MeshBuilder.CreatePlane('ceiling', { size: span, sideOrientation: Mesh.DOUBLESIDE }, scene);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  const ceilingMat = flat(scene, 'ceiling-mat', PALETTE.ceiling);
  ceilingMat.emissiveColor = new Color3(0.45, 0.45, 0.43);
  ceiling.material = ceilingMat;

  // Outer walls.
  const outerMat = flat(scene, 'outer-mat', PALETTE.outerWall);
  const t = 0.5;
  for (const [name, x, z, w, d] of [
    ['wall-n', 0, span / 2 + t / 2, span + 2 * t, t],
    ['wall-s', 0, -span / 2 - t / 2, span + 2 * t, t],
    ['wall-e', span / 2 + t / 2, 0, t, span],
    ['wall-w', -span / 2 - t / 2, 0, t, span],
  ] as const) {
    const wall = MeshBuilder.CreateBox(name, { width: w, depth: d, height }, scene);
    wall.position.set(x, height / 2, z);
    wall.material = outerMat;
    solid(wall);
  }

  // Solid cells: plain walls and shops.
  const solidMat = flat(scene, 'solid-mat', PALETTE.solidWall);
  const shopMat = flat(scene, 'shop-mat', PALETTE.shopBody);
  const windowMat = flat(scene, 'window-mat', PALETTE.window, 0.75);
  const shopsByCell = new Map(layout.shops.map((s) => [`${s.x},${s.y}`, s]));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const type = layout.cells[y][x];
      if (type !== 'wall' && type !== 'shop') continue;
      const c = cellCenter(layout, x, y);
      const box = MeshBuilder.CreateBox(`cell-${x}-${y}`, { width: cellSize, depth: cellSize, height }, scene);
      box.position.set(c.x, height / 2, c.z);
      box.material = type === 'shop' ? shopMat : solidMat;
      solid(box);

      const shop = shopsByCell.get(`${x},${y}`);
      if (!shop) continue;
      // Shop front: a window and a coloured name sign on the face toward the corridor.
      const yaw = DIR_YAW[shop.front];
      const facePos = edgePoint(layout, x, y, shop.front, -0.02);
      const win = MeshBuilder.CreatePlane(`window-${x}-${y}`, { width: cellSize - 1.5, height: 2.6 }, scene);
      win.position.set(facePos.x, 1.5, facePos.z);
      win.rotation.y = yaw + Math.PI;
      win.material = windowMat;
      const signPos = edgePoint(layout, x, y, shop.front, -0.1);
      signPos.y = 3.6;
      makeSign(scene, `sign-${x}-${y}`, shop.name, shop.color, signPos, shop.front, cellSize - 1, 1.2);
    }
  }

  // Fountain plaza: the 2×2 block of fountain cells is centred on the origin.
  const fountainCells: { x: number; z: number }[] = [];
  const foodCells: { x: number; z: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (layout.cells[y][x] === 'fountain') fountainCells.push(cellCenter(layout, x, y));
      if (layout.cells[y][x] === 'foodcourt') foodCells.push(cellCenter(layout, x, y));
    }
  }
  if (fountainCells.length) {
    const fx = avg(fountainCells.map((c) => c.x));
    const fz = avg(fountainCells.map((c) => c.z));
    const basin = MeshBuilder.CreateCylinder('fountain-basin', { diameter: 6, height: 0.8, tessellation: 32 }, scene);
    basin.position.set(fx, 0.4, fz);
    basin.material = flat(scene, 'stone-mat', PALETTE.stone);
    solid(basin, 3);
    const water = MeshBuilder.CreateCylinder('fountain-water', { diameter: 5.4, height: 0.05, tessellation: 32 }, scene);
    water.position.set(fx, 0.78, fz);
    water.material = flat(scene, 'water-mat', PALETTE.water, 0.85);
    const column = MeshBuilder.CreateCylinder('fountain-column', { diameterTop: 0.5, diameterBottom: 1, height: 2.4 }, scene);
    column.position.set(fx, 1.6, fz);
    column.material = basin.material;
  }

  if (foodCells.length) {
    const fx = avg(foodCells.map((c) => c.x));
    const fz = avg(foodCells.map((c) => c.z));
    const mat = flat(scene, 'food-floor-mat', PALETTE.foodFloor);
    const rug = MeshBuilder.CreateGround('food-floor', { width: cellSize * 2 - 0.2, height: cellSize * 2 - 0.2 }, scene);
    rug.position.set(fx, 0.01, fz);
    rug.material = mat;
    const tableMat = flat(scene, 'table-mat', PALETTE.table);
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 0]]) {
      const table = MeshBuilder.CreateCylinder(`table-${dx}-${dz}`, { diameter: 1.4, height: 0.8 }, scene);
      table.position.set(fx + dx, 0.4, fz + dz);
      table.material = tableMat;
      solid(table, 0.7);
    }
    // A square hanging sign, readable from every side.
    for (const dir of ALL_DIRS) {
      const at = new Vector3(fx + DIRS[dir].dx * 2, 4.6, fz + DIRS[dir].dy * 2);
      makeSign(scene, `food-sign-${dir}`, 'FOOD COURT', '#e8590c', at, dir, 4, 1);
    }
  }

  // Kiosks: small stalls in straight corridors.
  const kioskMat = flat(scene, 'kiosk-mat', PALETTE.kiosk);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (layout.cells[y][x] === 'kiosk') {
        const c = cellCenter(layout, x, y);
        const kiosk = MeshBuilder.CreateBox(`kiosk-${x}-${y}`, { width: 2.2, depth: 2.2, height: 1.2 }, scene);
        kiosk.position.set(c.x, 0.6, c.z);
        kiosk.material = kioskMat;
        solid(kiosk);
      }
      if (layout.cells[y][x] === 'escalator') {
        // Decorative, out-of-order escalator tucked into the corner.
        const c = cellCenter(layout, x, y);
        const ramp = MeshBuilder.CreateBox('escalator', { width: 2.4, depth: 6, height: 0.4 }, scene);
        ramp.position.set(c.x + cellSize / 2 - 1.4, 2.2, c.z);
        ramp.rotation.x = -0.6;
        ramp.material = flat(scene, 'escalator-mat', '#8a8f98');
        const base = MeshBuilder.CreateBox('escalator-base', { width: 2.6, depth: 6, height: 4.4 }, scene);
        base.position.set(c.x + cellSize / 2 - 1.4, 2.2, c.z);
        base.isVisible = false;
        solid(base);
        const at = new Vector3(c.x + cellSize / 2 - 2.75, 1.6, c.z);
        makeSign(scene, 'escalator-sign', 'OUT OF ORDER', '#495057', at, 'W', 2.4, 0.7);
      }
    }
  }

  // The working toilet: a blue door with a WC sign on the edge of its cell.
  const { toilet, spawn } = layout;
  const doorYaw = DIR_YAW[toilet.side] + Math.PI;
  const doorPos = edgePoint(layout, toilet.x, toilet.y, toilet.side, 0.06);
  const door = MeshBuilder.CreateBox('toilet-door', { width: 1.4, height: 2.3, depth: 0.12 }, scene);
  door.position.set(doorPos.x, 1.15, doorPos.z);
  door.rotation.y = doorYaw;
  door.material = flat(scene, 'toilet-door-mat', PALETTE.toiletDoor);
  const wcPos = edgePoint(layout, toilet.x, toilet.y, toilet.side, 0.1);
  wcPos.y = 2.9;
  makeSign(scene, 'toilet-sign', '🚻 TOILETS', PALETTE.toiletDoor, wcPos, OPPOSITE[toilet.side], 2.6, 0.9);

  // Glass entrance doors behind the spawn point.
  const behind = spawn.entrance;
  const entrancePos = edgePoint(layout, spawn.x, spawn.y, behind, 0.02);
  const entrance = MeshBuilder.CreatePlane('entrance', { width: 4, height: 3 }, scene);
  entrance.position.set(entrancePos.x, 1.5, entrancePos.z);
  entrance.rotation.y = DIR_YAW[behind];
  entrance.material = windowMat;

  // Nothing in the mall moves, so freeze world matrices for speed.
  for (const mesh of scene.meshes) mesh.freezeWorldMatrix();

  const s = cellCenter(layout, spawn.x, spawn.y);
  return {
    toiletDoor: new Vector3(doorPos.x, 0, doorPos.z),
    spawnPosition: new Vector3(s.x, 0, s.z),
    spawnYaw: DIR_YAW[spawn.facing],
    colliders,
    collision,
  };
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
