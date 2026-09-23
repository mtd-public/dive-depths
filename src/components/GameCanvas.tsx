import { useEffect, useRef } from 'react'
import { Render2D } from '../game/render2d'
import { RenderTwoTone } from '../game/twoTone/renderTwoTone'
import type { World } from '../game/physics'
import type { GamePhase } from '../game/types'
import type { ArtSettings } from '../hooks/useArtSettings'

interface GameCanvasProps {
  world: { current: World }
  phase: GamePhase
  art: ArtSettings
}

export function GameCanvas({ world, phase, art }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const twoToneRef = useRef<RenderTwoTone | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    // The art style picks the renderer; both share one interface, so
    // physics and the loop below don't care which one is drawing.
    const twoTone = art.art === 'twotone' ? new RenderTwoTone(canvas, { hud: false }) : null
    twoToneRef.current = twoTone
    const scene = twoTone ?? new Render2D(canvas)

    function resize() {
      scene.resize(parent!.clientWidth, parent!.clientHeight)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(parent)

    let raf = 0
    let last = performance.now()
    function frame(ts: number) {
      // See the matching clamp in useGameEngine.ts: rAF timestamps aren't
      // guaranteed monotonic across a dev-mode double-mount or a tab
      // resuming from background, and a negative dt here would animate FX
      // clocks backwards.
      const dt = Math.max(0, Math.min((ts - last) / 1000, 1 / 30))
      last = ts
      scene.update(world.current, phaseRef.current, dt, ts / 1000)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      scene.dispose()
      twoToneRef.current = null
    }
  }, [world, art.art])

  // palette changes are a LUT swap on the live renderer, not a remount
  useEffect(() => {
    const r = twoToneRef.current
    if (!r) return
    r.setPalette(art.palette)
    r.zoneCycle = art.zoneCycle
  }, [art.art, art.palette, art.zoneCycle])

  return <canvas ref={canvasRef} className="game-canvas" />
}
