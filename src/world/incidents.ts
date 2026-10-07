import type { Rng } from '../core/rng';

export type IncidentPhase = 'active' | 'responding';

export interface Incident {
  id: string;
  edgeId: string;
  start: number;
  respondAt: number;
  clearAt: number;
  phase: IncidentPhase;
}

export type IncidentEvent =
  | { type: 'responding'; id: string; edgeId: string }
  | { type: 'cleared'; id: string; edgeId: string };

function parseIncident(raw: unknown): Incident | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.edgeId !== 'string') return null;
  if (record.phase !== 'active' && record.phase !== 'responding') return null;
  if (
    typeof record.start !== 'number' ||
    typeof record.respondAt !== 'number' ||
    typeof record.clearAt !== 'number' ||
    !Number.isFinite(record.start) ||
    !Number.isFinite(record.respondAt) ||
    !Number.isFinite(record.clearAt)
  ) {
    return null;
  }
  return {
    id: record.id,
    edgeId: record.edgeId,
    start: record.start,
    respondAt: record.respondAt,
    clearAt: record.clearAt,
    phase: record.phase,
  };
}

export function parseIncidents(raw: unknown): Incident[] {
  if (!Array.isArray(raw)) return [];
  const incidents: Incident[] = [];
  for (const entry of raw) {
    const incident = parseIncident(entry);
    if (incident) incidents.push(incident);
  }
  return incidents;
}

export class IncidentSystem {
  private readonly rng: Rng;
  private readonly incidents: Incident[] = [];
  private nextId = 1;

  constructor(rng: Rng, incidents: Incident[] = []) {
    this.rng = rng;
    for (const incident of incidents) {
      this.incidents.push({ ...incident });
      const numeric = Number.parseInt(incident.id.replace(/^incident-/, ''), 10);
      if (Number.isFinite(numeric) && numeric >= this.nextId) this.nextId = numeric + 1;
    }
  }

  static fromJSON(raw: unknown, rng: Rng): IncidentSystem {
    return new IncidentSystem(rng, parseIncidents(raw));
  }

  get list(): readonly Incident[] {
    return this.incidents;
  }

  get count(): number {
    return this.incidents.length;
  }

  get respondingCount(): number {
    let count = 0;
    for (const incident of this.incidents) if (incident.phase === 'responding') count++;
    return count;
  }

  trigger(edgeId: string, at: number, respondAfter?: number, clearAfter?: number): Incident {
    const respondAt = at + (respondAfter ?? this.rng.range(2, 7));
    const clearAt = respondAt + (clearAfter ?? this.rng.range(8, 16));
    const incident: Incident = {
      id: `incident-${this.nextId++}`,
      edgeId,
      start: at,
      respondAt,
      clearAt,
      phase: 'active',
    };
    this.incidents.push(incident);
    return incident;
  }

  update(at: number): IncidentEvent[] {
    const events: IncidentEvent[] = [];
    for (let i = this.incidents.length - 1; i >= 0; i--) {
      const incident = this.incidents[i]!;
      if (incident.phase === 'active' && at >= incident.respondAt) {
        incident.phase = 'responding';
        events.push({ type: 'responding', id: incident.id, edgeId: incident.edgeId });
      }
      if (at >= incident.clearAt) {
        this.incidents.splice(i, 1);
        events.push({ type: 'cleared', id: incident.id, edgeId: incident.edgeId });
      }
    }
    return events;
  }

  blockingEdges(): Set<string> {
    const edges = new Set<string>();
    for (const incident of this.incidents) edges.add(incident.edgeId);
    return edges;
  }

  toJSON(): Incident[] {
    return this.incidents.map((incident) => ({ ...incident }));
  }
}
