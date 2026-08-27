const DAY_MS = 24 * 60 * 60 * 1000;

export interface SrsState {
  srsInterval: number;
  srsEase: number;
  srsDue: string;
  srsReps: number;
}

export function initialSrsState(now: Date = new Date()): SrsState {
  return { srsInterval: 0, srsEase: 2.5, srsReps: 0, srsDue: now.toISOString() };
}

export function isDue(state: Pick<SrsState, "srsDue">, now: Date = new Date()): boolean {
  return new Date(state.srsDue).getTime() <= now.getTime();
}

export function reviewSrsState(state: SrsState, correct: boolean, now: Date = new Date()): SrsState {
  if (!correct) {
    return {
      srsInterval: 1,
      srsEase: Math.max(1.3, state.srsEase - 0.2),
      srsReps: 0,
      srsDue: new Date(now.getTime() + DAY_MS).toISOString(),
    };
  }

  const srsReps = state.srsReps + 1;
  const srsInterval = srsReps === 1 ? 1 : srsReps === 2 ? 6 : Math.round(state.srsInterval * state.srsEase);
  return {
    srsInterval,
    srsEase: state.srsEase + 0.1,
    srsReps,
    srsDue: new Date(now.getTime() + srsInterval * DAY_MS).toISOString(),
  };
}
