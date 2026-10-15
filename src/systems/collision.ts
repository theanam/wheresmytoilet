/**
 * Simple top-down collision: the player is a circle, obstacles are axis-aligned
 * boxes or circles on the floor plan (x/z). Movement slides along walls.
 *
 * We use this instead of Babylon's moveWithCollisions, which detected no
 * collisions at all in Babylon.js 9.30 (even in a minimal box-and-wall test).
 */
export type Obstacle =
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number }
  | { kind: 'circle'; x: number; z: number; r: number };

export interface Point {
  x: number;
  z: number;
}

export class CollisionWorld {
  readonly obstacles: Obstacle[] = [];

  addBox(minX: number, maxX: number, minZ: number, maxZ: number): void {
    this.obstacles.push({ kind: 'box', minX, maxX, minZ, maxZ });
  }

  addCircle(x: number, z: number, r: number): void {
    this.obstacles.push({ kind: 'circle', x, z, r });
  }

  /** Returns where a circle of `radius` at `from` ends up after trying to move by `delta`. */
  move(from: Point, delta: Point, radius: number): Point {
    // Small steps so fast movement can't tunnel through thin walls.
    const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / (radius * 0.5)));
    const p = { x: from.x, z: from.z };
    for (let i = 0; i < steps; i++) {
      p.x += delta.x / steps;
      p.z += delta.z / steps;
      for (let pass = 0; pass < 3; pass++) {
        let pushed = false;
        for (const o of this.obstacles) pushed = pushOut(p, radius, o) || pushed;
        if (!pushed) break;
      }
    }
    return p;
  }

  /**
   * Fraction (0–1) along the segment from `from` to `to` where it first hits an
   * obstacle grown by `padding`; 1 if nothing is in the way.
   */
  raycast(from: Point, to: Point, padding = 0): number {
    let best = 1;
    for (const o of this.obstacles) best = Math.min(best, segmentHit(from, to, o, padding));
    return best;
  }

  /** True if a circle at `p` overlaps any obstacle. */
  overlaps(p: Point, radius: number): boolean {
    return this.obstacles.some((o) => pushOut({ x: p.x, z: p.z }, radius, o));
  }
}

/** Moves `p` out of obstacle `o` if they overlap. Returns true if it moved. */
function pushOut(p: Point, r: number, o: Obstacle): boolean {
  if (o.kind === 'circle') {
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = r + o.r;
    if (d >= min) return false;
    const nx = d > 1e-9 ? dx / d : 1;
    const nz = d > 1e-9 ? dz / d : 0;
    p.x = o.x + nx * min;
    p.z = o.z + nz * min;
    return true;
  }
  const cx = Math.max(o.minX, Math.min(p.x, o.maxX));
  const cz = Math.max(o.minZ, Math.min(p.z, o.maxZ));
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= r) return false;
  if (d > 1e-9) {
    p.x = cx + (dx / d) * r;
    p.z = cz + (dz / d) * r;
    return true;
  }
  // Centre is inside the box: push out through the nearest side.
  const exits = [
    { d: p.x - o.minX, x: o.minX - r, z: p.z },
    { d: o.maxX - p.x, x: o.maxX + r, z: p.z },
    { d: p.z - o.minZ, x: p.x, z: o.minZ - r },
    { d: o.maxZ - p.z, x: p.x, z: o.maxZ + r },
  ].sort((a, b) => a.d - b.d)[0];
  p.x = exits.x;
  p.z = exits.z;
  return true;
}

function segmentHit(a: Point, b: Point, o: Obstacle, pad: number): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (o.kind === 'circle') {
    // Solve |a + t·d − c| = r for the smallest t in [0, 1].
    const r = o.r + pad;
    const fx = a.x - o.x;
    const fz = a.z - o.z;
    const A = dx * dx + dz * dz;
    const B = 2 * (fx * dx + fz * dz);
    const C = fx * fx + fz * fz - r * r;
    if (C <= 0) return 0; // starts inside
    if (A === 0) return 1;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return 1;
    const t = (-B - Math.sqrt(disc)) / (2 * A);
    return t >= 0 && t <= 1 ? t : 1;
  }
  // Slab test against the padded box.
  let tMin = 0;
  let tMax = 1;
  for (const [start, delta, lo, hi] of [
    [a.x, dx, o.minX - pad, o.maxX + pad],
    [a.z, dz, o.minZ - pad, o.maxZ + pad],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (start < lo || start > hi) return 1;
      continue;
    }
    let t1 = (lo - start) / delta;
    let t2 = (hi - start) / delta;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return 1;
  }
  return tMin;
}
