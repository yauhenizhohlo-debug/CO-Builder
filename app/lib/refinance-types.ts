export type RefinanceCalculation = {
  enabled: boolean;
  refinanceAfterMonths: number;
  refinanceDate: string | null;
  assumedAnnualRate: number;
  outstandingPrincipal: number | null;
  remainingTermMonths: number;
  paymentBeforeRefinance: number | null;
  paymentAfterRefinance: number | null;
  isValid: boolean;
  validationMessages: string[];
};
