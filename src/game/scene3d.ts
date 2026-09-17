import * as THREE from 'three'
import { BOARD_H, BOARD_W, SUB_Y, type Effect, type Missile, type Projectile, type Threat, type World } from './physics'
import { DARKEN_DEPTH, hexToCss, paletteAt, type Palette } from './palette'
import { makeLivesRing, makeRingShard, setLivesRing, type LivesRing } from './kit'
import type { GamePhase } from './types'

const BUBBLE_COUNT = 26
const BURST_PARTICLE_COUNT = 60
const GRADIENT_STEPS = 24
const FOV = 42
const SUB_SCREEN_Y = SUB_Y / BOARD_H

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
  missileBody: THREE.MeshStandardMaterial
  missileGlow: THREE.MeshStandardMaterial
  projectileBody: THREE.MeshStandardMaterial
  projectileGlow: THREE.MeshStandardMaterial
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
    missileBody: flat(p.missileBody, { roughness: 0.35, metalness: 0.4 }),
    missileGlow: flat(p.missileGlow, { emissive: p.missileGlow, emissiveIntensity: 1.6 }),
    projectileBody: flat(p.projectileBody, { roughness: 0.5 }),
    projectileGlow: flat(p.projectileGlow, { emissive: p.projectileGlow, emissiveIntensity: 1.8 }),
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
  m.missileBody.color.setHex(p.missileBody)
  m.missileGlow.color.setHex(p.missileGlow)
  m.missileGlow.emissive.setHex(p.missileGlow)
  m.projectileBody.color.setHex(p.projectileBody)
  m.projectileGlow.color.setHex(p.projectileGlow)
  m.projectileGlow.emissive.setHex(p.projectileGlow)
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

  const livesRing = makeLivesRing()
  livesRing.group.position.set(-2, 12, 5)
  root.add(livesRing.group)

  const shard = makeRingShard()
  root.add(shard)

  return { root, propeller, livesRing, shard }
}

/* ---------------------------------------------------------------
   Missiles and enemy projectiles
--------------------------------------------------------------- */
function buildMissile(m: Materials): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.ConeGeometry(4, 15, 6), m.missileBody)
  body.rotation.x = Math.PI
  g.add(body)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 6), m.missileGlow)
  tip.position.y = -9
  tip.rotation.x = Math.PI
  g.add(tip)
  return g
}

function buildProjectile(m: Materials): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.ConeGeometry(3.4, 12, 5), m.projectileBody)
  g.add(body)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 5), m.projectileGlow)
  tip.position.y = 7
  g.add(tip)
  return g
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
  }
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
    let spawned = 0
    const count = kind === 'kill' ? 16 : 10
    for (const particle of this.burstParticles) {
      if (particle.active) continue
      const angle = Math.random() * Math.PI * 2
      const speed = 70 + Math.random() * 120
      particle.active = true
      particle.x = x
      particle.y = y
      particle.z = 30 + (Math.random() - 0.5) * 20
      particle.vx = Math.cos(angle) * speed
      particle.vy = Math.sin(angle) * speed
      particle.vz = (Math.random() - 0.5) * 60
      particle.age = 0
      particle.life = 0.35 + Math.random() * 0.3
      particle.scale = 4 + Math.random() * 6
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
        view = buildMissile(this.materials)
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
        view = buildProjectile(this.materials)
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

  private updateSub(world: World, phase: GamePhase, dt: number, now: number) {
    const idleBob = phase === 'ready' ? Math.sin(now * 2) * 6 : 0
    this.sub.root.position.set(boardXToWorld(world.subX), boardYToWorld(SUB_Y + idleBob), 40)

    const dx = world.subX - this.prevSubX
    this.prevSubX = world.subX
    const targetBank = Math.max(-0.4, Math.min(0.4, dx * 0.35))
    this.bank += (targetBank - this.bank) * Math.min(1, dt * 10)
    this.sub.root.rotation.z = this.bank

    this.sub.propeller.rotation.x += dt * 22

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
    this.renderer.dispose()
  }
}
