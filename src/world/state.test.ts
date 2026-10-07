import { describe, expect, it } from 'vitest';
import { createWorldState, deserializeWorld, serializeWorld } from './state';
import type { CitizenState } from './citizens';

const sampleCitizen: CitizenState = {
  id: 1,
  homeBlock: 0,
  workBlock: 4,
  shopBlock: 2,
  location: 0,
  activity: 'home',
  nextDepart: 480,
  traveling: false,
  tripAgentId: -1,
  targetBlock: 4,
  workStart: 480,
  workEnd: 1020,
  shopDwell: 60,
};

describe('WorldState persistence', () => {
  it('creates a fresh 08:00 world', () => {
    const world = createWorldState();
    expect(world.version).toBe(4);
    expect(world.clock.minutes).toBe(480);
    expect(world.clock.day).toBe(1);
    expect(world.clock.speed).toBe(1);
    expect(world.closures).toEqual([]);
    expect(world.citizens).toEqual([]);
    expect(world.weather).toBeNull();
  });

  it('round-trips through JSON without losing fields', () => {
    const world = createWorldState(17 * 60);
    world.clock.day = 4;
    world.clock.speed = 4;
    world.rngState = 0xdeadbeef;
    world.closures.push({
      id: 'closure-1',
      edgeId: 'r:EW:2:1:2:E',
      reason: 'roadworks',
      startMinutes: 2880,
      endMinutes: 2900,
    });
    world.citizens.push(sampleCitizen);
    world.weather = { kind: 'rain', intensity: 0.6, until: 2900 };
    const restored = deserializeWorld(serializeWorld(world));
    expect(restored).toEqual(world);
  });

  it('migrates version 1-3 saves to version 4', () => {
    const v1 = JSON.stringify({ version: 1, clock: { minutes: 600, day: 2, speed: 1 }, rngState: 7 });
    const fromV1 = deserializeWorld(v1);
    expect(fromV1.version).toBe(4);
    expect(fromV1.clock).toEqual({ minutes: 600, day: 2, speed: 1 });
    expect(fromV1.closures).toEqual([]);
    expect(fromV1.citizens).toEqual([]);
    expect(fromV1.weather).toBeNull();

    const v2 = JSON.stringify({
      version: 2,
      clock: { minutes: 700, day: 1, speed: 1 },
      rngState: 0,
      closures: [{ id: 'c', edgeId: 'e', reason: 'x', startMinutes: 0, endMinutes: 10 }],
    });
    const fromV2 = deserializeWorld(v2);
    expect(fromV2.version).toBe(4);
    expect(fromV2.closures.length).toBe(1);
    expect(fromV2.weather).toBeNull();

    const v3 = JSON.stringify({
      version: 3,
      clock: { minutes: 800, day: 1, speed: 1 },
      rngState: 0,
      citizens: [sampleCitizen],
    });
    const fromV3 = deserializeWorld(v3);
    expect(fromV3.version).toBe(4);
    expect(fromV3.citizens.length).toBe(1);
    expect(fromV3.weather).toBeNull();
  });

  it('drops malformed closure and citizen entries and malformed weather', () => {
    const payload = JSON.stringify({
      version: 4,
      clock: { minutes: 10, day: 1, speed: 1 },
      rngState: 0,
      closures: [
        { id: 'ok', edgeId: 'e', reason: 'x', startMinutes: 0, endMinutes: 10 },
        { id: 'bad', edgeId: 'e' },
        'nonsense',
      ],
      citizens: [sampleCitizen, { id: 'x' }, null, { id: 2 }],
      weather: { kind: 'snow', intensity: 1, until: 5 },
    });
    const world = deserializeWorld(payload);
    expect(world.closures.length).toBe(1);
    expect(world.citizens.length).toBe(1);
    expect(world.citizens[0]!.id).toBe(1);
    expect(world.weather).toBeNull();
  });

  it('rejects malformed payloads', () => {
    expect(() => deserializeWorld('null')).toThrow();
    expect(() => deserializeWorld('"text"')).toThrow();
    expect(() => deserializeWorld('{}')).toThrow(/version/);
    expect(() => deserializeWorld(JSON.stringify({ version: 9, clock: { minutes: 0, day: 1, speed: 1 } }))).toThrow(/version/);
    expect(() => deserializeWorld(JSON.stringify({ version: 1 }))).toThrow(/clock/);
    expect(() =>
      deserializeWorld(JSON.stringify({ version: 1, clock: { minutes: 'x', day: 1, speed: 1 } })),
    ).toThrow(/clock/);
    expect(() =>
      deserializeWorld(JSON.stringify({ version: 1, clock: { minutes: 1, day: 1, speed: -2 } })),
    ).toThrow(/speed/);
    expect(() =>
      deserializeWorld(JSON.stringify({ version: 1, clock: { minutes: 5000, day: 1, speed: 1 } })),
    ).toThrow(/range/);
    expect(() => deserializeWorld('{not json')).toThrow();
  });

  it('keeps a valid rng snapshot and defaults invalid ones', () => {
    const good = deserializeWorld(
      JSON.stringify({ version: 4, clock: { minutes: 10, day: 2, speed: 1 }, rngState: 4294967295 }),
    );
    expect(good.rngState).toBe(4294967295);
    const bad = deserializeWorld(
      JSON.stringify({ version: 4, clock: { minutes: 10, day: 2, speed: 1 }, rngState: -1.5 }),
    );
    expect(bad.rngState).toBe(0);
  });
});
