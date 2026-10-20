import "server-only";

import { getSupabaseServerConfig } from "./persistence-config.ts";

function headers(extra?: HeadersInit) {
  const { serviceRoleKey } = getSupabaseServerConfig();
  return { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, ...extra };
}

async function checked(response: Response) {
  if (response.ok) return response;
  const body = await response.text();
  const error = new Error(`SUPABASE_REQUEST_FAILED:${response.status}`);
  Object.assign(error, { status: response.status, detail: body.slice(0, 500) });
  throw error;
}

export async function supabaseRows<T>(path: string): Promise<T[]> {
  const { url } = getSupabaseServerConfig();
  const response = await checked(await fetch(`${url}/rest/v1/${path}`, { headers: headers(), cache: "no-store" }));
  return response.json() as Promise<T[]>;
}

export async function supabaseInsert(table: string, value: unknown) {
  const { url } = getSupabaseServerConfig();
  return checked(await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({ "content-type": "application/json", prefer: "return=minimal" }),
    body: JSON.stringify(value),
  }));
}

export async function supabaseRpc<T>(name: string, value: unknown): Promise<T> {
  const { url } = getSupabaseServerConfig();
  const response = await checked(await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify(value),
  }));
  return response.json() as Promise<T>;
}

export async function uploadSnapshotObject(objectPath: string, data: Uint8Array, contentType: string) {
  const { url, bucket } = getSupabaseServerConfig();
  await checked(await fetch(`${url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: headers({ "content-type": contentType, "x-upsert": "false" }),
    body: Buffer.from(data),
  }));
}

export async function downloadSnapshotObject(objectPath: string) {
  const { url, bucket } = getSupabaseServerConfig();
  return checked(await fetch(`${url}/storage/v1/object/authenticated/${bucket}/${objectPath}`, { headers: headers(), cache: "force-cache" }));
}

export async function removeSnapshotObjects(objectPaths: string[]) {
  if (objectPaths.length === 0) return;
  const { url, bucket } = getSupabaseServerConfig();
  await checked(await fetch(`${url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify({ prefixes: objectPaths }),
  }));
}
