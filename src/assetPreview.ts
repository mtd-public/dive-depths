/**
 * assetPreview.ts — animated showcase for the "In the Hunt"-style sprite
 * set in pixelArt.ts. Serves two shells from one source:
 *
 *   - `asset-preview.html` at the repo root (open via `npm run dev`)
 *   - the published standalone artifact (same file, esbuild-bundled)
 *
 * Top: a live 256×352 action scene where the sprites behave the way they
 * will in-game (eased steering, torpedoes with bubble wakes, tracer
 * fire, mine shrapnel, multi-frame explosions). Below: every sprite
 * animating on a card, then the master palette.
 */
import {
  buildAllSprites,
  frameToCanvas,
  PALETTE,
  type Frame,
  type SpriteAnim,
} from './game/pixelArt'

const sprites = buildAllSprites()
const cache = new Map<Frame, HTMLCanvasElement>()
const fc = (f: Frame): HTMLCanvasElement => {
  let c = cache.get(f)
  if (!c) {
    c = frameToCanvas(f)
    cache.set(f, c)
  }
  return c
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------------------------------------------------------------------------
// Page chrome
// ---------------------------------------------------------------------------

const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href =
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Mono:wght@400;600&display=swap'
document.head.appendChild(fontLink)

const style = document.createElement('style')
style.textContent = `
  :root {
    --abyss: #081418;
    --panel: #0d242b;
    --panel-edge: #1b5352;
    --water: #133a40;
    --ink: #cfeef2;
    --ink-dim: #8a97a0;
    --accent: #ff8c1a;
    --warn: #ff5a4a;
    --glow: #aef2e0;
    --display: 'Press Start 2P', monospace;
    --body: 'IBM Plex Mono', ui-monospace, monospace;
  }
  body {
    background: var(--abyss);
    color: var(--ink);
    font-family: var(--body);
    font-size: 14px;
    line-height: 1.6;
    margin: 0;
  }
  .wrap { max-width: 980px; margin: 0 auto; padding: 24px 16px 64px; }
  header.masthead { text-align: center; padding: 18px 0 8px; }
  .masthead h1 {
    font-family: var(--display);
    font-size: clamp(14px, 3.4vw, 24px);
    color: var(--accent);
    letter-spacing: 1px;
    margin: 0 0 10px;
    text-shadow: 0 3px 0 #c93a12, 0 6px 0 #16161c;
  }
  .masthead p { color: var(--ink-dim); margin: 0; font-size: 13px; }
  .masthead .blink { color: var(--glow); animation: blink 1.2s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .masthead .blink { animation: none; } }

  section { margin-top: 36px; }
  h2.rule {
    font-family: var(--display);
    font-size: 11px;
    color: var(--glow);
    letter-spacing: 2px;
    text-transform: uppercase;
    display: flex; align-items: center; gap: 12px;
    margin: 0 0 16px;
  }
  h2.rule::before, h2.rule::after {
    content: ''; height: 2px; flex: 1;
    background: repeating-linear-gradient(90deg, var(--panel-edge) 0 6px, transparent 6px 10px);
  }

  .scene-shell {
    display: flex; justify-content: center;
  }
  .scene-frame {
    background: #16161c;
    padding: 10px;
    border: 2px solid var(--panel-edge);
    box-shadow: 0 0 0 2px #050a0c, 0 14px 40px rgba(0,0,0,.55);
  }
  canvas.scene {
    display: block;
    width: min(440px, calc(100vw - 76px));
    aspect-ratio: 256 / 352;
    image-rendering: pixelated;
    background: var(--water);
  }
  .scene-caption { text-align: center; color: var(--ink-dim); font-size: 12px; margin-top: 10px; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--panel-edge);
    padding: 10px;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .card .stage {
    width: 100%; height: 120px;
    display: flex; align-items: center; justify-content: center;
    background:
      linear-gradient(180deg, #10333a 0 50%, #0d242b 50% 100%);
  }
  .card canvas { image-rendering: pixelated; }
  .card .name { font-family: var(--display); font-size: 9px; color: var(--ink); letter-spacing: 1px; }
  .card .meta { color: var(--ink-dim); font-size: 11px; }

  .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  .swatch { width: 88px; }
  .swatch .chip { height: 34px; border: 1px solid #050a0c; }
  .swatch .lab { font-size: 10px; color: var(--ink-dim); overflow-wrap: anywhere; }

  .usage {
    background: var(--panel);
    border-left: 3px solid var(--accent);
    padding: 14px 16px;
    font-size: 13px;
  }
  .usage code { color: var(--glow); }
  .usage p { margin: 6px 0; }

  #bosses { display: flex; flex-direction: column; gap: 14px; }
  .boss-card {
    background: var(--panel);
    border: 1px solid var(--panel-edge);
    padding: 14px 14px 12px;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
  }
  .boss-card .warnbar {
    align-self: stretch;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    font-family: var(--display); font-size: 10px; letter-spacing: 2px;
    padding: 6px 10px;
    background: repeating-linear-gradient(-45deg, #16161c 0 10px, #2c2c34 10px 20px);
    border: 1px solid #050a0c;
  }
  .boss-card .warnbar .who { color: var(--warn); }
  .boss-card.kracken .warnbar .who { color: var(--accent); }
  .boss-card .warnbar .when { color: var(--ink-dim); font-size: 8px; }
  .boss-card canvas { image-rendering: pixelated; max-width: 100%; height: auto; }
  .boss-card .meta { color: var(--ink-dim); font-size: 11px; }
`
document.head.appendChild(style)

const wrap = document.createElement('div')
wrap.className = 'wrap'
wrap.innerHTML = `
  <header class="masthead">
    <h1>DIVE DEPTHS</h1>
    <p>arcade sprite kit &mdash; pixel art &amp; animation study after Irem's <em>In the Hunt</em> (1993)</p>
    <p class="blink">&#9654; INSERT COIN</p>
  </header>
  <section>
    <h2 class="rule">Live fire exercise</h2>
    <div class="scene-shell"><div class="scene-frame">
      <canvas class="scene" width="256" height="352" aria-label="Animated demo scene: the submarine steers and fires torpedoes at rising threats"></canvas>
    </div></div>
    <p class="scene-caption">Same behaviors as the game: eased steering, torpedoes with bubble
    wakes, enemy tracer fire, mine shrapnel rings, three sizes of rolling explosion.</p>
  </section>
  <section>
    <h2 class="rule">Boss hangar</h2>
    <div id="bosses"></div>
  </section>
  <section>
    <h2 class="rule">Sprite roster</h2>
    <div class="grid" id="grid"></div>
  </section>
  <section>
    <h2 class="rule">Master palette</h2>
    <div class="swatches" id="swatches"></div>
  </section>
  <section>
    <h2 class="rule">Drop-in use</h2>
    <div class="usage">
      <p>Everything on this page is generated at runtime by
      <code>src/game/pixelArt.ts</code> &mdash; no image files, no new dependencies.</p>
      <p><code>buildAllSprites()</code> returns every animation as raw RGBA frames;
      <code>frameToCanvas(frame)</code> turns one into a canvas for 2D drawing, or feed
      the pixels to a <code>THREE.CanvasTexture</code> (with <code>NearestFilter</code>)
      to skin the existing 3D scene without touching <code>physics.ts</code>.</p>
    </div>
  </section>
`
document.body.appendChild(wrap)

// ---------------------------------------------------------------------------
// Sprite roster cards
// ---------------------------------------------------------------------------

interface Card {
  anim: SpriteAnim
  ctx: CanvasRenderingContext2D
  zoom: number
}
const cards: Card[] = []
const grid = document.getElementById('grid')!
const DESCRIPTIONS: Record<string, string> = {
  playerIdle: 'player sub',
  playerBankL: 'bank left',
  playerBankR: 'bank right',
  torpedo: 'torpedo',
  tracer: 'enemy tracer',
  shrapnel: 'mine shrapnel',
  frogman: 'frogman squad',
  angler: 'angler drone',
  enemySub: 'enemy sub',
  enemySubFire: 'enemy sub · firing',
  mine: 'contact mine',
  explosionS: 'explosion S',
  explosionM: 'explosion M',
  explosionL: 'explosion L',
  bubbles: 'bubbles',
}

// bosses get the hangar, not a roster card
const BOSSES: Record<string, { title: string; when: string; cls: string }> = {
  bossWarden: { title: 'THE WARDEN', when: 'EVERY 1000 LEAGUES', cls: '' },
  bossKracken: { title: 'THE KRACKEN', when: '20000 LEAGUES', cls: 'kracken' },
}
const bossHost = document.getElementById('bosses')!
for (const [name, info] of Object.entries(BOSSES)) {
  const anim = sprites[name]
  const card = document.createElement('div')
  card.className = `boss-card ${info.cls}`
  const bar = document.createElement('div')
  bar.className = 'warnbar'
  bar.innerHTML = `<span class="who">&#9888; ${info.title}</span><span class="when">${info.when}</span>`
  card.appendChild(bar)
  const cv = document.createElement('canvas')
  const f0 = anim.frames[0]
  const zoom = 2
  cv.width = f0.w * zoom
  cv.height = f0.h * zoom
  card.appendChild(cv)
  const meta = document.createElement('div')
  meta.className = 'meta'
  meta.textContent = `${f0.w}×${f0.h} · ${anim.frames.length}f @ ${anim.fps}fps · jaw + tentacle sway + eye pulse`
  card.appendChild(meta)
  bossHost.appendChild(card)
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  cards.push({ anim, ctx, zoom })
}

for (const [name, anim] of Object.entries(sprites)) {
  if (name in BOSSES) continue
  const card = document.createElement('div')
  card.className = 'card'
  const stage = document.createElement('div')
  stage.className = 'stage'
  const cv = document.createElement('canvas')
  const fw = Math.max(...anim.frames.map((f) => f.w))
  const fh = Math.max(...anim.frames.map((f) => f.h))
  const zoom = Math.max(2, Math.min(5, Math.floor(104 / Math.max(fw, fh))))
  cv.width = fw * zoom
  cv.height = fh * zoom
  stage.appendChild(cv)
  card.appendChild(stage)
  const label = document.createElement('div')
  label.className = 'name'
  label.textContent = DESCRIPTIONS[name] ?? name
  card.appendChild(label)
  const meta = document.createElement('div')
  meta.className = 'meta'
  meta.textContent = `${anim.frames[0].w}×${anim.frames[0].h} · ${anim.frames.length}f @ ${anim.fps || '–'}fps`
  card.appendChild(meta)
  grid.appendChild(card)
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  cards.push({ anim, ctx, zoom })
}

function drawCards(t: number): void {
  for (const { anim, ctx, zoom } of cards) {
    const n = anim.frames.length
    const fps = anim.fps || 1
    const idx = reduceMotion
      ? 0
      : anim.loop
        ? Math.floor(t * fps) % n
        : Math.floor(t * fps) % (n + Math.ceil(fps * 0.6)) // hold a beat after one-shots
    const f = anim.frames[Math.min(idx, n - 1)]
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.drawImage(
      fc(f),
      Math.floor((ctx.canvas.width - f.w * zoom) / 2),
      Math.floor((ctx.canvas.height - f.h * zoom) / 2),
      f.w * zoom,
      f.h * zoom,
    )
  }
}

// ---------------------------------------------------------------------------
// Palette swatches
// ---------------------------------------------------------------------------

const swatches = document.getElementById('swatches')!
for (const [name, hex] of Object.entries(PALETTE)) {
  const s = document.createElement('div')
  s.className = 'swatch'
  s.innerHTML = `<div class="chip" style="background:${hex}"></div><div class="lab">${name}<br>${hex}</div>`
  swatches.appendChild(s)
}

// ---------------------------------------------------------------------------
// Live action scene — the sprites doing their jobs
// ---------------------------------------------------------------------------

const W = 256
const H = 352
const scene = document.querySelector<HTMLCanvasElement>('canvas.scene')!
const sc = scene.getContext('2d')!
sc.imageSmoothingEnabled = false

type ThreatKind = 'mine' | 'frogman' | 'angler' | 'enemySub'
interface Threat {
  kind: ThreatKind
  x: number
  y: number
  vx: number
  born: number
  fireT: number
  flash: number
}
interface Shot {
  x: number
  y: number
}
interface Frag {
  x: number
  y: number
  vx: number
  vy: number
}
interface Boom {
  x: number
  y: number
  size: 'explosionS' | 'explosionM' | 'explosionL'
  t: number
}
interface Puff {
  x: number
  y: number
  t: number
  size: number
}

const RADII: Record<ThreatKind, number> = { mine: 9, frogman: 11, angler: 13, enemySub: 11 }
const SUB_Y = 44

const world = {
  subX: W / 2,
  subTarget: W / 2,
  steerT: 0,
  fireT: 0.4,
  spawnT: 0.6,
  score: 0,
  threats: [] as Threat[],
  torps: [] as Shot[],
  tracers: [] as Shot[],
  frags: [] as Frag[],
  booms: [] as Boom[],
  wake: [] as Puff[],
  ambient: [] as Puff[],
}
for (let i = 0; i < 22; i++) {
  world.ambient.push({ x: Math.random() * W, y: Math.random() * H, t: Math.random() * 9, size: (Math.random() * 3) | 0 })
}

let spawnCycle = 0
function spawnThreat(now: number): void {
  const kinds: ThreatKind[] = ['frogman', 'mine', 'enemySub', 'frogman', 'angler', 'mine']
  const kind = kinds[spawnCycle++ % kinds.length]
  world.threats.push({
    kind,
    x: 24 + Math.random() * (W - 48),
    y: H + 24,
    vx: kind === 'mine' ? 0 : (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 14),
    born: now,
    fireT: 1 + Math.random(),
    flash: 0,
  })
}

function boom(x: number, y: number, size: Boom['size']): void {
  world.booms.push({ x, y, size, t: 0 })
}

function update(dt: number, now: number): void {
  // steering: retarget occasionally, ease toward target (the game's model)
  world.steerT -= dt
  if (world.steerT <= 0) {
    world.steerT = 0.9 + Math.random() * 1.4
    world.subTarget = 30 + Math.random() * (W - 60)
  }
  world.subX += (world.subTarget - world.subX) * Math.min(1, dt / 0.24)

  // fire torpedoes from alternating bow ports
  world.fireT -= dt
  if (world.fireT <= 0) {
    world.fireT = 0.62
    const side = world.torps.length % 2 === 0 ? -6 : 6
    world.torps.push({ x: world.subX + side, y: SUB_Y + 22 })
  }

  // spawn threats
  world.spawnT -= dt
  if (world.spawnT <= 0) {
    world.spawnT = 1.05 + Math.random() * 0.5
    spawnThreat(now)
  }

  // threats rise, wander, and shoot
  for (const th of world.threats) {
    th.y -= 34 * dt
    th.x += th.vx * dt
    if (th.x < 20 || th.x > W - 20) th.vx *= -1
    th.flash = Math.max(0, th.flash - dt)
    if (th.kind === 'enemySub' && th.y < H - 40 && th.y > 120) {
      th.fireT -= dt
      if (th.fireT <= 0) {
        th.fireT = 2.2 + Math.random()
        th.flash = 0.18
        world.tracers.push({ x: th.x, y: th.y - 20 })
      }
    }
    // mine proximity fuse: detonate near the sub's row in a shrapnel ring
    if (th.kind === 'mine' && th.y < SUB_Y + 92) {
      const my = th.y
      th.y = -999
      boom(th.x, my, 'explosionM')
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        world.frags.push({ x: th.x, y: my, vx: Math.cos(a) * 62, vy: Math.sin(a) * 62 })
      }
    }
  }
  world.threats = world.threats.filter((t) => t.y > -40)

  // projectiles
  for (const tp of world.torps) {
    tp.y += 150 * dt
    if (Math.random() < dt * 22) world.wake.push({ x: tp.x + (Math.random() < 0.5 ? -1 : 1), y: tp.y - 8, t: 0, size: (Math.random() * 2) | 0 })
  }
  for (const tr of world.tracers) tr.y -= 130 * dt
  for (const fg of world.frags) {
    fg.x += fg.vx * dt
    fg.y += fg.vy * dt
  }
  world.torps = world.torps.filter((p) => p.y < H + 20)
  world.tracers = world.tracers.filter((p) => p.y > -20)
  world.frags = world.frags.filter((p) => p.x > -10 && p.x < W + 10 && p.y > -10 && p.y < H + 10)

  // torpedo hits
  for (const tp of world.torps) {
    for (const th of world.threats) {
      if (Math.hypot(tp.x - th.x, tp.y + 8 - th.y) < RADII[th.kind]) {
        const hy = th.y
        tp.y = H + 999
        th.y = -999
        world.score += th.kind === 'mine' ? 300 : th.kind === 'enemySub' ? 200 : 100
        // shooting a mine before the fuse arms is a clean kill — no shrapnel
        boom(th.x, hy, th.kind === 'frogman' ? 'explosionS' : 'explosionM')
        break
      }
    }
  }

  // FX clocks
  for (const b of world.booms) b.t += dt
  world.booms = world.booms.filter((b) => b.t < sprites[b.size].frames.length / sprites[b.size].fps)
  for (const p of world.wake) {
    p.t += dt
    p.y -= 26 * dt
  }
  world.wake = world.wake.filter((p) => p.t < 0.7)
  for (const p of world.ambient) {
    p.y -= (6 + p.size * 4) * dt
    if (p.y < -4) {
      p.y = H + 4
      p.x = Math.random() * W
    }
  }
}

function frameAt(name: string, t: number): Frame {
  const a = sprites[name]
  return a.frames[Math.floor(t * a.fps) % a.frames.length]
}

function draw(now: number): void {
  // water: two-tone bands with a checker dither seam, darker with depth
  const bands = ['#1b5352', '#133a40', '#10333a', '#0d242b']
  const bh = H / bands.length
  for (let i = 0; i < bands.length; i++) {
    sc.fillStyle = bands[i]
    sc.fillRect(0, i * bh, W, bh)
  }
  sc.globalAlpha = 0.5
  for (let i = 1; i < bands.length; i++) {
    sc.fillStyle = bands[i]
    for (let x = 0; x < W; x += 2) sc.fillRect(x + (i % 2), i * bh - 1, 1, 1)
  }
  sc.globalAlpha = 1

  const bub = sprites.bubbles.frames
  for (const p of world.ambient) {
    sc.globalAlpha = 0.5
    sc.drawImage(fc(bub[p.size]), Math.round(p.x), Math.round(p.y))
  }
  sc.globalAlpha = 1

  // threats
  for (const th of world.threats) {
    if (th.kind === 'mine') {
      const blinkFps = th.y < SUB_Y + 150 ? 8 : 3 // fuse arming = faster blink
      const f = sprites.mine.frames[Math.floor(now * blinkFps) % 2]
      sc.drawImage(fc(f), Math.round(th.x - f.w / 2), Math.round(th.y - f.h / 2))
    } else if (th.kind === 'enemySub') {
      const f = th.flash > 0 ? sprites.enemySubFire.frames[0] : frameAt('enemySub', now + th.born)
      sc.drawImage(fc(f), Math.round(th.x - f.w / 2), Math.round(th.y - f.h / 2))
    } else {
      const f = frameAt(th.kind, now + th.born)
      const flip = th.vx > 0
      if (flip) {
        sc.save()
        sc.translate(Math.round(th.x + f.w / 2), Math.round(th.y - f.h / 2))
        sc.scale(-1, 1)
        sc.drawImage(fc(f), 0, 0)
        sc.restore()
      } else {
        sc.drawImage(fc(f), Math.round(th.x - f.w / 2), Math.round(th.y - f.h / 2))
      }
    }
  }

  // player: bank by how far the target is, prop always turning
  const lean = world.subTarget - world.subX
  const pose = lean < -6 ? 'playerBankL' : lean > 6 ? 'playerBankR' : 'playerIdle'
  const pf = frameAt(pose, now)
  sc.drawImage(fc(pf), Math.round(world.subX - pf.w / 2), Math.round(SUB_Y - pf.h / 2))

  // projectiles above hulls, In the Hunt style
  for (const p of world.wake) {
    sc.globalAlpha = Math.max(0, 1 - p.t / 0.7)
    sc.drawImage(fc(bub[p.size]), Math.round(p.x), Math.round(p.y))
  }
  sc.globalAlpha = 1
  for (const tp of world.torps) {
    const f = frameAt('torpedo', now + tp.x)
    sc.drawImage(fc(f), Math.round(tp.x - f.w / 2), Math.round(tp.y - f.h / 2))
  }
  for (const tr of world.tracers) {
    const f = frameAt('tracer', now + tr.x)
    sc.drawImage(fc(f), Math.round(tr.x - f.w / 2), Math.round(tr.y - f.h / 2))
  }
  const shf = sprites.shrapnel.frames
  for (const fg of world.frags) {
    const f = shf[Math.floor((now * 10 + fg.vx) % 4 + 4) % 4]
    sc.drawImage(fc(f), Math.round(fg.x - f.w / 2), Math.round(fg.y - f.h / 2))
  }

  // explosions on top of everything
  for (const b of world.booms) {
    const a = sprites[b.size]
    const f = a.frames[Math.min(a.frames.length - 1, Math.floor(b.t * a.fps))]
    sc.drawImage(fc(f), Math.round(b.x - f.w / 2), Math.round(b.y - f.h / 2))
  }

  // arcade HUD line
  sc.fillStyle = '#0c1014'
  sc.globalAlpha = 0.55
  sc.fillRect(0, 0, W, 14)
  sc.globalAlpha = 1
  sc.font = '8px "Press Start 2P", monospace'
  sc.textBaseline = 'top'
  sc.fillStyle = '#cfeef2'
  sc.fillText(`1UP ${String(world.score).padStart(7, '0')}`, 4, 3)
  sc.fillStyle = '#ff8c1a'
  sc.fillText('HI 0050000', W - 84, 3)
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

let last = performance.now() / 1000
function tick(): void {
  const now = performance.now() / 1000
  const dt = Math.min(0.05, now - last)
  last = now
  update(dt, now)
  draw(now)
  drawCards(now)
  requestAnimationFrame(tick)
}

if (reduceMotion) {
  // static tableau: run the sim briefly so the still frame shows real action
  for (let i = 0; i < 240; i++) update(1 / 60, i / 60)
  draw(4)
  drawCards(0)
} else {
  requestAnimationFrame(tick)
}
