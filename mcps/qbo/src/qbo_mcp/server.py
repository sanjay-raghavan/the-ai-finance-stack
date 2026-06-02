"""QBO Bundled MCP Server — stdio transport, read-only v0.1.

Runs as a long-lived process that Claude Desktop (or any MCP client) talks to
over stdio. Each tool call invokes one of the read-only functions in tools.py.

Usage:
  python -m qbo_mcp.server --setup     # one-time OAuth flow
  python -m qbo_mcp.server              # run the MCP server (called by Claude)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from . import __version__, auth, tools
from .client import QBOClient
from .config import Config, load_config

logger = logging.getLogger("qbo_mcp")


# ─────────────────────────────────────────────────────────────────────────────
# Tool registry — name -> (callable, JSON schema for inputs, description)
# ─────────────────────────────────────────────────────────────────────────────


def _build_tool_registry(client: QBOClient) -> dict[str, dict[str, Any]]:
    """Build the registry of tools the MCP server exposes.

    Each entry has:
      - 'fn': async callable that takes (**kwargs) -> dict
      - 'schema': JSON Schema describing accepted args
      - 'description': human-readable tool description (the LLM sees this)
    """
    return {
        "company_info_get": {
            "fn": lambda **kw: tools.company_info_get(client),
            "schema": {"type": "object", "properties": {}, "required": []},
            "description": (
                "Return basic company info from QBO — entity name, fiscal year start, "
                "country, supported currencies. Use when you need to confirm which "
                "company's books you're looking at, or check the fiscal calendar."
            ),
        },
        "chart_of_accounts_get": {
            "fn": lambda **kw: tools.chart_of_accounts_get(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "active_only": {
                        "type": "boolean",
                        "default": True,
                        "description": "If true (default), only return active accounts.",
                    },
                    "account_type": {
                        "type": "string",
                        "description": (
                            "Optional filter on AccountType — e.g., 'Expense', 'Income', "
                            "'Bank', 'Asset', 'Liability', 'Equity', 'Cost of Goods Sold'."
                        ),
                    },
                },
            },
            "description": (
                "List accounts in the QBO chart of accounts. Optionally filter to active "
                "accounts and/or a specific account type. Returns each account's Id, "
                "Name, AccountType, AccountSubType, AcctNum, and CurrentBalance."
            ),
        },
        "closing_date_get": {
            "fn": lambda **kw: tools.closing_date_get(client),
            "schema": {"type": "object", "properties": {}, "required": []},
            "description": (
                "Return the company's books-closing date setting and other "
                "accounting preferences. The closing date is what QBO Poster's "
                "approval-validation checks against to refuse posting into closed "
                "periods. Look at preferences.AccountingInfoPrefs.BookCloseDate in "
                "the response."
            ),
        },
        "recent_transactions_get": {
            "fn": lambda **kw: tools.recent_transactions_get(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "ISO date YYYY-MM-DD; defaults to 30 days ago.",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "ISO date YYYY-MM-DD; defaults to today.",
                    },
                    "entity_type": {
                        "type": "string",
                        "description": (
                            "Optional QBO entity type to filter — e.g., 'JournalEntry' "
                            "(default), 'Invoice', 'Bill', 'Payment', 'Deposit', 'Purchase'."
                        ),
                    },
                    "max_results": {
                        "type": "integer",
                        "default": 100,
                        "description": "Cap on rows; QBO allows up to 1000.",
                    },
                },
            },
            "description": (
                "Recent transactions of a given type, in a date range. Defaults to "
                "the last 30 days of journal entries. Useful for 'what JEs hit the "
                "books recently?' and similar drill-downs."
            ),
        },
        "journal_entry_get": {
            "fn": lambda **kw: tools.journal_entry_get(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "transaction_id": {
                        "type": "string",
                        "description": "QBO transaction ID (e.g., '102847').",
                    },
                },
                "required": ["transaction_id"],
            },
            "description": (
                "Fetch a single journal entry by its QBO transaction ID. Returns "
                "the full line items, dates, doc number, private note, and posting "
                "state. Used by QBO Poster's post-verification step in v0.2."
            ),
        },
        "journal_entries_search": {
            "fn": lambda **kw: tools.journal_entries_search(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "ISO date YYYY-MM-DD."},
                    "end_date": {"type": "string", "description": "ISO date YYYY-MM-DD."},
                    "doc_number": {
                        "type": "string",
                        "description": "Exact match on JE DocNumber.",
                    },
                    "private_note_contains": {
                        "type": "string",
                        "description": (
                            "Substring match in PrivateNote. In v0.1, external_id "
                            "from stack:proposal-format is stored here — useful for "
                            "idempotency checks."
                        ),
                    },
                    "max_results": {
                        "type": "integer",
                        "default": 100,
                    },
                },
            },
            "description": (
                "Search journal entries with optional date range, doc number, and "
                "private-note substring filters. Returns matching JEs sorted by "
                "TxnDate descending."
            ),
        },
        "vendor_search": {
            "fn": lambda **kw: tools.vendor_search(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "name_contains": {
                        "type": "string",
                        "description": "Substring of vendor display name.",
                    },
                    "active_only": {"type": "boolean", "default": True},
                    "max_results": {"type": "integer", "default": 50},
                },
            },
            "description": (
                "Find vendors by name substring match. Returns each match's Id, "
                "DisplayName, CompanyName, contact info, and current balance."
            ),
        },
        "customer_search": {
            "fn": lambda **kw: tools.customer_search(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "name_contains": {
                        "type": "string",
                        "description": "Substring of customer display name.",
                    },
                    "active_only": {"type": "boolean", "default": True},
                    "max_results": {"type": "integer", "default": 50},
                },
            },
            "description": (
                "Find customers by name substring match. Returns each match's Id, "
                "DisplayName, balance, and contact info."
            ),
        },
        "ap_aging_get": {
            "fn": lambda **kw: tools.ap_aging_get(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "as_of_date": {
                        "type": "string",
                        "description": "ISO date YYYY-MM-DD; defaults to today.",
                    },
                    "summary": {
                        "type": "boolean",
                        "default": True,
                        "description": (
                            "True (default) returns AP aging summarized by vendor "
                            "with aging buckets. False returns the detail version "
                            "with every open bill."
                        ),
                    },
                },
            },
            "description": (
                "Accounts payable aging report. Summary view groups by vendor with "
                "aging buckets (Current, 1-30, 31-60, 61-90, 91+). Detail view "
                "lists every open bill."
            ),
        },
        "ar_aging_get": {
            "fn": lambda **kw: tools.ar_aging_get(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "as_of_date": {
                        "type": "string",
                        "description": "ISO date YYYY-MM-DD; defaults to today.",
                    },
                    "summary": {
                        "type": "boolean",
                        "default": True,
                    },
                },
            },
            "description": (
                "Accounts receivable aging report. Summary groups by customer with "
                "aging buckets. Detail lists every open invoice. Used by "
                "AR Follow-Up agent."
            ),
        },
        "profit_and_loss_get": {
            "fn": lambda **kw: tools.profit_and_loss_get(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "ISO date YYYY-MM-DD."},
                    "end_date": {"type": "string", "description": "ISO date YYYY-MM-DD."},
                    "summarize_by": {
                        "type": "string",
                        "description": (
                            "Optional column grouping: 'Month', 'Quarter', 'Year', "
                            "'Customers', 'Vendors', 'Classes', 'Department', 'Days'."
                        ),
                    },
                    "department_id": {
                        "type": "string",
                        "description": "QBO Department ID to filter.",
                    },
                    "class_id": {
                        "type": "string",
                        "description": "QBO Class ID to filter.",
                    },
                    "accounting_method": {
                        "type": "string",
                        "enum": ["Accrual", "Cash"],
                        "default": "Accrual",
                    },
                },
                "required": ["start_date", "end_date"],
            },
            "description": (
                "Profit & Loss for a date range. Use this for questions like "
                "'how much did we spend on consulting this month?' (call with the "
                "current month dates, then filter the response by the Consulting "
                "expense account). Supports optional column grouping by month, "
                "quarter, vendor, customer, or class."
            ),
        },
        "transactions_by_account": {
            "fn": lambda **kw: tools.transactions_by_account(client, **kw),
            "schema": {
                "type": "object",
                "properties": {
                    "account_id": {
                        "type": "string",
                        "description": "QBO Account ID (from chart_of_accounts_get).",
                    },
                    "start_date": {"type": "string", "description": "ISO date YYYY-MM-DD."},
                    "end_date": {"type": "string", "description": "ISO date YYYY-MM-DD."},
                },
                "required": ["account_id"],
            },
            "description": (
                "Every transaction that hit a specific account in a date range. "
                "Useful for drill-down from a P&L line: 'show me the consulting "
                "transactions behind that $48K total this month.'"
            ),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# MCP server wiring
# ─────────────────────────────────────────────────────────────────────────────


async def _run_server(config: Config) -> None:
    """Run the MCP server over stdio."""
    tokens = auth.TokenManager(config)
    client = QBOClient(config, tokens)
    registry = _build_tool_registry(client)

    server: Server = Server("qbo-mcp", version=__version__)

    @server.list_tools()
    async def _list() -> list[Tool]:
        return [
            Tool(
                name=name,
                description=spec["description"],
                inputSchema=spec["schema"],
            )
            for name, spec in registry.items()
        ]

    @server.call_tool()
    async def _call(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        if name not in registry:
            raise ValueError(f"Unknown tool: {name}")
        try:
            result = await registry[name]["fn"](**(arguments or {}))
        except Exception as e:
            logger.exception("Tool %s failed", name)
            return [TextContent(type="text", text=f"Error: {e}")]
        # Return as a single JSON text block; clients deserialize as needed.
        import json

        return [TextContent(type="text", text=json.dumps(result, indent=2, default=str))]

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


def main() -> None:
    """Entry point — handles --setup flag, otherwise runs the MCP server."""
    parser = argparse.ArgumentParser(
        prog="qbo-mcp",
        description="QBO bundled MCP server (part of The AI Finance Stack)",
    )
    parser.add_argument(
        "--setup",
        action="store_true",
        help="Run the one-time OAuth flow to authenticate against Intuit and save credentials.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"qbo-mcp {__version__}",
    )
    args = parser.parse_args()

    config = load_config()
    logging.basicConfig(
        level=getattr(logging, config.log_level, logging.INFO),
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        stream=sys.stderr,
    )

    if args.setup:
        asyncio.run(auth.run_setup(config))
        return

    # Sanity check: warn if not set up yet (server will still start; first
    # tool call will fail with a helpful message).
    if auth.load_credentials(config) is None:
        logger.warning(
            "QBO MCP is not set up yet. Run: python -m qbo_mcp.server --setup"
        )

    asyncio.run(_run_server(config))


if __name__ == "__main__":
    main()
