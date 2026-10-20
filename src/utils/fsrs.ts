import type { Card, CardState, ReviewRatingCounts } from '../types';

export const w = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666,
  0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658,
  0.1542,
];

export const requestRetention = 0.9;
export const maximumInterval = 36500;
export const S_MIN = 0.01;
export const DECAY = -w[20];
export const enable_fuzz = true;
export const LEARNING_STEPS = [1, 10]; // em minutos

export const ratings: Record<string, number> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

export function roundTo(num: number, precision = 8): number {
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export const FACTOR = roundTo(Math.exp(Math.pow(DECAY, -1) * Math.log(0.9)) - 1.0, 8);

export function calculate_interval_modifier(reqRetention: number): number {
  return roundTo((Math.pow(reqRetention, 1 / DECAY) - 1) / FACTOR, 8);
}

export const INTERVAL_MODIFIER = calculate_interval_modifier(requestRetention);

export function generate_fuzz_factor(card: Card): number {
  const seedStr = `${card.id}_${card.reviews || 0}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function apply_fuzz(ivl: number, fuzz_factor: number): number {
  if (!enable_fuzz || ivl < 2.5) return Math.round(ivl);
  ivl = Math.round(ivl);
  const min_ivl = Math.max(2, Math.round(ivl * 0.95 - 1));
  const max_ivl = Math.min(maximumInterval, Math.round(ivl * 1.05 + 1));
  return Math.floor(fuzz_factor * (max_ivl - min_ivl + 1) + min_ivl);
}

export function forgetting_curve(elapsed_days: number, stability?: number): number {
  const safeS = Math.max(stability || S_MIN, S_MIN);
  return roundTo(Math.pow(1 + (FACTOR * elapsed_days) / safeS, DECAY), 8);
}

export function next_interval(
  stability: number,
  fuzz_factor: number,
  reqRetention = requestRetention
): number {
  const modifier =
    reqRetention === requestRetention
      ? INTERVAL_MODIFIER
      : calculate_interval_modifier(clamp(reqRetention, 0.75, 0.97));
  const raw_interval = clamp(Math.round(stability * modifier), 1, maximumInterval);
  return clamp(apply_fuzz(raw_interval, fuzz_factor), 1, maximumInterval);
}

export function linear_damping(delta_d: number, old_d: number): number {
  return roundTo((delta_d * (10 - old_d)) / 9, 8);
}

export function mean_reversion(init: number, current: number): number {
  return roundTo(w[7] * init + (1 - w[7]) * current, 8);
}

export function init_difficulty(ratingStr: string): number {
  const g = ratings[ratingStr];
  return roundTo(w[4] - Math.exp((g - 1) * w[5]) + 1, 8);
}

export function init_stability(ratingStr: string): number {
  const g = ratings[ratingStr];
  return Math.max(w[g - 1], 0.1);
}

export function next_difficulty(d: number, ratingStr: string): number {
  const g = ratings[ratingStr];
  const delta_d = -w[6] * (g - 3);
  const next_d = d + linear_damping(delta_d, d);
  return clamp(mean_reversion(init_difficulty('easy'), next_d), 1, 10);
}

export function next_recall_stability(
  d: number,
  s: number,
  r: number,
  ratingStr: string
): number {
  const g = ratings[ratingStr];
  const hard_penalty = g === 2 ? w[15] : 1;
  const easy_bound = g === 4 ? w[16] : 1;
  return roundTo(
    clamp(
      s *
        (1 +
          Math.exp(w[8]) *
            (11 - d) *
            Math.pow(s, -w[9]) *
            (Math.exp((1 - r) * w[10]) - 1) *
            hard_penalty *
            easy_bound),
      S_MIN,
      36500.0
    ),
    8
  );
}

export function next_forget_stability(d: number, s: number, r: number): number {
  const s_after_fail = roundTo(
    clamp(
      w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]),
      S_MIN,
      36500.0
    ),
    8
  );
  const next_s_min = s / Math.exp(w[17] * w[18]);
  return clamp(roundTo(next_s_min, 8), S_MIN, s_after_fail);
}

export function next_short_term_stability(s: number, ratingStr: string): number {
  const g = ratings[ratingStr];
  const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]));
  const maskedSinc = g >= 2 ? Math.max(sinc, 1.0) : sinc;
  return roundTo(clamp(s * maskedSinc, S_MIN, 36500.0), 8);
}

export const getEffectiveLapses = (card?: Card | null): number => {
  if (!card) return 0;
  const state = card.state !== undefined ? card.state : card.reviews > 0 ? 2 : 0;
  if (state === 0 || state === 1) return 0;
  return card.reviewLapses || 0;
};

export const getCardRatingBreakdown = (card?: Card | null): ReviewRatingCounts => {
  const empty: ReviewRatingCounts = { again: 0, hard: 0, good: 0, easy: 0 };
  if (!card || !card.reviewRatingCounts) return empty;

  const state = card.state !== undefined ? card.state : card.reviews > 0 ? 2 : 0;
  if (state === 0 || state === 1) return empty;

  return {
    again: card.reviewRatingCounts.again || 0,
    hard: card.reviewRatingCounts.hard || 0,
    good: card.reviewRatingCounts.good || 0,
    easy: card.reviewRatingCounts.easy || 0,
  };
};

export const isCardBuried = (card?: Card | null): boolean => {
  return Boolean(card?.buriedUntil && Date.now() < card.buriedUntil);
};

export const isCardLeech = (card?: Card | null): boolean => {
  if (!card) return false;
  const state = card.state !== undefined ? card.state : card.reviews > 0 ? 2 : 0;
  // Cartões Novos (0) ou em Aprendizagem Inicial (1) nunca são Sanguessugas
  if (state === 0 || state === 1) return false;
  return getEffectiveLapses(card) >= 4;
};

export const isCardUnlearned = (card?: Card | null): boolean => {
  if (!card || card.isSuspended) return false;
  const state = card.state !== undefined ? card.state : card.reviews > 0 ? 2 : 0;
  return state === 0 || state === 1 || state === 3 || !card.reviews || (card.interval || 0) < 1;
};

export const checkCardDue = (card?: Card | null): boolean => {
  if (!card || card.isIgnored || card.isSuspended) return false;
  if (isCardBuried(card)) return false;
  if (!card.dueDate) return true;
  const now = Date.now();

  if (card.interval >= 1) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return card.dueDate <= endOfToday.getTime();
  }

  return card.dueDate <= now;
};

export const formatInterval = (days?: number): string => {
  if (!days) return '<1m';
  const minutes = Math.round(days * 1440);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(days * 24);
  if (hours < 24) return `${hours}h`;
  const d = Math.round(days);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${Math.round(d / 365)}a`;
};

export const calculateNextReview = (
  card: Card,
  qualityUI: number,
  reqRetention = requestRetention
): Card => {
  const RATING_STRINGS = ['again', 'hard', 'good', 'easy'] as const;
  const ratingStr = RATING_STRINGS[qualityUI];
  const now = Date.now();
  const fuzz_factor = generate_fuzz_factor(card);

  let state: CardState =
    card.state !== undefined ? card.state : card.reviews > 0 ? 2 : 0;
  const prevState = state;
  let stepIndex = card.stepIndex !== undefined ? card.stepIndex : 0;
  let difficulty = card.difficulty;
  let stability = card.stability;
  const last_review = card.last_review || now;

  const elapsed_days = Math.max((now - last_review) / 86400000, 0);
  let interval = 0;
  let isMinutes = false;

  if ((stability == null || difficulty == null || stability < S_MIN) && state !== 0) {
    stability = init_stability('good');
    difficulty = clamp(init_difficulty('good'), 1, 10);
  }

  if (state === 0) {
    stability = init_stability(ratingStr);
    difficulty = clamp(init_difficulty(ratingStr), 1, 10);

    if (ratingStr === 'again') {
      state = 1;
      stepIndex = 0;
      interval = LEARNING_STEPS[0];
      isMinutes = true;
    } else if (ratingStr === 'hard') {
      state = 1;
      stepIndex = 0;
      interval = (LEARNING_STEPS[0] + LEARNING_STEPS[1]) / 2;
      isMinutes = true;
    } else if (ratingStr === 'good') {
      state = 1;
      stepIndex = 1;
      interval = LEARNING_STEPS[1];
      isMinutes = true;
    } else if (ratingStr === 'easy') {
      state = 2;
      const good_ivl = next_interval(init_stability('good'), fuzz_factor, reqRetention);
      interval = Math.max(next_interval(stability, fuzz_factor, reqRetention), good_ivl + 1);
    }
  } else if (state === 1 || state === 3) {
    const last_s = stability!;
    const last_d = difficulty!;

    difficulty = next_difficulty(last_d, ratingStr);
    stability = next_short_term_stability(last_s, ratingStr);

    if (ratingStr === 'again') {
      stepIndex = 0;
      interval = LEARNING_STEPS[0];
      isMinutes = true;
    } else if (ratingStr === 'hard') {
      interval = LEARNING_STEPS[stepIndex] || LEARNING_STEPS[0];
      isMinutes = true;
    } else if (ratingStr === 'good') {
      stepIndex++;
      if (stepIndex < LEARNING_STEPS.length) {
        interval = LEARNING_STEPS[stepIndex];
        isMinutes = true;
      } else {
        state = 2;
        interval = next_interval(stability, fuzz_factor, reqRetention);
      }
    } else if (ratingStr === 'easy') {
      state = 2;
      const good_s = next_short_term_stability(last_s, 'good');
      const good_ivl = next_interval(good_s, fuzz_factor, reqRetention);
      interval = Math.max(next_interval(stability, fuzz_factor, reqRetention), good_ivl + 1);
    }
  } else if (state === 2) {
    const retrievability = forgetting_curve(elapsed_days, stability);
    const last_s = stability!;
    const last_d = difficulty!;

    if (ratingStr === 'again') {
      difficulty = next_difficulty(last_d, 'again');
      stability = next_forget_stability(last_d, last_s, retrievability);
      state = 3;
      stepIndex = 0;
      interval = LEARNING_STEPS[0];
      isMinutes = true;
    } else {
      difficulty = next_difficulty(last_d, ratingStr);
      stability = next_recall_stability(last_d, last_s, retrievability, ratingStr);

      let hard_ivl = next_interval(
        next_recall_stability(last_d, last_s, retrievability, 'hard'),
        fuzz_factor,
        reqRetention
      );
      let good_ivl = next_interval(
        next_recall_stability(last_d, last_s, retrievability, 'good'),
        fuzz_factor,
        reqRetention
      );
      let easy_ivl = next_interval(
        next_recall_stability(last_d, last_s, retrievability, 'easy'),
        fuzz_factor,
        reqRetention
      );

      hard_ivl = Math.min(hard_ivl, good_ivl);
      good_ivl = Math.max(good_ivl, hard_ivl + 1);
      easy_ivl = Math.max(easy_ivl, good_ivl + 1);

      if (ratingStr === 'hard') interval = hard_ivl;
      else if (ratingStr === 'good') interval = good_ivl;
      else if (ratingStr === 'easy') interval = easy_ivl;
    }
  }

  const intervalInDays = isMinutes ? interval / 1440 : interval;
  const nextDue = isMinutes ? now + interval * 60000 : now + interval * 86400000;

  // Lapsos e Retenção Real são contabilizados exclusivamente quando o cartão já estava graduado (prevState === 2)
  const baseLapses = getEffectiveLapses(card);
  const reviewLapses =
    prevState === 2 && ratingStr === 'again' ? baseLapses + 1 : baseLapses;

  const prevReviewCounts: ReviewRatingCounts = card.reviewRatingCounts || {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  };
  const reviewRatingCounts: ReviewRatingCounts =
    prevState === 2
      ? {
          ...prevReviewCounts,
          [ratingStr]: (prevReviewCounts[ratingStr] || 0) + 1,
        }
      : prevReviewCounts;

  const learningReviews =
    prevState !== 2 ? (card.learningReviews || 0) + 1 : card.learningReviews || 0;

  return {
    ...card,
    state,
    difficulty,
    stability,
    stepIndex,
    lapses: reviewLapses,
    reviewLapses,
    reviewRatingCounts,
    learningReviews,
    buriedUntil: null,
    interval: intervalInDays,
    last_review: now,
    dueDate: nextDue,
    reviews: (card.reviews || 0) + 1,
  };
};