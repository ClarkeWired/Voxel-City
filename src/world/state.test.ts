import { describe, expect, it } from 'vitest';
import { createWorldState, deserializeWorld, serializeWorld } from './state';

describe('WorldState persistence', () => {
  it('creates a fresh 08:00 world', () => {
    const world = createWorldState();
    expect(world.version).toBe(2);
    expect(world.clock.minutes).toBe(480);
    expect(world.clock.day).toBe(1);
    expect(world.clock.speed).toBe(1);
    expect(world.closures).toEqual([]);
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
    const restored = deserializeWorld(serializeWorld(world));
    expect(restored).toEqual(world);
  });

  it('migrates version 1 saves with empty closures', () => {
    const v1 = JSON.stringify({ version: 1, clock: { minutes: 600, day: 2, speed: 1 }, rngState: 7 });
    const world = deserializeWorld(v1);
    expect(world.version).toBe(2);
    expect(world.clock).toEqual({ minutes: 600, day: 2, speed: 1 });
    expect(world.rngState).toBe(7);
    expect(world.closures).toEqual([]);
  });

  it('drops malformed closure entries', () => {
    const payload = JSON.stringify({
      version: 2,
      clock: { minutes: 10, day: 1, speed: 1 },
      rngState: 0,
      closures: [
        { id: 'ok', edgeId: 'e', reason: 'x', startMinutes: 0, endMinutes: 10 },
        { id: 'bad', edgeId: 'e' },
        'nonsense',
        null,
      ],
    });
    const world = deserializeWorld(payload);
    expect(world.closures.length).toBe(1);
    expect(world.closures[0]!.id).toBe('ok');
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
      JSON.stringify({ version: 2, clock: { minutes: 10, day: 2, speed: 1 }, rngState: 4294967295 }),
    );
    expect(good.rngState).toBe(4294967295);
    const bad = deserializeWorld(
      JSON.stringify({ version: 2, clock: { minutes: 10, day: 2, speed: 1 }, rngState: -1.5 }),
    );
    expect(bad.rngState).toBe(0);
  });
});
