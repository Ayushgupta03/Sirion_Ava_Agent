import { describe, expect, it } from "vitest";
import { applyEvent, initialState } from "../lib/engine/pipeline";
import { analyze } from "../lib/engine/rules";
import { deriveItems } from "../lib/engine/items";
import { buildIntake, EXAMPLES, parseIntake, previewIntake } from "../lib/intake";
import { SEED_EVENTS } from "../lib/story";
import type { AvaEvent, State } from "../lib/types";

const seeded = () => SEED_EVENTS.reduce(applyEvent, initialState());
const submit = (state: State, text: string, who: string, tweak?: (f: ReturnType<typeof parseIntake>) => void) => {
  const f = parseIntake(text, state.suppliers); tweak?.(f);
  const { email, extraction } = buildIntake(f, who, state);
  const ev: AvaEvent = { id: "t-" + email.id, at: email.sentAt, kind: "email", email, extraction, extractionSource: "basic" };
  return { state: applyEvent(state, ev), email, f };
};

describe("Ask Ava: the front door", () => {
  it("reads a plain sentence into supplier, budget, duration and data access", () => {
    const s = initialState();
    const f = parseIntake(EXAMPLES[0].text, s.suppliers);
    expect(f.supplierId).toBe("trivenika");
    expect(f.budget).toMatch(/₹6L/);
    expect(f.dataAccess).toBe("no");
    expect(f.duration).toMatch(/6 weeks/);
    const g = parseIntake(EXAMPLES[1].text, s.suppliers);
    expect(g.dataAccess).toBe("yes");
    expect(g.start.toLowerCase()).toBe("monday");
    const h = parseIntake(EXAMPLES[2].text, s.suppliers);
    expect(h.supplierId).toBeUndefined();
    expect(h.supplierName).toMatch(/Urban Shine Facility Services/);
  });

  it("opens a request before any supplier email, routed by the same rules", () => {
    const { state } = submit(seeded(), EXAMPLES[0].text, "neha");
    const req = Object.values(state.requests).find((r) => r.requesterId === "neha")!;
    expect(req.supplierId).toBe("trivenika");
    expect(req.costCentre).toBe("CC-MKTOPS");
    const a = analyze(state, req.id);
    expect(a.facts.amount?.num).toBe(600000);
    expect(a.facts.amount?.state).toBe("unconfirmed"); // a rough number is not approvable
    expect(a.routing.approvals.map((x) => x.key)).toEqual(["budget_owner"]);
    expect(a.routing.endState).toBe("po");
    expect(a.approvals.every((x) => !x.gateOpen)).toBe(true); // nobody is asked to sign a rough number
  });

  it("sends the routine proposal request automatically and tells the supplier not to start", () => {
    const { state } = submit(seeded(), EXAMPLES[0].text, "neha");
    const req = Object.values(state.requests).find((r) => r.requesterId === "neha")!;
    const sent = state.emails.find((e) => e.autoSent);
    expect(sent).toBeTruthy();
    expect(sent!.to).toEqual(["arjun.d@trivenika.example"]);
    expect(sent!.body).toMatch(/do not start work/i);
    expect(state.drafts.find((d) => d.requestId === req.id)?.status).toBe("sent");
    expect(req.timeline.some((t) => t.actor === "ava" && /Auto-send is on/.test(t.text))).toBe(true);
  });

  it("leaves the message as a draft for the requester when auto-send is off", () => {
    let s = seeded();
    s = applyEvent(s, { id: "a1", at: s.now, kind: "action", actor: "karan", action: { type: "set_autonomy", setting: "autoSendQuoteRequests", value: false } });
    const { state } = submit(s, EXAMPLES[0].text, "neha");
    expect(state.emails.some((e) => e.autoSent)).toBe(false);
    const item = deriveItems(state).find((i) => i.personId === "neha" && i.kind === "draft");
    expect(item).toBeTruthy();
  });

  it("a supplier reply on that thread lands on the same request and confirms the amount", () => {
    const { state, email } = submit(seeded(), EXAMPLES[0].text, "neha");
    const req = Object.values(state.requests).find((r) => r.requesterId === "neha")!;
    expect(state.threadRequest[email.threadId]).toBe(req.id);
  });

  it("adds a second note to the open request instead of opening a duplicate", () => {
    const one = submit(seeded(), EXAMPLES[0].text, "neha");
    const n = one.state.requestOrder.length;
    const two = submit(one.state, EXAMPLES[0].text, "neha");
    expect(two.state.requestOrder.length).toBe(n);
    const req = Object.values(two.state.requests).find((r) => r.requesterId === "neha")!;
    expect(req.timeline.some((t) => /instead of opening a duplicate/.test(t.text))).toBe(true);
  });

  it("previews the VP limit and InfoSec before anyone commits, and saves nothing", () => {
    const s = seeded();
    const f = parseIntake(EXAMPLES[1].text, s.suppliers);
    const before = JSON.stringify(s.requestOrder);
    const p = previewIntake(s, f, "rahul")!;
    expect(p.overLimit).toBe(true);
    expect(p.approvals.map((a) => a.who)).toEqual(expect.arrayContaining(["Ananya Iyer", "Vikram Rao", "Meera Nair", "Karan Shah"]));
    expect(p.endState).toBe("Ready for Legal Review");
    expect(JSON.stringify(s.requestOrder)).toBe(before);
  });

  it("a new supplier goes to Procurement and no message is drafted without a contact", () => {
    const { state } = submit(seeded(), EXAMPLES[2].text, "aditi");
    const req = Object.values(state.requests).find((r) => r.requesterId === "aditi")!;
    expect(req.supplierId).toBeNull();
    expect(deriveItems(state).some((i) => i.personId === "karan" && i.kind === "supplier" && i.requestId === req.id)).toBe(true);
    expect(state.drafts.filter((d) => d.requestId === req.id)).toHaveLength(0);
  });

  it("auto-send for document chasers is off by default and the chaser stays a draft", () => {
    expect(initialState().autonomy.autoSendDocChasers).toBe(false);
    expect(initialState().autonomy.autoSendQuoteRequests).toBe(true);
  });
});

describe("autonomy: document chasers", () => {
  it("when switched on, Ava sends the insurance and ISO request herself and logs it as an Ava action", async () => {
    const { SCENARIO_A } = await import("../lib/story");
    let s = seeded();
    s = applyEvent(s, { id: "a1", at: s.now, kind: "action", actor: "karan", action: { type: "set_autonomy", setting: "autoSendDocChasers", value: true } });
    for (const st of SCENARIO_A.slice(0, 4)) for (const b of st.events) { const ev = b(s); if (ev) s = applyEvent(s, ev); }
    const auto = s.emails.filter((e) => e.autoSent);
    expect(auto.length).toBeGreaterThan(0);
    expect(auto[0].body.toLowerCase()).toMatch(/insurance|iso/);
    expect(s.requests["REQ-1047"].timeline.some((t) => t.actor === "ava" && /Auto-send is on/.test(t.text))).toBe(true);
    // Rahul no longer has a document draft waiting
    expect(deriveItems(s).some((i) => i.personId === "rahul" && i.kind === "draft" && /certificate/i.test(i.question))).toBe(false);
  });
});
