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
- **0 / 1 / 2 / 3** — pause, 1x, 4x, 16x simulation time (16x ≈ one day per 90 s)
- `?cam=x,y,z,tx,ty,tz` — deep-link a camera position/target (handy for screenshots and docs)

## Living world

- A **simulation clock** drives a day/night cycle; sun, sky and fog follow it, and at dusk the city lights up — a share of windows and storefronts glow and street lamps come on. The world autosaves to `localStorage` (and on unload) and restores the clock, closures, incidents, weather, congestion and citizens on the next visit, so the city continues where it left off.
- Cars drive real **origin→destination routes** planned over the lane graph. Closing a road (press **C**) raises barriers, invalidates affected routes and cars reroute from where they are; **X** reopens everything. Closures live in world state with start/end times and are saved with the city.
- **60 citizens** have homes, workplaces and routines: they commute out around 08:00, return (some via a shop) around 17:00 and drive home. Rush hours emerge from those schedules — there is no random traffic spawner. The HUD shows how many commuters are on the road.
- **Weather** rolls through clear, rain, storm and fog windows. Rain and fog reduce driving speeds, stretch following distances and cut braking performance, so journeys genuinely take longer; fog shortens visibility, storms darken the sky and slant rain across the view. `?weather=storm` (etc.) forces a state for demos.
- **Incidents** (press **I**): a collision blocks its road segment, queues and reroutes traffic, and an ambulance is dispatched; once the scene clears, capacity returns and the queues dissipate. `X` clears closures and incidents. `?incident=1` stages one on the showcase street.
- **Congestion feeds back**: slow and stopped queues accumulate pressure on each road segment, which raises its routing cost — cars probe alternative routes when a street is badly congested — and the city-wide noise index in the HUD grows with it. Pressure decays once traffic clears, and it is saved with the world.

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
