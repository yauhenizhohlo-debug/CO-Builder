import { calculateDiscount, type DiscountInput } from "./calculate-discount.ts";
import { calculateInstallment } from "./calculate-installment.ts";
import type { PaymentScheduleItem } from "./build-payment-schedule.ts";
import type { Room } from "../data/rooms.ts";
import { balanceCustomSchedule, getDefaultBalancerId, type ScheduleBalanceMode } from "./custom-payment-schedule.ts";
import { emptySpecialistContacts, normalizeSpecialistContacts, specialistContactsEnabled, specialistContactsError, type SpecialistContacts, type SpecialistContactsMode } from "./specialist-contacts.ts";

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
  specialistContacts?: SpecialistContacts;
  specialistContactsMode?: SpecialistContactsMode;
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

export type OnePagePaymentBridgeInput = {
  schedule: PaymentScheduleItem[];
  standardSchedule?: PaymentScheduleItem[];
  scheduleMode?: "standard" | "custom";
  scheduleBalanceMode?: ScheduleBalanceMode;
  scheduleBalancerId?: string | null;
};

export type OnePagePaymentBridge = Pick<
  OnePageDraft,
  | "paymentMode"
  | "calculatedSchedule"
  | "customPayments"
  | "customScheduleBalanceMode"
  | "customScheduleBalancerId"
  | "scenarioLabel"
>;

const cloneSchedule = (schedule: PaymentScheduleItem[]) =>
  schedule.map((payment) => ({ ...payment }));

export function bridgeProposalPaymentsToOnePage(input: OnePagePaymentBridgeInput): OnePagePaymentBridge {
  const isCustom = input.scheduleMode === "custom";
  const standardSchedule = cloneSchedule(input.standardSchedule ?? (isCustom ? [] : input.schedule));
  const customPayments = isCustom ? cloneSchedule(input.schedule) : [];
  const requestedBalancerId = input.scheduleBalancerId ?? null;
  const customScheduleBalancerId = customPayments.some((payment) => payment.id === requestedBalancerId)
    ? requestedBalancerId
    : getDefaultBalancerId(customPayments);

  return {
    paymentMode: isCustom ? "custom" : "calculated",
    calculatedSchedule: standardSchedule,
    customPayments,
    customScheduleBalanceMode: isCustom ? input.scheduleBalanceMode ?? "auto" : "auto",
    customScheduleBalancerId: isCustom ? customScheduleBalancerId : null,
    scenarioLabel: isCustom ? "Свободный график" : "Рассрочка",
  };
}

export function switchOnePagePaymentMode(
  draft: OnePageDraft,
  paymentMode: OnePageDraft["paymentMode"],
): OnePageDraft {
  return {
    ...draft,
    paymentMode,
    scenarioLabel: paymentMode === "custom" ? "Свободный график" : "Рассрочка",
  };
}

export function synchronizeCalculatedSchedule(
  schedule: PaymentScheduleItem[],
  dealPrice: number,
  initialPayment: number,
): OnePagePayment[] {
  const firstPeriod = schedule.filter((payment) => payment.type === "regular-first");
  const regularPayment = firstPeriod[0]?.amount
    ?? schedule.find((payment) => payment.type === "regular-second")?.amount
    ?? 0;
  const installment = calculateInstallment({
    price: dealPrice,
    initialPaymentPercent: dealPrice > 0 ? initialPayment / dealPrice * 100 : 0,
    monthlyPayment: regularPayment,
    discount: { mode: "percent", value: 0 },
    firstPeriodPaymentCount: firstPeriod.length,
  });

  return schedule.map(({ id, date, label, amount, type }) => ({
    id,
    date,
    label,
    type,
    amount: type === "initial"
      ? initialPayment
      : type === "top-up"
        ? installment.topUpPayment
        : type === "final"
          ? installment.finalPayment
          : amount,
  }));
}

export function calculateOnePage(draft: OnePageDraft): OnePageCalculation {
  const errors: string[] = [];
  const offerPrice = draft.individualPrice === null ? draft.basePrice : draft.individualPrice;
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) errors.push("Цена предложения должна быть больше нуля");
  const discount = calculateDiscount(offerPrice, draft.discount);
  const rawStandardInitial = draft.initialPaymentMode === "percent"
    ? discount.discountedPrice * Math.min(100, Math.max(0, draft.initialPaymentValue)) / 100
    : Math.min(discount.discountedPrice, Math.max(0, draft.initialPaymentValue));
  const standardInitialPayment = Math.round(rawStandardInitial * 100) / 100;
  const expectedCustomTotal = discount.discountedPrice;
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
    : synchronizeCalculatedSchedule(draft.calculatedSchedule, discount.discountedPrice, standardInitialPayment);
  const payments = source.map((row) => ({ ...row, amount: Number(row.amount) }));
  const initialPayment = draft.paymentMode === "custom"
    ? Math.round(payments.filter((row) => row.type === "initial").reduce((sum, row) => sum + row.amount, 0) * 100) / 100
    : standardInitialPayment;
  const initialPaymentPercent = discount.discountedPrice > 0 ? initialPayment / discount.discountedPrice * 100 : 0;
  if (payments.some((row) => !Number.isFinite(row.amount) || row.amount < 0)) errors.push("Платежи не могут быть отрицательными");
  if (draft.guaranteedIncome !== null && (!(draft.guaranteedIncome > 0) || !draft.guaranteedIncomeSource.trim())) {
    errors.push("Для гарантированного дохода нужны подтверждённая сумма и источник данных");
  }
  const contactsError = specialistContactsEnabled(draft.specialistContactsMode, draft.specialistContacts)
    ? specialistContactsError(draft.specialistContacts ?? emptySpecialistContacts())
    : null;
  if (contactsError) errors.push(contactsError);
  const scheduledTotal = payments.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const expectedTotal = discount.discountedPrice;
  const difference = Math.round((scheduledTotal - expectedTotal) * 100) / 100;
  if (draft.paymentMode === "custom") {
    errors.push(...balancedCustom.validation.errors);
  } else if (Math.abs(difference) > 0.01) {
    errors.push("Сумма платежей не соответствует итоговой стоимости");
  }
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
  contentSnapshot: Pick<OnePageDraft, "specialConditions" | "guaranteedIncome" | "guaranteedIncomeSource" | "managerName" | "managerPhone" | "scenarioLabel"> & { specialistContacts?: SpecialistContacts; specialistContactsMode?: SpecialistContactsMode };
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
      specialistContactsMode: draft.specialistContactsMode,
      specialistContacts: specialistContactsEnabled(draft.specialistContactsMode, draft.specialistContacts)
        ? normalizeSpecialistContacts(draft.specialistContacts)
        : undefined,
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
