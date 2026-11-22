import { describe, expect, it } from "vitest";
import { applyEvent, initialState } from "@/lib/engine/pipeline";
import { analyze, approvalStatus, computeCumulativeSpend, computeHandoffState, computeRouting } from "@/lib/engine/rules";
import { applySupersession } from "@/lib/engine/facts";
import { deriveItems } from "@/lib/engine/items";
import { CONTRACTS } from "@/lib/engine/world";
import { SCENARIO_A, SCENARIO_B, SEED_EVENTS } from "@/lib/story";
import { contrastEmails } from "@/lib/scripted";
import { EXTRACTION_CACHE } from "@/lib/cache";
import { sampleAttachment } from "@/lib/samples";
import { basicExtract } from "@/lib/basicExtractor";
import type { State } from "@/lib/types";
import type { Step as StoryStep } from "@/lib/story";

function run(steps: StoryStep[], upTo: number, s0?: State): State {
  let s = s0 ?? SEED_EVENTS.reduce(applyEvent, initialState());
  for (const step of steps.slice(0, upTo)) for (const b of step.events) { const e = b(s); if (e) s = applyEvent(s, e); }
  return s;
}
const REQ = (s: State, thread: string) => s.threadRequest[thread];

describe("pure functions", () => {
  it("computeCumulativeSpend: ₹9L + ₹9L + ₹20L = ₹38L", () => {
    const sp = computeCumulativeSpend(CONTRACTS, [{ id: "REQ-1047", title: "x", supplierId: "trivenika", costCentre: "CC-SALESOPS", amount: 2000000 }], "trivenika", "CC-SALESOPS", "2026-11-12", "REQ-1047");
    expect(sp.total).toBe(3800000); expect(sp.overLimit).toBe(true); expect(sp.text).toBe("₹9L + ₹9L + ₹20L = ₹38L");
  });
  it("computeCumulativeSpend excludes contracts older than 90 days and other cost centres", () => {
    const sp = computeCumulativeSpend(CONTRACTS, [], "trivenika", "CC-MKTOPS", "2026-11-12");
    expect(sp.total).toBe(0);
  });
  it("computeRouting requires VP over ₹25L and InfoSec with confirmed data access", () => {
    const sp = computeCumulativeSpend(CONTRACTS, [{ id: "R", title: "x", supplierId: "trivenika", costCentre: "CC-SALESOPS", amount: 2000000 }], "trivenika", "CC-SALESOPS", "2026-11-12", "R");
    const r = computeRouting({ supplierName: "Trivenika", costCentre: "CC-SALESOPS", spend: sp, dataAccess: 1, dataAccessConfirmed: true, budgetOwnerId: "ananya", hasMsa: true, nonStandardTerms: false, requestType: "new_sow" });
    expect(r.approvals.map((a) => a.key)).toEqual(["budget_owner", "vp", "infosec"]);
    expect(r.endState).toBe("legal");
  });
  it("applySupersession keeps the old version", () => {
    const a = applySupersession(undefined, "₹20,00,000", 2000000, { emailId: "e", file: "v1.pdf", quote: "q" }, "t1");
    const b = applySupersession(a, "₹21,50,000", 2150000, { emailId: "e2", file: "v2.pdf", quote: "q2" }, "t2");
    expect(b.num).toBe(2150000); expect(b.versions.length).toBe(2); expect(b.versions[0].status).toBe("superseded");
  });
  it("approvalStatus reopens when the amount changes", () => {
    const st = approvalStatus([{ id: "r", at: "t", by: "ananya", kind: "approved", snapshot: { amount: 2000000 } }], { amount: 2150000 });
    expect(st.status).toBe("needs_reconfirmation"); expect(st.diffs[0].old).toBe("₹20L"); expect(st.diffs[0].new).toBe("₹21.5L");
  });
  it("computeHandoffState blocks on stale approvals", () => {
    const h = computeHandoffState({ missingFacts: [], unconfirmedFacts: [], contradictedFacts: [], checklistOpen: [], approvalsPending: [], approvalsStale: ["Ananya", "Vikram"], blockingConflicts: [], supplierKnown: true, endState: "legal" });
    expect(h.state).toBe("blocked"); expect(h.banner).toBe("Handoff blocked: 2 approvals do not match current facts.");
  });
});

describe("Scenario A through the pipeline", () => {
  it("step 1-2: REQ-1047, ₹38L, VP and competing quote", () => {
    const s = run(SCENARIO_A, 2); const id = REQ(s, "t-sfm");
    expect(id).toBe("REQ-1047");
    const a = analyze(s, id);
    expect(a.spend.total).toBe(3800000);
    expect(a.routing.approvals.some((x) => x.key === "vp")).toBe(true);
    expect(a.routing.needsCompetingQuote).toBe(true);
    expect(a.flags.some((f) => f.message === "Start date is 4 days away.")).toBe(true);
  });
  it("step 3: amount confirmed by document, data access question, rate flag", () => {
    const s = run(SCENARIO_A, 3); const a = analyze(s, REQ(s, "t-sfm"));
    expect(a.facts.amount.state).toBe("confirmed"); expect(a.facts.amount.origin).toBe("document");
    expect(a.flags.find((f) => f.question === "data_access")).toBeTruthy();
    const rates = a.conflicts.find((c) => c.id.includes(":contract:rates:"))!;
    expect(rates.impact).toBe(39200); expect(rates.type).toBe("against_contract");
    expect(a.checks.find((c) => /Architect/.test(c.text))!.status).toBe("consistent");
    const del = a.conflicts.find((c) => c.id.includes(":contract:delivery:"))!;
    expect(del.impact).toBe(90000);
    expect(del.a.quotes.map((q) => q.note).join(" ")).toMatch(/2 business days before the due date; 10 required/);
    expect(del.title).toMatch(/35 days late/);
  });
  it("step 4: departments get their items", () => {
    const s = run(SCENARIO_A, 4); const items = deriveItems(s);
    const by = (p: string) => items.filter((i) => i.personId === p).map((i) => i.question);
    expect(by("meera").join()).toMatch(/security certificate covers CRM data/);
    expect(by("ananya").join()).toMatch(/Approve ₹20L/);
    expect(by("vikram").join()).toMatch(/₹38L/);
    expect(by("karan").join()).toMatch(/competing quote/);
    expect(by("farah").join()).toMatch(/DPA/);
    const a = analyze(s, REQ(s, "t-sfm"));
    expect(a.checklist.find((c) => c.key === "nda")!.status).toBe("done");
    expect(a.checklist.find((c) => c.key === "security_cert")!.status).toBe("waiting_supplier");
    expect(a.flags.find((f) => f.type === "expiring")!.message).toMatch(/8 Dec 2026, in 3 weeks/);
  });
  it("step 6-7: ₹21.5L, ₹39.5L, exactly two approvals reopen, handoff blocked", () => {
    const s = run(SCENARIO_A, 7); const a = analyze(s, REQ(s, "t-sfm"));
    expect(a.amount).toBe(2150000); expect(a.spend.total).toBe(3950000);
    const stale = a.approvals.filter((x) => x.status === "needs_reconfirmation");
    expect(stale.map((x) => x.approverId).sort()).toEqual(["ananya", "vikram"]);
    expect(stale.find((x) => x.key === "budget_owner")!.diffs[0]).toMatchObject({ old: "₹20L", new: "₹21.5L" });
    expect(stale.find((x) => x.key === "vp")!.diffs[0]).toMatchObject({ old: "₹38L", new: "₹39.5L" });
    expect(stale[0].reopenSource).toBe("Trivenika_Proposal_v2.pdf, page 1, line 5");
    expect(a.handoff.banner).toBe("Handoff blocked: 2 approvals do not match current facts.");
    expect(s.counters.approvalsReopened).toBe(2);
    expect(Object.values(s.conflicts).some((c) => c.type === "said_vs_written" && c.status === "open")).toBe(true);
  });
  it("step 9: Ready for Legal Review, 3 business days, InfoSec longest wait", () => {
    const s = run(SCENARIO_A, 9); const id = REQ(s, "t-sfm"); const a = analyze(s, id);
    expect(a.handoff.state).toBe("ready_legal");
    expect(s.requests[id].readyAt).toBe("2026-11-17T11:05:00+05:30");
    expect(deriveItems(s).some((i) => i.personId === "farah" && i.kind === "packet")).toBe(true);
  });
  it("new input: a ₹23L quote on the thread gives ₹41L, a conflict, reopened approvals", () => {
    let s = run(SCENARIO_A, 9);
    const att = sampleAttachment("Trivenika_Quote_23L.pdf", "x-att1");
    const email = { id: "x1", threadId: "t-sfm", from: "arjun.d@trivenika.example", to: ["rahul.mehta@prayaan.example"], cc: [], subject: "RE: quote", body: "Hi Rahul, our revised quote is attached. Regards, Arjun", sentAt: "2026-11-17T12:00:00+05:30", attachments: [att], origin: "composed" as const };
    const ex = basicExtract(email, []);
    s = applyEvent(s, { id: "evx", at: email.sentAt, kind: "email", email, extraction: ex, extractionSource: "basic" });
    const a = analyze(s, REQ(s, "t-sfm"));
    expect(a.spend.total).toBe(4100000);
    expect(a.approvals.filter((x) => x.status === "needs_reconfirmation").length).toBeGreaterThanOrEqual(2);
    expect(a.handoff.state).toBe("blocked");
    expect(Object.values(s.conflicts).some((c) => c.type === "said_vs_written" && c.status === "open")).toBe(true);
  });
});

describe("Contrast and Scenario B", () => {
  it("repeat request reaches Ready to issue PO with one approval", () => {
    let s = run(SCENARIO_A, 1);
    for (const e of contrastEmails(s.now)) s = applyEvent(s, { id: `ev-${e.id}`, at: e.sentAt, kind: "email", email: e, extraction: EXTRACTION_CACHE[e.id], extractionSource: "cached" });
    const id = REQ(s, "t-mkt"); let a = analyze(s, id);
    expect(a.spend.total).toBe(600000); expect(a.routing.approvals.map((x) => x.key)).toEqual(["budget_owner"]);
    s = applyEvent(s, { id: "evc", at: s.now, kind: "action", actor: "ritu", action: { type: "approve", requestId: id, key: "budget_owner" } });
    a = analyze(s, id); expect(a.handoff.state).toBe("ready_po");
  });
  it("Scenario B: conflict, invoice linked, revised form, ₹21.3L Ready to issue PO", () => {
    let s = run(SCENARIO_A, 9);
    s = run(SCENARIO_B, 1, s); const id = REQ(s, "t-kosha");
    expect(id).toBe("REQ-1063");
    const c = Object.values(s.conflicts).find((c) => c.requestId === id && c.type === "renewal_terms_changed")!;
    expect(c.b.quotes.length).toBe(3); expect(c.a.quotes[0].quote).toMatch(/nothing changes/);
    s = run(SCENARIO_B.slice(1), 1, s);
    expect(s.drafts.find((d) => d.requestId === id && d.conflictId)!.body).toMatch(/counter|12 months at 5%/);
    s = run(SCENARIO_B.slice(2), 1, s);
    expect(s.requests[id].retroItems[0].invoiceNo).toBe("KA-7781");
    expect(Object.values(s.conflicts).some((c) => c.requestId === id && c.type === "started_before_approval" && c.status === "open")).toBe(true);
    s = run(SCENARIO_B.slice(3), 1, s);
    expect(s.conflicts[c.id].status).toBe("resolved");
    s = run(SCENARIO_B.slice(4), 1, s);
    const a = analyze(s, id);
    expect(a.spend.total).toBe(2130000);
    expect(a.handoff.state).toBe("ready_po");
    expect(s.counters.startedBeforeApproval["Finance"]).toBe(1);
  });
});

import { timingFor } from "@/lib/engine/timing";
describe("timing and extraction-source independence", () => {
  it("timing panel: 3 business days, InfoSec longest wait Thu 12:05 to Tue 11:05", () => {
    const s = run(SCENARIO_A, 9); const t = timingFor(s, REQ(s, "t-sfm"));
    expect(t.days).toBe(3);
    expect(t.longest).toBe("InfoSec, waiting on the supplier's renewed security certificate (Thu 12 Nov, 12:05 to Tue 17 Nov, 11:05)");
  });
  it("Scenario A with the basic extractor (no cache) reaches the same outcomes", () => {
    const noCache = SCENARIO_A.map((st) => ({ ...st, events: st.events.map((b) => (s: State) => { const e = b(s); if (e && e.kind === "email") { return { ...e, extraction: basicExtract(e.email, s.suppliers), extractionSource: "basic" as const }; } return e; }) }));
    const s6 = run(noCache, 7); const a6 = analyze(s6, REQ(s6, "t-sfm"));
    expect(analyze(run(noCache, 2), REQ(run(noCache, 2), "t-sfm")).spend.total).toBe(3800000);
    expect(a6.spend.total).toBe(3950000);
    expect(a6.approvals.filter((x) => x.status === "needs_reconfirmation").length).toBe(2);
    const s9 = run(noCache, 9); expect(analyze(s9, REQ(s9, "t-sfm")).handoff.state).toBe("ready_legal");
  });
});
describe("Scenario B without cache", () => {
  it("reaches Ready to issue PO at ₹21.3L with the basic extractor", () => {
    const strip = (steps: StoryStep[]) => steps.map((st) => ({ ...st, events: st.events.map((b) => (s: State) => { const e = b(s); return e && e.kind === "email" ? { ...e, extraction: basicExtract(e.email, s.suppliers), extractionSource: "basic" as const } : e; }) }));
    let s = run(strip(SCENARIO_A), 9); s = run(strip(SCENARIO_B), 1, s);
    const id = REQ(s, "t-kosha");
    expect(Object.values(s.conflicts).find((c) => c.requestId === id && c.type === "renewal_terms_changed")?.b.quotes.length).toBe(3);
    s = run(strip(SCENARIO_B).slice(1), 4, s);
    const a = analyze(s, id); expect(a.spend.total).toBe(2130000); expect(a.handoff.state).toBe("ready_po");
  });
});

describe("revision: waits and withdrawals", () => {
  it("Scenario B longest wait is the supplier's corrected order form", () => {
    let s = run(SCENARIO_A, 9); s = run(SCENARIO_B, 5, s);
    expect(timingFor(s, REQ(s, "t-kosha")).longest).toBe("Kosha, corrected order form (Mon 23 Nov, 10:20 to Tue 1 Dec, 14:30)");
  });
  it("a reopened handoff is recorded as withdrawn and Farah is told", () => {
    let s = run(SCENARIO_A, 9);
    const att = sampleAttachment("Trivenika_Quote_23L.pdf", "w-att1");
    const email = { id: "w1", threadId: "t-sfm", from: "arjun.d@trivenika.example", to: ["rahul.mehta@prayaan.example"], cc: [], subject: "RE: quote", body: "Revised quote attached.", sentAt: "2026-11-18T10:00:00+05:30", attachments: [att], origin: "composed" as const };
    s = applyEvent(s, { id: "evw", at: email.sentAt, kind: "email", email, extraction: basicExtract(email, []), extractionSource: "basic" });
    const req = s.requests[REQ(s, "t-sfm")];
    expect(req.withdrawals?.[0].reason).toBe("price changed in a new quote (₹21.11L → ₹23L). Approvals reopened.");
    expect(deriveItems(s).some((i) => i.personId === "farah" && /withdrawn from Legal review/.test(i.question))).toBe(true);
  });
});

import { currentPlan, predictionHit, validatePlan, actionsOf } from "@/lib/engine/ai";
describe("revision 3: contracts, plans and counts", () => {
  it("step 8 ends with approvals at ₹21,10,800 and ₹39,10,800", () => {
    const s = run(SCENARIO_A, 8); const a = analyze(s, REQ(s, "t-sfm"));
    expect(a.approvals.find((x) => x.key === "budget_owner")!.last!.snapshot.amount).toBe(2110800);
    expect(a.approvals.find((x) => x.key === "vp")!.last!.snapshot.total90).toBe(3910800);
    expect(Object.values(s.conflicts).find((c) => c.id.includes(":contract:rates:"))!.status).toBe("resolved");
    expect(s.requests[REQ(s, "t-sfm")].contractIssues!.some((i) => /90,000/.test(i.note))).toBe(true);
  });
  it("a decrease never reopens an approval", () => {
    const st = approvalStatus([{ id: "r", at: "t", by: "ananya", kind: "approved", snapshot: { amount: 2150000, total90: 3950000 } }], { amount: 2110800, total90: 3910800 });
    expect(st.status).toBe("approved");
  });
  it("step 9: ready, prediction hit, N > 20 Ava actions and about 10 decisions", () => {
    const s = run(SCENARIO_A, 9); const id = REQ(s, "t-sfm");
    expect(analyze(s, id).handoff.state).toBe("ready_legal");
    expect(predictionHit(s, id)).toBe("Predicted on Thu 11:40: Tue 17 Nov. Actual: Tue 17 Nov 11:05.");
    const { ava, people } = actionsOf(s.requests[id]);
    expect(ava.length).toBeGreaterThan(20); expect(people.length).toBeGreaterThanOrEqual(8); expect(people.length).toBeLessThanOrEqual(14);
  });
  it("step 7 plan shows what changed", () => {
    const s = run(SCENARIO_A, 7); const p = currentPlan(s, REQ(s, "t-sfm"));
    expect(p.v.changes!.join(" | ")).toMatch(/Budget approval reopened/);
    expect(p.v.changes!.join(" | ")).toMatch(/Handoff blocked/);
  });
  it("code inserts a policy step the AI left out, and removes cycles", () => {
    const s = run(SCENARIO_A, 3); const a = analyze(s, REQ(s, "t-sfm"));
    const { plan, fixes } = validatePlan({ steps: [{ id: "x", title: "X", ownerId: "nobody", source: "ava", dependsOn: ["y"], status: "todo" }, { id: "y", title: "Y", ownerId: "karan", source: "ava", dependsOn: ["x"], status: "todo" }], criticalPath: [], predictedReady: "", predictionReason: "", changesSinceLast: [] }, a, s);
    expect(plan.steps.some((x) => x.id === "approve-vp" && x.source === "policy")).toBe(true);
    expect(fixes.some((f) => /Added by policy check/.test(f))).toBe(true);
    expect(fixes.some((f) => /circular/.test(f))).toBe(true);
    expect(plan.steps.find((x) => x.id === "x")!.ownerId).toBe("karan");
  });
  it("Scenario B: 5% within the 7% cap and ₹1,26,000 saved", () => {
    let s = run(SCENARIO_A, 9); s = run(SCENARIO_B, 4, s); const a = analyze(s, REQ(s, "t-kosha"));
    expect(a.checks.find((c) => c.clause === "4.2" && c.status === "consistent")!.text).toMatch(/5% increase: within the 7% cap/);
  });
});
