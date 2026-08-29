const DAY_MS = 24 * 60 * 60 * 1000;

export interface SrsState {
  srsInterval: number;
  srsEase: number;
  srsDue: string;
  srsReps: number;
}

export type SrsRating = "again" | "hard" | "good" | "easy";

export const SRS_RATING_LABELS: Record<SrsRating, string> = {
  again: "Не помню",
  hard: "Трудно",
  good: "Помню",
  easy: "Легко",
};

export const SRS_RATING_ORDER: SrsRating[] = ["again", "hard", "good", "easy"];

export interface SrsReview {
  reviewedAt: string;
  rating: SrsRating;
  previousInterval: number;
  nextInterval: number;
  previousDue: string;
  nextDue: string;
}

export function isWellKnown(
  state: Pick<SrsState, "srsReps"> & { isLearned?: boolean; srsHistory?: SrsReview[] }
): boolean {
  if (state.isLearned) return true;
  if (state.srsReps < 3) return false;
  const recent = (state.srsHistory ?? []).slice(-3);
  return recent.length === 3 && recent.every((review) => review.rating === "good" || review.rating === "easy");
}

export function initialSrsState(now: Date = new Date()): SrsState {
  return { srsInterval: 0, srsEase: 2.5, srsReps: 0, srsDue: now.toISOString() };
}

export function isDue(state: Pick<SrsState, "srsDue">, now: Date = new Date()): boolean {
  return new Date(state.srsDue).getTime() <= now.getTime();
}

export function reviewSrsState(state: SrsState, rating: SrsRating, now: Date = new Date()): SrsState {
  if (rating === "again") {
    return {
      srsInterval: 1,
      srsEase: Math.max(1.3, state.srsEase - 0.2),
      srsReps: 0,
      srsDue: new Date(now.getTime() + DAY_MS).toISOString(),
    };
  }

  const srsReps = state.srsReps + 1;
  let srsInterval: number;
  let srsEase = state.srsEase;

  if (rating === "hard") {
    srsInterval = Math.max(1, Math.round(Math.max(1, state.srsInterval) * 1.2));
    srsEase = Math.max(1.3, state.srsEase - 0.15);
  } else if (rating === "easy") {
    srsInterval = srsReps === 1 ? 4 : Math.max(4, Math.round(Math.max(1, state.srsInterval) * state.srsEase * 1.3));
    srsEase = state.srsEase + 0.15;
  } else {
    srsInterval = srsReps === 1 ? 1 : srsReps === 2 ? 6 : Math.max(1, Math.round(state.srsInterval * state.srsEase));
  }

  return {
    srsInterval,
    srsEase,
    srsReps,
    srsDue: new Date(now.getTime() + srsInterval * DAY_MS).toISOString(),
  };
}

export function createSrsReview(
  previous: SrsState,
  next: SrsState,
  rating: SrsRating,
  now: Date = new Date()
): SrsReview {
  return {
    reviewedAt: now.toISOString(),
    rating,
    previousInterval: previous.srsInterval,
    nextInterval: next.srsInterval,
    previousDue: previous.srsDue,
    nextDue: next.srsDue,
  };
}
