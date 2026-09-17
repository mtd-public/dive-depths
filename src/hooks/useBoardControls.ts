import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const SWIPE_PX = 28

interface Handlers {
  onLeft: () => void
  onRight: () => void
}

/**
 * Board gestures, in two flavours that answer the same question — which way.
 *
 * A swipe fires the moment it passes threshold rather than on release: at
 * speed, waiting for pointerup is a hit. The origin resets after each one so
 * a long drag can cross several steps.
 *
 * A press that never swipes is a tap, and the side of the board it lands on
 * picks the direction — the half the thumb is already over. Firing moved to
 * its own button when the tap took this job, so nothing is overloaded.
 */
export function useBoardControls({ onLeft, onRight }: Handlers) {
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
    if (dx < 0) onLeft()
    else onRight()
    swiped.current = true
    origin.current = { x: event.clientX, y: event.clientY }
  }

  function onPointerUp(event: ReactPointerEvent) {
    if (origin.current && !swiped.current) {
      // Measured against the board, not the window, so the pillarboxed
      // landscape layout splits down the middle of the play area.
      const board = event.currentTarget.getBoundingClientRect()
      if (event.clientX < board.left + board.width / 2) onLeft()
      else onRight()
    }
    origin.current = null
  }

  function onPointerCancel() {
    origin.current = null
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
