# Voxel City

A tiny blocky city that lives in your browser: voxel buildings with striped awnings and pixel-font shop signs, a yellow bus that runs its loop and picks up passengers, cars obeying traffic lights, and pedestrians who cross the zebra when it is safe and jog when it is not.

Built with TypeScript, Vite and Three.js. Everything is procedural — no external assets.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Build and test:

```bash
npm test           # unit tests (vitest)
npm run build      # typecheck + production bundle
npm run preview    # serve the production build
```

## Controls

- **Drag** — orbit
- **Scroll** — zoom
- **Right-drag** — pan
- `?cam=x,y,z,tx,ty,tz` — deep-link a camera position/target (handy for screenshots and docs)

## What is simulated

- **Roads**: 4×4 signalised intersections on a 3×3 block grid, lane markings, zebra crossings, stop lines.
- **Traffic**: 12 cars (sedans/vans) + 1 bus. Vehicles follow lane geometry with an IDM car-following model, stop for red/yellow signals, yield on left turns, and never enter an occupied intersection. Traffic lights show live red/yellow/green lamps.
- **Bus**: loops the central block, dwells at the bus shelter on the south sidewalk, and picks up waiting passengers.
- **People**: 20+ pedestrians wander sidewalk loops. They cross roads only when the crossing signal is red for traffic, enough green time remains, and no vehicle is near; they speed up if a car approaches mid-crossing. Waiters board the bus when it arrives.

## Project layout

```
src/core/     seeded RNG, geometry helpers, palette, voxel mesh builders, pixel font
src/city/     grid layout, roads/markings, procedural buildings, props, city assembler
src/traffic/  lane graph, signal controller, vehicle agent (IDM), vehicle models, system
src/people/   walk graph, person rig/animation, people system
src/main.ts   renderer, lights, camera, simulation loop
docs/         architecture notes
```

## Determinism

The whole world is generated from a single seed (`new Rng(20261007)` in `src/main.ts`). Change the seed for a different city; the same seed always produces the same city and the same initial traffic.

## License

MIT
