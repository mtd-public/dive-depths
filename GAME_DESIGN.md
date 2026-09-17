# Dive Depths — Game Design Document

## Concept

A submarine descends endlessly through the water column. It never stops
sinking — the player steers it **left and right** and fires **missiles
straight down** at fish, monsters, enemy subs and mines that rise up to
meet it out of the dark. It's splashy-fish's vertical Flappy-Bird trick
(fixed player, world scrolls past) crossed with a vertical shoot-'em-up:
steering keeps you alive, shooting keeps the depths clear.

**Direction convention:** the sub sits fixed near the top of the screen
(same trick as splashy-fish's fish sitting at a fixed row). Threats spawn
below and scroll *up* toward it as it "descends." Missiles fire from the
sub *downward* — toward larger Y — to intercept them before they arrive.
This is a direct 1:1 reuse of splashy-fish's scrolling math; only the
travel direction of the player's projectiles is new.

## Reuse plan — splashy-fish + prof-whip-dash → dive-depths

dive-depths starts as a fork of splashy-fish (itself built on
[generic-game-template](https://github.com/mtd-public/generic-game-template)),
and pulls its touch-control scheme, mobile fire-button layout and a few
scene-building patterns from
[prof-whip-dash](https://github.com/mtd-public/prof-whip-dash) — a
different game on the same template, whose input handling and low-poly
asset-kit approach both fit here better than splashy-fish's own (which
only ever had one action). Everything below is either copied verbatim,
copied-and-extended, or new.

| File | Source | Action | Notes |
|---|---|---|---|
| `src/components/GameCanvas.tsx` | splashy-fish | **Copy verbatim** | Generic canvas + ResizeObserver + rAF wrapper; already engine-agnostic. |
| `src/game/scene3d.ts` | splashy-fish | **Copy, then extend** | Keep camera framing (`frameCamera`), fog, gradient background, bubble particle system, and the `triggerSplashBurst`-style instanced-particle pattern (retarget for missile trails and explosions). Add new mesh builders (below); drop `buildFish` in favor of a submarine, keep `buildMineRig`/`buildChain`/`buildAnchorRig` almost unchanged. |
| `src/game/kit.ts` | prof-whip-dash | **Copy, then extend** | prof-whip-dash's small asset-kit module — a cached `mat(color, opts)` material factory plus `box()`/`cyl()` primitive helpers and a seeded `rnd()` for deterministic per-instance variation — is a cleaner base for building the submarine/threat meshes than hand-rolling materials per mesh type. Add `lathe()`/`cone()` wrappers alongside `box`/`cyl` to cover the organic fish/monster shapes splashy-fish's `buildFish` needs. |
| `src/game/palette.ts` | splashy-fish | **Copy, then extend** | Keep the `SURFACE → DEEP` lerp machinery (`paletteAt`, `mixHex`, `DARKEN_SCORE`) untouched. Add new palette fields for the submarine, enemy sub, monster fish, missiles and explosions, each with a SURFACE and DEEP value like the existing fields. |
| `src/game/physics.ts` | splashy-fish | **Rewrite on the same skeleton** | Same `BOARD_W/BOARD_H`, fixed-row trick, `step(world, dt, input)` shape, speed/spacing-scale-with-score formulas, and circle/band overlap-testing approach. Entities change from one `obstacles[]` array to `threats[]` + `missiles[]` + `projectiles[]` (enemy fire). Steering itself borrows prof-whip-dash's eased-step model (its `laneX += (target - laneX) * min(1, dt / switchTime)` smoothing over `moveLane`) rather than splashy-fish's current-and-splash velocity model. See **Physics model** below. |
| `src/game/types.ts` | splashy-fish | **Extend** | Add `lives` to `GameState`. |
| `src/game/useGameEngine.ts` | both | **Extend** | Same reducer/rAF-loop split (mutable world in a ref, React state only for score/phase/lives). Input grows from one boolean (`splash`) to discrete `steerLeft()`/`steerRight()`/`fire()` actions, mirroring prof-whip-dash's `moveLeft`/`moveRight`/`crack` shape and its per-keydown (not hold-to-move) keyboard handling. |
| `src/hooks/useBoardControls.ts` | prof-whip-dash | **Copy verbatim** | The tap-a-side-of-the-board / swipe-threshold gesture hook, wired to `steerLeft`/`steerRight` exactly as it's wired to `moveLeft`/`moveRight` today — this *is* the "tap left/right to move" control. |
| `src/components/GameOverlay.tsx` | splashy-fish | **Copy, re-skin copy** | Same phase-driven overlay/animation; new title, blurb and button labels. |
| `src/components/StatsSidebar.tsx` | splashy-fish | **Copy, extend** | Same `Stat` component; add a Lives stat next to Score. |
| `src/components/KeyboardHelp.tsx` | splashy-fish | **Copy, re-skin copy** | Update key list: steer + fire instead of splash. |
| `src/App.tsx` | both | **Copy, re-skin** | Template topbar/board-shell/footer/depth-badge from splashy-fish; wire `useBoardControls` onto the board exactly as prof-whip-dash's `App.tsx` does; add prof-whip-dash's in-board `.whip-tap`-style large circular/pill button, retargeted as the **Fire** button (see **Controls**), alongside a footer-bar Fire button for landscape/desktop. Lives readout joins Score in the topbar. |
| `.whip-tap` CSS rule | prof-whip-dash | **Copy, rename `.fire-tap`** | Absolute-positioned, bottom-center, `90vw` pill, safe-area-aware, hidden above the portrait breakpoint where the footer bar takes over — copied as-is, just retargeted at firing instead of whipping. |
| Health-ring pattern (`makeHealthRing`/`setHealthRing`/`makeRingShard`) | prof-whip-dash | **Copy, then extend** | A natural fit for the 3-lives model: three lit segments on/near the sub's hull (gold→amber→red as lives drop), with a segment breaking loose and tumbling away on a hit — reused instead of inventing a new lives indicator. |
| Toast system (`Hud.tsx`) | prof-whip-dash | **Copy, then extend** | Transient on-screen messages ("Life lost", "Mine destroyed!") for combat feedback that splashy-fish's single-obstacle-type game never needed. |
| Shell (`generic-game-template` chrome: topbar, footer, layout CSS) | template | **Copy verbatim** | Not being touched at all — this is the whole point of building on the template. |

Net effect: nothing about the *architecture* changes. What changes is the
shape of `World` in `physics.ts` and the meshes `scene3d.ts` draws.

## Entities

### Player submarine
- Fixed screen row (`SUB_Y`, same role as `FISH_Y`), free horizontal
  position `subX` clamped to `[SUB_R, BOARD_W - SUB_R]`.
- **Discrete, eased step steering** — the prof-whip-dash model, not
  splashy-fish's current-pulls-you-back-you-splash-to-counter one: each
  `steerLeft()`/`steerRight()` call (one per keypress, one per
  tap/swipe) nudges a `subTargetX` by a fixed `STEP` and clamps it to
  bounds; every frame `subX` eases toward `subTargetX` the same way
  prof-whip-dash eases `laneX` toward `LANE_X[lane]`
  (`x += (target - x) * min(1, dt / STEP_TIME)`). Unlike prof-whip-dash
  there's no fixed 3-lane grid — `subTargetX` moves in continuous board
  space by `STEP` increments — so threat placement stays as free-form as
  splashy-fish's gap system instead of snapping to lane slots. This one
  mechanism drives keyboard, tap and swipe input identically; see
  **Controls**.
- **3 lives**, shown as a 3-segment ring on the sub's hull (reusing
  prof-whip-dash's health-ring pattern). On taking a hit: lose a
  segment (it breaks free and tumbles away, `makeRingShard`-style), play
  a hit/explosion burst, and go briefly invincible (flash the sub,
  ~1.5s, matching the `fishGlowIntensity`-style emissive pulse already
  in the palette system). Lose the 3rd segment → game over.

### Missiles (player-fired)
- Fired downward from `subX, SUB_Y` on **manual fire** (fire
  button/key), rate-limited by a cooldown (tunable, starts short enough
  to feel responsive but not spammy).
- Travel straight down at a fixed speed, culled off the bottom of the
  board if they miss everything.
- On overlapping a threat's hit circle: destroy the threat (score
  points, spawn an explosion burst) and consume the missile.
- **Mines are destroyable too** (for a score bonus) — a well-timed shot
  clears one instead of forcing a dodge, adding a risk/reward option
  since destroying a mine means holding a lane instead of steering clear
  of it.

### Threats (spawn below, scroll up — cycled like splashy-fish's
`OBSTACLE_CYCLE`, growing more varied with depth)

1. **Fish/monsters** — organic, destroyable by missiles, worth base
   points. Built the way splashy-fish's `buildFish` is (lathed body +
   cone fins), just re-themed: small reef-fish variant early, spikier
   anglerfish-style "monster" variant at depth (bigger silhouette, a
   lure light using the same emissive-glow pattern as `mineLamp`).
   Simple side-to-side wander as they rise, so they're not pure static
   targets.
2. **Enemy subs** — destroyable, worth more points than fish, and **fire
   back**: on a cooldown, an enemy sub launches a projectile upward at
   the player's column. This adds a second class of moving hazard
   (`projectiles[]` in the world state) that the player must dodge
   independent of steering around the sub itself. Visually: boxy hull +
   small conning tower + a running-light color from the palette (reusing
   the `anchorMetal`/`metalness`/`metalRough` material recipe).
3. **Mines** — the existing tethered-mine-on-a-chain hazard from
   splashy-fish, **copied essentially unchanged** (`buildMineRig` +
   `buildChain` + the tethered-segment layout that anchors it to a gap
   edge). Now destroyable by a direct missile hit for bonus points,
   otherwise a pure dodge like today.

### Enemy projectiles
- Spawned by enemy subs, travel straight down toward the player (i.e.
  in the *same* direction as player missiles, both moving toward
  larger Y — enemy subs fire "up" the screen but the coordinate math is
  identical to missiles since both threats and projectiles use
  world-scroll-relative motion; see **Physics model**).
- Overlapping the sub's hit circle costs a life, same invincibility-flash
  rule as any other hit.
- Small, fast, visually distinct from missiles (different color/glow so
  the player can tell incoming fire from their own shots at a glance).

## Physics model (extends `physics.ts`'s shape)

```
World {
  subX, subTargetX        // eased position and step-target (steering)
  invincibleT             // >0 while flashing after a hit
  livesLit                // 0-3, drives the hull ring (prof-whip-dash's `lit`)
  threats[]               // { id, y, x, type: 'fish'|'monster'|'sub'|'mine', hp, ... }
  missiles[]               // { id, x, y }  — player-fired, travel down
  projectiles[]            // { id, x, y }  — enemy-fired, travel down
  fireCooldown
  lives, score, depth
  collided                 // gameover flag, same role as splashy-fish's `collided`
}
```

- `step(world, dt, input: { fire: boolean })` mirrors splashy-fish's
  `step(world, dt, { splash })` shape for continuous per-frame input;
  `steerLeft(world)`/`steerRight(world)` are separate discrete calls
  (mirroring prof-whip-dash's `moveLane`) invoked once per keypress or
  gesture, not read out of `input` every frame. `step`'s internal order:
  ease `subX` toward `subTargetX` → advance spawns → scroll entities →
  advance missiles/projectiles → resolve collisions → cull off-screen.
- Speed-with-score, gap/spacing-shrink-with-score and the
  `OBSTACLE_CYCLE`-style weighted spawn cycle all carry over as
  formulas, just renamed for threats instead of obstacle bands and
  tuned so a life-based game (forgiving) doesn't trivialize as fast as a
  one-hit game would.
- Collision tests stay circle/AABB overlap checks exactly like today's
  gap test — no new collision technology, just more entity types running
  through the same kind of check.
- `depth` (renamed from splashy-fish's `score`-drives-`DARKEN_SCORE`)
  keeps rising even between kills, so the water keeps darkening on a
  steady clock; combat `score` is depth-passed + kill points, shown
  separately in the UI the way splashy-fish already separates its topbar
  score from the sidebar's "Best."

## Controls

| Action | Input |
|---|---|
| Steer left/right | Arrow keys / A-D (one step per keydown, no hold-repeat); **tap the left/right half of the board**, or **swipe left/right** past a small threshold, using `useBoardControls` copied verbatim from prof-whip-dash |
| Fire | Space / a **large Fire button** — in portrait, a `.fire-tap`-style pill anchored bottom-center *inside the board*, thumb-reachable and copied from prof-whip-dash's `.whip-tap`; in landscape/desktop, a **Fire** button in the footer bar replacing splashy-fish's Splash button (prof-whip-dash's own footer keeps left/right buttons too — dive-depths' footer only needs Fire, since desktop steering is keyboard, not on-screen arrows) |
| Pause | P / Pause button (unchanged from template) |

Steering is copied wholesale from prof-whip-dash: same
`useBoardControls` gesture hook (tap a side of the board → immediate
step that direction; a drag past `SWIPE_PX` fires immediately rather
than waiting for release, so it keeps up with fast play), same
per-keydown (not held-key) keyboard handling. Firing is the one new
action beyond what either source game needed — splashy-fish had no
attack and prof-whip-dash's "whip" is a dodge/attack hybrid tied to lane
timing, not a free-aim shot — so it gets its own button rather than
overloading steer or an auto-fire timer, per the confirmed design
decision below.

## Visual design

- **Camera, fog, gradient backdrop, ambient bubbles**: reused
  unmodified from `scene3d.ts` (`frameCamera`, `gradientTexture`, the
  `Bubble`/`bubbleMesh` system).
- **Submarine model**: low-poly flat-shaded three.js primitives in the
  same style as splashy-fish's fish — cylindrical hull, boxy conning
  tower, small fins/dive planes, a spinning-cone propeller, and a
  downward-pointing emissive "headlight" cone reusing the
  glow-material recipe (`emissive`/`emissiveIntensity`) already used for
  `mineLamp` and `coralTip`.
- **Missiles**: small emissive capsule/cone with a short bubble-trail,
  built by retargeting the existing `InstancedMesh` particle pattern
  (`bubbleMesh`/`splashMesh`) rather than inventing a new particle
  system.
- **Explosions** (missile-kills-threat, threat-hits-sub, mine
  detonation): the same instanced radial-burst approach as
  `triggerSplashBurst`, retinted orange/white, spawned at the impact
  point.
- **Threat models**: fish/monster reuse `buildFish`'s lathe+cone-fin
  technique with new proportions and palette; enemy sub is a new boxy
  hull built the same primitive-composition way as `buildAnchorRig`;
  mines are `buildMineRig`/`buildChain` unchanged.
- **Palette** (`palette.ts`): keep `SURFACE`/`DEEP`/`paletteAt` exactly
  as-is, add matching SURFACE/DEEP pairs for `subHull`, `subGlow`,
  `monsterBody`, `monsterGlow`, `enemySubHull`, `enemySubLight`,
  `missileBody`, `missileGlow`, `enemyProjectile`, `explosion` — each
  just another entry in the same lerp table.
- **Lives ring**: a 3-segment torus ring mounted on the sub's hull
  (visible from the fixed camera the whole run, the way prof-whip-dash's
  ring sits on the Professor's back), lit gold/amber/red by `livesLit`
  via the same `setHealthRing`-style swap, with a segment breaking free
  and tumbling off (`makeRingShard`) on a hit.

## UI shell

Topbar, footer bar, board-shell, depth-badge, overlay, sidebar and
keyboard-help panel all come from the template via splashy-fish
unchanged in structure; the board gains prof-whip-dash's in-board fire
button and toast layer, and copy/stats change throughout:

- Topbar: title "Dive Depths", Score stat (as today) + a **Lives** stat.
- Board (in addition to the canvas): `useBoardControls` wired to
  `steerLeft`/`steerRight` on the whole board-shell (tap/swipe
  anywhere), plus the `.fire-tap` button (prof-whip-dash's `.whip-tap`,
  renamed and retargeted) anchored bottom-center for portrait, hidden
  above that breakpoint where the footer's Fire button takes over. A
  toast layer (prof-whip-dash's `Hud.tsx` `toast` prop) surfaces brief
  hits/kills feedback.
- Sidebar: Best + Score (as today), Lives.
- Overlay: ready/paused/over copy rewritten for submarine framing ("Tap
  left/right or use ←/→ to steer, fire with Space or the Fire button —
  clear the depths and don't get hit three times.").
- Footer: **Fire** button instead of **Splash** (no on-screen
  left/right buttons here — desktop steering is keyboard, and portrait
  gets the in-board `.fire-tap` instead of this bar; see **Controls**).

## Difficulty & pacing

Same shape as splashy-fish's tuning constants (`BASE_SPEED`/`MAX_SPEED`,
`SPEED_GAIN_PER_POINT`, `SPAWN_SPACING`, gap-shrink-with-score): scroll
speed and threat density ramp with depth, and the threat-type cycle
skews toward enemy subs and monsters (vs. plain fish and mines) the
deeper the player goes, mirroring how splashy-fish's `OBSTACLE_CYCLE`
weights toward harder obstacle types over time.

## Confirmed design decisions

- **Damage model**: 3 lives with a brief invincibility flash after each
  hit (not one-hit death).
- **Firing**: manual fire button/key on a cooldown (not auto-fire).
- **Enemy subs**: fire back — adds a `projectiles[]` dodge layer.
- **Mines**: destroyable by a direct missile hit for bonus points, in
  addition to being dodgeable.
- **Touch steering**: tap-a-side-of-the-board / swipe, reusing
  prof-whip-dash's `useBoardControls` verbatim, driving the same
  discrete step-and-ease steering as keyboard input.
- **Fire button**: a large `.fire-tap`-style button anchored bottom-
  center inside the board for portrait (copied from prof-whip-dash's
  `.whip-tap`), plus a footer Fire button for landscape/desktop.

## Suggested implementation order

1. Fork the shell + `GameCanvas`/`palette.ts` machinery straight from
   splashy-fish, and `kit.ts` from prof-whip-dash; get a static
   submarine rendering with the depth-based background and camera
   framing working (no gameplay yet).
2. Port `physics.ts`'s skeleton to the new `World` shape: discrete
   step-and-ease steering, `threats[]` spawn/scroll/cull, sub-vs-threat
   collision, 3-lives + invincibility timer, game over.
3. Wire up input: copy `useBoardControls` verbatim for tap/swipe, add
   per-keydown steer handling to `useGameEngine`, add the `.fire-tap`
   button and footer Fire button.
4. Add `missiles[]`: fire input + cooldown, travel, missile-vs-threat
   collision, scoring, explosion trigger, mine-destruction bonus.
5. Add enemy-sub behavior + `projectiles[]`: enemy fire timer,
   projectile travel, projectile-vs-sub collision.
6. Add the hull lives-ring and toast layer from prof-whip-dash.
7. Re-skin the template UI (overlay copy, footer button, sidebar/topbar
   stats, keyboard help).
8. Tune pacing constants (speeds, spawn spacing, fire cooldowns, step
   size/timing) by playtesting.

## Since the initial build

Implementation and playtesting moved a few mechanics past what's described
above; this section is the delta.

- **Mines auto-detonate.** Rather than a pure dodge/shoot point hazard, a
  mine now carries a proximity fuse: once it closes to within a set range
  of the sub's row it detonates on its own, spraying 8 shrapnel bullets in
  an even ring (an omnidirectional `Projectile` variant, `kind: 'mine'`,
  reusing the same 2D-velocity travel and sub-collision code as enemy sub
  fire). A missile that pops one *before* the fuse triggers is still a
  clean kill — no spray, just points — so shooting mines early is now a
  real risk/reward call, not just a bonus.
- **Tentacles replace the third planned hazard variant.** Instead of
  reusing splashy-fish's tethered-mine-on-a-chain layout a third time, a
  new `tentacle` threat reaches in from one wall only (like splashy-fish's
  obstacle bands, but one-sided) with a Loch-Ness monster's dark,
  glowing-eyed head implied just off the edge. It's pure terrain — not
  destroyable by missiles, only by the laser ultimate — and its reach was
  tuned down after playtesting showed the original 55–72%-of-board-width
  range ate too much of the playfield; it now spans 32–48%.
- **Power-ups.** A `powerups[]` array joins `threats[]`: **shotgun** (a
  timed buff — fire sprays a 5-missile fan instead of one shot), **laser**
  (a one-shot ultimate — the next fire input sweeps a 25%-of-board-width
  beam down the screen, destroying everything in its column, tentacles and
  mines included, cleanly), and **health** (a gear-stamped supply crate
  that restores one hit point, capped at `LIVES_MAX`). All three scroll
  and get picked up like a threat, but never damage the player.
- **Bullets are glowing circles, colored by who fired them** (revised
  again below — orange vs. red replaced the original single-color take).
- **5 lives, not 3**, to better match the added combat surface (dodging
  mine shrapnel and enemy fire on top of steering around terrain).
  `LIVES_MAX` lives in `physics.ts`; `kit.ts`'s hull ring imports it rather
  than hard-coding its own segment count, so the two can't drift.
- **A top-mounted beacon light.** Alongside the existing downward
  headlight, the sub now carries a second light on top of its conning
  tower — dark and unremarkable at the sunlit surface, ramping up (via the
  same 0–1 depth fraction the palette lerp uses) into a real `PointLight`
  by the time the water's gone dark, so the sub visibly starts lighting
  its own way as it enters the depths.

## Formations, brighter lighting, and a sustained ultimate

A further round on top of the above, on branch `feature/formations-brightness-tuning`:

- **Diagonal formations**, Galaga/Galaxian-style. `spawnFormation` pushes
  3–4 same-type threats (fish, enemy subs, or occasionally mines) at once,
  staggered by a fixed x/y step in a random diagonal direction and clamped
  so the whole chain stays on the board. Because every threat scrolls at
  the same shared speed regardless of type, the staggered members keep
  their relative offsets as they rise — a rigid diagonal translating
  upward — without any new per-entity state; it's the existing spawn/scroll
  code, just called several times at once with an offset. A `formationChance`
  roll (18–40%, rising with depth) picks formation vs. single-threat spawn
  each spawn tick; single mine/tentacle/monster spawns still happen the
  usual way.
- **Both submarine lights brightened substantially** — `subGlowIntensity`
  in the palette raised (1.4→2.2 at the surface, 2.4→5 in the deep), the
  beacon `PointLight`'s falloff distance and intensity curve both increased
  (now `0.6 + depth² × 9`, was `depth² × 3.5`), and the headlight gained an
  actual `PointLight` of its own (it was only ever a glowing mesh before,
  casting no real light) at `1 + depth² × 6`. The dark-water case — the one
  that mattered most — got the largest jump.
- **Bullets recolored and brightened, split by source.** Player missiles
  are orange (`playerBulletCore`/`Glow`), enemy sub fire and mine shrapnel
  are both red (`enemyBulletCore`/`Glow`) — whose bullets are whose is now
  readable at a glance, which matters more now that formations put several
  enemy subs on screen at once. Both use additive-blended glow halos around
  a saturated core rather than a flat semi-transparent sphere, reading as
  genuinely brighter rather than just differently colored.
- **Health pickups more common.** Power-up weights shifted from
  shotgun 45% / health 30% / laser 25% to shotgun 42% / health 40% /
  laser 18% — health more plentiful, laser rarer to balance its much
  larger effect (below).
- **The laser ultimate is now a sustained weapon, not an instant flash.**
  `LASER_HALF_WIDTH` doubled (25%→50% of board width) and `LASER_DURATION`
  went from 0.4s to 15s. Critically, `laserX` now tracks `subX` every frame
  for as long as `laserT > 0` (previously it locked to the sub's position
  at the moment of firing), so the player steers the beam across the board
  for the full 15 seconds rather than committing to one spot. The beam's
  opacity holds near-full strength with a slight sine pulse for the whole
  duration and only fades in the closing 0.3s, instead of dimming linearly
  across its (now much longer) lifetime. A `laserActiveT` countdown surfaces
  in the weapon badge ("Ultimate firing 14s…") and the Fire button reads
  "Firing…" while it's running.
