# Architecture

## Coordinate system & scale

- Y is up. 1 unit = 1 voxel = 1 meter. `+X` = east, `+Z` = south (toward the default camera), `-Z` = north.
- Grid (`src/city/grid.ts`): block = 30, road = 10, pitch = 40, 3×3 blocks, 4×4 intersections.
  - `CITY_HALF = 65`, roads at `-60, -20, 20, 60`, blocks centered at `-40, 0, 40`.
  - Roads are at y=0, block platforms are raised 1 unit (y 0..1). All walkable props sit at y≈1.
- Lane geometry: right-hand traffic, lane offset ±2.5 from road center.
- Stop lines at 9.15 from the intersection center; lane graph nodes at 13.5 so a stopped 8.6-long bus front bumper lands on the stop line and never blocks the zebra (zebra spans 5..8).

## Rendering (`src/core/voxel.ts`)

- All boxes are axis-aligned. Two strategies:
  - **Static city**: one `VoxelBuilder` → single `THREE.InstancedMesh` with per-instance color (1 draw call for the whole city).
  - **Dynamic models** (vehicles, people): `buildMergedGeometry()` merges voxel boxes into one `BufferGeometry` with vertex colors.
- Wheels are low-poly cylinders merged per side (2 meshes per vehicle, correct spin pivot).
- Materials are shared `MeshLambertMaterial`s; lighting is one hemisphere + one shadow-casting directional light. `NoToneMapping` keeps the palette flat and vivid like the reference art.

## Roads & city (`src/city/`)

- `roads.ts`: base slabs, block platforms with curb caps, asphalt wear, manholes, dashed center lines, zebra stripes, stop lines.
- `buildings.ts`: per block and side, 2 lots per side; central block south side hosts the showcase CAFE (orange) and FLOWERS (mint) shops. The north side of block `(1,2)` — the block between the default camera and the showcase street — is kept open as a plaza so the street, shelter and shops stay visible. Buildings have windows with frames/sills/flower boxes, striped awnings with valance, sign bands with pixel-font text, storefronts, doors, roof slabs, chimneys, AC units. Corner buildings may interpenetrate like terraced real buildings; only outward facades carry detail.
- `props.ts`: bus shelter, traffic light poles (housings static; lamps are instanced and recolored by the signal controller), street lamps, trees, benches, bins, hydrants, planters.
- `index.ts`: assembles everything, returns the shelter info and signal-head list for the traffic system.

## World state & time (`src/world/`)

- `clock.ts`: `SimulationClock` (minutes in the day, day counter, speed multiplier; speeds 0/1/4/16x, 1x = 1 simulated minute per real second). Pure helpers `daylightFactor`, `horizonWarmth` and `sunArc` define the sun curve (sunrise 06:00, sunset 20:00) and are unit-tested independently of rendering.
- `state.ts`: versioned `WorldState` (clock + RNG snapshot) with validated JSON `serializeWorld`/`deserializeWorld`. The app autosaves to `localStorage` every 10 s and on unload; corrupt or outdated saves are discarded and a fresh 08:00 world starts. Full entity persistence will extend this schema.
- Rendering observes the clock: sun position/intensity/colour, sky, fog and hemisphere light all follow the daylight curve. `?minutes=MMM` overrides the start time (demo/screenshot helper).
- `Rng.snapshot()/restore()` make the seeded stream resumable for future full-world saves.

## Traffic (`src/traffic/`)

- `graph.ts`: builds the directed lane graph:
  - 8 nodes per intersection (`in:*` / `out:*` for each arm `N,S,E,W`).
  - `road` edges connect contiguous intersections along each lane.
  - `turn` edges are quadratic Bézier quarter-turns (no U-turns); each has a `maneuver` (straight/left/right) and left turns are `needsYield`.
  - Boundary arms that would lead out of the city are excluded, so every node always has a continuation.
  - `busLoopEdgeIds()` = closed loop around the central block; `BUS_STOP_EDGE` is the eastbound segment in front of the shelter.
- `routing.ts`: Dijkstra over lane edges. `findRoute(graph, fromEdgeId, destNodeId, closed)` returns a contiguous edge path with turn penalties and closed-edge avoidance; `nearestNodeId` resolves destination anchors (block centroids); `routeContainsClosed` checks remaining paths.
- `closures.ts` (in `src/world/`): `RoadClosure` with absolute world-minute windows (`worldMinutes(day, minutes)`), active-window helpers, and `createClosure`.
- `barriers.ts`: renders red/white barrier rows across both ends of every actively closed edge (one InstancedMesh, rebuilt only when the active set changes).
- `signals.ts`: pure global cycle, 11 s per axis (8 green, 2 yellow, 1 all-red), period 22 s. `signalState(axis, t)` and `timeUntilGreen(axis, t)` are pure functions; `SignalController` wraps them with an offset.
- `agent.ts`: IDM (Intelligent Driver Model) longitudinal control with virtual leaders for stop lines. State machine: approach → stop/yield check → commit turn → next edge. `AgentWorld` is an interface so tests can stub the world. Buses carry `stops`; passing a stop sets dwell, emits an event, and resets the stop when re-entering its edge next lap.
- `index.ts` (`TrafficSystem`): owns agents/views, builds per-edge occupancy lists each frame, implements `AgentWorld`:
  - Cars spawn with a real origin→destination route to a block-centroid anchor; buses follow their fixed loop (`routeLoop: true`). Non-looping routes end in `arrived`, after which the vehicle is held briefly and retired; a replacement spawns after a short delay.
  - Every frame, any car whose remaining route intersects an active closure is rerouted from its current edge; `canEnter` refuses closed edges as the safety net (vehicles wait rather than enter).
  - `leaderInfo`: nearest same-edge leader plus first vehicle on the next edge (queue spillback protection).
  - `canEnter`: blocks entering an occupied intersection; left turns also yield to oncoming traffic (with an id tie-break so two opposing left-turners cannot deadlock).
  - emits `bus-arrived` / `bus-departed` / `vehicle-arrived` events.
- `views.ts`: vehicle voxel models (bus, sedan, van) + wheel rigs; body geometries are cached per kind/color.
- Spawning is deterministic from the shared `Rng`; a 14-unit spacing check prevents overlaps.

## People (`src/people/`)

- `paths.ts`: pedestrian graph. Each block has 16 perimeter nodes (4 corners + 3 per side) connected by ring edges. Crossings are edges `x:i:j:ARM` that connect the corner nodes of the two blocks on either side of a road arm; they carry `{axis, center, duration}`. Crossings only exist where both endpoint blocks exist (no out-of-city crossings).
  - `canStartCrossing()`: allowed only when the crossed road's signal is `red`, at least `duration + 2.5 s` of red remains, and no vehicle is within 9 units of the crossing centre.
- `person.ts`: voxel person rig (merged body + two swingable legs), cached geometry per color combo, walk cycle + bob.
- `index.ts` (`PeopleSystem`): random walk on the pedestrian graph with crossing decisions; pedestrians wait at corners when crossing is not safe (40 % of the time), jog if a vehicle gets within 6.5 units mid-crossing, ride the block platform at y≈1.04 and step down to the road on crossings. Waiters idle at the shelter spots, board (walk to the door point) when `bus-arrived` fires, and are removed; new waiters/random walkers spawn on timers with caps.

## Main loop (`src/main.ts`)

- `TrafficSystem.update(dt)` → `PeopleSystem.update(dt)` → `OrbitControls.update()` → render.
- dt clamped to 50 ms. HUD updates twice a second with counts and FPS.

## Testing

Pure modules are covered by vitest:

- `grid.test.ts` — layout invariants (pitch, block/road adjacency, bus fit).
- `graph.test.ts` — id consistency, no dead ends, strong connectivity, maneuver classification, Bézier endpoints, bus loop chaining.
- `signals.test.ts` — cycle states, mutual exclusion, all-red windows, periodicity.
- `agent.test.ts` — stops at red, crosses on green, yields on yellow when able, car-following gap, queue spacing, bus dwell.
- `routing.test.ts` — contiguous routes, trivial same-node routes, closure avoidance with a different path, unreachable destinations, remaining-path scanning.
- `closures.test.ts` — closure windows, day-spanning closures, active-edge collection.
- `system.test.ts` — TrafficSystem integration: bus spawns on its loop, parks at the shelter stop, departs; every car has an origin→destination route; cars retire on arrival; closures trigger rerouting; all views get positioned; signal lamps reflect the phase.
- `paths.test.ts` — walk graph connectivity, crossing geometry, crossing safety predicate.
- `rng.test.ts` / `voxel.test.ts` / `font.test.ts` — determinism, mesh sizes, mirrored text.
- `clock.test.ts` / `state.test.ts` — time advancement/rollover/speeds, daylight curve, save/load round-trip and rejection of corrupt payloads.

## Known trade-offs / next ideas

- One global signal phase (green wave) instead of per-intersection offsets.
- No collision volume between individual pedestrians (lateral jitter only).
- Vehicles do not change lanes and there is no pedestrian collision with turning vehicles beyond the proximity checks.
- Possible next steps: town day/night cycle, second bus + route branches, parked cars, audio, minimap, WebGPU/instanced people.
