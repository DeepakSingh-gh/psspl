export type AiAnswerPresentation = {
  title: string;
  summary: string;
  period: string;
  metrics: Array<{ label: string; value: string }>;
  sections: Array<{ title: string; points: string[] }>;
  missing: string[];
  update: string;
  note: string;
};
