import { BossBanner } from './components/BossBanner'
import { GameCanvas } from './components/GameCanvas'
import { GameOverlay } from './components/GameOverlay'
import { KeyboardHelp } from './components/KeyboardHelp'
import { StatsSidebar } from './components/StatsSidebar'
import { WeaponBadge } from './components/WeaponBadge'
import { useGameEngine } from './game/useGameEngine'
import { useBoardControls } from './hooks/useBoardControls'

export default function App() {
  const { state, world, steerLeft, steerRight, fire, start, togglePause, newGame } = useGameEngine()
  const controls = useBoardControls({ onSwipeLeft: steerLeft, onSwipeRight: steerRight, onTap: fire })

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="wordmark">Dive Depths</h1>
        <div className="topbar__stats">
          <span className="topbar__stat">
            <span className="stat__label">Score</span> {state.score.toLocaleString()}
          </span>
          <span className="topbar__stat">
            <span className="stat__label">Lives</span> {state.lives}
          </span>
        </div>
        <div className="topbar__actions">
          <KeyboardHelp />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={togglePause}
            disabled={state.phase !== 'playing' && state.phase !== 'paused'}
          >
            {state.phase === 'paused' ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="board-shell" {...controls}>
          <GameCanvas world={world} phase={state.phase} />
          <div className="depth-badge">
            <span className="depth-badge__label">Distance</span>
            <span className="depth-badge__value">{state.distance}L</span>
          </div>
          <BossBanner active={state.bossActive} hpFrac={state.bossHpFrac} variant={state.bossVariant} />
          <WeaponBadge
            world={world}
            shotgunT={state.shotgunT}
            laserReady={state.laserReady}
            laserActiveT={state.laserActiveT}
          />
          <GameOverlay
            phase={state.phase}
            score={state.score}
            best={state.best}
            onStart={start}
            onResume={togglePause}
            onNewGame={newGame}
          />
        </div>

        <StatsSidebar state={state} />
      </main>
    </div>
  )
}
