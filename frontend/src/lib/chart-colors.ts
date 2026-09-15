// Validated categorical palette (fixed order — never cycle/reassign), from the dataviz
// skill's reference instance. Passes CVD + contrast checks in this exact order.
export const CATEGORICAL_COLORS = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const;

// Sequential blue ramp, light -> dark, for ordinal/magnitude encodings (e.g. aging tiers
// where "darker" should read as "more overdue / worse").
export const SEQUENTIAL_BLUE_ORDINAL = [
  '#86b6ef', // step 250
  '#5598e7', // step 350
  '#2a78d6', // step 450
  '#1c5cab', // step 550
  '#104281', // step 650
] as const;

export const CHART_INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  gridline: '#e1e0d9',
  baseline: '#c3c2b7',
} as const;
