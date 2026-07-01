# Three.js — My First Hero 🦸

A tiny learning project: a 3D "hero" character built from basic shapes, lit,
animated, and orbit-controllable. No build step, no `npm install` — it loads
Three.js straight from a CDN via an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap).

## Run it

Because it uses ES modules, you need to serve the folder over HTTP (opening
`index.html` with `file://` won't work). Any static server works:

```bash
# Python (built into macOS)
python3 -m http.server 8000

# or Node
npx serve
```

Then open http://localhost:8000

## What's inside

- **index.html** — page shell, styles, and the import map for `three`.
- **main.js** — the scene, heavily commented so you can learn as you read.

## The mental model

Every Three.js app needs three things:

1. **Scene** — the world that holds objects, lights, cameras.
2. **Camera** — the point of view you render from.
3. **Renderer** — draws the scene onto a `<canvas>`, ~60 times a second.

A visible object (a **Mesh**) = a **Geometry** (its shape) + a **Material**
(how its surface reacts to light). We group several meshes into one `Group`
so the whole hero moves and spins as a unit.

## Things to try

- Change `suit`/`skin`/`accent` colors in `main.js`.
- Swap a `CapsuleGeometry` for a `BoxGeometry` or `ConeGeometry`.
- Tweak the animation math in `animate()` (the bob, spin, halo speed).
- Move the lights around and watch the shadows change.
