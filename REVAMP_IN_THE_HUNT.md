# Dive Depths — "In the Hunt" Revamp Concept

A full design revamp of Dive Depths to look and feel like Irem's 1993
arcade submarine shooter **In the Hunt** (海底大戦争, *Kaitei
Daisensou*) — the game whose art team went on to found Nazca and make
Metal Slug. Gameplay reference: https://www.youtube.com/watch?v=m8YRUlesVec

This document is a concept/plan, companion to `GAME_DESIGN.md` (which
stays the record of the current build). Nothing here is implemented yet.

---

## What we're stealing, exactly

In the Hunt's identity rests on a handful of signatures. The revamp is
"done" when Dive Depths reads as a cousin of these, not before:

**Visual signatures**
1. **Dense, hand-drawn pixel art** — chunky sprites covered in rivets,
   panel lines, rust streaks and hazard stripes; nothing smooth, nothing
   gradient-shaded. Machines look welded, not modeled.
2. **A murky industrial palette** — gunmetal, olive, rust and
   bottle-green water, so the few saturated things on screen (fire,
   warning lamps, tracer shots) carry all the danger signal.
3. **Enormous multi-frame explosions** — white-hot flash → orange
   fireball → rolling black smoke, 8–12 frames, often bigger than the
   thing that died. Half of In the Hunt's game-feel is its explosions.
4. **A living water surface** — an animated waterline with whitecaps,
   splashes when anything crosses it, ships silhouetted above it.
5. **Background storytelling** — parallax layers of drowned cities,
   wrecks, cave strata and enemy works; the world looks like it was
   already lost before you arrived.
6. **Arcade chrome** — bitmap-font score/hi-score header, stage cards
   ("AREA 2"), attract-mode energy, credits-and-lives framing.

**Gameplay signatures**
1. **Two independent weapon systems on two buttons** — Granvia fires
   torpedoes on one button and vertical ordnance (surface missiles /
   depth charges) on the other. You are always managing two axes of
   threat with two axes of fire.
2. **Move-to-scroll pacing** — the screen mostly advances at *your*
   pace. Pushing forward is a decision, holding back to clear a room is
   a tactic. It plays like a slow, heavy walk through a gauntlet, not a
   conveyor belt.
3. **A heavy, deliberate player vehicle** — the sub accelerates and
   coasts; it feels like 900 tons of steel, not a cursor.
4. **Terrain that matters** — walls, wrecks and crushable structures
   shape every fight; enemies use the terrain, and some of it is
   destructible.
5. **Set-piece stages with themed rosters** — each area has its own
   backdrop, enemy mix and boss, announced with a card.

---

## The one big call: stay vertical

In the Hunt scrolls horizontally. Dive Depths' whole identity — and its
entire physics/engine investment (`physics.ts`, the fixed-row trick,
spawn/scroll/cull) — is a vertical descent. **The revamp keeps the
vertical descent** and translates In the Hunt's signatures 90°: the
waterline is where a run *starts*, terrain closes in from the side
walls, and "forward" is *down*.

This is the recommended shape because it keeps ~100% of `physics.ts`
and the input scheme while still hitting every signature above. The
alternative — a true horizontal conversion — would be a new game on the
same template (new scroll axis, new camera, new spawn logic, buoyancy)
and is out of scope for a *revamp*; it's noted at the end as a possible
sequel direction.

---

## Art direction

### Rendering: retire the 3D scene, render sprites on a fixed grid

The three.js scene (`scene3d.ts`, 1460 lines of mesh builders, lights
and particles) is replaced wholesale by a 2D pixel renderer:

- **Internal resolution: 256 × 352** (portrait; In the Hunt runs
  256 × 224 landscape — same pixel density, rotated proportions).
  Everything is drawn to an offscreen canvas at exactly this size with
  `imageSmoothingEnabled = false`, then blitted to the display canvas
  at the **largest integer scale** that fits the board-shell, centered,
  with CSS `image-rendering: pixelated` as a belt-and-braces. No entity
  is ever drawn at a fractional coordinate — positions round to the
  pixel grid at draw time (physics keeps full float precision
  internally, exactly as now).
- **Layered draw order**, back to front:
  1. Water fill (per-zone flat color + subtle dithered vertical banding)
  2. Far parallax (silhouette layer, ~0.25× scroll speed)
  3. Near parallax (detail layer, ~0.5× scroll speed)
  4. Terrain (side-wall strata, wrecks — 1× world speed)
  5. Pickups, threats, boss
  6. Player sub
  7. Projectiles (always on top of hulls, In the Hunt-style)
  8. FX (explosions, splashes, bubbles, muzzle flashes)
  9. Surface line (zone 1 only, scrolls off as you dive)
  10. Darkness vignette (see **Depth and light** below)
- **The camera concept disappears.** Board units map linearly to
  pixels: `BOARD_W → 256`. `frameCamera`, fog, and all real lights go
  away; "lighting" becomes palette choice and a vignette, the way it
  does in every sprite game.

`GameCanvas.tsx` (canvas + ResizeObserver + rAF wrapper) survives
untouched in structure — it just calls the new renderer instead of the
three.js one. `physics.ts` doesn't know the renderer changed.

### Sprites

Authored as a single atlas (`src/assets/atlas.png` + a frame-metadata
module), Aseprite-friendly. Target sizes at 1× internal resolution:

| Sprite | Size (px) | Frames | Notes |
|---|---|---|---|
| Player sub | 32 × 48, nose-down | 2 idle (prop spin) + 2 bank L/R + 2 hit-flash | Granvia's design language rotated 90°: fat riveted hull, bulbous nose, side dive-planes, twin torpedo ports visible at the nose, cockpit dome with a visible pilot silhouette. Banking frames lean the hull when steering. |
| Torpedo (player) | 8 × 16 | 2 (prop flicker) | Steel body, orange warhead band, bubble wake emitted as particles. Replaces the glowing orb sprite. |
| Side torpedo | 16 × 8 | 2 | Same design, horizontal. |
| Enemy frogman squad | 16 × 24 each | 4 swim cycle | Replaces "fish": In the Hunt-style wetsuit divers with propulsion sleds, rising in loose formation. Reads mechanical-military, not aquarium. |
| Angler drone | 32 × 32 | 4 (lure pulse + jaw) | Replaces "monster": a biomechanical anglerfish — welded plates, one glowing lure lamp (the screen's brightest point in deep zones). |
| Enemy sub | 40 × 24 | 2 + 2 muzzle-flash | Riveted olive-drab hull, red running lamp, visible torpedo tube pointing up-screen. |
| Mine | 16 × 16 | 2 lamp blink | Classic horned contact mine; blink rate doubles when its proximity fuse arms (readable warning for the existing auto-detonate rule). |
| Mine shrapnel / enemy shot | 8 × 8 | 2 | Tracer-style: hot core, short tail. Player fire stays orange-family, enemy fire red-family — the existing at-a-glance rule, now in sprite form. |
| Tentacle (wall hazard) | 32 × 96 segment, tiling | 4 sway | Drawn as part of the terrain art — a rotted colossal limb wrapped in chains and hull plating, In the Hunt's "the deep already ate a navy" flavor. |
| Supply pod (power-ups) | 20 × 20 | 2 bob + parachute-buoy | All four power-ups become In the Hunt-style supply pods dropped on a float line, stenciled with their letter: **S** (shotgun→"spread"), **L** (laser), **+** (repair), **★** (extra life). |
| Boss ("the Warden") | ~224 × 96 | jaw 4, eyes 2, tentacles 4 | The existing implied-mass boss redrawn as a drowned dreadnought fused with the creature — gun-deck teeth, searchlight eyes. Spans the board width as today. |
| The Kracken | ~240 × 120 | as boss + 16 limb sprites | Orange-lit biomechanical variant, more limbs, same design language. |
| Explosion S / M / L | 16 / 32 / 64 sq | 6 / 8 / 12 | The centerpiece FX. White flash → orange-yellow fireball → black smoke curl. Large version reserved for mines, enemy subs and boss death chains (a rolling sequence of M explosions along the hull, In the Hunt boss-kill style). |
| Splash / surface FX | 32 × 16 | 4 | Zone 1 only: whitecap strip + splash where the sub enters. |
| Bubbles | 2–6 px | 3 | Sparse rising motes; also the torpedo wake. |

**Bootstrapping without an artist:** every sprite above gets a
*procedural placeholder* first — drawn once at boot into the atlas
canvas from small paletted pixel arrays (the same spirit as the current
`bulletOrbTexture` canvas baking). The game becomes fully playable in
placeholder pixel art, and real Aseprite art replaces atlas regions
incrementally without touching code. This keeps the revamp shippable in
stages instead of blocking on a full sprite sheet.

### Palette

One master palette of ~24 colors, In the Hunt-derived, defined once in
`palette.ts` (which loses its three.js dependency entirely):

```
Water/ambient        #081418  #0d242b  #133a40  #1b5352  #2d6b60
Steel (player)       #39424c  #5a6670  #8a97a0  #c2ccd2
Olive (enemy)        #2e3a26  #4a5a34  #6e7d46
Rust/wood            #4a2d1c  #7a4a26  #a8703a
Fire ramp            #fff8d0  #ffd23e  #ff8c1a  #c93a12
Smoke                #16161c  #2c2c34  #4a4a54
Warning red          #d8302a  #ff5a4a
Lamp/lure glow       #aef2e0  #ffe9a0
Surface sky (zone 1) #c8dfe8  #8fb8c8
```

Rules, In the Hunt style: **no gradients** — shading is 2–3 stepped
tones plus dithering; **saturation is information** — the fire ramp,
warning red and lamp glow are reserved for danger and pickups, never
decoration; enemy hardware sits in olive/rust, player hardware in blue
steel, so allegiance reads before shape does.

### Depth and light (replacing the palette lerp and real lights)

The continuous `SURFACE → DEEP` lerp becomes **five discrete zones**,
which doubles as In the Hunt's stage structure (see **Zones** below).
Each zone owns a water color, a dither-band tint, and its two parallax
layers. Crossing a boundary cross-fades over ~2 seconds of scroll —
that's the whole "water darkens" system now, cheaper and more arcade.

The sub's lights survive as *sprite* effects: a cone-shaped dithered
headlight overlay under the nose and a 2-frame beacon blink on the
tower, both only drawn from zone 3 down. The old "visible light pool"
disc becomes a soft dithered ellipse behind the hull in the two darkest
zones. Enemy lamps, the angler lure and mine lamps are just bright
palette pixels + a 1px glow halo — no real lights anywhere.

### Zones (stage cards over a continuous dive)

The dive stays one continuous run (no level select, no gates), but the
backdrop, enemy mix and music mood shift on league milestones, each
announced with an In the Hunt-style stage card (`AREA 1 — THE
SHALLOWS`) sliding through the board:

| Zone | Leagues | Backdrop | Roster skew |
|---|---|---|---|
| 1 · The Shallows | 0–2 000 | Surface line w/ ship silhouettes, sun shafts, harbor debris | Frogmen, sparse mines |
| 2 · The Kelp Trench | 2 000–6 000 | Kelp columns, listing freighter wrecks | + enemy subs, formations begin |
| 3 · The Drowned City | 6 000–11 000 | Sunken towers, streetlights still burning | + angler drones, tentacles, denser mines |
| 4 · The Vents | 11 000–16 000 | Volcanic strata, smokers venting particle columns | Everything, faster; ambient ember particles |
| 5 · The Machine Deep | 16 000–20 000 | Enemy foundry works, girders, chained colossal limbs | Heaviest mix, pre-Kracken dread |
| — · Kracken's Lair | 20 000 | Zone 5 art, red-shifted | The Kracken |

Boss fights keep their existing 1 000-league cadence and mechanics; the
boss simply renders in the active zone's ambience. The `BossBanner`
becomes a bitmap-font `WARNING` card with the klaxon-stripe border In
the Hunt uses, then the existing HP ring renders as a segmented
pixel bar under the top HUD instead of an SVG ring.

---

## Gameplay revamp

The current game already shares DNA with In the Hunt (submarine, two
kinds of ordnance in the world, mines, terrain hazards, set-piece
bosses). Four changes close the distance. Everything not listed
here — lives/HP model, power-up set, boss cadence, the Kracken win
condition, scoring — carries over unchanged.

### 1. Dive throttle (the move-to-scroll translation)

In the Hunt's screen advances at your pace; ours descends at the
game's. Translation: the player gets a **throttle on descent speed**.

- Base scroll continues exactly as today (`BASE_SPEED` + ramp), but the
  player modulates it: **hold Down / swipe-hold downward** to dive at
  up to ~1.6× ("push forward"), **hold Up / swipe-hold upward** to
  brake to ~0.55× ("hold position and clear the room"). Release eases
  back to 1× with the same `dt/easeTime` smoothing steering uses.
- Score-per-league already rewards distance, so throttling up is
  risk-for-points and braking is safety-for-time — the exact tactical
  texture of In the Hunt's self-paced scroll, with zero new spawn
  logic (spawns are already distance-driven).
- The sub sprite pitches: nose-down frames at full throttle, level at
  brake — sells the 900-tons-of-steel feel. Steering ease-time gets
  ~15% slower to add weight, compensated by slightly wider threat gaps
  in tuning.

### 2. Two weapon systems on two buttons

Currently one fire action. In the Hunt's core verb-pair, translated:

- **Torpedoes (primary, existing `fire`)** — unchanged mechanically:
  down-screen shots, cooldown, shotgun power-up upgrades to a spread,
  laser ultimate unchanged (re-skinned as a bubbling **sonic lance**,
  a dithered white-hot column).
- **Side torpedoes (new, second button)** — one torpedo out of *each
  flank simultaneously*, on its own (longer) cooldown. This is the
  depth-charge translation, and it finally gives a weapon answer to
  the game's two side-wall problems: it's the only weapon that can
  destroy **tentacle segments** (locally — blows a passable notch
  rather than removing the whole hazard, preserving the terrain-threat
  role) and it one-shots wall-hugging threats that down-fire can't
  reach without lane-committing.
- Input: keyboard `X` / `Space` stays torpedoes, `Z` / `Shift`
  side-fires. Touch: tap fires torpedoes (as today), **two-finger tap
  or double-tap** side-fires. `useBoardControls` grows one callback.

### 3. Terrain: the walls become the level

Tentacles are today's only side-wall pressure. In the Hunt is *made*
of terrain. Additions, all riding the existing threat spawn/scroll
machinery as new non-destroyable (or semi-destructible) threat types:

- **Strata shelves** — rock/wreck outcrops jutting from either wall
  (the one-sided band pattern tentacles already use), pure collision,
  drawn as part of each zone's art. Spawn weight rises with depth.
- **Crushable wrecks** — a mid-board derelict chunk (freighter bow,
  drowned bus, foundry crate by zone) with 2–3 HP: torpedoes chew
  through it in pieces (each chunk its own S explosion) for small
  points, or it can be dodged. This is In the Hunt's destructible-
  structure joy at minimum engine cost — it's just a threat with HP
  that already exists (the boss proves multi-hit threats work).
- Formations gain a terrain flavor: a shelf with a mine tethered at
  its lip, a wreck with frogmen behind it — composed spawns using
  existing pieces.

### 4. Arcade presentation layer

- **HUD**: topbar restyled as an arcade header rendered *in-canvas* in
  a 8×8 bitmap font: `1UP 0012400   HI 0056000   ARMOR ████████░░`,
  with the league counter as `DEPTH 04231L` top-right. The React
  topbar/sidebar stay for the surrounding page chrome but go
  visually quiet (the template shell remains; it just frames a CRT).
- **Armor, not hearts**: the 8-HP pool renders as a segmented armor
  bar (steel → amber → red as it drains, reusing the existing
  color-by-remaining rule). The hull hitbox stays visible — re-drawn
  as a blinking 4×4 px core, bullet-hell style.
- **Attract/overlay**: `GameOverlay` re-skinned to arcade type — big
  bitmap wordmark, `PRESS FIRE TO DIVE` blink, `GAME OVER` letter-
  slam, the Kracken victory screen as a proper arcade ending card.
  Framer-motion stays; it just animates chunkier things.
- **Optional CRT dressing** (CSS-only, one toggle): scanline overlay +
  slight corner vignette on the board-shell. Off by default on small
  screens.
- **Screen feel**: 2-frame screen shake on L explosions and boss
  hits; hit-stop of ~40 ms on the killing blow of a boss. Cheap, and
  half of what makes Irem hits feel heavy.

---

## File-by-file plan

Same table discipline as `GAME_DESIGN.md`:

| File | Action | Notes |
|---|---|---|
| `src/game/scene3d.ts` | **Delete** | Replaced by `render2d.ts` + `atlas.ts`. Nothing imports three.js afterward; `three` and `@types/three` leave `package.json` (−600 KB from the bundle). |
| `src/game/render2d.ts` | **New** | Offscreen 256×352 canvas, layer pipeline, integer-scale blit, palette application, zone cross-fade, vignette, screen shake. Exposes the same surface `GameCanvas` calls today (`init(canvas)`, `render(world, dt)`, `resize()`). |
| `src/game/atlas.ts` | **New** | Atlas loading, frame metadata, and the procedural placeholder generator (paletted pixel arrays → atlas regions). |
| `src/game/fx.ts` | **New** | Sprite-frame FX scheduler: explosions, splashes, bubbles, muzzle flashes, boss death chains. Replaces the instanced-particle systems. |
| `src/game/palette.ts` | **Rewrite** | Drops three.js types. Master 24-color table + per-zone { water, ditherTint, parallaxRefs, sprite-tint swaps }. `paletteAt(depth)` becomes `zoneAt(leagues)` + `zoneBlend` for the cross-fade. |
| `src/game/physics.ts` | **Extend** | Adds: throttle factor into the scroll-speed term; `sideTorpedoes[]` (x-velocity missiles, same collision path); `wreck` threat type (HP > 1, chunk positions); tentacle segment HP vs. side-torpedoes; terrain-flavored formation recipes. Everything else untouched. |
| `src/game/types.ts` | **Extend** | `throttle`, `sideFireCooldown`, new threat/FX type unions, `zone` in the UI state snapshot. |
| `src/game/useGameEngine.ts` | **Extend** | Second fire action `sideFire()`; Up/Down throttle key handling (held, not per-press — throttle is the one held control); zone-change detection → stage-card trigger. |
| `src/hooks/useBoardControls.ts` | **Extend** | Adds two-finger-tap/double-tap → `onAltTap`, vertical swipe-hold → `onThrottle(dir, held)`. Horizontal swipe/tap behavior unchanged. |
| `src/components/GameCanvas.tsx` | **Keep** | Same wrapper; calls `render2d`. |
| `src/components/BossBanner.tsx` | **Rewrite (visual)** | WARNING card + segmented pixel HP bar, both drawn in-canvas by `render2d`; the React component shrinks to a11y text/live-region duty. |
| `src/components/WeaponBadge.tsx` | **Rewrite (visual)** | Weapon status moves into the in-canvas HUD line (spread timer, lance charge, side-torpedo cooldown pips); component keeps the follow-the-sub badge only for the lance "FIRING" callout. |
| `src/components/GameOverlay.tsx`, `KeyboardHelp.tsx`, `StatsSidebar.tsx`, `App.tsx` | **Re-skin** | Copy and styling only: bitmap-font arcade type, new key list (steer / throttle / torpedoes / side-torpedoes), armor + zone stats. Structure untouched. |
| `src/styles/index.css` | **Extend** | Pixel-scaling rules (`image-rendering: pixelated`), bitmap font-face, CRT toggle classes, arcade re-theme of the template chrome (dark bezel around the board-shell). |
| `src/assets/atlas.png`, `src/assets/font8.png` | **New (phase 2)** | Real art; placeholders make these optional until they exist. |
| `GAME_DESIGN.md` | **Keep** | Historical record; this file is the forward plan. |

Net effect, same sentence as the original doc: **nothing about the
architecture changes.** `physics.ts` grows three mechanics; every other
change is what the world *looks like* and how two new inputs reach it.

---

## Implementation order

Each step leaves the game playable; placeholder art makes step 1
possible before any real sprite exists.

1. **Renderer swap behind the same interface** — `render2d.ts` +
   procedural placeholder atlas, drawing the *current* game (all
   existing entities, HUD numbers, explosions as simple frame FX).
   Delete `scene3d.ts` and the three.js dependency. The game looks
   pixel-arcade immediately, in placeholder art.
2. **Palette + zones** — master palette, five zone tables, cross-fade,
   stage cards, sprite headlight/beacon in dark zones. Depth reads.
3. **FX pass** — the three explosion sizes, splash strip in zone 1,
   boss death chain, screen shake + hit-stop.
4. **Throttle** — input, physics term, pitch frames, tuning pass on
   `BASE_SPEED`/spacing so 1× throttle plays like today's game.
5. **Side torpedoes** — input (keyboard + gesture), physics, tentacle
   notching, cooldown pips in HUD.
6. **Terrain** — strata shelves, crushable wrecks, terrain-flavored
   formations; spawn-weight tuning per zone.
7. **Presentation** — in-canvas bitmap HUD, arcade overlay/keyboard-
   help/sidebar re-skin, CRT toggle, WARNING banner.
8. **Real art** — atlas regions replaced with drawn sprites, zone
   parallax layers painted, font sheet. Pure asset drops; no code.

---

## Open questions (defaults chosen, flag to change)

- **One-hit deaths?** In the Hunt is one-hit + stock lives. Default:
  **keep the 8-point armor model** — it's a confirmed decision in the
  current design and suits mobile play; the armor-bar presentation
  keeps the arcade read. A "1CC mode" (1 armor, 3 stocks) could ship
  later as a toggle for purists.
- **Auto-fire?** In the Hunt lets you hammer the button; we have a
  cooldown on tap. Default: **keep manual + cooldown** (confirmed
  decision), tuned slightly shorter so hammering feels rewarded.
- **Sound** — the game currently ships silent and In the Hunt's klaxons
  and muffled underwater booms are a huge part of it. Out of scope
  here, but the FX scheduler in `fx.ts` is the natural hook point;
  worth its own concept round.
- **True horizontal mode** — a faithful left-to-right In the Hunt
  clone is a different game on this template (new scroll axis, buoyancy,
  surface/air duality throughout). Parked as a possible sibling
  project, same lineage as splashy-fish → prof-whip-dash → dive-depths.
