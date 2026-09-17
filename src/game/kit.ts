/**
 * Dive Depths — small asset kit, in the spirit of prof-whip-dash's `kit.ts`:
 * every model is three.js primitives assembled at runtime, flat-shaded, no
 * textures. `mat()` caches materials so repeated colors don't allocate a new
 * one per mesh.
 */
import * as THREE from 'three'

type MatOpts = { emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number; roughness?: number; metalness?: number }

const matCache = new Map<string, THREE.MeshStandardMaterial>()

export function mat(color: number, opts: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = color + '|' + JSON.stringify(opts)
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, ...opts })
    matCache.set(key, m)
  }
  return m
}

/** Updates every cached material sharing a color to a new one — used when the
 *  depth palette shifts, so live instances repaint without rebuilding meshes. */
export function repaint(oldColor: number, newColor: number, opts: MatOpts = {}) {
  const key = oldColor + '|' + JSON.stringify(opts)
  const m = matCache.get(key)
  if (m) m.color.setHex(newColor)
}

export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, opts?: MatOpts) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts))
  mesh.position.set(x, y, z)
  return mesh
}

export function cyl(rt: number, rb: number, h: number, seg: number, color: number, x = 0, y = 0, z = 0, opts?: MatOpts) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts))
  mesh.position.set(x, y, z)
  return mesh
}

export function cone(r: number, h: number, seg: number, color: number, x = 0, y = 0, z = 0, opts?: MatOpts) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color, opts))
  mesh.position.set(x, y, z)
  return mesh
}

/** Deterministic noise, so a seeded mesh looks the same every run. */
export function rnd(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

/* --------------------------------------------------------------- hull ring
   A three-segment ring standing in for the lives counter — mounted on the
   submarine's hull, visible the whole run the way prof-whip-dash's health
   ring sits on the Professor's back, so losing a life reads in the world
   instead of only in a HUD number. */

export const LIVES_MAX = 3

export interface LivesRing {
  group: THREE.Group
  segments: THREE.Mesh[]
}

export function makeLivesRing(): LivesRing {
  const group = new THREE.Group()
  const segments: THREE.Mesh[] = []
  const R = 13
  const gap = 0.5
  const step = (Math.PI * 2) / LIVES_MAX
  for (let i = 0; i < LIVES_MAX; i++) {
    const geo = new THREE.TorusGeometry(R, 2.1, 5, 10, step - gap)
    const seg = new THREE.Mesh(geo, mat(0xffd166, { emissive: 0xffd166, emissiveIntensity: 0.6 }))
    seg.rotation.z = Math.PI / 2 - i * step - (step - gap) / 2
    group.add(seg)
    segments.push(seg)
  }
  return { group, segments }
}

/** Gold while healthy, red and pulsing on the last life. */
export function setLivesRing(ring: LivesRing, lit: number, t: number) {
  const colour = lit <= 1 ? 0xff3b52 : 0xffd166
  const pulse = lit <= 1 ? 0.5 + Math.abs(Math.sin(t * 6)) * 0.9 : 0.6
  ring.segments.forEach((seg, i) => {
    const on = i < lit
    seg.material = on ? mat(colour, { emissive: colour, emissiveIntensity: pulse }) : mat(0x2a3138)
  })
}

/** A segment knocked loose on a hit — thrown clear and tumbled by the scene. */
export function makeRingShard(): THREE.Mesh {
  const step = (Math.PI * 2) / LIVES_MAX
  const shard = new THREE.Mesh(
    new THREE.TorusGeometry(13, 2.1, 5, 10, step - 0.5),
    mat(0xff3b52, { emissive: 0xff3b52, emissiveIntensity: 0.9 }),
  )
  shard.visible = false
  return shard
}
