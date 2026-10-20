import { calculateDiscount, type DiscountInput } from "./calculate-discount.ts";
import type { PaymentScheduleItem } from "./build-payment-schedule.ts";
import type { Room } from "../data/rooms.ts";
import { balanceCustomSchedule, getDefaultBalancerId, type ScheduleBalanceMode } from "./custom-payment-schedule.ts";

export type OnePageTemplate = "ivory" | "obsidian" | "mission-control" | "industrial" | "liquid-glass";
// `social` is retained for historical snapshots created before One Page v3.
export type OnePageFormat = "a4" | "social" | "post" | "story" | "square";

export type OnePagePayment = { id: string; date: string; label: string; amount: number; type?: PaymentScheduleItem["type"] };

export type OnePageDraft = {
  room: Room;
  basePrice: number;
  individualPrice: number | null;
  discount: DiscountInput;
  initialPaymentMode: "percent" | "amount";
  initialPaymentValue: number;
  paymentMode: "calculated" | "custom";
  calculatedSchedule: PaymentScheduleItem[];
  customPayments: OnePagePayment[];
  customScheduleBalanceMode?: ScheduleBalanceMode;
  customScheduleBalancerId?: string | null;
  specialConditions: string;
  guaranteedIncome: number | null;
  guaranteedIncomeSource: string;
  managerName: string;
  managerPhone: string;
  scenarioLabel: string;
  template: OnePageTemplate;
  format: OnePageFormat;
  layoutPath: string | null;
  renderPaths: string[];
  projectRenderPaths: string[];
};

export type OnePageCalculation = {
  basePrice: number;
  offerPrice: number;
  discountPercent: number;
  discountAmount: number;
  dealPrice: number;
  initialPaymentPercent: number;
  initialPayment: number;
  payments: OnePagePayment[];
  scheduledTotal: number;
  difference: number;
  isBalanced: boolean;
  errors: string[];
};

export function calculateOnePage(draft: OnePageDraft): OnePageCalculation {
  const errors: string[] = [];
  const offerPrice = draft.individualPrice === null ? draft.basePrice : draft.individualPrice;
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) errors.push("Цена предложения должна быть больше нуля");
  const discount = calculateDiscount(offerPrice, draft.discount);
  const rawInitial = draft.initialPaymentMode === "percent"
    ? discount.discountedPrice * Math.min(100, Math.max(0, draft.initialPaymentValue)) / 100
    : Math.min(discount.discountedPrice, Math.max(0, draft.initialPaymentValue));
  const initialPayment = Math.round(rawInitial * 100) / 100;
  const initialPaymentPercent = discount.discountedPrice > 0 ? initialPayment / discount.discountedPrice * 100 : 0;
  const expectedCustomTotal = discount.discountedPrice - initialPayment;
  const balancedCustom = balanceCustomSchedule(
    draft.customPayments.map((payment) => ({ ...payment, type: payment.type ?? "regular-first" })),
    expectedCustomTotal,
    { mode: draft.customScheduleBalanceMode ?? "auto", balancerId: draft.customScheduleBalancerId },
  );
  if (draft.paymentMode === "custom" && draft.customPayments.some((row) => !Number.isFinite(row.amount) || row.amount < 0)) {
    errors.push("Платежи не могут быть отрицательными");
  }
  const source = draft.paymentMode === "custom"
    ? balancedCustom.rows
    : draft.calculatedSchedule.map((row) => ({ id: row.id, date: row.date, label: row.label, amount: row.amount }));
  const payments = source.map((row) => ({ ...row, amount: Number(row.amount) }));
  if (payments.some((row) => !Number.isFinite(row.amount) || row.amount < 0)) errors.push("Платежи не могут быть отрицательными");
  if (draft.guaranteedIncome !== null && (!(draft.guaranteedIncome > 0) || !draft.guaranteedIncomeSource.trim())) {
    errors.push("Для гарантированного дохода нужны подтверждённая сумма и источник данных");
  }
  const scheduledTotal = payments.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const expectedTotal = draft.paymentMode === "custom" ? expectedCustomTotal : discount.discountedPrice;
  const difference = Math.round((scheduledTotal - expectedTotal) * 100) / 100;
  if (draft.paymentMode === "custom") {
    errors.push(...balancedCustom.validation.errors);
  } else if (Math.abs(difference) > 0.01) {
    errors.push("Сумма платежей не соответствует итоговой стоимости");
  }
  if (draft.paymentMode === "calculated" && payments.length > 0 && Math.abs(payments[0].amount - initialPayment) > 0.01) errors.push("ПВ не соответствует выбранному расчётному графику");
  return {
    basePrice: draft.basePrice,
    offerPrice,
    discountPercent: discount.discountPercent,
    discountAmount: discount.discountAmount,
    dealPrice: discount.discountedPrice,
    initialPaymentPercent,
    initialPayment,
    payments,
    scheduledTotal,
    difference,
    isBalanced: errors.length === 0,
    errors,
  };
}

export type OnePageSnapshot = {
  id: string;
  createdAt: string;
  calculationVersion: "one-page-v1";
  roomSnapshot: Room;
  commercialSnapshot: OnePageCalculation;
  contentSnapshot: Pick<OnePageDraft, "specialConditions" | "guaranteedIncome" | "guaranteedIncomeSource" | "managerName" | "managerPhone" | "scenarioLabel">;
  mediaSnapshot: { layoutPath: string | null; renderPaths: string[]; projectRenderPaths: string[] };
  template: OnePageTemplate;
  format: OnePageFormat;
  paymentSettingsSnapshot?: { balanceMode: ScheduleBalanceMode; balancerId: string | null };
};

export function createOnePageSnapshot(draft: OnePageDraft, id = crypto.randomUUID(), createdAt = new Date().toISOString()): OnePageSnapshot {
  const calculation = calculateOnePage(draft);
  if (!calculation.isBalanced) throw new Error(`INVALID_ONE_PAGE:${calculation.errors.join(";")}`);
  return {
    id,
    createdAt,
    calculationVersion: "one-page-v1",
    roomSnapshot: structuredClone(draft.room),
    commercialSnapshot: structuredClone(calculation),
    contentSnapshot: {
      specialConditions: draft.specialConditions,
      guaranteedIncome: draft.guaranteedIncome,
      guaranteedIncomeSource: draft.guaranteedIncomeSource,
      managerName: draft.managerName,
      managerPhone: draft.managerPhone,
      scenarioLabel: draft.scenarioLabel,
    },
    mediaSnapshot: { layoutPath: draft.layoutPath, renderPaths: [...draft.renderPaths], projectRenderPaths: [...draft.projectRenderPaths] },
    template: draft.template,
    format: draft.format,
    paymentSettingsSnapshot: draft.paymentMode === "custom" ? {
      balanceMode: draft.customScheduleBalanceMode ?? "auto",
      balancerId: balancedBalancerId(draft),
    } : undefined,
  };
}

function balancedBalancerId(draft: OnePageDraft) {
  const payments = draft.customPayments.map((payment) => ({ ...payment, type: payment.type ?? "regular-first" }));
  return payments.some((payment) => payment.id === draft.customScheduleBalancerId)
    ? draft.customScheduleBalancerId ?? null
    : getDefaultBalancerId(payments);
}
