# Inventory context integration

Set `INVENTORY_API_URL` to the trusted Inventory origin. `/?context=<uuid>` proxies ProposalContext schema version 1 server-to-server. Imported results are authoritative and are never recalculated by Builder. The context-free route remains unchanged. Wildcard CORS is not enabled.
