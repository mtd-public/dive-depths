import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { GameState } from './types'
import { createWorld, LIVES_MAX, score, steerLeft, steerRight, step, type World } from './physics'

const BEST_KEY = 'dive-depths-best'

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

function depthLevelFor(depth: number) {
  return Math.floor(depth / 500) + 1
}

function initialState(): GameState {
  return { phase: 'ready', score: 0, best: loadBest(), lives: LIVES_MAX, depthLevel: 1, shotgunT: 0, laserReady: false }
}

type Action =
  | { type: 'START' }
  | { type: 'PAUSE_TOGGLE' }
  | { type: 'TICK'; score: number; lives: number; depthLevel: number; shotgunT: number; laserReady: boolean }
  | { type: 'GAME_OVER'; score: number }
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
            depthLevel: action.depthLevel,
            shotgunT: action.shotgunT,
            laserReady: action.laserReady,
          }
        : state

    case 'GAME_OVER': {
      const best = Math.max(state.best, action.score)
      if (best > state.best) saveBest(best)
      return { ...state, phase: 'over', score: action.score, lives: 0, shotgunT: 0, laserReady: false, best }
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
  const worldRef = useRef<World>(createWorld())
  const inputRef = useRef({ fire: false })
  const phaseRef = useRef(state.phase)
  const lastTickRef = useRef({ score: 0, lives: LIVES_MAX, depthLevel: 1, shotgunT: 0, laserReady: false })
  phaseRef.current = state.phase

  const doSteerLeft = useCallback(() => {
    if (phaseRef.current === 'playing') steerLeft(worldRef.current)
  }, [])

  const doSteerRight = useCallback(() => {
    if (phaseRef.current === 'playing') steerRight(worldRef.current)
  }, [])

  const fire = useCallback(() => {
    if (phaseRef.current === 'playing') inputRef.current.fire = true
  }, [])

  const start = useCallback(() => dispatch({ type: 'START' }), [])
  const togglePause = useCallback(() => dispatch({ type: 'PAUSE_TOGGLE' }), [])
  const newGame = useCallback(() => {
    worldRef.current = createWorld()
    lastTickRef.current = { score: 0, lives: LIVES_MAX, depthLevel: 1, shotgunT: 0, laserReady: false }
    dispatch({ type: 'NEW_GAME' })
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    function frame(ts: number) {
      const dt = Math.min((ts - last) / 1000, 1 / 30)
      last = ts

      if (phaseRef.current === 'playing') {
        const world = worldRef.current
        step(world, dt, inputRef.current)
        inputRef.current.fire = false

        if (world.collided) {
          dispatch({ type: 'GAME_OVER', score: score(world) })
        } else {
          const next = {
            score: score(world),
            lives: world.lives,
            depthLevel: depthLevelFor(world.depth),
            shotgunT: world.weaponMode === 'shotgun' ? Math.ceil(world.weaponModeT) : 0,
            laserReady: world.laserCharges > 0,
          }
          const prev = lastTickRef.current
          if (
            next.score !== prev.score ||
            next.lives !== prev.lives ||
            next.depthLevel !== prev.depthLevel ||
            next.shotgunT !== prev.shotgunT ||
            next.laserReady !== prev.laserReady
          ) {
            lastTickRef.current = next
            dispatch({ type: 'TICK', ...next })
          }
        }
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

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

  return { state, world: worldRef, steerLeft: doSteerLeft, steerRight: doSteerRight, fire, start, togglePause, newGame }
}
