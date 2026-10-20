import "server-only";

import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { OnePageSnapshot } from "./one-page.ts";
import { localDataPath, readJsonFile, writeJsonFile } from "./local-json-store.ts";
import { isSupabasePersistence } from "./persistence-config.ts";
import { downloadSnapshotObject, removeSnapshotObjects, supabaseInsert, supabaseRows, uploadSnapshotObject } from "./supabase-persistence.ts";

type Store = { version: 1; snapshots: OnePageSnapshot[] };
const emptyStore = (): Store => ({ version: 1, snapshots: [] });
export const ONE_PAGE_STORE_PATH = () => localDataPath("one-pages.json");

function publicMediaPath(source: string) {
  if (!source.startsWith("/layouts/") && !source.startsWith("/renders/") && !source.startsWith("/project-renders/")) throw new Error("INVALID_MEDIA_PATH");
  const publicRoot = path.resolve(process.cwd(), "public");
  const resolved = path.resolve(publicRoot, `.${source}`);
  if (!resolved.startsWith(`${publicRoot}${path.sep}`)) throw new Error("INVALID_MEDIA_PATH");
  return resolved;
}

async function freezeMedia(snapshot: OnePageSnapshot) {
  const directory = localDataPath(path.join("media", snapshot.id));
  await mkdir(directory, { recursive: true });
  const hasLayout = Boolean(snapshot.mediaSnapshot.layoutPath);
  const roomRenderCount = snapshot.mediaSnapshot.renderPaths.length;
  const sources = [snapshot.mediaSnapshot.layoutPath, ...snapshot.mediaSnapshot.renderPaths, ...snapshot.mediaSnapshot.projectRenderPaths].filter((value): value is string => Boolean(value));
  const copied: string[] = [];
  for (let index = 0; index < sources.length; index += 1) {
    const extension = path.extname(sources[index]) || ".jpg";
    const fileName = `${index}${extension}`;
    await copyFile(publicMediaPath(sources[index]), path.join(directory, fileName));
    copied.push(`/api/one-pages/${snapshot.id}/media/${fileName}`);
  }
  snapshot.mediaSnapshot.layoutPath = hasLayout ? copied[0] : null;
  const roomStart = hasLayout ? 1 : 0;
  snapshot.mediaSnapshot.renderPaths = copied.slice(roomStart, roomStart + roomRenderCount);
  snapshot.mediaSnapshot.projectRenderPaths = copied.slice(roomStart + roomRenderCount);
}

function contentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return extension === ".webp" ? "image/webp" : extension === ".png" ? "image/png" : "image/jpeg";
}

function isMissingSnapshotObject(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  if (error.status === 404) return true;
  if (error.status !== 400 || !("detail" in error) || typeof error.detail !== "string") return false;
  try {
    const detail: unknown = JSON.parse(error.detail);
    return Boolean(
      detail && typeof detail === "object"
      && "statusCode" in detail && detail.statusCode === "404"
      && "error" in detail && detail.error === "not_found"
      && "code" in detail && detail.code === "NoSuchKey",
    );
  } catch {
    return false;
  }
}

async function freezeMediaInSupabase(snapshot: OnePageSnapshot) {
  const hasLayout = Boolean(snapshot.mediaSnapshot.layoutPath);
  const roomRenderCount = snapshot.mediaSnapshot.renderPaths.length;
  const sources = [snapshot.mediaSnapshot.layoutPath, ...snapshot.mediaSnapshot.renderPaths, ...snapshot.mediaSnapshot.projectRenderPaths].filter((value): value is string => Boolean(value));
  const objectPaths: string[] = [];
  try {
    for (let index = 0; index < sources.length; index += 1) {
      const extension = path.extname(sources[index]) || ".jpg";
      const fileName = `${index}${extension}`;
      const objectPath = `one-pages/${snapshot.id}/${fileName}`;
      await uploadSnapshotObject(objectPath, await readFile(publicMediaPath(sources[index])), contentType(fileName));
      objectPaths.push(objectPath);
    }
  } catch (error) {
    await removeSnapshotObjects(objectPaths).catch(() => undefined);
    throw error;
  }
  const urls = objectPaths.map((objectPath) => `/api/one-pages/${snapshot.id}/media/${path.basename(objectPath)}`);
  snapshot.mediaSnapshot.layoutPath = hasLayout ? urls[0] : null;
  const roomStart = hasLayout ? 1 : 0;
  snapshot.mediaSnapshot.renderPaths = urls.slice(roomStart, roomStart + roomRenderCount);
  snapshot.mediaSnapshot.projectRenderPaths = urls.slice(roomStart + roomRenderCount);
  return objectPaths;
}

export async function saveOnePageSnapshot(snapshot: OnePageSnapshot) {
  if (isSupabasePersistence()) {
    const objectPaths = await freezeMediaInSupabase(snapshot);
    try {
      await supabaseInsert("co_builder_one_page_snapshots", { id: snapshot.id, created_at: snapshot.createdAt, payload: snapshot });
      return snapshot;
    } catch (error) {
      await removeSnapshotObjects(objectPaths).catch(() => undefined);
      throw error;
    }
  }
  await freezeMedia(snapshot);
  const path = ONE_PAGE_STORE_PATH();
  const store = await readJsonFile(path, emptyStore());
  store.snapshots.push(snapshot);
  await writeJsonFile(path, store);
  return snapshot;
}

export function getOnePageMediaPath(id: string, fileName: string) {
  if (!/^[0-9]+\.(jpg|jpeg|png|webp)$/i.test(fileName)) return null;
  return localDataPath(path.join("media", id, fileName));
}

export async function getOnePageSnapshot(id: string) {
  if (isSupabasePersistence()) {
    const rows = await supabaseRows<{ payload: OnePageSnapshot }>(`co_builder_one_page_snapshots?select=payload&id=eq.${encodeURIComponent(id)}&limit=1`);
    return rows[0]?.payload ?? null;
  }
  const store = await readJsonFile(ONE_PAGE_STORE_PATH(), emptyStore());
  return store.snapshots.find((snapshot) => snapshot.id === id) ?? null;
}

export async function getOnePageMedia(id: string, fileName: string) {
  if (!/^[0-9]+\.(jpg|jpeg|png|webp)$/i.test(fileName)) return null;
  if (isSupabasePersistence()) {
    try {
      const response = await downloadSnapshotObject(`one-pages/${id}/${fileName}`);
      return { data: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") || contentType(fileName) };
    } catch (error) {
      if (isMissingSnapshotObject(error)) return null;
      throw error;
    }
  }
  try {
    return { data: await readFile(localDataPath(path.join("media", id, fileName))), contentType: contentType(fileName) };
  } catch {
    return null;
  }
}
