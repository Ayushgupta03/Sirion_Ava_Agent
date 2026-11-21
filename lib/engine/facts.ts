// Builds a request's facts and documents by folding its fact events in time order.
// Implements rule 7 (supersession) and keeps every older value as a version.
import type { Attachment, DocRec, DocType, Email, ExtractedFact, FactRec, Request, Source, State } from "../types";
import { norm, parseAmount, parseAutoRenew, parseBoolAccess, parseDate, parseMonths } from "../format";
import { CONTRACTS, person, personByEmail } from "./world";

export const MATERIAL = ["amount", "scope", "data_access", "duration", "supplier_entity"] as const;

export const FIELD_LABEL: Record<string, string> = {
  amount: "Amount (before GST)", gst: "GST", total: "Total incl. GST", start_date: "Start date", duration: "Duration / term",
  scope: "Scope", data_access: "Access to personal or customer data", payment_terms: "Payment terms", validity: "Quote validity",
  supplier_entity: "Supplier entity", auto_renew: "Automatic renewal", requester: "Requester", cost_centre: "Cost centre",
};

export function classifyDoc(a: Attachment): DocType {
  const n = a.name.toLowerCase();
  const text = a.pages.flat().join(" ").toLowerCase().slice(0, 3000);
  if (/iso|27001|soc ?2/.test(n) || /iso\/iec 27001/.test(text)) return "security_cert";
  if (/insurance|indemnity/.test(n) || /certificate of insurance/.test(text)) return "insurance";
  if (/rate.?card/.test(n) || (a.kind === "xlsx" && /rate/.test(text))) return "rate_card";
  if (/invoice|inv-|bill/.test(n) || /tax invoice/.test(text)) return "invoice";
  if (/order.?form/.test(n) || /order form/.test(text)) return "order_form";
  if (/msa.?comment|comments/.test(n)) return "msa_comments";
  if (/sow|statement of work/.test(n)) return "sow";
  if (/proposal|quote|quotation|estimate/.test(n) || /proposal|quotation/.test(text)) return "quote";
  return "other";
}

const PRICED: DocType[] = ["quote", "order_form", "sow"];

export function mapField(f: ExtractedFact): string | null {
  const v = f.value.toLowerCase();
  switch (f.field) {
    case "amount_pre_gst": return "amount";
    case "duration": return "duration";
    case "notice_period": case "renewal_date": return /renew/.test(v) || /renew/i.test(f.source.quote) ? "auto_renew" : "notice_period";
    case "certificate_expiry": return "certificate_expiry";
    case "other":
      if (/renew/.test(v)) return "auto_renew";
      return null;
    default: return f.field;
  }
}

function numFor(field: string, value: string, quote: string, baseline?: number): number | undefined {
  switch (field) {
    case "amount": case "gst": case "total":
      if (/same|no change|unchanged|nothing changes/i.test(value) && baseline != null) return baseline;
      return parseAmount(value) ?? parseAmount(quote);
    case "duration": return parseMonths(value) ?? parseMonths(quote);
    case "data_access": return parseBoolAccess(value);
    case "auto_renew": return parseAutoRenew(value) ?? parseAutoRenew(quote);
    default: return undefined;
  }
}

function sameValue(a: FactRec, num: number | undefined, value: string) {
  if (a.num != null && num != null) return Math.abs(a.num - num) < 0.5;
  if (a.field === "start_date") return parseDate(a.value) === parseDate(value);
  return norm(a.value) === norm(value);
}

export function baselineContract(req: Request) {
  return CONTRACTS.find((c) => c.id === req.baselineContractId);
}

export interface Folded {
  facts: Record<string, FactRec>;
  documents: DocRec[];
  claimsNoChange?: Source;
  startedSignal?: Source;
}

/** Pure: fold a request's fact events into facts and documents. */
export function foldFacts(state: State, req: Request, emailsById?: Map<string, Email>): Folded {
  const byId = emailsById ?? new Map(state.emails.map((e) => [e.id, e]));
  const facts: Record<string, FactRec> = {};
  const documents: DocRec[] = [];
  let claimsNoChange: Source | undefined;
  let startedSignal: Source | undefined;
  const baseline = baselineContract(req);

  // Directory facts.
  const dir = (field: string, value: string, quote: string) => {
    const src: Source = { emailId: "", file: "directory", quote };
    facts[field] = { field, value, state: "confirmed", origin: "directory", sources: [src], versions: [{ value, source: src, at: req.createdAt, status: "current" }] };
  };
  const reqPerson = person(req.requesterId);
  dir("requester", reqPerson?.name ?? req.requesterId, `Employee directory: ${reqPerson?.email ?? ""}`);
  dir("cost_centre", req.costCentre, `Employee directory: ${reqPerson?.name ?? ""} → ${req.costCentre}`.trim());
  const sup = state.suppliers.find((s) => s.id === req.supplierId);
  if (sup) dir("supplier_entity", sup.name, `Supplier list: ${sup.name}, ${sup.domain}`);
  if (req.type === "renewal" && baseline) {
    // Renewal under an existing agreement: data handling does not change unless a document says so.
    const src: Source = { emailId: "", file: "directory", quote: `${baseline.id}: ${baseline.renewalTerms ?? baseline.title}` };
    facts["data_access"] = { field: "data_access", value: "No change from the existing agreement", num: 0, state: "confirmed", origin: "directory", sources: [src], versions: [{ value: "No change", num: 0, source: src, at: req.createdAt, status: "current" }] };
  }

  const put = (field: string, value: string, num: number | undefined, state: FactRec["state"], origin: FactRec["origin"], src: Source, at: string, isStatement: boolean, by?: string) => {
    const cur = facts[field];
    const version = { value, num, source: src, at, status: "current" as const };
    if (isStatement) {
      // What a person said in email.
      if (cur) cur.said = { value, num, source: src };
      if (!cur || cur.origin === "email" || cur.origin === "directory") {
        if (cur && sameValue(cur, num, value)) { cur.sources.push(src); if (state === "confirmed") cur.state = "confirmed"; return; }
        const versions = cur ? cur.versions.map((v) => ({ ...v, status: "superseded" as const })) : [];
        facts[field] = { field, value, num, state, origin, sources: [src], versions: [...versions, version], said: { value, num, source: src } };
      } else if (sameValue(cur, num, value)) cur.sources.push(src);
      return;
    }
    if (origin === "person") {
      const versions = cur ? cur.versions.map((v) => ({ ...v, status: "superseded" as const })) : [];
      facts[field] = { field, value, num, state: "confirmed", origin, sources: [src], versions: [...versions, version], confirmedBy: by, said: { value, num, source: src } };
      return;
    }
    // Document.
    if (!cur) { facts[field] = { field, value, num, state, origin, sources: [src], versions: [version] }; return; }
    if (sameValue(cur, num, value)) {
      cur.sources.push(src);
      if (cur.origin !== "person" && state === "confirmed") {
        if (cur.origin !== "document") { cur.value = value; cur.num = num ?? cur.num; const last = cur.versions[cur.versions.length - 1]; if (last) { last.value = value; last.source = src; } cur.sources = [src, ...cur.sources.filter((x) => x !== src)]; }
        cur.state = "confirmed"; cur.origin = "document";
      }
      return;
    }
    // Rule 7: a newer document replaces the old value; the old one is kept as a version.
    const keepSaid = cur.said ?? (cur.origin === "person" ? { value: cur.value, num: cur.num, source: cur.sources[0] } : undefined);
    facts[field] = {
      field, value, num, state: cur.origin === "person" && field === "data_access" ? "confirmed" : state, origin,
      sources: [src], versions: [...cur.versions.map((v) => ({ ...v, status: "superseded" as const })), version], said: keepSaid,
      confirmedBy: undefined,
    };
  };

  const events = [...req.factEvents].sort((a, b) => a.at.localeCompare(b.at));
  for (const ev of events) {
    if (ev.kind === "person") {
      put(ev.field, ev.value, ev.num, "confirmed", "person", { emailId: "", file: "person", quote: ev.reason, by: ev.by }, ev.at, false, ev.by);
      continue;
    }
    const email = byId.get(ev.emailId);
    const ex = state.extractions[ev.emailId]?.result;
    if (!email) continue;
    // Documents
    for (const a of email.attachments) {
      const docType = classifyDoc(a);
      const prior = documents.filter((d) => d.docType === docType && !d.supersededBy);
      const version = documents.filter((d) => d.docType === docType).length + 1;
      prior.forEach((d) => { if (["quote", "order_form", "security_cert", "insurance", "rate_card"].includes(docType)) d.supersededBy = a.id; });
      documents.push({ attachmentId: a.id, emailId: email.id, name: a.name, docType, version, receivedAt: email.sentAt });
    }
    if (!ex) continue;
    const fromPerson = personByEmail(email.from);
    const docFacts = ex.facts.filter((f) => f.source.file !== "email");
    const mailFacts = ex.facts.filter((f) => f.source.file === "email");
    let supplierStatedAmount = false;
    for (const f of [...docFacts, ...mailFacts]) {
      const field = mapField(f);
      const fromDoc = f.source.file !== "email";
      const att = fromDoc ? email.attachments.find((a) => a.name.toLowerCase() === f.source.file.toLowerCase()) : undefined;
      const src: Source = { emailId: email.id, file: f.source.file, attachmentId: att?.id, page: f.source.page, quote: f.source.quote, by: fromDoc ? undefined : fromPerson?.id };
      const v = f.value.toLowerCase();
      if (f.field === "other" && /start(ed)?\b.*\b(work|today)|work (has )?started|onboarded|began work|kicked off|work started/.test(v + " " + f.source.quote.toLowerCase()) && !fromPerson) startedSignal = src;
      if (!fromDoc && !fromPerson && /nothing changes|no change|same price|unchanged/.test(v + " " + f.source.quote.toLowerCase()) && (f.field === "other" || f.field === "amount_pre_gst")) claimsNoChange = src;
      if (!field) continue;
      if (field === "certificate_expiry") {
        const d = documents.find((d) => d.attachmentId === att?.id) ?? documents.filter((d) => d.emailId === email.id && (d.docType === "security_cert" || d.docType === "insurance"))[0];
        if (d) d.expiry = parseDate(f.value) ?? parseDate(f.source.quote);
        continue;
      }
      const docType = att ? documents.find((d) => d.attachmentId === att.id)?.docType : undefined;
      if (fromDoc && docType && !(req.type === "invoice" ? [...PRICED, "invoice" as DocType] : PRICED).includes(docType) && ["amount", "gst", "total", "duration", "scope", "data_access", "start_date"].includes(field)) continue;
      const num = numFor(field, f.value, f.source.quote, baseline?.amount);
      if (!fromDoc && !fromPerson && field === "amount" && num != null && !/same|no change|unchanged/.test(v)) supplierStatedAmount = true;
      let st: FactRec["state"] = f.state === "contradicted" ? "unconfirmed" : f.state;
      if (fromDoc && field !== "data_access" && f.state !== "unconfirmed") st = "confirmed";
      put(field, f.value, num, st, fromDoc ? "document" : "email", src, email.sentAt, !fromDoc);
    }
    if (supplierStatedAmount) claimsNoChange = undefined;
  }
  return { facts, documents, claimsNoChange, startedSignal };
}

/** Rule 7 as a standalone pure helper (used by tests and the diff view). */
export function applySupersession(cur: FactRec | undefined, value: string, num: number | undefined, src: Source, at: string): FactRec {
  const version = { value, num, source: src, at, status: "current" as const };
  if (!cur) return { field: "", value, num, state: "confirmed", origin: "document", sources: [src], versions: [version] };
  if (sameValue(cur, num, value)) return { ...cur, sources: [...cur.sources, src] };
  return { ...cur, value, num, state: "confirmed", origin: "document", sources: [src], versions: [...cur.versions.map((v) => ({ ...v, status: "superseded" as const })), version] };
}

/** Lines in the newer document that are not in the older one (for side-by-side diffs). */
export function docDiff(older: Attachment, newer: Attachment) {
  const o = new Set(older.pages.flat().map(norm));
  const n = new Set(newer.pages.flat().map(norm));
  return {
    added: newer.pages.flat().filter((l) => !o.has(norm(l))),
    removed: older.pages.flat().filter((l) => !n.has(norm(l))),
  };
}
