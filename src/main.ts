import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Rng } from './core/rng';
import { palette } from './core/palette';
import { buildCity } from './city/index';
import { blockCenter } from './city/grid';
import { RainVisuals } from './city/rain';
import { FIXED_STEP, FixedStepAccumulator, MAX_FRAME_SECONDS } from './core/loop';
import { buildLaneGraph, busLoopEdgeIds } from './traffic/graph';
import { TrafficSystem } from './traffic/index';
import { BarrierVisuals } from './traffic/barriers';
import { IncidentVisuals } from './traffic/incidentVisuals';
import { buildWalkGraph } from './people/paths';
import { PeopleSystem } from './people/index';
import {
  SPEEDS,
  SimulationClock,
  daylightFactor,
  horizonWarmth,
  sunArc,
} from './world/clock';
import { activeClosureEdges, createClosure } from './world/closures';
import { CitizenSystem } from './world/citizens';
import { IncidentSystem } from './world/incidents';
import { WeatherSystem, conditionsFor, isWeatherKind } from './world/weather';
import { createWorldState, deserializeWorld, resumeRngFromSave, serializeWorld, type WorldState } from './world/state';

const SAVE_KEY = 'voxel-city:save';
const AUTOSAVE_SECONDS = 10;

const app = document.querySelector<HTMLDivElement>('#app')!;
const stats = document.querySelector<HTMLParagraphElement>('#stats')!;

function loadWorld(): WorldState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? deserializeWorld(raw) : null;
  } catch {
    return null;
  }
}

const savedWorld = loadWorld();
const world = savedWorld ?? createWorldState();
const params = new URLSearchParams(window.location.search);
const timeParam = params.get('minutes');
const startMinutes = timeParam !== null && Number.isFinite(Number(timeParam)) ? Number(timeParam) : null;
let simClock =
  startMinutes !== null
    ? new SimulationClock({ minutes: ((startMinutes % 1440) + 1440) % 1440, day: 1, speed: 1 })
    : new SimulationClock(world.clock);

const scene = new THREE.Scene();
const skyColor = new THREE.Color(palette.sky);
scene.background = skyColor;
const sceneFog = new THREE.Fog(palette.fog, 150, 340);
scene.fog = sceneFog;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 700);
camera.position.set(56, 76, 98);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
app.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(palette.sky, 0x7d8272, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3d6, 2);
sun.position.set(70, 110, 45);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110;
sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 320;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

const NIGHT_SKY = new THREE.Color(0x16202f);
const DUSK_SKY = new THREE.Color(0xf7b56b);
const DAY_SKY = new THREE.Color(palette.sky);
const STORM_SKY = new THREE.Color(0x7d8794);
const SUN_LOW = new THREE.Color(0xff9a4d);
const SUN_HIGH = new THREE.Color(0xfff3d6);
const skyScratch = new THREE.Color();

function applyEnvironment(weatherDim: number): void {
  const minutes = simClock.minutes;
  const daylight = daylightFactor(minutes);
  const warmth = horizonWarmth(minutes);
  const arc = sunArc(minutes);

  sun.position.set(arc.x, Math.max(arc.y, 10), arc.z);
  sun.intensity = (0.05 + 2.05 * daylight) * (1 - 0.5 * weatherDim);
  sun.color.copy(SUN_LOW).lerp(SUN_HIGH, Math.min(1, Math.max(0, arc.y / 90)));

  skyScratch.copy(NIGHT_SKY).lerp(DAY_SKY, daylight);
  skyScratch.lerp(DUSK_SKY, 0.5 * warmth * (1 - Math.abs(2 * daylight - 1)));
  skyScratch.lerp(STORM_SKY, weatherDim * daylight);
  skyColor.copy(skyScratch);
  sceneFog.color.copy(skyScratch);

  hemi.intensity = (0.14 + 0.76 * daylight) * (1 - 0.4 * weatherDim);
  hemi.color.copy(skyScratch);

  if (city.nightMesh) city.nightMesh.visible = daylight < 0.35;
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, 18);
controls.minDistance = 12;
controls.maxDistance = 260;
controls.maxPolarAngle = 1.45;
controls.enableDamping = true;
controls.dampingFactor = 0.08;

const camParam = new URLSearchParams(window.location.search).get('cam');
if (camParam) {
  const nums = camParam.split(',').map(Number);
  if (nums.length === 6 && nums.every((n) => Number.isFinite(n))) {
    camera.position.set(nums[0]!, nums[1]!, nums[2]!);
    controls.target.set(nums[3]!, nums[4]!, nums[5]!);
  }
}
controls.update();

const rng = new Rng(20261007);

const city = buildCity(scene, rng);
const graph = buildLaneGraph();
const closureEdgeSet = new Set<string>();
const citizens =
  world.citizens.length > 0
    ? CitizenSystem.fromJSON(world.citizens, rng)
    : new CitizenSystem(60, rng, simClock.worldMinutes);
const weatherParam = params.get('weather');
const weather = isWeatherKind(weatherParam)
  ? new WeatherSystem(rng, { kind: weatherParam, intensity: 0.85, until: simClock.worldMinutes + 180 }, simClock.worldMinutes)
  : world.weather
    ? WeatherSystem.fromJSON(world.weather, rng, simClock.worldMinutes)
    : new WeatherSystem(rng, undefined, simClock.worldMinutes);
const traffic = new TrafficSystem(scene, graph, rng, city.shelter, city.signalHeads, {
  closedEdges: () => closureEdgeSet,
  initialCars: 0,
  conditions: () => conditionsFor(weather.current),
  congestion: world.congestion,
  signalOffsets: (intersectionId) => {
    const ix = Number.parseInt(intersectionId.split(':')[0] ?? '0', 10);
    return Number.isFinite(ix) ? ix * 5 : 0;
  },
});
const walkGraph = buildWalkGraph();
const people = new PeopleSystem(scene, walkGraph, traffic, rng, city.shelter, city.blockers);
const barriers = new BarrierVisuals();
const incidentVisuals = new IncidentVisuals();
const rain = new RainVisuals(scene, new Rng(777));
const incidents = IncidentSystem.fromJSON(world.incidents, rng);
const busRouteEdges = new Set(busLoopEdgeIds());
let closureCounter = 0;

resumeRngFromSave(rng, savedWorld);
citizens.resumeInterruptedTrips(simClock.worldMinutes, (agentId) =>
  traffic.agents.some((agent) => agent.id === agentId),
);

function closedCandidates(): { edge: import('./traffic/graph').LaneEdge }[] {
  const at = simClock.worldMinutes;
  const active = activeClosureEdges(world.closures, at);
  const blocked = incidents.blockingEdges();
  return [...graph.edges.values()]
    .filter(
      (edge) =>
        edge.kind === 'road' &&
        !busRouteEdges.has(edge.id) &&
        !active.has(edge.id) &&
        !blocked.has(edge.id),
    )
    .map((edge) => ({ edge }));
}

function triggerRandomIncident(preferNear?: { x: number; z: number }, fastResponse = false): void {
  const candidates = closedCandidates();
  if (candidates.length === 0) return;
  let edge = candidates[Math.floor(rng.next() * candidates.length)]!.edge;
  if (preferNear) {
    let best = Infinity;
    for (const candidate of candidates) {
      const points = candidate.edge.points;
      const last = points[points.length - 1]!;
      const midX = (points[0]!.x + last.x) / 2;
      const midZ = (points[0]!.z + last.z) / 2;
      const d = (midX - preferNear.x) ** 2 + (midZ - preferNear.z) ** 2;
      if (d < best) {
        best = d;
        edge = candidate.edge;
      }
    }
  }
  incidents.trigger(
    edge.id,
    simClock.worldMinutes,
    fastResponse ? 0.02 : undefined,
    fastResponse ? 45 : undefined,
  );
}

function respondToIncident(edgeId: string): void {
  const edge = graph.edges.get(edgeId);
  if (!edge) return;
  const last = edge.points[edge.points.length - 1]!;
  const midX = (edge.points[0]!.x + last.x) / 2;
  const midZ = (edge.points[0]!.z + last.z) / 2;
  let bestBlock = 0;
  let bestDistance = -1;
  for (let b = 0; b < 9; b++) {
    const bx = blockCenter(Math.floor(b / 3));
    const bz = blockCenter(b % 3);
    const d = (bx - midX) ** 2 + (bz - midZ) ** 2;
    if (d > bestDistance) {
      bestDistance = d;
      bestBlock = b;
    }
  }
  traffic.spawnEmergency(bestBlock, edge.from);
}

function toggleRandomClosure(preferNear?: { x: number; z: number }): void {
  const candidates = closedCandidates();
  if (candidates.length === 0) return;
  let edge = candidates[Math.floor(rng.next() * candidates.length)]!.edge;
  if (preferNear) {
    let best = Infinity;
    for (const candidate of candidates) {
      const points = candidate.edge.points;
      const last = points[points.length - 1]!;
      const midX = (points[0]!.x + last.x) / 2;
      const midZ = (points[0]!.z + last.z) / 2;
      const d = (midX - preferNear.x) ** 2 + (midZ - preferNear.z) ** 2;
      if (d < best) {
        best = d;
        edge = candidate.edge;
      }
    }
  }
  closureCounter++;
  world.closures.push(createClosure(`closure-${closureCounter}`, edge.id, 'roadworks', simClock.worldMinutes, 10));
}

window.addEventListener('keydown', (event) => {
  if (event.key === '+' || event.key === '=') {
    const next = SPEEDS.find((s) => s > simClock.speed);
    simClock.setSpeed(next ?? SPEEDS[SPEEDS.length - 1]!);
  } else if (event.key === '-' || event.key === '_') {
    const lower = [...SPEEDS].reverse().find((s) => s < simClock.speed);
    simClock.setSpeed(lower ?? SPEEDS[0]!);
  } else if (event.key === '0') {
    simClock.setSpeed(0);
  } else if (event.key === '1') {
    simClock.setSpeed(1);
  } else if (event.key === '2') {
    simClock.setSpeed(4);
  } else if (event.key === '3') {
    simClock.setSpeed(16);
  } else if (event.key === 'c' || event.key === 'C') {
    toggleRandomClosure();
  } else if (event.key === 'x' || event.key === 'X') {
    world.closures.length = 0;
    for (const incident of incidents.list) incident.clearAt = simClock.worldMinutes;
  } else if (event.key === 'i' || event.key === 'I') {
    triggerRandomIncident();
  }
});

function saveWorld(): void {
  try {
    world.clock = simClock.toJSON();
    world.rngState = rng.snapshot();
    world.citizens = citizens.toJSON();
    world.weather = weather.toJSON();
    world.incidents = incidents.toJSON();
    world.congestion = traffic.congestionSnapshot();
    window.localStorage.setItem(SAVE_KEY, serializeWorld(world));
  } catch {
    // storage may be unavailable or full; the simulation keeps running
  }
}

let lastStatsUpdate = 0;
let sinceAutosave = 0;
const realClock = new THREE.Clock();
const stepper = new FixedStepAccumulator();

function simulate(dt: number): void {
  simClock.step(dt);
  sinceAutosave += dt;
  if (sinceAutosave >= AUTOSAVE_SECONDS) {
    sinceAutosave = 0;
    saveWorld();
  }

  const at = simClock.worldMinutes;
  closureEdgeSet.clear();
  for (const closure of world.closures) {
    if (at >= closure.startMinutes && at < closure.endMinutes) closureEdgeSet.add(closure.edgeId);
  }
  if (world.closures.some((closure) => closure.endMinutes <= at)) {
    world.closures = world.closures.filter((closure) => closure.endMinutes > at);
  }
  for (const event of incidents.update(at)) {
    if (event.type === 'responding') respondToIncident(event.edgeId);
  }
  for (const edgeId of incidents.blockingEdges()) closureEdgeSet.add(edgeId);
  barriers.update(scene, graph, world.closures, at);
  incidentVisuals.update(scene, graph, incidents.list);

  weather.update(at);
  traffic.update(dt);
  for (const event of traffic.consumeEvents()) {
    people.handleEvent(event);
    if (event.type === 'vehicle-arrived') citizens.handleAgentArrived(event.agentId, at);
  }
  people.update(dt);
  for (const demand of citizens.update(at)) {
    const agentId = traffic.requestTrip(demand.fromBlock, demand.toBlock);
    if (agentId !== null) citizens.assignAgent(demand.citizenId, agentId);
    else citizens.deferTrip(demand.citizenId, at);
  }
}

function frame(): void {
  const rawDt = realClock.getDelta();
  const frameSeconds = Math.min(Math.max(rawDt, 0), MAX_FRAME_SECONDS);
  const elapsed = realClock.elapsedTime;

  const plan = stepper.advance(rawDt);
  for (let step = 0; step < plan.steps; step++) simulate(FIXED_STEP);

  const at = simClock.worldMinutes;
  const conditions = conditionsFor(weather.current);
  sceneFog.near = 60 + 90 * conditions.visibility;
  sceneFog.far = 140 + 200 * conditions.visibility;
  applyEnvironment(1 - conditions.visibility);
  rain.update(weather.current, { x: controls.target.x, z: controls.target.z }, frameSeconds);
  traffic.render(plan.alpha);
  people.render(plan.alpha);
  controls.update();
  renderer.render(scene, camera);

  if (elapsed - lastStatsUpdate > 0.5) {
    lastStatsUpdate = elapsed;
    const fps = Math.round(1 / Math.max(frameSeconds, 0.0001));
    const closureCount = world.closures.filter(
      (closure) => at >= closure.startMinutes && at < closure.endMinutes,
    ).length;
    const closureInfo = closureCount > 0 ? ` · ${closureCount} closures` : '';
    const incidentInfo = incidents.count > 0 ? ` · ${incidents.count} incidents` : '';
    const weatherInfo =
      weather.current.kind === 'clear'
        ? ''
        : ` · ${weather.current.kind} ${Math.round(weather.current.intensity * 100)}%`;
    const noiseInfo = traffic.noiseIndex >= 0.02 ? ` · noise ${Math.round(traffic.noiseIndex * 100)}%` : '';
    stats.textContent =
      `${traffic.vehicleCount} vehicles · ${citizens.travelingCount} commuters · ` +
      `${people.count} pedestrians · day ${simClock.day} ${simClock.timeString()} · ${simClock.speed}x${closureInfo}${incidentInfo}${weatherInfo}${noiseInfo} · ${fps} fps`;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('beforeunload', saveWorld);

if (new URLSearchParams(window.location.search).has('closure')) {
  toggleRandomClosure({ x: 14, z: 20 });
}

if (params.has('incident')) {
  triggerRandomIncident({ x: 14, z: 20 }, true);
}

weather.update(simClock.worldMinutes);
const initialConditions = conditionsFor(weather.current);
sceneFog.near = 60 + 90 * initialConditions.visibility;
sceneFog.far = 140 + 200 * initialConditions.visibility;
applyEnvironment(1 - initialConditions.visibility);
renderer.render(scene, camera);
requestAnimationFrame(frame);
