"""The 12 read-only tools the QBO MCP exposes.

Each tool is an async function that takes a `QBOClient` and tool-specific
arguments, returns a JSON-serializable dict. They're registered with the MCP
server in server.py.

v0.1 scope is intentionally read-only. Write tools (journal_entry_create, etc.)
will be added in v0.2 once the propose -> approve -> post pipeline is wired
end-to-end through QBO Poster.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Optional

from .client import QBOClient


# ─────────────────────────────────────────────────────────────────────────────
# 1. Company info
# ─────────────────────────────────────────────────────────────────────────────


async def company_info_get(client: QBOClient) -> dict[str, Any]:
    """Return basic company info (entity name, fiscal year start, etc.)."""
    realm_id = client._tokens.realm_id  # type: ignore[attr-defined]
    return await client.get(f"/companyinfo/{realm_id}")


# ─────────────────────────────────────────────────────────────────────────────
# 2. Chart of accounts
# ─────────────────────────────────────────────────────────────────────────────


async def chart_of_accounts_get(
    client: QBOClient,
    active_only: bool = True,
    account_type: Optional[str] = None,
) -> dict[str, Any]:
    """List accounts in the chart of accounts."""
    where = []
    if active_only:
        where.append("Active = true")
    if account_type:
        where.append(f"AccountType = '{account_type}'")
    where_clause = "WHERE " + " AND ".join(where) if where else ""
    # QBO doesn't support ORDER BY AccountType (not sortable). Sort by Name only.
    sql = f"SELECT * FROM Account {where_clause} ORDER BY Name MAXRESULTS 1000"
    return await client.query(sql)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Closing date (for closed-period checks)
# ─────────────────────────────────────────────────────────────────────────────


async def closing_date_get(client: QBOClient) -> dict[str, Any]:
    """Return the company's books-closing date (if set).

    This is what the QBO Poster's approval-validation skill checks against to
    refuse posting into a closed period. Returns the raw Preferences object;
    callers should look at preferences.AccountingInfoPrefs.BookCloseDate.
    """
    return await client.get("/preferences")


# ─────────────────────────────────────────────────────────────────────────────
# 4. Recent transactions
# ─────────────────────────────────────────────────────────────────────────────


async def recent_transactions_get(
    client: QBOClient,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    entity_type: Optional[str] = None,
    max_results: int = 100,
) -> dict[str, Any]:
    """Recent transactions across the company.

    Args:
      start_date: ISO date (YYYY-MM-DD). Defaults to 30 days ago.
      end_date: ISO date. Defaults to today.
      entity_type: optional filter — JournalEntry, Invoice, Bill, Payment, etc.
      max_results: cap on rows returned (max 1000 per QBO).
    """
    if not start_date:
        start_date = (date.today() - timedelta(days=30)).isoformat()
    if not end_date:
        end_date = date.today().isoformat()

    # QBO doesn't have a single "transactions" entity — we query by type.
    if entity_type:
        entity = entity_type
    else:
        entity = "JournalEntry"  # default; agents most commonly want JEs
    sql = (
        f"SELECT * FROM {entity} "
        f"WHERE TxnDate >= '{start_date}' AND TxnDate <= '{end_date}' "
        f"ORDER BY TxnDate DESC MAXRESULTS {max_results}"
    )
    return await client.query(sql)


# ─────────────────────────────────────────────────────────────────────────────
# 5. Journal entry by ID
# ─────────────────────────────────────────────────────────────────────────────


async def journal_entry_get(client: QBOClient, transaction_id: str) -> dict[str, Any]:
    """Fetch a single journal entry by its QBO transaction ID.

    Used by QBO Poster's post-verification step (in v0.2 once writes are live).
    Also useful for debugging: "show me what JE 102847 actually contains."
    """
    return await client.get(f"/journalentry/{transaction_id}")


# ─────────────────────────────────────────────────────────────────────────────
# 6. Journal entries — search with filters
# ─────────────────────────────────────────────────────────────────────────────


async def journal_entries_search(
    client: QBOClient,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    doc_number: Optional[str] = None,
    private_note_contains: Optional[str] = None,
    max_results: int = 100,
) -> dict[str, Any]:
    """Search journal entries with optional filters.

    Args:
      start_date / end_date: ISO date range.
      doc_number: exact match on DocNumber.
      private_note_contains: substring match in PrivateNote (this is where
        v0.1 stores external_id for idempotency — see stack:proposal-format).
      max_results: cap on rows (default 100).
    """
    where = []
    if start_date:
        where.append(f"TxnDate >= '{start_date}'")
    if end_date:
        where.append(f"TxnDate <= '{end_date}'")
    if doc_number:
        where.append(f"DocNumber = '{doc_number}'")
    if private_note_contains:
        # QQL supports LIKE with % wildcards
        safe = private_note_contains.replace("'", "''")
        where.append(f"PrivateNote LIKE '%{safe}%'")
    where_clause = "WHERE " + " AND ".join(where) if where else ""
    sql = (
        f"SELECT * FROM JournalEntry {where_clause} "
        f"ORDER BY TxnDate DESC MAXRESULTS {max_results}"
    )
    return await client.query(sql)


# ─────────────────────────────────────────────────────────────────────────────
# 7. Vendor search
# ─────────────────────────────────────────────────────────────────────────────


async def vendor_search(
    client: QBOClient,
    name_contains: Optional[str] = None,
    active_only: bool = True,
    max_results: int = 50,
) -> dict[str, Any]:
    """Find vendors by name (substring match)."""
    where = []
    if active_only:
        where.append("Active = true")
    if name_contains:
        safe = name_contains.replace("'", "''")
        where.append(f"DisplayName LIKE '%{safe}%'")
    where_clause = "WHERE " + " AND ".join(where) if where else ""
    sql = (
        f"SELECT * FROM Vendor {where_clause} "
        f"ORDER BY DisplayName MAXRESULTS {max_results}"
    )
    return await client.query(sql)


# ─────────────────────────────────────────────────────────────────────────────
# 8. Customer search
# ─────────────────────────────────────────────────────────────────────────────


async def customer_search(
    client: QBOClient,
    name_contains: Optional[str] = None,
    active_only: bool = True,
    max_results: int = 50,
) -> dict[str, Any]:
    """Find customers by name (substring match)."""
    where = []
    if active_only:
        where.append("Active = true")
    if name_contains:
        safe = name_contains.replace("'", "''")
        where.append(f"DisplayName LIKE '%{safe}%'")
    where_clause = "WHERE " + " AND ".join(where) if where else ""
    sql = (
        f"SELECT * FROM Customer {where_clause} "
        f"ORDER BY DisplayName MAXRESULTS {max_results}"
    )
    return await client.query(sql)


# ─────────────────────────────────────────────────────────────────────────────
# 9. AP aging
# ─────────────────────────────────────────────────────────────────────────────


async def ap_aging_get(
    client: QBOClient,
    as_of_date: Optional[str] = None,
    summary: bool = True,
) -> dict[str, Any]:
    """Accounts payable aging report.

    Args:
      as_of_date: defaults to today.
      summary: True = AgedPayables (summary by vendor); False = AgedPayableDetail.
    """
    report = "AgedPayables" if summary else "AgedPayableDetail"
    params: dict[str, Any] = {}
    if as_of_date:
        params["report_date"] = as_of_date
    return await client.report(report, **params)


# ─────────────────────────────────────────────────────────────────────────────
# 10. AR aging
# ─────────────────────────────────────────────────────────────────────────────


async def ar_aging_get(
    client: QBOClient,
    as_of_date: Optional[str] = None,
    summary: bool = True,
) -> dict[str, Any]:
    """Accounts receivable aging report.

    Args:
      as_of_date: defaults to today.
      summary: True = AgedReceivables (summary by customer); False = AgedReceivableDetail.
    """
    report = "AgedReceivables" if summary else "AgedReceivableDetail"
    params: dict[str, Any] = {}
    if as_of_date:
        params["report_date"] = as_of_date
    return await client.report(report, **params)


# ─────────────────────────────────────────────────────────────────────────────
# 11. Profit & Loss
# ─────────────────────────────────────────────────────────────────────────────


async def profit_and_loss_get(
    client: QBOClient,
    start_date: str,
    end_date: str,
    summarize_by: Optional[str] = None,
    department_id: Optional[str] = None,
    class_id: Optional[str] = None,
    accounting_method: str = "Accrual",
) -> dict[str, Any]:
    """Profit & Loss for a date range, optionally filtered/grouped.

    Args:
      start_date / end_date: ISO dates (required).
      summarize_by: 'Month', 'Quarter', 'Year', 'Customers', 'Vendors', 'Classes',
        'Department', or 'Days'. Default returns a single-column total.
      department_id: filter to a specific department (if Dept tracking is on).
      class_id: filter to a specific class (if Class tracking is on).
      accounting_method: 'Accrual' (default) or 'Cash'.

    Example use: "How much did we spend on consulting this month?"
        Call this with start_date and end_date set to the current month, then
        filter the response for the Consulting expense account.
    """
    params: dict[str, Any] = {
        "start_date": start_date,
        "end_date": end_date,
        "accounting_method": accounting_method,
    }
    if summarize_by:
        params["summarize_column_by"] = summarize_by
    if department_id:
        params["department"] = department_id
    if class_id:
        params["classid"] = class_id
    return await client.report("ProfitAndLoss", **params)


# ─────────────────────────────────────────────────────────────────────────────
# 12. Transactions by account
# ─────────────────────────────────────────────────────────────────────────────


async def transactions_by_account(
    client: QBOClient,
    account_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict[str, Any]:
    """Transactions hitting a specific account, in a date range.

    Uses QBO's TransactionList report, which is the underlying data view for
    drill-downs from P&L lines. Useful for "show me every transaction that
    hit account X this month."
    """
    if not start_date:
        start_date = (date.today() - timedelta(days=30)).isoformat()
    if not end_date:
        end_date = date.today().isoformat()
    return await client.report(
        "TransactionList",
        start_date=start_date,
        end_date=end_date,
        account=account_id,
    )
