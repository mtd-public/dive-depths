/**
 * shots.ts — staged concept frames for the two-tone redesign: hand-placed
 * Worlds (real physics types, real scene renderer) posed as screenshots,
 * plus the title and game-over cards. DOM-free, shared by the concepts
 * page and the node PNG export.
 */
import { SUB_Y, createWorld, depthForLeagues, type Threat, type ThreatType, type World } from '../physics'
import { ACC, ACC2, FG, INK, buildLogo, dith, drawText, iblit, textWidth, type IFrame } from './art'
import { RH, RW, TwoToneScene } from './scene'

export type ShotId = 'descent' | 'trench' | 'warden' | 'kracken' | 'title' | 'gameover'

export const SHOTS: { id: ShotId; title: string; blurb: string }[] = [
  { id: 'title', title: 'Title', blurb: 'Logotype, the sub parked in its searchlight, attract prompt.' },
  { id: 'descent', title: 'The Descent', blurb: 'Frogman squad, red fish, an enemy sub firing tracers, a moored mine, a pickup.' },
  { id: 'trench', title: 'Tentacle Trench', blurb: 'Tentacle walls, squid, an angler, the spread shot fanning out.' },
  { id: 'warden', title: 'The Warden', blurb: 'Boss fight: the floor heats to accent, the laser ultimate firing.' },
  { id: 'kracken', title: 'The Kracken', blurb: 'The final boss dying in a rolling chain of bursts. Hull at 2/8.' },
  { id: 'gameover', title: 'Game Over', blurb: 'Hull breached: results card over the wreck.' },
]

let nid = 1000
function threat(type: ThreatType, x: number, y: number, extra: Partial<Threat> = {}): Threat {
  return { id: nid++, type, x, baseX: x, y, phase: (nid * 1.37) % 6, fireIn: 1, ...extra }
}

function baseWorld(leagues: number): World {
  const w = createWorld()
  w.depth = depthForLeagues(leagues)
  w.elapsed = 12
  return w
}

/** Run the scene's FX clock a few frames so wakes and trails exist. */
function warm(scene: TwoToneScene, world: World, t: number, frames = 24): void {
  for (let i = 0; i < frames; i++) scene.update(world, 'playing', 1 / 30, t - (frames - i) / 30)
}

function stageBoom(scene: TwoToneScene, x: number, y: number, anim: 'explosionS' | 'explosionM' | 'explosionL', t: number) {
  scene.booms.push({ x, y, anim, t })
}

function worldFor(id: ShotId): World {
  nid = 1000
  switch (id) {
    case 'descent': {
      const w = baseWorld(3120)
      w.subX = 170
      w.subTargetX = 150
      w.lives = 6
      w.killPoints = 480
      w.threats.push(
        threat('fish', 120, 420, { phase: 0.2 }),
        threat('fish', 170, 455, { phase: 1.1 }),
        threat('fish', 220, 420, { phase: 2.4 }),
        threat('redFish', 300, 330, { phase: 3.3 }),
        threat('sub', 90, 620),
        threat('mine', 290, 560),
        threat('mineWall', 330, 700, { side: 'right' }),
      )
      w.missiles.push({ id: 1, x: 168, y: 250, vx: 0, vy: 620 }, { id: 2, x: 172, y: 350, vx: 0, vy: 620 })
      w.projectiles.push({ id: 3, x: 90, y: 540, vx: 0, vy: -260, kind: 'sub' }, { id: 4, x: 92, y: 470, vx: 0, vy: -260, kind: 'sub' })
      w.powerups.push({ id: 5, type: 'health', x: 250, y: 740 })
      return w
    }
    case 'trench': {
      const w = baseWorld(8840)
      w.subX = 220
      w.subTargetX = 220
      w.lives = 5
      w.killPoints = 1310
      w.weaponMode = 'shotgun'
      w.weaponModeT = 6
      w.threats.push(
        threat('tentacle', 0, 420, { side: 'left', reach: 160 }),
        threat('tentacle', 0, 640, { side: 'right', reach: 150 }),
        threat('squid', 250, 330),
        threat('squid', 300, 500),
        threat('monster', 120, 720),
        threat('redFish', 80, 290),
      )
      w.missiles.push(
        { id: 1, x: 220, y: 262, vx: 0, vy: 620 },
        { id: 2, x: 196, y: 300, vx: -140, vy: 600 },
        { id: 3, x: 244, y: 300, vx: 140, vy: 600 },
      )
      w.powerups.push({ id: 5, type: 'laser', x: 330, y: 760 })
      return w
    }
    case 'warden': {
      const w = baseWorld(12500)
      w.subX = 200
      w.subTargetX = 200
      w.lives = 4
      w.killPoints = 2440
      w.laserT = 3
      w.laserX = 200
      w.laserCharges = 0
      w.boss = {
        id: 1, x: 200, y: 700, hp: 11, maxHp: 18, phase: 'fighting', phaseT: 4, attackIn: 1,
        mouthOpenT: 0.3, variant: 'normal', powerupIn: 9,
      }
      w.threats.push(threat('fish', 90, 470), threat('fish', 310, 460), threat('mine', 60, 380), threat('mine', 350, 350))
      return w
    }
    case 'kracken': {
      const w = baseWorld(20000)
      w.subX = 110
      w.subTargetX = 90
      w.lives = 2
      w.killPoints = 5980
      w.invincibleT = 0
      w.boss = {
        id: 1, x: 200, y: 690, hp: 0, maxHp: 40, phase: 'exploding', phaseT: 0.6, attackIn: 1,
        mouthOpenT: 0, variant: 'kracken', powerupIn: 9,
      }
      w.projectiles.push(
        { id: 3, x: 150, y: 460, vx: 0, vy: -190, kind: 'mine' },
        { id: 4, x: 230, y: 420, vx: 0, vy: -190, kind: 'mine' },
        { id: 6, x: 300, y: 480, vx: 0, vy: -190, kind: 'mine' },
      )
      w.powerups.push({ id: 5, type: 'extraLife', x: 200, y: 520 })
      return w
    }
    default: {
      const w = baseWorld(640)
      w.subX = 200
      w.subTargetX = 200
      w.threats.push(threat('redFish', 300, 600), threat('squid', 90, 700))
      return w
    }
  }
}

/** Center a line of text on the board. */
function centered(f: IFrame, s: string, y: number, c: 2 | 3 | 4, scale = 1, bold = false): void {
  drawText(f, s, Math.round((RW - textWidth(s, { scale, bold })) / 2), y, c, { scale, bold })
}

/** A bg-filled panel with a doubled fg frame, for cards over the board. */
function panel(f: IFrame, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const e = xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1
      const e2 = xx === x + 2 || yy === y + 2 || xx === x + w - 3 || yy === y + h - 3
      f.px[yy * RW + xx] = e || (e2 && xx > x + 1 && xx < x + w - 2 && yy > y + 1 && yy < y + h - 2) ? FG : INK
    }
}

/**
 * Render one staged shot into `scene.frame`. `t` is the animation clock,
 * so callers can pass a live time to animate a staged composition.
 */
export function renderShot(scene: TwoToneScene, id: ShotId, t = 3.2): IFrame {
  const world = worldFor(id)
  const hud = scene.opts.hud
  if (id === 'title' || id === 'gameover') scene.opts.hud = false
  warm(scene, world, t)
  if (id === 'descent') {
    stageBoom(scene, 250, 470, 'explosionM', 0.18)
    stageBoom(scene, 60, 300, 'explosionS', 0.1)
  } else if (id === 'trench') {
    stageBoom(scene, 140, 560, 'explosionM', 0.3)
  } else if (id === 'warden') {
    stageBoom(scene, 200, 640, 'explosionL', 0.2)
    stageBoom(scene, 160, 700, 'explosionS', 0.15)
  } else if (id === 'kracken') {
    stageBoom(scene, 120, 660, 'explosionL', 0.28)
    stageBoom(scene, 280, 690, 'explosionL', 0.1)
    stageBoom(scene, 210, 610, 'explosionM', 0.4)
    stageBoom(scene, 330, 640, 'explosionM', 0.05)
  }
  scene.draw(world, t)
  scene.opts.hud = hud
  const f = scene.frame

  if (id === 'title') {
    const logo = buildLogo('DIVE', 5)
    const logo2 = buildLogo('DEPTHS', 5)
    iblit(f, logo, Math.round((RW - logo.w) / 2), 186)
    iblit(f, logo2, Math.round((RW - logo2.w) / 2), 222)
    centered(f, 'HOW DEEP CAN YOU GO?', 268, ACC2)
    if (Math.floor(t * 2) % 2 === 0) centered(f, 'PRESS FIRE', 330, FG, 2, true)
    centered(f, 'BEST 12480', 360, ACC)
    centered(f, '< > STEER    SPACE FIRE', 470, FG)
  } else if (id === 'gameover') {
    // the wreck: dither the whole board down, then the results card
    for (let y = 0; y < RH; y++)
      for (let x = 0; x < RW; x++) if (!dith(x, y, 0.35)) f.px[y * RW + x] = INK
    panel(f, 36, 150, 184, 170)
    centered(f, 'HULL', 164, ACC, 3, true)
    centered(f, 'BREACHED', 184, ACC, 3, true)
    const rows: [string, string][] = [
      ['DEPTH', '9,412L'],
      ['KILLS', '212'],
      ['BOSSES', '2'],
      ['SCORE', '14,905'],
    ]
    rows.forEach(([k, v], i) => {
      drawText(f, k, 52, 220 + i * 12, FG)
      drawText(f, v, 204 - textWidth(v, { bold: true }), 220 + i * 12, i === 3 ? ACC2 : FG, { bold: true })
    })
    centered(f, 'NEW BEST!', 276, ACC2, 1, true)
    if (Math.floor(t * 2) % 2 === 0) centered(f, 'FIRE TO DIVE AGAIN', 298, FG)
  }
  void ACC2
  void SUB_Y
  return f
}
