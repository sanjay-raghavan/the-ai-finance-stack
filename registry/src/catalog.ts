// Catalog of agents and shared skills in The AI Finance Stack.
// This is the canonical inventory the MCP registry exposes.
// Update this file when shipping new agents or skills.

export const REPO_OWNER = "sanjay-raghavan";
export const REPO_NAME = "the-ai-finance-stack";
export const REPO_BRANCH = "main";

export const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}`;
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

export type Pack = "core" | "crypto" | "execution";
export type Status = "shipped" | "v0.2" | "v0.3";

export interface AgentEntry {
  /** Agent folder name in /agents/, also used as install id */
  id: string;
  /** Slack-style handle (with @) */
  handle: string;
  /** Display name */
  name: string;
  /** Functional area (Controller / FP&A / Treasury / etc.) */
  function: string;
  /** Which pack this agent belongs to */
  pack: Pack;
  /** One-line description */
  description: string;
  /** Required MCPs the user must have connected */
  mcps_required: string[];
  /** Skills inside this agent's own skills/ folder */
  agent_skills: string[];
  /** Shared skills this agent imports (stack:<name>) */
  stack_skills: string[];
  /** Whether this agent writes to the GL (only execution-pack agents do) */
  writes_to_gl: boolean;
  /** Status */
  status: Status;
}

export interface SkillEntry {
  /** Skill name (referenced as stack:<id>) */
  id: string;
  /** Display name */
  name: string;
  /** What this skill standardizes */
  description: string;
  /** Which agents import it */
  used_by: string[];
  /** Status */
  status: Status;
}

export const AGENTS: AgentEntry[] = [
  // ============ CORE PACK (10) ============
  {
    id: "controller",
    handle: "@controller",
    name: "Controller",
    function: "Controller / Accounting",
    pack: "core",
    description:
      "Owns the month-end close, accruals, reconciliations, and the books. Proposes JEs that the human approves and QBO Poster commits.",
    mcps_required: ["quickbooks", "slack"],
    agent_skills: ["close-calendar", "accrual-entries", "reconciliations"],
    stack_skills: ["stack:proposal-format", "stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },
  {
    id: "fpa-analyst",
    handle: "@fpa-analyst",
    name: "FP&A Analyst",
    function: "FP&A",
    pack: "core",
    description:
      "Variance analysis with driver decomposition (Volume × Rate × Mix), rolling forecast refresh, Bull/Base/Bear scenario maintenance, and full 2-week annual budget build cycle plus quarterly re-forecast.",
    mcps_required: ["quickbooks", "slack"],
    agent_skills: ["budget-build", "variance-decomposition", "forecast-refresh", "scenario-flex"],
    stack_skills: ["stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },
  {
    id: "treasury",
    handle: "@treasury",
    name: "Treasury",
    function: "Treasury",
    pack: "core",
    description:
      "Cash position snapshots, 13-week cash projection, runway calculation with confidence bands. PSP-aware (separates merchant float from operating cash).",
    mcps_required: ["mercury", "slack"],
    agent_skills: ["cash-position-snapshot", "thirteen-week-projection", "runway-calc"],
    stack_skills: ["stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },
  {
    id: "investor-relations",
    handle: "@ir",
    name: "Investor Relations",
    function: "Investor Relations",
    pack: "core",
    description:
      "Drafts monthly investor updates, prepares quarterly board pre-reader materials, watches KPIs against narrative arc.",
    mcps_required: ["quickbooks", "slack"],
    agent_skills: ["investor-update-draft", "board-prereader", "kpi-watch"],
    stack_skills: ["stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },
  {
    id: "ap-watcher",
    handle: "@ap-watcher",
    name: "AP Watcher",
    function: "Accounts Payable",
    pack: "core",
    description:
      "Validates vendor invoices, detects duplicates, manages vendor contracts, prepares payment runs, proposes accruals for missing invoices at month-end.",
    mcps_required: ["quickbooks", "slack"],
    agent_skills: ["invoice-validation", "payment-run"],
    stack_skills: ["stack:proposal-format", "stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },
  {
    id: "ar-follow-up",
    handle: "@ar-follow-up",
    name: "AR Follow-Up",
    function: "Accounts Receivable",
    pack: "core",
    description:
      "Tone-matched collections drafts (Good/Standard/Repeat-Late/Chronic), DSO tracking, deal line-item validation against revenue recognition rules.",
    mcps_required: ["quickbooks", "slack"],
    agent_skills: ["aging-analysis", "collection-drafts"],
    stack_skills: ["stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },
  {
    id: "revenue-ops",
    handle: "@revenue-ops",
    name: "Revenue Ops",
    function: "Revenue Operations",
    pack: "core",
    description:
      "Commission calculations, ARR reconciliation, deal-desk support, quota attainment tracking. Proposes commission accrual entries each month.",
    mcps_required: ["hubspot", "slack"],
    agent_skills: ["commission-run", "arr-reconciliation"],
    stack_skills: ["stack:proposal-format", "stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },
  {
    id: "payroll-reviewer",
    handle: "@payroll-reviewer",
    name: "Payroll Reviewer",
    function: "Payroll",
    pack: "core",
    description:
      "Pre-run payroll variance review, headcount cost tracking, comp/equity review. Privacy-restricted (scoped fields, restricted Slack channel).",
    mcps_required: ["gusto", "slack"],
    agent_skills: ["payroll-prereview", "headcount-cost-tracking"],
    stack_skills: ["stack:proposal-format", "stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },
  {
    id: "prepay-manager",
    handle: "@prepay-manager",
    name: "Prepay Manager",
    function: "Prepaid Accounting",
    pack: "core",
    description:
      "Full prepayment lifecycle: identification from new bills, amortization schedule generation, monthly amortization JE proposals, balance reconciliation.",
    mcps_required: ["quickbooks", "slack"],
    agent_skills: ["prepay-identification", "amortization-schedule", "monthly-amortization"],
    stack_skills: ["stack:proposal-format", "stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },
  {
    id: "bank-recon",
    handle: "@bank-recon",
    name: "Bank Recon",
    function: "Cash & Banking",
    pack: "core",
    description:
      "Daily transaction matching across all bank/processor accounts, unmatched-item investigation, period-end attestation. Coordinates with AP/AR/Treasury for context-boosted matching scores.",
    mcps_required: ["mercury", "quickbooks", "slack"],
    agent_skills: ["transaction-matching", "unmatched-investigation", "period-end-attestation"],
    stack_skills: ["stack:proposal-format", "stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },

  // ============ INDUSTRY PACK — CRYPTO (1) ============
  {
    id: "crypto-reconciler",
    handle: "@crypto-reconciler",
    name: "Crypto Reconciler",
    function: "Crypto Accounting",
    pack: "crypto",
    description:
      "Multi-chain wallet reconciliation, gas/fee separation, cost-basis sanity checks. For companies with crypto on the balance sheet (Tres Finance / Bitwave / Integral subledgers).",
    mcps_required: ["bitwave", "quickbooks", "slack"],
    agent_skills: ["wallet-recon", "gas-and-fees-tracking"],
    stack_skills: ["stack:proposal-format", "stack:slack-conventions"],
    writes_to_gl: false,
    status: "shipped",
  },

  // ============ EXECUTION PACK (1) ============
  {
    id: "qbo-poster",
    handle: "@qbo-poster",
    name: "QBO Poster",
    function: "Execution Layer",
    pack: "execution",
    description:
      "The ONLY agent permitted to write to QuickBooks Online. Reads approval records, runs 8-check validation pipeline, posts to QBO via MCP, verifies the post landed, writes confirmation. Idempotent, audit-grade, halt-on-anything-unexpected discipline. propose → human approve → post.",
    mcps_required: ["quickbooks", "slack"],
    agent_skills: ["approval-validation", "post-to-qbo", "reversal-handling"],
    stack_skills: [
      "stack:proposal-format",
      "stack:approval-record-format",
      "stack:slack-conventions",
    ],
    writes_to_gl: true,
    status: "shipped",
  },
];

export const SHARED_SKILLS: SkillEntry[] = [
  {
    id: "proposal-format",
    name: "Proposal Format",
    description:
      "Canonical YAML schema for a JE proposal: proposal_id, external_id, content_hash, line items, auto_reverse, reverses_transaction_id. The contract that holds the propose→approve→post pipeline together.",
    used_by: [
      "controller",
      "prepay-manager",
      "ap-watcher",
      "revenue-ops",
      "payroll-reviewer",
      "bank-recon",
      "crypto-reconciler",
      "qbo-poster",
    ],
    status: "shipped",
  },
  {
    id: "approval-record-format",
    name: "Approval Record Format",
    description:
      "Canonical YAML schema for an approval record: approved_by, content_hash, approval_method, slack_message_ref. Authentication anchor + content-hash integrity check + approver-limits structure.",
    used_by: ["qbo-poster"],
    status: "shipped",
  },
  {
    id: "slack-conventions",
    name: "Slack Conventions",
    description:
      "Channel routing (alerts vs ops vs approvals), severity prefixes, link format, mention rules, thread vs new-post decisions. Every agent that posts to Slack inherits this contract.",
    used_by: [
      "controller",
      "fpa-analyst",
      "treasury",
      "investor-relations",
      "ap-watcher",
      "ar-follow-up",
      "revenue-ops",
      "payroll-reviewer",
      "prepay-manager",
      "bank-recon",
      "crypto-reconciler",
      "qbo-poster",
    ],
    status: "shipped",
  },
];

/** Helper to find an agent by id */
export function findAgent(id: string): AgentEntry | undefined {
  return AGENTS.find((a) => a.id === id);
}

/** Helper to find a shared skill by id */
export function findSkill(id: string): SkillEntry | undefined {
  return SHARED_SKILLS.find((s) => s.id === id);
}

/** Helper to list paths in the repo for an agent's full package */
export function agentPackagePaths(id: string): string[] {
  return [
    `agents/${id}/CLAUDE.md`,
    `agents/${id}/config.yaml`,
    `agents/${id}/README.md`,
  ];
}
