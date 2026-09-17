import * as THREE from 'three'
import {
  BOARD_H,
  BOARD_W,
  LASER_HALF_WIDTH,
  SUB_Y,
  type Effect,
  type Missile,
  type Powerup,
  type PowerupType,
  type Projectile,
  type Threat,
  type World,
} from './physics'
import { DARKEN_DEPTH, hexToCss, paletteAt, type Palette } from './palette'
import { makeLivesRing, makeRingShard, setLivesRing, type LivesRing } from './kit'
import type { GamePhase } from './types'

const BUBBLE_COUNT = 26
const BURST_PARTICLE_COUNT = 60
const GRADIENT_STEPS = 24
const FOV = 42
const SUB_SCREEN_Y = SUB_Y / BOARD_H

// The ultimate beam spans a fixed stretch of the board (starting just above
// the sub so it visibly originates from it, running well past the bottom
// edge) — only its x position and opacity change frame to frame.
const LASER_BEAM_TOP = SUB_Y - 20
const LASER_BEAM_BOTTOM = BOARD_H + 60
const LASER_BEAM_LENGTH = LASER_BEAM_BOTTOM - LASER_BEAM_TOP
const LASER_BEAM_CENTER_Y = (LASER_BEAM_TOP + LASER_BEAM_BOTTOM) / 2

const upAxis = new THREE.Vector3(0, 1, 0)

// Every bullet in the game is a bright glowing circle, deliberately
// depth-invariant (not part of the palette lerp) so a dodgeable projectile
// always reads clearly — orange for the player's own fire, red for
// anything fired at them (enemy subs and detonated mines alike), so which
// bullets are yours is obvious at a glance. The core carries the identity
// color at full saturation; the halo is a lighter tint of the same hue with
// additive blending for a genuine glow rather than a flat tinted sphere.
const PLAYER_BULLET_CORE_COLOR = 0xff8c1a
const PLAYER_BULLET_GLOW_COLOR = 0xffcf7a
const ENEMY_BULLET_CORE_COLOR = 0xff2222
const ENEMY_BULLET_GLOW_COLOR = 0xff7a6b

function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function boardXToWorld(x: number) {
  return x - BOARD_W / 2
}

function boardYToWorld(y: number) {
  return BOARD_H / 2 - y
}

function gradientTexture(colors: Palette['water']): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), hexToCss(c)))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 2, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

function flat(color: number, extra?: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra })
}

interface Materials {
  subHull: THREE.MeshStandardMaterial
  subAccent: THREE.MeshStandardMaterial
  subGlow: THREE.MeshStandardMaterial
  fishBody: THREE.MeshStandardMaterial
  fishFin: THREE.MeshStandardMaterial
  monsterBody: THREE.MeshStandardMaterial
  monsterFin: THREE.MeshStandardMaterial
  monsterGlow: THREE.MeshStandardMaterial
  enemySubHull: THREE.MeshStandardMaterial
  enemySubLight: THREE.MeshStandardMaterial
  mineShell: THREE.MeshStandardMaterial
  mineSpike: THREE.MeshStandardMaterial
  mineLamp: THREE.MeshStandardMaterial
  /** Bullets, split by who fired them — always at full visibility
   *  regardless of depth, since a dodgeable projectile has to read clearly
   *  at any depth. Player missiles use the `player*` pair; enemy sub fire
   *  and mine shrapnel both use `enemy*`, since both are hazards to dodge. */
  playerBulletCore: THREE.MeshBasicMaterial
  playerBulletGlow: THREE.MeshBasicMaterial
  enemyBulletCore: THREE.MeshBasicMaterial
  enemyBulletGlow: THREE.MeshBasicMaterial
  tentacleBody: THREE.MeshStandardMaterial
  tentacleSucker: THREE.MeshStandardMaterial
  tentacleEyeGlow: THREE.MeshStandardMaterial
  powerupShotgunBody: THREE.MeshStandardMaterial
  powerupShotgunGlow: THREE.MeshStandardMaterial
  powerupLaserBody: THREE.MeshStandardMaterial
  powerupLaserGlow: THREE.MeshStandardMaterial
  powerupHealthBody: THREE.MeshStandardMaterial
  powerupHealthGlow: THREE.MeshStandardMaterial
  laserBeamCore: THREE.MeshBasicMaterial
  laserBeamGlow: THREE.MeshBasicMaterial
  eyeWhite: THREE.MeshStandardMaterial
  eyeDark: THREE.MeshStandardMaterial
  bubble: THREE.MeshBasicMaterial
  burstCore: THREE.MeshBasicMaterial
  burstSpark: THREE.MeshBasicMaterial
}

function makeMaterials(p: Palette): Materials {
  return {
    subHull: flat(p.subHull, { roughness: 0.4, metalness: 0.35 }),
    subAccent: flat(p.subAccent, { roughness: 0.5 }),
    subGlow: flat(p.subGlow, { emissive: p.subGlow, emissiveIntensity: p.subGlowIntensity, roughness: 0.3 }),
    fishBody: flat(p.fishBody, { roughness: 0.55, emissive: p.fishGlow, emissiveIntensity: p.fishGlowIntensity }),
    fishFin: flat(p.fishFin, { roughness: 0.6 }),
    monsterBody: flat(p.monsterBody, { roughness: 0.6 }),
    monsterFin: flat(p.monsterFin, { roughness: 0.65 }),
    monsterGlow: flat(p.monsterGlow, { emissive: p.monsterGlow, emissiveIntensity: p.monsterGlowIntensity }),
    enemySubHull: flat(p.enemySubHull, { roughness: 0.5, metalness: p.metalness * 0.6 }),
    enemySubLight: flat(p.enemySubLight, { emissive: p.enemySubLight, emissiveIntensity: p.enemySubGlow }),
    mineShell: flat(p.mineShell, { metalness: p.metalness * 0.5, roughness: 0.8 }),
    mineSpike: flat(p.mineSpike, { metalness: p.metalness, roughness: 0.45 }),
    mineLamp: flat(p.mineLamp, { emissive: p.mineLamp, emissiveIntensity: p.mineLampGlow, roughness: 0.4 }),
    playerBulletCore: new THREE.MeshBasicMaterial({ color: PLAYER_BULLET_CORE_COLOR }),
    playerBulletGlow: new THREE.MeshBasicMaterial({
      color: PLAYER_BULLET_GLOW_COLOR,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    enemyBulletCore: new THREE.MeshBasicMaterial({ color: ENEMY_BULLET_CORE_COLOR }),
    enemyBulletGlow: new THREE.MeshBasicMaterial({
      color: ENEMY_BULLET_GLOW_COLOR,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    tentacleBody: flat(p.tentacleBody, { roughness: 0.75 }),
    tentacleSucker: flat(p.tentacleSucker, { roughness: 0.6 }),
    tentacleEyeGlow: flat(p.tentacleEyeGlow, { emissive: p.tentacleEyeGlow, emissiveIntensity: 2.2 }),
    powerupShotgunBody: flat(p.powerupShotgunBody, { roughness: 0.45, metalness: 0.3 }),
    powerupShotgunGlow: flat(p.powerupShotgunGlow, { emissive: p.powerupShotgunGlow, emissiveIntensity: 1.8 }),
    powerupLaserBody: flat(p.powerupLaserBody, { roughness: 0.3, metalness: 0.2 }),
    powerupLaserGlow: flat(p.powerupLaserGlow, { emissive: p.powerupLaserGlow, emissiveIntensity: 2.2 }),
    powerupHealthBody: flat(p.powerupHealthBody, { roughness: 0.55, metalness: 0.2 }),
    powerupHealthGlow: flat(p.powerupHealthGlow, { emissive: p.powerupHealthGlow, emissiveIntensity: 1.6 }),
    laserBeamCore: new THREE.MeshBasicMaterial({ color: p.laserBeamCore, transparent: true, opacity: 0 }),
    laserBeamGlow: new THREE.MeshBasicMaterial({ color: p.laserBeamGlow, transparent: true, opacity: 0 }),
    eyeWhite: flat(0xffffff, { roughness: 0.3 }),
    eyeDark: flat(0x151b22, { roughness: 0.4 }),
    bubble: new THREE.MeshBasicMaterial({ color: p.bubble, transparent: true, opacity: p.bubbleOpacity }),
    burstCore: new THREE.MeshBasicMaterial({ color: p.explosionCore, transparent: true, opacity: 0.95 }),
    burstSpark: new THREE.MeshBasicMaterial({ color: p.explosionSpark, transparent: true, opacity: 0.9 }),
  }
}

function applyPalette(m: Materials, p: Palette) {
  m.subHull.color.setHex(p.subHull)
  m.subAccent.color.setHex(p.subAccent)
  m.subGlow.color.setHex(p.subGlow)
  m.subGlow.emissive.setHex(p.subGlow)
  m.subGlow.emissiveIntensity = p.subGlowIntensity
  m.fishBody.color.setHex(p.fishBody)
  m.fishBody.emissive.setHex(p.fishGlow)
  m.fishBody.emissiveIntensity = p.fishGlowIntensity
  m.fishFin.color.setHex(p.fishFin)
  m.monsterBody.color.setHex(p.monsterBody)
  m.monsterFin.color.setHex(p.monsterFin)
  m.monsterGlow.color.setHex(p.monsterGlow)
  m.monsterGlow.emissive.setHex(p.monsterGlow)
  m.monsterGlow.emissiveIntensity = p.monsterGlowIntensity
  m.enemySubHull.color.setHex(p.enemySubHull)
  m.enemySubHull.metalness = p.metalness * 0.6
  m.enemySubLight.color.setHex(p.enemySubLight)
  m.enemySubLight.emissive.setHex(p.enemySubLight)
  m.enemySubLight.emissiveIntensity = p.enemySubGlow
  m.mineShell.color.setHex(p.mineShell)
  m.mineSpike.color.setHex(p.mineSpike)
  m.mineLamp.color.setHex(p.mineLamp)
  m.mineLamp.emissive.setHex(p.mineLamp)
  m.mineLamp.emissiveIntensity = p.mineLampGlow
  m.tentacleBody.color.setHex(p.tentacleBody)
  m.tentacleSucker.color.setHex(p.tentacleSucker)
  m.tentacleEyeGlow.color.setHex(p.tentacleEyeGlow)
  m.tentacleEyeGlow.emissive.setHex(p.tentacleEyeGlow)
  m.powerupShotgunBody.color.setHex(p.powerupShotgunBody)
  m.powerupShotgunGlow.color.setHex(p.powerupShotgunGlow)
  m.powerupShotgunGlow.emissive.setHex(p.powerupShotgunGlow)
  m.powerupLaserBody.color.setHex(p.powerupLaserBody)
  m.powerupLaserGlow.color.setHex(p.powerupLaserGlow)
  m.powerupLaserGlow.emissive.setHex(p.powerupLaserGlow)
  m.powerupHealthBody.color.setHex(p.powerupHealthBody)
  m.powerupHealthGlow.color.setHex(p.powerupHealthGlow)
  m.powerupHealthGlow.emissive.setHex(p.powerupHealthGlow)
  m.laserBeamCore.color.setHex(p.laserBeamCore)
  m.laserBeamGlow.color.setHex(p.laserBeamGlow)
  m.bubble.color.setHex(p.bubble)
  m.bubble.opacity = p.bubbleOpacity
  m.burstCore.color.setHex(p.explosionCore)
  m.burstSpark.color.setHex(p.explosionSpark)
}

/* ---------------------------------------------------------------
   Submarine — a stubby hull, conning tower, bow planes, a spinning
   stern propeller and a downward headlight, with the lives ring
   mounted on the tower facing the camera.
--------------------------------------------------------------- */
interface Sub {
  root: THREE.Group
  propeller: THREE.Group
  livesRing: LivesRing
  shard: THREE.Mesh
  beaconLight: THREE.PointLight
  headlightLight: THREE.PointLight
}

function buildSub(m: Materials): Sub {
  const root = new THREE.Group()

  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(11, 28, 4, 10), m.subHull)
  hull.rotation.z = Math.PI / 2
  root.add(hull)

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(30, 3.4, 4), m.subAccent)
  stripe.position.set(0, -2, 11)
  root.add(stripe)

  const tower = new THREE.Mesh(new THREE.BoxGeometry(11, 9, 9), m.subHull)
  tower.position.set(-2, 12, 0)
  root.add(tower)

  const periscope = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 8, 6), m.subAccent)
  periscope.position.set(-2, 20, 0)
  root.add(periscope)

  for (const s of [1, -1]) {
    const plane = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 6), m.subAccent)
    plane.position.set(14, -2, s * 12)
    plane.rotation.z = -s * 0.05
    root.add(plane)
  }

  const tailFin = new THREE.Mesh(new THREE.ConeGeometry(9, 14, 3), m.subHull)
  tailFin.position.set(-24, 6, 0)
  tailFin.rotation.z = Math.PI / 2
  tailFin.scale.z = 0.3
  root.add(tailFin)

  const propeller = new THREE.Group()
  propeller.position.set(-30, -1, 0)
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(2.4, 9, 3), m.subAccent)
    blade.rotation.x = (i / 3) * Math.PI * 2
    blade.position.y = 0
    propeller.add(blade)
  }
  root.add(propeller)

  const headlight = new THREE.Mesh(new THREE.ConeGeometry(5, 10, 8), m.subGlow)
  headlight.position.set(6, -12, 0)
  headlight.rotation.x = Math.PI
  root.add(headlight)
  // The headlight is a real light too, not just a glowing mesh — it casts
  // a pool of light on the water and anything drifting below the sub.
  const headlightLight = new THREE.PointLight(0xffffff, 1, 220, 1.6)
  headlightLight.position.set(8, -16, 0)
  root.add(headlightLight)

  // A top-mounted beacon, dim at the sunlit surface — its point light ramps
  // up sharply once the water goes dark, so the sub visibly starts lighting
  // its own way as it enters the depths.
  const beaconBulb = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), m.subGlow)
  beaconBulb.position.set(-2, 23.4, 0)
  root.add(beaconBulb)
  const beaconLight = new THREE.PointLight(0xffffff, 0.6, 340, 1.6)
  beaconLight.position.set(-2, 24, 0)
  root.add(beaconLight)

  const livesRing = makeLivesRing()
  livesRing.group.position.set(-2, 12, 5)
  root.add(livesRing.group)

  const shard = makeRingShard()
  root.add(shard)

  return { root, propeller, livesRing, shard, beaconLight, headlightLight }
}

/* ---------------------------------------------------------------
   Bullets — every dodgeable projectile is a glowing core inside a softer
   additive halo, orange for the player's own fire and red for anything
   fired at them (enemy subs and mine shrapnel alike).
--------------------------------------------------------------- */
function buildBulletMesh(core: THREE.MeshBasicMaterial, glow: THREE.MeshBasicMaterial): THREE.Group {
  const g = new THREE.Group()
  const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(7, 1), glow)
  g.add(halo)
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 1), core)
  g.add(bulb)
  return g
}

function buildPlayerBullet(m: Materials): THREE.Group {
  return buildBulletMesh(m.playerBulletCore, m.playerBulletGlow)
}

function buildEnemyBullet(m: Materials): THREE.Group {
  return buildBulletMesh(m.enemyBulletCore, m.enemyBulletGlow)
}

/* ---------------------------------------------------------------
   Threats
--------------------------------------------------------------- */
interface ThreatView {
  group: THREE.Group
  kind: Threat['type']
  spin: number
  phase: number
}

function buildFishView(m: Materials, rand: () => number): ThreatView {
  const group = new THREE.Group()

  const profile: THREE.Vector2[] = [
    [1.6, -13], [3.6, -10], [6.2, -6], [8, -1], [8.6, 3], [7.8, 7], [6, 10], [3.6, 12], [1.4, 13],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 8), m.fishBody)
  body.rotation.z = -Math.PI / 2
  body.scale.z = 0.7
  group.add(body)

  const tail = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 3), m.fishFin)
  tail.position.x = -14
  tail.rotation.z = Math.PI / 2
  tail.scale.z = 0.22
  group.add(tail)

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(5, 8, 3), m.fishFin)
  dorsal.position.set(-1, 8, 0)
  dorsal.rotation.z = 0.3
  dorsal.scale.z = 0.2
  group.add(dorsal)

  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 0), m.eyeWhite)
    eye.position.set(7, 2, s * 3.4)
    group.add(eye)
    const pupil = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), m.eyeDark)
    pupil.position.set(7.7, 2, s * 4.6)
    group.add(pupil)
  }

  return { group, kind: 'fish', spin: 0, phase: rand() * Math.PI * 2 }
}

function buildMonsterView(m: Materials, rand: () => number): ThreatView {
  const group = new THREE.Group()

  const profile: THREE.Vector2[] = [
    [2, -19], [6, -15], [11, -8], [14, 0], [12.4, 8], [8.6, 14], [4.6, 18], [1.6, 20],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 9), m.monsterBody)
  body.rotation.z = -Math.PI / 2
  body.scale.z = 0.72
  group.add(body)

  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(2.6, 9, 4), m.monsterFin)
    spike.position.set(-4 + i * 5, 14, 0)
    spike.rotation.z = -0.3 + i * 0.15
    group.add(spike)
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(9, 18, 3), m.monsterFin)
  tail.position.x = -21
  tail.rotation.z = Math.PI / 2
  tail.scale.z = 0.22
  group.add(tail)

  const lureStalk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 12, 5), m.monsterFin)
  lureStalk.position.set(13, 6, 0)
  lureStalk.rotation.z = -0.5
  group.add(lureStalk)
  const lure = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), m.monsterGlow)
  lure.position.set(18, 11, 0)
  group.add(lure)

  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), m.eyeDark)
    eye.position.set(10, 2, s * 5)
    group.add(eye)
  }

  return { group, kind: 'monster', spin: 0, phase: rand() * Math.PI * 2 }
}

function buildEnemySubView(m: Materials, rand: () => number): ThreatView {
  const group = new THREE.Group()

  const hull = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 13), m.enemySubHull)
  group.add(hull)
  const tower = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 8), m.enemySubHull)
  tower.position.set(-2, 9, 0)
  group.add(tower)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(6.5, 12, 6), m.enemySubHull)
  nose.position.set(17, 0, 0)
  nose.rotation.z = -Math.PI / 2
  group.add(nose)

  for (const s of [1, -1]) {
    const light = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), m.enemySubLight)
    light.position.set(-13, 1, s * 6.6)
    group.add(light)
  }

  return { group, kind: 'sub', spin: 0, phase: rand() * Math.PI * 2 }
}

function buildMineView(m: Materials, rand: () => number): ThreatView {
  const group = new THREE.Group()
  const r = 15 + rand() * 2

  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m.mineShell))

  const belt = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, r * 0.08, 4, 14), m.mineSpike)
  belt.rotation.x = Math.PI / 2
  group.add(belt)

  const spikeGeo = new THREE.ConeGeometry(r * 0.22, r * 0.5, 4)
  const lampGeo = new THREE.IcosahedronGeometry(r * 0.14, 0)
  const up = new THREE.Vector3(0, 1, 0)
  const dirs: THREE.Vector3[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    dirs.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0))
  }
  dirs.push(new THREE.Vector3(0, 0.35, 1).normalize())
  for (const d of dirs) {
    const spike = new THREE.Mesh(spikeGeo, m.mineSpike)
    spike.position.copy(d).multiplyScalar(r * 1.08)
    spike.quaternion.setFromUnitVectors(up, d)
    group.add(spike)
    const lamp = new THREE.Mesh(lampGeo, m.mineLamp)
    lamp.position.copy(d).multiplyScalar(r * 1.36)
    group.add(lamp)
  }

  return { group, kind: 'mine', spin: 0.2 + rand() * 0.2, phase: rand() * Math.PI * 2 }
}

/**
 * A tentacle reaching from one wall — geometry is built in "reaches toward
 * +x" local space and mirrored via `dir`, then the group is placed at the
 * actual wall (x=0 or x=BOARD_W) in syncThreats, so it only ever sways in
 * place (rotating around its own wall-anchored origin) rather than needing
 * per-frame repositioning of each segment.
 */
function buildTentacleView(m: Materials, rand: () => number, threat: Threat): ThreatView {
  const group = new THREE.Group()
  const dir = threat.side === 'left' ? 1 : -1
  const reach = threat.reach ?? BOARD_W * 0.6

  const SEGMENTS = 7
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS
    points.push(
      new THREE.Vector3(
        dir * reach * t,
        Math.sin(t * Math.PI * 1.3 + 0.4) * 22 - 8,
        Math.cos(t * Math.PI * 0.8) * 12,
      ),
    )
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const a = points[i]
    const b = points[i + 1]
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const len = a.distanceTo(b)
    const rTop = 12 * (1 - i / SEGMENTS) + 3
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 0.6, rTop * 0.45, len * 1.15, 7), m.tentacleBody)
    seg.position.copy(mid)
    seg.quaternion.setFromUnitVectors(upAxis, b.clone().sub(a).normalize())
    group.add(seg)

    if (i % 2 === 1) {
      const sucker = new THREE.Mesh(new THREE.SphereGeometry(rTop * 0.3, 6, 5), m.tentacleSucker)
      sucker.position.copy(mid).add(new THREE.Vector3(0, -rTop * 0.3, rTop * 0.5))
      group.add(sucker)
    }
  }

  // The Loch-Ness body itself stays implied, just off the edge — a dark mass
  // with two glowing eyes catching what little light reaches this depth.
  const headShadow = new THREE.Mesh(new THREE.IcosahedronGeometry(22, 0), m.tentacleBody)
  headShadow.position.set(dir * -8, -4, -8)
  group.add(headShadow)
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 0), m.tentacleEyeGlow)
    eye.position.set(dir * 9, 5, s * 10)
    group.add(eye)
  }

  return { group, kind: 'tentacle', spin: 0, phase: rand() * Math.PI * 2 }
}

function buildThreatView(threat: Threat, m: Materials): ThreatView {
  const rand = seededRandom(threat.id * 977 + 31)
  switch (threat.type) {
    case 'fish':
      return buildFishView(m, rand)
    case 'monster':
      return buildMonsterView(m, rand)
    case 'sub':
      return buildEnemySubView(m, rand)
    case 'mine':
      return buildMineView(m, rand)
    case 'tentacle':
      return buildTentacleView(m, rand, threat)
  }
}

/* ---------------------------------------------------------------
   Power-ups — a shotgun burst-shaped pickup and a laser crystal shard.
--------------------------------------------------------------- */
function buildShotgunPickup(m: Materials): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(7, 0), m.powerupShotgunBody))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0)
    const spike = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 4), m.powerupShotgunGlow)
    spike.position.copy(dir).multiplyScalar(8)
    spike.quaternion.setFromUnitVectors(upAxis, dir)
    g.add(spike)
  }
  return g
}

function buildLaserPickup(m: Materials): THREE.Group {
  const g = new THREE.Group()
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(9, 0), m.powerupLaserBody)
  shard.scale.y = 1.6
  g.add(shard)
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(4, 0), m.powerupLaserGlow)
  core.scale.y = 1.6
  g.add(core)
  return g
}

/** A supply crate stamped with a gear — restores a hit point on pickup. */
function buildHealthPickup(m: Materials): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.BoxGeometry(13, 13, 13), m.powerupHealthBody))
  for (const face of [1, -1]) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1.4, 10), m.powerupHealthGlow)
    hub.rotation.x = Math.PI / 2
    hub.position.z = face * 6.7
    g.add(hub)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1.4), m.powerupHealthGlow)
      tooth.position.set(Math.cos(a) * 5, Math.sin(a) * 5, face * 6.7)
      g.add(tooth)
    }
  }
  return g
}

function buildPowerupView(type: PowerupType, m: Materials): THREE.Group {
  if (type === 'shotgun') return buildShotgunPickup(m)
  if (type === 'health') return buildHealthPickup(m)
  return buildLaserPickup(m)
}

/* ---------------------------------------------------------------
   The ultimate beam — a fixed-size column toggled visible and repositioned
   on x, rather than rebuilt each use.
--------------------------------------------------------------- */
interface LaserBeam {
  group: THREE.Group
  core: THREE.Mesh
  glow: THREE.Mesh
}

function buildLaserBeam(m: Materials): LaserBeam {
  const group = new THREE.Group()
  const width = LASER_HALF_WIDTH * 2
  const core = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, LASER_BEAM_LENGTH, 1), m.laserBeamCore)
  const glow = new THREE.Mesh(new THREE.BoxGeometry(width, LASER_BEAM_LENGTH, 1), m.laserBeamGlow)
  glow.position.z = -2
  group.add(glow, core)
  return { group, core, glow }
}

/* ---------------------------------------------------------------
   Scene
--------------------------------------------------------------- */
interface Bubble {
  x: number
  y: number
  z: number
  speed: number
  wobble: number
  phase: number
  scale: number
}

interface BurstParticle {
  active: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  age: number
  life: number
  scale: number
  spark: boolean
}

const dummy = new THREE.Object3D()

export class Scene3D {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private materials: Materials
  private sub: Sub
  private hemi: THREE.HemisphereLight
  private key: THREE.DirectionalLight
  private fill: THREE.DirectionalLight
  private threatViews = new Map<number, ThreatView>()
  private missileViews = new Map<number, THREE.Group>()
  private projectileViews = new Map<number, THREE.Group>()
  private powerupViews = new Map<number, THREE.Group>()
  private laserBeam: LaserBeam
  private bubbleMesh: THREE.InstancedMesh
  private bubbles: Bubble[] = []
  private burstCoreMesh: THREE.InstancedMesh
  private burstSparkMesh: THREE.InstancedMesh
  private burstParticles: BurstParticle[] = []
  private seenEffects = 0
  private prevSubX = BOARD_W / 2
  private bank = 0
  private shardT = -1
  private depth = -1
  private gradientStep = -1

  constructor(canvas: HTMLCanvasElement) {
    const palette = paletteAt(0)
    this.materials = makeMaterials(palette)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(palette.fog.color, palette.fog.near, palette.fog.far)

    this.camera = new THREE.PerspectiveCamera(FOV, BOARD_W / BOARD_H, 10, 2400)
    this.frameCamera(BOARD_W / BOARD_H)

    this.hemi = new THREE.HemisphereLight(palette.hemi.sky, palette.hemi.ground, palette.hemi.intensity)
    this.scene.add(this.hemi)
    this.key = new THREE.DirectionalLight(palette.key.color, palette.key.intensity)
    this.key.position.set(80, 180, 420)
    this.scene.add(this.key)
    this.fill = new THREE.DirectionalLight(palette.fill.color, palette.fill.intensity)
    this.fill.position.set(-150, -80, 260)
    this.scene.add(this.fill)

    this.sub = buildSub(this.materials)
    this.scene.add(this.sub.root)

    this.laserBeam = buildLaserBeam(this.materials)
    this.laserBeam.group.visible = false
    this.scene.add(this.laserBeam.group)

    const dropletGeo = new THREE.IcosahedronGeometry(1, 0)

    this.bubbleMesh = new THREE.InstancedMesh(dropletGeo, this.materials.bubble, BUBBLE_COUNT)
    this.scene.add(this.bubbleMesh)
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      this.bubbles.push({
        x: Math.random() * BOARD_W,
        y: Math.random() * BOARD_H,
        z: -80 - Math.random() * 200,
        speed: 22 + Math.random() * 38,
        wobble: 6 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
        scale: 2 + Math.random() * 4,
      })
    }

    this.burstCoreMesh = new THREE.InstancedMesh(dropletGeo, this.materials.burstCore, BURST_PARTICLE_COUNT)
    this.scene.add(this.burstCoreMesh)
    this.burstSparkMesh = new THREE.InstancedMesh(dropletGeo, this.materials.burstSpark, BURST_PARTICLE_COUNT)
    this.scene.add(this.burstSparkMesh)
    for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
      this.burstParticles.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, scale: 0, spark: false })
    }

    this.setDepth(0)
  }

  /**
   * Frames the camera so the full playfield width is always on screen,
   * whatever shape the container is — a threat has to be dodgeable at
   * either edge whatever the window shape. Taller windows see further up
   * and down the water, with the sub held at the same fraction of the view.
   */
  private frameCamera(aspect: number) {
    const visibleHeight = BOARD_W / aspect
    this.camera.aspect = aspect
    this.camera.position.set(
      0,
      boardYToWorld(SUB_Y) + visibleHeight * (SUB_SCREEN_Y - 0.5),
      visibleHeight / 2 / Math.tan((FOV / 2) * (Math.PI / 180)),
    )
    this.camera.rotation.set(0, 0, 0)
    this.camera.updateProjectionMatrix()
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false)
    this.frameCamera(width / height)
  }

  /** 0 at the surface, 1 once the water has faded all the way to the abyss. */
  private setDepth(depth: number) {
    const next = Math.max(0, Math.min(1, depth))
    if (Math.abs(next - this.depth) < 0.002) return
    this.depth = next

    const palette = paletteAt(next)
    applyPalette(this.materials, palette)

    this.hemi.color.setHex(palette.hemi.sky)
    this.hemi.groundColor.setHex(palette.hemi.ground)
    this.hemi.intensity = palette.hemi.intensity
    this.key.color.setHex(palette.key.color)
    this.key.intensity = palette.key.intensity
    this.fill.color.setHex(palette.fill.color)
    this.fill.intensity = palette.fill.intensity
    this.sub.beaconLight.color.setHex(palette.subGlow)
    this.sub.headlightLight.color.setHex(palette.subGlow)

    const fog = this.scene.fog as THREE.Fog
    fog.color.setHex(palette.fog.color)
    fog.near = palette.fog.near
    fog.far = palette.fog.far

    const step = Math.round(next * GRADIENT_STEPS)
    if (step !== this.gradientStep) {
      this.gradientStep = step
      const old = this.scene.background
      this.scene.background = gradientTexture(palette.water)
      if (old instanceof THREE.Texture) old.dispose()
    }
  }

  private triggerBurst(x: number, y: number, kind: Effect['kind']) {
    const count = kind === 'blast' ? 22 : kind === 'kill' ? 16 : kind === 'pickup' ? 9 : 10
    const speedBase = kind === 'blast' ? 110 : kind === 'pickup' ? 30 : 70
    const speedRange = kind === 'blast' ? 170 : kind === 'pickup' ? 40 : 120
    const scaleBase = kind === 'blast' ? 6 : kind === 'pickup' ? 3 : 4
    const scaleRange = kind === 'blast' ? 9 : kind === 'pickup' ? 4 : 6
    let spawned = 0
    for (const particle of this.burstParticles) {
      if (particle.active) continue
      const angle = Math.random() * Math.PI * 2
      const speed = speedBase + Math.random() * speedRange
      particle.active = true
      particle.x = x
      particle.y = y
      particle.z = 30 + (Math.random() - 0.5) * 20
      particle.vx = Math.cos(angle) * speed
      particle.vy = Math.sin(angle) * speed
      particle.vz = (Math.random() - 0.5) * 60
      particle.age = 0
      particle.life = 0.35 + Math.random() * 0.3
      particle.scale = scaleBase + Math.random() * scaleRange
      particle.spark = Math.random() > 0.5
      spawned++
      if (spawned >= count) break
    }
    if (kind === 'hit') {
      this.shardT = 0
    }
  }

  private syncThreats(world: World, dt: number, now: number) {
    const seen = new Set<number>()
    for (const threat of world.threats) {
      seen.add(threat.id)
      let view = this.threatViews.get(threat.id)
      if (!view) {
        view = buildThreatView(threat, this.materials)
        this.threatViews.set(threat.id, view)
        this.scene.add(view.group)
      }
      view.group.position.set(boardXToWorld(threat.x), boardYToWorld(threat.y), 20)
      if (view.spin) {
        view.group.rotation.y += view.spin * dt
        view.group.rotation.z += view.spin * 0.35 * dt
      } else {
        view.group.rotation.z = Math.sin(now * 1.4 + view.phase) * 0.1
        view.group.rotation.y = Math.sin(now * 0.6 + view.phase) * 0.25
      }
    }
    for (const [id, view] of this.threatViews) {
      if (seen.has(id)) continue
      this.scene.remove(view.group)
      view.group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose()
      })
      this.threatViews.delete(id)
    }
  }

  private syncMissiles(world: World) {
    const seen = new Set<number>()
    for (const missile of world.missiles as Missile[]) {
      seen.add(missile.id)
      let view = this.missileViews.get(missile.id)
      if (!view) {
        view = buildPlayerBullet(this.materials)
        this.missileViews.set(missile.id, view)
        this.scene.add(view)
      }
      view.position.set(boardXToWorld(missile.x), boardYToWorld(missile.y), 24)
    }
    for (const [id, view] of this.missileViews) {
      if (seen.has(id)) continue
      this.scene.remove(view)
      this.missileViews.delete(id)
    }
  }

  private syncProjectiles(world: World) {
    const seen = new Set<number>()
    for (const projectile of world.projectiles as Projectile[]) {
      seen.add(projectile.id)
      let view = this.projectileViews.get(projectile.id)
      if (!view) {
        view = buildEnemyBullet(this.materials)
        this.projectileViews.set(projectile.id, view)
        this.scene.add(view)
      }
      view.position.set(boardXToWorld(projectile.x), boardYToWorld(projectile.y), 24)
    }
    for (const [id, view] of this.projectileViews) {
      if (seen.has(id)) continue
      this.scene.remove(view)
      this.projectileViews.delete(id)
    }
  }

  private syncPowerups(world: World, dt: number, now: number) {
    const seen = new Set<number>()
    for (const powerup of world.powerups as Powerup[]) {
      seen.add(powerup.id)
      let view = this.powerupViews.get(powerup.id)
      if (!view) {
        view = buildPowerupView(powerup.type, this.materials)
        this.powerupViews.set(powerup.id, view)
        this.scene.add(view)
      }
      const bob = Math.sin(now * 3 + powerup.id) * 4
      view.position.set(boardXToWorld(powerup.x), boardYToWorld(powerup.y) + bob, 22)
      view.rotation.y += dt * 1.8
    }
    for (const [id, view] of this.powerupViews) {
      if (seen.has(id)) continue
      this.scene.remove(view)
      this.powerupViews.delete(id)
    }
  }

  /** The beam is a fixed box toggled visible and repositioned only on x —
   *  see LASER_BEAM_TOP/BOTTOM for why y is fixed. It's a sustained 15s
   *  weapon now, not an instant flash, so it stays at full strength for the
   *  whole run (with a slight pulse so 15s of it doesn't read as static)
   *  and only fades in the closing instant rather than dimming throughout. */
  private updateLaser(world: World, now: number) {
    const active = world.laserT > 0
    this.laserBeam.group.visible = active
    if (!active) return
    this.laserBeam.group.position.set(boardXToWorld(world.laserX), boardYToWorld(LASER_BEAM_CENTER_Y), 26)
    const fade = Math.min(1, world.laserT / 0.3)
    const pulse = 0.85 + Math.sin(now * 18) * 0.15
    ;(this.laserBeam.core.material as THREE.MeshBasicMaterial).opacity = 0.95 * fade * pulse
    ;(this.laserBeam.glow.material as THREE.MeshBasicMaterial).opacity = 0.6 * fade * pulse
  }

  private updateSub(world: World, phase: GamePhase, dt: number, now: number) {
    const idleBob = phase === 'ready' ? Math.sin(now * 2) * 6 : 0
    this.sub.root.position.set(boardXToWorld(world.subX), boardYToWorld(SUB_Y + idleBob), 40)

    const dx = world.subX - this.prevSubX
    this.prevSubX = world.subX
    const targetBank = Math.max(-0.4, Math.min(0.4, dx * 0.35))
    this.bank += (targetBank - this.bank) * Math.min(1, dt * 10)
    this.sub.root.rotation.z = this.bank

    this.sub.propeller.rotation.x += dt * 22

    // Dim at the sunlit surface, blazing by full depth — both lights ramp
    // up sharply so the sub visibly starts lighting its own way as it
    // enters the depths, brighter overall than a passing glow would be.
    this.sub.beaconLight.intensity = 0.6 + this.depth * this.depth * 9
    this.sub.headlightLight.intensity = 1 + this.depth * this.depth * 6

    setLivesRing(this.sub.livesRing, world.lives, now)

    // Invincibility flash: blink the hull opacity-free via emissive pulse.
    const flashing = world.invincibleT > 0
    this.sub.root.visible = !flashing || Math.floor(now * 14) % 2 === 0

    if (this.shardT >= 0) {
      this.shardT += dt
      const life = 0.6
      const k = Math.min(1, this.shardT / life)
      this.sub.shard.visible = k < 1
      this.sub.shard.position.set(0, 12 - k * 30, 5 + k * 20)
      this.sub.shard.rotation.set(k * 6, k * 4, k * 3)
      this.sub.shard.scale.setScalar(1 - k * 0.4)
      if (k >= 1) this.shardT = -1
    }
  }

  private updateBubbles(dt: number, now: number) {
    for (let i = 0; i < this.bubbles.length; i++) {
      const bubble = this.bubbles[i]
      bubble.y -= bubble.speed * dt
      if (bubble.y < -30) {
        bubble.y = BOARD_H + Math.random() * 60
        bubble.x = Math.random() * BOARD_W
      }
      const wobbleX = bubble.x + Math.sin(now * 1.4 + bubble.phase) * bubble.wobble
      dummy.position.set(boardXToWorld(wobbleX), boardYToWorld(bubble.y), bubble.z)
      dummy.scale.setScalar(bubble.scale)
      dummy.updateMatrix()
      this.bubbleMesh.setMatrixAt(i, dummy.matrix)
    }
    this.bubbleMesh.instanceMatrix.needsUpdate = true
  }

  private updateBurstParticles(dt: number) {
    for (let i = 0; i < this.burstParticles.length; i++) {
      const particle = this.burstParticles[i]
      if (particle.active) {
        particle.age += dt
        if (particle.age >= particle.life) {
          particle.active = false
        } else {
          particle.vy -= 180 * dt
          particle.x += particle.vx * dt
          particle.y -= particle.vy * dt
          particle.z += particle.vz * dt
        }
      }
      const k = particle.active ? 1 - particle.age / particle.life : 0
      dummy.position.set(boardXToWorld(particle.x), boardYToWorld(particle.y), particle.z)
      dummy.scale.setScalar(particle.active ? particle.scale * k : 0)
      dummy.updateMatrix()
      if (particle.spark) {
        this.burstSparkMesh.setMatrixAt(i, dummy.matrix)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        this.burstCoreMesh.setMatrixAt(i, dummy.matrix)
      } else {
        this.burstCoreMesh.setMatrixAt(i, dummy.matrix)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        this.burstSparkMesh.setMatrixAt(i, dummy.matrix)
      }
    }
    this.burstCoreMesh.instanceMatrix.needsUpdate = true
    this.burstSparkMesh.instanceMatrix.needsUpdate = true
  }

  update(world: World, phase: GamePhase, dt: number, now: number) {
    this.setDepth(world.depth / DARKEN_DEPTH)
    this.syncThreats(world, dt, now)
    this.syncMissiles(world)
    this.syncProjectiles(world)
    this.syncPowerups(world, dt, now)
    this.updateLaser(world, now)
    this.updateSub(world, phase, dt, now)
    this.updateBubbles(dt, now)

    // Effects is append-only; a shorter array than last seen means the world
    // was reset (new game), so start reading from the top again.
    if (world.effects.length < this.seenEffects) this.seenEffects = 0
    for (let i = this.seenEffects; i < world.effects.length; i++) {
      const fx = world.effects[i]
      this.triggerBurst(fx.x, fx.y, fx.kind)
    }
    this.seenEffects = world.effects.length

    this.updateBurstParticles(dt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    for (const view of this.threatViews.values()) this.scene.remove(view.group)
    this.threatViews.clear()
    for (const view of this.missileViews.values()) this.scene.remove(view)
    this.missileViews.clear()
    for (const view of this.projectileViews.values()) this.scene.remove(view)
    this.projectileViews.clear()
    for (const view of this.powerupViews.values()) this.scene.remove(view)
    this.powerupViews.clear()
    this.renderer.dispose()
  }
}
