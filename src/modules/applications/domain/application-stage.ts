export const APPLICATION_STAGES = [
  'applied',
  'screening',
  'interview',
  'technical',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];
