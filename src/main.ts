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

const app = document.querySelector<HTMLDivElement>('#app')!;
const stats = document.querySelector<HTMLParagraphElement>('#stats')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(palette.sky);
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

let lastStatsUpdate = 0;
const clock = new THREE.Clock();

function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  traffic.update(dt);
  people.update(dt);
  controls.update();
  renderer.render(scene, camera);

  if (elapsed - lastStatsUpdate > 0.5) {
    lastStatsUpdate = elapsed;
    const fps = Math.round(1 / Math.max(dt, 0.0001));
    stats.textContent = `${traffic.vehicleCount} vehicles · ${people.count} pedestrians · ${fps} fps`;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.render(scene, camera);
requestAnimationFrame(frame);
