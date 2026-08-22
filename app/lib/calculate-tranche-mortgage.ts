import { calculateDiscount, type DiscountInput } from "./calculate-discount.ts";

export type MortgageTrancheInput = {
  id: string;
  amount: number;
  issueMonth: number;
};

export type TrancheMortgageInput = {
  price: number;
  discount?: DiscountInput;
  initialPayment: number;
  annualRate: number;
  termMonths: number;
  transactionDate: string;
  tranches: MortgageTrancheInput[];
};

export type MortgagePayment = {
  date: string;
  payment: number;
  interest: number;
  principal: number;
  remainingBalance: number;
  activeTranche: number;
};

export type MortgageStage = {
  trancheId: string;
  trancheNumber: number;
  trancheAmount: number;
  issueMonth: number;
  issueDate: string;
  startPaymentMonth: number;
  endPaymentMonth: number;
  paymentCount: number;
  outstandingAfterIssue: number;
  remainingTermMonths: number;
  monthlyPayment: number;
  balanceBeforeNextTranche: number;
};

export type TrancheMortgageResult = {
  basePrice: number;
  discountPercent: number;
  discountAmount: number;
  price: number;
  initialPayment: number;
  initialPaymentPercent: number;
  loanAmount: number;
  annualRate: number;
  termMonths: number;
  termYears: number;
  trancheTotal: number;
  difference: number;
  isBalanced: boolean;
  validationMessages: string[];
  stages: MortgageStage[];
  schedule: MortgagePayment[];
  remainingBalance: number;
  totalInterest: number;
  totalPayments: number;
};

const DAY_COUNT_BASIS = 365;
const STAGE_PAYMENT_DAYS = 31;
const MILLISECONDS_PER_DAY = 86_400_000;
const roundMoney = (value: number) => Math.round(value * 100) / 100;

function parseIsoDate(dateString: string) {
  return new Date(`${dateString}T00:00:00Z`);
}

export function addMonthsIso(dateString: string, months: number) {
  const source = parseIsoDate(dateString);
  const targetYear = source.getUTCFullYear();
  const targetMonth = source.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(source.getUTCDate(), lastDay);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay))
    .toISOString()
    .slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (parseIsoDate(to).getTime() - parseIsoDate(from).getTime())
      / MILLISECONDS_PER_DAY,
  );
}

/**
 * Contractual payment for a tranche stage observed in the Domclick schedule.
 * It is the 31-day interest amount on all nominally issued tranches, not an
 * annuity payment. Keep full precision: the bank schedule displays whole
 * rubles while its balance arithmetic retains fractions of a ruble.
 */
export function calculateStagePayment(
  issuedCreditAmount: number,
  annualRate: number,
) {
  return Math.max(0, issuedCreditAmount)
    * Math.max(0, annualRate) / 100
    * STAGE_PAYMENT_DAYS / DAY_COUNT_BASIS;
}

export function calculateAnnuityPayment(
  principal: number,
  annualRate: number,
  termMonths: number,
) {
  if (principal <= 0 || termMonths <= 0) return 0;
  const monthlyRate = Math.max(0, annualRate) / 100 / 12;
  if (monthlyRate === 0) return roundMoney(principal / termMonths);

  return roundMoney(
    principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths)),
  );
}

export function calculateTrancheMortgage({
  price,
  discount,
  initialPayment,
  annualRate,
  termMonths,
  transactionDate,
  tranches,
}: TrancheMortgageInput): TrancheMortgageResult {
  const safeBasePrice = Math.max(0, price);
  const discountResult = calculateDiscount(
    safeBasePrice,
    discount ?? { mode: "percent", value: 0 },
  );
  const safePrice = discountResult.discountedPrice;
  const safeInitialPayment = Math.min(safePrice, Math.max(0, initialPayment));
  const safeRate = Math.max(0, annualRate);
  const safeTermMonths = Math.max(1, Math.round(termMonths));
  const loanAmount = roundMoney(safePrice - safeInitialPayment);
  const normalizedTranches = tranches
    .map((tranche) => ({
      ...tranche,
      amount: Math.max(0, tranche.amount),
      issueMonth: Math.max(0, Math.round(tranche.issueMonth)),
    }))
    .sort((left, right) => left.issueMonth - right.issueMonth);
  const trancheTotal = roundMoney(
    normalizedTranches.reduce((sum, tranche) => sum + tranche.amount, 0),
  );
  const difference = roundMoney(trancheTotal - loanAmount);
  const validationMessages: string[] = [];

  if (safeRate <= 0) validationMessages.push("Укажите процентную ставку больше 0%.");
  if (tranches.length === 0) validationMessages.push("Добавьте хотя бы один транш.");
  if (Math.abs(difference) > 1) {
    validationMessages.push(
      difference > 0
        ? `Сумма траншей превышает сумму кредита на ${Math.abs(difference).toLocaleString("ru-RU")} ₽.`
        : `Распределите по траншам ещё ${Math.abs(difference).toLocaleString("ru-RU")} ₽.`,
    );
  }
  if (normalizedTranches.some((tranche) => tranche.issueMonth >= safeTermMonths)) {
    validationMessages.push("Каждый транш должен быть выдан до окончания срока кредита.");
  }
  if (normalizedTranches.some((tranche, index) => index > 0 && tranche.issueMonth <= normalizedTranches[index - 1].issueMonth)) {
    validationMessages.push("Срок выдачи каждого следующего транша должен быть больше предыдущего.");
  }

  let outstanding = 0;
  let issuedCreditAmount = 0;
  let activeTranche = 0;
  let stagePayment = 0;
  let totalLoanPayments = 0;
  let totalInterest = 0;
  const schedule: MortgagePayment[] = [];
  const stageState = normalizedTranches.map(() => ({
    outstandingAfterIssue: 0,
    monthlyPayment: 0,
  }));

  for (let month = 0; month < safeTermMonths; month += 1) {
    while (
      activeTranche < normalizedTranches.length
      && normalizedTranches[activeTranche].issueMonth === month
    ) {
      const tranche = normalizedTranches[activeTranche];
      outstanding += tranche.amount;
      issuedCreditAmount += tranche.amount;
      stagePayment = calculateStagePayment(issuedCreditAmount, safeRate);
      stageState[activeTranche] = {
        outstandingAfterIssue: outstanding,
        monthlyPayment: stagePayment,
      };
      activeTranche += 1;
    }

    if (activeTranche === 0 || outstanding <= 0) continue;

    const date = addMonthsIso(transactionDate, month);
    // The public schedule contains an initial contractual row on the issue
    // date. Its interest equals the 31-day stage payment. Later rows use the
    // actual interval between monthly payment dates on an Actual/365 basis.
    const daysInPeriod = month === 0
      ? STAGE_PAYMENT_DAYS
      : daysBetween(addMonthsIso(transactionDate, month - 1), date);
    const calculatedInterest = outstanding * safeRate / 100
      * daysInPeriod / DAY_COUNT_BASIS;
    // Domclick's supplied rows show no capitalization when a long period's
    // interest reaches the fixed stage payment. Unconfirmed negative
    // amortization is therefore explicitly prevented.
    const interest = Math.min(stagePayment, calculatedInterest);
    const principal = Math.min(outstanding, Math.max(0, stagePayment - interest));
    const payment = Math.min(stagePayment, outstanding + interest);

    outstanding = Math.max(0, outstanding - principal);
    totalLoanPayments += payment;
    totalInterest += interest;
    schedule.push({
      date,
      payment: roundMoney(payment),
      interest: roundMoney(interest),
      principal: roundMoney(principal),
      remainingBalance: roundMoney(outstanding),
      activeTranche,
    });
  }

  const stages = normalizedTranches.map((tranche, index): MortgageStage => {
    const nextIssueMonth = normalizedTranches[index + 1]?.issueMonth ?? safeTermMonths;
    const paymentCount = Math.max(0, nextIssueMonth - tranche.issueMonth);
    const lastStagePayment = schedule.findLast(
      (payment) => payment.activeTranche === index + 1,
    );

    return {
      trancheId: tranche.id,
      trancheNumber: index + 1,
      trancheAmount: roundMoney(tranche.amount),
      issueMonth: tranche.issueMonth,
      issueDate: addMonthsIso(transactionDate, tranche.issueMonth),
      startPaymentMonth: tranche.issueMonth + 1,
      endPaymentMonth: tranche.issueMonth + paymentCount,
      paymentCount,
      outstandingAfterIssue: roundMoney(stageState[index].outstandingAfterIssue),
      remainingTermMonths: Math.max(1, safeTermMonths - tranche.issueMonth),
      // Client-facing fixed stage payment follows the bank schedule: kopecks
      // are discarded, while the schedule itself keeps full precision.
      monthlyPayment: Math.floor(stageState[index].monthlyPayment),
      balanceBeforeNextTranche: lastStagePayment?.remainingBalance
        ?? roundMoney(stageState[index].outstandingAfterIssue),
    };
  });

  return {
    basePrice: safeBasePrice,
    discountPercent: discountResult.discountPercent,
    discountAmount: discountResult.discountAmount,
    price: safePrice,
    initialPayment: safeInitialPayment,
    initialPaymentPercent: safePrice > 0 ? safeInitialPayment / safePrice * 100 : 0,
    loanAmount,
    annualRate: safeRate,
    termMonths: safeTermMonths,
    termYears: safeTermMonths / 12,
    trancheTotal,
    difference,
    isBalanced: validationMessages.length === 0,
    validationMessages,
    stages,
    schedule,
    remainingBalance: roundMoney(outstanding),
    totalInterest: roundMoney(totalInterest),
    totalPayments: roundMoney(safeInitialPayment + totalLoanPayments),
  };
}
