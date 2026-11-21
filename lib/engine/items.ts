// Department items: each person sees only what is waiting on them (rule 11). Derived from live state.
import type { ApprovalKey, Source, State } from "../types";
import { lakh } from "../format";
import { analyze } from "./rules";
import { firstName, personName, POLICY, roleOwner } from "./world";

export type ItemKind = "question" | "info" | "draft" | "approval" | "reconfirm" | "conflict" | "competing" | "retro" | "legal" | "packet" | "supplier" | "orphan" | "unsorted" | "finance" | "mention";

export interface Item {
  key: string;
  personId: string;
  requestId?: string;
  kind: ItemKind;
  title: string;
  question: string;
  evidence?: Source;
  detail?: string;
  flagId?: string;
  draftId?: string;
  conflictId?: string;
  approvalKey?: ApprovalKey;
  orphanId?: string;
  dept: string;
}

export const DEPT_OF: Record<string, string> = { rahul: "Requester", neha: "Requester", suresh: "Finance", karan: "Procurement", meera: "InfoSec", farah: "Legal", ananya: "Budget owner", deepa: "Budget owner", ritu: "Budget owner", vikram: "VP" };

export function deriveItems(state: State): Item[] {
  const items: Item[] = [];
  const add = (it: Omit<Item, "dept">) => {
    const personId = state.reassigned[it.key] ?? it.personId;
    items.push({ ...it, personId, dept: DEPT_OF[personId] ?? "" });
  };
  for (const id of state.requestOrder) {
    const req = state.requests[id];
    const a = analyze(state, id);
    const sup = state.suppliers.find((s) => s.id === req.supplierId);
    const supShort = (sup?.name ?? req.supplierGuess?.name ?? "supplier").split(" ")[0];
    // Flags
    for (const fl of a.flags) {
      const stored = req.flags.find((x) => x.id === fl.id);
      if (stored && stored.status !== "open") continue;
      add({ key: `item:${fl.id}`, personId: roleOwner(fl.sendTo, req.requesterId, req.costCentre), requestId: id, kind: fl.question ? "question" : "info", title: req.title, question: fl.message, evidence: fl.evidence, flagId: fl.id });
    }
    for (const fl of req.flags.filter((f) => f.status === "open" && f.type === "mention")) {
      add({ key: `item:${fl.id}`, personId: fl.personId, requestId: id, kind: "mention", title: req.title, question: fl.message, flagId: fl.id });
    }
    // Drafts the requester has not sent yet
    for (const d of state.drafts.filter((d) => d.requestId === id && d.status === "draft")) {
      add({ key: `item:draft:${d.id}`, personId: d.forPersonId, requestId: id, kind: "draft", title: req.title, question: `Ava drafted an email for you to send to ${supShort}: ${d.purpose}.`, draftId: d.id });
    }
    // Approvals
    for (const ap of a.approvals) {
      if (ap.status === "needs_reconfirmation") {
        add({ key: `item:${id}:approval:${ap.key}`, personId: ap.approverId, requestId: id, kind: "reconfirm", title: req.title, approvalKey: ap.key,
          question: `Reconfirm. ${ap.diffs.map((d) => `Given for ${d.old}. Current: ${d.new}.`).join(" ")}`, detail: ap.reopenSource ? `Source: ${ap.reopenSource}` : undefined });
      } else if (ap.status === "pending" && ap.gateOpen) {
        let q = "";
        if (ap.key === "budget_owner") q = `Approve ${lakh(a.requestAmount)} for ${req.project}${a.retro ? ` (including ${lakh(a.retro)} already invoiced)` : ""}?`;
        if (ap.key === "vp") q = `Approve the ${lakh(a.spend.total)} 90-day total for ${supShort} in ${req.costCentre}${req.exceptions.some((e) => e.kind !== "retro") ? ", and the exception" : ""}?`;
        if (ap.key === "infosec") {
          const sc = a.checklist.find((c) => c.key === "security_cert");
          q = `Confirm the security certificate covers ${/crm|salesforce/i.test(req.project) ? "CRM" : "customer"} data.${sc && sc.status !== "done" ? " Waiting on the renewed certificate." : ""}`;
        }
        add({ key: `item:${id}:approval:${ap.key}`, personId: ap.approverId, requestId: id, kind: "approval", title: req.title, approvalKey: ap.key, question: q });
      } else if (ap.key === "vp" && (ap.status === "approved" || ap.status === "reconfirmed")) {
        // nothing
      }
    }
    // Checklist items owned by Procurement / Finance
    for (const c of a.checklist) {
      if (c.key === "competing" && c.status === "pending" && !req.exceptions.some((e) => e.kind !== "retro"))
        add({ key: `item:${id}:competing`, personId: POLICY.procurementOwner, requestId: id, kind: "competing", title: req.title, question: `Attach a competing quote or record an exception. ${a.spend.text} is over ₹25L.` });
      if (c.key === "retro" && c.status === "pending" && !req.exceptions.some((e) => e.kind === "retro"))
        add({ key: `item:${id}:retro`, personId: POLICY.procurementOwner, requestId: id, kind: "retro", title: req.title, question: "Work started before approval. Record a reason and ask for a retrospective approval." });
      if (c.key === "gst_pan" && c.status === "pending")
        add({ key: `item:${id}:gst`, personId: POLICY.finance, requestId: id, kind: "finance", title: req.title, question: `Collect GST and PAN for ${sup?.name ?? req.supplierGuess?.name}.` });
      if ((c.key === "dpa" || c.key === "msa") && c.status === "legal_review")
        add({ key: `item:${id}:${c.key}`, personId: POLICY.legal, requestId: id, kind: "legal", title: req.title, question: c.key === "dpa" ? `DPA assigned to Legal review: ${supShort} will access customer data.` : "No master agreement on file. Assigned to Legal review." });
    }
    if (a.handoff.state === "ready_legal")
      add({ key: `item:${id}:packet`, personId: POLICY.legal, requestId: id, kind: "packet", title: req.title, question: `Handoff packet ready: ${req.title}. Confirmed facts, documents, signed receipts and open notes.` });
    // Conflicts
    for (const c of Object.values(state.conflicts).filter((c) => c.requestId === id && c.status === "open")) {
      if (c.type === "hidden_scope") continue; // the requester answers this through the Yes/No question
      add({ key: `item:conflict:${c.id}`, personId: c.ownerId, requestId: id, kind: "conflict", title: req.title, question: c.title, conflictId: c.id, detail: c.waitingOnSupplier ? "Waiting on supplier. Ava will re-check the reply." : undefined });
      if (c.escalated) add({ key: `item:conflict:${c.id}:esc`, personId: POLICY.vpApprover, requestId: id, kind: "conflict", title: req.title, question: `Escalated by ${firstName(POLICY.procurementOwner)}: ${c.title}`, conflictId: c.id });
    }
    if (!sup?.known)
      add({ key: `item:${id}:supplier`, personId: POLICY.procurementOwner, requestId: id, kind: "supplier", title: req.title, question: `Possible new supplier: ${sup?.name ?? req.supplierGuess?.name} (${sup?.domain ?? req.supplierGuess?.domain}). Check and add to the supplier list.` });
  }
  for (const o of state.orphans) {
    const sup = state.suppliers.find((s) => s.id === o.supplierId);
    if (o.status === "open" && o.likelyOwnerId)
      add({ key: `item:orphan:${o.id}`, personId: o.likelyOwnerId, kind: "orphan", title: `${o.invoiceNo}, ${lakh(o.amount)}`, question: `Looks like you're working with ${sup?.name ?? "this supplier"}. Confirm in 60 seconds and we'll cover you.`, orphanId: o.id, evidence: o.source });
    if (o.status === "not_mine" || (o.status === "open" && !o.likelyOwnerId))
      add({ key: `item:orphan:${o.id}:unsorted`, personId: POLICY.procurementOwner, kind: "unsorted", title: `${o.invoiceNo}, ${lakh(o.amount)}`, question: `Invoice with no request from ${sup?.name ?? "unknown supplier"}. ${o.status === "not_mine" ? `${personName(o.likelyOwnerId)} says it is not theirs.` : "No likely owner found."} Find the owner.`, orphanId: o.id, evidence: o.source });
  }
  return items;
}
