# AGENTS.md — Voxel City

Instructions for AI agents (and humans) working in this repository.

## Golden rules

1. **Always build, test, commit, and push.** After any change:
   - `npm test` (vitest) must pass
   - `npm run build` (tsc + vite) must pass
   - commit with a concise message and `git push`
2. **Git identity**: user `encise@gmail.com` (name: `ClarkeWired`). Already configured globally; do not change it.
3. **Never commit `node_modules`, `dist`, or local logs** (see `.gitignore`).
4. **Keep the simulation deterministic**: all randomness must come from `src/core/rng.ts` seeded instances. Do not use `Math.random()`.
5. **Pure logic stays three-free**: `src/traffic/graph.ts`, `src/traffic/signals.ts`, `src/traffic/agent.ts`, `src/people/paths.ts`, `src/city/grid.ts` must not import `three` so they remain unit-testable in node.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm test` | Vitest unit tests (grid, graph, signals, agent, paths, font, voxel, rng) |
| `npm run build` | Typecheck (`tsc`) + production bundle (`vite build`) |
| `npm run typecheck` | Typecheck only |

## Repository map

```
src/core/       rng, 2D geometry helpers, palette, voxel builder (instanced + merged), pixel font
src/world/      simulation clock + day/night, serialisable world state / persistence, closures, citizen schedules/demand
src/city/       layout constants (grid.ts), roads + markings, buildings + signs, props, assembler
src/traffic/    lane graph, routing (Dijkstra), signal cycle, IDM vehicle agent, closures/barriers, TrafficSystem
src/people/     pedestrian walk graph, person rig, PeopleSystem (crossing + bus stop boarding)
src/main.ts     scene, lights, camera, render loop, HUD
```

See `docs/ARCHITECTURE.md` for the full design.

## Conventions

- TypeScript strict; `verbatimModuleSyntax` (use `import type` for types), `erasableSyntaxOnly` (no enums/namespaces/parameter properties), `noUnusedLocals`.
- No code comments unless they explain non-obvious invariants.
- Edge/node id formats are load-bearing; keep them stable (`r:NS:i:j:j+1:S`, `t:i:j:ARM:ARM`, `in:/out:...`, `b{bx}:{bz}:corner`, `x:i:j:ARM`).
- 1 world unit = 1 voxel = 1 meter. Block = 30, road = 10, pitch = 40, city half = 65.
- Visual time step is clamped to 50 ms; keep per-frame work O(n) in agents.

## Definition of done for a feature

- Tests added/updated for any pure logic change.
- `npm test` and `npm run build` green.
- Committed and pushed to `origin` (GitHub: `ClarkeWired/Voxel-City`).

## CI note

GitHub Actions CI is intentionally absent: the current `gh` OAuth token lacks the `workflow` scope, so pushes containing `.github/workflows/*` are rejected. To enable CI: `gh auth refresh -s workflow`, add a workflow that runs `npm ci && npm test && npm run build`, commit it, and push.
