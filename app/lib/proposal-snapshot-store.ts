import "server-only";

import { localDataPath, readJsonFile, writeJsonFile } from "./local-json-store.ts";
import type { ProposalSnapshot } from "./proposal-snapshot.ts";
import { isSupabasePersistence } from "./persistence-config.ts";
import { supabaseInsert, supabaseRows } from "./supabase-persistence.ts";

type Store = { version: 1; snapshots: ProposalSnapshot[] };
const emptyStore = (): Store => ({ version: 1, snapshots: [] });
const storePath = () => localDataPath("proposal-snapshots.json");

export async function saveProposalSnapshot(snapshot: ProposalSnapshot) {
  if (isSupabasePersistence()) {
    await supabaseInsert("co_builder_proposal_snapshots", { id: snapshot.id, created_at: snapshot.createdAt, payload: snapshot });
    return snapshot;
  }
  const store = await readJsonFile(storePath(), emptyStore());
  store.snapshots.push(snapshot);
  await writeJsonFile(storePath(), store);
  return snapshot;
}

export async function getProposalSnapshot(id: string) {
  if (isSupabasePersistence()) {
    const rows = await supabaseRows<{ payload: ProposalSnapshot }>(`co_builder_proposal_snapshots?select=payload&id=eq.${encodeURIComponent(id)}&limit=1`);
    return rows[0]?.payload ?? null;
  }
  const store = await readJsonFile(storePath(), emptyStore());
  return store.snapshots.find((snapshot) => snapshot.id === id) ?? null;
}
