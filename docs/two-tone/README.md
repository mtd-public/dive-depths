# Two-tone art direction: concepts

A Downwell-inspired redraw of every sprite, the board and the HUD. Sprites store
palette *roles* rather than colors (bg/ink, fg, accent, accent2), so any of the
26 palettes recolors the whole game.

Regenerate these images with `npm run concepts:two-tone`. You can see the art live in two places:

- **In the game:** click the gear button in the topbar and set Art style to **Two-tone**, then pick a palette
  (or press `C` to cycle through them). You can also open a link with `?art=twotone&palette=kelp&zones=1`.
- **On the concepts page:** run `npm run dev` and open `/dive-depths/two-tone.html`.

| Title | Descent | Trench | Warden | Kracken | Game over |
|---|---|---|---|---|---|
| ![](shot-title.png) | ![](shot-descent.png) | ![](shot-trench.png) | ![](shot-warden.png) | ![](shot-kracken.png) | ![](shot-gameover.png) |

## Sprite sheet
![](sprite-sheet.png)

## Palettes
![](palettes.png)

## The same frame in every palette
![](board-all-palettes.png)
