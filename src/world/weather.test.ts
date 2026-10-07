import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { DAY_LENGTH } from './clock';
import { CLEAR_CONDITIONS, WeatherSystem, conditionsFor, isWeatherKind, parseWeather } from './weather';

describe('weather', () => {
  it('clear weather has neutral conditions', () => {
    expect(conditionsFor({ kind: 'clear', intensity: 1, until: 0 })).toEqual(CLEAR_CONDITIONS);
  });

  it('bad weather reduces speed and braking while increasing headway', () => {
    const rain = conditionsFor({ kind: 'rain', intensity: 1, until: 0 });
    const storm = conditionsFor({ kind: 'storm', intensity: 1, until: 0 });
    const fog = conditionsFor({ kind: 'fog', intensity: 1, until: 0 });
    expect(storm.speedFactor).toBeLessThan(rain.speedFactor);
    expect(rain.speedFactor).toBeLessThan(1);
    expect(storm.brakeFactor).toBeLessThan(rain.brakeFactor);
    expect(fog.visibility).toBeLessThan(rain.visibility);
    expect(rain.headwayFactor).toBeGreaterThan(1);
  });

  it('scales smoothly with intensity', () => {
    const light = conditionsFor({ kind: 'rain', intensity: 0.3, until: 0 });
    const heavy = conditionsFor({ kind: 'rain', intensity: 0.9, until: 0 });
    expect(light.speedFactor).toBeGreaterThan(heavy.speedFactor);
    expect(light.visibility).toBeGreaterThan(heavy.visibility);
  });

  it('holds its window and then changes deterministically', () => {
    const a = new WeatherSystem(new Rng(42), undefined, 0);
    const b = new WeatherSystem(new Rng(42), undefined, 0);
    const until = a.current.until;
    expect(a.update(until - 1).until).toBe(until);
    for (let t = until; t < DAY_LENGTH * 2; t += 17) {
      expect(a.update(t)).toEqual(b.update(t));
    }
  });

  it('shows a variety of kinds across many days', () => {
    const system = new WeatherSystem(new Rng(7), undefined, 0);
    const seen = new Set<string>();
    for (let t = 0; t < DAY_LENGTH * 30; t += 30) seen.add(system.update(t).kind);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('parses valid weather and rejects junk', () => {
    const ok = parseWeather({ kind: 'storm', intensity: 0.7, until: 100 });
    expect(ok).toEqual({ kind: 'storm', intensity: 0.7, until: 100 });
    expect(parseWeather({ kind: 'hot', intensity: 1, until: 1 })).toBeNull();
    expect(parseWeather({ kind: 'rain', intensity: 'x', until: 1 })).toBeNull();
    expect(parseWeather(null)).toBeNull();
    expect(isWeatherKind('fog')).toBe(true);
    expect(isWeatherKind('snow')).toBe(false);
  });

  it('fromJSON falls back to fresh clear weather on junk', () => {
    const system = WeatherSystem.fromJSON({ kind: 42 }, new Rng(1), 0);
    expect(system.current.kind).toBe('clear');
  });
});
