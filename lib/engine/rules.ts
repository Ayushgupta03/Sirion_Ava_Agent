// Policy rules (section 3). Plain code. The AI extracts facts; this file decides.
import type { ApprovalKey, Attachment, Conflict, ConflictSide, ConflictType, FactRec, FactState, Receipt, Request, Role, SeedContract, Snapshot, Source, State } from "../types";
import { addMonths, daysBetween, fmtDate, inr, istYmd, lakh, norm, parseAmount, parseDate } from "../format";
import { baselineContract, docDiff, FIELD_LABEL, foldFacts, type Folded } from "./facts";
import { budgetOwnerFor, CONTRACTS, contractsFor, firstName, personName, POLICY, roleOwner } from "./world";
import { checkCommitments, clauseSource, type Check } from "./contracts";

const LIMIT = POLICY.vpLimit;
const WINDOW = POLICY.windowDays;

// ---------- Pure core functions (unit-tested) ----------

export interface SpendLine { label: string; ref: string; amount: number; date?: string; current?: boolean }
export interface Spend { lines: SpendLine[]; total: number; overLimit: boolean; windowStart: string; text: string }

export function computeCumulativeSpend(
  contracts: SeedContract[],
  requests: { id: string; title: string; supplierId: string | null; costCentre: string; amount: number | undefined }[],
  supplierId: string | null, costCentre: string, asOfYmd: string, currentRequestId?: string, limit = LIMIT, windowDays = WINDOW,
): Spend {
  const lines: SpendLine[] = [];
  for (const c of contracts) {
    if (c.supplierId !== supplierId || c.costCentre !== costCentre || !c.amount) continue;
    if (c.type !== "SOW" && c.type !== "Subscription") continue;
    const age = daysBetween(c.date, asOfYmd);
    if (age >= 0 && age <= windowDays) lines.push({ label: `${c.id} "${c.title}"`, ref: c.id, amount: c.amount, date: c.date });
  }
  for (const r of requests) {
    if (r.supplierId !== supplierId || r.costCentre !== costCentre || !r.amount) continue;
    lines.push({ label: `${r.id} ${r.title}${r.id === currentRequestId ? " (this request)" : ""}`, ref: r.id, amount: r.amount, current: r.id === currentRequestId });
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const ws = new Date(asOfYmd + "T00:00:00Z"); ws.setUTCDate(ws.getUTCDate() - windowDays);
  const text = lines.length ? `${lines.map((l) => lakh(l.amount)).join(" + ")} = ${lakh(total)}` : "₹0";
  return { lines, total, overLimit: total > limit, windowStart: ws.toISOString().slice(0, 10), text };
}

export interface RuleFired { id: string; title: string; text: string; fired: boolean }
export interface RequiredApproval { key: ApprovalKey; approverId: string; reason: string }
export interface Routing { rules: RuleFired[]; approvals: RequiredApproval[]; needsCompetingQuote: boolean; needsInfosec: boolean; endState: "legal" | "po"; endReason: string }

export function computeRouting(input: {
  supplierName: string; costCentre: string; spend: Spend; dataAccess: number | undefined; dataAccessConfirmed: boolean;
  budgetOwnerId: string; hasMsa: boolean; nonStandardTerms: boolean; requestType: string; limit?: number;
}): Routing {
  const limit = input.limit ?? LIMIT;
  const over = input.spend.total > limit;
  const rules: RuleFired[] = [];
  const approvals: RequiredApproval[] = [];
  approvals.push({ key: "budget_owner", approverId: input.budgetOwnerId, reason: `Budget owner approval is always required. ${personName(input.budgetOwnerId)} owns ${input.costCentre}.` });
  rules.push({ id: "R1b", title: "Budget owner", fired: true, text: `Budget owner approval is always required: ${personName(input.budgetOwnerId)} owns ${input.costCentre}.` });
  rules.push({
    id: "R1", title: "Approval limit", fired: over,
    text: `${input.spend.text} in 90 days for ${input.supplierName.replace(/ Pvt Ltd$/, "")} in ${input.costCentre}, which is ${over ? "over" : "under"} ${lakh(limit)}, so ${over ? "VP approval is required" : "no VP approval is needed"}.`,
  });
  if (over) approvals.push({ key: "vp", approverId: POLICY.vpApprover, reason: `90-day total ${lakh(input.spend.total)} is over ${lakh(limit)}.` });
  rules.push({ id: "R2", title: "Competing quote", fired: over, text: over ? `Over ${lakh(limit)}: Procurement must attach a competing quote or record an exception with VP approval.` : `Under ${lakh(limit)}: no competing quote needed.` });
  const access = input.dataAccess === 1;
  rules.push({
    id: "R3", title: "Data access", fired: access && input.dataAccessConfirmed,
    text: input.dataAccess === undefined ? "Data access not known yet." : access ? (input.dataAccessConfirmed ? "The supplier will access customer data, so InfoSec approval and a DPA are required. The DPA is assigned to Legal review." : "The supplier may access customer data. Waiting on the requester to confirm before adding InfoSec and the DPA.") : "No access to personal or customer data. No InfoSec review or DPA needed.",
  });
  if (access && input.dataAccessConfirmed) approvals.push({ key: "infosec", approverId: POLICY.infosec, reason: "Supplier will access customer data." });
  const legal = access || !input.hasMsa || input.nonStandardTerms || over;
  const why = [access && "data access", !input.hasMsa && "no master agreement", input.nonStandardTerms && "supplier comments on terms", over && "over the approval limit"].filter(Boolean).join(", ");
  rules.push({ id: "R9", title: "End state", fired: true, text: legal ? `Ends in Ready for Legal Review (${why}).` : "Ends in Ready to issue PO: work under an existing agreement, no data access, within limits. Only the budget owner approves." });
  return { rules, approvals, needsCompetingQuote: over, needsInfosec: access && input.dataAccessConfirmed, endState: legal ? "legal" : "po", endReason: why };
}

export interface Diff { field: string; label: string; old: string; new: string }
const SNAP_LABEL: Record<string, string> = { amount: "Amount", total90: "90-day total", dataAccess: "Data access", scope: "Scope", term: "Term", supplierEntity: "Supplier", retro: "Started-before-approval amount", exceptionIds: "Exceptions" };
function fmtSnap(k: string, v: unknown): string {
  if (v == null) return "—";
  if (k === "amount" || k === "total90" || k === "retro") return lakh(v as number);
  if (k === "dataAccess") return v ? "Yes" : "No";
  if (k === "term") return `${v} months`;
  if (k === "exceptionIds") return (v as string[]).length ? `${(v as string[]).length} recorded` : "none";
  return String(v);
}
export function snapshotDiff(old: Snapshot, cur: Snapshot): Diff[] {
  const out: Diff[] = [];
  for (const k of Object.keys(cur) as (keyof Snapshot)[]) {
    const a = old[k], b = cur[k];
    if (b === undefined) continue;
    let differs = false;
    if (Array.isArray(b)) differs = !(Array.isArray(a) && a.length === b.length && a.every((x) => (b as string[]).includes(x)));
    else if (typeof b === "number") differs = a === undefined ? false : (k === "amount" || k === "total90" || k === "retro") ? b - (a as number) > 0.5 : Math.abs((a as number) - b) > 0.5; // a decrease never reopens an approval
    else differs = a !== undefined && norm(String(a)) !== norm(String(b));
    if (differs) out.push({ field: k, label: SNAP_LABEL[k] ?? k, old: fmtSnap(k, a), new: fmtSnap(k, b) });
  }
  return out;
}
export type ApprovalStatus = "pending" | "approved" | "needs_reconfirmation" | "reconfirmed";
export function approvalStatus(receipts: Receipt[], current: Snapshot): { status: ApprovalStatus; diffs: Diff[]; last?: Receipt } {
  const last = receipts[receipts.length - 1];
  if (!last) return { status: "pending", diffs: [] };
  const diffs = snapshotDiff(last.snapshot, current);
  if (diffs.length) return { status: "needs_reconfirmation", diffs, last };
  return { status: last.kind === "reconfirmed" ? "reconfirmed" : "approved", diffs: [], last };
}

export interface HandoffInput {
  missingFacts: string[]; unconfirmedFacts: string[]; contradictedFacts: string[];
  checklistOpen: string[]; approvalsPending: string[]; approvalsStale: string[]; blockingConflicts: string[]; supplierKnown: boolean; endState: "legal" | "po";
}
export interface Handoff { state: "ready_legal" | "ready_po" | "blocked" | "in_progress"; reasons: string[]; banner?: string }
export function computeHandoffState(i: HandoffInput): Handoff {
  const reasons: string[] = [];
  i.missingFacts.forEach((f) => reasons.push(`Missing: ${f}`));
  i.unconfirmedFacts.forEach((f) => reasons.push(`Unconfirmed: ${f}`));
  i.contradictedFacts.forEach((f) => reasons.push(`Contradicted: ${f}`));
  i.checklistOpen.forEach((c) => reasons.push(`Checklist: ${c}`));
  i.approvalsPending.forEach((a) => reasons.push(`Approval pending: ${a}`));
  i.approvalsStale.forEach((a) => reasons.push(`Needs reconfirmation: ${a}`));
  i.blockingConflicts.forEach((c) => reasons.push(`Open conflict: ${c}`));
  if (!i.supplierKnown) reasons.push("Supplier is not in the supplier list");
  if (i.approvalsStale.length || i.blockingConflicts.length) {
    const n = i.approvalsStale.length;
    const banner = n ? `Handoff blocked: ${n} approval${n > 1 ? "s do" : " does"} not match current facts.` : `Handoff blocked: ${i.blockingConflicts.length} open conflict${i.blockingConflicts.length > 1 ? "s" : ""}.`;
    return { state: "blocked", reasons, banner };
  }
  if (reasons.length) return { state: "in_progress", reasons };
  return { state: i.endState === "legal" ? "ready_legal" : "ready_po", reasons: [] };
}

// ---------- Checklist ----------
export type CheckStatus = "done" | "pending" | "waiting_supplier" | "excepted" | "legal_review";
export interface CheckItem { key: string; label: string; owner: Role; ownerId: string; status: CheckStatus; how: string; detail?: string; source?: Source }

// ---------- Full analysis of a request against live state ----------
export interface ConflictSpec extends Omit<Conflict, "status" | "openedAt" | "comments" | "requestId"> { resolveText?: string; aValue?: string; bValue?: string }
export interface ApprovalView { key: ApprovalKey; approverId: string; reason: string; status: ApprovalStatus; diffs: Diff[]; last?: Receipt; receipts: Receipt[]; current: Snapshot; gateOpen: boolean; reopenSource?: string }
export interface FlagSpec { id: string; type: string; message: string; sendTo: Role; evidence?: Source; question?: "data_access" }
export interface FactView extends FactRec { displayState: FactState; required: boolean; label: string }

export interface Analysis {
  req: Request; folded: Folded; facts: Record<string, FactView>; amount?: number; retro: number; requestAmount?: number;
  spend: Spend; routing: Routing; checklist: CheckItem[]; approvals: ApprovalView[]; conflicts: ConflictSpec[]; handoff: Handoff;
  flags: FlagSpec[]; drafts: { purpose: string; subject: string; body: string; to: string }[]; engagementEnd?: string; dataAccess?: number; dataAccessConfirmed: boolean;
  requiredFacts: string[]; securityCert?: { expiry?: string; name: string; source: string }; rateFlags: FlagSpec[]; pipeline: string; waitingOn?: string;
  baseline?: SeedContract; newLines: string[]; checks: Check[]; contractClauses: string[];
}

const cache = new WeakMap<State, Map<string, Analysis>>();
const foldCache = new WeakMap<State, Map<string, Folded>>();

export function folded(state: State, reqId: string): Folded {
  let m = foldCache.get(state); if (!m) { m = new Map(); foldCache.set(state, m); }
  if (!m.has(reqId)) m.set(reqId, foldFacts(state, state.requests[reqId]));
  return m.get(reqId)!;
}

export function requestAmount(state: State, reqId: string): number | undefined {
  const req = state.requests[reqId]; const f = folded(state, reqId);
  const base = f.facts.amount?.num; const retro = req.retroItems.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  if (base == null && !retro) return undefined;
  return (base ?? 0) + retro;
}

export function requiredFactsFor(req: Request): string[] {
  if (req.type === "renewal") return ["amount", "duration", "auto_renew", "supplier_entity", "cost_centre"];
  if (req.type === "invoice" || req.type === "other") return ["amount", "supplier_entity", "cost_centre"];
  return ["amount", "scope", "start_date", "duration", "data_access", "supplier_entity", "cost_centre"];
}

function attachment(state: State, id?: string): Attachment | undefined {
  if (!id) return; for (const e of state.emails) { const a = e.attachments.find((a) => a.id === id); if (a) return a; }
}

function lineItems(a: Attachment) {
  return a.pages.flat().filter((l) => /₹[\d,]+\s*$/.test(l) && !/subtotal|gst|^total|fees \(before|amount \(before/i.test(l));
}

export function rateCardFlags(a: Attachment): { message: string; quote: string }[] {
  if (!a.sheets || a.sheets.length < 2) return [];
  const yr = (n: string) => parseInt(n.match(/(20\d\d)/)?.[1] ?? "0");
  const sorted = [...a.sheets].sort((x, y) => yr(y.name) - yr(x.name));
  const [cur, prev] = sorted; if (!yr(cur.name) || !yr(prev.name)) return [];
  const map = new Map(prev.rows.slice(1).map((r) => [norm(r[0] ?? ""), parseFloat(String(r[1]).replace(/,/g, ""))]));
  const out: { message: string; quote: string }[] = [];
  for (const r of cur.rows.slice(1)) {
    const now = parseFloat(String(r[1]).replace(/,/g, "")); const was = map.get(norm(r[0] ?? ""));
    if (!now || !was || now <= was) continue;
    const pct = Math.round(((now - was) / was) * 100);
    if (pct >= 5) out.push({ message: `${r[0]} rate is ${pct}% above the ${yr(prev.name)} rate card (${inr(now)} vs ${inr(was)} a month).`, quote: `${cur.name}: ${r[0]} | ${r[1]}` });
  }
  return out;
}

export function analyze(state: State, reqId: string): Analysis {
  let m = cache.get(state); if (!m) { m = new Map(); cache.set(state, m); }
  const hit = m.get(reqId); if (hit) return hit;
  const req = state.requests[reqId];
  const f = folded(state, reqId);
  const now = state.now; const today = istYmd(now);
  const supplier = state.suppliers.find((s) => s.id === req.supplierId);
  const supName = supplier?.name ?? req.supplierGuess?.name ?? "Unknown supplier";
  const baseline = baselineContract(req);
  const seed = contractsFor(req.supplierId);
  const hasMsa = seed.some((c) => c.type === "MSA");
  const amount = f.facts.amount?.num;
  const retro = req.retroItems.reduce((s, r) => s + r.amount, 0);
  const reqAmt = requestAmount(state, reqId);

  const spend = computeCumulativeSpend(CONTRACTS, state.requestOrder.map((id) => ({ id, title: state.requests[id].title, supplierId: state.requests[id].supplierId, costCentre: state.requests[id].costCentre, amount: requestAmount(state, id) })), req.supplierId, req.costCentre, today, reqId);

  const da = f.facts.data_access;
  const dataAccess = da?.num;
  const dataAccessConfirmed = !!da && da.state === "confirmed";
  const nonStandard = f.documents.some((d) => d.docType === "msa_comments");
  const routing = computeRouting({ supplierName: supName, costCentre: req.costCentre, spend, dataAccess, dataAccessConfirmed, budgetOwnerId: budgetOwnerFor(req.costCentre), hasMsa: hasMsa || req.type === "renewal" && !!baseline, nonStandardTerms: nonStandard, requestType: req.type });

  // Engagement end and security certificate.
  const start = parseDate(f.facts.start_date?.value) ?? (f.facts.start_date ? undefined : undefined);
  const months = f.facts.duration?.num;
  const engagementEnd = start && months ? addMonths(start, months) : undefined;
  const latestCert = [...f.documents].filter((d) => d.docType === "security_cert").pop();
  const seedCert = seed.find((c) => c.type === "SecurityCert");
  const securityCert = latestCert ? { expiry: latestCert.expiry, name: latestCert.name, source: latestCert.name } : seedCert ? { expiry: seedCert.expiry, name: seedCert.title, source: `${seedCert.id} (on file)` } : undefined;
  const latestIns = [...f.documents].filter((d) => d.docType === "insurance").pop();

  // Approvals
  const exceptionIds = req.exceptions.filter((e) => e.kind === "sole_supplier" || e.kind === "other").map((e) => e.id);
  const snapFor = (key: ApprovalKey): Snapshot => {
    if (key === "budget_owner") return { amount, retro: retro || undefined, term: months, supplierEntity: f.facts.supplier_entity?.value };
    if (key === "vp") return { total90: spend.total, exceptionIds: routing.needsCompetingQuote ? exceptionIds : undefined };
    return { dataAccess, scope: f.facts.scope?.sources[0]?.quote ?? f.facts.scope?.value };
  };
  const amountFact = f.facts.amount;
  const hasQuestion = da?.state === "unconfirmed" && dataAccess === 1;
  const gateOpen = !!amountFact && amountFact.state === "confirmed" && amountFact.origin !== "email" && !hasQuestion && req.type !== "invoice" || (req.type === "invoice" && !!amountFact);
  // Source of the latest amount change, for "Needs reconfirmation" reasons.
  let newLines: string[] = [];
  let reopenSource: string | undefined;
  const quotes = f.documents.filter((d) => d.docType === "quote" || d.docType === "order_form" || d.docType === "sow");
  if (quotes.length >= 2) {
    const a = attachment(state, quotes[quotes.length - 2].attachmentId), b = attachment(state, quotes[quotes.length - 1].attachmentId);
    if (a && b) {
      newLines = docDiff(a, b).added.filter((l) => /₹/.test(l));
      const items = lineItems(b); const added = newLines.find((l) => items.includes(l));
      if (added) reopenSource = `${b.name}, page 1, line ${items.indexOf(added) + 1}`;
      else reopenSource = `${b.name}, page 1`;
    }
  }
  const approvals: ApprovalView[] = routing.approvals.map((ra) => {
    const rec = req.approvals[ra.key]; const receipts = rec?.receipts ?? []; const current = snapFor(ra.key);
    const st = approvalStatus(receipts, current);
    const approverId = state.reassigned[`${reqId}:approval:${ra.key}`] ?? ra.approverId;
    const g = ra.key === "infosec" ? dataAccessConfirmed && dataAccess === 1 : gateOpen;
    return { key: ra.key, approverId, reason: ra.reason, status: st.status, diffs: st.diffs, last: st.last, receipts, current, gateOpen: g, reopenSource };
  });
  const apCurrent = (k: ApprovalKey) => { const a = approvals.find((x) => x.key === k); return !!a && (a.status === "approved" || a.status === "reconfirmed"); };

  // Checklist (rule 4)
  const checklist: CheckItem[] = [];
  const ck = (key: string, label: string, owner: Role, status: CheckStatus, how: string, detail?: string) => checklist.push({ key, label, owner, ownerId: roleOwner(owner, req.requesterId, req.costCentre), status, how, detail });
  const access = dataAccess === 1 && dataAccessConfirmed;
  const nda = seed.find((c) => c.type === "NDA");
  const msa = seed.find((c) => c.type === "MSA");
  if (req.type !== "renewal" && req.type !== "invoice") ck("nda", "Signed NDA", "legal", nda ? "done" : "pending", nda ? `${nda.id}, signed ${fmtDate(nda.date)}. ${nda.note ?? ""}`.trim() : "No NDA found for this supplier.");
  ck("msa", "Master agreement in place", "legal", msa ? "done" : "legal_review", msa ? `${msa.id}, signed ${fmtDate(msa.date)}. ${msa.renewalTerms ?? ""}`.trim() : "No master agreement. Assigned to Legal review.");
  if (access) {
    ck("dpa", "Data protection agreement (DPA)", "legal", "legal_review", "Assigned to Legal review. Legal drafts the DPA during substantive review.");
    const need = engagementEnd ?? addMonths(today, 3);
    if (!securityCert) ck("security_cert", "Security certificate in date", "infosec", "waiting_supplier", "No security certificate on file. Waiting on the supplier.");
    else if (!securityCert.expiry) ck("security_cert", "Security certificate in date", "infosec", "pending", `${securityCert.name}: expiry date not found. InfoSec to check.`);
    else if (securityCert.expiry < today) ck("security_cert", "Security certificate in date", "infosec", "waiting_supplier", `${securityCert.name} expired on ${fmtDate(securityCert.expiry)}. Waiting on a current certificate.`);
    else if (securityCert.expiry < need) ck("security_cert", "Security certificate in date", "infosec", "waiting_supplier", `${securityCert.source} expires ${fmtDate(securityCert.expiry)}, before the engagement ends on ${fmtDate(need)}. Waiting on the renewed certificate.`);
    else ck("security_cert", "Security certificate in date", "infosec", "done", `${securityCert.name}, valid until ${fmtDate(securityCert.expiry)}. Covers the engagement to ${fmtDate(need)}.`);
    if (latestIns && latestIns.expiry && latestIns.expiry >= today) ck("insurance", "Insurance certificate", "procurement", "done", `${latestIns.name}, valid until ${fmtDate(latestIns.expiry)}.`);
    else if (latestIns) ck("insurance", "Insurance certificate", "procurement", "waiting_supplier", `${latestIns.name}: ${latestIns.expiry ? `expired ${fmtDate(latestIns.expiry)}` : "validity date not found"}.`);
    else ck("insurance", "Insurance certificate", "procurement", "waiting_supplier", "No insurance certificate on file. Waiting on the supplier.");
  }
  const tax = seed.find((c) => c.type === "TaxRecord");
  ck("gst_pan", "GST and PAN", "finance", tax ? "done" : "pending", tax ? `On file with Finance. ${tax.note ?? ""}` : "Not on file. Finance to collect.");
  const bo = approvals.find((a) => a.key === "budget_owner")!;
  ck("budget", `Budget approval at the current amount${reqAmt ? ` (${lakh(reqAmt)})` : ""}`, "budget_owner", apCurrent("budget_owner") ? "done" : "pending", apCurrent("budget_owner") ? `Approved by ${personName(bo.approverId)} on a Decision Receipt.` : bo.status === "needs_reconfirmation" ? "Approval does not match current facts." : `Waiting on ${personName(bo.approverId)}.`);
  if (routing.needsCompetingQuote) {
    ck("vp", "VP approval (over the limit)", "vp", apCurrent("vp") ? "done" : "pending", apCurrent("vp") ? `Approved by ${personName(POLICY.vpApprover)} for ${lakh(spend.total)}.` : `Waiting on ${personName(POLICY.vpApprover)}.`);
    const vp = approvals.find((a) => a.key === "vp");
    const exc = req.exceptions.find((e) => e.kind === "sole_supplier" || e.kind === "other");
    if (req.competingQuote) ck("competing", "Competing quote or authorized exception", "procurement", "done", `Competing quote: ${req.competingQuote.note}`);
    else if (exc && vp && apCurrent("vp") && vp.last?.snapshot.exceptionIds?.includes(exc.id)) ck("competing", "Competing quote or authorized exception", "procurement", "excepted", `Exception: "${exc.reason}" Approved by ${personName(POLICY.vpApprover)}.`);
    else if (exc) ck("competing", "Competing quote or authorized exception", "procurement", "pending", `Exception recorded by ${personName(exc.by)}. Waiting on VP approval.`);
    else ck("competing", "Competing quote or authorized exception", "procurement", "pending", "Attach a competing quote or record an exception.");
  }
  if (req.type === "renewal") {
    ck("renewal_terms", "Renewal terms match what was agreed", "procurement", "pending", "", "");
  }
  if (req.retroItems.length || req.startedBeforeApproval) {
    const r = req.exceptions.find((e) => e.kind === "retro");
    const covered = apCurrent("budget_owner") && (bo.last?.snapshot.retro ?? 0) >= retro;
    ck("retro", "Reason and retrospective approval for work started early", "procurement", r && covered ? "done" : "pending", r ? `Reason: "${r.reason}"${covered ? ` Approved by ${personName(bo.approverId)}.` : " Waiting on budget owner approval."}` : "Procurement to record a reason.");
  }

  // Facts with required flags.
  const requiredFacts = requiredFactsFor(req);
  const factsView: Record<string, FactView> = {};
  for (const k of Object.keys(f.facts)) factsView[k] = { ...f.facts[k], displayState: f.facts[k].state, required: requiredFacts.includes(k), label: FIELD_LABEL[k] ?? k };
  for (const k of requiredFacts) if (!factsView[k]) factsView[k] = { field: k, value: "", state: "missing", origin: "email", sources: [], versions: [], displayState: "missing", required: true, label: FIELD_LABEL[k] ?? k };

  // Conflicts (detected by code; resolved by people).
  const conflicts: ConflictSpec[] = [];
  const procurement = POLICY.procurementOwner;
  // A: amount said or approved vs written (not for renewals; renewals use their own card).
  if (req.type !== "renewal" && amountFact && amountFact.origin === "document") {
    const boRec = req.approvals.budget_owner?.receipts ?? [];
    const lastApproved = boRec[boRec.length - 1]?.snapshot.amount;
    const ref = lastApproved ?? amountFact.said?.num;
    const prevVersion = [...amountFact.versions].reverse().find((v) => v.status === "superseded" && v.num != null && Math.abs(v.num - (ref ?? -1)) < 0.5);
    if (ref != null && amountFact.num != null && Math.abs(ref - amountFact.num) > 0.5 && !(lastApproved != null && amountFact.num < lastApproved)) {
      const curSrc = amountFact.sources[0];
      const coverEmail = state.emails.find((e) => e.id === curSrc.emailId);
      const coverSaysPrice = coverEmail ? /₹|\brs\b|\binr\b|lakh|\d+\s?l\b/i.test(coverEmail.body) : false;
      const aQuotes: ConflictSide["quotes"] = [];
      if (coverEmail && !coverSaysPrice) aQuotes.push({ emailId: coverEmail.id, file: "email", quote: coverEmail.body.split(/(?<=[.!?])\s+/).find((s) => /attach|quote|find/i.test(s)) ?? coverEmail.body.slice(0, 120), note: "The cover email says nothing about price." });
      if (prevVersion) aQuotes.push({ ...prevVersion.source, note: `Earlier value: ${inr(prevVersion.num)}` });
      else if (amountFact.said) aQuotes.push({ ...amountFact.said.source, note: `Stated: ${amountFact.said.value}` });
      if (lastApproved != null) aQuotes.push({ emailId: "", file: "Decision Receipt", quote: `Budget approval given for ${inr(lastApproved)}`, note: `by ${personName(req.approvals.budget_owner?.receipts.at(-1)?.by)}` });
      const added = newLines.filter((l) => !/subtotal|gst|^total|fees \(before|amount \(before|annual fee/i.test(l));
      const bQuotes: ConflictSide["quotes"] = [{ ...curSrc, note: `Now: ${inr(amountFact.num)}, ${inr(amountFact.num - ref)} ${amountFact.num > ref ? "more" : "less"}` }];
      added.slice(0, 3).forEach((l) => bQuotes.push({ emailId: curSrc.emailId, file: curSrc.file, attachmentId: curSrc.attachmentId, page: 1, quote: l, note: "New line" }));
      conflicts.push({
        id: `cf:${reqId}:said_vs_written:amount:${boRec.length}`, type: "said_vs_written", severity: "blocking", field: "amount",
        title: `Price changed in the attachment: ${lakh(ref)} → ${lakh(amountFact.num)}`,
        a: { label: lastApproved != null ? "What was said and approved" : "What was said", quotes: aQuotes },
        b: { label: `What ${curSrc.file} says`, quotes: bQuotes },
        whyItMatters: `Amount is a material fact. Budget approval and the 90-day total (${lakh(spend.total)}) depend on it.`,
        ownerId: procurement, blocks: lastApproved != null ? "Handoff, and the approvals given for the old amount" : "Handoff",
        resolveText: lastApproved != null ? `${personName(bo.approverId)} reconfirmed at ${inr(amountFact.num)}.` : "Values now match.",
        aValue: inr(ref), bValue: inr(amountFact.num),
        impact: added.reduce((n, l) => n + (parseAmount(l.match(/₹[\d,]+/g)?.pop()) ?? 0), 0) || Math.abs(amountFact.num - ref),
        impactText: added.length ? `${inr(added.reduce((n, l) => n + (parseAmount(l.match(/₹[\d,]+/g)?.pop()) ?? 0), 0))} new line nobody mentioned` : `${inr(Math.abs(amountFact.num - ref))} change nobody mentioned`,
      });
    }
  }
  // B: a person's confirmation disagrees with a newer document (generic, rule 6).
  for (const field of ["data_access", "duration", "scope"] as const) {
    const fr = f.facts[field];
    if (!fr || fr.origin !== "document" || !fr.said || fr.said.source.by == null || fr.said.num == null || fr.num == null) continue;
    if (Math.abs(fr.said.num - fr.num) < 0.5) continue;
    conflicts.push({
      id: `cf:${reqId}:said_vs_written:${field}:${fr.sources[0].attachmentId ?? fr.sources[0].emailId}`, type: "said_vs_written", severity: "blocking", field,
      title: `${FIELD_LABEL[field]}: ${personName(fr.said.source.by)} said "${fr.said.value}", the document says "${fr.value}"`,
      a: { label: `What ${firstName(fr.said.source.by)} said`, quotes: [fr.said.source] }, b: { label: "What the document says", quotes: [fr.sources[0]] },
      whyItMatters: `${FIELD_LABEL[field]} is a material fact. Routing and approvals depend on it.`, ownerId: procurement, blocks: "Handoff", resolveText: "Values now match.",
      aValue: fr.said.value, bValue: fr.value,
    });
  }
  // C: hidden scope or data access.
  if (da && dataAccess === 1 && da.state === "unconfirmed") {
    const first = state.emails.find((e) => e.id === req.emailIds[0]);
    conflicts.push({
      id: `cf:${reqId}:hidden_scope:data_access`, type: "hidden_scope", severity: "blocking", field: "data_access",
      title: `${supName.split(" ")[0]} mentions access to customer data. ${firstName(req.requesterId)}'s request did not.`,
      a: { label: `${firstName(req.requesterId)}'s request`, quotes: first ? [{ emailId: first.id, file: "email", quote: first.body.split(/(?<=[.!?])\s+/).slice(1, 2).join(" ") || first.subject, note: "No mention of data access." }] : [] },
      b: { label: `What ${supName.split(" ")[0]} wrote`, quotes: da.sources.slice(0, 2) },
      whyItMatters: "Data access is a material fact. If yes, InfoSec approval and a DPA are required (rule 3).",
      ownerId: req.requesterId, blocks: "Handoff, and the InfoSec and DPA routing", resolveText: `${personName(req.requesterId)} answered the data access question.`,
    });
  }
  // D: renewal terms changed (said vs written vs existing agreement).
  let renewalOk = true;
  if (req.type === "renewal" && baseline) {
    const formDocs = f.documents.filter((d) => d.docType === "order_form");
    const form = formDocs[formDocs.length - 1];
    if (form) {
      const lines: (Source & { note?: string })[] = [];
      const fromForm = (fr?: FactRec) => fr?.sources.find((s) => s.attachmentId === form.attachmentId) ?? fr?.sources[0];
      const fee = f.facts.amount;
      const claim = f.claimsNoChange;
      if (fee?.num != null && baseline.amount && Math.abs(fee.num - baseline.amount) > 0.5 && claim) {
        const pct = Math.round(((fee.num - baseline.amount) / baseline.amount) * 100);
        const s = fromForm(fee); if (s) lines.push({ ...s, note: `${pct}% ${pct > 0 ? "above" : "below"} ${inr(baseline.amount)}` });
      }
      const term = f.facts.duration;
      if (term?.num != null && baseline.termMonths && term.num !== baseline.termMonths) { const s = fromForm(term); if (s) lines.push({ ...s, note: `Existing term: ${baseline.termMonths} months` }); }
      const ar = f.facts.auto_renew;
      if (ar?.num === 1 && baseline.autoRenew === false) { const s = fromForm(ar); if (s) lines.push({ ...s, note: "Existing agreement does not renew automatically" }); }
      if (lines.length) {
        renewalOk = false;
        const claimQuote = claim ?? f.facts.amount?.said?.source;
        conflicts.push({
          id: `cf:${reqId}:renewal_terms_changed:${baseline.id}`, type: "renewal_terms_changed", severity: "blocking", field: "amount",
          title: claim ? "The email says nothing changes. The order form changes the terms." : "The order form changes the renewal terms.",
          a: { label: claim ? "What the email says" : "Existing agreement", quotes: claimQuote ? [{ ...claimQuote, note: `Existing: ${inr(baseline.amount)} a year, ${baseline.termMonths} months, ${baseline.autoRenew ? "auto-renews" : "no automatic renewal"} (${baseline.id})` }] : [{ emailId: "", file: baseline.id, quote: baseline.renewalTerms ?? baseline.title }] },
          b: { label: `What ${form.name} says`, quotes: lines },
          whyItMatters: "Amount and term are material facts. Budget approval, the 90-day total and the end state depend on them.",
          ownerId: procurement, blocks: "Handoff", resolveText: `Revised order form matches what was agreed.`,
        });
      }
    }
    const rt = checklist.find((c) => c.key === "renewal_terms")!;
    rt.status = renewalOk && form ? "done" : "pending";
    rt.how = !form ? "Waiting on the order form." : renewalOk ? `${form.name} matches the existing agreement: ${f.facts.duration?.value ?? ""}${f.facts.auto_renew ? `; ${f.facts.auto_renew.value}` : ""}.` : "Order form terms differ from what was agreed. See the conflict card.";
  }
  // E: started before approval.
  for (const r of req.retroItems) {
    const exc = req.exceptions.find((e) => e.kind === "retro");
    const covered = apCurrent("budget_owner") && (bo.last?.snapshot.retro ?? 0) >= retro;
    if (exc && covered) continue;
    conflicts.push({
      id: `cf:${reqId}:started_before_approval:${r.invoiceNo}`, type: "started_before_approval", severity: "blocking", field: "amount",
      title: `Invoice ${r.invoiceNo} is for ${r.amount ? "a module" : "work"} nobody has approved`,
      a: { label: "Approvals on record", quotes: [{ emailId: "", file: req.id, quote: `No approval covers "${r.desc}".` }] },
      b: { label: "What the invoice says", quotes: [r.source] },
      whyItMatters: "Work started before approval. Procurement needs a reason and a retrospective approval from the budget owner.",
      ownerId: procurement, blocks: "Handoff", resolveText: `Reason recorded and ${personName(bo.approverId)} approved retrospectively.`,
      impact: r.amount || undefined, impactText: r.amount ? `${inr(r.amount)} invoiced before approval` : "Work invoiced before approval",
    });
  }
  if (req.startedBeforeApproval && !req.retroItems.length) {
    const exc = req.exceptions.find((e) => e.kind === "retro");
    if (!(exc && approvals.every((a) => a.status === "approved" || a.status === "reconfirmed"))) conflicts.push({
      id: `cf:${reqId}:started_before_approval:signal`, type: "started_before_approval", severity: "blocking",
      title: "The supplier says work has started. Approvals are not complete.",
      a: { label: "Approvals on record", quotes: approvals.map((a) => ({ emailId: "", file: "Decision Receipt", quote: `${personName(a.approverId)}: ${a.status.replace(/_/g, " ")}` })) },
      b: { label: "What the supplier wrote", quotes: [req.startedBeforeApproval.source] },
      whyItMatters: "Work started before approval. Procurement needs a reason and retrospective approvals.", ownerId: procurement, blocks: "Handoff",
      resolveText: "Reason recorded and all approvals signed.",
    });
  }

  // F: commitments in the signed contracts (Part 2). Code computes every consequence.
  const cc = checkCommitments(state, req, f);
  for (const c of cc.conflicts) {
    const rateCase = c.id.includes(":contract:rates:");
    conflicts.push({
      id: c.id, type: "against_contract", severity: "blocking", title: c.title, a: c.a, b: c.b, whyItMatters: c.whyItMatters,
      ownerId: procurement, blocks: "Handoff", impact: c.impact, impactText: c.impactText, clauses: c.clauses,
      resolveText: rateCase ? `Rates now within the ${8}% cap: ${inr(c.impact ?? 0)} over-charge removed.` : "The sources now agree.",
    });
  }
  // Renewal conflict: show the clauses it breaks.
  const rc = conflicts.find((c) => c.type === "renewal_terms_changed");
  if (rc) {
    const capCheck = cc.checks.find((k) => k.clause === "4.2" && k.status === "conflict" && !k.id.endsWith(":notice"));
    const notice = cc.checks.find((k) => k.id.endsWith(":4.2:notice") && k.status === "conflict");
    const ar = cc.checks.find((k) => k.clause === "4.3" && k.status === "conflict");
    const c42 = capCheck ?? notice;
    if (c42) rc.a.quotes.push(clauseSource(c42.docId, "4.2", [capCheck?.text, notice?.text].filter(Boolean).join(" ")));
    if (ar) rc.a.quotes.push(clauseSource(ar.docId, "4.3", ar.text));
    rc.clauses = [capCheck, ar].filter(Boolean).map((k) => `${k!.docId} ${k!.clause}`);
  }

  // Approvers are not asked while the terms themselves are in dispute.
  if (conflicts.some((c) => c.type === "renewal_terms_changed" && state.conflicts[c.id]?.status !== "resolved"))
    approvals.forEach((ap) => { if (ap.key !== "infosec") ap.gateOpen = false; });

  // Mark contradicted facts from open conflicts (rule 6).
  for (const c of conflicts) if (c.field && factsView[c.field] && c.type !== "hidden_scope" && c.type !== "started_before_approval") factsView[c.field].displayState = "contradicted";
  for (const c of conflicts) {
    const rec = state.conflicts[c.id];
    if (rec?.status === "resolved" && c.field && factsView[c.field]?.displayState === "contradicted") factsView[c.field].displayState = factsView[c.field].state;
  }

  // Flags raised by code.
  const flags: FlagSpec[] = [];
  if (da && dataAccess === 1 && da.state === "unconfirmed") flags.push({ id: `flag:${reqId}:data_access`, type: "unconfirmed", question: "data_access", sendTo: "requester", evidence: da.sources[0], message: `${supName.split(" ")[0]} mentions ${/admin access/i.test(da.sources[0]?.quote ?? "") ? "admin access to sync customer records" : "access to customer data"}. Will they access customer data?` });
  if (start && req.type !== "renewal") { const d = daysBetween(today, start); if (d >= 0 && d <= 7) flags.push({ id: `flag:${reqId}:start_soon`, type: "info", sendTo: "requester", message: `Start date is ${d} day${d === 1 ? "" : "s"} away.`, evidence: f.facts.start_date?.sources[0] }); }
  if (access && securityCert?.expiry && securityCert.expiry >= today && daysBetween(today, securityCert.expiry) <= 60) {
    const d = daysBetween(today, securityCert.expiry); const w = Math.floor(d / 7);
    flags.push({ id: `flag:${reqId}:cert_expiring:${securityCert.expiry}`, type: "expiring", sendTo: "infosec", message: `ISO 27001 certificate expires ${fmtDate(securityCert.expiry)}, in ${w >= 2 ? `${w} weeks` : `${d} days`}.` });
  }
  const rateFlags: FlagSpec[] = [];
  for (const d of f.documents.filter((d) => d.docType === "rate_card")) {
    const a = attachment(state, d.attachmentId); if (!a) continue;
    rateCardFlags(a).forEach((r, i) => rateFlags.push({ id: `flag:${reqId}:rate:${d.attachmentId}:${i}`, type: "rate_increase", sendTo: "procurement", message: r.message, evidence: { emailId: d.emailId, file: a.name, attachmentId: a.id, quote: r.quote } }));
  }
  // Rate-card checks now come from the MSA rate cap (contract check F), not a flag.
  // AI flags that code does not already cover.
  for (const id of req.emailIds) {
    const ex = state.extractions[id]?.result; if (!ex) continue;
    ex.flags.forEach((fl, i) => {
      if (["unconfirmed", "rate_increase", "expiring"].includes(fl.type)) return;
      if (/data|access|rate|expir|start date/i.test(fl.message)) return;
      flags.push({ id: `flag:${reqId}:ai:${id}:${i}`, type: fl.type, sendTo: fl.sendTo, message: fl.message });
    });
  }

  // Drafts for the requester (Ava never sends).
  const drafts: Analysis["drafts"] = [];
  const contact = supplier?.contacts[0];
  const waiting = checklist.filter((c) => c.status === "waiting_supplier");
  if (waiting.length && contact) {
    const asks = waiting.map((c) => c.key === "insurance" ? "your current insurance certificate (professional indemnity)" : c.key === "security_cert" ? `your renewed ISO 27001 certificate (the one on file expires ${securityCert?.expiry ? fmtDate(securityCert.expiry) : "soon"})` : c.label.toLowerCase());
    const first = state.emails.find((e) => e.id === req.emailIds[0]);
    drafts.push({
      purpose: `docs:${waiting.map((c) => c.key).join("+")}`, to: contact.email, subject: `RE: ${first?.subject.replace(/^(re|fwd?):\s*/i, "") ?? req.title}`,
      body: `Hi ${contact.name.split(" ")[0]},\n\nBefore we sign off on ${req.project}, could you send ${asks.join(" and ")}?\n\nThanks,\n${firstName(req.requesterId)}`,
    });
  }

  // Handoff (rule 8)
  const openConf = conflicts.filter((c) => state.conflicts[c.id]?.status !== "resolved");
  const handoff = computeHandoffState({
    missingFacts: requiredFacts.filter((k) => factsView[k].displayState === "missing").map((k) => FIELD_LABEL[k] ?? k),
    unconfirmedFacts: requiredFacts.filter((k) => factsView[k].displayState === "unconfirmed").map((k) => FIELD_LABEL[k] ?? k),
    contradictedFacts: requiredFacts.filter((k) => factsView[k].displayState === "contradicted" && !openConf.some((c) => c.field === k)).map((k) => FIELD_LABEL[k] ?? k),
    checklistOpen: checklist.filter((c) => c.status === "pending" || c.status === "waiting_supplier").filter((c) => !["budget", "vp"].includes(c.key)).map((c) => c.label),
    approvalsPending: approvals.filter((a) => a.status === "pending").map((a) => `${personName(a.approverId)}`),
    approvalsStale: approvals.filter((a) => a.status === "needs_reconfirmation").map((a) => `${personName(a.approverId)}`),
    blockingConflicts: openConf.filter((c) => c.severity === "blocking").map((c) => c.title),
    supplierKnown: !!supplier?.known,
    endState: routing.endState,
  });

  // Pipeline column and who it waits on.
  const reqFlags = flags.filter((fl) => fl.question && !req.flags.find((x) => x.id === fl.id && x.status !== "open"));
  const hasSupplierDoc = f.documents.some((d) => ["quote", "order_form", "sow", "invoice"].includes(d.docType));
  let pipeline = "New";
  if (handoff.state === "ready_legal" || handoff.state === "ready_po") pipeline = "Ready";
  else if (handoff.state === "blocked") pipeline = "Blocked by change";
  else if (reqFlags.length) pipeline = "Waiting on requester";
  else if (!hasSupplierDoc) pipeline = "New";
  else if (checklist.some((c) => (c.status === "pending" || c.status === "waiting_supplier") && !["budget", "vp", "competing", "retro", "renewal_terms"].includes(c.key))) pipeline = "Due diligence";
  else if (approvals.some((a) => a.status === "pending")) pipeline = "Approvals";
  else pipeline = "Quote received";

  let waitingOn: string | undefined;
  if (handoff.state === "ready_legal") waitingOn = `${personName(POLICY.legal)} (Legal review)`;
  else if (handoff.state === "ready_po") waitingOn = "PO issue";
  else if (reqFlags.length) waitingOn = `${personName(req.requesterId)}: answer a question`;
  else {
    const stale = approvals.find((a) => a.status === "needs_reconfirmation"); const pend = approvals.find((a) => a.status === "pending" && a.gateOpen);
    const ws = checklist.find((c) => c.status === "waiting_supplier");
    const conf = openConf[0];
    if (stale) waitingOn = `${personName(stale.approverId)}: reconfirm`;
    else if (conf) waitingOn = `${personName(conf.ownerId)}: resolve conflict`;
    else if (ws) waitingOn = `${ws.owner === "infosec" ? "InfoSec" : "Procurement"}: ${ws.label.toLowerCase()} from supplier`;
    else if (pend) waitingOn = `${personName(pend.approverId)}: approve`;
    else if (!hasSupplierDoc) waitingOn = `${supName.split(" ")[0]}: quote`;
  }

  const result: Analysis = { req, folded: f, facts: factsView, amount, retro, requestAmount: reqAmt, spend, routing, checklist, approvals, conflicts, handoff, flags, drafts, engagementEnd, dataAccess, dataAccessConfirmed, requiredFacts, securityCert, rateFlags, pipeline, waitingOn, baseline, newLines, checks: cc.checks, contractClauses: cc.clauses };
  m.set(reqId, result);
  return result;
}

export function emailSrcLabel(s: Source) { return s.file === "email" ? "Email" : s.page ? `${s.file}, page ${s.page}` : s.file; }
export type { ConflictType };
