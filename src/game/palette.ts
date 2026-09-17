import * as THREE from 'three'

/**
 * The water starts at the bright surface and fades to the abyss as the
 * submarine descends, reaching full depth after DARKEN_DEPTH units.
 */
export const DARKEN_DEPTH = 5200

export interface Palette {
  water: [number, number, number, number]
  fog: { color: number; near: number; far: number }
  hemi: { sky: number; ground: number; intensity: number }
  key: { color: number; intensity: number }
  fill: { color: number; intensity: number }
  subHull: number
  subAccent: number
  subGlow: number
  subGlowIntensity: number
  fishBody: number
  fishFin: number
  fishGlow: number
  fishGlowIntensity: number
  monsterBody: number
  monsterFin: number
  monsterGlow: number
  monsterGlowIntensity: number
  enemySubHull: number
  enemySubLight: number
  enemySubGlow: number
  metalness: number
  metalRough: number
  mineShell: number
  mineSpike: number
  mineLamp: number
  mineLampGlow: number
  tentacleBody: number
  tentacleSucker: number
  tentacleEyeGlow: number
  powerupShotgunBody: number
  powerupShotgunGlow: number
  powerupLaserBody: number
  powerupLaserGlow: number
  powerupHealthBody: number
  powerupHealthGlow: number
  laserBeamCore: number
  laserBeamGlow: number
  explosionCore: number
  explosionSpark: number
  bubble: number
  bubbleOpacity: number
}

const SURFACE: Palette = {
  water: [0xcdf2fb, 0x5fc3e4, 0x1f6fa8, 0x0a2f52],
  fog: { color: 0x0a2f52, near: 620, far: 1560 },
  hemi: { sky: 0xeaffff, ground: 0x0d2c48, intensity: 2.6 },
  key: { color: 0xfff3e0, intensity: 3.6 },
  fill: { color: 0xbfe8ff, intensity: 1.8 },
  subHull: 0xe6ecef,
  subAccent: 0xff9a4d,
  subGlow: 0xfff8dc,
  subGlowIntensity: 2.2,
  fishBody: 0xffb066,
  fishFin: 0xff8a3d,
  fishGlow: 0xff7a3a,
  fishGlowIntensity: 0,
  monsterBody: 0x7a5a9e,
  monsterFin: 0x5c3f80,
  monsterGlow: 0xff5d7a,
  monsterGlowIntensity: 0.4,
  enemySubHull: 0x5c6b78,
  enemySubLight: 0xff4438,
  enemySubGlow: 0.9,
  metalness: 0.55,
  metalRough: 0.32,
  mineShell: 0x2f3a46,
  mineSpike: 0xc8a24a,
  mineLamp: 0xff4438,
  mineLampGlow: 1.1,
  tentacleBody: 0x2c4a3a,
  tentacleSucker: 0x6fae7a,
  tentacleEyeGlow: 0xfff275,
  powerupShotgunBody: 0xffb347,
  powerupShotgunGlow: 0xffe27a,
  powerupLaserBody: 0x6fd8ff,
  powerupLaserGlow: 0xaef9ff,
  powerupHealthBody: 0x4caf6a,
  powerupHealthGlow: 0x9dffb8,
  laserBeamCore: 0xffffff,
  laserBeamGlow: 0x7ad7ff,
  explosionCore: 0xffe9a8,
  explosionSpark: 0xff7a3a,
  bubble: 0xeaffff,
  bubbleOpacity: 0.42,
}

const DEEP: Palette = {
  water: [0x1a5570, 0x0b3a54, 0x05203a, 0x01101c],
  fog: { color: 0x04182b, near: 380, far: 1120 },
  hemi: { sky: 0x7fd8ff, ground: 0x01070d, intensity: 1.05 },
  key: { color: 0x9fd6ff, intensity: 1.9 },
  fill: { color: 0x1f5f80, intensity: 0.7 },
  subHull: 0x8fa0aa,
  subAccent: 0xff7a3a,
  subGlow: 0xdcf3ff,
  subGlowIntensity: 5,
  fishBody: 0xc4602c,
  fishFin: 0x8f2e22,
  fishGlow: 0xff7a3a,
  fishGlowIntensity: 1.1,
  monsterBody: 0x2e1f42,
  monsterFin: 0x1c1230,
  monsterGlow: 0xff2d5c,
  monsterGlowIntensity: 2.6,
  enemySubHull: 0x1c232b,
  enemySubLight: 0xff3b52,
  enemySubGlow: 2.4,
  metalness: 0.75,
  metalRough: 0.28,
  mineShell: 0x090f16,
  mineSpike: 0x22303c,
  mineLamp: 0xff3b52,
  mineLampGlow: 3,
  tentacleBody: 0x0a1710,
  tentacleSucker: 0x1f3b28,
  tentacleEyeGlow: 0x9dff5c,
  powerupShotgunBody: 0xd88a2e,
  powerupShotgunGlow: 0xffe27a,
  powerupLaserBody: 0x9a7bff,
  powerupLaserGlow: 0xd9baff,
  powerupHealthBody: 0x2f7a48,
  powerupHealthGlow: 0x6dffa0,
  laserBeamCore: 0xeaffff,
  laserBeamGlow: 0xb388ff,
  explosionCore: 0xffe9a8,
  explosionSpark: 0xff5d7a,
  bubble: 0x9ff0ff,
  bubbleOpacity: 0.3,
}

const cA = new THREE.Color()
const cB = new THREE.Color()
const cOut = new THREE.Color()

export function mixHex(a: number, b: number, t: number): number {
  cA.setHex(a)
  cB.setHex(b)
  return cOut.copy(cA).lerp(cB, t).getHex()
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function paletteAt(t: number): Palette {
  const k = Math.max(0, Math.min(1, t))
  return {
    water: SURFACE.water.map((c, i) => mixHex(c, DEEP.water[i], k)) as Palette['water'],
    fog: {
      color: mixHex(SURFACE.fog.color, DEEP.fog.color, k),
      near: mix(SURFACE.fog.near, DEEP.fog.near, k),
      far: mix(SURFACE.fog.far, DEEP.fog.far, k),
    },
    hemi: {
      sky: mixHex(SURFACE.hemi.sky, DEEP.hemi.sky, k),
      ground: mixHex(SURFACE.hemi.ground, DEEP.hemi.ground, k),
      intensity: mix(SURFACE.hemi.intensity, DEEP.hemi.intensity, k),
    },
    key: {
      color: mixHex(SURFACE.key.color, DEEP.key.color, k),
      intensity: mix(SURFACE.key.intensity, DEEP.key.intensity, k),
    },
    fill: {
      color: mixHex(SURFACE.fill.color, DEEP.fill.color, k),
      intensity: mix(SURFACE.fill.intensity, DEEP.fill.intensity, k),
    },
    subHull: mixHex(SURFACE.subHull, DEEP.subHull, k),
    subAccent: mixHex(SURFACE.subAccent, DEEP.subAccent, k),
    subGlow: mixHex(SURFACE.subGlow, DEEP.subGlow, k),
    subGlowIntensity: mix(SURFACE.subGlowIntensity, DEEP.subGlowIntensity, k),
    fishBody: mixHex(SURFACE.fishBody, DEEP.fishBody, k),
    fishFin: mixHex(SURFACE.fishFin, DEEP.fishFin, k),
    fishGlow: mixHex(SURFACE.fishGlow, DEEP.fishGlow, k),
    fishGlowIntensity: mix(SURFACE.fishGlowIntensity, DEEP.fishGlowIntensity, k),
    monsterBody: mixHex(SURFACE.monsterBody, DEEP.monsterBody, k),
    monsterFin: mixHex(SURFACE.monsterFin, DEEP.monsterFin, k),
    monsterGlow: mixHex(SURFACE.monsterGlow, DEEP.monsterGlow, k),
    monsterGlowIntensity: mix(SURFACE.monsterGlowIntensity, DEEP.monsterGlowIntensity, k),
    enemySubHull: mixHex(SURFACE.enemySubHull, DEEP.enemySubHull, k),
    enemySubLight: mixHex(SURFACE.enemySubLight, DEEP.enemySubLight, k),
    enemySubGlow: mix(SURFACE.enemySubGlow, DEEP.enemySubGlow, k),
    metalness: mix(SURFACE.metalness, DEEP.metalness, k),
    metalRough: mix(SURFACE.metalRough, DEEP.metalRough, k),
    mineShell: mixHex(SURFACE.mineShell, DEEP.mineShell, k),
    mineSpike: mixHex(SURFACE.mineSpike, DEEP.mineSpike, k),
    mineLamp: mixHex(SURFACE.mineLamp, DEEP.mineLamp, k),
    mineLampGlow: mix(SURFACE.mineLampGlow, DEEP.mineLampGlow, k),
    tentacleBody: mixHex(SURFACE.tentacleBody, DEEP.tentacleBody, k),
    tentacleSucker: mixHex(SURFACE.tentacleSucker, DEEP.tentacleSucker, k),
    tentacleEyeGlow: mixHex(SURFACE.tentacleEyeGlow, DEEP.tentacleEyeGlow, k),
    powerupShotgunBody: mixHex(SURFACE.powerupShotgunBody, DEEP.powerupShotgunBody, k),
    powerupShotgunGlow: mixHex(SURFACE.powerupShotgunGlow, DEEP.powerupShotgunGlow, k),
    powerupLaserBody: mixHex(SURFACE.powerupLaserBody, DEEP.powerupLaserBody, k),
    powerupLaserGlow: mixHex(SURFACE.powerupLaserGlow, DEEP.powerupLaserGlow, k),
    powerupHealthBody: mixHex(SURFACE.powerupHealthBody, DEEP.powerupHealthBody, k),
    powerupHealthGlow: mixHex(SURFACE.powerupHealthGlow, DEEP.powerupHealthGlow, k),
    laserBeamCore: mixHex(SURFACE.laserBeamCore, DEEP.laserBeamCore, k),
    laserBeamGlow: mixHex(SURFACE.laserBeamGlow, DEEP.laserBeamGlow, k),
    explosionCore: mixHex(SURFACE.explosionCore, DEEP.explosionCore, k),
    explosionSpark: mixHex(SURFACE.explosionSpark, DEEP.explosionSpark, k),
    bubble: mixHex(SURFACE.bubble, DEEP.bubble, k),
    bubbleOpacity: mix(SURFACE.bubbleOpacity, DEEP.bubbleOpacity, k),
  }
}

export function hexToCss(hex: number): string {
  cA.setHex(hex)
  return `#${cA.getHexString()}`
}
