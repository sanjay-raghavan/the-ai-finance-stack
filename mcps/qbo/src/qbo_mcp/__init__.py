"""QBO Bundled MCP Server — read-only in v0.1.

Part of The AI Finance Stack. Provides Claude (and other MCP-compatible clients)
read-only access to QuickBooks Online for the user's own books, under the user's
own OAuth grant. Credentials never leave the local machine.

Write capability (journal_entry_create, etc.) is intentionally not exposed in v0.1.
It will be added in v0.2 once the propose -> approve -> post pipeline is wired
up end to end. Until then, the QBO Poster agent is paused at the proposal stage.
"""

__version__ = "0.1.0"
