import { describe, expect, it } from 'vitest';
import { createWorldState, deserializeWorld, serializeWorld } from './state';

describe('WorldState persistence', () => {
  it('creates a fresh 08:00 world', () => {
    const world = createWorldState();
    expect(world.version).toBe(1);
    expect(world.clock.minutes).toBe(480);
    expect(world.clock.day).toBe(1);
    expect(world.clock.speed).toBe(1);
  });

  it('round-trips through JSON without losing fields', () => {
    const world = createWorldState(17 * 60);
    world.clock.day = 4;
    world.clock.speed = 4;
    world.rngState = 0xdeadbeef;
    const restored = deserializeWorld(serializeWorld(world));
    expect(restored).toEqual(world);
  });

  it('rejects malformed payloads', () => {
    expect(() => deserializeWorld('null')).toThrow();
    expect(() => deserializeWorld('"text"')).toThrow();
    expect(() => deserializeWorld('{}')).toThrow(/version/);
    expect(() => deserializeWorld(JSON.stringify({ version: 1 }))).toThrow(/clock/);
    expect(() =>
      deserializeWorld(JSON.stringify({ version: 1, clock: { minutes: 'x', day: 1, speed: 1 } })),
    ).toThrow(/clock/);
    expect(() =>
      deserializeWorld(JSON.stringify({ version: 1, clock: { minutes: 1, day: 1, speed: -2 } })),
    ).toThrow(/speed/);
    expect(() => deserializeWorld('{not json')).toThrow();
  });

  it('keeps a valid rng snapshot and defaults invalid ones', () => {
    const good = deserializeWorld(
      JSON.stringify({ version: 1, clock: { minutes: 10, day: 2, speed: 1 }, rngState: 4294967295 }),
    );
    expect(good.rngState).toBe(4294967295);
    const bad = deserializeWorld(
      JSON.stringify({ version: 1, clock: { minutes: 10, day: 2, speed: 1 }, rngState: -1.5 }),
    );
    expect(bad.rngState).toBe(0);
  });
});
