// Logical coordinate space the game simulates in; GameCanvas scales this to
// whatever size the board actually renders at. y follows plain screen
// convention (0 at the top, increasing downward) — the submarine sits near
// the top at a small y, threats spawn at large y (off the bottom) and
// scroll toward smaller y as they rise to meet it.
export const BOARD_W = 400
export const BOARD_H = 800

export const SUB_Y = BOARD_H * 0.22
// The sub's overall body — steering bounds, missile spawn point and
// power-up pickup range all still key off this. Halved along with the
// visual model (see SUB_VISUAL_SCALE in scene3d.ts) so the invisible
// bounds actually match the now much smaller hull.
export const SUB_R = 10

// The player's actual damage hitbox is much smaller than the body and
// offset toward the bottom of the model — only this small box registers a
// hazard hit; ramming a threat with the rest of the (now mostly cosmetic)
// hull no longer costs a life. SUB_R above still governs everything that
// isn't about taking damage.
export const HIT_R = 4
export const HIT_OFFSET_Y = 8

// Steering: a discrete step-and-ease model (prof-whip-dash's lane-switch
// smoothing), not splashy-fish's current-and-splash velocity model — each
// steerLeft/steerRight call nudges the *target*, and subX eases toward it
// every frame. There's no fixed lane grid: the target moves by STEP in
// continuous board space, so threat placement stays free-form.
const STEP = 76
const STEP_TIME = 0.16

export const LIVES_MAX = 8
const INVINCIBLE_TIME = 1.5

const FIRE_COOLDOWN = 0.35
const MISSILE_SPEED = 620
const MISSILE_R = 8

const PROJECTILE_SPEED = 260
const PROJECTILE_R = 7
const SUB_FIRE_MIN = 1.6
const SUB_FIRE_MAX = 3.2

// Mines no longer wait to be bumped into: once one closes to within this
// many units of the sub's row it auto-detonates and sprays shrapnel in an
// 8-way ring — a proximity fuse, not a contact fuse. Shooting one first is a
// clean kill (points, no shrapnel); letting it get close is the risk.
export const MINE_FUSE_RANGE = 230
const MINE_BULLET_SPEED = 190
const MINE_BULLET_R = 6
const MINE_BULLET_COUNT = 8

// Tentacles reach in from one wall only — like splashy-fish's obstacle bands,
// but one-sided, so there's always clear water on the other edge to dodge
// into rather than a gap to thread. Kept short: it's a hazard to steer
// around, not a wall that eats most of the board.
export const TENTACLE_THICKNESS = 90
const TENTACLE_REACH_MIN = BOARD_W * 0.32
const TENTACLE_REACH_MAX = BOARD_W * 0.48

// A mine wall: a short chain of mines bolted to one side wall by a mooring
// line, unlike free mines they carry no proximity fuse at all — they just
// hang there swaying gently until a missile or the sub's own hull sets one
// off. Terrain you can leave alone, not a ticking clock like MINE_FUSE_RANGE.
const MINE_WALL_COUNT_MIN = 2
const MINE_WALL_COUNT_MAX = 4
const MINE_WALL_INSET = 34
const MINE_WALL_SPACING = 46

const POWERUP_R = 16
const POWERUP_SPACING = 950
const SHOTGUN_DURATION = 9
const SHOTGUN_MISSILE_COUNT = 5
const SHOTGUN_SPREAD_VX = 240
// The ultimate: a sustained beam, not an instant flash — once triggered it
// tracks the sub's x every frame and keeps sweeping for its full duration,
// so the player can steer it across the board rather than committing to one
// spot. Twice the width of a first pass at this (50% of the board, not 25%).
export const LASER_DURATION = 5
const LASER_COOLDOWN = 0.6
export const LASER_HALF_WIDTH = BOARD_W * 0.5 * 0.5

// Slowed by a third from the original 170/360 pace — gives the player more
// time to read and dodge incoming threats without changing anything else
// about how spawns or difficulty scale.
const BASE_SCROLL_SPEED = 113
const MAX_SCROLL_SPEED = 240
const SPEED_GAIN_PER_DEPTH = 0.012
// A range, not one fixed number — re-rolled after every spawn (see
// randomSpawnGap) so the distance between placements varies run to run
// instead of arriving on a metronome, leaving room to maneuver and shoot
// around whatever just spawned before the next thing does.
const SPAWN_SPACING_MIN = 190
const SPAWN_SPACING_MAX = 330
const SPAWN_MARGIN = 220
const CULL_MARGIN = 200
const THREAT_MARGIN = 30

// Formations: a diagonal chain of same-type threats, spaced so the whole
// line is visible on screen at once — Galaga/Galaxian-style, adapted for a
// vertical scroller. They scroll at the same shared speed as everything
// else, so the diagonal shape holds as the formation rises; the player has
// to either clear members with missiles or steer around the line.
const FORMATION_COUNT_MIN = 3
const FORMATION_COUNT_MAX = 4
const FORMATION_DX = 50
const FORMATION_DY = 60

// Boss encounters: `depth` already drives difficulty scaling and climbs by
// a couple hundred units a second, so a milestone counted directly in that
// unit would fire every few seconds. `leaguesForDepth` rescales it into a
// much coarser "distance" purely for pacing the boss cadence and for the
// number the player sees — a few minutes of normal diving between fights.
// An integer divisor, not a 0.1 multiplier — dividing by 10 keeps the
// post-boss depth reset (below) exact, where multiplying by a fractional
// 0.1 constant would round-trip through floating-point error and land the
// "distance" a league short of where cleared + 1 should put it.
const DEPTH_PER_LEAGUE = 10
export const BOSS_INTERVAL_LEAGUES = 2500
export function leaguesForDepth(depth: number): number {
  return Math.floor(depth / DEPTH_PER_LEAGUE)
}
/** Inverse of leaguesForDepth — lets a caller seed `depth` from a leagues
 *  figure directly (the title screen's self-playing demo uses this to
 *  start a few water zones in rather than at the shallow green opening). */
export function depthForLeagues(leagues: number): number {
  return leagues * DEPTH_PER_LEAGUE
}

// The Kracken: a special orange variant of the boss, guaranteed at 20,000
// leagues and on every boss encounter past it — a much tougher, richer
// encounter than a normal fight, and the game's win condition rather than
// just another milestone. This shortcut swapped it into the very first
// boss fight for early testing; now that the real encounter is verified,
// it's off, so only the genuine 20,000-league milestone triggers it.
export const KRACKEN_TEST_AS_FIRST_BOSS = false
export const KRACKEN_LEAGUES = 20000
const KRACKEN_HP = 40
const KRACKEN_KILL_POINTS = 1000

// The boss holds low on the board — a vast, mostly-submerged creature
// rather than something that swims up to meet the sub — anchored close to
// the bottom edge of the board so it reads as looming up from underneath
// on a tall portrait viewport (the renderer draws the whole board, no
// camera crop, so this fraction of BOARD_H is exactly where it sits on
// screen). Its mine squads spawn separately, from the same edge every
// other threat does, so they still cross the same distance (and get the
// same proximity-fuse warning) as a normal mine, regardless of where the
// boss itself sits.
const BOSS_Y = BOARD_H * 0.81
const BOSS_ENTER_SPEED = 140
export const BOSS_R = 50
const BOSS_HP_MIN = 15
const BOSS_HP_MAX = 20
const BOSS_KILL_POINTS = 300
// Longer gap between volleys, fewer/wider-spaced barrels per squad, and
// fewer columns — earlier tuning packed the board too solid to dodge
// through; this leaves real gaps between mines and real breathing room
// between volleys instead of a near-constant wall.
const BOSS_ATTACK_MIN = 3.6
const BOSS_ATTACK_MAX = 5.5
export const BOSS_MOUTH_OPEN_TIME = 0.5
export const BOSS_EXPLODE_TIME = 1.4
// Barrel formations are laid out on a fixed grid, one shape picked per
// squad rather than always the same flat block — see spawnBossMineSquad.
const BOSS_MINE_GRID_COLS = 5
const BOSS_MINE_GRID_ROWS = 5
const BOSS_MINE_COL_SPACING = 78
const BOSS_MINE_ROW_SPACING = 90

// The Kracken fight throws the player a lot more of a lifeline than a
// normal boss does — the fight is longer (40 hp vs 15-20) and otherwise
// suppresses power-up spawning entirely like any boss, so it spawns its
// own steady drip of pickups on a short timer instead.
const KRACKEN_POWERUP_MIN = 2.5
const KRACKEN_POWERUP_MAX = 4

export type BossPhase = 'entering' | 'fighting' | 'exploding'
export type BossVariant = 'normal' | 'kracken'

export interface Boss {
  id: number
  x: number
  y: number
  hp: number
  maxHp: number
  phase: BossPhase
  phaseT: number
  attackIn: number
  /** Counts down from BOSS_MOUTH_OPEN_TIME whenever it just spat a squad —
   *  purely a visual telegraph for the scene to animate the jaw with. */
  mouthOpenT: number
  variant: BossVariant
  /** Kracken only: counts down to the next bonus power-up spawn. */
  powerupIn: number
}

export type ThreatType = 'fish' | 'monster' | 'sub' | 'mine' | 'tentacle' | 'mineWall' | 'redFish' | 'squid'

interface ThreatSpec {
  r: number
  points: number
  wander: number
  /** Vertical counterpart to `wander` — a squid's own bob amplitude, layered
   *  on top of the normal scroll rather than replacing it. Zero for every
   *  other type, which just scrolls straight up. */
  vwander: number
}

const THREAT_SPEC: Record<ThreatType, ThreatSpec> = {
  fish: { r: 16, points: 5, wander: 34, vwander: 0 },
  monster: { r: 25, points: 12, wander: 20, vwander: 0 },
  sub: { r: 22, points: 18, wander: 0, vwander: 0 },
  mine: { r: 20, points: 25, wander: 0, vwander: 0 },
  // Not a point hazard — collision uses `side`/`reach` instead of `r`, and
  // it's only ever destroyed by the laser ultimate, hence the points value.
  tentacle: { r: 0, points: 20, wander: 0, vwander: 0 },
  // A moored mine: same blast as a free mine, but bolted in place (wander 0)
  // and — critically — never entered into detonateFusedMines below, so it
  // only ever goes off from a direct hit.
  mineWall: { r: 20, points: 25, wander: 0, vwander: 0 },
  // Holds its row: scroll carries it upward like anything else, but its own
  // motion is a wide horizontal patrol rather than the timid fish wander.
  redFish: { r: 14, points: 8, wander: 60, vwander: 0 },
  // Holds its column instead — no x wander at all, but a real vertical bob
  // layered on the scroll (see `baseY` below), so it patrols up/down within
  // its lane rather than drifting sideways.
  squid: { r: 15, points: 10, wander: 0, vwander: 56 },
}

export interface Threat {
  id: number
  type: ThreatType
  x: number
  baseX: number
  y: number
  phase: number
  fireIn: number
  /** Tentacle and mineWall only: which wall they're anchored to. Tentacle
   *  also uses `reach` for how far across it extends. */
  side?: 'left' | 'right'
  reach?: number
  /** Squid only: the scroll-carried anchor its vwander bob is centered on —
   *  y itself is recomputed from this every frame, the same relationship
   *  baseX has to x for the horizontal wander types. */
  baseY?: number
}

export interface Missile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
}

export interface Projectile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  /** Distinguishes an enemy sub's column fire from a detonated mine's
   *  omnidirectional shrapnel, so the scene can render them differently. */
  kind: 'sub' | 'mine'
}

export type PowerupType = 'shotgun' | 'laser' | 'health' | 'extraLife'

export interface Powerup {
  id: number
  type: PowerupType
  x: number
  y: number
}

export type EffectKind = 'hit' | 'kill' | 'blast' | 'pickup'

export interface Effect {
  x: number
  y: number
  kind: EffectKind
}

export type WeaponMode = 'normal' | 'shotgun'

export interface World {
  subX: number
  subTargetX: number
  invincibleT: number
  lives: number
  threats: Threat[]
  missiles: Missile[]
  projectiles: Projectile[]
  powerups: Powerup[]
  weaponMode: WeaponMode
  weaponModeT: number
  laserCharges: number
  laserT: number
  laserX: number
  fireCooldown: number
  spawnAccumulator: number
  /** Rolled distance the next spawn arrives at — see randomSpawnGap. */
  spawnGap: number
  powerupAccumulator: number
  nextId: number
  killPoints: number
  depth: number
  elapsed: number
  collided: boolean
  /** Set once the Kracken is defeated — freezes step() like `collided` does,
   *  but drives a win screen instead of a game-over one. */
  gameWon: boolean
  boss: Boss | null
  /** How many boss fights have started this run — used only to gate
   *  KRACKEN_TEST_AS_FIRST_BOSS to the very first one. */
  bossCount: number
  /** Leagues (see leaguesForDepth) at which the next boss fight triggers. */
  nextBossLeagues: number
  /** Append-only: kill/hit/blast/pickup events for the scene to react to.
   *  The renderer runs its own rAF loop, so it drains this incrementally
   *  (tracking how much it has already consumed) rather than the step
   *  clearing it — clearing here could race a render frame that hasn't
   *  read it yet. */
  effects: Effect[]
  /** True until the player shoots (missile or laser) anything other than a
   *  boss or one of its mine-squad mines — see the Pacifism achievement.
   *  Ramming a threat with the hull doesn't count, only weapons fire. */
  pacifist: boolean
  /** Cumulative seconds the laser ultimate has spent actually firing this
   *  run — see the laser-uptime achievement. */
  laserActiveTotal: number
  /** Cumulative seconds the shotgun buff has spent active this run — see
   *  the shotgun-uptime achievement. */
  shotgunActiveTotal: number
}

/** A fresh random target for the next spawn's travel distance, within
 *  SPAWN_SPACING_MIN..MAX — re-rolled after every spawn so gaps vary. */
function randomSpawnGap(): number {
  return SPAWN_SPACING_MIN + Math.random() * (SPAWN_SPACING_MAX - SPAWN_SPACING_MIN)
}

export function createWorld(): World {
  return {
    subX: BOARD_W / 2,
    subTargetX: BOARD_W / 2,
    invincibleT: 0,
    lives: LIVES_MAX,
    threats: [],
    missiles: [],
    projectiles: [],
    powerups: [],
    weaponMode: 'normal',
    weaponModeT: 0,
    laserCharges: 0,
    laserT: 0,
    laserX: BOARD_W / 2,
    fireCooldown: 0,
    spawnAccumulator: SPAWN_SPACING_MIN * 0.5,
    spawnGap: randomSpawnGap(),
    powerupAccumulator: POWERUP_SPACING * 0.4,
    nextId: 1,
    killPoints: 0,
    depth: 0,
    elapsed: 0,
    collided: false,
    gameWon: false,
    boss: null,
    bossCount: 0,
    nextBossLeagues: BOSS_INTERVAL_LEAGUES,
    effects: [],
    pacifist: true,
    laserActiveTotal: 0,
    shotgunActiveTotal: 0,
  }
}

export function steerLeft(world: World) {
  world.subTargetX = Math.max(SUB_R, world.subTargetX - STEP)
}

export function steerRight(world: World) {
  world.subTargetX = Math.min(BOARD_W - SUB_R, world.subTargetX + STEP)
}

export function score(world: World): number {
  return world.killPoints + Math.floor(world.depth / 8)
}

function speedForDepth(depth: number) {
  return Math.min(MAX_SCROLL_SPEED, BASE_SCROLL_SPEED + depth * SPEED_GAIN_PER_DEPTH)
}

// Each threat type enters the roving-spawn roster at its own leagues
// milestone, staggering the mix open across the dive rather than dropping
// everything on the player from league 0. Boss mine squads (spawnBossMine-
// Squad) push `mine` threats directly, bypassing this table entirely, so a
// boss fight before 7,500L can still throw mines at the player — the one
// deliberate exception to the mine milestone below.
const THREAT_UNLOCK_LEAGUES: Record<ThreatType, number> = {
  monster: 1,
  tentacle: 1,
  mineWall: 1,
  redFish: 1,
  squid: 1,
  fish: 5000,
  mine: 7500,
  sub: 10000,
}

/** Threat mix skews toward subs, monsters and tentacles as depth increases,
 *  on top of the unlock gate above. */
function weightsForDepth(depth: number) {
  const k = Math.min(1, depth / 3600)
  const leagues = leaguesForDepth(depth)
  const unlocked = (type: ThreatType) => leagues >= THREAT_UNLOCK_LEAGUES[type]
  return {
    fish: unlocked('fish') ? 0.5 - 0.27 * k : 0,
    monster: unlocked('monster') ? 0.05 + 0.18 * k : 0,
    sub: unlocked('sub') ? 0.13 + 0.13 * k : 0,
    mine: unlocked('mine') ? 0.17 + 0.08 * k : 0,
    tentacle: unlocked('tentacle') ? 0.15 + 0.1 * k : 0,
    mineWall: unlocked('mineWall') ? 0.08 + 0.05 * k : 0,
    redFish: unlocked('redFish') ? 0.12 + 0.03 * k : 0,
    squid: unlocked('squid') ? 0.1 + 0.05 * k : 0,
  }
}

const THREAT_TYPES: ThreatType[] = [
  'fish',
  'monster',
  'sub',
  'mine',
  'tentacle',
  'mineWall',
  'redFish',
  'squid',
]

function pickThreatType(depth: number): ThreatType {
  const w = weightsForDepth(depth)
  const total = THREAT_TYPES.reduce((sum, t) => sum + w[t], 0)
  let r = Math.random() * total
  for (const type of THREAT_TYPES) {
    r -= w[type]
    if (r <= 0) return type
  }
  return 'fish'
}

function spawnThreat(world: World) {
  const type = pickThreatType(world.depth)

  if (type === 'tentacle') {
    const side: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right'
    const reach = TENTACLE_REACH_MIN + Math.random() * (TENTACLE_REACH_MAX - TENTACLE_REACH_MIN)
    world.threats.push({
      id: world.nextId++,
      type,
      side,
      reach,
      x: side === 'left' ? 0 : BOARD_W,
      baseX: side === 'left' ? 0 : BOARD_W,
      y: BOARD_H + SPAWN_MARGIN,
      phase: Math.random() * Math.PI * 2,
      fireIn: 0,
    })
    return
  }

  if (type === 'mineWall') {
    spawnMineWall(world)
    return
  }

  const spec = THREAT_SPEC[type]
  const x = THREAT_MARGIN + spec.r + Math.random() * (BOARD_W - (THREAT_MARGIN + spec.r) * 2)
  const y = BOARD_H + SPAWN_MARGIN
  world.threats.push({
    id: world.nextId++,
    type,
    x,
    baseX: x,
    y,
    baseY: spec.vwander > 0 ? y : undefined,
    phase: Math.random() * Math.PI * 2,
    fireIn: SUB_FIRE_MIN + Math.random() * (SUB_FIRE_MAX - SUB_FIRE_MIN),
  })
}

/** A short chain of mines bolted to one wall, stepping inward from it —
 *  terrain like the tentacle, but each link is its own point hazard: it
 *  only goes off if a missile or the sub's hull actually touches it. */
function spawnMineWall(world: World) {
  const side: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right'
  const count = MINE_WALL_COUNT_MIN + Math.floor(Math.random() * (MINE_WALL_COUNT_MAX - MINE_WALL_COUNT_MIN + 1))
  const y = BOARD_H + SPAWN_MARGIN
  for (let i = 0; i < count; i++) {
    const dist = MINE_WALL_INSET + i * MINE_WALL_SPACING
    const x = side === 'left' ? dist : BOARD_W - dist
    world.threats.push({
      id: world.nextId++,
      type: 'mineWall',
      side,
      x,
      baseX: x,
      // a gentle stagger so the chain doesn't arrive as one flat wall
      y: y + i * 14,
      phase: Math.random() * Math.PI * 2,
      fireIn: 0,
    })
  }
}

/** More likely with depth, capped so single spawns stay the common case. */
function formationChance(depth: number) {
  return Math.min(0.4, 0.18 + depth / 9000)
}

// Same relative odds as always (fish commonest, mine rarest), just narrowed
// to whichever of the three are actually unlocked at the current leagues —
// formations are their own spawn path and don't otherwise go through
// weightsForDepth's gate at all, so without this a fish/sub/mine formation
// could show up before that type's own milestone.
const FORMATION_WEIGHTS: Record<'fish' | 'sub' | 'mine', number> = { fish: 0.55, sub: 0.35, mine: 0.1 }

function pickFormationType(leagues: number): 'fish' | 'sub' | 'mine' | null {
  const candidates = (['fish', 'sub', 'mine'] as const).filter((t) => leagues >= THREAT_UNLOCK_LEAGUES[t])
  if (candidates.length === 0) return null
  const total = candidates.reduce((sum, t) => sum + FORMATION_WEIGHTS[t], 0)
  let r = Math.random() * total
  for (const t of candidates) {
    r -= FORMATION_WEIGHTS[t]
    if (r <= 0) return t
  }
  return candidates[candidates.length - 1]
}

/** A diagonal chain of `count` same-type threats, staggered in y by
 *  FORMATION_DY per step so the whole line is on screen together, and in x
 *  by FORMATION_DX in a random direction — clamped so every member stays
 *  on the board, which is what leaves a lane to either shoot through or
 *  steer around. All members scroll at the shared world speed, so the
 *  diagonal holds its shape as it rises instead of stretching or bunching. */
function spawnFormation(world: World, type: 'fish' | 'sub' | 'mine') {
  const spec = THREAT_SPEC[type]
  const count = FORMATION_COUNT_MIN + Math.floor(Math.random() * (FORMATION_COUNT_MAX - FORMATION_COUNT_MIN + 1))
  const dir = Math.random() < 0.5 ? 1 : -1
  const half = spec.r + THREAT_MARGIN
  const span = FORMATION_DX * (count - 1)
  const loX = Math.min(0, dir * span)
  const hiX = Math.max(0, dir * span)
  const startMin = half - loX
  const startMax = BOARD_W - half - hiX
  const startX = startMin + Math.random() * Math.max(1, startMax - startMin)

  for (let i = 0; i < count; i++) {
    const x = startX + dir * i * FORMATION_DX
    world.threats.push({
      id: world.nextId++,
      type,
      x,
      baseX: x,
      y: BOARD_H + SPAWN_MARGIN + i * FORMATION_DY,
      phase: Math.random() * Math.PI * 2,
      fireIn: SUB_FIRE_MIN + Math.random() * (SUB_FIRE_MAX - SUB_FIRE_MIN),
    })
  }
}

function pickPowerupType(): PowerupType {
  const r = Math.random()
  if (r < 0.5) return 'shotgun'
  if (r < 0.78) return 'health'
  if (r < 0.95) return 'laser'
  return 'extraLife'
}

function spawnPowerup(world: World) {
  const type = pickPowerupType()
  const x = THREAT_MARGIN + POWERUP_R + Math.random() * (BOARD_W - (THREAT_MARGIN + POWERUP_R) * 2)
  world.powerups.push({ id: world.nextId++, type, x, y: BOARD_H + SPAWN_MARGIN })
}

/** The Kracken's own richer pool, skewed hard toward health and extra lives
 *  rather than the general pool's mostly-shotgun mix — "lots of health and
 *  power ups" for a fight that's otherwise much tougher than a normal one. */
function pickKrackenPowerupType(): PowerupType {
  const r = Math.random()
  if (r < 0.45) return 'health'
  if (r < 0.65) return 'extraLife'
  if (r < 0.85) return 'shotgun'
  return 'laser'
}

function spawnKrackenPowerup(world: World) {
  const type = pickKrackenPowerupType()
  const x = THREAT_MARGIN + POWERUP_R + Math.random() * (BOARD_W - (THREAT_MARGIN + POWERUP_R) * 2)
  world.powerups.push({ id: world.nextId++, type, x, y: BOARD_H + SPAWN_MARGIN })
}

function spawnMineSpray(world: World, x: number, y: number) {
  for (let i = 0; i < MINE_BULLET_COUNT; i++) {
    const angle = (i / MINE_BULLET_COUNT) * Math.PI * 2
    world.projectiles.push({
      id: world.nextId++,
      x,
      y,
      vx: Math.cos(angle) * MINE_BULLET_SPEED,
      vy: Math.sin(angle) * MINE_BULLET_SPEED,
      kind: 'mine',
    })
  }
  world.effects.push({ x, y, kind: 'blast' })
}

function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  const dx = ax - bx
  const dy = ay - by
  const rr = ar + br
  return dx * dx + dy * dy <= rr * rr
}

function inBounds(x: number, y: number) {
  return x > -CULL_MARGIN && x < BOARD_W + CULL_MARGIN && y > -CULL_MARGIN && y < BOARD_H + CULL_MARGIN
}

/** Whether a threat's silhouette falls within an x-band — used by the laser,
 *  which cuts a column rather than testing a point-to-point circle. */
function threatInXBand(threat: Threat, xMin: number, xMax: number) {
  if (threat.type === 'tentacle') {
    const reach = threat.reach ?? 0
    const bandMin = threat.side === 'left' ? 0 : BOARD_W - reach
    const bandMax = threat.side === 'left' ? reach : BOARD_W
    return bandMin < xMax && bandMax > xMin
  }
  const r = THREAT_SPEC[threat.type].r
  return threat.x + r > xMin && threat.x - r < xMax
}

/** Whether shooting this threat costs the Pacifism achievement — everything
 *  does except a boss's own mine-squad mines, which only ever exist while
 *  world.boss is set (normal roving mines are wiped when a boss fight
 *  starts, and don't spawn again until it's over). */
function breaksPacifism(threat: Threat, world: World): boolean {
  return !(threat.type === 'mine' && world.boss !== null)
}

// Roughly on par with sustained missile fire (1 hp per FIRE_COOLDOWN,
// ≈2.9/s) but a bit ahead of it — the beam is free damage on top of
// whatever the player fires alongside it, so it should feel like the
// ultimate it is without deleting a boss in one activation.
const LASER_BOSS_DPS = 3

/** The ultimate beam: while active, anything scrolling into its column is
 *  destroyed outright — including tentacles and mines, cleanly (no spray).
 *  It also damages the boss over time when swept across it, same as a
 *  missile would, just continuously rather than in discrete hits. */
function laserSweep(world: World, dt: number) {
  if (world.laserT <= 0) return
  const xMin = world.laserX - LASER_HALF_WIDTH
  const xMax = world.laserX + LASER_HALF_WIDTH
  if (world.boss && world.boss.phase === 'fighting' && world.boss.x + BOSS_R > xMin && world.boss.x - BOSS_R < xMax) {
    world.boss.hp -= LASER_BOSS_DPS * dt
    if (world.boss.hp <= 0) {
      world.boss.phase = 'exploding'
      world.boss.phaseT = 0
      world.killPoints += world.boss.variant === 'kracken' ? KRACKEN_KILL_POINTS : BOSS_KILL_POINTS
      world.effects.push({ x: world.boss.x, y: world.boss.y, kind: 'blast' })
    }
  }
  const dead = new Set<number>()
  for (const threat of world.threats) {
    if (!threatInXBand(threat, xMin, xMax)) continue
    dead.add(threat.id)
    if (breaksPacifism(threat, world)) world.pacifist = false
    world.killPoints += THREAT_SPEC[threat.type].points
    world.effects.push({ x: threat.type === 'tentacle' ? world.laserX : threat.x, y: threat.y, kind: 'kill' })
  }
  if (dead.size) world.threats = world.threats.filter((t) => !dead.has(t.id))
}

/** Mines detonate on their own once close enough — a proximity fuse, not a
 *  contact one. A missile can still pop one early for a clean kill first. */
function detonateFusedMines(world: World) {
  const detonated = new Set<number>()
  for (const threat of world.threats) {
    if (threat.type === 'mine' && threat.y <= SUB_Y + MINE_FUSE_RANGE) {
      detonated.add(threat.id)
      spawnMineSpray(world, threat.x, threat.y)
    }
  }
  if (detonated.size) world.threats = world.threats.filter((t) => !detonated.has(t.id))
}

/** A boss fight replaces everything else on screen: whatever threats,
 *  enemy fire and power-ups were live get swept away so the only thing
 *  left to deal with is the boss itself and what it throws. */
function spawnBoss(world: World) {
  world.threats = []
  world.projectiles = []
  world.powerups = []
  const isFirstBoss = world.bossCount === 0
  const variant: BossVariant =
    (KRACKEN_TEST_AS_FIRST_BOSS && isFirstBoss) || world.nextBossLeagues >= KRACKEN_LEAGUES ? 'kracken' : 'normal'
  world.bossCount += 1
  const hp = variant === 'kracken' ? KRACKEN_HP : BOSS_HP_MIN + Math.floor(Math.random() * (BOSS_HP_MAX - BOSS_HP_MIN + 1))
  world.boss = {
    id: world.nextId++,
    x: BOARD_W / 2,
    y: BOARD_H + SPAWN_MARGIN,
    hp,
    maxHp: hp,
    phase: 'entering',
    phaseT: 0,
    attackIn: BOSS_ATTACK_MIN + Math.random() * (BOSS_ATTACK_MAX - BOSS_ATTACK_MIN),
    mouthOpenT: 0,
    variant,
    powerupIn:
      variant === 'kracken' ? KRACKEN_POWERUP_MIN + Math.random() * (KRACKEN_POWERUP_MAX - KRACKEN_POWERUP_MIN) : 0,
  }
}

type MineFormation = 'leftDiagonal' | 'rightDiagonal' | 'cross' | 'xShape'
const MINE_FORMATIONS: MineFormation[] = ['leftDiagonal', 'rightDiagonal', 'cross', 'xShape']

/** Which (col, row) cells of the BOSS_MINE_GRID_COLS × BOSS_MINE_GRID_ROWS
 *  grid a formation fills. Each shape is defined per row so spawnBossMine-
 *  Squad can cheaply guarantee every row leaves at least one open column. */
function formationCols(shape: MineFormation, row: number): number[] {
  const lastCol = BOSS_MINE_GRID_COLS - 1
  const midCol = Math.floor(BOSS_MINE_GRID_COLS / 2)
  const midRow = Math.floor(BOSS_MINE_GRID_ROWS / 2)
  switch (shape) {
    case 'leftDiagonal':
      return [row]
    case 'rightDiagonal':
      return [lastCol - row]
    case 'cross':
      return row === midRow ? Array.from({ length: BOSS_MINE_GRID_COLS }, (_, c) => c) : [midCol]
    case 'xShape': {
      const cols = new Set([row, lastCol - row])
      return [...cols]
    }
  }
}

/** A squad of ordinary mine threats laid out in one of a few varied barrel
 *  formations (a diagonal wall leaning either way, a cross, an X), centered
 *  under the boss and spawned from the same off-screen edge every other
 *  threat uses — so despite coming from its mouth narratively, they cross
 *  the same distance (and get the same proximity-fuse warning) as any other
 *  mine. Whatever the shape, every row leaves at least one column open —
 *  the formation scrolls up as a rigid block, so that's a guaranteed lane
 *  through it at the moment each row reaches the player. */
function spawnBossMineSquad(world: World, boss: Boss) {
  const shape = MINE_FORMATIONS[Math.floor(Math.random() * MINE_FORMATIONS.length)]
  const half = THREAT_SPEC.mine.r + THREAT_MARGIN
  const totalWidth = BOSS_MINE_COL_SPACING * (BOSS_MINE_GRID_COLS - 1)
  const startX = Math.max(half, Math.min(BOARD_W - half - totalWidth, boss.x - totalWidth / 2))
  const y0 = BOARD_H + SPAWN_MARGIN

  for (let row = 0; row < BOSS_MINE_GRID_ROWS; row++) {
    const cols = formationCols(shape, row)
    if (cols.length >= BOSS_MINE_GRID_COLS) cols.splice(Math.floor(Math.random() * cols.length), 1)
    for (const col of cols) {
      const x = startX + col * BOSS_MINE_COL_SPACING
      world.threats.push({
        id: world.nextId++,
        type: 'mine',
        x,
        baseX: x,
        y: y0 + row * BOSS_MINE_ROW_SPACING,
        phase: Math.random() * Math.PI * 2,
        fireIn: 0,
      })
    }
  }
}

/** Advances the boss's own little state machine: rise into view, then fight
 *  (spitting a mine squad on a timer) until its hp runs out, then a short
 *  explosion beat before it's gone for good and normal diving resumes. */
function updateBoss(world: World, dt: number) {
  const boss = world.boss
  if (!boss) return
  boss.phaseT += dt
  boss.mouthOpenT = Math.max(0, boss.mouthOpenT - dt)

  if (boss.phase === 'entering') {
    boss.y = Math.max(BOSS_Y, boss.y - BOSS_ENTER_SPEED * dt)
    if (boss.y <= BOSS_Y) {
      boss.y = BOSS_Y
      boss.phase = 'fighting'
      boss.phaseT = 0
    }
    return
  }

  if (boss.phase === 'fighting') {
    boss.attackIn -= dt
    if (boss.attackIn <= 0) {
      spawnBossMineSquad(world, boss)
      boss.mouthOpenT = BOSS_MOUTH_OPEN_TIME
      boss.attackIn = BOSS_ATTACK_MIN + Math.random() * (BOSS_ATTACK_MAX - BOSS_ATTACK_MIN)
    }
    if (boss.variant === 'kracken') {
      boss.powerupIn -= dt
      if (boss.powerupIn <= 0) {
        spawnKrackenPowerup(world)
        boss.powerupIn = KRACKEN_POWERUP_MIN + Math.random() * (KRACKEN_POWERUP_MAX - KRACKEN_POWERUP_MIN)
      }
    }
    return
  }

  // 'exploding': held just long enough for the scene to play the death
  // burst, then gone — and diving resumes just past the milestone it took,
  // not back at it, so the same distance doesn't immediately trigger again.
  // Defeating the Kracken — in the test-toggle first fight or the real
  // 20,000-league one — wins the game outright, in any instance.
  if (boss.phaseT >= BOSS_EXPLODE_TIME) {
    const cleared = world.nextBossLeagues
    world.nextBossLeagues += BOSS_INTERVAL_LEAGUES
    world.depth = (cleared + 1) * DEPTH_PER_LEAGUE
    if (boss.variant === 'kracken') world.gameWon = true
    world.boss = null
  }
}

export function step(world: World, dt: number, input: { fire: boolean }) {
  if (world.collided || world.gameWon) return

  world.elapsed += dt

  // --- steering: ease toward the stepped target -----------------------
  world.subX += (world.subTargetX - world.subX) * Math.min(1, dt / STEP_TIME)
  world.invincibleT = Math.max(0, world.invincibleT - dt)
  world.fireCooldown = Math.max(0, world.fireCooldown - dt)
  if (world.laserT > 0) world.laserActiveTotal += dt
  world.laserT = Math.max(0, world.laserT - dt)
  if (world.weaponMode === 'shotgun') {
    world.shotgunActiveTotal += dt
    world.weaponModeT -= dt
    if (world.weaponModeT <= 0) world.weaponMode = 'normal'
  }

  // --- descent: frozen for the duration of a boss fight, so the milestone
  // counter holds still and difficulty doesn't keep climbing mid-fight -----
  const speed = speedForDepth(world.depth)
  if (!world.boss) {
    world.depth += speed * dt
    if (leaguesForDepth(world.depth) >= world.nextBossLeagues) spawnBoss(world)
  }

  // --- firing: the ultimate takes priority, then the shotgun buff -----------
  if (input.fire && world.fireCooldown <= 0) {
    if (world.laserCharges > 0) {
      world.laserCharges -= 1
      world.laserT = LASER_DURATION
      world.laserX = world.subX
      world.fireCooldown = LASER_COOLDOWN
    } else if (world.weaponMode === 'shotgun') {
      world.fireCooldown = FIRE_COOLDOWN
      for (let i = 0; i < SHOTGUN_MISSILE_COUNT; i++) {
        const t = (i / (SHOTGUN_MISSILE_COUNT - 1)) * 2 - 1
        world.missiles.push({ id: world.nextId++, x: world.subX, y: SUB_Y - SUB_R, vx: t * SHOTGUN_SPREAD_VX, vy: MISSILE_SPEED })
      }
    } else {
      world.fireCooldown = FIRE_COOLDOWN
      world.missiles.push({ id: world.nextId++, x: world.subX, y: SUB_Y - SUB_R, vx: 0, vy: MISSILE_SPEED })
    }
  }

  // --- threat spawn/scroll: suppressed during a boss fight — it replaces
  // every other obstacle and enemy, not just adds to them --------------------
  if (!world.boss) {
    world.spawnAccumulator += speed * dt
    if (world.spawnAccumulator >= world.spawnGap) {
      world.spawnAccumulator -= world.spawnGap
      world.spawnGap = randomSpawnGap()
      const formationType = Math.random() < formationChance(world.depth) ? pickFormationType(leaguesForDepth(world.depth)) : null
      if (formationType) {
        spawnFormation(world, formationType)
      } else {
        spawnThreat(world)
      }
    }
  }

  for (const threat of world.threats) {
    const spec = THREAT_SPEC[threat.type]
    if (spec.vwander > 0 && threat.baseY !== undefined) {
      // squid: the anchor scrolls exactly like everything else, but the
      // threat's actual y is a bob layered on top of it, not the anchor
      // itself — same relationship wander below has to baseX.
      threat.baseY -= speed * dt
      threat.y = threat.baseY + Math.sin(world.elapsed * 1.3 + threat.phase) * spec.vwander
    } else {
      threat.y -= speed * dt
    }
    if (spec.wander > 0) {
      threat.x = threat.baseX + Math.sin(world.elapsed * 1.6 + threat.phase) * spec.wander
    }
    if (threat.type === 'sub') {
      threat.fireIn -= dt
      if (threat.fireIn <= 0 && threat.y < BOARD_H && threat.y > 0) {
        threat.fireIn = SUB_FIRE_MIN + Math.random() * (SUB_FIRE_MAX - SUB_FIRE_MIN)
        world.projectiles.push({ id: world.nextId++, x: threat.x, y: threat.y, vx: 0, vy: -PROJECTILE_SPEED, kind: 'sub' })
      }
    }
  }

  // The ultimate keeps firing on its own for its full duration, tracking
  // the sub every frame so the player can sweep it across the board rather
  // than committing to wherever they were standing when it triggered.
  if (world.laserT > 0) world.laserX = world.subX
  laserSweep(world, dt)
  detonateFusedMines(world)
  updateBoss(world, dt)

  // --- missiles and enemy fire: generalized 2D travel, culled off any edge --
  for (const missile of world.missiles) {
    missile.x += missile.vx * dt
    missile.y += missile.vy * dt
  }
  world.missiles = world.missiles.filter((m) => inBounds(m.x, m.y))

  for (const projectile of world.projectiles) {
    projectile.x += projectile.vx * dt
    projectile.y += projectile.vy * dt
  }
  world.projectiles = world.projectiles.filter((p) => inBounds(p.x, p.y))

  // --- power-ups: spawn, scroll, pick up (also suppressed during a boss) ----
  if (!world.boss) {
    world.powerupAccumulator += speed * dt
    if (world.powerupAccumulator >= POWERUP_SPACING) {
      world.powerupAccumulator -= POWERUP_SPACING
      spawnPowerup(world)
    }
  }
  for (const powerup of world.powerups) powerup.y -= speed * dt
  world.powerups = world.powerups.filter((p) => p.y > -CULL_MARGIN)

  const collected = new Set<number>()
  for (const powerup of world.powerups) {
    if (circlesOverlap(world.subX, SUB_Y, SUB_R, powerup.x, powerup.y, POWERUP_R)) {
      collected.add(powerup.id)
      // Each weapon buff only ever touches its own state, so picking up one
      // type never interrupts (or adds time to) whichever *other* type is
      // currently running — a shotgun pickup mid-laser-beam doesn't cut the
      // beam short, and vice versa. Only a same-type pickup extends.
      if (powerup.type === 'shotgun') {
        world.weaponMode = 'shotgun'
        world.weaponModeT = SHOTGUN_DURATION
      } else if (powerup.type === 'laser') {
        if (world.laserT > 0) {
          // already firing — extend the beam seamlessly instead of banking
          // a second charge that would need its own later fire press,
          // which is what left the old "chained" beams with gaps between
          // them
          world.laserT += LASER_DURATION
        } else {
          world.laserCharges = Math.min(1, world.laserCharges + 1)
        }
      } else if (powerup.type === 'extraLife') {
        // Uncapped, unlike a health refill — a genuine bonus life rather
        // than topping off the existing pool back up to LIVES_MAX.
        world.lives += 1
      } else {
        world.lives = Math.min(LIVES_MAX, world.lives + 1)
      }
      world.effects.push({ x: powerup.x, y: powerup.y, kind: 'pickup' })
    }
  }
  if (collected.size) world.powerups = world.powerups.filter((p) => !collected.has(p.id))

  // --- missile vs threat (tentacles are terrain — missiles pass through) ----
  const deadThreats = new Set<number>()
  const spentMissiles = new Set<number>()
  for (const missile of world.missiles) {
    if (spentMissiles.has(missile.id)) continue
    if (world.boss && world.boss.phase === 'fighting' && circlesOverlap(missile.x, missile.y, MISSILE_R, world.boss.x, world.boss.y, BOSS_R)) {
      spentMissiles.add(missile.id)
      world.boss.hp -= 1
      world.effects.push({ x: missile.x, y: missile.y, kind: 'hit' })
      if (world.boss.hp <= 0) {
        world.boss.phase = 'exploding'
        world.boss.phaseT = 0
        world.killPoints += world.boss.variant === 'kracken' ? KRACKEN_KILL_POINTS : BOSS_KILL_POINTS
        world.effects.push({ x: world.boss.x, y: world.boss.y, kind: 'blast' })
      }
      continue
    }
    for (const threat of world.threats) {
      if (threat.type === 'tentacle' || deadThreats.has(threat.id)) continue
      const spec = THREAT_SPEC[threat.type]
      if (circlesOverlap(missile.x, missile.y, MISSILE_R, threat.x, threat.y, spec.r)) {
        deadThreats.add(threat.id)
        spentMissiles.add(missile.id)
        world.killPoints += spec.points
        world.effects.push({ x: threat.x, y: threat.y, kind: 'kill' })
        if (breaksPacifism(threat, world)) world.pacifist = false
        break
      }
    }
  }
  if (deadThreats.size) world.threats = world.threats.filter((t) => !deadThreats.has(t.id))
  if (spentMissiles.size) world.missiles = world.missiles.filter((m) => !spentMissiles.has(m.id))

  // --- threat / projectile vs sub: only the small hitbox near the bottom of
  // the model counts, not the (now mostly cosmetic) full hull -----------------
  if (world.invincibleT <= 0) {
    const hitY = SUB_Y + HIT_OFFSET_Y
    let hit =
      world.boss !== null &&
      world.boss.phase !== 'exploding' &&
      circlesOverlap(world.subX, hitY, HIT_R, world.boss.x, world.boss.y, BOSS_R)
    for (const threat of world.threats) {
      if (hit) break
      if (threat.type === 'tentacle') {
        const reach = threat.reach ?? 0
        const yOverlap = Math.abs(hitY - threat.y) < TENTACLE_THICKNESS / 2 + HIT_R
        if (!yOverlap) continue
        const xOverlap = threat.side === 'left' ? world.subX - HIT_R < reach : world.subX + HIT_R > BOARD_W - reach
        if (xOverlap) {
          hit = true
          break
        }
      } else if (circlesOverlap(world.subX, hitY, HIT_R, threat.x, threat.y, THREAT_SPEC[threat.type].r)) {
        deadThreats.add(threat.id)
        hit = true
        break
      }
    }
    if (hit) world.threats = world.threats.filter((t) => !deadThreats.has(t.id))

    if (!hit) {
      for (const projectile of world.projectiles) {
        const pr = projectile.kind === 'mine' ? MINE_BULLET_R : PROJECTILE_R
        if (circlesOverlap(world.subX, hitY, HIT_R, projectile.x, projectile.y, pr)) {
          world.projectiles = world.projectiles.filter((p) => p.id !== projectile.id)
          hit = true
          break
        }
      }
    }

    if (hit) {
      world.lives -= 1
      world.invincibleT = INVINCIBLE_TIME
      world.effects.push({ x: world.subX, y: hitY, kind: 'hit' })
      if (world.lives <= 0) world.collided = true
    }
  }

  // --- cull threats that scrolled past the top --------------------------
  world.threats = world.threats.filter((t) => t.y > -CULL_MARGIN)
}
