import {
  addMonthsIso,
  calculateAnnuityPayment,
  type TrancheMortgageResult,
} from "./calculate-tranche-mortgage.ts";
import type { RefinanceCalculation } from "./refinance-types.ts";

export type { RefinanceCalculation } from "./refinance-types.ts";

export type RefinanceInput = {
  enabled: boolean;
  refinanceAfterMonths: number;
  assumedAnnualRate: number;
  transactionDate: string;
  mortgage: TrancheMortgageResult;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function calculateRefinance({
  enabled,
  refinanceAfterMonths,
  assumedAnnualRate,
  transactionDate,
  mortgage,
}: RefinanceInput): RefinanceCalculation {
  const safeMonths = Math.max(0, Math.round(refinanceAfterMonths));
  const safeRate = Math.max(0, assumedAnnualRate);
  const remainingTermMonths = Math.max(0, mortgage.termMonths - safeMonths);

  if (!enabled) {
    return {
      enabled: false,
      refinanceAfterMonths: safeMonths,
      refinanceDate: null,
      assumedAnnualRate: safeRate,
      outstandingPrincipal: null,
      remainingTermMonths,
      paymentBeforeRefinance: null,
      paymentAfterRefinance: null,
      isValid: true,
      validationMessages: [],
    };
  }

  const validationMessages: string[] = [];
  if (safeMonths <= 0) {
    validationMessages.push("Срок до рефинансирования должен быть больше 0 месяцев.");
  }
  if (safeMonths >= mortgage.termMonths) {
    validationMessages.push("Рефинансирование должно произойти до окончания кредита.");
  }
  if (assumedAnnualRate < 0) {
    validationMessages.push("Ставка после рефинансирования не может быть отрицательной.");
  }

  const refinanceDate = addMonthsIso(transactionDate, safeMonths);
  const balanceRow = mortgage.schedule.findLast((payment) => payment.date <= refinanceDate);
  const previousPayment = mortgage.schedule.findLast((payment) => payment.date < refinanceDate);

  if (!balanceRow) {
    validationMessages.push("Не удалось определить остаток долга на дату рефинансирования.");
  }

  const outstandingPrincipal = balanceRow?.remainingBalance ?? null;
  const isValid = validationMessages.length === 0 && outstandingPrincipal !== null;
  const paymentAfterRefinance = isValid
    ? calculateAnnuityPayment(outstandingPrincipal, safeRate, remainingTermMonths)
    : null;

  return {
    enabled: true,
    refinanceAfterMonths: safeMonths,
    refinanceDate,
    assumedAnnualRate: safeRate,
    outstandingPrincipal: outstandingPrincipal === null ? null : roundMoney(outstandingPrincipal),
    remainingTermMonths,
    paymentBeforeRefinance: previousPayment ? Math.floor(previousPayment.payment) : null,
    paymentAfterRefinance,
    isValid,
    validationMessages,
  };
}
