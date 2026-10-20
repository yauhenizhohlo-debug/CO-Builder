# CO Builder persistent storage readiness

## Current state

The default `local` mode intentionally keeps the existing development behavior:

- `.local-data/price-overrides.json` — latest room price overrides and append-only price history;
- `.local-data/proposal-snapshots.json` — Full Proposal snapshots;
- `.local-data/one-pages.json` — One Page snapshots;
- `.local-data/media/<snapshot-id>/` — frozen layout, room render and project render files.

These paths are safe for one local Node.js process. They are not durable on Vercel and must not be used as Production storage. A redeploy, cold instance replacement or a request routed to another instance can lose or hide data.

## Prepared production architecture

Set `CO_BUILDER_PERSISTENCE=supabase` only after the database migration and private Storage bucket are verified.

- PostgreSQL stores current price overrides, immutable price history, Full Proposal snapshots and One Page snapshots.
- `co_builder_save_price_override` locks the current room row and writes the new price plus history in one transaction. The caller supplies the price it observed; stale writers receive `PRICE_CONFLICT`.
- Snapshot tables reject `UPDATE` and `DELETE`, including privileged accidental mutations.
- A private `co-builder-snapshots` Storage bucket stores frozen media under `one-pages/<snapshot-id>/<index>.<ext>` with `upsert=false`.
- The application continues serving media through its existing `/api/one-pages/:id/media/:fileName` route. The service-role key stays server-only.
- If a media upload or snapshot insert fails, the adapter attempts compensating deletion. The immutable DB row is inserted only after every object upload succeeds.

## Access model and API limits

Database tables have RLS enabled and all privileges are revoked from `anon` and `authenticated`. Only the server-side service role is used by the adapter. The service key must never be exposed through a `NEXT_PUBLIC_` variable.

The price editor remains protected by the existing signed, HTTP-only admin cookie. Price writes now include `expectedPrice` and return HTTP 409 for a concurrent edit.

Snapshot creation remains available to the current Builder workflow, but is bounded server-side: 20 Full Proposal or 20 One Page creations per client/hour and 500 snapshot documents globally/day. Admin login is limited to 5 attempts/15 minutes and 50/day; price writes are limited to 30/hour. In Supabase mode these counters use the atomic `co_builder_consume_rate_limit` PostgreSQL function and fail closed if the security service is unavailable. The in-memory implementation is development-only.

Snapshot request bodies are size-limited before JSON parsing (2 MiB Full Proposal, 512 KiB One Page, 8 KiB admin login). Runtime validators constrain strings, arrays, payment rows and One Page media to one layout, at most six room renders and three project renders. Source media paths are allow-listed below `public/layouts`, `public/renders` and `public/project-renders`, resolved against the public root, and cannot contain traversal segments.

Snapshot identifiers are cryptographically random UUID v4 capability identifiers. Read routes accept only canonical UUID v4 values, expose no listing endpoint and provide no update/delete endpoint. Possession of the public document link grants read-only access to that one immutable snapshot; it does not grant enumeration or mutation. Frozen media remains in a private bucket and is streamed through the ID-scoped server route after strict UUID/file-name validation. If per-user revocation or auditable sharing becomes a requirement, add authenticated manager/recipient grants rather than weakening the private bucket.

## Migration procedure

1. Freeze price edits and snapshot creation for a short maintenance window.
2. Back up `.local-data` as a timestamped archive and record SHA-256 hashes plus record/file counts.
3. Create a separate Supabase Preview project/branch and a private bucket named `co-builder-snapshots`.
4. Apply all three migrations, in filename order, to Preview only:
   - `supabase/migrations/20261017153505_co_builder_persistence.sql`;
   - `supabase/migrations/20261017184000_snapshot_api_security.sql`;
   - `supabase/migrations/20261020121327_fix_immutable_trigger_search_path.sql`.
5. Run database security/advisor checks and verify `anon`/`authenticated` cannot read or write any Builder table or bucket.
6. Import price history in chronological order, then verify the latest override for every room.
7. Upload each snapshot media directory with `upsert=false`; insert the corresponding immutable snapshot only after all objects exist.
8. Reconcile counts, IDs, payload hashes and media SHA-256 hashes against the local backup.
9. Deploy a Preview with `CO_BUILDER_PERSISTENCE=supabase`; run concurrent-price, save/reopen, immutable-media, Full Proposal and One Page PDF tests.
10. Repeat the same three-migration chain against a new empty Production Supabase project only after explicit approval. Set Production environment variables and redeploy during the write freeze.
11. Reconcile again, then unfreeze writes. Keep the local archive read-only for the rollback window.

The isolated Preview rehearsal completed with all three migrations applied, a clean Security Advisor report, immutable-trigger verification and an export/reconciliation dry run. This proves the procedure, but does not authorize reuse of the Preview database or its credentials in Production.

## Rollback

1. Stop writes immediately.
2. Export all Supabase rows and Storage objects created since cutover.
3. Compare them to the original archive and append post-cutover data to a new local recovery directory; never overwrite the original backup.
4. Restore the export into a new isolated recovery database/project and reconcile it before changing any live application configuration. Keep the original Production database and bucket intact and read-only during recovery.
5. Deploy the last known-good application against the verified recovery database, test it without moving the public alias, then promote the alias only after prices, history, snapshot IDs and media hashes match.

Do not use `CO_BUILDER_PERSISTENCE=local` as a Vercel rollback target: its filesystem is ephemeral and therefore cannot provide durable, lossless recovery. The Preview export/import dry run has been completed; Production rollback still requires a fresh pre-cutover backup and a post-cutover delta export.
