import type { PaymentScheduleItem } from "./build-payment-schedule.ts";

export type EditablePayment = {
  id: string;
  date: string;
  label: string;
  amount: number;
  type: PaymentScheduleItem["type"];
};

export type CustomScheduleValidation = {
  schedule: PaymentScheduleItem[];
  total: number;
  difference: number;
  isValid: boolean;
  errors: string[];
};

export type ScheduleBalanceMode = "auto" | "manual";

export type BalancedCustomSchedule = {
  rows: EditablePayment[];
  validation: CustomScheduleValidation;
  balancerId: string | null;
  otherPaymentsTotal: number;
  remaining: number;
  excess: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isRealIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function toEditableSchedule(schedule: PaymentScheduleItem[]): EditablePayment[] {
  return schedule.map(({ id, date, label, amount, type }) => ({ id, date, label, amount, type }));
}

export function validateCustomSchedule(
  rows: EditablePayment[],
  expectedTotal: number,
): CustomScheduleValidation {
  const errors: string[] = [];
  const fingerprints = new Set<string>();

  if (rows.length === 0) errors.push("Добавьте хотя бы один этап платежа");

  rows.forEach((row, index) => {
    if (!row.label.trim()) errors.push(`Укажите название этапа ${index + 1}`);
    if (!isRealIsoDate(row.date)) errors.push(`Проверьте дату этапа ${index + 1}`);
    if (!Number.isFinite(row.amount) || row.amount < 0) errors.push(`Сумма этапа ${index + 1} не может быть отрицательной`);
    const fingerprint = `${row.date}|${row.label.trim().toLocaleLowerCase("ru-RU")}`;
    if (fingerprints.has(fingerprint)) errors.push(`Этап ${index + 1} дублирует дату и назначение другого платежа`);
    fingerprints.add(fingerprint);
  });

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].date < rows[index - 1].date) {
      errors.push("Расположите этапы в хронологическом порядке");
      break;
    }
  }

  let cumulativeAmount = 0;
  const schedule = rows.map((row) => {
    const amount = Number.isFinite(row.amount) ? row.amount : 0;
    cumulativeAmount += Math.max(0, amount);
    return { ...row, label: row.label.trim(), amount, cumulativeAmount };
  });
  const total = roundMoney(cumulativeAmount);
  const difference = roundMoney(total - expectedTotal);
  if (Math.abs(difference) > 0.01) errors.push("Сумма этапов должна совпадать с ценой после скидки");

  return { schedule, total, difference, isValid: errors.length === 0, errors };
}

export function getDefaultBalancerId(rows: EditablePayment[]) {
  return [...rows].reverse().find((row) => row.type === "final")?.id ?? rows.at(-1)?.id ?? null;
}

export function balanceCustomSchedule(
  rows: EditablePayment[],
  expectedTotal: number,
  options: { mode: ScheduleBalanceMode; balancerId?: string | null },
): BalancedCustomSchedule {
  const balancerId = rows.some((row) => row.id === options.balancerId)
    ? options.balancerId ?? null
    : getDefaultBalancerId(rows);
  const otherPaymentsTotal = roundMoney(rows.reduce(
    (sum, row) => sum + (row.id === balancerId || !Number.isFinite(row.amount) ? 0 : Math.max(0, row.amount)),
    0,
  ));
  const balancingAmount = roundMoney(expectedTotal - otherPaymentsTotal);
  const excess = balancingAmount < 0 ? Math.abs(balancingAmount) : 0;
  const effectiveRows = options.mode === "auto" && balancerId
    ? rows.map((row) => row.id === balancerId ? { ...row, amount: Math.max(0, balancingAmount) } : row)
    : rows.map((row) => ({ ...row }));
  const validation = validateCustomSchedule(effectiveRows, expectedTotal);

  if (options.mode === "auto" && excess > 0) {
    validation.errors = validation.errors.filter((error) => error !== "Сумма этапов должна совпадать с ценой после скидки");
    validation.errors.push(`Остальные платежи превышают цену сделки на ${excess.toLocaleString("ru-RU")} ₽`);
    validation.isValid = false;
  }

  return {
    rows: effectiveRows,
    validation,
    balancerId,
    otherPaymentsTotal,
    remaining: roundMoney(expectedTotal - validation.total),
    excess,
  };
}

export function distributeScheduleRemainder(
  rows: EditablePayment[],
  expectedTotal: number,
  balancerId?: string | null,
) {
  return balanceCustomSchedule(rows, expectedTotal, { mode: "auto", balancerId }).rows;
}

export function regularPaymentSummary(schedule: PaymentScheduleItem[]) {
  const regular = schedule.filter((row) => row.type === "regular-first" || row.type === "regular-second");
  if (regular.length === 0) return null;
  const amount = regular[0].amount;
  const isUniform = regular.every((row) => Math.abs(row.amount - amount) < 0.01);
  return isUniform ? { amount, count: regular.length } : null;
}
