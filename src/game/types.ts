export type GamePhase = 'ready' | 'playing' | 'paused' | 'over'

export interface GameState {
  phase: GamePhase
  score: number
  best: number
  lives: number
  depthLevel: number
  /** Seconds left on the shotgun buff, 0 when not active. */
  shotgunT: number
  /** Whether the laser ultimate is charged and ready to fire. */
  laserReady: boolean
  /** Seconds left on an active laser sweep, 0 when it isn't firing. */
  laserActiveT: number
}
