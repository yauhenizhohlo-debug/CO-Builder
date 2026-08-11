# Inventory context integration

## Request flow

1. Inventory creates an immutable `ProposalContext` schema v2. Builder keeps read compatibility with schema v1.
2. Inventory opens Builder at `/?context=<uuid>`.
3. Builder fetches its same-origin `/api/inventory-context/<uuid>` route.
4. The server route reads `INVENTORY_API_URL` and `PROPOSAL_BUILDER_TOKEN`, proxies the trusted Inventory API with bearer authentication, and validates the response with `@cosmos/proposal-contract` before returning it to the browser.
5. Builder validates again at the client boundary, converts Money from kopecks in one mapping layer, resolves local assets by snapshot `unitNumber`, and passes the mapped snapshot to the existing premium three-page `ProposalPreview`.

The context-free Builder route is unchanged. Wildcard CORS is not enabled.

Schema v2 also carries `sourceApp` and `returnUrl`. Builder only renders the return link when its origin matches `NEXT_PUBLIC_INVENTORY_ORIGIN` and its path belongs to `/inventory/cosmos-black-sea/`.

Production environment variables:

```text
INVENTORY_API_URL=https://cosmos-inventory.vercel.app
NEXT_PUBLIC_INVENTORY_ORIGIN=https://cosmos-inventory.vercel.app
PROPOSAL_BUILDER_TOKEN=<shared secret>
```

## Snapshot and live data

`data.unitSnapshot`, `data.payment.inputs`, and `data.payment.result` are authoritative snapshot data. Builder does not call its installment or mortgage calculators for imported contexts.

`liveCheck` is warning-only data. A changed live price or status produces a warning but never overwrites snapshot values.

## Money

All contract Money values are integer kopecks. `app/lib/proposal-money.ts` is the only conversion/formatting boundary. `app/lib/map-imported-proposal.ts` converts snapshot payment data to the ruble-based view model expected by the existing Proposal UI.

## Contract package

The deployable contract lives at `packages/proposal-contract`. It is the single source for TypeScript types and runtime parsing. `packages/proposal-contract/dist/index.js` is generated from `src/index.ts` by `npm run build:contract`, which is also run by `prebuild`.

No sibling repository is required during install or build.

## Local E2E fixture

Run `node tests/mock-inventory-server.mjs`, then start Builder with:

```bash
INVENTORY_API_URL=http://127.0.0.1:3101 npm run dev
```

Fixture URLs:

- Tranche mortgage: `/?context=11111111-1111-4111-8111-111111111111`
- Installment: `/?context=22222222-2222-4222-8222-222222222222`

The fixtures use production Money units and room 704 assets.
