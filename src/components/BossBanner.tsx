import type { BossVariant } from '../game/physics'

interface BossBannerProps {
  active: boolean
  hpFrac: number
  variant: BossVariant | null
}

const RADIUS = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** A pulsing "BOSS FIGHT" banner with a radial health ring, shown at the top
 *  of the board only while a boss is alive. The ring is a plain SVG stroke
 *  (not a 3D element) so it reads crisply regardless of camera angle. The
 *  Kracken variant swaps in its own label and an orange accent class. */
export function BossBanner({ active, hpFrac, variant }: BossBannerProps) {
  if (!active) return null

  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, hpFrac)))
  const isKracken = variant === 'kracken'

  return (
    <div className={`boss-banner${isKracken ? ' boss-banner--kracken' : ''}`}>
      <svg className="boss-banner__ring" viewBox="0 0 36 36" width="30" height="30">
        <circle className="boss-banner__ring-bg" cx="18" cy="18" r={RADIUS} />
        <circle
          className="boss-banner__ring-fg"
          cx="18"
          cy="18"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="boss-banner__label">{isKracken ? 'KRACKEN FIGHT' : 'Boss Fight'}</span>
    </div>
  )
}
