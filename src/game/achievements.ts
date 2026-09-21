export type AchievementId = 'krackenSlayer' | 'pacifism' | 'laserMarathon' | 'shotgunShakedown'

export interface Achievement {
  id: AchievementId
  title: string
  description: string
}

/** The leagues target for the Pacifism achievement — kept in sync with the
 *  in-game copy rather than importing KRACKEN_LEAGUES-style constants from
 *  physics.ts, since this module has no other dependency on it. */
export const PACIFISM_LEAGUES = 10000
/** Cumulative seconds of laser-ultimate uptime for the laser achievement. */
export const LASER_MARATHON_SECONDS = 25
/** Cumulative seconds of shotgun uptime for the shotgun achievement. */
export const SHOTGUN_SHAKEDOWN_SECONDS = 15

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'krackenSlayer',
    title: 'Kracken Slayer',
    description: 'Defeat the Kracken.',
  },
  {
    id: 'pacifism',
    title: 'Pacifism',
    description: `Reach ${PACIFISM_LEAGUES.toLocaleString()} leagues without shooting anything but a boss or its mines.`,
  },
  {
    id: 'laserMarathon',
    title: 'Laser Marathon',
    description: `Keep the laser ultimate firing for ${LASER_MARATHON_SECONDS} cumulative seconds in one dive.`,
  },
  {
    id: 'shotgunShakedown',
    title: 'Shotgun Shakedown',
    description: `Keep the shotgun spread active for ${SHOTGUN_SHAKEDOWN_SECONDS} cumulative seconds in one dive.`,
  },
]

const STORAGE_KEY = 'dive-depths-achievements'

/** Reads unlocked achievement ids from localStorage, dropping anything that
 *  isn't (or no longer is) a real achievement id. */
export function loadUnlocked(): Set<AchievementId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    const known = new Set(ACHIEVEMENTS.map((a) => a.id))
    return new Set(parsed.filter((id): id is AchievementId => known.has(id as AchievementId)))
  } catch {
    return new Set()
  }
}

function saveUnlocked(ids: Set<AchievementId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // storage unavailable (private mode, quota) — unlocks just won't persist
  }
}

/** Marks `id` unlocked in `unlocked` (mutated in place) and persists it.
 *  Returns true the first time — false on every call after, so callers can
 *  tell whether to show an unlock toast without tracking that separately. */
export function unlock(unlocked: Set<AchievementId>, id: AchievementId): boolean {
  if (unlocked.has(id)) return false
  unlocked.add(id)
  saveUnlocked(unlocked)
  return true
}
