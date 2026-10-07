import * as THREE from 'three';
import type { Rng } from '../core/rng';
import type { WeatherState } from '../world/weather';

const DROPS = 1400;
const AREA = 130;
const HEIGHT = 60;

export class RainVisuals {
  private readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private visible = false;

  constructor(scene: THREE.Scene, rng: Rng) {
    this.positions = new Float32Array(DROPS * 3);
    this.speeds = new Float32Array(DROPS);
    for (let i = 0; i < DROPS; i++) {
      this.positions[i * 3] = rng.range(-AREA / 2, AREA / 2);
      this.positions[i * 3 + 1] = rng.range(0, HEIGHT);
      this.positions[i * 3 + 2] = rng.range(-AREA / 2, AREA / 2);
      this.speeds[i] = rng.range(26, 40);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xe6f1fa,
      size: 0.55,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.name = 'rain';
    this.points.visible = false;
    scene.add(this.points);
  }

  update(weather: WeatherState, center: { x: number; z: number }, dt: number): void {
    const active = weather.kind === 'rain' || weather.kind === 'storm';
    if (!this.visible && active) {
      this.visible = true;
      this.points.visible = true;
    } else if (this.visible && !active) {
      this.visible = false;
      this.points.visible = false;
    }
    if (!active) return;

    const material = this.points.material as THREE.PointsMaterial;
    material.opacity = 0.5 + 0.45 * weather.intensity;
    const wind = weather.kind === 'storm' ? 6 : 2.5;
    const speedBoost = weather.kind === 'storm' ? 1.2 : 1;
    for (let i = 0; i < DROPS; i++) {
      const index = i * 3;
      this.positions[index + 1] = this.positions[index + 1]! - this.speeds[i]! * speedBoost * dt;
      this.positions[index] = this.positions[index]! + wind * dt;
      if (this.positions[index + 1]! < 0) {
        this.positions[index + 1] = HEIGHT;
      }
      if (this.positions[index]! > AREA / 2) {
        this.positions[index] = -AREA / 2;
      }
    }
    this.points.position.set(center.x - AREA / 2, 0, center.z - AREA / 2);
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
