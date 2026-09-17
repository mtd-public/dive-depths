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

export const LIVES_MAX = 3
const INVINCIBLE_TIME = 1.5

const FIRE_COOLDOWN = 0.35
const MISSILE_SPEED = 620
const MISSILE_R = 8

const PROJECTILE_SPEED = 260
const PROJECTILE_R = 7
const SUB_FIRE_MIN = 1.6
const SUB_FIRE_MAX = 3.2

const BASE_SCROLL_SPEED = 170
const MAX_SCROLL_SPEED = 360
const SPEED_GAIN_PER_DEPTH = 0.012
const SPAWN_SPACING = 260
const SPAWN_MARGIN = 220
const CULL_MARGIN = 200
const THREAT_MARGIN = 30

export type ThreatType = 'fish' | 'monster' | 'sub' | 'mine'

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
}

export interface Threat {
  id: number
  type: ThreatType
  x: number
  baseX: number
  y: number
  phase: number
  fireIn: number
}

export interface Missile {
  id: number
  x: number
  y: number
}

export interface Projectile {
  id: number
  x: number
  y: number
}

export type EffectKind = 'hit' | 'kill'

export interface Effect {
  x: number
  y: number
  kind: EffectKind
}

export interface World {
  subX: number
  subTargetX: number
  invincibleT: number
  lives: number
  threats: Threat[]
  missiles: Missile[]
  projectiles: Projectile[]
  fireCooldown: number
  spawnAccumulator: number
  nextId: number
  killPoints: number
  depth: number
  elapsed: number
  collided: boolean
  /** Append-only: kill/hit events for the scene to react to. The renderer
   *  runs its own rAF loop, so it drains this incrementally (tracking how
   *  much it has already consumed) rather than the step clearing it —
   *  clearing here could race a render frame that hasn't read it yet. */
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
    fireCooldown: 0,
    spawnAccumulator: SPAWN_SPACING * 0.5,
    nextId: 1,
    killPoints: 0,
    depth: 0,
    elapsed: 0,
    collided: false,
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

/** Threat mix skews toward subs and monsters as depth increases. */
function weightsForDepth(depth: number) {
  const k = Math.min(1, depth / 3600)
  return {
    fish: 0.55 - 0.3 * k,
    monster: 0.05 + 0.2 * k,
    sub: 0.15 + 0.15 * k,
    mine: 0.25 + 0.1 * k,
  }
}

function pickThreatType(depth: number): ThreatType {
  const w = weightsForDepth(depth)
  const total = w.fish + w.monster + w.sub + w.mine
  let r = Math.random() * total
  for (const type of ['fish', 'monster', 'sub', 'mine'] as ThreatType[]) {
    r -= w[type]
    if (r <= 0) return type
  }
  return 'fish'
}

function spawnThreat(world: World) {
  const type = pickThreatType(world.depth)
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

function circlesOverlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  const dx = ax - bx
  const dy = ay - by
  const rr = ar + br
  return dx * dx + dy * dy <= rr * rr
}

export function step(world: World, dt: number, input: { fire: boolean }) {
  if (world.collided) return

  world.elapsed += dt

  // --- steering: ease toward the stepped target -----------------------
  world.subX += (world.subTargetX - world.subX) * Math.min(1, dt / STEP_TIME)
  world.invincibleT = Math.max(0, world.invincibleT - dt)
  world.fireCooldown = Math.max(0, world.fireCooldown - dt)

  // --- descent ----------------------------------------------------------
  const speed = speedForDepth(world.depth)
  world.depth += speed * dt

  // --- firing -------------------------------------------------------------
  if (input.fire && world.fireCooldown <= 0) {
    world.fireCooldown = FIRE_COOLDOWN
    world.missiles.push({ id: world.nextId++, x: world.subX, y: SUB_Y - SUB_R })
  }

  // --- threat spawn/scroll -------------------------------------------------
  world.spawnAccumulator += speed * dt
  if (world.spawnAccumulator >= SPAWN_SPACING) {
    world.spawnAccumulator -= SPAWN_SPACING
    spawnThreat(world)
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
        world.projectiles.push({ id: world.nextId++, x: threat.x, y: threat.y })
      }
    }
  }

  // --- missiles: travel down, away from the sub ----------------------------
  for (const missile of world.missiles) missile.y += MISSILE_SPEED * dt
  world.missiles = world.missiles.filter((m) => m.y < BOARD_H + CULL_MARGIN)

  // --- enemy projectiles: travel up, toward the sub -------------------------
  for (const projectile of world.projectiles) projectile.y -= PROJECTILE_SPEED * dt
  world.projectiles = world.projectiles.filter((p) => p.y > -CULL_MARGIN)

  // --- missile vs threat ----------------------------------------------------
  const deadThreats = new Set<number>()
  const spentMissiles = new Set<number>()
  for (const missile of world.missiles) {
    if (spentMissiles.has(missile.id)) continue
    for (const threat of world.threats) {
      if (deadThreats.has(threat.id)) continue
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
    let hit = false
    for (const threat of world.threats) {
      if (circlesOverlap(world.subX, SUB_Y, SUB_R, threat.x, threat.y, THREAT_SPEC[threat.type].r)) {
        deadThreats.add(threat.id)
        hit = true
        break
      }
    }
    if (hit) world.threats = world.threats.filter((t) => !deadThreats.has(t.id))

    if (!hit) {
      for (const projectile of world.projectiles) {
        if (circlesOverlap(world.subX, SUB_Y, SUB_R, projectile.x, projectile.y, PROJECTILE_R)) {
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
