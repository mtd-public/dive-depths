export type GamePhase = 'ready' | 'playing' | 'paused' | 'over'

export interface GameState {
  phase: GamePhase
  score: number
  best: number
  lives: number
  depthLevel: number
}
