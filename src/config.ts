export type CameraMode = 'first' | 'third';

/**
 * Every gameplay number lives here so it can be tuned without touching game logic.
 */
export const config = {
  /** Fixed layout seed for testing. Set to null for a new layout every round. */
  seed: null as number | null,

  mall: {
    gridSize: 10, // cells per side
    cellSize: 8, // metres
    wallHeight: 6,
    extraOpenings: 6, // walls knocked out after the maze is carved, to create loops
    kioskCount: 3,
  },

  player: {
    walkSpeed: 4, // metres per second
    sprintMultiplier: 1.8,
    eyeHeight: 1.7,
    radius: 0.4,
    interactDistance: 2.5, // metres from a toilet door to press E
    mouseSensitivity: 2500, // higher = slower look
  },

  camera: {
    /**
     * 'first' = through the player's eyes. 'third' = a follow camera behind a visible
     * character (waiting on walk animations before it becomes the default).
     */
    mode: 'first' as CameraMode,
    // Third-person settings:
    distance: 4.5, // metres behind the player
    pivotHeight: 2.0, // the point the camera orbits around, above the player's feet
    startPitch: 0.3, // radians, positive looks down
    minPitch: -0.2,
    maxPitch: 1.1,
    wallMargin: 0.3, // keep the camera this far from walls
    fov: 1.0,
  },

  urgency: {
    start: 20, // %
    max: 100,
    baseRate: 0.5, // % per second
    sprintRate: 1, // % per second while sprinting (replaces baseRate)
    foodCourtExtra: 0.5, // % per second extra inside the food court
    bumpPenalty: 2, // % instantly
    closedToiletPenalty: 3, // % instantly
    wobbleAt: 75, // %
    heartbeatAt: 90, // %
  },

  touch: {
    lookSensitivity: 0.006, // radians per pixel dragged
    stickRadius: 55, // pixels the joystick knob can travel
    stickDeadZone: 0.2, // fraction of the radius ignored, so resting thumbs don't walk
    stickZoneWidth: 0.45, // left fraction of the screen that starts the joystick
  },

  audio: {
    volume: 0.8, // master volume, 0–1
    stepInterval: 0.5, // seconds between footsteps when walking
    sprintStepInterval: 0.32,
    urgentStepFactor: 0.75, // footsteps get this much closer together past urgency.wobbleAt
    rumbleAbove: 50, // % urgency where stomach rumbles start
    rumbleMinGap: 5, // seconds
    rumbleMaxGap: 13,
    heartbeatSlowest: 0.9, // seconds between beats at urgency.heartbeatAt
    heartbeatFastest: 0.5, // ... and at 100%
  },

  clench: {
    max: 100,
    drainRate: 20, // points per second while clenching
    refillRate: 5, // points per second while not clenching
  },

  toilets: {
    minDistanceFromSpawn: 30, // metres
  },

  stars: {
    threeUnder: 60, // seconds
    twoUnder: 120,
  },
} as const;

export type Config = typeof config;
