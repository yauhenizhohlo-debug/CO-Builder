# Builder integration audit

Builder is a single Next.js route. Its legacy flow selects a room from `app/data/rooms.ts`, calculates installment or tranche mortgage in client components, stores the result in React context, renders a three-page proposal, and exports through `window.print()`. It has no backend, saved calculation, Inventory lookup, or investment section.

The additive `?context=<uuid>` flow uses a server proxy to Inventory, then renders the stored unit, payment and investment snapshots without recalculation. Without `context`, all existing behavior remains unchanged. Snapshot fields auto-fill number, floor, area, view, price, payment schedule/stages and investment summary. Live price/status warnings never mutate the proposal.
