const unitSnapshot = {
  unitId: "CBS-B1-704",
  unitNumber: "704",
  floor: 7,
  area: 38,
  price: 2_299_000_000,
  pricePerSqm: 60_500_000,
  status: "AVAILABLE",
  viewType: "Море",
  capturedAt: "2026-08-10T09:00:00.000Z",
};

const common = {
  projectId: "cosmos-black-sea",
  unitId: "CBS-B1-704",
  unitSnapshot,
  investment: null,
  schemaVersion: 1,
  paymentEngineVersion: "1.0.0",
  investmentEngineVersion: "1.0.0",
  createdAt: "2026-08-10T09:00:00.000Z",
  expiresAt: null,
};

export const mortgageContext = {
  data: {
    ...common,
    id: "11111111-1111-4111-8111-111111111111",
    payment: {
      mode: "TRANCHE_MORTGAGE",
      inputs: { mode: "TRANCHE_MORTGAGE", startDate: "2026-08-15", downPaymentPercent: 30, annualRatePercent: "19.2", termYears: 30, trancheCount: 2 },
      result: {
        purchasePrice: 2_299_000_000,
        downPayment: 689_700_000,
        loanAmount: 1_609_300_000,
        annualRatePercent: "19.2",
        loanTermMonths: 360,
        trancheTotal: 1_609_300_000,
        difference: 0,
        isBalanced: true,
        validationMessages: [],
        stages: [
          { trancheId: "tranche-1", trancheNumber: 1, trancheAmount: 482_790_000, issueDate: "2026-08-15", paymentCount: 24, outstandingAfterIssue: 482_790_000, monthlyPayment: 7_872_700, balanceBeforeNextTranche: 478_850_000 },
          { trancheId: "tranche-2", trancheNumber: 2, trancheAmount: 1_126_510_000, issueDate: "2028-08-15", paymentCount: 336, outstandingAfterIssue: 1_605_360_000, monthlyPayment: 26_242_600, balanceBeforeNextTranche: 0 },
        ],
        schedule: [
          { date: "2026-08-15", payment: 7_872_700, interest: 7_872_700, principal: 0, remainingBalance: 482_790_000, activeTranche: 1, days: 31 },
        ],
        remainingBalance: 0,
        totalInterest: 5_000_000_000,
        totalPayments: 7_299_000_000,
      },
    },
  },
  liveCheck: { priceChanged: true, statusChanged: true, currentPrice: 2_350_000_000, currentStatus: "RESERVED" },
};

export const installmentContext = {
  data: {
    ...common,
    id: "22222222-2222-4222-8222-222222222222",
    payment: {
      mode: "INSTALLMENT",
      inputs: { mode: "INSTALLMENT", startDate: "2026-08-10", programId: "cosmos-20" },
      result: {
        purchasePrice: 2_299_000_000,
        discountedPrice: 2_253_020_000,
        discountAmount: 45_980_000,
        downPayment: 450_604_000,
        downPaymentPercent: "20",
        financedAmount: 1_802_416_000,
        monthlyPayment: 10_000_000,
        requiredEscrowAmount: 1_126_510_000,
        requiredEscrowDate: "2027-06-30",
        keyTopUpPayment: 575_906_000,
        finalPayment: 1_016_510_000,
        totalScheduledPayments: 2_253_020_000,
        remainingBalance: 0,
        schedule: [
          { id: "down", date: "2026-08-10", type: "DOWN_PAYMENT", label: "Первоначальный взнос", amount: 450_604_000, cumulativeAmount: 450_604_000, balanceAfter: 1_802_416_000 },
          { id: "monthly-1", date: "2026-09-10", type: "MONTHLY", label: "Регулярный платёж 1/1", amount: 10_000_000, cumulativeAmount: 460_604_000, balanceAfter: 1_792_416_000 },
          { id: "top-up", date: "2027-06-30", type: "INTERMEDIATE", label: "Довнос до 50%", amount: 575_906_000, cumulativeAmount: 1_036_510_000, balanceAfter: 1_216_510_000 },
          { id: "monthly-2", date: "2027-07-30", type: "MONTHLY", label: "Платёж второго периода 1/1", amount: 10_000_000, cumulativeAmount: 1_046_510_000, balanceAfter: 1_206_510_000 },
          { id: "final", date: "2028-06-30", type: "FINAL", label: "Финальный платёж", amount: 1_016_510_000, cumulativeAmount: 2_063_020_000, balanceAfter: 190_000_000 },
        ],
      },
    },
  },
  liveCheck: { priceChanged: false, statusChanged: false, currentPrice: 2_299_000_000, currentStatus: "AVAILABLE" },
};
