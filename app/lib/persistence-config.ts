import "server-only";

export type PersistenceMode = "local" | "supabase";

export function getPersistenceMode(): PersistenceMode {
  return process.env.CO_BUILDER_PERSISTENCE === "supabase" ? "supabase" : "local";
}

export function isSupabasePersistence() {
  return getPersistenceMode() === "supabase";
}

export function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_SNAPSHOT_BUCKET || "co-builder-snapshots";
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_PERSISTENCE_NOT_CONFIGURED");
  return { url, serviceRoleKey, bucket };
}
