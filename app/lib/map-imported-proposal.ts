import type {
  ImportedInstallmentResult,
  ImportedTrancheMortgageResult,
  ImportedMortgageResult,
  Money,
  ProposalContext,
} from "@cosmos/proposal-contract";
import { rooms, type Room } from "../data/rooms.ts";
import type { PaymentScheduleItem } from "./build-payment-schedule.ts";
import type { InstallmentResult } from "./calculate-installment.ts";
import type { TrancheMortgageResult } from "./calculate-tranche-mortgage.ts";
import type { ProposalData } from "../components/proposal-context.tsx";
import type { InvestmentProjection } from "../components/proposal-context.tsx";
import type { RefinanceCalculation } from "./refinance-types.ts";
import { moneyToRubles } from "./proposal-money.ts";

const rubles = (value: Parameters<typeof moneyToRubles>[0]) => moneyToRubles(value) ?? 0;
const zeroMoney=0 as Money;
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
  const basePrice = rubles(result.basePrice??result.purchasePrice);
  const price = rubles(result.dealPrice??result.purchasePrice);
  const initialPayment = rubles(result.downPaymentAmount??result.downPayment);
  const termMonths=result.termMonths??result.loanTermMonths;
  const canonical=result.tranches??[];

  return {
    basePrice,
    discountPercent: Number(result.discountPercent??0),
    discountAmount: rubles(result.discountAmount??zeroMoney),
    price,
    initialPayment,
    initialPaymentPercent: price > 0 ? initialPayment / price * 100 : 0,
    loanAmount: rubles(result.loanPrincipal??result.loanAmount),
    annualRate: Number(result.annualRate??result.annualRatePercent),
    termMonths,
    termYears: termMonths / 12,
    trancheTotal: rubles(result.trancheTotal),
    difference: rubles(result.difference),
    isBalanced: result.isBalanced,
    validationMessages: result.validationMessages,
    stages: (canonical.length?canonical:result.stages).map((item,index) => {
      const legacy=result.stages[index];
      const issueDate="date" in item?item.date:item.issueDate;
      const issueMonth = monthsBetween(transactionDate, issueDate);
      return {
        trancheId: legacy?.trancheId??`tranche-${index+1}`,
        trancheNumber:"index" in item?item.index:item.trancheNumber,
        trancheAmount:rubles("amount" in item?item.amount:item.trancheAmount),
        issueMonth,
        issueDate,
        startPaymentMonth: issueMonth + 1,
        endPaymentMonth: issueMonth + (legacy?.paymentCount??0),
        paymentCount: legacy?.paymentCount??0,
        outstandingAfterIssue: rubles(legacy?.outstandingAfterIssue??zeroMoney),
        remainingTermMonths: Math.max(1, termMonths - issueMonth),
        monthlyPayment: rubles("paymentAfterTranche" in item?item.paymentAfterTranche:item.monthlyPayment),
        balanceBeforeNextTranche: rubles(legacy?.balanceBeforeNextTranche??zeroMoney),
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

function mapRefinance(result:ImportedTrancheMortgageResult):RefinanceCalculation|undefined{const value=result.refinance;if(!value?.enabled)return undefined;return{enabled:true,refinanceAfterMonths:value.refinanceAfterMonths,refinanceDate:value.refinanceDate,assumedAnnualRate:Number(value.assumedAnnualRate),outstandingPrincipal:rubles(value.outstandingPrincipal),remainingTermMonths:value.remainingTermMonths,paymentBeforeRefinance:rubles(value.paymentBeforeRefinance),paymentAfterRefinance:rubles(value.paymentAfterRefinance),isValid:true,validationMessages:[]}}
const investment=(context:ProposalContext):InvestmentProjection|null=>context.investment?.result&&typeof context.investment.result==="object"&&!Array.isArray(context.investment.result)?context.investment.result as InvestmentProjection:null;

export function mapImportedProposal(context: ProposalContext): ProposalData {
  const room = resolveSnapshotRoom(context);
  if (context.payment.mode === "INSTALLMENT") {
    const mapped = mapInstallmentResult(context.payment.result);
    return { room, financingType: "installment", ...mapped,investment:investment(context) };
  }
  if (context.payment.mode === "TRANCHE_MORTGAGE") {
    return {
      room,
      financingType: "mortgage",
      mortgageKind:"tranche",
      mortgage: mapMortgageResult(
        context as ProposalContext & { payment: Extract<ProposalContext["payment"], { mode: "TRANCHE_MORTGAGE" }> },
        context.payment.result,
      ),
      refinance:mapRefinance(context.payment.result),
      investment:investment(context),
    };
  }
  if(context.payment.mode==="MORTGAGE"){const result=context.payment.result as ImportedMortgageResult;const price=rubles(result.purchasePrice),initialPayment=rubles(result.downPayment);return{room,financingType:"mortgage",mortgageKind:"standard",standardMonthlyPayment:rubles(result.monthlyPayment),investment:investment(context),mortgage:{basePrice:price,discountPercent:0,discountAmount:0,price,initialPayment,initialPaymentPercent:price>0?initialPayment/price*100:0,loanAmount:rubles(result.loanAmount),annualRate:Number(result.annualRatePercent),termMonths:result.loanTermMonths,termYears:result.loanTermMonths/12,trancheTotal:rubles(result.loanAmount),difference:0,isBalanced:result.validationMessages.length===0,validationMessages:result.validationMessages,stages:[],schedule:[],remainingBalance:0,totalInterest:rubles(result.overpayment),totalPayments:rubles(result.totalPayment)}}}
  throw new Error("UNSUPPORTED_IMPORTED_PAYMENT_MODE");
}
