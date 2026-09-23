import { Achievements } from './components/Achievements'
import { AchievementToasts } from './components/AchievementToasts'
import { BossBanner } from './components/BossBanner'
import { BossGauge } from './components/BossGauge'
import { GameCanvas } from './components/GameCanvas'
import { GameOverlay } from './components/GameOverlay'
import { OptionsMenu } from './components/OptionsMenu'
import { StatsSidebar } from './components/StatsSidebar'
import { WeaponBadge } from './components/WeaponBadge'
import { useGameEngine } from './game/useGameEngine'
import { useArtSettings } from './hooks/useArtSettings'
import { useBoardControls } from './hooks/useBoardControls'

export default function App() {
  const {
    state,
    world,
    steerLeft,
    steerRight,
    fire,
    start,
    togglePause,
    newGame,
    unlockedAchievements,
    achievementToasts,
    dismissToast,
  } = useGameEngine()
  const { settings: art, update: updateArt } = useArtSettings()
  const controls = useBoardControls({ onSwipeLeft: steerLeft, onSwipeRight: steerRight, onTap: fire })

  return (
    <div className="app">
      <AchievementToasts toasts={achievementToasts} onDismiss={dismissToast} />
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
          <Achievements unlocked={unlockedAchievements} />
          <OptionsMenu art={art} onChange={updateArt} />
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
          <GameCanvas world={world} phase={state.phase} art={art} />
          <div className="depth-badge">
            <span className="depth-badge__label">Distance</span>
            <span className="depth-badge__value">{state.distance}L</span>
          </div>
          <BossGauge
            distance={state.distance}
            nextBossLeagues={state.nextBossLeagues}
            bossActive={state.bossActive}
          />
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
