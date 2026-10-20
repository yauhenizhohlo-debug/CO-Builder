import "server-only";

import { baseRooms, type Room } from "../data/rooms.ts";
import { localDataPath, readJsonFile, writeJsonFile } from "./local-json-store.ts";
import { isSupabasePersistence } from "./persistence-config.ts";
import { supabaseRows, supabaseRpc } from "./supabase-persistence.ts";

export type PriceOverride = {
  roomNumber: string;
  oldPrice: number;
  newPrice: number;
  newPricePerSqm: number;
  comment: string;
  authorId: string;
  changedAt: string;
  revision?: number;
};

type PriceStore = { version: 1; overrides: Record<string, PriceOverride>; history: PriceOverride[] };
const emptyStore = (): PriceStore => ({ version: 1, overrides: {}, history: [] });

export const PRICE_STORE_PATH = () => localDataPath("price-overrides.json");

export function applyPriceOverrides(rooms: Room[], overrides: Record<string, PriceOverride>): Room[] {
  return rooms.map((room) => {
    const override = overrides[room.roomNumber];
    return override ? { ...room, price: override.newPrice, pricePerSqm: override.newPricePerSqm } : room;
  });
}

type SupabaseOverrideRow = {
  room_number: string;
  current_price: number;
  current_price_per_sqm: number;
  comment: string;
  author_id: string;
  changed_at: string;
  revision: number;
};

type SupabaseHistoryRow = {
  room_number: string;
  old_price: number;
  new_price: number;
  new_price_per_sqm: number;
  comment: string;
  author_id: string;
  changed_at: string;
  revision: number;
};

function fromHistoryRow(row: SupabaseHistoryRow): PriceOverride {
  return { roomNumber: row.room_number, oldPrice: row.old_price, newPrice: row.new_price, newPricePerSqm: row.new_price_per_sqm, comment: row.comment, authorId: row.author_id, changedAt: row.changed_at, revision: row.revision };
}

async function getSupabaseOverrides() {
  const rows = await supabaseRows<SupabaseOverrideRow>("co_builder_price_overrides?select=room_number,current_price,current_price_per_sqm,comment,author_id,changed_at,revision");
  return Object.fromEntries(rows.map((row) => [row.room_number, {
    roomNumber: row.room_number,
    oldPrice: row.current_price,
    newPrice: row.current_price,
    newPricePerSqm: row.current_price_per_sqm,
    comment: row.comment,
    authorId: row.author_id,
    changedAt: row.changed_at,
    revision: row.revision,
  } satisfies PriceOverride]));
}

export async function getCatalogRooms() {
  if (isSupabasePersistence()) return applyPriceOverrides(baseRooms, await getSupabaseOverrides());
  const store = await readJsonFile(PRICE_STORE_PATH(), emptyStore());
  return applyPriceOverrides(baseRooms, store.overrides);
}

export async function getPriceHistory(roomNumber?: string) {
  if (isSupabasePersistence()) {
    const filter = roomNumber ? `&room_number=eq.${encodeURIComponent(roomNumber)}` : "";
    const rows = await supabaseRows<SupabaseHistoryRow>(`co_builder_price_history?select=room_number,old_price,new_price,new_price_per_sqm,comment,author_id,changed_at,revision${filter}&order=changed_at.desc`);
    return rows.map(fromHistoryRow);
  }
  const store = await readJsonFile(PRICE_STORE_PATH(), emptyStore());
  return roomNumber ? store.history.filter((item) => item.roomNumber === roomNumber) : store.history;
}

let localWriteQueue = Promise.resolve();

async function withLocalPriceLock<T>(operation: () => Promise<T>) {
  const previous = localWriteQueue;
  let release = () => {};
  localWriteQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await operation(); } finally { release(); }
}

export async function savePriceOverride(input: { roomNumber: string; newPrice: number; comment: string; authorId: string; expectedPrice?: number }) {
  if (isSupabasePersistence()) {
    const catalog = await getCatalogRooms();
    const room = catalog.find((item) => item.roomNumber === input.roomNumber);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    if (!Number.isSafeInteger(input.newPrice) || input.newPrice <= 0) throw new Error("INVALID_PRICE");
    if (!input.comment.trim()) throw new Error("COMMENT_REQUIRED");
    const expectedPrice = input.expectedPrice ?? room.price;
    const change = await supabaseRpc<PriceOverride>("co_builder_save_price_override", {
      p_room_number: room.roomNumber,
      p_expected_price: expectedPrice,
      p_new_price: input.newPrice,
      p_new_price_per_sqm: Math.round(input.newPrice / room.area),
      p_comment: input.comment.trim(),
      p_author_id: input.authorId,
    });
    return { room: { ...room, price: change.newPrice, pricePerSqm: change.newPricePerSqm }, change };
  }

  return withLocalPriceLock(async () => {
  const storePath = PRICE_STORE_PATH();
  const store = await readJsonFile(storePath, emptyStore());
  const catalog = applyPriceOverrides(baseRooms, store.overrides);
  const room = catalog.find((item) => item.roomNumber === input.roomNumber);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  if (input.expectedPrice !== undefined && room.price !== input.expectedPrice) throw new Error("PRICE_CONFLICT");
  if (!Number.isSafeInteger(input.newPrice) || input.newPrice <= 0) throw new Error("INVALID_PRICE");
  const comment = input.comment.trim();
  if (!comment) throw new Error("COMMENT_REQUIRED");
  const change: PriceOverride = {
    roomNumber: room.roomNumber,
    oldPrice: room.price,
    newPrice: input.newPrice,
    newPricePerSqm: Math.round(input.newPrice / room.area),
    comment,
    authorId: input.authorId,
    changedAt: new Date().toISOString(),
  };
  store.overrides[room.roomNumber] = change;
  store.history.push(change);
  await writeJsonFile(storePath, store);
  return { room: { ...room, price: change.newPrice, pricePerSqm: change.newPricePerSqm }, change };
  });
}
