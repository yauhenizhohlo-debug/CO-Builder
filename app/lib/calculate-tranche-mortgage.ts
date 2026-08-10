export type MortgageTrancheInput = {
  id: string;
  amount: number;
  issueMonth: number;
};

export type TrancheMortgageInput = {
  price: number;
  initialPayment: number;
  annualRate: number;
  termMonths: number;
  transactionDate: string;
  tranches: MortgageTrancheInput[];
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
  totalInterest: number;
  totalPayments: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function addMonthsIso(dateString: string, months: number) {
  const source = new Date(`${dateString}T00:00:00Z`);
  const targetYear = source.getUTCFullYear();
  const targetMonth = source.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(source.getUTCDate(), lastDay);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay))
    .toISOString()
    .slice(0, 10);
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

function applyPayments(
  principal: number,
  monthlyPayment: number,
  annualRate: number,
  paymentCount: number,
  closeAtEnd = false,
) {
  const monthlyRate = Math.max(0, annualRate) / 100 / 12;
  let balance = principal;
  let paid = 0;

  for (let index = 0; index < paymentCount && balance > 0; index += 1) {
    const interest = balance * monthlyRate;
    const actualPayment = closeAtEnd && index === paymentCount - 1
      ? balance + interest
      : Math.min(monthlyPayment, balance + interest);
    balance = Math.max(0, balance + interest - actualPayment);
    paid += actualPayment;
  }

  return { balance: roundMoney(balance), paid: roundMoney(paid) };
}

export function calculateTrancheMortgage({
  price,
  initialPayment,
  annualRate,
  termMonths,
  transactionDate,
  tranches,
}: TrancheMortgageInput): TrancheMortgageResult {
  const safePrice = Math.max(0, price);
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
  let totalLoanPayments = 0;
  const stages: MortgageStage[] = [];

  normalizedTranches.forEach((tranche, index) => {
    const remainingTermMonths = Math.max(1, safeTermMonths - tranche.issueMonth);
    outstanding = roundMoney(outstanding + tranche.amount);
    const monthlyPayment = calculateAnnuityPayment(
      outstanding,
      safeRate,
      remainingTermMonths,
    );
    const nextIssueMonth = normalizedTranches[index + 1]?.issueMonth ?? safeTermMonths;
    const paymentCount = Math.max(
      0,
      Math.min(nextIssueMonth, safeTermMonths) - tranche.issueMonth,
    );
    const period = applyPayments(
      outstanding,
      monthlyPayment,
      safeRate,
      paymentCount,
      index === normalizedTranches.length - 1,
    );

    stages.push({
      trancheId: tranche.id,
      trancheNumber: index + 1,
      trancheAmount: roundMoney(tranche.amount),
      issueMonth: tranche.issueMonth,
      issueDate: addMonthsIso(transactionDate, tranche.issueMonth),
      startPaymentMonth: tranche.issueMonth + 1,
      endPaymentMonth: tranche.issueMonth + paymentCount,
      paymentCount,
      outstandingAfterIssue: outstanding,
      remainingTermMonths,
      monthlyPayment,
      balanceBeforeNextTranche: period.balance,
    });

    outstanding = period.balance;
    totalLoanPayments += period.paid;
  });

  const totalPayments = roundMoney(safeInitialPayment + totalLoanPayments);

  return {
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
    totalInterest: roundMoney(Math.max(0, totalLoanPayments - loanAmount)),
    totalPayments,
  };
}
