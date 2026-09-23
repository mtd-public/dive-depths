/**
 * twoToneConcepts.ts — the concepts page for the two-tone ("Downwell-style")
 * art direction. Serves two shells from one source, like assetPreview.ts:
 *
 *   - `two-tone.html` at the repo root (open via `npm run dev`)
 *   - the published standalone artifact (same file, esbuild-bundled)
 *
 * Top: the real game — physics.ts stepping a World under the title
 * screen's attract-mode AI — drawn by the two-tone renderer, with a
 * palette switcher that recolors the board *and* this page. Below: staged
 * screenshots, the full sprite sheet, and the palette select.
 */
import { createWorld, depthForLeagues, steerLeft, steerRight, step, type World } from './game/physics'
import { iclone, type IFrame } from './game/twoTone/art'
import { TWO_TONE_PALETTES, paletteById, type TwoTonePalette } from './game/twoTone/palettes'
import { RenderTwoTone } from './game/twoTone/renderTwoTone'
import { TwoToneScene } from './game/twoTone/scene'
import { buildPaletteCard, buildSpriteSheet, toRgba } from './game/twoTone/sheets'
import { SHOTS, renderShot, type ShotId } from './game/twoTone/shots'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const fontLink = document.createElement('link')
fontLink.rel = 'stylesheet'
fontLink.href = 'https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=IBM+Plex+Mono:wght@400;600&display=swap'
document.head.appendChild(fontLink)

const style = document.createElement('style')
style.textContent = `
:root {
  color-scheme: dark;
  --bg: #000; --fg: #fff; --acc: #ff1f2d; --acc2: #1f7bff;
  --display: 'Silkscreen', 'IBM Plex Mono', ui-monospace, monospace;
  --mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
}
* { box-sizing: border-box; }
html, body { background: var(--bg); color: var(--fg); }
body { margin: 0; font: 14px/1.55 var(--mono); padding-inline: 16px; padding-block: 24px 56px; transition: background .2s, color .2s; }
.wrap { max-width: 1120px; margin: 0 auto; display: grid; gap: 48px; }
canvas { image-rendering: pixelated; display: block; max-width: 100%; }
h1, h2, h3 { font-family: var(--display); font-weight: 700; margin: 0; text-wrap: balance; letter-spacing: .02em; }
h1 { font-size: clamp(30px, 6vw, 56px); line-height: 1; color: var(--acc); text-shadow: 3px 3px 0 var(--acc2); }
h2 { font-size: 22px; color: var(--fg); }
h2 small { font-family: var(--mono); font-weight: 400; font-size: 13px; color: var(--acc2); margin-left: 10px; letter-spacing: 0; }
h3 { font-size: 13px; color: var(--acc); }
p { margin: 0; max-width: 66ch; }
.eyebrow { font-family: var(--display); font-size: 12px; letter-spacing: .12em; color: var(--acc2); text-transform: uppercase; }
.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 32px; align-items: start; }
.hero__copy { display: grid; gap: 18px; align-content: start; }
.board { border: 2px solid var(--fg); padding: 6px; justify-self: center; width: min(100%, 392px); }
.board canvas { width: 100%; aspect-ratio: 1 / 2; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; }
button, .chip { font: 700 12px/1 var(--display); letter-spacing: .06em; color: var(--fg); background: var(--bg); border: 2px solid var(--fg); padding: 9px 12px; cursor: pointer; }
button:hover { background: var(--fg); color: var(--bg); }
button[aria-pressed="true"] { background: var(--acc); border-color: var(--acc); color: var(--bg); }
button:focus-visible, .card:focus-visible { outline: 2px dashed var(--acc2); outline-offset: 3px; }
.keys { font-size: 12px; color: var(--acc2); }
kbd { font: inherit; color: var(--fg); border: 1px solid var(--fg); padding: 0 4px; }
.now { display: flex; gap: 10px; align-items: center; font-family: var(--display); font-size: 14px; }
.sw { width: 18px; height: 18px; border: 2px solid var(--fg); }
.rules { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px 22px; margin: 0; padding: 0; list-style: none; }
.rules li { border-top: 2px solid var(--fg); padding-top: 8px; font-size: 13px; }
.rules b { font-family: var(--display); font-weight: 700; display: block; color: var(--acc); font-size: 12px; margin-bottom: 2px; }
section { display: grid; gap: 16px; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
.shot { display: grid; gap: 6px; align-content: start; }
.shot canvas { width: 100%; aspect-ratio: 1 / 2; border: 2px solid var(--fg); }
.shot p { font-size: 12px; }
.scroll { overflow-x: auto; border: 2px solid var(--fg); }
.scroll canvas { max-width: none; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
.card { padding: 0; border: 0; background: none; cursor: pointer; }
.card canvas { width: 100%; }
.card[aria-pressed="true"] { outline: 3px solid var(--acc); outline-offset: 2px; }
.card:hover { background: none; }
footer { font-size: 12px; color: var(--acc2); }
code { color: var(--fg); background: none; }
@media (max-width: 760px) { .hero { grid-template-columns: 1fr; } }
`
document.head.appendChild(style)

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...kids)
  return e
}
const html = (tag: keyof HTMLElementTagNameMap, markup: string, cls = '') => {
  const e = document.createElement(tag)
  e.innerHTML = markup
  if (cls) e.className = cls
  return e
}

// ---------------------------------------------------------------------------
// Live board: the real physics under the attract-mode AI
// ---------------------------------------------------------------------------

const boardCanvas = el('canvas')
boardCanvas.setAttribute('aria-label', 'Dive Depths running live in the two-tone renderer')
const renderer = new RenderTwoTone(boardCanvas, { palette: 'abyss', hud: true })

function demoWorld(): World {
  const w = createWorld()
  const leagues = 2600 + Math.floor(Math.random() * 1500)
  w.depth = depthForLeagues(leagues)
  w.nextBossLeagues = leagues + 900
  return w
}
let world = demoWorld()
let steerT = 0
let manualT = 0

// ---------------------------------------------------------------------------
// Palette state — recolors the board, every static canvas, and the page
// ---------------------------------------------------------------------------

const staticCanvases: { canvas: HTMLCanvasElement; frame: IFrame; scale: number; fixed?: TwoTonePalette }[] = []
function paintStatic(entry: (typeof staticCanvases)[number], pal: TwoTonePalette) {
  const { canvas, frame, scale } = entry
  canvas.width = frame.w * scale
  canvas.height = frame.h * scale
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(new ImageData(toRgba(frame, entry.fixed ?? pal, scale), frame.w * scale, frame.h * scale), 0, 0)
}
function staticCanvas(frame: IFrame, scale = 1, fixed?: TwoTonePalette): HTMLCanvasElement {
  const entry = { canvas: el('canvas'), frame, scale, fixed }
  staticCanvases.push(entry)
  paintStatic(entry, renderer.palette)
  return entry.canvas
}

const nowName = el('span')
const nowSw = [el('span', { className: 'sw' }), el('span', { className: 'sw' }), el('span', { className: 'sw' })]
const cardButtons: HTMLButtonElement[] = []

function applyPalette(id: string) {
  renderer.setPalette(id)
  const p = renderer.palette
  const root = document.documentElement.style
  root.setProperty('--bg', p.bg)
  root.setProperty('--fg', p.fg)
  root.setProperty('--acc', p.accent)
  root.setProperty('--acc2', p.accent2)
  // palettes that collapse a role onto bg would hide page text in that role
  if (p.accent2.toLowerCase() === p.bg.toLowerCase()) root.setProperty('--acc2', p.fg)
  if (p.accent.toLowerCase() === p.bg.toLowerCase()) root.setProperty('--acc', p.fg)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg)
  nowName.textContent = `${TWO_TONE_PALETTES.indexOf(p)}.${p.name}`
  ;[p.fg, p.accent, p.accent2].forEach((c, i) => (nowSw[i].style.background = c))
  for (const s of staticCanvases) paintStatic(s, p)
  cardButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(TWO_TONE_PALETTES[i] === p)))
  try {
    localStorage.setItem('twoTone.palette', p.id)
  } catch {
    /* storage is a convenience only */
  }
  if (reduceMotion) renderer.update(world, 'paused', 0, performance.now() / 1000)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const hudBtn = el('button', { type: 'button', textContent: 'HUD' })
hudBtn.setAttribute('aria-pressed', 'true')
hudBtn.onclick = () => {
  renderer.scene.opts.hud = !renderer.scene.opts.hud
  hudBtn.setAttribute('aria-pressed', String(renderer.scene.opts.hud))
}
const lampBtn = el('button', { type: 'button', textContent: 'Searchlight' })
lampBtn.setAttribute('aria-pressed', 'true')
lampBtn.onclick = () => {
  renderer.scene.opts.headlight = !renderer.scene.opts.headlight
  lampBtn.setAttribute('aria-pressed', String(renderer.scene.opts.headlight))
}
const prevBtn = el('button', { type: 'button', textContent: '< Palette' })
prevBtn.onclick = () => applyPalette(renderer.cyclePalette(-1))
const nextBtn = el('button', { type: 'button', textContent: 'Palette >' })
nextBtn.onclick = () => applyPalette(renderer.cyclePalette(1))
const bossBtn = el('button', { type: 'button', textContent: 'Skip to boss' })
bossBtn.onclick = () => {
  world.nextBossLeagues = Math.floor(world.depth / 10) + 1
}

const hero = el(
  'header',
  { className: 'hero' },
  el(
    'div',
    { className: 'hero__copy' },
    el('span', { className: 'eyebrow', textContent: 'Dive Depths / art direction concept' }),
    el('h1', { textContent: 'Two-Tone Descent' }),
    el(
      'p',
      {},
      'A Downwell-inspired redraw of every sprite, the board and the HUD. Every pixel is one of four ',
      el('em', { textContent: 'roles' }),
      ' — water, line art, danger, tech — so the whole game swaps palettes with a lookup. The board on the right is the real game: physics.ts stepping a World, the title screen’s attract-mode AI at the helm.',
    ),
    el('div', { className: 'now' }, el('span', { className: 'eyebrow', textContent: 'Palette' }), nowName, ...nowSw),
    el('div', { className: 'controls' }, prevBtn, nextBtn, hudBtn, lampBtn, bossBtn),
    html('p', '<kbd>&larr;</kbd> <kbd>&rarr;</kbd> take the helm &nbsp; <kbd>C</kbd> cycle palette &nbsp; <kbd>Shift</kbd>+<kbd>C</kbd> back', 'keys'),
    html(
      'ul',
      `<li><b>BG / Water</b>The ground and the ink: every sprite is engraved with it and wrapped in a 1px moat of it.</li>
       <li><b>FG / Line art</b>The player's hull, rock walls, text, marine snow. Lit sides read solid, shadow sides hatch.</li>
       <li><b>Accent / Danger</b>Every enemy is an accent mass; so are hull pips and the boss floor.</li>
       <li><b>Accent 2 / Water &amp; tech</b>Bubbles, glass, kelp, the searchlight, the laser, pickups.</li>`,
      'rules',
    ),
  ),
  el('div', { className: 'board' }, boardCanvas),
)

// staged shots
const shotScene = new TwoToneScene({ hud: true })
const shotGrid = el('div', { className: 'shots' })
for (const s of SHOTS) {
  const frame = iclone(renderShot(shotScene, s.id as ShotId))
  const c = staticCanvas(frame)
  c.setAttribute('aria-label', `${s.title} concept frame`)
  shotGrid.append(el('figure', { className: 'shot' }, c, el('h3', { textContent: s.title }), el('p', { textContent: s.blurb })))
}
for (const f of shotGrid.querySelectorAll('figure')) f.style.margin = '0'

// sprite sheet
const sheet = buildSpriteSheet(shotScene.sprites)
const sheetCanvas = staticCanvas(sheet, 2)
sheetCanvas.setAttribute('aria-label', 'Two-tone sprite sheet')

// palette select
const cards = el('div', { className: 'cards' })
TWO_TONE_PALETTES.forEach((p, i) => {
  const b = el('button', { type: 'button', className: 'card' })
  b.setAttribute('aria-label', `Use palette ${p.name}`)
  b.append(staticCanvas(buildPaletteCard(i, p.name), 2, p))
  b.onclick = () => applyPalette(p.id)
  cardButtons.push(b)
  cards.append(b)
})

const wrap = el(
  'main',
  { className: 'wrap' },
  hero,
  el(
    'section',
    {},
    html('h2', 'Concept frames <small>staged Worlds, same renderer</small>'),
    shotGrid,
  ),
  el(
    'section',
    {},
    html('h2', 'Sprite sheet <small>every sprite, every frame, 2&times;</small>'),
    el('div', { className: 'scroll' }, sheetCanvas),
  ),
  el(
    'section',
    {},
    html('h2', `Palette select <small>${TWO_TONE_PALETTES.length} palettes &mdash; tap one to recolor everything</small>`),
    cards,
  ),
  html(
    'footer',
    'In the game: add <code>?art=twotone</code> to the URL (with <code>&amp;palette=kelp</code>, <code>&amp;zones=1</code> to change palette every 5000 leagues, <code>&amp;hud=1</code> for the in-board HUD). Source: <code>src/game/twoTone/</code>.',
  ),
)
if (document.body) document.body.append(wrap)
else document.addEventListener('DOMContentLoaded', () => document.body.append(wrap))

let initial = 'abyss'
try {
  initial = localStorage.getItem('twoTone.palette') ?? 'abyss'
} catch {
  /* ignore */
}
applyPalette(paletteById(initial).id)

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    manualT = 4
    if (e.key === 'ArrowLeft') steerLeft(world)
    else steerRight(world)
  } else if (e.key === 'c' || e.key === 'C') {
    applyPalette(renderer.cyclePalette(e.shiftKey ? -1 : 1))
  }
})

let last = performance.now()
function frame(ts: number) {
  const dt = Math.max(0, Math.min((ts - last) / 1000, 1 / 30))
  last = ts
  manualT -= dt
  steerT -= dt
  if (manualT <= 0 && steerT <= 0) {
    steerT = 0.7 + Math.random() * 1.1
    if (Math.random() < 0.5) steerLeft(world)
    else steerRight(world)
  }
  step(world, dt, { fire: true })
  if (world.collided || world.gameWon) world = demoWorld()
  renderer.update(world, 'playing', dt, ts / 1000)
  requestAnimationFrame(frame)
}
if (reduceMotion) {
  for (let i = 0; i < 90; i++) step(world, 1 / 30, { fire: true })
  renderer.update(world, 'playing', 1 / 30, 3)
} else requestAnimationFrame(frame)
