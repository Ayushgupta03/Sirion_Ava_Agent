import { describe, expect, it } from "vitest";
import { applyEvent, initialState } from "../lib/engine/pipeline";
import { analyze } from "../lib/engine/rules";
import { deriveItems } from "../lib/engine/items";
import { SCENARIO_A, SEED_EVENTS } from "../lib/story";
import { COLS, colOf, HINT, LABEL, whyHere, whyNotMove } from "../lib/board";
import type { State } from "../lib/types";

const stateAtStep = (n: number): State => {
  let s = SEED_EVENTS.reduce(applyEvent, initialState());
  for (const step of SCENARIO_A.slice(0, n)) for (const b of step.events) { const e = b(s); if (e) s = applyEvent(s, e); }
  return s;
};
const lastReq = (s: State) => s.requestOrder[s.requestOrder.length - 1];

describe("board columns", () => {
  it("maps every engine pipeline state to a column, and every column has a label and a hint", () => {
    expect(colOf("New")).toBe("New");
    expect(colOf("Approvals")).toBe("Approvals");
    expect(colOf("Blocked by change")).toBe("Blocked");
    expect(colOf("Ready")).toBe("Ready");
    for (const p of ["Waiting on requester", "Due diligence", "anything else"]) expect(colOf(p)).toBe("Waiting on someone");
    for (const c of COLS) { expect(LABEL[c].length).toBeGreaterThan(0); expect(HINT[c].length).toBeGreaterThan(10); }
  });
});

describe("why a request is where it is", () => {
  it("a blocked request names what blocks it", () => {
    const s = stateAtStep(3); const a = analyze(s, lastReq(s));
    expect(colOf(a.pipeline)).toBe("Blocked");
    expect(whyHere(a)).toMatch(/^Handoff is blocked: /);
  });
  it("a finished request says the approvals match the facts", () => {
    const s = stateAtStep(9); const a = analyze(s, lastReq(s));
    expect(colOf(a.pipeline)).toBe("Ready");
    expect(whyHere(a)).toMatch(/Every approval matches the facts/);
  });
});

describe("dragging a card to a column the rules did not choose", () => {
  const s = stateAtStep(3); const id = lastReq(s); const a = analyze(s, id);
  it("always says the request stays put, and why stages are not moved by hand", () => {
    for (const to of COLS.filter((c) => c !== colOf(a.pipeline))) {
      const msg = whyNotMove(a, to);
      expect(msg).toContain(`${id} stays in Blocked`);
      expect(msg).toMatch(/not moved by hand/);
    }
  });
  it("to Ready: says what is missing", () => { expect(whyNotMove(a, "Ready")).toMatch(/To get to Ready: .+/); });
  it("to Approvals: counts the open facts and checks", () => { expect(whyNotMove(a, "Approvals")).toMatch(/Still open: \d+ facts? and \d+ checks?\./); });
  it("to Blocked and New: explains what those columns mean", () => {
    expect(whyNotMove(a, "New")).toMatch(/Nothing goes back to New/);
    const done = analyze(stateAtStep(9), lastReq(stateAtStep(9)));
    expect(whyNotMove(done, "Blocked")).toMatch(/open conflict or a fact that changed after approval/);
  });
});

describe("handing over what is waiting on you", () => {
  it("reassigning a request's items moves them to the other person's Today", () => {
    let s = stateAtStep(3); const id = lastReq(s);
    const mine = deriveItems(s).filter((i) => i.requestId === id && i.personId === "karan");
    expect(mine.length).toBeGreaterThan(0);
    const bellBefore = deriveItems(s).filter((i) => i.personId === "karan").length;
    mine.forEach((i, k) => { s = applyEvent(s, { id: `ra${k}`, at: s.now, kind: "action", actor: "karan", action: { type: "reassign", itemKey: i.key, to: "neha" } }); });
    expect(deriveItems(s).filter((i) => i.requestId === id && i.personId === "karan")).toHaveLength(0);
    expect(deriveItems(s).filter((i) => i.requestId === id && i.personId === "neha").length).toBe(mine.length);
    expect(deriveItems(s).filter((i) => i.personId === "karan").length).toBe(bellBefore - mine.length);
  });
});
