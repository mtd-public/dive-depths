import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const SWIPE_PX = 28

interface Handlers {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  onTap: () => void
}

/**
 * Board gestures, split by what the press does rather than where it lands.
 *
 * A swipe fires the moment it passes threshold rather than on release: at
 * speed, waiting for pointerup is a hit. The origin resets after each one so
 * a long drag can cross several steps.
 *
 * A press that never swipes is a tap — anywhere on the board — and fires.
 * Steering is swipe-only now, so a tap has nothing left to disambiguate by
 * position; it's always the shot.
 */
export function useBoardControls({ onSwipeLeft, onSwipeRight, onTap }: Handlers) {
  const origin = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  function onPointerDown(event: ReactPointerEvent) {
    origin.current = { x: event.clientX, y: event.clientY }
    swiped.current = false
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (!origin.current) return
    const dx = event.clientX - origin.current.x
    const dy = event.clientY - origin.current.y
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) onSwipeLeft()
    else onSwipeRight()
    swiped.current = true
    origin.current = { x: event.clientX, y: event.clientY }
  }

  function onPointerUp() {
    if (origin.current && !swiped.current) onTap()
    origin.current = null
  }

  function onPointerCancel() {
    origin.current = null
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
