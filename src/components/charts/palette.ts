/**
 * Categorical chart palette (validated order — assign slots in sequence by entity, never cycle).
 * Mirrors --color-series-* in globals.css.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"] as const;

/** Ordinal ramp (blue) for ordered buckets like ranking positions: dark = better. */
export const POSITION_RAMP = ["#104281", "#256abf", "#5598e7", "#86b6ef", "#b7d3f6"] as const;

export const CHART = {
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  muted: "#898781",
  ink: "#14171f",
  ink2: "#4b5160",
  surface: "#ffffff",
};

export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" } as const;
