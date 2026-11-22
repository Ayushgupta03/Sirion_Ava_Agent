import { describe, expect, it } from "vitest";
import { applyEvent, initialState } from "../lib/engine/pipeline";
import { northStar } from "../lib/insights";
import { waitSplit } from "../lib/engine/timing";
import { SCENARIO_A, SCENARIO_B, SEED_EVENTS } from "../lib/story";
import type { State } from "../lib/types";

function run(upTo: "A" | "B"): State {
  let s = SEED_EVENTS.reduce(applyEvent, initialState());
  const steps = upTo === "A" ? SCENARIO_A : [...SCENARIO_A, ...SCENARIO_B];
  for (const st of steps) for (const b of st.events) { const ev = b(s); if (ev) s = applyEvent(s, ev); }
  return s;
}

describe("north star: Prayaan's own time, supplier waiting excluded", () => {
  it("Scenario A took days on the clock, but almost all of it was the supplier", () => {
    const s = run("A");
    const w = waitSplit(s, "REQ-1047");
    expect(w.total).toBeGreaterThan(100); // Thu 10:12 to Tue 11:05
    expect(w.supplier).toBeGreaterThan(w.total * 0.9);
    expect(w.own).toBeLessThan(24);
    expect(w.ownMet).toBe(true);
  });
  it("Scenario B: the corrected order form was the long wait", () => {
    const s = run("B");
    const id = s.requestOrder.find((i) => s.requests[i].title.startsWith("Renewal"))!;
    const w = waitSplit(s, id);
    expect(w.supplier).toBeGreaterThan(150);
    expect(w.ownMet).toBe(true);
  });
  it("counts a request as good only when it is ready, was never withdrawn, and Prayaan's time was under a day", () => {
    const s = run("B");
    const n = northStar(s);
    expect(n.good).toBe(n.ready);
    expect(n.reopened).toBeGreaterThan(0);
  });
});
