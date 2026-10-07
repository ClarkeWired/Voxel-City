import * as THREE from 'three';
import type { Axis, Pt } from '../core/geo';
import { samplePolyline } from '../core/geo';
import type { Rng } from '../core/rng';
import { palette } from '../core/palette';
import type { ShelterBuild } from '../city/props';
import type { SignalHead } from '../city/props';
import { VehicleAgent, type AgentStop, type AgentWorld } from './agent';
import {
  BUS_STOP_EDGE,
  busLoopEdgeIds,
  oppositeArm,
  type Arm,
  type LaneEdge,
  type LaneGraph,
} from './graph';
import { SignalController, type LightState } from './signals';
import { CAR_COLORS, VehicleView, type VehicleKind } from './views';

export type TrafficEvent = { type: 'bus-arrived' } | { type: 'bus-departed' };

const CAR_COUNT = 12;
const CAR_LENGTH = 4.4;

export class TrafficSystem implements AgentWorld {
  readonly agents: VehicleAgent[] = [];
  private readonly graph: LaneGraph;
  private readonly signals = new SignalController(2.5);
  private readonly rng: Rng;
  private readonly bodyMaterial: THREE.MeshLambertMaterial;
  private readonly wheelMaterial: THREE.MeshLambertMaterial;
  private readonly views = new Map<number, VehicleView>();
  private readonly edgeAgents = new Map<string, VehicleAgent[]>();
  private readonly occupancy = new Map<string, number>();
  private readonly positions = new Map<number, { x: number; z: number; yaw: number }>();
  private readonly events: TrafficEvent[] = [];
  private readonly busAgent: VehicleAgent;
  private readonly heads: SignalHead[];
  private readonly lampMesh: THREE.InstancedMesh;
  private lastLampKey = '';
  private busPrevDwell = 0;
  private nextId = 1;

  constructor(scene: THREE.Scene, graph: LaneGraph, rng: Rng, shelter: ShelterBuild, signalHeads: SignalHead[]) {
    this.graph = graph;
    this.rng = rng;
    this.bodyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.wheelMaterial = new THREE.MeshLambertMaterial({ color: palette.carTire });
    this.heads = signalHeads;
    this.lampMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial(), signalHeads.length * 3);
    const dummy = new THREE.Object3D();
    let lampIndex = 0;
    for (const head of signalHeads) {
      for (const dy of [0.5, 0, -0.5]) {
        dummy.position.set(head.x, head.y + dy, head.z);
        dummy.updateMatrix();
        this.lampMesh.setMatrixAt(lampIndex++, dummy.matrix);
      }
    }
    this.lampMesh.instanceMatrix.needsUpdate = true;
    this.lampMesh.frustumCulled = false;
    scene.add(this.lampMesh);
    this.updateLamps(true);

    const roadEdges = [...graph.edges.values()].filter((e) => e.kind === 'road');
    let spawned = 0;
    let attempts = 0;
    while (spawned < CAR_COUNT && attempts < 400) {
      attempts++;
      const edge = roadEdges[Math.floor(rng.next() * roadEdges.length)]!;
      const s = rng.range(4, Math.max(5, edge.length - 4));
      if (this.agents.some((a) => a.edgeId === edge.id && Math.abs(a.s - s) < 14)) continue;
      const kind: VehicleKind = rng.chance(0.3) ? 'van' : 'sedan';
      const agent = new VehicleAgent({
        id: this.nextId++,
        edgeId: edge.id,
        s,
        maxSpeed: rng.range(6.0, 7.4),
        length: CAR_LENGTH,
        rng: () => this.rng.next(),
      });
      this.addAgent(scene, agent, kind, CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)]!);
      spawned++;
    }

    const route = busLoopEdgeIds();
    const stopEdge = graph.edges.get(BUS_STOP_EDGE)!;
    const stopS = shelter.center.x - stopEdge.points[0]!.x;
    const stop: AgentStop = { edgeId: BUS_STOP_EDGE, s: stopS, dwell: 3.6, done: false };
    this.busAgent = new VehicleAgent({
      id: this.nextId++,
      edgeId: route[0]!,
      s: 1,
      maxSpeed: 5.4,
      length: 8.6,
      rng: () => this.rng.next(),
      route,
      routeIndex: 0,
      stops: [stop],
    });
    this.addAgent(scene, this.busAgent, 'bus', palette.busYellow);
  }

  private addAgent(scene: THREE.Scene, agent: VehicleAgent, kind: VehicleKind, color: number): void {
    this.agents.push(agent);
    const view = new VehicleView(kind, color, this.bodyMaterial, this.wheelMaterial);
    view.update(0, 0, 0, 0, 0);
    scene.add(view.group);
    this.views.set(agent.id, view);
  }

  update(dt: number): void {
    this.signals.update(dt);
    this.updateLamps();

    this.edgeAgents.clear();
    this.occupancy.clear();
    for (const agent of this.agents) {
      const edge = this.graph.edges.get(agent.edgeId)!;
      let list = this.edgeAgents.get(edge.id);
      if (!list) {
        list = [];
        this.edgeAgents.set(edge.id, list);
      }
      list.push(agent);
      if (edge.kind === 'turn' && edge.intersectionId !== undefined) {
        this.occupancy.set(edge.intersectionId, (this.occupancy.get(edge.intersectionId) ?? 0) + 1);
      }
    }

    for (const agent of this.agents) {
      agent.update(dt, this);
      const stop = agent.consumeStopEvent();
      if (stop && agent === this.busAgent) this.events.push({ type: 'bus-arrived' });
    }

    if (this.busPrevDwell > 0 && this.busAgent.dwelling <= 0) {
      this.events.push({ type: 'bus-departed' });
    }
    this.busPrevDwell = this.busAgent.dwelling;

    for (const agent of this.agents) {
      const edge = this.graph.edges.get(agent.edgeId)!;
      const pose = samplePolyline(edge.points, agent.s);
      const prev = this.positions.get(agent.id);
      const targetYaw = Math.atan2(-pose.dz, pose.dx);
      let yaw = targetYaw;
      if (prev) {
        let delta = targetYaw - prev.yaw;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        yaw = prev.yaw + delta * Math.min(1, dt * 9);
      }
      this.positions.set(agent.id, { x: pose.x, z: pose.z, yaw });
      const view = this.views.get(agent.id);
      if (view) view.update(pose.x, pose.z, yaw, agent.v, dt);
    }
  }

  consumeEvents(): TrafficEvent[] {
    if (this.events.length === 0) return [];
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  private updateLamps(force = false): void {
    const ns = this.signals.state('NS');
    const ew = this.signals.state('EW');
    const key = `${ns}:${ew}`;
    if (!force && key === this.lastLampKey) return;
    this.lastLampKey = key;
    const color = new THREE.Color();
    let index = 0;
    for (const head of this.heads) {
      const state = head.axis === 'NS' ? ns : ew;
      color.setHex(state === 'red' ? palette.lightRedOn : palette.lightRedOff);
      this.lampMesh.setColorAt(index++, color);
      color.setHex(state === 'yellow' ? palette.lightYellowOn : palette.lightYellowOff);
      this.lampMesh.setColorAt(index++, color);
      color.setHex(state === 'green' ? palette.lightGreenOn : palette.lightGreenOff);
      this.lampMesh.setColorAt(index++, color);
    }
    if (this.lampMesh.instanceColor) this.lampMesh.instanceColor.needsUpdate = true;
  }

  edge(id: string): LaneEdge {
    return this.graph.edges.get(id)!;
  }

  outEdges(nodeId: string): readonly LaneEdge[] {
    const node = this.graph.nodes.get(nodeId)!;
    return node.out.map((id) => this.graph.edges.get(id)!);
  }

  leaderInfo(agent: VehicleAgent): { gap: number; deltaV: number } {
    const edge = this.graph.edges.get(agent.edgeId)!;
    let gap = Infinity;
    let deltaV = 0;

    const list = this.edgeAgents.get(edge.id) ?? [];
    for (const other of list) {
      if (other === agent) continue;
      if (other.s <= agent.s) continue;
      const g = other.s - agent.s - (agent.length + other.length) / 2;
      if (g < gap) {
        gap = g;
        deltaV = agent.v - other.v;
      }
    }

    if (agent.next !== undefined) {
      const nextEdge = this.graph.edges.get(agent.next)!;
      const nextList = this.edgeAgents.get(nextEdge.id) ?? [];
      let nearest: VehicleAgent | null = null;
      for (const other of nextList) {
        if (nearest === null || other.s < nearest.s) nearest = other;
      }
      if (nearest && nearest.s < 6) {
        const g = edge.length - agent.s + nearest.s - (agent.length + nearest.length) / 2;
        if (g < gap) {
          gap = g;
          deltaV = agent.v - nearest.v;
        }
      }
    }

    return { gap, deltaV };
  }

  signal(axis: Axis): LightState {
    return this.signals.state(axis);
  }

  timeUntilGreen(axis: Axis): number {
    return this.signals.timeUntilGreen(axis);
  }

  canEnter(agent: VehicleAgent, next: LaneEdge): boolean {
    if (next.kind === 'road') return true;
    const intersectionId = next.intersectionId!;
    if ((this.occupancy.get(intersectionId) ?? 0) > 0) return false;

    if (next.needsYield) {
      const edge = this.graph.edges.get(agent.edgeId)!;
      const nodeId = edge.to;
      const parts = nodeId.split(':');
      const arm = parts[3] as Arm;
      const oppositeId = `in:${parts[1]}:${parts[2]}:${oppositeArm(arm)}`;
      const inEdges = this.graph.nodes.get(oppositeId)?.in ?? [];
      for (const edgeId of inEdges) {
        for (const other of this.edgeAgents.get(edgeId) ?? []) {
          const otherEdge = this.graph.edges.get(edgeId)!;
          const distance = otherEdge.length - other.s;
          if (distance < 18 && (other.v > 0.4 || other.id < agent.id)) return false;
        }
      }
    }
    return true;
  }

  nearestVehicleDistance(center: Pt): number {
    let best = Infinity;
    for (const pose of this.positions.values()) {
      const d = Math.hypot(pose.x - center.x, pose.z - center.z);
      if (d < best) best = d;
    }
    return best;
  }

  get vehicleCount(): number {
    return this.agents.length;
  }

  get busDwelling(): boolean {
    return this.busAgent.dwelling > 0;
  }

  signalTime(): number {
    return this.signals.time;
  }
}
