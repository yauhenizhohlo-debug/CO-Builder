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
  customPayments: [{ id: "rest", date: "2027-06-30", label: "Остаток", amount: 13_294_858.5 }],
  customScheduleBalanceMode: "auto", customScheduleBalancerId: "rest",
  specialConditions: "Тест", guaranteedIncome: template === "ivory" ? 1_000_000 : null,
  guaranteedIncomeSource: template === "ivory" ? "Подтверждённая программа" : "",
  managerName: "Анна", managerPhone: "+7 900 000-00-00", scenarioLabel: "Индивидуальные условия",
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

test("auto-balanced One Page schedule follows initial payment changes", () => {
  const value = draft("ivory");
  value.customPayments[0].amount = 1;
  const atFifteen = calculateOnePage(value);
  assert.equal(atFifteen.payments[0].amount, atFifteen.dealPrice - atFifteen.initialPayment);
  value.initialPaymentValue = 20;
  const atTwenty = calculateOnePage(value);
  assert.equal(atTwenty.payments[0].amount, atTwenty.dealPrice - atTwenty.initialPayment);
  assert.notEqual(atTwenty.payments[0].amount, atFifteen.payments[0].amount);
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
