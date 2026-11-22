import { describe, expect, it } from "vitest";
import { applyEvent, initialState } from "../lib/engine/pipeline";
import { analyze } from "../lib/engine/rules";
import { currentPlan, currentRead, planContext } from "../lib/engine/ai";
import { SCENARIO_A, SEED_EVENTS } from "../lib/story";
import { promptVersionOf } from "../lib/promptVersion";
import { groupByVersion, type EvalRow } from "../lib/evals";
import { adviceOutcomes, predictionAccuracy } from "../lib/insights";
import { splitQuoted, stripQuoted } from "../lib/quoted";
import { basicExtract } from "../lib/basicExtractor";
import type { Email, State } from "../lib/types";

const stateAtStep = (n: number): State => {
  let s = SEED_EVENTS.reduce(applyEvent, initialState());
  for (const step of SCENARIO_A.slice(0, n)) for (const b of step.events) { const e = b(s); if (e) s = applyEvent(s, e); }
  return s;
};
const lastReq = (s: State) => s.requestOrder[s.requestOrder.length - 1];

describe("N5 prompt versioning", () => {
  it("the version is a stable 8-character hash that changes with the text", () => {
    expect(promptVersionOf("a prompt")).toMatch(/^[0-9a-f]{8}$/);
    expect(promptVersionOf("a prompt")).toBe(promptVersionOf("a prompt"));
    expect(promptVersionOf("a prompt")).not.toBe(promptVersionOf("a prompt."));
  });
  it("a live output keeps the prompt version and model it came from", () => {
    let s = stateAtStep(3); const id = lastReq(s);
    const out = currentPlan(s, id).v.output;
    s = applyEvent(s, { id: "ev-live-plan", at: s.now, kind: "ai", requestId: id, layer: "plan", key: "plan", output: out, source: "live", promptVersion: "abcd1234", model: "test-model" });
    const last = s.ai.plans[id].at(-1)!;
    expect(last.promptVersion).toBe("abcd1234"); expect(last.model).toBe("test-model");
  });
  it("evals group by version; scripted outputs group as cached", () => {
    const issue = { severity: "fail" as const, check: "c", detail: "d" };
    const rows: EvalRow[] = [
      { step: "A1", requestId: "r", layer: "read", key: "k", source: "cached", issues: [] },
      { step: "A2", requestId: "r", layer: "plan", key: "k", source: "live", promptVersion: "v1", issues: [issue] },
      { step: "A3", requestId: "r", layer: "rec", key: "k", source: "live", promptVersion: "v1", issues: [] },
      { step: "A4", requestId: "r", layer: "rec", key: "k", source: "live", promptVersion: "v2", issues: [{ ...issue, severity: "warn" }] },
    ];
    const g = Object.fromEntries(groupByVersion(rows).map((x) => [x.version, x]));
    expect(g["cached (hand-written)"].outputs).toBe(1);
    expect(g.v1).toMatchObject({ outputs: 2, failing: 1, warnings: 0 });
    expect(g.v2).toMatchObject({ outputs: 1, failing: 0, warnings: 1 });
  });
});

describe("N6 advice outcomes", () => {
  it("counts used, edited, dismissed and open, and keeps dismiss reasons", () => {
    let s = stateAtStep(3);
    const keys = Object.keys(s.conflicts).filter((k) => s.ai.recs[k] && s.ai.recs[k].output.action !== "review");
    expect(keys.length).toBeGreaterThanOrEqual(3);
    const id = lastReq(s);
    const base = adviceOutcomes(s);
    expect(base.open).toBe(base.total); expect(base.adoption).toBeUndefined();
    const [k1, k2, k3] = keys;
    s = applyEvent(s, { id: "u1", at: s.now, kind: "action", actor: "karan", action: { type: "rec_use", recKey: k1, requestId: id } });
    s = applyEvent(s, { id: "u2", at: s.now, kind: "action", actor: "karan", action: { type: "rec_use", recKey: k2, requestId: id, draft: "My own wording." } });
    s = applyEvent(s, { id: "u3", at: s.now, kind: "action", actor: "karan", action: { type: "rec_dismiss", recKey: k3, requestId: id, reason: "Already asked by phone" } });
    const a = adviceOutcomes(s);
    expect(a.used).toBe(1); expect(a.edited).toBe(1); expect(a.dismissed).toBe(1);
    expect(a.open).toBe(base.total - 3); expect(a.total).toBe(base.total);
    expect(a.adoption).toBeCloseTo(2 / 3);
    expect(a.reasons).toEqual([expect.objectContaining({ key: k3, reason: "Already asked by phone", by: "karan" })]);
    const byConf = a.byConfidence.high.total + a.byConfidence.medium.total + a.byConfidence.low.total;
    expect(byConf).toBe(a.total);
  });
  it("an unchanged draft sent through Edit still counts as used, not edited", () => {
    let s = stateAtStep(3); const id = lastReq(s);
    const k = Object.keys(s.conflicts).find((c) => s.ai.recs[c]?.output.draft)!;
    s = applyEvent(s, { id: "u4", at: s.now, kind: "action", actor: "karan", action: { type: "rec_use", recKey: k, requestId: id, draft: s.ai.recs[k].output.draft } });
    expect(s.ai.recs[k].used?.edited).toBe(false);
  });
  it("receipt summaries and the no-recommendation fallback are not advice", () => {
    const s = stateAtStep(3);
    const before = adviceOutcomes(s).total;
    s.ai.recs["receipt:x:budget_owner"] = { at: s.now, source: "cached", fingerprint: "", output: { recommendation: "r", reasoning: "", citations: [], confidence: "high", bullets: ["b"] } };
    s.ai.recs["c-none"] = { at: s.now, source: "rules", fingerprint: "", output: { recommendation: "Review the conflict.", reasoning: "", citations: [], confidence: "low", action: "review" } };
    expect(adviceOutcomes(s).total).toBe(before);
  });
});

describe("N7 prediction accuracy", () => {
  it("is empty until a request reaches Ready", () => {
    expect(predictionAccuracy(stateAtStep(3)).total).toBe(0);
  });
  it("compares the first and final predicted dates with the real one, in business days", () => {
    const s = stateAtStep(9); const p = predictionAccuracy(s);
    expect(p.total).toBeGreaterThanOrEqual(1);
    for (const r of p.rows) {
      expect(r.firstOff).toBeGreaterThanOrEqual(0); expect(r.finalOff).toBeGreaterThanOrEqual(0);
      expect(r.actual).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(p.firstWithin).toBeLessThanOrEqual(p.total); expect(p.finalWithin).toBeGreaterThanOrEqual(p.firstWithin);
  });
});

describe("X8 re-plan on approvals and replies", () => {
  const approveFirstPending = (s: State, id: string, n: string) => {
    const ap = analyze(s, id).approvals.find((x) => x.status === "pending")!;
    expect(ap).toBeDefined();
    return applyEvent(s, { id: n, at: s.now, kind: "action", actor: ap.approverId, action: { type: "approve", requestId: id, key: ap.key } });
  };
  const addPlan = (s: State, id: string, n: string, source: "live" | "cached") =>
    applyEvent(s, { id: n, at: s.now, kind: "ai", requestId: id, layer: "plan", key: "plan", output: currentPlan(s, id).v.output, source });

  it("a live plan asks to refresh when an approval moves, and stops asking once it has", () => {
    let s = stateAtStep(3); const id = lastReq(s);
    s = addPlan(s, id, "ev-live1", "live");
    expect(currentPlan(s, id).refresh).toBe(false);
    const ctx = planContext(s, id);
    s = approveFirstPending(s, id, "ev-appr1");
    expect(planContext(s, id)).not.toBe(ctx);
    expect(currentPlan(s, id).stale).toBe(false);   // the facts did not change
    expect(currentPlan(s, id).refresh).toBe(true);  // but the approvals did
    s = addPlan(s, id, "ev-live2", "live");
    expect(currentPlan(s, id).refresh).toBe(false);
    s = approveFirstPending(s, id, "ev-appr2");
    expect(currentPlan(s, id).refresh).toBe(true);
  });
  it("a cached plan never asks to refresh: there is nothing to regenerate it with", () => {
    let s = stateAtStep(3); const id = lastReq(s);
    s = addPlan(s, id, "ev-cached", "cached");
    s = approveFirstPending(s, id, "ev-appr");
    expect(currentPlan(s, id).refresh).toBe(false);
  });
  it("a new supplier email moves the plan context too", () => {
    const a = stateAtStep(3); const b = stateAtStep(4);
    expect(lastReq(a)).toBe(lastReq(b));
    expect(a.requests[lastReq(a)].emailIds.length).toBeLessThanOrEqual(b.requests[lastReq(b)].emailIds.length);
    if (a.requests[lastReq(a)].emailIds.length !== b.requests[lastReq(b)].emailIds.length) expect(planContext(a, lastReq(a))).not.toBe(planContext(b, lastReq(b)));
  });
  it("an approval does not make Ava's read stale: reads depend on facts only", () => {
    const s0 = stateAtStep(3); const id = lastReq(s0);
    const s1 = approveFirstPending(s0, id, "ev-a");
    expect(currentRead(s0, id).stale).toBe(false);
    expect(currentRead(s1, id).stale).toBe(false);
  });
});

const mail = (body: string): Email => ({ id: "e", threadId: "t", from: "arjun.d@trivenika.example", to: ["rahul.mehta@prayaan.example"], cc: [], subject: "RE: Salesforce migration", body, sentAt: "2026-11-16T10:00:00+05:30", attachments: [], origin: "supplier" as Email["origin"] });

describe("X9 quoted history", () => {
  const gmail = "Thanks, we will start Monday.\n\nOn Mon, 16 Nov 2026 at 10:40, Rahul Mehta <rahul.mehta@prayaan.example> wrote:\n> Please send a quote of about ₹20,00,000 for 8 weeks.\n> Customer data is not needed.";
  it("keeps what was written this time and folds the thread", () => {
    const r = splitQuoted(gmail);
    expect(r.fresh).toBe("Thanks, we will start Monday.");
    expect(r.hasQuote).toBe(true); expect(r.quoted).toContain("₹20,00,000");
  });
  it("handles a wrapped attribution line, Outlook blocks, rules and plain > lines", () => {
    expect(stripQuoted("Agreed.\n\nOn Mon, 16 Nov 2026 at 10:40, Rahul Mehta\n<rahul.mehta@prayaan.example> wrote:\n> old")).toBe("Agreed.");
    expect(stripQuoted("Agreed.\n\n-----Original Message-----\nFrom: Rahul\nSent: Monday\nOld text ₹5L")).toBe("Agreed.");
    expect(stripQuoted("Agreed.\n\n________________________________\nFrom: Rahul Mehta\nSent: Monday\nTo: Arjun\nOld text ₹5L")).toBe("Agreed.");
    expect(stripQuoted("Agreed.\nFrom: Rahul Mehta\nSent: Monday 16 November\nOld ₹5L")).toBe("Agreed.");
    expect(stripQuoted("> Old ₹5L\nAgreed, thanks.")).toBe("Agreed, thanks.");
  });
  it("leaves an email with no quote alone, and never drops a message that is all quote", () => {
    expect(splitQuoted("Hi, price is ₹6L.").hasQuote).toBe(false);
    expect(stripQuoted("> Forwarded: price is ₹6L")).toBe("> Forwarded: price is ₹6L");
  });
  it("a price that appears only in the quoted history never becomes a fact", () => {
    const withQuote = basicExtract(mail(gmail), [{ name: "Trivenika Systems Pvt Ltd", domain: "trivenika.example", known: true }]);
    expect(withQuote.facts.some((f) => f.field === "amount_pre_gst")).toBe(false);
    expect(withQuote.facts.some((f) => f.field === "duration")).toBe(false);
    const fresh = basicExtract(mail("We confirm ₹21,50,000 for 8 weeks.\n\nOn Mon, Rahul Mehta wrote:\n> about ₹20,00,000"), [{ name: "Trivenika Systems Pvt Ltd", domain: "trivenika.example", known: true }]);
    expect(fresh.facts.filter((f) => f.field === "amount_pre_gst").map((f) => f.value).join(" ")).toContain("21,50,000");
    expect(fresh.facts.filter((f) => f.field === "amount_pre_gst").map((f) => f.value).join(" ")).not.toContain("20,00,000");
  });
});
