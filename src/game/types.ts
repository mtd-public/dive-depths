export type GamePhase = 'ready' | 'playing' | 'paused' | 'over'

export interface GameState {
  phase: GamePhase
  score: number
  best: number
  lives: number
  /** Meters dived (see metersForDepth in physics.ts) — holds still for the
   *  duration of a boss fight rather than climbing every frame. */
  distance: number
  /** Seconds left on the shotgun buff, 0 when not active. */
  shotgunT: number
  /** Whether the laser ultimate is charged and ready to fire. */
  laserReady: boolean
  /** Seconds left on an active laser sweep, 0 when it isn't firing. */
  laserActiveT: number
  bossActive: boolean
  /** 0-1 remaining boss health, only meaningful while bossActive. */
  bossHpFrac: number
}
