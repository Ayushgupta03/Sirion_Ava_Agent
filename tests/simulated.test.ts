import { describe, expect, it } from "vitest";
import { applyEvent, initialState } from "../lib/engine/pipeline";
import { currentRec } from "../lib/engine/ai";
import { simulatedRec, simulatedReceipt } from "../lib/engine/simulated";
import { evalRec } from "../lib/evals";
import { analyze } from "../lib/engine/rules";
import { SCENARIO_A, SCENARIO_B, SEED_EVENTS } from "../lib/story";
import type { Conflict, State } from "../lib/types";

/** Every state the two scripted scenarios pass through, with every conflict that exists at that point. */
function allConflicts(): { s: State; c: Conflict }[] {
  const out: { s: State; c: Conflict }[] = [];
  let s = SEED_EVENTS.reduce(applyEvent, initialState());
  for (const step of [...SCENARIO_A, ...SCENARIO_B]) {
    for (const b of step.events) { const e = b(s); if (e) s = applyEvent(s, e); }
    for (const c of Object.values(s.conflicts)) out.push({ s, c });
  }
  return out;
}
const all = allConflicts();

describe("simulated advice", () => {
  it("covers every kind of conflict the scenarios produce", () => {
    const types = new Set(all.map((x) => x.c.type));
    expect(types.size).toBeGreaterThanOrEqual(5);
    for (const { s, c } of all) expect(simulatedRec(s, c), `${c.type} ${c.id}`).toBeDefined();
  });
  it("passes the same output checks the model's answers must pass", () => {
    for (const { s, c } of all) {
      const rec = simulatedRec(s, c)!;
      const fails = evalRec(rec, s, c.requestId).filter((i) => i.severity === "fail");
      expect(fails, `${c.type} ${c.id}: ${JSON.stringify(fails)}`).toEqual([]);
    }
  });
  it("cites a source for every recommendation and keeps reasoning to two sentences", () => {
    for (const { s, c } of all) {
      const rec = simulatedRec(s, c)!;
      expect(rec.citations.length).toBeGreaterThan(0);
      expect(rec.reasoning.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
      expect(rec.confidence).toBe("medium");
    }
  });
  it("only drafts to the supplier where that is the real next step; customer data and early starts are advice only", () => {
    for (const { s, c } of all) {
      const rec = simulatedRec(s, c)!;
      if (c.type === "hidden_scope" || c.type === "started_before_approval") expect(rec.action).toBeUndefined();
      else { expect(rec.action).toBe("draft_supplier"); expect(rec.draft).toMatch(/^Hi \w+,/); }
    }
  });
  it("currentRec falls back to the simulation when nothing is stored, and prefers a stored recommendation", () => {
    const { s, c } = all.find((x) => x.c.type === "against_contract")!;
    const stored = s.ai.recs[c.id];
    expect(currentRec(s, c.id).output.recommendation).toBe(stored ? stored.output.recommendation : simulatedRec(s, c)!.recommendation);
    const bare: State = { ...s, ai: { ...s.ai, recs: {} } };
    expect(currentRec(bare, c.id).source).toBe("rules");
    expect(currentRec(bare, c.id).output.recommendation).toBe(simulatedRec(bare, c)!.recommendation);
  });
  it("using simulated advice keeps it and creates the draft; the stub is not what gets stored", () => {
    const { s, c } = all.find((x) => x.c.type === "against_contract" && x.c.status === "open")!;
    const bare: State = { ...s, ai: { ...s.ai, recs: {} }, drafts: [] };
    const after = applyEvent(bare, { id: "sim-use", at: bare.now, kind: "action", actor: "karan", action: { type: "rec_use", recKey: c.id, requestId: c.requestId } });
    expect(after.ai.recs[c.id].output.action).toBe("draft_supplier");
    expect(after.ai.recs[c.id].used?.by).toBe("karan");
    expect(after.drafts.some((d) => d.conflictId === c.id && /^Hi \w+,/.test(d.body))).toBe(true);
  });
  it("dismissing simulated advice records the reason against the real recommendation", () => {
    const { s, c } = all.find((x) => x.c.type === "said_vs_written")!;
    const bare: State = { ...s, ai: { ...s.ai, recs: {} } };
    const after = applyEvent(bare, { id: "sim-no", at: bare.now, kind: "action", actor: "karan", action: { type: "rec_dismiss", recKey: c.id, requestId: c.requestId, reason: "Already agreed by phone" } });
    expect(after.ai.recs[c.id].dismissed?.reason).toBe("Already agreed by phone");
    expect(after.ai.recs[c.id].output.action).toBe("draft_supplier");
  });
});

describe("simulated receipt summary", () => {
  it("is three plain lines with figures from the rules engine", () => {
    const { s } = all[all.length - 1];
    const id = s.requestOrder[0]; const a = analyze(s, id);
    const keys = a.approvals.map((x) => x.key);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      const r = simulatedReceipt(s, id, k)!;
      expect(r.bullets).toHaveLength(3);
      expect(evalRec(r, s, id).filter((i) => i.severity === "fail")).toEqual([]);
    }
  });
});
