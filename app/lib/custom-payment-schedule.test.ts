import test from "node:test";
import assert from "node:assert/strict";
import { balanceCustomSchedule, distributeScheduleRemainder, MAX_CUSTOM_SCHEDULE_ROWS, validateCustomSchedule } from "./custom-payment-schedule.ts";

const rows = [
  { id: "initial", date: "2026-10-17", label: "Первоначальный взнос", amount: 3_000_000, type: "initial" as const },
  { id: "stage-2", date: "2027-02-01", label: "Второй этап", amount: 7_000_000, type: "top-up" as const },
];

test("individual schedule builds cumulative amounts and balances", () => {
  const result = validateCustomSchedule(rows, 10_000_000);
  assert.equal(result.isValid, true);
  assert.equal(result.total, 10_000_000);
  assert.equal(result.schedule[1].cumulativeAmount, 10_000_000);
});

test("individual schedule rejects negative, duplicate and out-of-order rows", () => {
  const result = validateCustomSchedule([
    rows[1],
    { ...rows[0], id: "bad", date: "2026-13-40", amount: -1 },
    { ...rows[1], id: "duplicate" },
  ], 10_000_000);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.includes("отрицательной")));
  assert.ok(result.errors.some((error) => error.includes("дату")));
  assert.ok(result.errors.some((error) => error.includes("дублирует")));
});

test("free schedule enforces unique identifiers and the technical row limit", () => {
  const tooManyRows = Array.from({ length: MAX_CUSTOM_SCHEDULE_ROWS + 1 }, (_, index) => ({
    id: index === MAX_CUSTOM_SCHEDULE_ROWS ? "stage-1" : `stage-${index + 1}`,
    date: `2027-${String((index % 12) + 1).padStart(2, "0")}-01`,
    label: `Этап ${index + 1}`,
    amount: index === 0 ? 1_000_000 : 0,
    type: "top-up" as const,
  }));
  const result = validateCustomSchedule(tooManyRows, 1_000_000);
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((error) => error.includes(`не более ${MAX_CUSTOM_SCHEDULE_ROWS}`)));
  assert.ok(result.errors.some((error) => error.includes("некорректный идентификатор")));
});

test("auto balance uses the final payment and reacts to another payment change", () => {
  const withFinal = [...rows, { id: "final", date: "2028-01-01", label: "Финальный платёж", amount: 1, type: "final" as const }];
  const result = balanceCustomSchedule(withFinal, 12_000_000, { mode: "auto" });
  assert.equal(result.balancerId, "final");
  assert.equal(result.rows[2].amount, 2_000_000);
  assert.equal(result.validation.total, 12_000_000);
  assert.equal(result.remaining, 0);

  const edited = result.rows.map((row) => row.id === "stage-2" ? { ...row, amount: 7_500_000 } : row);
  const recalculated = balanceCustomSchedule(edited, 12_000_000, { mode: "auto", balancerId: "final" });
  assert.equal(recalculated.rows[2].amount, 1_500_000);
});

test("auto balance follows deal price changes without changing manual stages", () => {
  const result = balanceCustomSchedule(rows, 11_000_000, { mode: "auto", balancerId: "stage-2" });
  assert.equal(result.rows[0].amount, 3_000_000);
  assert.equal(result.rows[1].amount, 8_000_000);
  assert.equal(result.validation.isValid, true);
});

test("auto balance never creates a negative payment and reports the excess", () => {
  const result = balanceCustomSchedule(rows, 2_000_000, { mode: "auto", balancerId: "stage-2" });
  assert.equal(result.rows[1].amount, 0);
  assert.equal(result.excess, 1_000_000);
  assert.equal(result.validation.isValid, false);
  assert.ok(result.validation.errors.some((error) => error.includes("превышают цену сделки")));
});

test("manual mode exposes the difference and distributes it to the selected stage", () => {
  const manual = balanceCustomSchedule(rows, 12_000_000, { mode: "manual", balancerId: "stage-2" });
  assert.equal(manual.remaining, 2_000_000);
  assert.equal(manual.validation.isValid, false);
  const distributed = distributeScheduleRemainder(rows, 12_000_000, "stage-2");
  assert.equal(distributed[1].amount, 9_000_000);
  assert.equal(validateCustomSchedule(distributed, 12_000_000).isValid, true);
});

test("adding and removing a stage preserves exact cent rounding", () => {
  const extended = [...rows, { id: "extra", date: "2028-01-01", label: "Доплата", amount: 100_000.11, type: "top-up" as const }];
  const result = balanceCustomSchedule(extended, 10_500_000.55, { mode: "auto", balancerId: "stage-2" });
  assert.equal(result.rows.find((row) => row.id === "stage-2")?.amount, 7_400_000.44);
  assert.equal(result.validation.total, 10_500_000.55);
  const removed = result.rows.filter((row) => row.id !== "extra");
  const rebalanced = balanceCustomSchedule(removed, 10_500_000.55, { mode: "auto", balancerId: "stage-2" });
  assert.equal(rebalanced.rows[1].amount, 7_500_000.55);
});
