import { GameCanvas } from './components/GameCanvas'
import { GameOverlay } from './components/GameOverlay'
import { KeyboardHelp } from './components/KeyboardHelp'
import { StatsSidebar } from './components/StatsSidebar'
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
            <span className="depth-badge__label">Depth</span>
            <span className="depth-badge__value">{state.depthLevel}</span>
          </div>
          {(state.shotgunT > 0 || state.laserReady || state.laserActiveT > 0) && (
            <div className="weapon-badge">
              {state.laserActiveT > 0 ? (
                <span className="weapon-badge__row weapon-badge__row--laser">Ultimate firing {state.laserActiveT}s</span>
              ) : (
                state.laserReady && <span className="weapon-badge__row weapon-badge__row--laser">Ultimate ready</span>
              )}
              {state.shotgunT > 0 && (
                <span className="weapon-badge__row weapon-badge__row--shotgun">Shotgun {state.shotgunT}s</span>
              )}
            </div>
          )}
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
