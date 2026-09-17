// Logical coordinate space the game simulates in; GameCanvas scales this to
// whatever size the board actually renders at. y follows plain screen
// convention (0 at the top, increasing downward) — the submarine sits near
// the top at a small y, threats spawn at large y (off the bottom) and
// scroll toward smaller y as they rise to meet it.
export const BOARD_W = 400
export const BOARD_H = 800

export const SUB_Y = BOARD_H * 0.22
export const SUB_R = 20

// Steering: a discrete step-and-ease model (prof-whip-dash's lane-switch
// smoothing), not splashy-fish's current-and-splash velocity model — each
// steerLeft/steerRight call nudges the *target*, and subX eases toward it
// every frame. There's no fixed lane grid: the target moves by STEP in
// continuous board space, so threat placement stays free-form.
const STEP = 76
const STEP_TIME = 0.16

export const LIVES_MAX = 5
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
const MINE_FUSE_RANGE = 230
const MINE_BULLET_SPEED = 190
const MINE_BULLET_R = 6
const MINE_BULLET_COUNT = 8

// Tentacles reach in from one wall only — like splashy-fish's obstacle bands,
// but one-sided, so there's always clear water on the other edge to dodge
// into rather than a gap to thread. Kept short: it's a hazard to steer
// around, not a wall that eats most of the board.
const TENTACLE_THICKNESS = 90
const TENTACLE_REACH_MIN = BOARD_W * 0.32
const TENTACLE_REACH_MAX = BOARD_W * 0.48

const POWERUP_R = 16
const POWERUP_SPACING = 1600
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

const BASE_SCROLL_SPEED = 170
const MAX_SCROLL_SPEED = 360
const SPEED_GAIN_PER_DEPTH = 0.012
const SPAWN_SPACING = 260
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
// unit would fire every few seconds. `metersForDepth` rescales it into a
// much coarser "distance" purely for pacing the boss cadence and for the
// number the player sees — about a minute of normal diving between fights.
// An integer divisor, not a 0.1 multiplier — dividing by 10 keeps the
// post-boss depth reset (below) exact, where multiplying by a fractional
// 0.1 constant would round-trip through floating-point error and land the
// "distance" a meter short of where cleared + 1 should put it.
const DEPTH_PER_METER = 10
const BOSS_INTERVAL_METERS = 2000
export function metersForDepth(depth: number): number {
  return Math.floor(depth / DEPTH_PER_METER)
}

// The boss is fixed at the bottom of the board — a vast, mostly-submerged
// creature rather than something that swims up to meet the sub. Its mine
// squads spawn separately, from the same edge every other threat does, so
// they still cross the same distance (and get the same proximity-fuse
// warning) as a normal mine, regardless of where the boss itself sits.
const BOSS_Y = BOARD_H - 40
const BOSS_ENTER_SPEED = 140
export const BOSS_R = 50
const BOSS_HP_MIN = 15
const BOSS_HP_MAX = 20
const BOSS_KILL_POINTS = 300
const BOSS_ATTACK_MIN = 2.4
const BOSS_ATTACK_MAX = 3.8
export const BOSS_MOUTH_OPEN_TIME = 0.5
export const BOSS_EXPLODE_TIME = 1.4
const BOSS_MINE_SQUAD_SIZES = [5, 10, 15] as const
const BOSS_MINE_COLS = 5
const BOSS_MINE_COL_SPACING = 50
const BOSS_MINE_ROW_SPACING = 70

export type BossPhase = 'entering' | 'fighting' | 'exploding'

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
}

export type ThreatType = 'fish' | 'monster' | 'sub' | 'mine' | 'tentacle'

interface ThreatSpec {
  r: number
  points: number
  wander: number
}

const THREAT_SPEC: Record<ThreatType, ThreatSpec> = {
  fish: { r: 16, points: 5, wander: 34 },
  monster: { r: 25, points: 12, wander: 20 },
  sub: { r: 22, points: 18, wander: 0 },
  mine: { r: 20, points: 25, wander: 0 },
  // Not a point hazard — collision uses `side`/`reach` instead of `r`, and
  // it's only ever destroyed by the laser ultimate, hence the points value.
  tentacle: { r: 0, points: 20, wander: 0 },
}

export interface Threat {
  id: number
  type: ThreatType
  x: number
  baseX: number
  y: number
  phase: number
  fireIn: number
  /** Tentacle only: which wall it reaches from, and how far across. */
  side?: 'left' | 'right'
  reach?: number
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

export type PowerupType = 'shotgun' | 'laser' | 'health'

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
  powerupAccumulator: number
  nextId: number
  killPoints: number
  depth: number
  elapsed: number
  collided: boolean
  boss: Boss | null
  /** Meters (see metersForDepth) at which the next boss fight triggers. */
  nextBossMeters: number
  /** Append-only: kill/hit/blast/pickup events for the scene to react to.
   *  The renderer runs its own rAF loop, so it drains this incrementally
   *  (tracking how much it has already consumed) rather than the step
   *  clearing it — clearing here could race a render frame that hasn't
   *  read it yet. */
  effects: Effect[]
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
    spawnAccumulator: SPAWN_SPACING * 0.5,
    powerupAccumulator: POWERUP_SPACING * 0.4,
    nextId: 1,
    killPoints: 0,
    depth: 0,
    elapsed: 0,
    collided: false,
    boss: null,
    nextBossMeters: BOSS_INTERVAL_METERS,
    effects: [],
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

/** Threat mix skews toward subs, monsters and tentacles as depth increases. */
function weightsForDepth(depth: number) {
  const k = Math.min(1, depth / 3600)
  return {
    fish: 0.5 - 0.27 * k,
    monster: 0.05 + 0.18 * k,
    sub: 0.13 + 0.13 * k,
    mine: 0.17 + 0.08 * k,
    tentacle: 0.15 + 0.1 * k,
  }
}

const THREAT_TYPES: ThreatType[] = ['fish', 'monster', 'sub', 'mine', 'tentacle']

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

  const spec = THREAT_SPEC[type]
  const x = THREAT_MARGIN + spec.r + Math.random() * (BOARD_W - (THREAT_MARGIN + spec.r) * 2)
  world.threats.push({
    id: world.nextId++,
    type,
    x,
    baseX: x,
    y: BOARD_H + SPAWN_MARGIN,
    phase: Math.random() * Math.PI * 2,
    fireIn: SUB_FIRE_MIN + Math.random() * (SUB_FIRE_MAX - SUB_FIRE_MIN),
  })
}

/** More likely with depth, capped so single spawns stay the common case. */
function formationChance(depth: number) {
  return Math.min(0.4, 0.18 + depth / 9000)
}

function pickFormationType(): 'fish' | 'sub' | 'mine' {
  const r = Math.random()
  if (r < 0.55) return 'fish'
  if (r < 0.9) return 'sub'
  return 'mine'
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
  if (r < 0.42) return 'shotgun'
  if (r < 0.82) return 'health'
  return 'laser'
}

function spawnPowerup(world: World) {
  const type = pickPowerupType()
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

/** The ultimate beam: while active, anything scrolling into its column is
 *  destroyed outright — including tentacles and mines, cleanly (no spray). */
function laserSweep(world: World) {
  if (world.laserT <= 0) return
  const xMin = world.laserX - LASER_HALF_WIDTH
  const xMax = world.laserX + LASER_HALF_WIDTH
  const dead = new Set<number>()
  for (const threat of world.threats) {
    if (!threatInXBand(threat, xMin, xMax)) continue
    dead.add(threat.id)
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
  const hp = BOSS_HP_MIN + Math.floor(Math.random() * (BOSS_HP_MAX - BOSS_HP_MIN + 1))
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
  }
}

/** A grid "squad" of 5, 10 or 15 ordinary mine threats, centered under the
 *  boss and spawned from the same off-screen edge every other threat uses
 *  — so despite coming from its mouth narratively, they cross the same
 *  distance (and get the same proximity-fuse warning) as any other mine. */
function spawnBossMineSquad(world: World, boss: Boss) {
  const count = BOSS_MINE_SQUAD_SIZES[Math.floor(Math.random() * BOSS_MINE_SQUAD_SIZES.length)]
  const rows = count / BOSS_MINE_COLS
  const half = THREAT_SPEC.mine.r + THREAT_MARGIN
  const totalWidth = BOSS_MINE_COL_SPACING * (BOSS_MINE_COLS - 1)
  const startX = Math.max(half, Math.min(BOARD_W - half - totalWidth, boss.x - totalWidth / 2))

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < BOSS_MINE_COLS; col++) {
      const x = startX + col * BOSS_MINE_COL_SPACING
      world.threats.push({
        id: world.nextId++,
        type: 'mine',
        x,
        baseX: x,
        y: BOARD_H + SPAWN_MARGIN + row * BOSS_MINE_ROW_SPACING,
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
    return
  }

  // 'exploding': held just long enough for the scene to play the death
  // burst, then gone — and diving resumes just past the milestone it took,
  // not back at it, so the same distance doesn't immediately trigger again.
  if (boss.phaseT >= BOSS_EXPLODE_TIME) {
    const cleared = world.nextBossMeters
    world.nextBossMeters += BOSS_INTERVAL_METERS
    world.depth = (cleared + 1) * DEPTH_PER_METER
    world.boss = null
  }
}

export function step(world: World, dt: number, input: { fire: boolean }) {
  if (world.collided) return

  world.elapsed += dt

  // --- steering: ease toward the stepped target -----------------------
  world.subX += (world.subTargetX - world.subX) * Math.min(1, dt / STEP_TIME)
  world.invincibleT = Math.max(0, world.invincibleT - dt)
  world.fireCooldown = Math.max(0, world.fireCooldown - dt)
  world.laserT = Math.max(0, world.laserT - dt)
  if (world.weaponMode === 'shotgun') {
    world.weaponModeT -= dt
    if (world.weaponModeT <= 0) world.weaponMode = 'normal'
  }

  // --- descent: frozen for the duration of a boss fight, so the milestone
  // counter holds still and difficulty doesn't keep climbing mid-fight -----
  const speed = speedForDepth(world.depth)
  if (!world.boss) {
    world.depth += speed * dt
    if (metersForDepth(world.depth) >= world.nextBossMeters) spawnBoss(world)
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
    if (world.spawnAccumulator >= SPAWN_SPACING) {
      world.spawnAccumulator -= SPAWN_SPACING
      if (Math.random() < formationChance(world.depth)) {
        spawnFormation(world, pickFormationType())
      } else {
        spawnThreat(world)
      }
    }
  }

  for (const threat of world.threats) {
    threat.y -= speed * dt
    const wander = THREAT_SPEC[threat.type].wander
    if (wander > 0) {
      threat.x = threat.baseX + Math.sin(world.elapsed * 1.6 + threat.phase) * wander
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
  laserSweep(world)
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
      if (powerup.type === 'shotgun') {
        world.weaponMode = 'shotgun'
        world.weaponModeT = SHOTGUN_DURATION
      } else if (powerup.type === 'laser') {
        world.laserCharges = Math.min(1, world.laserCharges + 1)
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
        world.killPoints += BOSS_KILL_POINTS
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
        break
      }
    }
  }
  if (deadThreats.size) world.threats = world.threats.filter((t) => !deadThreats.has(t.id))
  if (spentMissiles.size) world.missiles = world.missiles.filter((m) => !spentMissiles.has(m.id))

  // --- threat / projectile vs sub --------------------------------------------
  if (world.invincibleT <= 0) {
    let hit =
      world.boss !== null &&
      world.boss.phase !== 'exploding' &&
      circlesOverlap(world.subX, SUB_Y, SUB_R, world.boss.x, world.boss.y, BOSS_R)
    for (const threat of world.threats) {
      if (hit) break
      if (threat.type === 'tentacle') {
        const reach = threat.reach ?? 0
        const yOverlap = Math.abs(SUB_Y - threat.y) < TENTACLE_THICKNESS / 2 + SUB_R
        if (!yOverlap) continue
        const xOverlap = threat.side === 'left' ? world.subX - SUB_R < reach : world.subX + SUB_R > BOARD_W - reach
        if (xOverlap) {
          hit = true
          break
        }
      } else if (circlesOverlap(world.subX, SUB_Y, SUB_R, threat.x, threat.y, THREAT_SPEC[threat.type].r)) {
        deadThreats.add(threat.id)
        hit = true
        break
      }
    }
    if (hit) world.threats = world.threats.filter((t) => !deadThreats.has(t.id))

    if (!hit) {
      for (const projectile of world.projectiles) {
        const pr = projectile.kind === 'mine' ? MINE_BULLET_R : PROJECTILE_R
        if (circlesOverlap(world.subX, SUB_Y, SUB_R, projectile.x, projectile.y, pr)) {
          world.projectiles = world.projectiles.filter((p) => p.id !== projectile.id)
          hit = true
          break
        }
      }
    }

    if (hit) {
      world.lives -= 1
      world.invincibleT = INVINCIBLE_TIME
      world.effects.push({ x: world.subX, y: SUB_Y, kind: 'hit' })
      if (world.lives <= 0) world.collided = true
    }
  }

  // --- cull threats that scrolled past the top --------------------------
  world.threats = world.threats.filter((t) => t.y > -CULL_MARGIN)
}
