import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { baseRooms } from "../data/rooms.ts";
import { applyPriceOverrides, getCatalogRooms, savePriceOverride } from "./price-overrides.ts";

test("price override changes exactly one room and survives reload", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "co-builder-price-"));
  process.env.CO_BUILDER_DATA_DIR = directory;
  try {
    const before = baseRooms.find((room) => room.roomNumber === "437п")!;
    const otherBefore = baseRooms.find((room) => room.roomNumber === "704")!;
    const saved = await savePriceOverride({ roomNumber: "437п", newPrice: 16_058_000, comment: "Локальный QA", authorId: "qa" });
    assert.equal(saved.change.oldPrice, 15_799_000);
    assert.equal(saved.room.pricePerSqm, 620_000);
    const afterRestart = await getCatalogRooms();
    assert.equal(afterRestart.find((room) => room.roomNumber === "437п")?.price, 16_058_000);
    assert.deepEqual(afterRestart.find((room) => room.roomNumber === "704"), otherBefore);
    assert.equal(before.price, 15_799_000);
    const persisted = JSON.parse(await readFile(path.join(directory, "price-overrides.json"), "utf8"));
    assert.equal(persisted.history[0].authorId, "qa");
    assert.equal(persisted.history[0].comment, "Локальный QA");
    await assert.rejects(
      savePriceOverride({ roomNumber: "437п", newPrice: 16_100_000, comment: "Конкурентная запись", authorId: "qa-2", expectedPrice: 15_799_000 }),
      /PRICE_CONFLICT/,
    );
    const afterConflict = await getCatalogRooms();
    assert.equal(afterConflict.find((item) => item.roomNumber === "437п")?.price, 16_058_000);
  } finally {
    delete process.env.CO_BUILDER_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});

test("applyPriceOverrides preserves all non-target rows", () => {
  const target = baseRooms.find((room) => room.roomNumber === "437п")!;
  const next = applyPriceOverrides(baseRooms, { "437п": { roomNumber: "437п", oldPrice: target.price, newPrice: 16_058_000, newPricePerSqm: 620_000, comment: "test", authorId: "qa", changedAt: "2026-10-13T00:00:00.000Z" } });
  assert.equal(next.filter((room, index) => room !== baseRooms[index]).length, 1);
});
