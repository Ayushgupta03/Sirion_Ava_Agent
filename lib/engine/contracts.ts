// Part 2: check every email and document against what is signed. Code computes every ₹ and day; the AI never does.
import data from "@/data/contracts.json";
import type { Attachment, Request, Source, State } from "../types";
import { addMonths, daysBetween, fmtDate, inr, istYmd, lakh, norm, parseAmount, parseDate } from "../format";
import type { Folded } from "./facts";
import { CONTRACTS } from "./world";

export interface Clause { clause: string; title: string; text: string; kind?: string; due?: string; value?: string; keywords?: string[] }
export interface ContractDoc { docId: string; supplierId: string; title: string; parties: string; signed: string; fees?: number; clauses: Clause[]; schedule?: { title: string; fixedUntil: string; capPct: number; rows: [string, number][] } }
export const CONTRACT_DOCS = data.docs as unknown as ContractDoc[];
export const SUPPLIER_HISTORY = data.history as Record<string, { what: string; asked?: string; received?: string; year?: number; businessDays?: number; count?: number; note?: string }[]>;

export const contractDoc = (docId: string) => CONTRACT_DOCS.find((d) => d.docId === docId);
export const clauseOf = (docId: string, clause: string) => contractDoc(docId)?.clauses.find((c) => c.clause === clause);
/** The exact text of a clause as printed in its PDF (used to highlight it). */
export const clauseQuote = (docId: string, clause: string) => { const c = clauseOf(docId, clause); return c ? `${c.clause} ${c.title}. ${c.text}` : ""; };
export const clauseSource = (docId: string, clause: string, note?: string): Source & { note?: string } => ({ emailId: "", file: `${docId} ${clause}`, docId, clause, quote: clauseQuote(docId, clause), note });
export const docsFor = (supplierId: string | null) => CONTRACT_DOCS.filter((d) => d.supplierId === supplierId);

/** Weekdays from the start date (inclusive) to the due date (exclusive). */
export function noticeBusinessDays(fromYmd: string, dueYmd: string) {
  let n = 0; const d = new Date(fromYmd + "T00:00:00Z"); const end = new Date(dueYmd + "T00:00:00Z");
  while (d < end) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; d.setUTCDate(d.getUTCDate() + 1); }
  return n;
}

export interface Check { id: string; docId: string; clause: string; status: "consistent" | "conflict" | "note"; text: string; emailId?: string; at?: string }
export interface ContractConflict {
  id: string; title: string; a: { label: string; quotes: (Source & { note?: string })[] }; b: { label: string; quotes: (Source & { note?: string })[] };
  whyItMatters: string; impact?: number; impactText: string; clauses: string[]; emailId: string;
}

const ROLE_KEYS: [RegExp, string][] = [[/architect/i, "Architect"], [/senior/i, "Senior"], [/migration/i, "Migration"], [/project manager/i, "Project Manager"]];
function quoteRows(a: Attachment) {
  const rows: { role: string; qty: number; months: number; rate: number; line: string }[] = [];
  for (const l of a.pages.flat()) {
    const m = l.replace(/\s+/g, " ").match(/^(.*?) ([\d.]+) ([\d.]+) ₹([\d,]+) ₹([\d,]+)$/);
    if (m) rows.push({ role: m[1], qty: parseFloat(m[2]), months: parseFloat(m[3]), rate: parseInt(m[4].replace(/,/g, "")), line: l });
  }
  return rows;
}
function scheduleRate(doc: ContractDoc, role: string) {
  const key = ROLE_KEYS.find(([re]) => re.test(role))?.[1];
  return key ? doc.schedule?.rows.find(([r]) => r.toLowerCase().includes(key.toLowerCase()))?.[1] : undefined;
}

export function checkCommitments(state: State, req: Request, f: Folded): { checks: Check[]; conflicts: ContractConflict[]; clauses: string[] } {
  const checks: Check[] = []; const conflicts: ContractConflict[] = []; const clauses = new Set<string>();
  const docs = docsFor(req.supplierId);
  const msa = docs.find((d) => d.schedule || d.clauses.some((c) => c.kind === "rate_cap" || c.kind === "renewal_cap"));
  const emails = req.emailIds.map((id) => state.emails.find((e) => e.id === id)!).filter((e) => e && e.origin !== "ava_draft");
  const att = (id?: string) => state.emails.flatMap((e) => e.attachments).find((a) => a.id === id);
  const sup = state.suppliers.find((s) => s.id === req.supplierId);
  const fromSupplier = (from: string) => !!sup && from.toLowerCase().endsWith("@" + sup.domain);

  const nda = docs.find((d) => d.docId.includes("NDA"));
  if (nda) checks.push({ id: `${nda.docId}:1`, docId: nda.docId, clause: "1", status: "consistent", text: `Found ${nda.docId}, signed ${fmtDate(nda.signed)}. In date.`, emailId: req.emailIds[0] });

  // Rates against the MSA cap (MSA 5.3, Schedule A).
  const quote = [...f.documents].reverse().find((d) => d.docType === "quote");
  const qa = att(quote?.attachmentId);
  if (msa?.schedule && qa && quote) {
    clauses.add(`${msa.docId} 5.3`);
    const cap = msa.schedule.capPct;
    const over: { role: string; line: string; note: string; amount: number }[] = [];
    for (const r of quoteRows(qa)) {
      const base = scheduleRate(msa, r.role); if (!base) continue;
      const max = Math.round(base * (1 + cap / 100));
      if (r.rate <= max) checks.push({ id: `${msa.docId}:5.3:${quote.attachmentId}:${r.role}`, docId: msa.docId, clause: "5.3", status: "consistent", text: `${r.role.replace(/ \(.*\)/, "")} ${inr(r.rate)}: within the ${cap}% cap (${inr(max)}).`, emailId: quote.emailId });
      else {
        const amount = (r.rate - max) * r.qty * r.months;
        over.push({ role: r.role, line: r.line, amount, note: `Max ${inr(max)}. Over by ${inr(r.rate - max)}${r.qty !== 1 ? ` × ${r.qty} ${r.qty < 1 ? "(part time)" : "people"}` : ""} × ${r.months} months = ${inr(amount)}` });
        checks.push({ id: `${msa.docId}:5.3:${quote.attachmentId}:${r.role}`, docId: msa.docId, clause: "5.3", status: "conflict", text: `${r.role.replace(/ \(.*\)/, "")} ${inr(r.rate)}: over the ${cap}% cap (${inr(max)}) by ${inr(amount)}.`, emailId: quote.emailId });
      }
    }
    if (over.length) {
      const total = over.reduce((s, o) => s + o.amount, 0);
      conflicts.push({
        id: `cf:${req.id}:contract:rates:${msa.docId}`, emailId: quote.emailId,
        title: `Rates break the MSA cap by ${inr(total)}`,
        a: { label: "What the contract says", quotes: [clauseSource(msa.docId, "5.3", `Schedule A rates ${msa.schedule.rows.map(([r, v]) => `${r.split(" ").slice(-1)[0]} ${inr(v)}`).join(", ")}`)] },
        b: { label: `What ${qa.name} charges`, quotes: [...over.map((o) => ({ emailId: quote.emailId, file: qa.name, attachmentId: qa.id, page: 1, quote: o.line, note: o.note })), { emailId: quote.emailId, file: "email", quote: "No written notice of a rate increase was found in the emails on record.", note: "MSA 5.3 needs 60 days' notice" }] },
        whyItMatters: `The quote charges ${inr(total)} more than the contract allows. Total over the cap: ${inr(total)}.`, impact: total, impactText: `${inr(total)} over the MSA rate cap`, clauses: [`${msa.docId} 5.3`],
      });
    }
  }

  // Delivery dates against SOW deliverables (MSA 4.2, 4.3, 9.1, 12.1).
  const deliverables = docs.flatMap((d) => d.clauses.filter((c) => c.kind === "deliverable").map((c) => ({ d, c })));
  for (const e of emails.filter((e) => fromSupplier(e.from))) {
    for (const s of e.body.split(/(?<=[.!?])\s+/)) {
      for (const { d, c } of deliverables) {
        if (!c.keywords?.some((k) => norm(s).includes(norm(k)))) continue;
        const newDate = parseDate(s, 2026);
        if (!newDate || !c.due) continue;
        clauses.add(`${d.docId} ${c.clause}`);
        if (newDate <= c.due) { checks.push({ id: `${d.docId}:${c.clause}:${e.id}`, docId: d.docId, clause: c.clause, status: "consistent", text: `Date ${fmtDate(newDate)} meets the due date in ${d.docId} ${c.clause}.`, emailId: e.id }); continue; }
        const days = daysBetween(c.due, newDate); const weeks = Math.floor(days / 7);
        const pct = Math.min(2 * weeks, 10); const credit = Math.round(((d.fees ?? 0) * pct) / 100);
        const notice = noticeBusinessDays(istYmd(e.sentAt), c.due);
        ["4.2", "4.3", "9.1", "12.1"].forEach((k) => clauses.add(`${msa?.docId ?? "MSA"} ${k}`));
        checks.push({ id: `${d.docId}:${c.clause}:${e.id}`, docId: d.docId, clause: c.clause, status: "conflict", text: `${fmtDate(newDate)} is ${days} days after the due date (${fmtDate(c.due)}).`, emailId: e.id });
        if (msa) checks.push({ id: `${msa.docId}:4.2:${e.id}`, docId: msa.docId, clause: "4.2", status: notice >= 10 ? "consistent" : "conflict", text: `Notice came ${notice} business days before the due date; 10 are required.`, emailId: e.id });
        conflicts.push({
          id: `cf:${req.id}:contract:delivery:${d.docId}:${c.clause}`, emailId: e.id,
          title: `${c.title.replace("Final deliverable", "Final clean-up report")} ${days} days late: delay credit up to ${inr(credit)}`,
          a: { label: "What the contract says", quotes: [clauseSource(d.docId, c.clause, `Due ${fmtDate(c.due)}`), ...(msa ? [clauseSource(msa.docId, "9.1", `${days} days late = ${weeks} weeks. 2% × ${weeks} = ${2 * weeks}%${2 * weeks > 10 ? ", capped at 10%" : pct === 10 ? ", the cap" : ""}: up to ${inr(credit)}`), clauseSource(msa.docId, "4.2", `Notice came ${notice} business days before the due date; 10 required`), clauseSource(msa.docId, "4.3", "A new date needs a signed change request (also MSA 12.1)")] : [])] },
          b: { label: "What the supplier wrote", quotes: [{ emailId: e.id, file: "email", quote: s, note: `New date ${fmtDate(newDate)}` }] },
          whyItMatters: `The migration depends on the clean-up data. Delay credit up to ${inr(credit)} (${pct}% of ${inr(d.fees)}).`, impact: credit, impactText: `Delay credit up to ${inr(credit)}`, clauses: [`${d.docId} ${c.clause}`, `${msa?.docId} 9.1`, `${msa?.docId} 4.2`],
        });
      }
    }
  }

  // Renewal terms against the subscription agreement (cap, notice, auto-renewal).
  const cap = docs.flatMap((d) => d.clauses.filter((c) => c.kind === "renewal_cap").map((c) => ({ d, c })))[0];
  const form = [...f.documents].reverse().find((d) => d.docType === "order_form");
  const base = req.baselineContractId ? CONTRACTS.find((x) => x.id === req.baselineContractId) : undefined;
  if (cap && form && base?.amount && f.facts.amount?.num) {
    const pct = Math.round(((f.facts.amount.num - base.amount) / base.amount) * 100);
    const capPct = parseInt(cap.c.text.match(/(\d+)%/)?.[1] ?? "0");
    clauses.add(`${cap.d.docId} 4.1`); clauses.add(`${cap.d.docId} 4.2`); clauses.add(`${cap.d.docId} 4.3`);
    checks.push({ id: `${cap.d.docId}:4.2:${form.attachmentId}`, docId: cap.d.docId, clause: "4.2", status: pct <= capPct ? "consistent" : "conflict", text: pct <= capPct ? `${pct}% increase: within the ${capPct}% cap.` : `${pct}% increase: over the ${capPct}% cap (max ${inr(Math.round(base.amount * (1 + capPct / 100)))}).`, emailId: form.emailId });
    const first = emails.find((e) => fromSupplier(e.from));
    if (first && cap.c.due) { const late = istYmd(first.sentAt) > cap.c.due; const term = docs.flatMap((d) => d.clauses).find((c) => c.kind === "term")?.due; checks.push({ id: `${cap.d.docId}:4.2:notice`, docId: cap.d.docId, clause: "4.2", status: late ? "conflict" : "consistent", text: late ? `Notice came ${term ? daysBetween(istYmd(first.sentAt), term) : "?"} days before term end; 60 required (by ${fmtDate(cap.c.due)}).` : "Notice in time.", emailId: first.id }); }
    const ar = f.facts.auto_renew?.num;
    if (ar != null) checks.push({ id: `${cap.d.docId}:4.3:${form.attachmentId}`, docId: cap.d.docId, clause: "4.3", status: ar ? "conflict" : "consistent", text: ar ? "The form renews automatically; the contract needs written agreement." : "No automatic renewal.", emailId: form.emailId });
  }

  // Insurance (MSA 11) and data processing (MSA 8.1).
  const ins = [...f.documents].reverse().find((d) => d.docType === "insurance");
  const insClause = msa?.clauses.find((c) => c.kind === "insurance");
  if (ins && insClause && msa) { const a = att(ins.attachmentId); const amt = parseAmount(a?.pages.flat().find((l) => /crore|limit/i.test(l))); checks.push({ id: `${msa.docId}:11:${ins.attachmentId}`, docId: msa.docId, clause: insClause.clause, status: amt && amt >= 2e7 ? "consistent" : "conflict", text: amt ? `Cover ${lakh(amt)}: ${amt >= 2e7 ? "meets" : "below"} the ₹2 crore minimum.` : "Cover amount not found.", emailId: ins.emailId }); }
  if (msa && f.facts.data_access?.num === 1) { clauses.add(`${msa.docId} 8.1`); checks.push({ id: `${msa.docId}:8.1`, docId: msa.docId, clause: "8.1", status: "note", text: "A DPA must be signed before customer data is processed. Assigned to Legal review.", emailId: f.facts.data_access.sources[0]?.emailId }); }
  if (msa?.clauses.some((c) => c.kind === "change_request")) clauses.add(`${msa.docId} 12.1`);
  if (msa?.clauses.some((c) => c.kind === "delay_credit") && req.type === "new_sow") clauses.add(`${msa.docId} 9.1`);
  return { checks, conflicts, clauses: [...clauses] };
}

export function engagementEndHint(start?: string, months?: number) { return start && months ? addMonths(start, months) : undefined; }
