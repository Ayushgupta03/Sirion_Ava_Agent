import { describe, expect, it } from "vitest";
import { runEvals } from "../scripts/eval-ai";
import { evalRead, evalRec, moneyIn } from "@/lib/evals";
import { applyEvent, initialState } from "@/lib/engine/pipeline";
import { SCENARIO_A, SEED_EVENTS } from "@/lib/story";

describe("AI output evals", () => {
  it("every cached output in both scenarios passes", () => {
    const rows = runEvals();
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.filter((r) => r.issues.some((i) => i.severity === "fail")).map((r) => `${r.step} ${r.key}: ${r.issues.map((i) => i.detail).join("; ")}`)).toEqual([]);
  });
  it("parses rupee figures in every format", () => {
    expect(moneyIn("₹21,10,800 and ₹38L and ₹21.5L and ₹2 crore")).toEqual([2110800, 3800000, 2150000, 20000000]);
  });
  it("catches invented numbers, missing citations, banned words and too many sentences", () => {
    let s = SEED_EVENTS.reduce(applyEvent, initialState());
    for (const st of SCENARIO_A.slice(0, 3)) for (const b of st.events) { const e = b(s); if (e) s = applyEvent(s, e); }
    const id = s.threadRequest["t-sfm"];
    const bad = evalRead({ risks: [], sentences: [
      { text: "The quote is ₹31,00,000.", citations: [] },
      { text: "A seamless deal.", citations: [{ type: "clause", id: "TV-MSA-2024 99" }] },
      { text: "One.", citations: [{ type: "email", id: "e-a1" }] }, { text: "Two.", citations: [{ type: "email", id: "e-a1" }] }, { text: "Three.", citations: [{ type: "email", id: "e-a1" }] },
    ] }, s, id).map((i) => i.check);
    expect(bad).toEqual(expect.arrayContaining(["max-4-sentences", "cite-every-claim", "citation-resolves", "banned-word", "number-not-from-code"]));
    const rec = evalRec({ recommendation: "Ava approved it.", reasoning: "One. Two. Three.", citations: [], confidence: "high" }, s, id).map((i) => i.check);
    expect(rec).toEqual(expect.arrayContaining(["reasoning-max-2", "cite-every-claim", "never-decides"]));
  });
});
