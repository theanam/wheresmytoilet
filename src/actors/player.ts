import { Camera } from '@babylonjs/core/Cameras/camera';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { config, type CameraMode } from '../config';
import type { CollisionWorld } from '../systems/collision';
import { moveVector } from '../systems/input';

/**
 * The player: an invisible body that slides along walls (see CollisionWorld).
 * In first-person mode the camera sits at eye height; in third-person mode a
 * low-poly character is shown and the camera orbits behind it with the mouse.
 */
export class Player {
  readonly camera: FreeCamera;
  /** Invisible root at the player's centre; the character model hangs off it. */
  readonly body: Mesh;
  /** The visible character, rotated to face the way it walks. */
  readonly model: Mesh;
  /** Current camera distance, shortened when a wall is behind the player. */
  cameraDistance: number = config.camera.distance;
  private walkTime = 0;

  constructor(
    scene: Scene,
    private world: CollisionWorld,
    spawn: Vector3,
    yaw: number,
    readonly mode: CameraMode = config.camera.mode,
  ) {
    const { eyeHeight } = config.player;
    this.body = MeshBuilder.CreateBox('player', { size: 0.1 }, scene);
    this.body.isVisible = false;
    this.body.isPickable = false;
    this.body.position = new Vector3(spawn.x, eyeHeight / 2, spawn.z);

    this.model = buildCharacter(scene);
    this.model.parent = this.body;
    this.model.position.y = -eyeHeight / 2;
    this.model.rotation.y = yaw;
    this.model.setEnabled(mode === 'third');

    this.camera = new FreeCamera('player-cam', Vector3.Zero(), scene);
    this.camera.rotation.set(mode === 'third' ? config.camera.startPitch : 0, yaw, 0);
    this.camera.minZ = mode === 'third' ? 0.1 : 0.05;
    this.camera.fov = mode === 'third' ? config.camera.fov : 1.1;
    this.camera.inertia = 0.2;
    this.camera.angularSensibility = config.player.mouseSensitivity;
    this.camera.inputs.clear();
    this.camera.inputs.addMouse();
    this.syncCamera();
  }

  get position(): Vector3 {
    return this.body.position;
  }

  /** Camera heading; WASD moves relative to it. */
  get yaw(): number {
    return this.camera.rotation.y;
  }

  /** Move by keyboard intent for `dt` seconds, sliding along anything with collisions. */
  move(forward: number, strafe: number, speed: number, dt: number): void {
    const v = moveVector(forward, strafe, this.yaw, speed * dt);
    if (v.x !== 0 || v.z !== 0) {
      const p = this.world.move(this.body.position, v, config.player.radius);
      this.body.position.x = p.x;
      this.body.position.z = p.z;
      this.faceToward(Math.atan2(v.x, v.z), dt);
      this.walkTime += dt * speed;
    }
    this.syncCamera();
  }

  /** Turn the view by a touch drag of (dx, dy) pixels. */
  look(dx: number, dy: number): void {
    const sens = config.touch.lookSensitivity;
    this.camera.rotation.y += dx * sens;
    const limit = this.mode === 'first' ? 1.4 : config.camera.maxPitch;
    const floor = this.mode === 'first' ? -1.4 : config.camera.minPitch;
    this.camera.rotation.x = Math.max(floor, Math.min(limit, this.camera.rotation.x + dy * sens));
  }

  /**
   * Keep a sensible field of view on any screen: in portrait (phones held
   * upright) fix the horizontal angle so the view isn't a narrow slit.
   */
  fitAspect(aspect: number): void {
    const base = this.mode === 'third' ? config.camera.fov : 1.1;
    if (aspect < 1) {
      this.camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED;
      this.camera.fov = 1.35;
    } else {
      this.camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
      this.camera.fov = base;
    }
  }

  /** Visual pose for the frame: walking bob, or a squished wiggle while clenching. */
  animate(moving: boolean, clenching: boolean, time: number): void {
    const bob = moving ? Math.abs(Math.sin(this.walkTime * 2.2)) * 0.08 : 0;
    this.model.position.y = -config.player.eyeHeight / 2 + bob;
    this.model.scaling.y = clenching ? 0.9 : 1;
    this.model.rotation.z = clenching ? Math.sin(time * 30) * 0.03 : 0;
  }

  /** Turn the character smoothly toward a heading (radians). */
  private faceToward(heading: number, dt: number): void {
    let diff = heading - this.model.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.model.rotation.y += diff * Math.min(1, dt * 12);
  }

  /** Place the camera for the current mode. */
  syncCamera(): void {
    const { camera } = this;
    if (this.mode === 'first') {
      camera.position.set(this.body.position.x, config.player.eyeHeight, this.body.position.z);
      return;
    }
    // Third person: behind and above the player, pulled in if a wall is in the way.
    const c = config.camera;
    camera.rotation.x = Math.max(c.minPitch, Math.min(c.maxPitch, camera.rotation.x));
    const pitch = camera.rotation.x;
    const yaw = camera.rotation.y;
    const pivot = { x: this.body.position.x, y: c.pivotHeight, z: this.body.position.z };
    const back = { x: -Math.sin(yaw) * Math.cos(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
    const desired = { x: pivot.x + back.x * c.distance, z: pivot.z + back.z * c.distance };
    const hit = this.world.raycast(pivot, desired, c.wallMargin);
    this.cameraDistance = Math.max(0.3, c.distance * hit);
    const d = this.cameraDistance;
    const y = Math.min(config.mall.wallHeight - 0.3, Math.max(0.3, pivot.y + Math.sin(pitch) * d));
    camera.position.set(pivot.x + back.x * d, y, pivot.z + back.z * d);
  }

  /** Horizontal distance to a point on the floor. */
  distanceTo(point: Vector3): number {
    return Math.hypot(point.x - this.body.position.x, point.z - this.body.position.z);
  }
}

/** A simple cartoon person, about 1.7 m tall, built from primitives. Feet at y = 0. */
function buildCharacter(scene: Scene): Mesh {
  const mat = (name: string, hex: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    m.specularColor = Color3.Black();
    return m;
  };
  const root = MeshBuilder.CreateBox('character', { size: 0.01 }, scene);
  root.isVisible = false;
  const part = (mesh: Mesh, material: StandardMaterial, x: number, y: number, z: number) => {
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.parent = root;
    mesh.isPickable = false;
    return mesh;
  };
  const pants = mat('char-pants', '#3b5bdb');
  const shirt = mat('char-shirt', '#f76707');
  const skin = mat('char-skin', '#f1c27d');
  const dark = mat('char-dark', '#222222');
  for (const side of [-1, 1]) {
    part(MeshBuilder.CreateCylinder(`char-leg-${side}`, { diameter: 0.18, height: 0.8, tessellation: 8 }, scene), pants, side * 0.12, 0.4, 0);
    part(MeshBuilder.CreateCylinder(`char-arm-${side}`, { diameter: 0.13, height: 0.62, tessellation: 8 }, scene), shirt, side * 0.32, 1.12, 0);
    part(MeshBuilder.CreateSphere(`char-eye-${side}`, { diameter: 0.06, segments: 4 }, scene), dark, side * 0.07, 1.6, 0.17);
  }
  part(MeshBuilder.CreateCylinder('char-torso', { diameterTop: 0.42, diameterBottom: 0.48, height: 0.65, tessellation: 10 }, scene), shirt, 0, 1.12, 0);
  part(MeshBuilder.CreateSphere('char-head', { diameter: 0.36, segments: 8 }, scene), skin, 0, 1.6, 0);
  part(MeshBuilder.CreateSphere('char-nose', { diameter: 0.07, segments: 4 }, scene), skin, 0, 1.56, 0.19);
  return root;
}
