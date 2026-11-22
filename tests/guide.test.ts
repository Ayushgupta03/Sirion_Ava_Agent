import { describe, expect, it } from "vitest";
import { applyEvent, initialState } from "../lib/engine/pipeline";
import { SCENARIO_A, SCENARIO_B, SEED_EVENTS } from "../lib/story";
import { debriefFor, fmtSpan, GLOSSARY, pageHelpFor, plain, STEP_GUIDE, SCENARIO_BLURB, taskStatus, TASKS } from "../lib/guide";
import type { State } from "../lib/types";

function run(upTo: "A" | "B"): { state: State; events: any[] } {
  let s = SEED_EVENTS.reduce(applyEvent, initialState()); const events: any[] = [...SEED_EVENTS];
  const steps = upTo === "A" ? SCENARIO_A : [...SCENARIO_A, ...SCENARIO_B];
  for (const st of steps) for (const b of st.events) { const ev = b(s); if (ev) { s = applyEvent(s, ev); events.push(ev); } }
  return { state: s, events };
}

const BANNED = /seamless|powerful|leverage|unlock|cutting-edge|empower|game-changer|revolutionary|intelligent|smart/i;
const allCopy = () => [
  ...Object.values(STEP_GUIDE).flatMap((g) => [g.title, g.where, g.why, ...g.notice]),
  ...Object.values(SCENARIO_BLURB).flatMap((b) => [b.name, b.line, ...b.moments]),
  ...GLOSSARY.flatMap((t) => [t.term, t.def]),
];

describe("guided demo copy", () => {
  it("every scripted step has coaching, and every coaching entry belongs to a step", () => {
    const ids = [...SCENARIO_A, ...SCENARIO_B].map((s) => s.id);
    expect(ids.filter((i) => !STEP_GUIDE[i])).toEqual([]);
    expect(Object.keys(STEP_GUIDE).filter((k) => !ids.includes(k))).toEqual([]);
  });
  it("every step points at an element key (the coach card needs data-pulse to find it)", () => {
    for (const s of [...SCENARIO_A, ...SCENARIO_B]) expect(s.pulse, s.id).toBeTruthy();
  });
  it("follows the copy rules: no banned words, short paragraphs, every term marker resolves", () => {
    for (const t of allCopy()) { expect(plain(t)).not.toMatch(BANNED); expect(plain(t).split(/[.!?]\s/).length, t).toBeLessThanOrEqual(3); }
    const ids = new Set(GLOSSARY.map((g) => g.id));
    for (const t of allCopy()) for (const m of t.matchAll(/\{\{([a-z-]+)\|/g)) expect(ids.has(m[1]), `${m[1]} in "${t}"`).toBe(true);
  });
  it("plain() strips term markers", () => { expect(plain("a {{conflict|conflict}} b")).toBe("a conflict b"); });
  it("page help covers the main screens and nothing else needs it", () => {
    for (const p of ["/", "/mail", "/today", "/requests", "/requests/REQ-1047", "/dashboard", "/new", "/settings", "/story/why"]) expect(pageHelpFor(p), p).toBeTruthy();
    expect(pageHelpFor("/supplier/REQ-1047")).toBeUndefined();
  });
});

describe("debrief: numbers come from the engine", () => {
  it("Scenario A: ready for Legal, own time far below the calendar time, three or more problems caught", () => {
    const { state } = run("A"); const d = debriefFor(state, "A")!;
    expect(d.reqId).toBe("REQ-1047"); expect(d.ready).toBe(true); expect(d.outcome).toBe("Ready for Legal Review");
    expect(d.own).toMatch(/min$/); expect(d.supplier).toMatch(/days$/); expect(d.avaActions).toBeGreaterThan(d.decisions);
    expect(d.problems.length).toBeGreaterThanOrEqual(3);
  });
  it("Scenario B: ready to issue a PO", () => {
    const { state } = run("B"); const d = debriefFor(state, "B")!;
    expect(d.ready).toBe(true); expect(d.outcome).toBe("Ready to issue PO"); expect(d.problems.length).toBeGreaterThan(0);
  });
  it("before the scenario has started there is nothing to show", () => {
    expect(debriefFor(SEED_EVENTS.reduce(applyEvent, initialState()), "A")).toBeNull();
  });
  it("formats spans in the unit a person would say", () => {
    expect(fmtSpan(0.66)).toBe("40 min"); expect(fmtSpan(1.9)).toBe("1.9 hours"); expect(fmtSpan(30)).toBe("30 hours"); expect(fmtSpan(197)).toBe("8.2 days"); expect(fmtSpan(120)).toBe("5 days");
  });
});

describe("try it yourself: ticked from the event log", () => {
  const len = { A: SCENARIO_A.length, B: SCENARIO_B.length };
  it("watching the scripted story ticks only the two watch tasks", () => {
    const { state, events } = run("B"); const st = taskStatus(state, events, { A: len.A, B: len.B }, len, false);
    expect(st).toMatchObject({ watchA: true, watchB: true, viewAs: false, decide: false, ask: false, email: false });
  });
  it("story actions never count as the viewer deciding; the viewer's own approval does", () => {
    const { state, events } = run("A");
    const mine = { id: "ev-mine", at: state.now, kind: "action", actor: "karan", action: { type: "comment", requestId: "REQ-1047", text: "ok" } };
    expect(taskStatus(state, events, { A: 9, B: 0 }, len, false).decide).toBe(false);
    expect(taskStatus(state, [...events, mine], { A: 9, B: 0 }, len, false).decide).toBe(true);
  });
  it("a composed email ticks the email task, and switching person ticks viewAs", () => {
    const { state, events } = run("A");
    const composed = { id: "ev-c", at: state.now, kind: "email", email: { origin: "composed" } };
    expect(taskStatus(state, [...events, composed], { A: 9, B: 0 }, len, true)).toMatchObject({ email: true, viewAs: true });
  });
  it("every task has a status key", () => {
    const { state, events } = run("A"); const st = taskStatus(state, events, { A: 0, B: 0 }, len, false);
    for (const t of TASKS) expect(typeof st[t.id], t.id).toBe("boolean");
  });
});
