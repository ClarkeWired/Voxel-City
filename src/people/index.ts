import type * as THREE from 'three';
import type { Axis, Pt } from '../core/geo';
import { clamp01, lerpAngle, lerpScalar, samplePolyline } from '../core/geo';
import type { Rng } from '../core/rng';
import type { ShelterBuild } from '../city/props';
import type { TrafficEvent, TrafficSystem } from '../traffic/index';
import type { SpatialBlocker } from '../world/obstacles';
import { CROSS_SPEED, JOG_SPEED, PED_SPEED, canStartCrossing, type WalkEdge, type WalkGraph } from './paths';
import { animateRig, createPersonRig, type PersonRig } from './person';

interface Ped {
  rig: PersonRig;
  id: number;
  role: 'walker' | 'waiter';
  state: 'walk' | 'cross' | 'wait' | 'idle' | 'board';
  edgeId: string;
  dir: 1 | -1;
  s: number;
  nodeId: string;
  timer: number;
  waitSpot: number;
  speed: number;
  phase: number;
  lateral: number;
  ox: number;
  oz: number;
  x: number;
  z: number;
  y: number;
  vy: number;
  yaw: number;
  px: number;
  pz: number;
  py: number;
  pyaw: number;
  boardFrom: Pt | null;
  dead: boolean;
  crossingIntersectionId: string | null;
  crossingAxis: Axis | null;
}

export interface PedState {
  id: number;
  edgeId: string;
  s: number;
  state: Ped['state'];
  x: number;
  z: number;
}

const SIDEWALK_Y = 1.04;
const ROAD_Y = 0.08;
const MAX_WALKERS = 32;

export class PeopleSystem {
  private readonly graph: WalkGraph;
  private readonly traffic: TrafficSystem;
  private readonly rng: Rng;
  private readonly scene: THREE.Scene;
  private readonly shelter: ShelterBuild;
  private readonly blockers: SpatialBlocker;
  private readonly peds: Ped[] = [];
  private nextPedId = 1;
  private walkerSpawnTimer = 4;
  private waiterSpawnTimer = -1;

  constructor(scene: THREE.Scene, graph: WalkGraph, traffic: TrafficSystem, rng: Rng, shelter: ShelterBuild, blockers: SpatialBlocker) {
    this.scene = scene;
    this.graph = graph;
    this.traffic = traffic;
    this.rng = rng;
    this.shelter = shelter;
    this.blockers = blockers;

    for (let i = 0; i < 20; i++) this.spawnWalker(true);
    for (let i = 0; i < shelter.waitSpots.length; i++) this.spawnWaiter(i);
  }

  get count(): number {
    return this.peds.filter((p) => !p.dead).length;
  }

  get waiterCount(): number {
    return this.peds.filter((p) => !p.dead && p.role === 'waiter').length;
  }

  private unblockedEdges(nodeId: string): WalkEdge[] {
    const node = this.graph.nodes.get(nodeId)!;
    return node.edges
      .map((id) => this.graph.edges.get(id)!)
      .filter((edge) => {
        const a = edge.points[0]!;
        const b = edge.points[edge.points.length - 1]!;
        return !this.blockers.intersects(a.x, a.z, b.x, b.z);
      });
  }

  private createPed(edge: WalkEdge, dir: 1 | -1, s: number): Ped {
    const ped: Ped = {
      rig: createPersonRig(this.rng),
      id: this.nextPedId++,
      role: 'walker',
      state: edge.crossing ? 'cross' : 'walk',
      edgeId: edge.id,
      dir,
      s,
      nodeId: '',
      timer: 0,
      waitSpot: -1,
      speed: PED_SPEED * this.rng.range(0.85, 1.15),
      phase: this.rng.range(0, Math.PI * 2),
      lateral: this.rng.range(-0.35, 0.35),
      ox: 0,
      oz: 0,
      x: 0,
      z: 0,
      y: SIDEWALK_Y,
      vy: SIDEWALK_Y,
      yaw: 0,
      px: 0,
      pz: 0,
      py: SIDEWALK_Y,
      pyaw: 0,
      boardFrom: null,
      dead: false,
      crossingIntersectionId: null,
      crossingAxis: null,
    };
    this.placeOnPath(ped, edge);
    ped.px = ped.x;
    ped.pz = ped.z;
    ped.py = ped.vy;
    ped.pyaw = ped.yaw;
    return ped;
  }

  private spawnWalker(initial = false): void {
    const nodes = [...this.graph.nodes.values()];
    const candidates: WalkEdge[] = [];
    for (const node of nodes) {
      candidates.push(...this.unblockedEdges(node.id));
    }
    const edge = candidates.length > 0
      ? candidates[Math.floor(this.rng.next() * candidates.length)]!
      : this.graph.edges.get(nodes[0]!.edges[0]!)!;
    const dir: 1 | -1 = this.rng.chance(0.5) ? 1 : -1;
    const s = initial ? this.rng.range(0, edge.length) : 0;
    const ped = this.createPed(edge, dir, s);
    this.peds.push(ped);
    this.scene.add(ped.rig.group);
  }

  spawnPedOnEdge(edgeId: string, s: number, dir: 1 | -1 = 1): void {
    const edge = this.graph.edges.get(edgeId);
    if (!edge) return;
    const ped = this.createPed(edge, dir, s);
    this.peds.push(ped);
    this.scene.add(ped.rig.group);
  }

  private spawnWaiter(waitSpot: number): void {
    const spot = this.shelter.waitSpots[waitSpot];
    if (!spot) return;
    const ped: Ped = {
      rig: createPersonRig(this.rng),
      id: this.nextPedId++,
      role: 'waiter',
      state: 'idle',
      edgeId: '',
      dir: 1,
      s: 0,
      nodeId: '',
      timer: this.rng.range(0, Math.PI * 2),
      waitSpot,
      speed: PED_SPEED,
      phase: this.rng.range(0, Math.PI * 2),
      lateral: this.rng.range(-0.2, 0.2),
      ox: 0,
      oz: 0,
      x: spot.x,
      z: spot.z,
      y: SIDEWALK_Y,
      vy: SIDEWALK_Y,
      yaw: Math.PI,
      px: spot.x,
      pz: spot.z,
      py: SIDEWALK_Y,
      pyaw: Math.PI,
      boardFrom: null,
      dead: false,
      crossingIntersectionId: null,
      crossingAxis: null,
    };
    this.peds.push(ped);
    this.scene.add(ped.rig.group);
  }

  private placeOnPath(ped: Ped, edge: WalkEdge): void {
    const p = this.sample(ped, edge);
    const dx = p.dx * ped.dir;
    const dz = p.dz * ped.dir;
    ped.ox = -dz * ped.lateral;
    ped.oz = dx * ped.lateral;
    ped.x = p.x + ped.ox;
    ped.z = p.z + ped.oz;
    ped.yaw = Math.atan2(dx, dz);
    ped.vy = ped.y;
  }

  private sample(ped: Ped, edge: WalkEdge): { x: number; z: number; dx: number; dz: number } {
    if (ped.dir === 1) return samplePolyline(edge.points, ped.s);
    return samplePolyline([...edge.points].reverse(), ped.s);
  }

  private removePed(ped: Ped): void {
    ped.dead = true;
    this.reportCrossing(ped, null);
    this.scene.remove(ped.rig.group);
  }

  handleEvent(event: TrafficEvent): void {
    if (event.type === 'bus-arrived') this.onBusArrived();
    if (event.type === 'bus-departed') this.waiterSpawnTimer = this.rng.range(2.5, 7);
  }

  update(dt: number): void {
    this.walkerSpawnTimer -= dt;
    if (this.walkerSpawnTimer <= 0) {
      this.walkerSpawnTimer = this.rng.range(6, 14);
      if (this.peds.filter((p) => !p.dead && p.role === 'walker').length < MAX_WALKERS) this.spawnWalker();
    }
    if (this.waiterSpawnTimer > 0) {
      this.waiterSpawnTimer -= dt;
      if (this.waiterSpawnTimer <= 0) {
        this.waiterSpawnTimer = -1;
        const free = this.freeWaitSpot();
        if (free >= 0) this.spawnWaiter(free);
      }
    }

    for (let i = this.peds.length - 1; i >= 0; i--) {
      const ped = this.peds[i]!;
      if (ped.dead) continue;
      this.updatePed(ped, dt);
      if (ped.dead) this.peds.splice(i, 1);
    }
  }

  private freeWaitSpot(): number {
    const taken = new Set(this.peds.filter((p) => !p.dead && p.role === 'waiter').map((p) => p.waitSpot));
    for (let i = 0; i < this.shelter.waitSpots.length; i++) {
      if (!taken.has(i)) return i;
    }
    return -1;
  }

  private onBusArrived(): void {
    let boarded = 0;
    for (const ped of this.peds) {
      if (ped.dead || ped.role !== 'waiter' || boarded >= 3) continue;
      if (ped.state === 'idle' || ped.state === 'wait') {
        ped.state = 'board';
        ped.boardFrom = { x: ped.x, z: ped.z };
        ped.s = 0;
      }
      boarded++;
    }
  }

  private reportCrossing(ped: Ped, edge: WalkEdge | null): void {
    const intersectionId = edge?.crossing ? edge.crossing.intersectionId : null;
    const axis = edge?.crossing ? edge.crossing.axis : null;
    if (intersectionId === ped.crossingIntersectionId && axis === ped.crossingAxis) return;
    if (ped.crossingIntersectionId !== null && ped.crossingAxis !== null) {
      this.traffic.setCrossingOccupied(ped.crossingAxis, ped.crossingIntersectionId, false);
    }
    if (intersectionId !== null && axis !== null) {
      this.traffic.setCrossingOccupied(axis, intersectionId, true);
    }
    ped.crossingIntersectionId = intersectionId;
    ped.crossingAxis = axis;
  }

  private pickNext(ped: Ped, nodeId: string, cameFrom: string): void {
    const node = this.graph.nodes.get(nodeId)!;
    const options = node.edges.filter((id) => id !== cameFrom);
    const list = options.length > 0 ? options : node.edges;

    const crossings = list
      .map((id) => this.graph.edges.get(id)!)
      .filter((edge) => edge.crossing !== undefined);
    for (const edge of crossings) {
      const crossing = edge.crossing!;
      const state = this.traffic.signal(crossing.axis, crossing.intersectionId);
      const remaining = this.traffic.timeUntilGreen(crossing.axis, crossing.intersectionId);
      const distance = this.traffic.nearestVehicleDistance(crossing.center);
      if (canStartCrossing(crossing, state, remaining, distance)) {
        ped.state = 'cross';
        ped.edgeId = edge.id;
        ped.dir = edge.a === nodeId ? 1 : -1;
        ped.s = 0;
        this.reportCrossing(ped, edge);
        return;
      }
    }

    const plain = list
      .map((id) => this.graph.edges.get(id)!)
      .filter((edge) => edge.crossing === undefined)
      .filter((edge) => {
        const a = edge.points[0]!;
        const b = edge.points[edge.points.length - 1]!;
        return !this.blockers.intersects(a.x, a.z, b.x, b.z);
      });
    if (crossings.length > 0 && this.rng.chance(0.4)) {
      ped.state = 'wait';
      ped.nodeId = nodeId;
      ped.timer = this.rng.range(1.5, 3.5);
      ped.phase = this.rng.range(0, Math.PI * 2);
      this.reportCrossing(ped, null);
      return;
    }
    const pool = plain.length > 0 ? plain : list.map((id) => this.graph.edges.get(id)!).filter((edge) => {
      const a = edge.points[0]!;
      const b = edge.points[edge.points.length - 1]!;
      return !this.blockers.intersects(a.x, a.z, b.x, b.z);
    });
    if (pool.length === 0) {
      const currentEdge = this.graph.edges.get(ped.edgeId);
      if (currentEdge) {
        ped.dir = ped.dir === 1 ? -1 : 1;
        ped.s = currentEdge.length;
      } else {
        ped.state = 'idle';
      }
      return;
    }
    const edge = pool[Math.floor(this.rng.next() * pool.length)]!;
    ped.state = 'walk';
    ped.edgeId = edge.id;
    ped.dir = edge.a === nodeId ? 1 : -1;
    ped.s = 0;
    this.reportCrossing(ped, edge);
  }

  private updatePed(ped: Ped, dt: number): void {
    ped.px = ped.x;
    ped.pz = ped.z;
    ped.py = ped.vy;
    ped.pyaw = ped.yaw;
    const pose = { x: ped.x, z: ped.z, dx: 0, dz: 1 };
    let moving = false;
    let yTarget = SIDEWALK_Y;

    switch (ped.state) {
      case 'walk':
      case 'cross': {
        const edge = this.graph.edges.get(ped.edgeId);
        if (!edge) {
          ped.state = 'idle';
          break;
        }
        let speed = ped.speed;
        if (ped.state === 'cross') {
          speed = CROSS_SPEED;
          yTarget = ROAD_Y;
          if (edge.crossing) {
            const distance = this.traffic.nearestVehicleDistance(edge.crossing.center);
            if (distance < 6.5) speed = JOG_SPEED;
          }
        }
        ped.s += speed * dt;
        ped.phase += speed * dt * 3.4;
        moving = true;
        const p = this.sample(ped, edge);
        pose.x = p.x;
        pose.z = p.z;
        pose.dx = p.dx * ped.dir;
        pose.dz = p.dz * ped.dir;
        if (ped.s >= edge.length) {
          const overshoot = ped.s - edge.length;
          const nodeId = ped.dir === 1 ? edge.b : edge.a;
          this.pickNext(ped, nodeId, edge.id);
          if (ped.state === 'walk' || ped.state === 'cross') {
            const next = this.graph.edges.get(ped.edgeId);
            ped.s = next ? Math.min(overshoot, next.length) : 0;
            this.reportCrossing(ped, next ?? null);
          }
        }
        break;
      }
      case 'wait': {
        const node = this.graph.nodes.get(ped.nodeId);
        if (node) {
          pose.x = node.pos.x;
          pose.z = node.pos.z;
        }
        ped.timer -= dt;
        ped.phase += dt;
        if (ped.timer <= 0) {
          this.pickNext(ped, ped.nodeId, '');
        }
        break;
      }
      case 'idle': {
        ped.timer += dt;
        ped.phase += dt;
        break;
      }
      case 'board': {
        const from = ped.boardFrom!;
        const to = this.shelter.doorPoint;
        const total = Math.hypot(to.x - from.x, to.z - from.z);
        ped.s += 2.4 * dt;
        ped.phase += 2.4 * dt * 4;
        moving = true;
        const t = Math.min(1, total > 0 ? ped.s / total : 1);
        pose.x = from.x + (to.x - from.x) * t;
        pose.z = from.z + (to.z - from.z) * t;
        pose.dx = (to.x - from.x) / (total || 1);
        pose.dz = (to.z - from.z) / (total || 1);
        yTarget = ROAD_Y;
        if (t >= 1) {
          this.removePed(ped);
          return;
        }
        break;
      }
    }

    if (ped.state !== 'idle') {
      const targetYaw = Math.atan2(pose.dx, pose.dz);
      let delta = targetYaw - ped.yaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      ped.yaw += delta * Math.min(1, dt * 8);
    }

    if (ped.state !== 'idle') {
      const ease = Math.min(1, dt * 8);
      ped.ox += (-pose.dz * ped.lateral - ped.ox) * ease;
      ped.oz += (pose.dx * ped.lateral - ped.oz) * ease;
      ped.x = pose.x + ped.ox;
      ped.z = pose.z + ped.oz;
    }
    ped.y += (yTarget - ped.y) * Math.min(1, dt * 8);

    const bob = animateRig(ped.rig, ped.phase, moving);
    ped.vy = ped.y + bob;
    ped.rig.group.position.set(ped.x, ped.vy, ped.z);
    ped.rig.group.rotation.y = ped.yaw;
  }

  pedStates(): PedState[] {
    const out: PedState[] = [];
    for (const ped of this.peds) {
      if (ped.dead) continue;
      out.push({ id: ped.id, edgeId: ped.edgeId, s: ped.s, state: ped.state, x: ped.x, z: ped.z });
    }
    return out;
  }

  render(alpha: number): void {
    const t = clamp01(alpha);
    for (const ped of this.peds) {
      if (ped.dead) continue;
      ped.rig.group.position.set(
        lerpScalar(ped.px, ped.x, t),
        lerpScalar(ped.py, ped.vy, t),
        lerpScalar(ped.pz, ped.z, t),
      );
      ped.rig.group.rotation.y = lerpAngle(ped.pyaw, ped.yaw, t);
    }
  }
}
