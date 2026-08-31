import { addMinutesStr, endMinutesOf, minutesOf } from './date';

export interface SchedulableTask {
  id: string;
  title: string;
  /** Minutes the task is expected to take. */
  estimate: number;
  /** Ids this task must follow. */
  dependsOn: string[];
}

export interface Busy { start: string; end: string }

export interface PlacedBlock {
  taskId: string;
  title: string;
  start: string;
  end: string;
}

export interface ScheduleResult {
  blocks: PlacedBlock[];
  /** Tasks that could not be placed, each with the reason. */
  skipped: { id: string; title: string; reason: string }[];
  /** Titles forming a dependency loop, if one exists. Nothing is scheduled then. */
  cycle: string[] | null;
}

/**
 * Orders tasks so every dependency comes before its dependents (Kahn's
 * algorithm), then lays them end to end from `startTime`, stepping over any
 * time already committed on the day.
 *
 * A dependency that is neither finished nor part of this build blocks its
 * dependent rather than being quietly ignored — scheduling work before its
 * prerequisite is worse than leaving it out and saying so.
 */
export function buildSchedule(
  tasks: SchedulableTask[],
  opts: { startTime: string; busy?: Busy[]; dayEnd?: string },
): ScheduleResult {
  const included = new Map(tasks.map((t) => [t.id, t]));
  const skipped: ScheduleResult['skipped'] = [];

  // Only dependencies inside this build affect ordering; one that is absent
  // means the task is not startable at all, which is handled below.
  const deps = new Map<string, string[]>();
  tasks.forEach((t) => deps.set(t.id, t.dependsOn.filter((d) => included.has(d))));

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  tasks.forEach((t) => { indegree.set(t.id, 0); dependents.set(t.id, []); });
  tasks.forEach((t) => {
    deps.get(t.id)!.forEach((d) => {
      indegree.set(t.id, (indegree.get(t.id) ?? 0) + 1);
      dependents.get(d)!.push(t.id);
    });
  });

  // How much work still hangs off each task. Among everything currently
  // startable, the deepest chain goes first, so a sequence runs to completion
  // instead of being interrupted by unrelated work that happened to be ready.
  const depthCache = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depthCache.get(id);
    if (cached !== undefined) return cached;
    depthCache.set(id, 1);
    const d = 1 + Math.max(0, ...dependents.get(id)!.map(depthOf));
    depthCache.set(id, d);
    return d;
  };
  const inputIndex = new Map(tasks.map((t, i) => [t.id, i]));

  const ready = tasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
  const order: string[] = [];
  while (ready.length) {
    ready.sort((a, b) => depthOf(b) - depthOf(a) || inputIndex.get(a)! - inputIndex.get(b)!);
    const id = ready.shift()!;
    order.push(id);
    dependents.get(id)!.forEach((next) => {
      const left = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, left);
      if (left === 0) ready.push(next);
    });
  }

  if (order.length !== tasks.length) {
    const stuck = new Set(tasks.map((t) => t.id).filter((id) => !order.includes(id)));
    return { blocks: [], skipped: [], cycle: findCycle(stuck, deps, included) };
  }

  const busy = [...(opts.busy ?? [])]
    .map((b) => ({ start: minutesOf(b.start), end: endMinutesOf(b) }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end))
    .sort((a, b) => a.start - b.start);

  const dayEnd = opts.dayEnd ? minutesOf(opts.dayEnd) : 24 * 60;
  let cursor = minutesOf(opts.startTime);
  const blocks: PlacedBlock[] = [];
  const placed = new Set<string>();

  for (const id of order) {
    const task = included.get(id)!;

    const unmet = task.dependsOn.filter((d) => !included.has(d));
    if (unmet.length) {
      skipped.push({ id, title: task.title, reason: 'waiting on work not in this build' });
      continue;
    }
    // A dependency that was itself skipped cannot be relied on either.
    if (deps.get(id)!.some((d) => !placed.has(d))) {
      skipped.push({ id, title: task.title, reason: 'its prerequisite could not be scheduled' });
      continue;
    }

    const slot = nextFreeSlot(cursor, task.estimate, busy, dayEnd);
    if (slot === null) {
      skipped.push({ id, title: task.title, reason: 'no free time left in the day' });
      continue;
    }
    blocks.push({
      taskId: id,
      title: task.title,
      start: toTime(slot),
      end: toTime(slot + task.estimate),
    });
    placed.add(id);
    cursor = slot + task.estimate;
  }

  return { blocks, skipped, cycle: null };
}

/** First moment at or after `from` with `length` free minutes before `dayEnd`. */
function nextFreeSlot(from: number, length: number, busy: Busy2[], dayEnd: number): number | null {
  let at = from;
  // Each collision pushes past that commitment; re-checked because the new
  // position may run into the next one along.
  for (let guard = 0; guard < busy.length + 1; guard += 1) {
    const clash = busy.find((b) => at < b.end && at + length > b.start);
    if (!clash) return at + length <= dayEnd ? at : null;
    at = clash.end;
  }
  return at + length <= dayEnd ? at : null;
}

interface Busy2 { start: number; end: number }

function toTime(mins: number) {
  return addMinutesStr('00:00', mins);
}

/** Walks the unresolved subgraph to name one loop, for the error message. */
function findCycle(
  stuck: Set<string>,
  deps: Map<string, string[]>,
  titles: Map<string, { title: string }>,
): string[] {
  const seen = new Set<string>();
  const stack: string[] = [];

  const walk = (id: string): string[] | null => {
    if (stack.includes(id)) return [...stack.slice(stack.indexOf(id)), id];
    if (seen.has(id)) return null;
    seen.add(id);
    stack.push(id);
    for (const d of deps.get(id) ?? []) {
      if (!stuck.has(d)) continue;
      const found = walk(d);
      if (found) return found;
    }
    stack.pop();
    return null;
  };

  for (const id of stuck) {
    const found = walk(id);
    if (found) return found.map((x) => titles.get(x)?.title ?? x);
  }
  return [...stuck].map((x) => titles.get(x)?.title ?? x);
}
