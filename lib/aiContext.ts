// What the AI is given for a request. Code supplies every number and date; the AI only words and plans.
import type { State } from "./types";
import { analyze } from "./engine/rules";
import { requiredSteps } from "./engine/ai";
import { SUPPLIER_HISTORY } from "./engine/contracts";
import { PEOPLE, personName } from "./engine/world";
import { inr } from "./format";

export function requestContext(state: State, reqId: string) {
  const a = analyze(state, reqId); const r = a.req;
  const sup = state.suppliers.find((s) => s.id === r.supplierId);
  const emails = r.emailIds.map((id) => state.emails.find((e) => e.id === id)!).filter(Boolean).map((e) => ({ id: e.id, from: e.from, sentAt: e.sentAt, subject: e.subject, body: e.body.slice(0, 1200), attachments: e.attachments.map((x) => ({ id: x.id, name: x.name, text: x.pages.flat().join("\n").slice(0, 2500) })) }));
  return {
    today: state.now,
    request: { id: r.id, title: r.title, type: r.type, supplier: sup?.name ?? r.supplierGuess?.name, supplierId: r.supplierId, project: r.project, requester: personName(r.requesterId), requesterId: r.requesterId, costCentre: r.costCentre },
    numbersFromCode: { amount: a.requestAmount != null ? inr(a.requestAmount) : null, total90: inr(a.spend.total), spendText: a.spend.text, overLimit: a.spend.overLimit, handoff: a.handoff.state, handoffReasons: a.handoff.reasons },
    facts: Object.values(a.facts).map((f) => ({ field: f.label, value: f.value, state: f.displayState, source: f.sources[0] ? { emailId: f.sources[0].emailId, file: f.sources[0].file, attachmentId: f.sources[0].attachmentId, quote: f.sources[0].quote } : null })),
    approvals: a.approvals.map((x) => ({ key: x.key, approver: personName(x.approverId), approverId: x.approverId, status: x.status })),
    checklist: a.checklist.map((c) => ({ key: c.key, label: c.label, ownerId: c.ownerId, status: c.status, how: c.how })),
    commitments: a.checks.map((c) => ({ clauseId: `${c.docId} ${c.clause}`, status: c.status, text: c.text })),
    conflicts: Object.values(state.conflicts).filter((c) => c.requestId === reqId).map((c) => ({ id: c.id, title: c.title, status: c.status, type: c.type, impact: c.impactText, clauses: c.clauses, why: c.whyItMatters })),
    emails, supplierHistory: (r.supplierId && SUPPLIER_HISTORY[r.supplierId]) || [],
    people: PEOPLE.map((p) => ({ id: p.id, name: p.name, roles: p.roles })).concat([{ id: "ava", name: "Ava", roles: ["agent"] as never }]),
    requiredSteps: requiredSteps(a).map((s) => ({ id: s.id, title: s.title, ownerId: s.ownerId })),
    previousPlan: state.ai.plans[reqId]?.at(-1)?.output ?? null,
  };
}

export function conflictContext(state: State, conflictId: string) {
  const c = state.conflicts[conflictId];
  return { conflict: c, request: requestContext(state, c.requestId) };
}
