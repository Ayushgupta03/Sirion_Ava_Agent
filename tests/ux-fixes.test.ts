import { describe, expect, it } from "vitest";
import { applyEvent, initialState } from "../lib/engine/pipeline";
import { analyze } from "../lib/engine/rules";
import { deriveItems } from "../lib/engine/items";
import { SCENARIO_A, SEED_EVENTS } from "../lib/story";
import { sampleAttachment } from "../lib/samples";
import { joinWrappedLines } from "../lib/joinLines";
import { BACKGROUND, bgNeedCount } from "../lib/background";
import type { State } from "../lib/types";

const stateAtStep = (n: number): State => {
  let s = SEED_EVENTS.reduce(applyEvent, initialState());
  for (const step of SCENARIO_A.slice(0, n)) for (const b of step.events) { const e = b(s); if (e) s = applyEvent(s, e); }
  return s;
};

describe("wrapped PDF lines", () => {
  it("rejoins a labelled line that the PDF wrapped", () => {
    expect(joinWrappedLines(["Scope: Extend the work with the same team (1 BI", "developer, 1 analyst).", "Duration: 4 weeks"]))
      .toEqual(["Scope: Extend the work with the same team (1 BI developer, 1 analyst).", "Duration: 4 weeks"]);
  });
  it("leaves table rows, finished sentences and capitalised lines alone", () => {
    const lines = ["Fees (before GST)  ₹6,00,000", "Scope: One line.", "developer, 1 analyst).", "Duration: 4 weeks,", "Starting on signature", "Total  ₹7"];
    expect(joinWrappedLines(lines)).toEqual(lines);
  });
  it("is safe to run twice", () => {
    const once = joinWrappedLines(["Scope: a (1 BI", "developer)."]);
    expect(joinWrappedLines(once)).toEqual(once);
  });
  it("the Decision Receipt scope is the whole sentence, not a clipped one", () => {
    const sow = sampleAttachment("Trivenika_SOW_Extension.pdf", "x");
    expect(sow.pages[0].some((l) => l.endsWith("(1 BI developer, 1 analyst)."))).toBe(true);
    expect(sow.pages[0].some((l) => l.endsWith("(1 BI"))).toBe(false);
  });
});

describe("send back from a Decision Receipt", () => {
  it("tells the requester and Procurement, and leaves the approval open", () => {
    let s = stateAtStep(3);
    const id = s.requestOrder[s.requestOrder.length - 1];
    const ap = analyze(s, id).approvals[0];
    const before = analyze(s, id).approvals.map((x) => `${x.key}:${x.status}`);
    s = applyEvent(s, { id: "sb1", at: s.now, kind: "action", actor: ap.approverId, action: { type: "send_back", requestId: id, key: ap.key, note: "Scope says 4 weeks, Neha said 6." } });
    expect(analyze(s, id).approvals.map((x) => `${x.key}:${x.status}`)).toEqual(before); // nothing approved or rejected
    const req = s.requests[id];
    const heard = deriveItems(s).filter((i) => i.kind === "mention" && i.question.includes("sent the approval back")).map((i) => i.personId);
    expect(heard).toContain("karan");
    expect(heard).not.toContain(ap.approverId);
    expect(req.timeline.at(-1)?.text).toContain("sent the approval back");
    expect(req.comments.at(-1)?.text).toContain("Scope says 4 weeks");
  });
  it("ignores a send back for an approval the request does not need", () => {
    let s = stateAtStep(1);
    const id = s.requestOrder[s.requestOrder.length - 1];
    const absent = (["budget_owner", "vp", "infosec"] as const).find((k) => !analyze(s, id).approvals.some((x) => x.key === k));
    expect(absent).toBeDefined();
    const n = s.requests[id].comments.length;
    s = applyEvent(s, { id: "sb2", at: s.now, kind: "action", actor: "ritu", action: { type: "send_back", requestId: id, key: absent!, note: "x" } });
    expect(s.requests[id].comments.length).toBe(n);
  });
});

describe("one count of what waits on a person", () => {
  it("bgNeedCount adds up every background decision", () => {
    const people = [...new Set(BACKGROUND.flatMap((b) => b.needs.map((n) => n.personId)))];
    expect(people.reduce((n, p) => n + bgNeedCount(p), 0)).toBe(BACKGROUND.reduce((n, b) => n + b.needs.length, 0));
    expect(bgNeedCount("nobody")).toBe(0);
  });
});
