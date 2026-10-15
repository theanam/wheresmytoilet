import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { Player } from '../actors/player';
import { config, type CameraMode } from '../config';
import type { InputState } from '../systems/input';
import { GameSession, type RoundResult } from '../systems/session';
import { SoundDirector, type SoundEvent } from '../systems/soundDirector';
import { buildMall, type BuiltMall } from '../world/buildMall';
import { cellAtWorld, generateMall, getCell, type MallLayout } from '../world/mallLayout';

export interface RoundHooks {
  onEnd(result: RoundResult): void;
  onFrame?(round: GameRound): void;
  /** A sound should play now (footsteps, rumbles, heartbeat, or a failed E press). */
  onSound?(event: SoundEvent | 'nope'): void;
}

/** One playable round: builds the 3D mall, runs the player and the urgency rules each frame. */
export class GameRound {
  readonly scene: Scene;
  readonly layout: MallLayout;
  readonly mall: BuiltMall;
  readonly player: Player;
  readonly session = new GameSession();
  readonly sounds = new SoundDirector();
  private time = 0;
  private ended = false;

  constructor(
    engine: AbstractEngine,
    seed: number,
    private input: InputState,
    private hooks: RoundHooks,
    cameraMode: CameraMode = config.camera.mode,
  ) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.98, 0.97, 0.94, 1);
    const hemi = new HemisphericLight('ambient', new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.85;
    hemi.groundColor = new Color3(0.55, 0.52, 0.5);
    const sun = new DirectionalLight('overhead', new Vector3(-0.3, -1, -0.4), this.scene);
    sun.intensity = 0.35;

    this.layout = generateMall(seed);
    this.mall = buildMall(this.scene, this.layout);
    this.player = new Player(this.scene, this.mall.collision, this.mall.spawnPosition, this.mall.spawnYaw, cameraMode);
    this.scene.activeCamera = this.player.camera;
    this.scene.onBeforeRenderObservable.add(() => this.tick(Math.min(engine.getDeltaTime() / 1000, 0.1)));
  }

  get inFoodCourt(): boolean {
    const c = cellAtWorld(this.layout, this.player.position.x, this.player.position.z);
    return c !== null && getCell(this.layout, c.x, c.y) === 'foodcourt';
  }

  get nearToilet(): boolean {
    return this.player.distanceTo(this.mall.toiletDoor) <= config.player.interactDistance;
  }

  /** Advance the round by `dt` seconds. Called every frame; public so tests can drive it. */
  tick(dt: number): void {
    const { session, input, player } = this;
    if (session.status === 'playing') {
      this.time += dt;
      const clenching = session.meter.isClenching({ clenching: input.clenching });
      const { forward, strafe } = input.axes;
      const moving = forward !== 0 || strafe !== 0;
      const sprinting = input.sprinting && moving && !clenching;
      if (moving && !clenching) {
        const speed = config.player.walkSpeed * (sprinting ? config.player.sprintMultiplier : 1);
        player.move(forward, strafe, speed, dt);
      } else {
        player.syncCamera(); // the mouse may still have turned the camera
      }
      player.animate(moving && !clenching, clenching, this.time);
      session.update(dt, { sprinting, clenching: input.clenching, inFoodCourt: this.inFoodCourt });
      if (input.consumePress('KeyE') && !session.interact(player.distanceTo(this.mall.toiletDoor))) {
        this.hooks.onSound?.('nope');
      }
      if (session.status === 'playing') {
        const walking = moving && !clenching;
        for (const e of this.sounds.update(dt, { moving: walking, sprinting, urgency: session.meter.urgency })) {
          this.hooks.onSound?.(e);
        }
      }

      // Past the wobble threshold the view sways, more as urgency climbs.
      const u = session.meter.urgency;
      const wobble = Math.max(0, (u - config.urgency.wobbleAt) / (config.urgency.max - config.urgency.wobbleAt));
      player.camera.rotation.z = Math.sin(this.time * 2.5) * 0.04 * wobble;
    } else {
      input.consumePress('KeyE');
    }

    if (session.isOver && !this.ended) {
      this.ended = true;
      this.hooks.onEnd(session.result!);
    }
    this.hooks.onFrame?.(this);
  }

  dispose(): void {
    this.scene.dispose();
  }
}
