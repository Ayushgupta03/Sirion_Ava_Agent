// The pipeline board's rules, kept apart from the component so they can be tested. A request's column is worked
// out from its facts, approvals and conflicts. Nobody moves a card by hand, so these functions explain instead.
import type { Analysis } from "./engine/rules";
import { personName } from "./engine/world";

export const COLS = ["New", "Waiting on someone", "Approvals", "Blocked", "Ready"] as const;
export type Col = (typeof COLS)[number];
export const colOf = (p: string): Col => p === "New" ? "New" : p === "Approvals" ? "Approvals" : p === "Blocked by change" ? "Blocked" : p === "Ready" ? "Ready" : "Waiting on someone";

export const LABEL: Record<Col, string> = { New: "New", "Waiting on someone": "Waiting on others", Approvals: "Approvals", Blocked: "Blocked", Ready: "Ready" };
export const HINT: Record<Col, string> = {
  New: "Just captured. Nothing is waiting yet.",
  "Waiting on someone": "A named person or the supplier has the next step.",
  Approvals: "Facts and checks are done. Signatures are pending.",
  Blocked: "A conflict or a changed fact has to be settled first.",
  Ready: "Handed to Legal, or ready for a PO.",
};

/** One sentence on why the rules put a request in its column. */
export function whyHere(a: Analysis): string {
  const col = colOf(a.pipeline);
  const unsigned = a.approvals.filter((x) => x.status !== "approved" && x.status !== "reconfirmed").map((x) => personName(x.approverId));
  if (col === "Ready") return a.handoff.state === "ready_legal" ? "Every approval matches the facts, so it went to Legal." : "Every approval matches the facts. It is ready for a PO.";
  if (col === "Blocked") return a.handoff.reasons.length ? `Handoff is blocked: ${a.handoff.reasons.slice(0, 2).join("; ")}.` : "Something changed or conflicts, so handoff is blocked.";
  if (col === "Approvals") return `Facts and checks are done. Waiting for ${unsigned.join(" and ") || "approvals"}.`;
  if (col === "New") return "Captured, with no supplier document read yet.";
  return a.waitingOn ? `The next step is with ${a.waitingOn}.` : "Due diligence is still open.";
}

/** The answer when someone drags a card to a column the rules did not choose. */
export function whyNotMove(a: Analysis, to: Col): string {
  const from = colOf(a.pipeline);
  const lead = `${a.req.id} stays in ${LABEL[from]}. Where a request sits is worked out from its facts, approvals and conflicts, not moved by hand.`;
  const unsigned = a.approvals.filter((x) => x.status !== "approved" && x.status !== "reconfirmed").map((x) => personName(x.approverId));
  const facts = a.requiredFacts.filter((k) => a.facts[k]?.displayState !== "confirmed").length;
  const checks = a.checklist.filter((c) => !["budget", "vp"].includes(c.key) && !["done", "excepted", "legal_review"].includes(c.status)).length;
  const why =
    to === "Ready" ? (a.handoff.reasons.length ? `To get to Ready: ${a.handoff.reasons.slice(0, 2).join("; ")}.` : unsigned.length ? `To get to Ready: ${unsigned.join(" and ")} must approve.` : "")
    : to === "Approvals" ? `Approvals open once facts and checks are done. Still open: ${facts} fact${facts === 1 ? "" : "s"} and ${checks} check${checks === 1 ? "" : "s"}.`
    : to === "Blocked" ? "A request is blocked only by an open conflict or a fact that changed after approval."
    : to === "New" ? "Nothing goes back to New. It is for requests with no supplier document read yet."
    : `${whyHere(a)}`;
  return `${lead} ${why}`.trim();
}
