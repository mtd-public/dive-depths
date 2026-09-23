/**
 * scene.ts — the two-tone board, rendered in software into a 256×512
 * palette-index buffer. DOM-free on purpose: the browser renderer
 * (renderTwoTone.ts) just pushes the buffer through a palette lookup, and
 * the node concept script PNG-encodes the very same pixels.
 *
 * It reads the same `World` render2d.ts does and mirrors its FX logic
 * (effects drain, boss death chain, wakes, trails, muzzle flashes), so it
 * can replace Render2D without physics changing. Where render2d fades
 * with globalAlpha, this dithers — a two-tone palette has no in-betweens.
 */
import {
  BOARD_W,
  HIT_OFFSET_Y,
  HIT_R,
  LASER_HALF_WIDTH,
  LIVES_MAX,
  MINE_FUSE_RANGE,
  SUB_Y,
  TENTACLE_THICKNESS,
  leaguesForDepth,
  score,
  type Threat,
  type World,
} from '../physics'
import type { GamePhase } from '../types'
import {
  ACC,
  ACC2,
  CLEAR,
  FG,
  INK,
  buildChain,
  buildGem,
  buildPip,
  buildTentacleArm,
  buildTwoToneSprites,
  dith,
  drawText,
  hash,
  iblank,
  imirrorX,
  textWidth,
  type IFrame,
  type Ink,
  type TwoToneSprites,
} from './art'

export const RW = 256
export const RH = 512
const K = RW / BOARD_W

/** Leagues per zone — same cadence the water color cycled on. */
export const ZONE_LEAGUES = 5000

interface Boom {
  x: number
  y: number
  anim: 'explosionS' | 'explosionM' | 'explosionL'
  t: number
}
interface Ring {
  x: number
  y: number
  t: number
}
interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  t: number
}
interface TrailPoint {
  x: number
  y: number
  t: number
}
interface Puff {
  x: number
  y: number
  t: number
  size: number
}
interface Mote {
  x: number
  y: number
  speed: number
  layer: 0 | 1
}

export interface SceneOptions {
  /** Draw the in-board HUD (hull pips, score, depth, weapon). */
  hud?: boolean
  /** Dithered searchlight cone under the sub. */
  headlight?: boolean
}

const mineWallBob = (t: number, phase: number): number => Math.sin(t * 1.7 + phase) * 5

/** Smooth 1-D value noise in [0, 1). */
function noise1(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const a = hash(i, 0, seed)
  const b = hash(i + 1, 0, seed)
  const s = (1 - Math.cos(f * Math.PI)) / 2
  return a + (b - a) * s
}

export class TwoToneScene {
  readonly frame: IFrame = iblank(RW, RH)
  readonly sprites: TwoToneSprites
  opts: Required<SceneOptions>
  private mirrored = new Map<IFrame, IFrame>()
  private tentacles = new Map<number, IFrame>()
  private chains = new Map<number, IFrame>()
  private subFlash = new Map<number, number>()
  private subFireIn = new Map<number, number>()
  private trails = new Map<number, TrailPoint[]>()
  private trailAccum = new Map<number, number>()
  booms: Boom[] = []
  private rings: Ring[] = []
  private sparks: Spark[] = []
  private wake: Puff[] = []
  private motes: Mote[] = []
  private consumedEffects = 0
  private lastElapsed = 0
  private bossChainT = 0
  private pips = [buildPip(true), buildPip(false)]
  private gem = buildGem()

  constructor(opts: SceneOptions = {}) {
    this.opts = { hud: opts.hud ?? true, headlight: opts.headlight ?? true }
    this.sprites = buildTwoToneSprites()
    for (let i = 0; i < 70; i++) {
      const layer = i < 52 ? 0 : 1
      this.motes.push({
        x: Math.random() * RW,
        y: Math.random() * RH,
        speed: layer === 0 ? 5 + Math.random() * 8 : 16 + Math.random() * 14,
        layer,
      })
    }
  }

  /** Current zone index (0-based), for callers that cycle palettes by depth. */
  static zoneOf(world: World): number {
    return Math.floor(leaguesForDepth(world.depth) / ZONE_LEAGUES)
  }

  // -------------------------------------------------------------------------
  // Blitting
  // -------------------------------------------------------------------------

  private blit(src: IFrame, ox: number, oy: number, level = 1): void {
    const dst = this.frame
    ox = Math.round(ox)
    oy = Math.round(oy)
    const x0 = Math.max(0, -ox)
    const x1 = Math.min(src.w, dst.w - ox)
    const y0 = Math.max(0, -oy)
    const y1 = Math.min(src.h, dst.h - oy)
    for (let y = y0; y < y1; y++) {
      const dy = oy + y
      for (let x = x0; x < x1; x++) {
        const c = src.px[y * src.w + x]
        if (!c) continue
        const dx = ox + x
        if (level < 1 && !dith(dx, dy, level)) continue
        dst.px[dy * dst.w + dx] = c
      }
    }
  }

  private drawAt(f: IFrame, ux: number, uy: number, level = 1): void {
    this.blit(f, ux * K - f.w / 2, uy * K - f.h / 2, level)
  }

  private mirror(f: IFrame): IFrame {
    let m = this.mirrored.get(f)
    if (!m) {
      m = imirrorX(f)
      this.mirrored.set(f, m)
    }
    return m
  }

  private px(x: number, y: number, c: Ink): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= RW || y >= RH) return
    this.frame.px[y * RW + x] = c
  }

  private anim(name: string, t: number, phase = 0): IFrame {
    const a = this.sprites[name]
    return a.frames[Math.floor(t * a.fps + phase) % a.frames.length]
  }

  private tentacleSprite(threat: Threat): IFrame {
    let f = this.tentacles.get(threat.id)
    if (!f) {
      const len = Math.max(12, Math.round((threat.reach ?? 100) * K))
      f = buildTentacleArm(len, Math.round(TENTACLE_THICKNESS * K), threat.id)
      if (threat.side === 'right') f = imirrorX(f)
      this.tentacles.set(threat.id, f)
      if (this.tentacles.size > 24) this.tentacles.delete(this.tentacles.keys().next().value!)
    }
    return f
  }

  private chainSprite(threat: Threat, len: number): IFrame {
    let f = this.chains.get(threat.id)
    if (!f) {
      f = buildChain(len, threat.id)
      this.chains.set(threat.id, f)
      if (this.chains.size > 40) this.chains.delete(this.chains.keys().next().value!)
    }
    return f
  }

  // -------------------------------------------------------------------------
  // Simulation of renderer-local FX (mirrors render2d.ts)
  // -------------------------------------------------------------------------

  update(world: World, phase: GamePhase, dt: number, t: number): void {
    const running = phase !== 'paused'
    if (!running) dt = 0

    if (world.elapsed < this.lastElapsed || world.effects.length < this.consumedEffects) {
      this.consumedEffects = 0
      this.booms = []
      this.rings = []
      this.sparks = []
      this.wake = []
      this.subFlash.clear()
      this.subFireIn.clear()
      this.tentacles.clear()
      this.chains.clear()
      this.trails.clear()
      this.trailAccum.clear()
    }
    this.lastElapsed = world.elapsed

    while (this.consumedEffects < world.effects.length) {
      const e = world.effects[this.consumedEffects++]
      if (e.kind === 'pickup') {
        this.rings.push({ x: e.x, y: e.y, t: 0 })
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4
          const sp = 60 + Math.random() * 50
          this.sparks.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0 })
        }
      } else {
        const anim = e.kind === 'hit' ? 'explosionS' : e.kind === 'kill' ? 'explosionM' : 'explosionL'
        this.booms.push({ x: e.x, y: e.y, anim, t: 0 })
      }
    }

    if (world.boss && world.boss.phase === 'exploding') {
      this.bossChainT -= dt
      if (this.bossChainT <= 0) {
        this.bossChainT = 0.13
        const span = world.boss.variant === 'kracken' ? 180 : 165
        this.booms.push({
          x: world.boss.x + (Math.random() * 2 - 1) * span,
          y: world.boss.y + (Math.random() * 2 - 1) * 55,
          anim: 'explosionM',
          t: 0,
        })
      }
    }

    for (const b of this.booms) b.t += dt
    this.booms = this.booms.filter((b) => {
      const a = this.sprites[b.anim]
      return b.t < a.frames.length / a.fps
    })
    for (const r of this.rings) r.t += dt
    this.rings = this.rings.filter((r) => r.t < 0.5)
    for (const s of this.sparks) {
      s.t += dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vx *= 1 - Math.min(1, dt * 3)
      s.vy *= 1 - Math.min(1, dt * 3)
    }
    this.sparks = this.sparks.filter((s) => s.t < 0.4)
    for (const p of this.wake) {
      p.t += dt
      p.y -= 30 * dt
    }
    this.wake = this.wake.filter((p) => p.t < 0.6)
    for (const m of this.motes) {
      m.y -= m.speed * dt
      if (m.y < -4) {
        m.y = RH + 4
        m.x = Math.random() * RW
      }
    }
    if (running) {
      for (const m of world.missiles) {
        if (Math.random() < dt * 18)
          this.wake.push({ x: m.x * K + (Math.random() * 4 - 2), y: m.y * K - 12, t: 0, size: Math.floor(Math.random() * 3) })
      }
      if (Math.random() < dt * 16) {
        const side = Math.random() < 0.5 ? -1 : 1
        this.wake.push({ x: world.subX * K + side * 6, y: SUB_Y * K - 24, t: 0, size: Math.floor(Math.random() * 2) })
      }
      for (const threat of world.threats) {
        if (threat.type !== 'redFish' && threat.type !== 'squid') continue
        const acc = (this.trailAccum.get(threat.id) ?? 0) + dt
        if (acc < 0.09) {
          this.trailAccum.set(threat.id, acc)
          continue
        }
        this.trailAccum.set(threat.id, 0)
        const pts = this.trails.get(threat.id) ?? []
        pts.push({ x: threat.x, y: threat.y, t: 0 })
        if (pts.length > 6) pts.shift()
        this.trails.set(threat.id, pts)
      }
    }
    for (const pts of this.trails.values()) for (const p of pts) p.t += dt
    for (const [id, pts] of this.trails) {
      const kept = pts.filter((p) => p.t < 0.9)
      if (kept.length) this.trails.set(id, kept)
      else {
        this.trails.delete(id)
        this.trailAccum.delete(id)
      }
    }
    for (const threat of world.threats) {
      if (threat.type !== 'sub') continue
      const last = this.subFireIn.get(threat.id)
      if (last !== undefined && threat.fireIn > last) this.subFlash.set(threat.id, 0.16)
      this.subFireIn.set(threat.id, threat.fireIn)
    }
    for (const [id, ft] of this.subFlash) {
      if (ft - dt <= 0) this.subFlash.delete(id)
      else this.subFlash.set(id, ft - dt)
    }

    this.draw(world, t)
  }

  // -------------------------------------------------------------------------
  // Board
  // -------------------------------------------------------------------------

  /** Trench wall width (px) at a world row, per side — chunky 4px ledges. */
  private wallWidth(wy: number, side: 0 | 1): number {
    const q = Math.floor(wy / 4)
    const seed = side ? 77 : 33
    return Math.round(4 + noise1(q / 11, seed) * 9 + noise1(q / 3.3, seed + 5) * 3)
  }

  private drawWalls(scroll: number, t: number): void {
    const px = this.frame.px
    for (let y = 0; y < RH; y++) {
      const wy = Math.floor(scroll) + y
      for (const side of [0, 1] as const) {
        const w = this.wallWidth(wy, side)
        for (let i = 0; i < w; i++) {
          const x = side === 0 ? i : RW - 1 - i
          const din = w - 1 - i // 0 at the water-facing edge
          let c: Ink
          if (din === 0) c = FG
          else if (din === 1) c = INK
          else {
            // brick-ish rock blocks, fg dithered brighter toward the water
            const bh = 6
            const row = Math.floor(wy / bh)
            const bw = 7 + (row % 3)
            const off = (row * 5) % bw
            const cx = (i + off) % bw
            const cy = ((wy % bh) + bh) % bh
            if (cx === 0 || cy === 0) c = INK
            else {
              const lvl = 0.62 - (i / 16) * 0.5 + (hash(Math.floor((i + off) / bw), row, 9 + side) - 0.5) * 0.3
              c = dith(x, wy, lvl) ? FG : INK
            }
          }
          px[y * RW + x] = c
        }
      }
    }
    // growth rooted on the walls: accent2 kelp, accent coral, fg anemones
    const step = 26
    const first = Math.floor(scroll / step) - 2
    for (let k = first; k < first + RH / step + 5; k++) {
      for (const side of [0, 1] as const) {
        const r = hash(k, side, 511)
        if (r < 0.45) continue
        const wy = k * step + Math.floor(hash(k, side, 512) * step)
        const y = wy - scroll
        const edge = this.wallWidth(wy, side)
        const dir = side === 0 ? 1 : -1
        const x0 = side === 0 ? edge : RW - 1 - edge
        if (r < 0.7) {
          // kelp: a wavy accent2 strand rising off the ledge, leaves on alternating sides
          const len = 14 + Math.floor(hash(k, side, 513) * 22)
          for (let j = 0; j < len; j++) {
            const sway = Math.sin(t * 1.3 + k + j * 0.25) * (j / len) * 3
            const xx = x0 + dir * (1 + Math.round(j * 0.25 + sway))
            this.px(xx, y - j, ACC2)
            if (j % 5 === 2) this.px(xx + (j % 10 === 2 ? 1 : -1), y - j - 1, ACC2)
          }
        } else if (r < 0.86) {
          // coral: a small branching accent fan
          const h = 6 + Math.floor(hash(k, side, 514) * 6)
          for (let j = 0; j < h; j++) {
            this.px(x0 + dir * (1 + j * 0.5), y - j, ACC)
            if (j > 2 && j % 2 === 0) {
              this.px(x0 + dir * (2 + j * 0.5), y - j - 1, ACC)
              this.px(x0 + dir * (1 + j * 0.2), y - j - 2, ACC)
            }
          }
          this.px(x0 + dir * (1 + h * 0.5), y - h, FG)
        } else {
          // anemone: fg tendrils waving from a bg-ink bulb
          for (let a = 0; a < 5; a++) {
            const ang = -Math.PI / 2 + (a - 2) * 0.45
            for (let j = 1; j < 6; j++) {
              const w = Math.sin(t * 2.2 + a + k) * 0.25
              this.px(x0 + dir * (3 + Math.cos(ang + w) * j * dir), y + Math.sin(ang + w) * j, j === 5 ? ACC : FG)
            }
          }
          this.px(x0 + dir * 2, y, FG)
          this.px(x0 + dir * 3, y, FG)
        }
      }
    }
  }

  private drawHeadlight(subX: number): void {
    const top = Math.round(SUB_Y * K) + 26
    const len = 110
    const px = this.frame.px
    for (let j = 0; j < len; j++) {
      const y = top + j
      if (y >= RH) break
      const half = 3 + j * 0.3
      const lvl = 0.09 * (1 - j / len)
      const cx = subX * K
      for (let x = Math.max(0, Math.floor(cx - half)); x <= Math.min(RW - 1, cx + half); x++) {
        const i = y * RW + x
        if (px[i] !== INK) continue
        const edge = Math.abs(x - cx) > half - 1
        if (edge ? dith(x, y, lvl * 4) : dith(x, y, lvl)) px[i] = ACC2
      }
    }
  }

  private drawBossFloor(t: number): void {
    const px = this.frame.px
    const top = Math.round(RH * 0.72)
    for (let y = top; y < RH; y++) {
      const p = (y - top) / (RH - top)
      const lvl = Math.min(0.5, p * 0.75)
      for (let x = 0; x < RW; x++) {
        const i = y * RW + x
        if (px[i] !== INK) continue
        // a slow heat shimmer rolling the dither rows
        if (dith(x + Math.round(Math.sin(t * 2 + y * 0.2) * 2), y, lvl)) px[i] = ACC
      }
    }
    for (let x = 0; x < RW; x += 3) {
      const y = top + Math.round(Math.sin(t * 1.5 + x * 0.21) * 3 + Math.sin(x * 0.07) * 4)
      this.px(x, y - 2, FG)
    }
  }

  private drawLaser(world: World, t: number): void {
    const xc = world.laserX * K
    const hw = LASER_HALF_WIDTH * K
    const top = Math.round(SUB_Y * K) + 22
    const px = this.frame.px
    const scan = Math.floor(t * 60)
    for (let y = top; y < RH; y++) {
      for (let x = Math.max(0, Math.floor(xc - hw)); x <= Math.min(RW - 1, xc + hw); x++) {
        const d = Math.abs(x - xc) / hw
        let c: Ink = CLEAR
        if (d < 0.18) c = FG
        else if (d < 0.24) c = ACC2
        else if (d < 0.6) c = dith(x, y + scan, 0.5 - (d - 0.24)) ? ACC2 : CLEAR
        else if (d > 0.96) c = (y + scan) % 4 < 2 ? ACC2 : CLEAR
        else if (dith(x, y + scan, 0.12)) c = ACC2
        if (c) px[y * RW + x] = c
      }
    }
    for (let i = 0; i < 8; i++) {
      const sx = xc + (Math.random() * 2 - 1) * hw * 0.55
      const sy = top + Math.random() * (RH - top)
      this.px(sx, sy, FG)
      this.px(sx + 1, sy, INK)
    }
  }

  private drawHud(world: World): void {
    const f = this.frame
    // hull pips, top-left, Downwell HP-bar style
    for (let i = 0; i < LIVES_MAX; i++) this.blit(this.pips[i < world.lives ? 0 : 1], 6 + i * 6, 6)
    drawText(f, `${world.lives}/${LIVES_MAX}`, 6 + LIVES_MAX * 6 + 3, 6, FG)
    // score with the gem, top-right
    const s = String(score(world))
    const sw = textWidth(s, { bold: true })
    drawText(f, s, RW - 8 - sw, 6, FG, { bold: true })
    this.blit(this.gem, RW - 8 - sw - 10, 4)
    // depth, under the score
    const d = `${leaguesForDepth(world.depth)}L`
    drawText(f, d, RW - 8 - textWidth(d), 14, ACC2)
    // weapon gauge down the right wall: spread timer, then laser charges
    const gx = RW - 7
    const gy = 30
    const gh = 60
    for (let y = 0; y < gh; y++) {
      this.px(gx, gy + y, INK)
      this.px(gx + 3, gy + y, INK)
      this.px(gx + 1, gy + y, y === 0 || y === gh - 1 ? FG : INK)
      this.px(gx + 2, gy + y, y === 0 || y === gh - 1 ? FG : INK)
    }
    const fill = world.weaponMode === 'shotgun' ? Math.min(1, world.weaponModeT / 9) : 0
    for (let y = 0; y < Math.round((gh - 2) * fill); y++) {
      this.px(gx + 1, gy + gh - 2 - y, ACC)
      this.px(gx + 2, gy + gh - 2 - y, ACC)
    }
    for (let i = 0; i < world.laserCharges; i++) {
      const by = gy + gh + 4 + i * 6
      this.px(gx + 2, by, ACC2)
      this.px(gx + 1, by + 1, ACC2)
      this.px(gx + 2, by + 1, ACC2)
      this.px(gx + 1, by + 2, ACC2)
      this.px(gx + 1, by + 3, FG)
    }
    // boss health: a notched accent bar across the top, named
    if (world.boss && world.boss.phase !== 'exploding') {
      const name = world.boss.variant === 'kracken' ? 'THE KRACKEN' : 'THE WARDEN'
      const bw = 120
      const bx = Math.round((RW - bw) / 2)
      const by = 26
      drawText(f, name, Math.round((RW - textWidth(name, { bold: true })) / 2), by - 8, ACC, { bold: true })
      const frac = world.boss.hp / world.boss.maxHp
      for (let x = 0; x < bw; x++)
        for (let y = 0; y < 4; y++) {
          const edge = y === 0 || y === 3 || x === 0 || x === bw - 1
          const on = x / bw < frac && x % 6 !== 5
          this.px(bx + x, by + y, edge ? FG : on ? ACC : INK)
        }
    }
  }

  draw(world: World, t: number): void {
    const px = this.frame.px
    px.fill(INK)
    const scroll = world.depth * K

    // far motes: fg marine snow drifting up; near motes: accent2 bubbles
    for (const m of this.motes) {
      if (m.layer === 0) this.px(m.x, m.y, dith(Math.round(m.x), Math.round(m.y), 0.7) ? FG : ACC2)
      else this.blit(this.sprites.bubbles.frames[1 + (Math.floor(m.x) % 2)], m.x, m.y)
    }

    if (world.boss) this.drawBossFloor(t)
    this.drawWalls(scroll, t)
    if (this.opts.headlight && !world.collided) this.drawHeadlight(world.subX)

    // terrain hazards: tentacle limbs and mine-wall tethers
    for (const threat of world.threats) {
      if (threat.type === 'tentacle') {
        const s = this.tentacleSprite(threat)
        const x = threat.side === 'left' ? 0 : RW - s.w
        this.blit(s, x, threat.y * K - s.h / 2 + Math.sin(t * 1.4 + threat.phase) * 2)
      } else if (threat.type === 'mineWall') {
        const bob = mineWallBob(t, threat.phase)
        const wallX = threat.side === 'left' ? 0 : RW
        const len = Math.max(8, Math.round(Math.abs(threat.x * K - wallX)))
        const chain = this.chainSprite(threat, len)
        const cx = threat.side === 'left' ? 0 : RW - chain.w
        this.blit(chain, cx, (threat.y + bob) * K - chain.h / 2)
      }
    }

    // pickups
    for (const p of world.powerups) {
      const frames = this.sprites[`pod_${p.type}`].frames
      this.drawAt(frames[Math.floor(t * 3) % 2], p.x, p.y + Math.sin(t * 2 + p.id) * 3)
    }

    // threats
    for (const threat of world.threats) {
      if (threat.type === 'tentacle') continue
      if (threat.type === 'mine') {
        const armed = threat.y <= SUB_Y + MINE_FUSE_RANGE + 140
        this.drawAt(this.sprites.mine.frames[Math.floor(t * (armed ? 9 : 3)) % 2], threat.x, threat.y)
      } else if (threat.type === 'mineWall') {
        const f = this.sprites.mine.frames[Math.floor(t * 2 + threat.phase) % 2]
        this.drawAt(f, threat.x, threat.y + mineWallBob(t, threat.phase))
      } else if (threat.type === 'sub') {
        const f = this.subFlash.has(threat.id) ? this.sprites.enemySubFire.frames[0] : this.anim('enemySub', t, threat.phase)
        this.drawAt(f, threat.x, threat.y)
      } else if (threat.type === 'squid') {
        this.drawTrail(threat.id)
        this.drawAt(this.anim('squid', t, threat.phase), threat.x, threat.y)
      } else {
        if (threat.type === 'redFish') this.drawTrail(threat.id)
        const name = threat.type === 'fish' ? 'frogman' : threat.type === 'redFish' ? 'redFish' : 'angler'
        const f = this.anim(name, t, threat.phase)
        const movingRight = Math.cos(world.elapsed * 1.6 + threat.phase) > 0
        this.drawAt(movingRight ? this.mirror(f) : f, threat.x, threat.y)
      }
    }

    // boss
    if (world.boss) {
      const boss = world.boss
      const frames = this.sprites[boss.variant === 'kracken' ? 'bossKracken' : 'bossWarden'].frames
      let f: IFrame
      let sx = 0
      let sy = 0
      if (boss.phase === 'exploding') {
        f = frames[3]
        sx = Math.round((Math.random() * 2 - 1) * 2)
        sy = Math.round((Math.random() * 2 - 1) * 2)
      } else if (boss.mouthOpenT > 0) f = frames[2]
      else f = frames[Math.floor(t * 2) % 2]
      this.blit(f, boss.x * K - f.w / 2 + sx, boss.y * K - f.h / 2 + sy)
    }

    // player
    const lean = world.subTargetX - world.subX
    const pose = lean < -8 ? 'playerBankL' : lean > 8 ? 'playerBankR' : 'playerIdle'
    const flicker = world.invincibleT > 0 && Math.floor(t * 16) % 2 === 0
    if (!flicker && !world.collided) this.drawAt(this.anim(pose, t), world.subX, SUB_Y)
    if (!world.collided) {
      const hs = Math.max(2, Math.round(HIT_R * 2 * K))
      const hx = Math.round(world.subX * K - hs / 2)
      const hy = Math.round((SUB_Y + HIT_OFFSET_Y) * K - hs / 2)
      const low = world.lives / LIVES_MAX <= 1 / 3
      for (let y = -1; y <= hs; y++)
        for (let x = -1; x <= hs; x++) {
          const edge = x < 0 || y < 0 || x >= hs || y >= hs
          this.px(hx + x, hy + y, edge ? INK : low && Math.floor(t * 6) % 2 === 0 ? ACC : ACC2)
        }
    }

    if (world.laserT > 0) this.drawLaser(world, t)

    // wakes + projectiles
    const bub = this.sprites.bubbles.frames
    for (const p of this.wake) this.blit(bub[p.size], p.x, p.y, 1 - p.t / 0.6)
    for (const m of world.missiles) this.drawAt(this.anim('torpedo', t, m.id), m.x, m.y)
    for (const p of world.projectiles) {
      if (p.kind === 'sub') this.drawAt(this.anim('tracer', t, p.id), p.x, p.y)
      else this.drawAt(this.sprites.shrapnel.frames[Math.floor(t * 10 + p.id) % 4], p.x, p.y)
    }

    // FX
    for (const r of this.rings) {
      const rad = (4 + r.t * 56) * K
      const lvl = 1 - r.t / 0.5
      for (let a = 0; a < 48; a++) {
        const x = r.x * K + Math.cos((a / 48) * Math.PI * 2) * rad
        const y = r.y * K + Math.sin((a / 48) * Math.PI * 2) * rad
        if (dith(Math.round(x), Math.round(y), lvl + 0.2)) this.px(x, y, ACC2)
      }
    }
    for (const s of this.sparks) {
      const life = 1 - s.t / 0.4
      const c: Ink = s.t < 0.12 ? FG : ACC2
      this.px(s.x * K, s.y * K, c)
      if (life > 0.5) this.px(s.x * K + 1, s.y * K, c)
    }
    for (const b of this.booms) {
      const a = this.sprites[b.anim]
      this.drawAt(a.frames[Math.min(a.frames.length - 1, Math.floor(b.t * a.fps))], b.x, b.y)
    }

    if (this.opts.hud) this.drawHud(world)
  }

  private drawTrail(id: number): void {
    const pts = this.trails.get(id)
    if (!pts) return
    const bub = this.sprites.bubbles.frames[1]
    for (const p of pts) {
      const life = 1 - p.t / 0.9
      if (life > 0) this.blit(bub, p.x * K - 1, p.y * K - 1, life * 0.7)
    }
  }
}
