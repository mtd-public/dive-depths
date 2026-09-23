import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { GameState } from './types'
import {
  ACHIEVEMENTS,
  LASER_MARATHON_SECONDS,
  PACIFISM_LEAGUES,
  SHOTGUN_SHAKEDOWN_SECONDS,
  loadUnlocked,
  unlock,
  type Achievement,
  type AchievementId,
} from './achievements'
import {
  BOSS_INTERVAL_LEAGUES,
  createWorld,
  depthForLeagues,
  LIVES_MAX,
  leaguesForDepth,
  score,
  steerLeft,
  steerRight,
  step,
  type BossVariant,
  type World,
} from './physics'
import { WATER_CYCLE_LEAGUES } from './pixelArt'

const BEST_KEY = 'dive-depths-best'

export interface AchievementToast {
  key: number
  achievement: Achievement
}

const TOAST_LIFETIME_MS = 4500

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function saveBest(best: number) {
  try {
    localStorage.setItem(BEST_KEY, String(best))
  } catch {
    // storage unavailable (private mode, quota) — best just won't persist
  }
}

/** A fresh world for the title screen's self-playing demo, seeded a couple
 *  of water zones in (blue or purple, picked at random) rather than the
 *  shallow green opening every real dive starts at — makes the attract-mode
 *  background more visually interesting on load. `nextBossLeagues` is pushed
 *  out from that seeded depth so the demo doesn't walk straight into a boss
 *  fight moments after spawning. */
function createDemoWorld(): World {
  const world = createWorld()
  const zone = 1 + Math.floor(Math.random() * 2) // 1 (blue) or 2 (purple)
  const leagues = zone * WATER_CYCLE_LEAGUES + Math.floor(Math.random() * WATER_CYCLE_LEAGUES * 0.5)
  world.depth = depthForLeagues(leagues)
  world.nextBossLeagues = leagues + BOSS_INTERVAL_LEAGUES
  return world
}

function initialState(): GameState {
  return {
    phase: 'ready',
    score: 0,
    best: loadBest(),
    lives: LIVES_MAX,
    distance: 0,
    nextBossLeagues: BOSS_INTERVAL_LEAGUES,
    shotgunT: 0,
    laserReady: false,
    laserActiveT: 0,
    bossActive: false,
    bossHpFrac: 0,
    bossVariant: null,
  }
}

type Action =
  | { type: 'START' }
  | { type: 'PAUSE_TOGGLE' }
  | {
      type: 'TICK'
      score: number
      lives: number
      distance: number
      nextBossLeagues: number
      shotgunT: number
      laserReady: boolean
      laserActiveT: number
      bossActive: boolean
      bossHpFrac: number
      bossVariant: BossVariant | null
    }
  | { type: 'GAME_OVER'; score: number }
  | { type: 'GAME_WON'; score: number }
  | { type: 'NEW_GAME' }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START':
      return state.phase === 'ready' ? { ...state, phase: 'playing' } : state

    case 'PAUSE_TOGGLE':
      if (state.phase === 'playing') return { ...state, phase: 'paused' }
      if (state.phase === 'paused') return { ...state, phase: 'playing' }
      return state

    case 'TICK':
      return state.phase === 'playing'
        ? {
            ...state,
            score: action.score,
            lives: action.lives,
            distance: action.distance,
            nextBossLeagues: action.nextBossLeagues,
            shotgunT: action.shotgunT,
            laserReady: action.laserReady,
            laserActiveT: action.laserActiveT,
            bossActive: action.bossActive,
            bossHpFrac: action.bossHpFrac,
            bossVariant: action.bossVariant,
          }
        : state

    case 'GAME_OVER': {
      const best = Math.max(state.best, action.score)
      if (best > state.best) saveBest(best)
      return {
        ...state,
        phase: 'over',
        score: action.score,
        lives: 0,
        shotgunT: 0,
        laserReady: false,
        laserActiveT: 0,
        bossActive: false,
        bossHpFrac: 0,
        bossVariant: null,
        best,
      }
    }

    case 'GAME_WON': {
      const best = Math.max(state.best, action.score)
      if (best > state.best) saveBest(best)
      return {
        ...state,
        phase: 'won',
        score: action.score,
        shotgunT: 0,
        laserReady: false,
        laserActiveT: 0,
        bossActive: false,
        bossHpFrac: 0,
        bossVariant: null,
        best,
      }
    }

    case 'NEW_GAME':
      return { ...initialState(), best: state.best, phase: 'playing' }

    default:
      return state
  }
}

/**
 * Drives the submarine: a requestAnimationFrame loop steps the mutable
 * physics world every frame (kept in a ref, not React state, so 60fps motion
 * never triggers a re-render) and syncs the reducer only when score/lives/
 * depth actually change, which is what the HUD reads. Steering and firing
 * are discrete actions (steerLeft/steerRight/fire), not held state — the
 * same shape whether they come from a keydown or a tap/swipe gesture.
 */
export function useGameEngine() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const worldRef = useRef<World>(createDemoWorld())
  const inputRef = useRef({ fire: false })
  const phaseRef = useRef(state.phase)
  const lastTickRef = useRef({
    score: 0,
    lives: LIVES_MAX,
    distance: 0,
    nextBossLeagues: BOSS_INTERVAL_LEAGUES,
    shotgunT: 0,
    laserReady: false,
    laserActiveT: 0,
    bossActive: false,
    bossHpFrac: 0,
    bossVariant: null as BossVariant | null,
  })
  phaseRef.current = state.phase

  const demoSteerTimerRef = useRef(0)

  const unlockedRef = useRef<Set<AchievementId>>(loadUnlocked())
  const [unlockedAchievements, setUnlockedAchievements] = useState(unlockedRef.current)
  const [achievementToasts, setAchievementToasts] = useState<AchievementToast[]>([])
  const toastKeyRef = useRef(0)

  const announceUnlock = useCallback((id: AchievementId) => {
    if (!unlock(unlockedRef.current, id)) return
    setUnlockedAchievements(new Set(unlockedRef.current))
    const achievement = ACHIEVEMENTS.find((a) => a.id === id)
    if (!achievement) return
    const key = toastKeyRef.current++
    setAchievementToasts((toasts) => [...toasts, { key, achievement }])
    setTimeout(() => {
      setAchievementToasts((toasts) => toasts.filter((t) => t.key !== key))
    }, TOAST_LIFETIME_MS)
  }, [])

  const dismissToast = useCallback((key: number) => {
    setAchievementToasts((toasts) => toasts.filter((t) => t.key !== key))
  }, [])

  const doSteerLeft = useCallback(() => {
    if (phaseRef.current === 'playing') steerLeft(worldRef.current)
  }, [])

  const doSteerRight = useCallback(() => {
    if (phaseRef.current === 'playing') steerRight(worldRef.current)
  }, [])

  const fire = useCallback(() => {
    if (phaseRef.current === 'playing') inputRef.current.fire = true
  }, [])

  const start = useCallback(() => {
    // the title screen's self-playing demo has been stepping worldRef since
    // mount — start the real game from a clean slate, not wherever the
    // demo's AI happened to leave off
    worldRef.current = createWorld()
    dispatch({ type: 'START' })
  }, [])
  const togglePause = useCallback(() => dispatch({ type: 'PAUSE_TOGGLE' }), [])
  const newGame = useCallback(() => {
    worldRef.current = createWorld()
    lastTickRef.current = {
      score: 0,
      lives: LIVES_MAX,
      distance: 0,
      nextBossLeagues: BOSS_INTERVAL_LEAGUES,
      shotgunT: 0,
      laserReady: false,
      laserActiveT: 0,
      bossActive: false,
      bossHpFrac: 0,
      bossVariant: null,
    }
    dispatch({ type: 'NEW_GAME' })
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    function frame(ts: number) {
      // Clamped below at 0, not just above: rAF timestamps are usually
      // monotonic, but a dev-only double-mount (React StrictMode) or a
      // backgrounded-tab resume can hand the callback an earlier `ts` than
      // the `last` this closure already recorded, producing a negative dt
      // that would tick world.elapsed/depth backwards — which is exactly
      // what fed a negative "leagues" into the water-zone lookup once.
      const dt = Math.max(0, Math.min((ts - last) / 1000, 1 / 30))
      last = ts

      if (phaseRef.current === 'playing') {
        const world = worldRef.current
        step(world, dt, inputRef.current)
        inputRef.current.fire = false

        if (world.gameWon) announceUnlock('krackenSlayer')
        if (world.pacifist && leaguesForDepth(world.depth) >= PACIFISM_LEAGUES) announceUnlock('pacifism')
        if (world.laserActiveTotal >= LASER_MARATHON_SECONDS) announceUnlock('laserMarathon')
        if (world.shotgunActiveTotal >= SHOTGUN_SHAKEDOWN_SECONDS) announceUnlock('shotgunShakedown')

        if (world.collided) {
          dispatch({ type: 'GAME_OVER', score: score(world) })
        } else if (world.gameWon) {
          dispatch({ type: 'GAME_WON', score: score(world) })
        } else {
          const next = {
            score: score(world),
            lives: world.lives,
            distance: leaguesForDepth(world.depth),
            nextBossLeagues: world.nextBossLeagues,
            shotgunT: world.weaponMode === 'shotgun' ? Math.ceil(world.weaponModeT) : 0,
            laserReady: world.laserCharges > 0,
            laserActiveT: world.laserT > 0 ? Math.ceil(world.laserT) : 0,
            bossActive: world.boss !== null,
            bossHpFrac: world.boss ? world.boss.hp / world.boss.maxHp : 0,
            bossVariant: world.boss ? world.boss.variant : null,
          }
          const prev = lastTickRef.current
          if (
            next.score !== prev.score ||
            next.lives !== prev.lives ||
            next.distance !== prev.distance ||
            next.nextBossLeagues !== prev.nextBossLeagues ||
            next.shotgunT !== prev.shotgunT ||
            next.laserReady !== prev.laserReady ||
            next.laserActiveT !== prev.laserActiveT ||
            next.bossActive !== prev.bossActive ||
            next.bossHpFrac !== prev.bossHpFrac ||
            next.bossVariant !== prev.bossVariant
          ) {
            lastTickRef.current = next
            dispatch({ type: 'TICK', ...next })
          }
        }
      } else if (phaseRef.current === 'ready') {
        // title screen attract mode: a simple wandering-and-firing AI keeps
        // the board self-playing behind the "Press start" card. It runs on
        // the same worldRef the real game uses, but `start()` resets that
        // ref fresh, so the demo never bleeds into the player's own run.
        const world = worldRef.current
        demoSteerTimerRef.current -= dt
        if (demoSteerTimerRef.current <= 0) {
          demoSteerTimerRef.current = 0.7 + Math.random() * 1.1
          if (Math.random() < 0.5) steerLeft(world)
          else steerRight(world)
        }
        step(world, dt, { fire: true })
        if (world.collided || world.gameWon) {
          worldRef.current = createDemoWorld()
          demoSteerTimerRef.current = 0
        }
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [announceUnlock])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          event.preventDefault()
          doSteerLeft()
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          event.preventDefault()
          doSteerRight()
          break
        case ' ':
        case 'ArrowUp':
          event.preventDefault()
          if (phaseRef.current === 'ready') start()
          else fire()
          break
        case 'p':
        case 'P':
          togglePause()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doSteerLeft, doSteerRight, fire, start, togglePause])

  return {
    state,
    world: worldRef,
    steerLeft: doSteerLeft,
    steerRight: doSteerRight,
    fire,
    start,
    togglePause,
    newGame,
    unlockedAchievements,
    achievementToasts,
    dismissToast,
  }
}
