// Plain-language summaries generated from engine state.
import type { Conflict, State } from "./types";
import type { Analysis } from "./engine/rules";
import { personName } from "./engine/world";
import { timingFor, waitSplit } from "./engine/timing";
import { fmtDT, lakh } from "./format";

const supplierShort = (name?: string) => (name ?? "").replace(/\s+(Pvt\.? Ltd\.?|Private Limited|LLP|Ltd\.?)$/i, "");
const first = (id?: string) => personName(id).split(" ")[0];
const and = (xs: string[]) => xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
export function conflictShort(c: Conflict) {
  if (c.type === "said_vs_written") return c.field === "amount" ? "price changed in a new quote" : `${c.field?.replace("_", " ")} differs from what was said`;
  if (c.type === "renewal_terms_changed") return "the order form differs from the email";
  if (c.type === "started_before_approval") return "an invoice arrived before approval";
  if (c.type === "hidden_scope") return "data access not confirmed";
  // against_contract and anything new: use the conflict's own title, up to the first colon.
  const t = c.title.split(":")[0].trim();
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** "3 business days on the calendar; Prayaan's own time 40 min, the rest waiting on the supplier." Computed from the event log. */
export function timeLine(state: State, reqId: string): string {
  const t = timingFor(state, reqId); const w = waitSplit(state, reqId);
  const h = (x: number) => (x < 1 ? `${Math.max(1, Math.round(x * 60))} min` : x < 48 ? `${Math.round(x * 10) / 10} h` : `${Math.round((x / 24) * 10) / 10} days`);
  return `${t.days} business day${t.days === 1 ? "" : "s"} on the calendar. Prayaan's own time: ${h(w.own)}${w.ownMet ? " (under the 1-day target)" : " (over the 1-day target)"}. The rest, ${h(w.supplier)}, was waiting on the supplier.`;
}

/** One plain sentence about where the request stands, generated from the engine. */
export function summarize(state: State, a: Analysis): string {
  const req = a.req;
  if (a.handoff.state === "ready_legal" || a.handoff.state === "ready_po") {
    const t = timingFor(state, req.id);
    return `${a.handoff.state === "ready_legal" ? "Ready for Legal Review" : "Ready to issue PO"} since ${fmtDT(req.readyAt!)}. Took ${timeLine(state, req.id)}`;
  }
  const who: string[] = [];
  const amt = (k: string) => k === "budget_owner" ? lakh(a.requestAmount) : k === "vp" ? lakh(a.spend.total) : "data access";
  const stale = a.approvals.filter((x) => x.status === "needs_reconfirmation");
  stale.forEach((x) => who.push(`${first(x.approverId)} (reconfirm ${amt(x.key)})`));
  if (!stale.length) {
    if (a.flags.some((f) => f.question && req.flags.find((s) => s.id === f.id)?.status === "open")) who.push(`${first(req.requesterId)} (data access question)`);
    const sup = state.suppliers.find((s) => s.id === req.supplierId);
    const docs = a.checklist.filter((c) => c.status === "waiting_supplier").map((c) => c.key === "insurance" ? "insurance" : c.key === "security_cert" ? "security" : c.label.toLowerCase());
    if (docs.length) who.push(`${supplierShort(sup?.name).split(" ")[0]} (${docs.length > 1 ? `${docs.join(" and ")} certificates` : `${docs[0]} certificate`})`);
    a.approvals.filter((x) => x.status === "pending" && x.gateOpen).forEach((x) => who.push(`${first(x.approverId)} (${x.key === "infosec" ? "confirm data access" : `approve ${amt(x.key)}`})`));
  }
  const open = Object.values(state.conflicts).filter((c) => c.requestId === req.id && c.status === "open");
  const lead = a.handoff.state === "blocked" ? "Blocked" : "In intake";
  const parts = [`${lead}: ${who.length ? `waiting on ${and(who.slice(0, 3))}${who.length > 3 ? ` and ${who.length - 3} more` : ""}` : a.handoff.reasons[0]?.toLowerCase() ?? "collecting facts"}.`];
  if (open.length) parts.push(`Open conflict${open.length > 1 ? "s" : ""}: ${and(open.map(conflictShort))}.`);
  return parts.join(" ");
}


/** Which demo a request belongs to, for small tags on cards. */
export function scenarioTag(state: State, id: string) {
  const th = Object.keys(state.threadRequest).find((t) => state.threadRequest[t] === id);
  return th === "t-sfm" ? "Scenario A" : th === "t-kosha" ? "Scenario B" : th === "t-mkt" ? "Repeat request" : state.requests[id].type === "invoice" ? "Invoice" : "Your email";
}
