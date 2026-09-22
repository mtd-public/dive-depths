import { BOSS_INTERVAL_LEAGUES, KRACKEN_LEAGUES } from '../game/physics'

interface BossGaugeProps {
  /** Leagues dived so far (GameState.distance). */
  distance: number
  /** Leagues at which the next boss triggers (GameState.nextBossLeagues). */
  nextBossLeagues: number
  bossActive: boolean
}

/** Compact league figure for the gauge's narrow labels: 0 → "0L",
 *  850 → "850L", 2500 → "2.5kL", 5000 → "5kL", 12345 → "12.3kL". */
function formatLeagues(leagues: number): string {
  if (leagues < 1000) return `${Math.max(0, Math.round(leagues))}L`
  const k = Math.round(leagues / 100) / 10
  return `${Number.isInteger(k) ? k : k.toFixed(1)}kL`
}

/** A small side-on sub, the gauge's "you are here" marker. */
function SubIcon() {
  return (
    <svg className="boss-gauge__sub" viewBox="0 0 20 12" width="20" height="12" aria-hidden="true">
      <rect x="8" y="1" width="4" height="4" rx="1" />
      <rect x="1" y="4" width="17" height="7" rx="3.5" />
      <rect x="18" y="5" width="2" height="5" rx="1" />
      <circle className="boss-gauge__sub-port" cx="7" cy="7.5" r="1.4" />
      <circle className="boss-gauge__sub-port" cx="12" cy="7.5" r="1.4" />
    </svg>
  )
}

/**
 * A vertical thermometer on the board's left edge tracking the current leg
 * of the dive: the leg's starting distance at the top, the next boss at the
 * bulb on the bottom, and the sub sliding down between them with the
 * leagues left to go. Each leg is one BOSS_INTERVAL_LEAGUES stretch, so
 * once a boss is cleared (nextBossLeagues steps up) the top label jumps to
 * the milestone just taken and the sub resets to the top of the tube.
 */
export function BossGauge({ distance, nextBossLeagues, bossActive }: BossGaugeProps) {
  const legStart = nextBossLeagues - BOSS_INTERVAL_LEAGUES
  const frac = bossActive ? 1 : Math.max(0, Math.min(1, (distance - legStart) / BOSS_INTERVAL_LEAGUES))
  const remaining = Math.max(0, nextBossLeagues - distance)
  const isKracken = nextBossLeagues >= KRACKEN_LEAGUES
  const pct = `${(frac * 100).toFixed(2)}%`

  return (
    <div
      className={`boss-gauge${isKracken ? ' boss-gauge--kracken' : ''}${bossActive ? ' boss-gauge--fight' : ''}`}
      role="img"
      aria-label={
        bossActive
          ? `${isKracken ? 'Kracken' : 'Boss'} fight at ${formatLeagues(nextBossLeagues)}`
          : `${formatLeagues(remaining)} to the next ${isKracken ? 'Kracken' : 'boss'}`
      }
    >
      <span className="boss-gauge__start">{formatLeagues(legStart)}</span>
      <div className="boss-gauge__tube">
        <div className="boss-gauge__fill" style={{ height: pct }} />
        <div className="boss-gauge__marker" style={{ top: pct }}>
          <SubIcon />
          <span className="boss-gauge__to-go">{bossActive ? 'FIGHT!' : `-${formatLeagues(remaining)}`}</span>
        </div>
      </div>
      <div className="boss-gauge__bulb" />
      <span className="boss-gauge__boss">{isKracken ? 'KRACKEN' : 'BOSS'}</span>
      <span className="boss-gauge__boss-at">{formatLeagues(nextBossLeagues)}</span>
    </div>
  )
}
