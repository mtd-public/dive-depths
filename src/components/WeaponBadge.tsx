import { useEffect, useRef } from 'react'
import { BOARD_W } from '../game/physics'
import type { World } from '../game/physics'

interface WeaponBadgeProps {
  world: { current: World }
  shotgunT: number
  laserReady: boolean
  laserActiveT: number
}

/**
 * Follows the sub's x position every frame, the same way GameCanvas reads
 * world.current directly rather than waiting on React state — steering
 * eases continuously, and a badge that only moved on the slower score/lives
 * tick would visibly lag behind the sub it's supposed to sit above.
 */
export function WeaponBadge({ world, shotgunT, laserReady, laserActiveT }: WeaponBadgeProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    function frame() {
      const el = rootRef.current
      if (el) el.style.left = `${(world.current.subX / BOARD_W) * 100}%`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [world])

  if (shotgunT <= 0 && !laserReady && laserActiveT <= 0) return null

  return (
    <div className="weapon-badge" ref={rootRef}>
      {laserActiveT > 0 ? (
        <span className="weapon-badge__row weapon-badge__row--laser">Ultimate firing {laserActiveT}s</span>
      ) : (
        laserReady && <span className="weapon-badge__row weapon-badge__row--laser">Ultimate ready</span>
      )}
      {shotgunT > 0 && <span className="weapon-badge__row weapon-badge__row--shotgun">Shotgun {shotgunT}s</span>}
    </div>
  )
}
