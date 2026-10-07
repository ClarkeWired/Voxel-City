import { DAY_LENGTH } from './clock';

export interface RoadClosure {
  id: string;
  edgeId: string;
  reason: string;
  startMinutes: number;
  endMinutes: number;
}

export function worldMinutes(day: number, minutes: number): number {
  return (day - 1) * DAY_LENGTH + minutes;
}

export function isClosureActive(closure: RoadClosure, at: number): boolean {
  return at >= closure.startMinutes && at < closure.endMinutes;
}

export function activeClosureEdges(closures: readonly RoadClosure[], at: number): Set<string> {
  const edges = new Set<string>();
  for (const closure of closures) {
    if (isClosureActive(closure, at)) edges.add(closure.edgeId);
  }
  return edges;
}

export function createClosure(
  id: string,
  edgeId: string,
  reason: string,
  startMinutes: number,
  durationMinutes: number,
): RoadClosure {
  return {
    id,
    edgeId,
    reason,
    startMinutes,
    endMinutes: startMinutes + durationMinutes,
  };
}
