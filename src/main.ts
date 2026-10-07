import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Rng } from './core/rng';
import { palette } from './core/palette';
import { buildCity } from './city/index';
import { buildLaneGraph } from './traffic/graph';
import { TrafficSystem } from './traffic/index';
import { buildWalkGraph } from './people/paths';
import { PeopleSystem } from './people/index';
import {
  SPEEDS,
  SimulationClock,
  daylightFactor,
  horizonWarmth,
  sunArc,
} from './world/clock';
import { createWorldState, deserializeWorld, serializeWorld, type WorldState } from './world/state';

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

const world = loadWorld() ?? createWorldState();
const timeParam = new URLSearchParams(window.location.search).get('minutes');
const startMinutes = timeParam !== null && Number.isFinite(Number(timeParam)) ? Number(timeParam) : null;
let simClock =
  startMinutes !== null
    ? new SimulationClock({ minutes: ((startMinutes % 1440) + 1440) % 1440, day: 1, speed: 1 })
    : new SimulationClock(world.clock);

const scene = new THREE.Scene();
const skyColor = new THREE.Color(palette.sky);
scene.background = skyColor;
scene.fog = new THREE.Fog(palette.fog, 150, 340);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 700);
camera.position.set(32, 46, 58);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
app.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(palette.sky, 0x8a8f7a, 0.95);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3d6, 1.5);
sun.position.set(70, 110, 45);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 320;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

const NIGHT_SKY = new THREE.Color(0x16202f);
const DUSK_SKY = new THREE.Color(0xf7b56b);
const DAY_SKY = new THREE.Color(palette.sky);
const SUN_LOW = new THREE.Color(0xff9a4d);
const SUN_HIGH = new THREE.Color(0xfff3d6);
const skyScratch = new THREE.Color();

function applyDaylight(): void {
  const minutes = simClock.minutes;
  const daylight = daylightFactor(minutes);
  const warmth = horizonWarmth(minutes);
  const arc = sunArc(minutes);

  sun.position.set(arc.x, Math.max(arc.y, 10), arc.z);
  sun.intensity = 0.06 + 1.5 * daylight;
  sun.color.copy(SUN_LOW).lerp(SUN_HIGH, Math.min(1, Math.max(0, arc.y / 90)));

  skyScratch.copy(NIGHT_SKY).lerp(DAY_SKY, daylight);
  skyScratch.lerp(DUSK_SKY, 0.5 * warmth * (1 - Math.abs(2 * daylight - 1)));
  skyColor.copy(skyScratch);
  scene.fog!.color.copy(skyScratch);

  hemi.intensity = 0.16 + 0.85 * daylight;
  hemi.color.copy(skyScratch);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 16);
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
const traffic = new TrafficSystem(scene, graph, rng, city.shelter, city.signalHeads);
const walkGraph = buildWalkGraph();
const people = new PeopleSystem(scene, walkGraph, traffic, rng, city.shelter);

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
  }
});

function saveWorld(): void {
  try {
    world.clock = simClock.toJSON();
    world.rngState = rng.snapshot();
    window.localStorage.setItem(SAVE_KEY, serializeWorld(world));
  } catch {
    // storage may be unavailable or full; the simulation keeps running
  }
}

let lastStatsUpdate = 0;
let sinceAutosave = 0;
const realClock = new THREE.Clock();

function frame(): void {
  const dt = Math.min(realClock.getDelta(), 0.05);
  const elapsed = realClock.elapsedTime;

  simClock.step(dt);
  sinceAutosave += dt;
  if (sinceAutosave >= AUTOSAVE_SECONDS) {
    sinceAutosave = 0;
    saveWorld();
  }

  applyDaylight();
  traffic.update(dt);
  people.update(dt);
  controls.update();
  renderer.render(scene, camera);

  if (elapsed - lastStatsUpdate > 0.5) {
    lastStatsUpdate = elapsed;
    const fps = Math.round(1 / Math.max(dt, 0.0001));
    stats.textContent =
      `${traffic.vehicleCount} vehicles · ${people.count} pedestrians · ` +
      `day ${simClock.day} ${simClock.timeString()} · ${simClock.speed}x · ${fps} fps`;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('beforeunload', saveWorld);

applyDaylight();
renderer.render(scene, camera);
requestAnimationFrame(frame);
