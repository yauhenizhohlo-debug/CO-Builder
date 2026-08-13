# Milestone 4 — versioned proposal import

Imported mode consumes an immutable sanitized ProposalVersion from Inventory. Builder maps the saved Unit, optional PurchaseScenario projection and optional InvestmentCase projection into presentation components. Imported mode does not call legacy purchase or investment calculators; changing economics requires a new version from Sales Workspace.

Legacy Builder mode remains available without a `context` query. The return action preserves the Unit and SellSession. Client-facing rendering excludes engine metadata, assumptions and authoritative internal rows.
