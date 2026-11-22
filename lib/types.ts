// Core types for Ava. One engine, one event log.

export type Role = "requester" | "procurement" | "infosec" | "legal" | "finance" | "budget_owner" | "vp";

export interface Person {
  id: string;
  name: string;
  email: string;
  title: string;
  dept: string;
  roles: Role[];
  costCentre?: string;
  budgetOwnerOf?: string[];
}

export interface Contact { name: string; email: string; title: string }

export interface Supplier {
  id: string;
  name: string;
  domain: string;
  city: string;
  known: boolean;
  category: string;
  contacts: Contact[];
}

export type SeedDocType = "NDA" | "MSA" | "SOW" | "Subscription" | "SecurityCert" | "TaxRecord" | "Insurance";

export interface SeedContract {
  id: string;
  supplierId: string;
  type: SeedDocType;
  title: string;
  date: string; // signed or issued (YYYY-MM-DD)
  project?: string;
  costCentre?: string;
  amount?: number; // before GST
  expiry?: string;
  termMonths?: number;
  autoRenew?: boolean;
  renewalTerms?: string;
  file?: string;
  note?: string;
}

export interface Sheet { name: string; rows: string[][] }

export interface Attachment {
  id: string;
  name: string;
  url?: string; // /samples/x.pdf or data: URL for uploads
  kind: "pdf" | "xlsx" | "other";
  pages: string[][]; // lines per page
  sheets?: Sheet[];
}

export type EmailOrigin = "seed" | "scripted" | "composed" | "ava_draft" | "intake";

export interface Email {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  sentAt: string;
  attachments: Attachment[];
  origin: EmailOrigin;
  /** True when Ava sent this under the autonomy settings (a routine message a person did not click Send on). */
  autoSent?: boolean;
}

// ---- AI contract (section 6) ----
export type FactField =
  | "amount_pre_gst" | "gst" | "total" | "start_date" | "duration" | "scope" | "data_access" | "payment_terms"
  | "validity" | "supplier_entity" | "renewal_date" | "notice_period" | "certificate_expiry" | "other";

export interface ExtractedFact {
  field: FactField;
  value: string;
  state: "confirmed" | "unconfirmed" | "contradicted";
  source: { file: string; page?: number; quote: string };
}

export interface Extraction {
  isSupplierCommunication: boolean;
  supplier: { name: string; domain: string; known: boolean } | null;
  /** Ask Ava only: the supplier contact the requester named. */
  supplierContact?: string;
  filing: {
    project: string;
    request: string; // "REQ-1047" or "NEW"
    requestType: "new_sow" | "amendment" | "renewal" | "change_request" | "invoice" | "other";
    confidence: "high" | "medium" | "low";
    reason: string;
  };
  facts: ExtractedFact[];
  changesVsKnown: { field: string; old: string; new: string; source: { file: string; page?: number; quote: string } }[];
  flags: { type: string; message: string; sendTo: Role }[];
  draftForRequester?: string;
}

export type ExtractionSource = "live" | "cached" | "basic" | "none";

// ---- Request state ----
export interface Source {
  emailId: string;
  docId?: string; // a signed contract, opened at a clause
  clause?: string;
  file: string; // "email" or attachment name
  attachmentId?: string;
  page?: number;
  quote: string;
  by?: string; // person id when stated/confirmed by a person
}

export interface FactVersion {
  value: string;
  num?: number;
  source: Source;
  at: string;
  status: "current" | "superseded";
}

export type FactState = "missing" | "unconfirmed" | "contradicted" | "confirmed";

export interface FactRec {
  field: string;
  value: string;
  num?: number; // amounts in rupees, months, booleans as 1/0
  state: FactState;
  origin: "email" | "document" | "directory" | "person";
  sources: Source[];
  versions: FactVersion[];
  confirmedBy?: string;
  said?: { value: string; num?: number; source: Source }; // what a person stated in email
}

export type DocType = "quote" | "rate_card" | "security_cert" | "insurance" | "order_form" | "invoice" | "sow" | "msa_comments" | "other";

export interface DocRec {
  attachmentId: string;
  emailId: string;
  name: string;
  docType: DocType;
  version: number;
  receivedAt: string;
  supersededBy?: string;
  expiry?: string;
}

export interface Snapshot {
  amount?: number;
  total90?: number;
  dataAccess?: number;
  scope?: string;
  term?: number;
  supplierEntity?: string;
  retro?: number;
  exceptionIds?: string[];
}

export interface Receipt {
  id: string;
  at: string;
  by: string;
  kind: "approved" | "reconfirmed";
  snapshot: Snapshot;
  note?: string;
}

export interface ApprovalRec {
  key: ApprovalKey;
  receipts: Receipt[];
  firstRequiredAt?: string;
}

export type ApprovalKey = "budget_owner" | "vp" | "infosec";

export interface Flag {
  id: string;
  type: string;
  message: string;
  sendTo: Role;
  personId: string;
  evidence?: Source;
  question?: "data_access" | "keep_line";
  status: "open" | "answered" | "dismissed";
  answer?: string;
  createdAt: string;
  closedAt?: string;
}

export interface ExceptionRec {
  id: string;
  kind: "sole_supplier" | "retro" | "other";
  reason: string;
  by: string;
  at: string;
}

export interface Comment { id: string; by: string; at: string; text: string; mentions: string[] }

export interface TimelineEntry { at: string; text: string; actor?: string; kind: "email" | "fact" | "rule" | "approval" | "conflict" | "action" | "handoff" | "flag" }

export interface RetroItem { invoiceNo: string; desc: string; amount: number; emailId: string; source: Source }

export type RequestType = "new_sow" | "amendment" | "renewal" | "change_request" | "invoice" | "other";

export interface Request {
  id: string;
  title: string;
  type: RequestType;
  supplierId: string | null;
  supplierGuess?: { name: string; domain: string };
  project: string;
  requesterId: string;
  costCentre: string;
  createdAt: string;
  emailIds: string[];
  filing: { confidence: string; reason: string; source: ExtractionSource };
  facts: Record<string, FactRec>;
  documents: DocRec[];
  approvals: Partial<Record<ApprovalKey, ApprovalRec>>;
  flags: Flag[];
  exceptions: ExceptionRec[];
  competingQuote?: { note: string; by: string; at: string };
  retroItems: RetroItem[];
  startedBeforeApproval?: { at: string; source: Source };
  comments: Comment[];
  timeline: TimelineEntry[];
  baselineContractId?: string;
  claimsNoChange?: { source: Source; at: string };
  readyAt?: string;
  handoffState?: string;
  factEvents: FactEvent[];
  checklistDone: Record<string, { at: string; how: string }>;
  approvalCache: Record<string, string>;
  supplierDocsAt?: string;
  withdrawals?: { at: string; reason: string }[];
  checksSeen?: string[];
  contractIssues?: { title: string; note: string; at: string; by: string }[];
}

export type FactEvent =
  | { at: string; kind: "extraction"; emailId: string }
  | { at: string; kind: "person"; field: string; value: string; num?: number; by: string; reason: string };

export type ConflictType = "said_vs_written" | "started_before_approval" | "renewal_terms_changed" | "hidden_scope" | "against_contract";

export interface ConflictSide { label: string; quotes: (Source & { note?: string })[] }

export interface Conflict {
  id: string;
  requestId: string;
  type: ConflictType;
  severity: "blocking" | "warning";
  title: string;
  a: ConflictSide;
  b: ConflictSide;
  whyItMatters: string;
  ownerId: string;
  blocks: string;
  field?: string;
  status: "open" | "resolved";
  openedAt: string;
  resolvedAt?: string;
  resolution?: { by: string; text: string; reopened: string[] };
  comments: Comment[];
  escalated?: boolean;
  waitingOnSupplier?: string;
  resolvedFor?: string;
  resolveText?: string;
  aValue?: string;
  bValue?: string;
  impact?: number;
  impactText?: string;
  clauses?: string[];
  originalFee?: number;
}

export interface Draft {
  id: string;
  requestId: string;
  conflictId?: string;
  forPersonId: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  createdAt: string;
  status: "draft" | "sent";
  sentAt?: string;
  purpose: string;
}

export interface OrphanInvoice {
  id: string;
  emailId: string;
  supplierId: string | null;
  invoiceNo: string;
  amount: number;
  desc: string;
  likelyOwnerId?: string;
  status: "open" | "confirmed" | "not_mine";
  requestId?: string;
  source: Source;
  createdAt: string;
}

export interface ChangeEntry {
  id: string;
  at: string;
  requestId: string;
  field: string;
  old: string;
  new: string;
  source: Source;
  reopened: string[];
}

export interface ItemRec {
  key: string;
  openedAt: string;
  closedAt?: string;
  history: { openedAt: string; closedAt?: string }[];
}

export interface State {
  now: string;
  emails: Email[];
  extractions: Record<string, { source: ExtractionSource; result: Extraction | null }>;
  suppliers: Supplier[];
  requests: Record<string, Request>;
  requestOrder: string[];
  conflicts: Record<string, Conflict>;
  drafts: Draft[];
  orphans: OrphanInvoice[];
  changes: ChangeEntry[];
  items: Record<string, ItemRec>;
  reassigned: Record<string, string>;
  counters: { answeredFromDocs: number; approvalsReopened: number; startedBeforeApproval: Record<string, number> };
  lastReqNum: number;
  threadRequest: Record<string, string>;
  addedSuppliers: string[];
  ai: import("./aiTypes").AiState;
  autonomy: Autonomy;
}

/** What Ava may do without a click. Everything else stays a draft or a decision. */
export interface Autonomy { autoSendQuoteRequests: boolean; autoSendDocChasers: boolean }

// ---- Events ----
export type Action =
  | { type: "answer_flag"; requestId: string; flagId: string; answer: "yes" | "no"; note?: string }
  | { type: "dismiss_flag"; requestId: string; flagId: string }
  | { type: "confirm_fact"; requestId: string; field: string }
  | { type: "dispute_fact"; requestId: string; field: string; reason: string }
  | { type: "set_fact"; requestId: string; field: string; value: string; reason: string }
  | { type: "resolve_conflict"; conflictId: string; choice: "A" | "B" | "value" | "accept"; value?: string; reason?: string }
  | { type: "require_cr"; conflictId: string; note: string }
  | { type: "ask_legal"; conflictId: string; text: string }
  | { type: "rec_use"; recKey: string; requestId: string; draft?: string }
  | { type: "rec_dismiss"; recKey: string; requestId: string; reason: string }
  | { type: "ask_supplier"; requestId: string; conflictId?: string }
  | { type: "mark_sent"; draftId: string }
  | { type: "comment"; requestId: string; conflictId?: string; text: string }
  | { type: "rerun"; requestId: string; emailId?: string; extraction?: Extraction; source?: ExtractionSource }
  | { type: "approve"; requestId: string; key: ApprovalKey }
  | { type: "send_back"; requestId: string; key: ApprovalKey; note: string }
  | { type: "record_exception"; requestId: string; kind: "sole_supplier" | "retro" | "other"; reason: string }
  | { type: "competing_quote"; requestId: string; note: string }
  | { type: "reassign"; itemKey: string; to: string }
  | { type: "escalate"; conflictId: string }
  | { type: "orphan_confirm"; orphanId: string }
  | { type: "orphan_not_mine"; orphanId: string }
  | { type: "add_supplier"; requestId: string }
  | { type: "set_autonomy"; setting: keyof Autonomy; value: boolean }
  | { type: "tick" };

export type AvaEvent =
  | { id: string; at: string; kind: "email"; email: Email; extraction: Extraction | null; extractionSource: ExtractionSource; tag?: string }
  | { id: string; at: string; kind: "action"; actor: string; action: Action; tag?: string }
  | { id: string; at: string; kind: "ai"; requestId: string; layer: "read" | "plan" | "rec"; key: string; output: unknown; source: import("./aiTypes").AiSource; tag?: string };

/** What the source viewer shows: one file or email, optional highlighted quotes, optional older version beside it. */
export interface ViewerTarget { docId?: string; clause?: string; emailId: string; attachmentId?: string; quote?: string; quotes?: string[]; page?: number; compareWith?: string; title?: string }
