import type { InstallmentResult } from "./calculate-installment";

export const ESCROW_CONTROL_DATE = "2027-06-30";

export type PaymentScheduleItem = {
  id: string;
  date: string;
  type: "initial" | "regular-first" | "top-up" | "regular-second" | "final";
  label: string;
  amount: number;
  cumulativeAmount: number;
};

const SECOND_PERIOD_PAYMENT_COUNT = 11;

function addMonthsIso(dateString: string, months: number) {
  const source = new Date(`${dateString}T00:00:00Z`);
  const targetYear = source.getUTCFullYear();
  const targetMonth = source.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(source.getUTCDate(), lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, targetDay))
    .toISOString()
    .slice(0, 10);
}

export function getFirstPeriodPaymentDates(transactionDate: string) {
  const dates: string[] = [];

  for (let month = 1; month <= 120; month += 1) {
    const paymentDate = addMonthsIso(transactionDate, month);
    if (paymentDate > ESCROW_CONTROL_DATE) break;
    dates.push(paymentDate);
  }

  return dates;
}

export function buildPaymentSchedule(
  transactionDate: string,
  installment: InstallmentResult,
  firstPeriodPaymentDates: string[],
): PaymentScheduleItem[] {
  let cumulativeAmount = 0;
  const schedule: PaymentScheduleItem[] = [];

  const addPayment = (
    id: string,
    date: string,
    type: PaymentScheduleItem["type"],
    label: string,
    amount: number,
  ) => {
    cumulativeAmount += amount;
    schedule.push({ id, date, type, label, amount, cumulativeAmount });
  };

  addPayment(
    "initial",
    transactionDate,
    "initial",
    "Первоначальный взнос",
    installment.initialPayment,
  );

  firstPeriodPaymentDates.forEach((paymentDate, index) => {
    addPayment(
      `first-${index + 1}`,
      paymentDate,
      "regular-first",
      `Регулярный платёж ${index + 1}/${firstPeriodPaymentDates.length}`,
      installment.monthlyPayment,
    );
  });

  addPayment(
    "top-up",
    ESCROW_CONTROL_DATE,
    "top-up",
    "Контрольный довнос до 50%",
    installment.topUpPayment,
  );

  for (let index = 0; index < SECOND_PERIOD_PAYMENT_COUNT; index += 1) {
    addPayment(
      `second-${index + 1}`,
      addMonthsIso(ESCROW_CONTROL_DATE, index + 1),
      "regular-second",
      `Регулярный платёж второго периода ${index + 1}/11`,
      installment.monthlyPayment,
    );
  }

  addPayment(
    "final",
    addMonthsIso(ESCROW_CONTROL_DATE, SECOND_PERIOD_PAYMENT_COUNT + 1),
    "final",
    "Финальный платёж",
    installment.finalPayment,
  );

  return schedule;
}
