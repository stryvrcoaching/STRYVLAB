export interface Question {
  id: string;
  text: string;
  dimension: string;
  options: string[];
}

export const DIMENSION_WEIGHTS = {
  dimension1: 1.0,
  dimension2: 0.8,
  dimension3: 0.6,
} as const;