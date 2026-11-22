// Simulated Ava: the advice a model would give, written by code from the conflict's own facts.
// This prototype has no model key by decision, so anything outside the scripted scenarios (a composed email, a Test Lab
// email, an Ask Ava request) gets this instead of "no recommendation". It is labelled "Simulated" everywhere it shows.
// Same contract as the model's output: at most two sentences of reasoning, a citation for every claim, no money figure
// that code did not produce, and it never approves, rejects or applies a credit.
import type { Conflict, State } from "../types";
import type { AiRec, Cite } from "../aiTypes";
import { analyze } from "./rules";
import { firstName, personName } from "./world";
import { lakh } from "../format";
import type { ApprovalKey } from "../types";

const shortName = (n: string) => n.replace(/ (Pvt Ltd|LLP)$/, "").split(" ")[0];
const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
const end = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`); // every sentence ends once
const tidy = (t: string) => t.replace(/\s+/g, " ").trim(); // a table row arrives with column gaps
const shortDoc = (id: string) => (id.includes("MSA") ? "MSA" : id);

/** Citations taken from the two sides of the conflict, so every claim points at the line it came from. */
function citesOf(c: Conflict): Cite[] {
  const out: Cite[] = [];
  for (const q of [...c.a.quotes, ...c.b.quotes]) {
    const cite: Cite | undefined = q.docId && q.clause ? { type: "clause", id: `${q.docId} ${q.clause}`, quote: q.quote }
      : q.attachmentId ? { type: "doc", id: q.attachmentId, quote: q.quote }
      : q.emailId ? { type: "email", id: q.emailId, quote: q.quote } : undefined;
    if (cite && !out.some((o) => o.type === cite.type && o.id === cite.id)) out.push(cite);
  }
  return out.slice(0, 3);
}

/** "MSA 5.3" from the first quote that points into a signed contract. */
function clauseLabel(c: Conflict): string | undefined {
  const q = [...c.a.quotes, ...c.b.quotes].find((x) => x.docId && x.clause);
  return q ? `${shortDoc(q.docId!)} ${q.clause}` : undefined;
}

export function simulatedRec(state: State, c: Conflict): AiRec | undefined {
  const req = state.requests[c.requestId]; if (!req) return undefined;
  const sup = state.suppliers.find((s) => s.id === req.supplierId);
  const supplier = shortName(sup?.name ?? req.supplierGuess?.name ?? "the supplier");
  const contact = shortName(sup?.contacts[0]?.name ?? supplier);
  const owner = firstName(c.ownerId); const requester = firstName(req.requesterId);
  const cl = clauseLabel(c); const citations = citesOf(c);
  const first = (t: string) => end(sentences(t)[0] ?? t);
  const impact = c.impactText ? `Impact: ${c.impactText}.` : "";
  const sign = `Thanks,\n${owner}`;
  const base = { citations, confidence: "medium" as const };

  switch (c.type) {
    case "against_contract": {
      const qa = c.a.quotes[0]?.quote && tidy(c.a.quotes[0].quote); const qb = c.b.quotes[0]?.quote && tidy(c.b.quotes[0].quote);
      return { ...base, recommendation: `Ask ${supplier} to reissue it within the agreement${cl ? ` (${cl})` : ""}.`, reasoning: [first(c.whyItMatters), impact].filter(Boolean).join(" "), action: "draft_supplier",
        draft: `Hi ${contact},\n\n${end(c.title)}${qa && qb ? `\n\nOur agreement says: “${qa}”${cl ? ` (${cl})` : ""}. Your document says: “${qb}”.` : ""}\n\nCould you reissue it within the agreement?\n\n${sign}` };
    }
    case "renewal_terms_changed":
      return { ...base, recommendation: `Hold the renewal and ask ${supplier} to confirm the changed terms in writing${cl ? `, within ${cl}` : ""}.`, reasoning: [first(c.title), impact || first(c.whyItMatters)].filter(Boolean).join(" "), action: "draft_supplier",
        draft: `Hi ${contact},\n\n${end(c.title)}${cl ? ` Our agreement sets limits on a renewal (${cl}).` : ""}\n\nCould you confirm the renewal terms in writing, within those limits?\n\n${sign}` };
    case "said_vs_written": {
      const vals = c.aValue && c.bValue ? `: ${c.aValue} or ${c.bValue}` : "";
      return { ...base, recommendation: `Ask ${supplier} to confirm in writing which figure applies${vals}.`, reasoning: `${first(c.whyItMatters)} Both versions are on the record.`, action: "draft_supplier",
        draft: `Hi ${contact},\n\n${end(c.title)}\n\nCould you confirm in writing which one applies? We cannot approve until the numbers match.\n\n${sign}` };
    }
    case "hidden_scope":
      return { ...base, recommendation: `Ask ${requester} whether ${supplier} will touch customer data. If yes, InfoSec review and a DPA are needed.`, reasoning: sentences(c.title).slice(0, 2).join(" ") };
    case "started_before_approval":
      return { ...base, recommendation: `Record why work began before approval, then ask the budget owner for a retrospective approval.`, reasoning: [first(c.title), impact].filter(Boolean).join(" ") };
    default:
      return undefined;
  }
}

/** The three-line summary on a Decision Receipt, when no stored one exists. Figures come from the rules engine. */
export function simulatedReceipt(state: State, requestId: string, key: ApprovalKey): AiRec | undefined {
  const req = state.requests[requestId]; if (!req) return undefined;
  const a = analyze(state, requestId);
  const supplier = shortName(state.suppliers.find((s) => s.id === req.supplierId)?.name ?? req.supplierGuess?.name ?? "the supplier");
  const open = Object.values(state.conflicts).filter((c) => c.requestId === requestId && c.status === "open");
  const approver = a.approvals.find((x) => x.key === key);
  const bullets = [
    key === "infosec" ? `You are reviewing ${supplier}'s access to customer data and its security certificate.`
      : `You are approving ${lakh(a.requestAmount)} for ${req.project}${a.facts.duration?.value ? `, ${a.facts.duration.value}` : ""}.`,
    open.length ? `Open: ${open.map((c) => c.title).join("; ")}.` : "No open problems on this request.",
    key === "vp" ? `The 90-day total with ${supplier} is ${lakh(a.spend.total)}${a.spend.overLimit ? ", over the ₹25L limit" : ""}.` : `Ava checked ${a.checks.length} contract term${a.checks.length === 1 ? "" : "s"} against what ${supplier} sent.`,
  ];
  return { recommendation: `Summary for ${approver ? personName(approver.approverId).split(" ")[0] : "the approver"}`, reasoning: "What you are approving and the open risks.", citations: [], confidence: "medium", bullets };
}
