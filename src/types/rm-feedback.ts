export interface RmFeedbackSummary {
  id: string;
  reportDate: string;
  asOf: string;
  financialYear: string;
  rm: { name: string; sourceName: string; rmCode: string; operatingFrom: string; businessRegistrationForm: string | null; registrationCodes: string[] };
  annual: { currentYearTarget: number; currentYearTargetTillMonth: number; currentYearActual: number; currentYearPct: number; lastYearTarget: number; lastYearTargetTillMonth: number; lastYearActual: number; lastYearPct: number };
  source: { kind: string; fileName: string; sha256: string; page: number };
}
export interface RmFeedbackSnapshot extends RmFeedbackSummary {
  units: string;
  monthlyMetrics: Array<{ month: string; period: string; target: number | null; achieved: number | null; pct: number | null; variation: number | null }>;
  monthlyTotals: { target: number | null; achieved: number | null; pct: number | null; variation: number | null };
  weeklySummary: Array<{ weekLabel: string; targetTotal: number | null; achievedTotal: number | null; targets: Array<number | null>; achieved: Array<number | null> }>;
  previousYearPerformance: Array<{ month: string; target: number | null; actual: number | null }>;
  previousYearTotals: { target: number | null; actual: number | null };
  territoryExpansion: { targetExpansionCities: string; visitsMade: string; newDealersText: string };
  teamSourceText: string;
  teamEntries: Array<{ name: string; citiesCovered: string }>;
  thrustTotalLakh: number | null;
  territoriesSourceText: string;
  technicalService: { center: string; executive: string };
  thrustProductGroups: Array<{ productsText: string; achievedText: string }>;
  specialAchievementsNotes: string;
  sourceWarnings: string[];
  sourceText: string;
}
