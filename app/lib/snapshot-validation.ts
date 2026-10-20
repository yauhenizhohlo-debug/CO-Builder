import "server-only";

import type { ProposalData } from "../components/proposal-context.tsx";
import type { OnePageDraft } from "./one-page.ts";
import { ApiRequestError, assertSafeJson } from "./api-security.ts";

const allowedMediaPath = /^\/(?:layouts|renders|project-renders)\/[a-zA-Z0-9._/-]+$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiRequestError("INVALID_REQUEST", 400);
  return value as Record<string, unknown>;
}

function finitePositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validRoom(value: unknown) {
  const room = record(value);
  return typeof room.roomNumber === "string" && room.roomNumber.length <= 20
    && Number.isInteger(room.floor) && finitePositive(room.area)
    && finitePositive(room.price) && finitePositive(room.pricePerSqm)
    && typeof room.layoutId === "string" && room.layoutId.length <= 80
    && typeof room.renderSetId === "string" && room.renderSetId.length <= 80;
}

export function validateProposalData(value: unknown): ProposalData {
  assertSafeJson(value);
  const proposal = record(value);
  if (!validRoom(proposal.room) || (proposal.financingType !== "installment" && proposal.financingType !== "mortgage")) {
    throw new ApiRequestError("INVALID_REQUEST", 400);
  }
  if (proposal.financingType === "installment") {
    const installment = record(proposal.installment);
    if (![installment.listPrice, installment.discountPercent, installment.discountAmount, installment.discountedPrice, installment.initialPaymentPercent,
      installment.initialPayment, installment.monthlyPayment, installment.paymentsBeforeTopUp, installment.topUpPayment,
      installment.targetEscrow, installment.secondPeriodPayments, installment.finalPayment].every(finiteNonNegative)
      || !Array.isArray(proposal.schedule) || proposal.schedule.length > 160) throw new ApiRequestError("INVALID_REQUEST", 400);
    for (const row of proposal.schedule) {
      const payment = record(row);
      if (typeof payment.id !== "string" || payment.id.length > 80 || typeof payment.date !== "string" || !isoDate.test(payment.date)
        || typeof payment.label !== "string" || payment.label.length > 160 || !finitePositive(payment.amount) && payment.amount !== 0
        || typeof payment.cumulativeAmount !== "number" || !Number.isFinite(payment.cumulativeAmount)) throw new ApiRequestError("INVALID_REQUEST", 400);
    }
  } else {
    const mortgage = record(proposal.mortgage);
    if (![mortgage.price, mortgage.initialPayment, mortgage.initialPaymentPercent, mortgage.loanAmount, mortgage.annualRate,
      mortgage.termMonths, mortgage.trancheTotal, mortgage.remainingBalance, mortgage.totalInterest, mortgage.totalPayments].every(finiteNonNegative)
      || !Array.isArray(mortgage.stages) || mortgage.stages.length < 1 || mortgage.stages.length > 3
      || !Array.isArray(mortgage.schedule) || mortgage.schedule.length > 480) throw new ApiRequestError("INVALID_REQUEST", 400);
    for (const row of mortgage.schedule) {
      const payment = record(row);
      if (typeof payment.date !== "string" || !isoDate.test(payment.date)
        || ![payment.payment, payment.interest, payment.principal, payment.remainingBalance].every(finiteNonNegative)
        || !Number.isInteger(payment.activeTranche) || Number(payment.activeTranche) < 1 || Number(payment.activeTranche) > 3) {
        throw new ApiRequestError("INVALID_REQUEST", 400);
      }
    }
  }
  return value as ProposalData;
}

function validateMediaPaths(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max || value.some((path) => typeof path !== "string" || path.length > 240 || !allowedMediaPath.test(path) || path.includes(".."))) {
    throw new ApiRequestError("INVALID_MEDIA_PATH", 400);
  }
}

export function validateOnePageDraft(value: unknown): OnePageDraft {
  assertSafeJson(value);
  const draft = record(value);
  if (!validRoom(draft.room) || !finitePositive(draft.basePrice)) throw new ApiRequestError("INVALID_REQUEST", 400);
  if (draft.layoutPath !== null && (typeof draft.layoutPath !== "string" || !allowedMediaPath.test(draft.layoutPath) || draft.layoutPath.includes(".."))) {
    throw new ApiRequestError("INVALID_MEDIA_PATH", 400);
  }
  validateMediaPaths(draft.renderPaths, 6);
  validateMediaPaths(draft.projectRenderPaths, 3);
  if (!(["ivory", "obsidian", "mission-control", "industrial", "liquid-glass"] as unknown[]).includes(draft.template)
    || !(["a4", "social", "post", "story", "square"] as unknown[]).includes(draft.format)
    || (draft.paymentMode !== "calculated" && draft.paymentMode !== "custom")
    || (draft.initialPaymentMode !== "percent" && draft.initialPaymentMode !== "amount")
    || !finiteNonNegative(draft.initialPaymentValue)
    || (draft.individualPrice !== null && !finitePositive(draft.individualPrice))) throw new ApiRequestError("INVALID_REQUEST", 400);
  if (!Array.isArray(draft.customPayments) || draft.customPayments.length > 120 || !Array.isArray(draft.calculatedSchedule) || draft.calculatedSchedule.length > 160) {
    throw new ApiRequestError("INVALID_REQUEST", 400);
  }
  return value as unknown as OnePageDraft;
}
