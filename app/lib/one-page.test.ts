import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { projectRenders, selectProjectRenders } from "../data/project-renders.ts";
import { baseRooms } from "../data/rooms.ts";
import { calculateOnePage, createOnePageSnapshot, type OnePageDraft, type OnePageTemplate } from "./one-page.ts";
import { getOnePageSnapshot, saveOnePageSnapshot } from "./one-page-store.ts";

const room = baseRooms.find((item) => item.roomNumber === "437п")!;
const templates: OnePageTemplate[] = ["ivory", "obsidian", "mission-control", "industrial", "liquid-glass"];
const draft = (template: OnePageTemplate): OnePageDraft => ({
  room: structuredClone(room), basePrice: room.price, individualPrice: null, discount: { mode: "percent", value: 1 },
  initialPaymentMode: "percent", initialPaymentValue: 15, paymentMode: "custom", calculatedSchedule: [],
  customPayments: [
    { id: "initial", date: "2026-10-21", label: "Первоначальный взнос", amount: 2_346_151.5, type: "initial" },
    { id: "rest", date: "2027-06-30", label: "Остаток", amount: 13_294_858.5, type: "top-up" },
  ],
  customScheduleBalanceMode: "auto", customScheduleBalancerId: "rest",
  specialConditions: "Тест", guaranteedIncome: template === "ivory" ? 1_000_000 : null,
  guaranteedIncomeSource: template === "ivory" ? "Подтверждённая программа" : "",
  managerName: "Анна", managerPhone: "+7 900 000-00-00", scenarioLabel: "Индивидуальные условия",
  specialistContacts: { firstName: "Анна", lastName: "Петрова", agency: "Агентство недвижимости", phone: "+7 900 000-00-00" },
  specialistContactsMode: "enabled",
  template, format: "a4", layoutPath: "/layouts/page-40.webp", renderPaths: ["/renders/room-25-9/01.jpg"],
  projectRenderPaths: selectProjectRenders("437п:0").map((item) => item.imagePath),
});

for (const template of templates) test(`${template} creates an immutable balanced snapshot`, () => {
  const value = draft(template);
  const calculation = calculateOnePage(value);
  assert.equal(calculation.dealPrice, 15_641_010);
  assert.equal(calculation.initialPayment, 2_346_151.5);
  assert.equal(calculation.isBalanced, true);
  const snapshot = createOnePageSnapshot(value, `snapshot-${template}`, "2026-10-13T00:00:00.000Z");
  value.room.price = 1;
  assert.equal(snapshot.roomSnapshot.price, 15_799_000);
  assert.equal(snapshot.template, template);
  assert.deepEqual(snapshot.paymentSettingsSnapshot, { balanceMode: "auto", balancerId: "rest" });
  assert.deepEqual(snapshot.contentSnapshot.specialistContacts, value.specialistContacts);
});

test("specialist contacts are optional and frozen inside a One Page snapshot", () => {
  const value = draft("ivory");
  const snapshot = createOnePageSnapshot(value, "contacts", "2026-10-21T00:00:00.000Z");
  value.specialistContacts!.agency = "Изменённое агентство";
  assert.equal(snapshot.contentSnapshot.specialistContacts?.agency, "Агентство недвижимости");

  const legacy = draft("ivory");
  delete legacy.specialistContacts;
  delete legacy.specialistContactsMode;
  assert.equal(createOnePageSnapshot(legacy).contentSnapshot.specialistContacts, undefined);
});

test("contacts are disabled by default without creating an empty document block", () => {
  const value = draft("ivory");
  value.specialistContactsMode = "none";
  value.specialistContacts = { firstName: "Скрыто", lastName: "", agency: "", phone: "" };
  const snapshot = createOnePageSnapshot(value);
  assert.equal(snapshot.contentSnapshot.specialistContactsMode, "none");
  assert.equal(snapshot.contentSnapshot.specialistContacts, undefined);
  assert.equal(snapshot.commercialSnapshot.isBalanced, true);
});

test("free schedule accepts arbitrary dates without COSMOS control top-up", () => {
  const value = draft("obsidian");
  value.individualPrice = 10_000_000;
  value.discount = { mode: "percent", value: 0 };
  value.customPayments = [
    { id: "first", date: "2027-03-14", label: "Первый этап", amount: 2_000_000, type: "initial" },
    { id: "middle", date: "2027-09-03", label: "Произвольный платёж", amount: 1_000_000, type: "regular-first" },
    { id: "balance", date: "2029-02-11", label: "Остаток", amount: 0, type: "top-up" },
  ];
  value.customScheduleBalancerId = "balance";
  const result = calculateOnePage(value);
  assert.equal(result.isBalanced, true);
  assert.equal(result.payments[2].amount, 7_000_000);
  assert.equal(result.payments.some((payment) => payment.date === "2027-06-30"), false);
  assert.equal(result.payments.some((payment) => /50%/.test(payment.label)), false);
});

test("invalid specialist phone blocks One Page persistence and export calculation", () => {
  const value = draft("obsidian");
  value.specialistContacts!.phone = "call me<script>";
  const result = calculateOnePage(value);
  assert.equal(result.isBalanced, false);
  assert.ok(result.errors.some((error) => error.includes("Телефон")));
});

test("invalid totals and unconfirmed guaranteed income are rejected", () => {
  const invalid = draft("ivory");
  invalid.guaranteedIncome = 1_000_000;
  invalid.guaranteedIncomeSource = "";
  invalid.customPayments[0].amount = -1;
  const result = calculateOnePage(invalid);
  assert.equal(result.isBalanced, false);
  assert.ok(result.errors.some((error) => error.includes("отрицательными")));
  assert.ok(result.errors.some((error) => error.includes("подтверждённая сумма")));
});

test("free One Page schedule ignores standard down-payment controls and follows deal price", () => {
  const value = draft("ivory");
  value.customPayments[1].amount = 1;
  const atFifteen = calculateOnePage(value);
  assert.equal(atFifteen.payments[1].amount, atFifteen.dealPrice - atFifteen.initialPayment);
  value.initialPaymentValue = 20;
  const atTwenty = calculateOnePage(value);
  assert.equal(atTwenty.payments[1].amount, atFifteen.payments[1].amount);
  value.individualPrice = 15_000_000;
  value.discount = { mode: "percent", value: 0 };
  const repriced = calculateOnePage(value);
  assert.equal(repriced.payments[0].amount, atFifteen.payments[0].amount);
  assert.equal(repriced.payments[1].amount, 15_000_000 - atFifteen.payments[0].amount);
});

test("room 437 individual price is the single source for down payment and calculated schedule", () => {
  const value = draft("ivory");
  value.individualPrice = 15_000_000;
  value.discount = { mode: "percent", value: 0 };
  value.paymentMode = "calculated";
  value.calculatedSchedule = [
    { id: "initial", date: "2026-10-21", type: "initial", label: "Первоначальный взнос", amount: 2_369_850, cumulativeAmount: 2_369_850 },
    { id: "first", date: "2026-11-21", type: "regular-first", label: "Регулярный платёж", amount: 150_000, cumulativeAmount: 2_519_850 },
    { id: "top-up", date: "2027-06-30", type: "top-up", label: "Контрольный довнос до 50%", amount: 5_380_150, cumulativeAmount: 7_900_000 },
    ...Array.from({ length: 11 }, (_, index) => ({
      id: `second-${index + 1}`,
      date: `2027-${String(index + 1).padStart(2, "0")}-30`,
      type: "regular-second" as const,
      label: `Платёж второго периода ${index + 1}/11`,
      amount: 150_000,
      cumulativeAmount: 8_050_000 + index * 150_000,
    })),
    { id: "final", date: "2028-06-30", type: "final", label: "Финальный платёж", amount: 7_749_000, cumulativeAmount: 15_799_000 },
  ];

  const result = calculateOnePage(value);

  assert.equal(result.dealPrice, 15_000_000);
  assert.equal(result.initialPayment, 2_250_000);
  assert.equal(result.payments.find((payment) => payment.type === "initial")?.amount, 2_250_000);
  assert.equal(result.payments.find((payment) => payment.type === "top-up")?.amount, 5_100_000);
  assert.equal(result.payments.find((payment) => payment.type === "final")?.amount, 5_850_000);
  assert.equal(result.scheduledTotal, 15_000_000);
  assert.equal(result.isBalanced, true);
});

test("calculated schedule follows discount and down-payment changes", () => {
  const value = draft("ivory");
  value.paymentMode = "calculated";
  value.calculatedSchedule = [
    { id: "initial", date: "2026-10-21", type: "initial", label: "Первоначальный взнос", amount: 1, cumulativeAmount: 1 },
    { id: "top-up", date: "2027-06-30", type: "top-up", label: "Контрольный довнос", amount: 1, cumulativeAmount: 2 },
    { id: "final", date: "2028-06-30", type: "final", label: "Финальный платёж", amount: 1, cumulativeAmount: 3 },
  ];
  value.discount = { mode: "percent", value: 3 };
  value.initialPaymentValue = 20;

  const result = calculateOnePage(value);

  assert.equal(result.dealPrice, 15_325_030);
  assert.equal(result.initialPayment, 3_065_006);
  assert.equal(result.payments.reduce((sum, payment) => sum + payment.amount, 0), result.dealPrice);
  assert.equal(result.isBalanced, true);
});

test("switching a calculated schedule to custom keeps manual rows and auto-balances the final row", () => {
  const value = draft("ivory");
  value.individualPrice = 15_000_000;
  value.discount = { mode: "percent", value: 0 };
  value.customPayments = [
    { id: "initial", date: "2026-10-21", label: "Первоначальный взнос", amount: 2_250_000, type: "initial" },
    { id: "manual", date: "2027-01-01", label: "Зафиксированный этап", amount: 1_000_000, type: "regular-first" },
    { id: "final", date: "2028-01-01", label: "Финальный платёж", amount: 1, type: "final" },
  ];
  value.customScheduleBalancerId = "final";

  const result = calculateOnePage(value);

  assert.equal(result.payments[0].amount, 2_250_000);
  assert.equal(result.payments[1].amount, 1_000_000);
  assert.equal(result.payments[2].amount, 11_750_000);
  assert.equal(result.scheduledTotal, result.dealPrice);
  assert.equal(result.isBalanced, true);
});

test("snapshot preserves free-schedule manual stages after an individual-price change", () => {
  const value = draft("obsidian");
  value.individualPrice = 15_000_000;
  value.discount = { mode: "percent", value: 0 };
  const snapshot = createOnePageSnapshot(value, "room-437-custom-price", "2026-10-21T00:00:00.000Z");

  assert.equal(snapshot.commercialSnapshot.dealPrice, 15_000_000);
  assert.equal(snapshot.commercialSnapshot.initialPayment, 2_346_151.5);
  assert.equal(snapshot.commercialSnapshot.payments.find((payment) => payment.id === "rest")?.amount, 12_653_848.5);
  assert.equal(snapshot.commercialSnapshot.scheduledTotal, 15_000_000);
});

test("controlled project render selection is stable, unique and category-balanced", () => {
  const first = selectProjectRenders("704:0");
  const repeated = selectProjectRenders("704:0");
  assert.deepEqual(first, repeated);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((item) => item.imagePath)).size, 3);
  assert.deepEqual(new Set(first.map((item) => item.category)), new Set(["exterior", "territory", "amenity"]));
  assert.equal(projectRenders.length, 12);
});

test("saved One Page reloads without following later room price changes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "co-builder-one-page-"));
  process.env.CO_BUILDER_DATA_DIR = directory;
  try {
    const snapshot = createOnePageSnapshot(draft("ivory"), "stable-id", "2026-10-13T00:00:00.000Z");
    await saveOnePageSnapshot(snapshot);
    const laterCatalogPrice = 99;
    const restored = await getOnePageSnapshot("stable-id");
    assert.equal(restored?.roomSnapshot.price, 15_799_000);
    assert.notEqual(restored?.roomSnapshot.price, laterCatalogPrice);
    assert.equal(restored?.mediaSnapshot.projectRenderPaths.length, 3);
    assert.deepEqual(restored?.paymentSettingsSnapshot, { balanceMode: "auto", balancerId: "rest" });
    assert.ok(restored?.mediaSnapshot.projectRenderPaths.every((item) => item.startsWith("/api/one-pages/stable-id/media/")));
  } finally {
    delete process.env.CO_BUILDER_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});
