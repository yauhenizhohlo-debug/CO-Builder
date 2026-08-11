import type {
  ImportedInstallmentResult,
  ImportedTrancheMortgageResult,
  ProposalContext,
} from "@cosmos/proposal-contract";
import { rooms, type Room } from "../data/rooms.ts";
import type { PaymentScheduleItem } from "./build-payment-schedule.ts";
import type { InstallmentResult } from "./calculate-installment.ts";
import type { TrancheMortgageResult } from "./calculate-tranche-mortgage.ts";
import type { ProposalData } from "../components/proposal-context.tsx";
import { moneyToRubles } from "./proposal-money.ts";

const rubles = (value: Parameters<typeof moneyToRubles>[0]) => moneyToRubles(value) ?? 0;
const normalizeRoomNumber = (value: string) => value.replace(/^№/, "");

function monthsBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + end.getUTCMonth() - start.getUTCMonth();
}

export function resolveSnapshotRoom(context: ProposalContext): Room {
  const snapshot = context.unitSnapshot;
  const assets = rooms.find(
    (room) => normalizeRoomNumber(room.roomNumber) === normalizeRoomNumber(snapshot.unitNumber),
  );

  return {
    roomNumber: snapshot.unitNumber,
    floor: snapshot.floor,
    area: snapshot.area ?? 0,
    price: snapshot.price,
    pricePerSqm: snapshot.pricePerSqm ?? 0,
    layoutId: assets?.layoutId ?? "",
    renderSetId: assets?.renderSetId ?? "",
  };
}

function mapInstallmentResult(result: ImportedInstallmentResult): {
  installment: InstallmentResult;
  schedule: PaymentScheduleItem[];
} {
  const topUpIndex = result.schedule.findIndex((payment) => payment.type === "INTERMEDIATE");
  const firstPeriodRows = result.schedule.filter(
    (payment, index) => payment.type === "MONTHLY" && (topUpIndex < 0 || index < topUpIndex),
  );
  const secondPeriodRows = result.schedule.filter(
    (payment, index) => payment.type === "MONTHLY" && topUpIndex >= 0 && index > topUpIndex,
  );
  const listPrice = rubles(result.purchasePrice);
  const discountedPrice = rubles(result.discountedPrice);
  const discountAmount = rubles(result.discountAmount);
  const typeMap: Record<typeof result.schedule[number]["type"], PaymentScheduleItem["type"]> = {
    DOWN_PAYMENT: "initial",
    MONTHLY: "regular-first",
    INTERMEDIATE: "top-up",
    FINAL: "final",
  };

  return {
    installment: {
      listPrice,
      discountPercent: listPrice > 0 ? discountAmount / listPrice * 100 : 0,
      discountAmount,
      discountedPrice,
      initialPaymentPercent: Number(result.downPaymentPercent),
      initialPayment: rubles(result.downPayment),
      monthlyPayment: rubles(result.monthlyPayment),
      firstPeriodPaymentCount: firstPeriodRows.length,
      paymentsBeforeTopUp: firstPeriodRows.reduce((sum, payment) => sum + rubles(payment.amount), 0),
      topUpPayment: rubles(result.keyTopUpPayment),
      targetEscrow: rubles(result.requiredEscrowAmount),
      secondPeriodPaymentCount: secondPeriodRows.length,
      secondPeriodPayments: secondPeriodRows.reduce((sum, payment) => sum + rubles(payment.amount), 0),
      finalPayment: rubles(result.finalPayment),
    },
    schedule: result.schedule.map((payment, index) => ({
      id: payment.id,
      date: payment.date,
      type: payment.type === "MONTHLY" && topUpIndex >= 0 && index > topUpIndex
        ? "regular-second"
        : typeMap[payment.type],
      label: payment.label,
      amount: rubles(payment.amount),
      cumulativeAmount: rubles(payment.cumulativeAmount),
    })),
  };
}

function mapMortgageResult(
  context: ProposalContext & { payment: Extract<ProposalContext["payment"], { mode: "TRANCHE_MORTGAGE" }> },
  result: ImportedTrancheMortgageResult,
): TrancheMortgageResult {
  const transactionDate = context.payment.inputs.startDate;
  const price = rubles(result.purchasePrice);
  const initialPayment = rubles(result.downPayment);

  return {
    price,
    initialPayment,
    initialPaymentPercent: price > 0 ? initialPayment / price * 100 : 0,
    loanAmount: rubles(result.loanAmount),
    annualRate: Number(result.annualRatePercent),
    termMonths: result.loanTermMonths,
    termYears: result.loanTermMonths / 12,
    trancheTotal: rubles(result.trancheTotal),
    difference: rubles(result.difference),
    isBalanced: result.isBalanced,
    validationMessages: result.validationMessages,
    stages: result.stages.map((stage) => {
      const issueMonth = monthsBetween(transactionDate, stage.issueDate);
      return {
        trancheId: stage.trancheId,
        trancheNumber: stage.trancheNumber,
        trancheAmount: rubles(stage.trancheAmount),
        issueMonth,
        issueDate: stage.issueDate,
        startPaymentMonth: issueMonth + 1,
        endPaymentMonth: issueMonth + stage.paymentCount,
        paymentCount: stage.paymentCount,
        outstandingAfterIssue: rubles(stage.outstandingAfterIssue),
        remainingTermMonths: Math.max(1, result.loanTermMonths - issueMonth),
        monthlyPayment: rubles(stage.monthlyPayment),
        balanceBeforeNextTranche: rubles(stage.balanceBeforeNextTranche),
      };
    }),
    schedule: result.schedule.map((payment) => ({
      date: payment.date,
      payment: rubles(payment.payment),
      interest: rubles(payment.interest),
      principal: rubles(payment.principal),
      remainingBalance: rubles(payment.remainingBalance),
      activeTranche: payment.activeTranche,
    })),
    remainingBalance: rubles(result.remainingBalance),
    totalInterest: rubles(result.totalInterest),
    totalPayments: rubles(result.totalPayments),
  };
}

export function mapImportedProposal(context: ProposalContext): ProposalData {
  const room = resolveSnapshotRoom(context);
  if (context.payment.mode === "INSTALLMENT") {
    const mapped = mapInstallmentResult(context.payment.result);
    return { room, financingType: "installment", ...mapped };
  }
  if (context.payment.mode === "TRANCHE_MORTGAGE") {
    return {
      room,
      financingType: "mortgage",
      mortgage: mapMortgageResult(
        context as ProposalContext & { payment: Extract<ProposalContext["payment"], { mode: "TRANCHE_MORTGAGE" }> },
        context.payment.result,
      ),
    };
  }
  throw new Error("UNSUPPORTED_IMPORTED_PAYMENT_MODE");
}
