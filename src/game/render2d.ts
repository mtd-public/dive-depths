/**
 * render2d.ts — the "In the Hunt"-style pixel renderer, replacing the old
 * three.js Scene3D behind the exact same interface (constructor, resize,
 * update(world, phase, dt, t), dispose), so GameCanvas and physics.ts are
 * untouched by the art swap.
 *
 * The board's 400×800 logical units map onto a fixed 256×512 internal
 * canvas (0.64 px per unit); sprites from pixelArt.ts draw at their native
 * 1× pixel size on that grid, and CSS scales the canvas up chunky.
 */
import {
  BOARD_W,
  SUB_Y,
  HIT_OFFSET_Y,
  HIT_R,
  LIVES_MAX,
  LASER_HALF_WIDTH,
  MINE_FUSE_RANGE,
  TENTACLE_THICKNESS,
  leaguesForDepth,
  type Threat,
  type World,
} from './physics'
import type { GamePhase } from './types'
import {
  buildAllSprites,
  buildChain,
  buildPods,
  buildTentacleArm,
  frameToCanvas,
  mirrorX,
  BOSS_TINTS,
  WATER_CYCLE_LEAGUES,
  WATER_ORDER,
  WATER_PALETTES,
  type Frame,
  type SpriteSet,
  type PodKind,
} from './pixelArt'

const RW = 256
const RH = 512
const K = RW / BOARD_W // 0.64 px per board unit

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
interface Ambient {
  x: number
  y: number
  size: number
  speed: number
}
interface EdgeBubble {
  x: number
  yOff: number
  phase: number
  size: number
}

/** A moored mine's gentle vertical float on its chain — slightly up, slightly
 *  down, never the fast arming blink a free proximity mine gets. */
const mineWallBob = (t: number, phase: number): number => Math.sin(t * 1.7 + phase) * 5

const hex2rgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
const mixHex = (a: string, b: string, t: number): string => {
  const ra = hex2rgb(a)
  const rb = hex2rgb(b)
  const c = ra.map((v, i) => Math.round(v + (rb[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export class Render2D {
  private ctx: CanvasRenderingContext2D
  private sprites: SpriteSet
  private pods: Record<PodKind, Frame[]>
  private canvases = new Map<Frame, HTMLCanvasElement>()
  private tentacles = new Map<number, HTMLCanvasElement>()
  private chains = new Map<number, HTMLCanvasElement>()
  private subFlash = new Map<number, number>() // enemy sub id → muzzle flash time left
  private subFireIn = new Map<number, number>() // enemy sub id → last seen fireIn
  // redFish/squid only: a short trail of bubbles marking recent positions
  private trails = new Map<number, TrailPoint[]>()
  private trailAccum = new Map<number, number>()
  private booms: Boom[] = []
  private rings: Ring[] = []
  private sparks: Spark[] = []
  private wake: Puff[] = []
  private ambient: Ambient[] = []
  private bossEdgeBubbles: EdgeBubble[] = []
  private consumedEffects = 0
  private lastElapsed = 0
  private bossChainT = 0

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = RW
    canvas.height = RH
    this.ctx = canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
    this.sprites = buildAllSprites()
    this.pods = buildPods()
    for (let i = 0; i < 26; i++) {
      this.ambient.push({
        x: Math.random() * RW,
        y: Math.random() * RH,
        size: Math.floor(Math.random() * 3),
        speed: 8 + Math.random() * 14,
      })
    }
    for (let i = 0; i < 24; i++) {
      this.bossEdgeBubbles.push({
        x: Math.random() * RW,
        yOff: (Math.random() * 2 - 1) * 16,
        phase: Math.random() * Math.PI * 2,
        size: Math.floor(Math.random() * 3),
      })
    }
  }

  /** The internal resolution is fixed; CSS scales the canvas to the shell. */
  resize(_w: number, _h: number): void {}

  dispose(): void {
    this.canvases.clear()
    this.tentacles.clear()
    this.chains.clear()
  }

  private fc(f: Frame): HTMLCanvasElement {
    let c = this.canvases.get(f)
    if (!c) {
      c = frameToCanvas(f)
      this.canvases.set(f, c)
    }
    return c
  }

  private drawAt(f: Frame, ux: number, uy: number): void {
    this.ctx.drawImage(this.fc(f), Math.round(ux * K - f.w / 2), Math.round(uy * K - f.h / 2))
  }

  private animFrame(name: string, t: number, phase = 0): Frame {
    const a = this.sprites[name]
    return a.frames[Math.floor(t * a.fps + phase) % a.frames.length]
  }

  private tentacleSprite(threat: Threat): HTMLCanvasElement {
    let c = this.tentacles.get(threat.id)
    if (!c) {
      const len = Math.max(12, Math.round((threat.reach ?? 100) * K))
      const thick = Math.round(TENTACLE_THICKNESS * K)
      let frame = buildTentacleArm(len, thick, threat.id)
      if (threat.side === 'right') frame = mirrorX(frame)
      c = frameToCanvas(frame)
      this.tentacles.set(threat.id, c)
      // prune sprites for threats that no longer exist
      if (this.tentacles.size > 24) {
        for (const key of this.tentacles.keys()) {
          if (key !== threat.id) {
            this.tentacles.delete(key)
            break
          }
        }
      }
    }
    return c
  }

  /** The mooring line for a mineWall link, wall → mine, cached per threat. */
  private chainSprite(threat: Threat, len: number): HTMLCanvasElement {
    let c = this.chains.get(threat.id)
    if (!c) {
      c = frameToCanvas(buildChain(len, threat.id))
      this.chains.set(threat.id, c)
      if (this.chains.size > 40) {
        for (const key of this.chains.keys()) {
          if (key !== threat.id) {
            this.chains.delete(key)
            break
          }
        }
      }
    }
    return c
  }

  /** Fading bubble breadcrumbs marking a redFish/squid's recent positions. */
  private drawTrail(id: number): void {
    const pts = this.trails.get(id)
    if (!pts || !pts.length) return
    const bub = this.fc(this.sprites.bubbles.frames[0])
    for (const p of pts) {
      const life = 1 - p.t / 0.9
      if (life <= 0) continue
      this.ctx.globalAlpha = life * 0.5
      this.ctx.drawImage(bub, Math.round(p.x * K - bub.width / 2), Math.round(p.y * K - bub.height / 2))
    }
    this.ctx.globalAlpha = 1
  }

  // -------------------------------------------------------------------------

  update(world: World, phase: GamePhase, dt: number, t: number): void {
    const running = phase !== 'paused'
    if (!running) dt = 0

    // a fresh world (new game) resets all renderer-local state
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

    // drain new physics events into FX
    while (this.consumedEffects < world.effects.length) {
      const e = world.effects[this.consumedEffects++]
      if (e.kind === 'pickup') {
        this.rings.push({ x: e.x, y: e.y, t: 0 })
        // a little starburst of sparks flung outward from the pod, In the
        // Hunt's "picked something up" flourish rather than just a ring
        const count = 7
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + Math.random() * 0.4
          const speed = 60 + Math.random() * 50
          this.sparks.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, t: 0 })
        }
      } else {
        const anim = e.kind === 'hit' ? 'explosionS' : e.kind === 'kill' ? 'explosionM' : 'explosionL'
        this.booms.push({ x: e.x, y: e.y, anim, t: 0 })
      }
    }

    // boss death: a rolling chain of explosions along the hull
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

    // clocks
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
    for (const a of this.ambient) {
      a.y -= a.speed * dt
      if (a.y < -4) {
        a.y = RH + 4
        a.x = Math.random() * RW
      }
    }
    // torpedo bubble wakes
    if (running) {
      for (const m of world.missiles) {
        if (Math.random() < dt * 18) {
          this.wake.push({ x: m.x * K + (Math.random() * 4 - 2), y: m.y * K - 12, t: 0, size: Math.floor(Math.random() * 2) })
        }
      }
    }
    // player prop wash: a steady trickle of exhaust bubbles off the stern
    if (running && Math.random() < dt * 16) {
      const side = Math.random() < 0.5 ? -1 : 1
      this.wake.push({
        x: world.subX * K + side * 6 + (Math.random() * 3 - 1.5),
        y: SUB_Y * K - 22,
        t: 0,
        size: Math.floor(Math.random() * 2),
      })
    }
    // redFish/squid: sample a trail point every ~90ms while they're alive
    if (running) {
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

    // enemy sub muzzle flashes: fireIn resets upward when a shot goes out
    for (const threat of world.threats) {
      if (threat.type !== 'sub') continue
      const last = this.subFireIn.get(threat.id)
      if (last !== undefined && threat.fireIn > last) this.subFlash.set(threat.id, 0.16)
      this.subFireIn.set(threat.id, threat.fireIn)
    }
    for (const [id, ft] of this.subFlash) {
      const next = ft - dt
      if (next <= 0) this.subFlash.delete(id)
      else this.subFlash.set(id, next)
    }

    this.draw(world, t)
  }

  // -------------------------------------------------------------------------

  private draw(world: World, t: number): void {
    const ctx = this.ctx
    ctx.imageSmoothingEnabled = false

    // --- water: zone palette by leagues, cross-fading at each rotation ---
    const leagues = leaguesForDepth(world.depth)
    const zone = Math.floor(leagues / WATER_CYCLE_LEAGUES) % WATER_ORDER.length
    const into = leagues % WATER_CYCLE_LEAGUES
    const fade = leagues < WATER_CYCLE_LEAGUES ? 1 : Math.min(1, into / 150)
    const cur = WATER_PALETTES[WATER_ORDER[zone]].bands
    const prev = WATER_PALETTES[WATER_ORDER[(zone + WATER_ORDER.length - 1) % WATER_ORDER.length]].bands
    const bands = cur.map((b, i) => (fade >= 1 ? b : mixHex(prev[i], b, fade)))
    const bh = RH / bands.length
    for (let i = 0; i < bands.length; i++) {
      ctx.fillStyle = bands[i]
      ctx.fillRect(0, Math.floor(i * bh), RW, Math.ceil(bh))
    }
    // dither seam between bands
    ctx.globalAlpha = 0.55
    for (let i = 1; i < bands.length; i++) {
      ctx.fillStyle = bands[i]
      const y = Math.floor(i * bh) - 1
      for (let x = (i % 2); x < RW; x += 2) ctx.fillRect(x, y, 1, 1)
    }
    ctx.globalAlpha = 1

    // --- boss room haze: the bottom quarter of the board recolors to the
    // active boss's own hide/plate palette; the 3/4 above it stays the
    // normal depth water untouched — a haze confined to its own floor,
    // not a wash over the whole screen. ---
    if (world.boss) {
      const variant: 'warden' | 'kracken' = world.boss.variant === 'kracken' ? 'kracken' : 'warden'
      const tint = BOSS_TINTS[variant]
      const edgeY = RH * 0.75
      // short fade right at the top of the haze band, in the same stepped
      // tones as everything else (no smooth canvas gradients)
      const fadeSteps = 5
      const fadeSpan = RH * 0.06
      for (let i = 0; i < fadeSteps; i++) {
        const y0 = edgeY + (fadeSpan * i) / fadeSteps
        const y1 = edgeY + (fadeSpan * (i + 1)) / fadeSteps
        ctx.fillStyle = mixHex(bands[bands.length - 1], tint.bands[0], (i + 1) / fadeSteps)
        ctx.fillRect(0, Math.floor(y0), RW, Math.ceil(y1 - y0))
      }
      // full tint for the rest of the bottom quarter
      const bandsTop = edgeY + fadeSpan
      const tBandH = (RH - bandsTop) / tint.bands.length
      for (let i = 0; i < tint.bands.length; i++) {
        ctx.fillStyle = tint.bands[i]
        ctx.fillRect(0, Math.floor(bandsTop + i * tBandH), RW, Math.ceil(tBandH))
      }
      ctx.globalAlpha = 0.55
      for (let i = 1; i < tint.bands.length; i++) {
        ctx.fillStyle = tint.bands[i]
        const y = Math.floor(bandsTop + i * tBandH) - 1
        for (let x = (i % 2); x < RW; x += 2) ctx.fillRect(x, y, 1, 1)
      }
      ctx.globalAlpha = 1

      // bubbles shrouding the transition, obscuring the seam
      const bossBub = this.sprites.bubbles.frames
      for (const b of this.bossEdgeBubbles) {
        const yy = edgeY + b.yOff + Math.sin(t * 1.1 + b.phase) * 8
        const xx = b.x + Math.sin(t * 0.6 + b.phase * 1.7) * 6
        ctx.globalAlpha = 0.5
        ctx.drawImage(this.fc(bossBub[b.size]), Math.round(xx), Math.round(yy))
      }
      ctx.globalAlpha = 1
    }

    // --- ambient bubbles ---
    const bub = this.sprites.bubbles.frames
    ctx.globalAlpha = 0.45
    for (const a of this.ambient) {
      ctx.drawImage(this.fc(bub[a.size]), Math.round(a.x), Math.round(a.y))
    }
    ctx.globalAlpha = 1

    // --- terrain, behind everything that moves: tentacles + mine-wall tethers ---
    for (const threat of world.threats) {
      if (threat.type === 'tentacle') {
        const sprite = this.tentacleSprite(threat)
        const x = threat.side === 'left' ? 0 : RW - sprite.width
        const sway = Math.sin(t * 1.4 + threat.phase) * 2
        ctx.drawImage(sprite, x, Math.round(threat.y * K - sprite.height / 2 + sway))
      } else if (threat.type === 'mineWall') {
        const bob = mineWallBob(t, threat.phase)
        const wallX = threat.side === 'left' ? 0 : RW
        const len = Math.max(8, Math.round(Math.abs(threat.x * K - wallX)))
        const chain = this.chainSprite(threat, len)
        const cx = threat.side === 'left' ? 0 : RW - chain.width
        ctx.drawImage(chain, cx, Math.round((threat.y + bob) * K - chain.height / 2))
      }
    }

    // --- power-up pods ---
    for (const p of world.powerups) {
      const frames = this.pods[p.type]
      this.drawAt(frames[Math.floor(t * 3) % 2], p.x, p.y + Math.sin(t * 2 + p.id) * 3)
    }

    // --- threats ---
    for (const threat of world.threats) {
      if (threat.type === 'tentacle') continue
      if (threat.type === 'mine') {
        const armed = threat.y <= SUB_Y + MINE_FUSE_RANGE + 140
        const f = this.sprites.mine.frames[Math.floor(t * (armed ? 9 : 3)) % 2]
        this.drawAt(f, threat.x, threat.y)
      } else if (threat.type === 'mineWall') {
        // calm, un-arming blink — this one only goes off if it's actually hit
        const f = this.sprites.mine.frames[Math.floor(t * 2 + threat.phase) % 2]
        this.drawAt(f, threat.x, threat.y + mineWallBob(t, threat.phase))
      } else if (threat.type === 'sub') {
        const f = this.subFlash.has(threat.id)
          ? this.sprites.enemySubFire.frames[0]
          : this.animFrame('enemySub', t, threat.phase)
        this.drawAt(f, threat.x, threat.y)
      } else if (threat.type === 'squid') {
        // holds its column — no horizontal wander to face, just bob in place
        this.drawTrail(threat.id)
        this.drawAt(this.animFrame('squid', t, threat.phase), threat.x, threat.y)
      } else {
        // fish → frogman squad, monster → angler drone, redFish → itself;
        // all three face whichever way their wander is currently carrying them
        if (threat.type === 'redFish') this.drawTrail(threat.id)
        const name = threat.type === 'fish' ? 'frogman' : threat.type === 'redFish' ? 'redFish' : 'angler'
        const f = this.animFrame(name, t, threat.phase)
        const movingRight = Math.cos(world.elapsed * 1.6 + threat.phase) > 0
        if (movingRight) {
          ctx.save()
          ctx.translate(Math.round(threat.x * K + f.w / 2), Math.round(threat.y * K - f.h / 2))
          ctx.scale(-1, 1)
          ctx.drawImage(this.fc(f), 0, 0)
          ctx.restore()
        } else {
          this.drawAt(f, threat.x, threat.y)
        }
      }
    }

    // --- boss ---
    if (world.boss) {
      const boss = world.boss
      const name = boss.variant === 'kracken' ? 'bossKracken' : 'bossWarden'
      const frames = this.sprites[name].frames
      let f: Frame
      let shakeX = 0
      let shakeY = 0
      if (boss.phase === 'exploding') {
        f = frames[3]
        shakeX = Math.round((Math.random() * 2 - 1) * 2)
        shakeY = Math.round((Math.random() * 2 - 1) * 2)
      } else if (boss.mouthOpenT > 0) {
        f = frames[2]
      } else {
        f = frames[Math.floor(t * 2) % 2]
      }
      this.ctx.drawImage(
        this.fc(f),
        Math.round(boss.x * K - f.w / 2) + shakeX,
        Math.round(boss.y * K - f.h / 2) + shakeY,
      )
    }

    // --- player sub: bank toward the steering target, flicker when hit ---
    const lean = world.subTargetX - world.subX
    const pose = lean < -8 ? 'playerBankL' : lean > 8 ? 'playerBankR' : 'playerIdle'
    const flicker = world.invincibleT > 0 && Math.floor(t * 16) % 2 === 0
    if (!flicker && !world.collided) {
      this.drawAt(this.animFrame(pose, t), world.subX, SUB_Y)
    }
    // the real damage hitbox, drawn at its exact size, colored by lives left
    if (!world.collided) {
      const frac = world.lives / LIVES_MAX
      ctx.fillStyle = frac > 2 / 3 ? '#aef2e0' : frac > 1 / 3 ? '#ffd23e' : '#ff5a4a'
      const hs = Math.max(2, Math.round(HIT_R * 2 * K))
      ctx.globalAlpha = 0.9
      ctx.fillRect(
        Math.round(world.subX * K - hs / 2),
        Math.round((SUB_Y + HIT_OFFSET_Y) * K - hs / 2),
        hs,
        hs,
      )
      ctx.globalAlpha = 1
    }

    // --- laser ultimate: a sustained dithered column tracking the sub ---
    if (world.laserT > 0) {
      const xc = world.laserX * K
      const hw = LASER_HALF_WIDTH * K
      const top = Math.round(SUB_Y * K) + 20
      const pulse = 0.75 + Math.sin(t * 26) * 0.15
      ctx.globalAlpha = 0.35 * pulse
      ctx.fillStyle = '#ff8c1a'
      ctx.fillRect(Math.round(xc - hw), top, Math.round(hw * 2), RH - top)
      ctx.globalAlpha = 0.55 * pulse
      ctx.fillStyle = '#ffd23e'
      ctx.fillRect(Math.round(xc - hw * 0.62), top, Math.round(hw * 1.24), RH - top)
      ctx.globalAlpha = 0.9 * pulse
      ctx.fillStyle = '#fff8d0'
      ctx.fillRect(Math.round(xc - hw * 0.24), top, Math.round(hw * 0.48), RH - top)
      ctx.globalAlpha = 1
      // crackle sparks inside the beam
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 6; i++) {
        const sx = xc + (Math.random() * 2 - 1) * hw * 0.5
        const sy = top + Math.random() * (RH - top)
        ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2)
      }
    }

    // --- projectiles above hulls, In the Hunt style ---
    ctx.globalAlpha = 1
    for (const p of this.wake) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.6) * 0.8
      ctx.drawImage(this.fc(bub[p.size]), Math.round(p.x), Math.round(p.y))
    }
    ctx.globalAlpha = 1
    for (const m of world.missiles) {
      this.drawAt(this.animFrame('torpedo', t, m.id), m.x, m.y)
    }
    for (const p of world.projectiles) {
      if (p.kind === 'sub') {
        this.drawAt(this.animFrame('tracer', t, p.id), p.x, p.y)
      } else {
        const frames = this.sprites.shrapnel.frames
        this.drawAt(frames[Math.floor(t * 10 + p.id) % 4], p.x, p.y)
      }
    }

    // --- FX on top ---
    for (const r of this.rings) {
      const rad = 4 + r.t * 56
      ctx.strokeStyle = '#ffe9a0'
      ctx.globalAlpha = Math.max(0, 1 - r.t / 0.5)
      ctx.beginPath()
      ctx.arc(Math.round(r.x * K), Math.round(r.y * K), rad * K, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    for (const s of this.sparks) {
      const life = Math.max(0, 1 - s.t / 0.4)
      ctx.globalAlpha = life
      ctx.fillStyle = s.t < 0.12 ? '#fff8d0' : '#ffe9a0'
      const sz = Math.max(1, Math.round(2 * life + 1))
      ctx.fillRect(Math.round(s.x * K - sz / 2), Math.round(s.y * K - sz / 2), sz, sz)
    }
    ctx.globalAlpha = 1
    for (const b of this.booms) {
      const a = this.sprites[b.anim]
      const f = a.frames[Math.min(a.frames.length - 1, Math.floor(b.t * a.fps))]
      this.drawAt(f, b.x, b.y)
    }
  }
}
