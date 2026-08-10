# Builder integration audit

Builder is a single Next.js route. Its legacy flow selects a room from `app/data/rooms.ts`, calculates installment or tranche mortgage in client components, stores the result in React context, renders a three-page proposal, and exports through `window.print()`. It has no backend, saved calculation, Inventory lookup, or investment section.

The additive `?context=<uuid>` flow uses a server proxy to Inventory, then renders the stored unit, payment and investment snapshots without recalculation. Without `context`, all existing behavior remains unchanged. Snapshot fields auto-fill number, floor, area, view, price, payment schedule/stages and investment summary. Live price/status warnings never mutate the proposal.
# Builder integration audit

The imported-context path is isolated from the ordinary Builder path by the `context` query parameter. Legacy room selection, installment, tranche-mortgage calculations, and their state providers remain mounted only for the context-free route.

Imported results are parsed and mapped, not recalculated. Both imported installment and tranche-mortgage snapshots feed the existing premium three-page proposal. Floorplans and render sets are resolved through the same room-number mappings used by the ordinary Builder.

Runtime boundaries:

- Inventory response: `packages/proposal-contract/src/index.ts`
- Server proxy: `app/api/inventory-context/[id]/route.ts`
- Money conversion: `app/lib/proposal-money.ts`
- Snapshot mapping: `app/lib/map-imported-proposal.ts`
- Imported UI: `app/components/imported-inventory-context.tsx`
- Shared print UI: `app/components/proposal-preview.tsx`

Standard single-tranche annuity mortgage (`MORTGAGE`) is present in contract v1 but intentionally not exposed by the imported premium Proposal milestone. `INSTALLMENT` and `TRANCHE_MORTGAGE` are supported.
