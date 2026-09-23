import type { BossVariant } from './physics'

export type GamePhase = 'ready' | 'playing' | 'paused' | 'over' | 'won'

export interface GameState {
  phase: GamePhase
  score: number
  best: number
  lives: number
  /** Leagues dived (see leaguesForDepth in physics.ts) — holds still for the
   *  duration of a boss fight rather than climbing every frame. */
  distance: number
  /** Leagues at which the next boss fight triggers — drives the boss-distance
   *  gauge on the board's left edge. Steps up by BOSS_INTERVAL_LEAGUES each
   *  time a boss is cleared. */
  nextBossLeagues: number
  /** Seconds left on the shotgun buff, 0 when not active. */
  shotgunT: number
  /** Whether the laser ultimate is charged and ready to fire. */
  laserReady: boolean
  /** Seconds left on an active laser sweep, 0 when it isn't firing. */
  laserActiveT: number
  bossActive: boolean
  /** 0-1 remaining boss health, only meaningful while bossActive. */
  bossHpFrac: number
  /** Which boss is currently active, only meaningful while bossActive. */
  bossVariant: BossVariant | null
}
