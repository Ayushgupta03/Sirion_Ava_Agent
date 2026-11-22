// The story player: a list of timed events fed to the same pipeline, with captions on top.
import type { Action, AvaEvent, State, ViewerTarget } from "./types";
import { analyze } from "./engine/rules";
import { SCRIPTED } from "./scripted";
import { EXTRACTION_CACHE } from "./cache";
import { A_PLAN, A_READ, A_REC, B_PLAN, B_READ, B_REC } from "./aiScript";
import type { AiPlan, AiRead, AiRec } from "./aiTypes";

type Builder = (s: State) => AvaEvent | null;
export interface Step { id: string; at: string; label: string; caption: string; focus: string; events: Builder[]; pulse?: string; reveal?: (s: State) => ViewerTarget | null }

const t = (d: string, hm: string) => `${d}T${hm}:00+05:30`;
const email = (id: string): Builder => () => ({ id: `ev-${id}`, at: SCRIPTED[id].sentAt, kind: "email", email: SCRIPTED[id], extraction: EXTRACTION_CACHE[id] ?? null, extractionSource: EXTRACTION_CACHE[id] ? "cached" : "basic", tag: "story" });
const act = (id: string, at: string, actor: string, f: (s: State) => Action | null): Builder => (s) => { const a = f(s); return a ? { id: `ev-${id}`, at, kind: "action", actor, action: a, tag: "story" } : null; };
const tick = (id: string, at: string): Builder => () => ({ id: `ev-${id}`, at, kind: "action", actor: "system", action: { type: "tick" }, tag: "story" });

type Key = string | ((s: State, rid: string) => string | undefined);
const ai = (id: string, at: string, thread: string, layer: "read" | "plan" | "rec", key: Key, output: AiRead | AiPlan | AiRec): Builder => (s) => {
  const rid = s.threadRequest[thread]; if (!rid) return null;
  const k = typeof key === "function" ? key(s, rid) : key; if (!k) return null;
  return { id: `ev-ai-${id}`, at, kind: "ai", requestId: rid, layer, key: k, output, source: "cached", tag: "story" };
};
const cf = (part: string) => (s: State, rid: string) => Object.values(s.conflicts).find((c) => c.requestId === rid && c.id.includes(part))?.id;
const read = (id: string, at: string, th: string, o: AiRead) => ai(`${id}-read`, at, th, "read", "read", o);
const plan = (id: string, at: string, th: string, o: AiPlan) => ai(`${id}-plan`, at, th, "plan", "plan", o);
const rec = (id: string, at: string, th: string, key: Key, o: AiRec) => ai(`${id}-rec`, at, th, "rec", key, o);

export const reqForThread = (s: State, thread: string) => s.threadRequest[thread];
const sfm = (s: State) => reqForThread(s, "t-sfm");
const kosha = (s: State) => reqForThread(s, "t-kosha");

function revealA6(s: State): ViewerTarget | null {
  const id = sfm(s); if (!id) return null;
  const line = analyze(s, id).newLines.find((l) => !/subtotal|gst|^total/i.test(l));
  return { emailId: "e-a3", attachmentId: "e-a3-att1", quote: line, compareWith: "e-a2-att1", title: "Proposal v1 beside v2: the new line" };
}
function revealB1(s: State): ViewerTarget | null {
  const c = Object.values(s.conflicts).find((c) => c.requestId === kosha(s) && c.type === "renewal_terms_changed");
  return c ? { emailId: "e-b1", attachmentId: "e-b1-att1", quotes: c.b.quotes.map((q) => q.quote), title: "What the order form says" } : null;
}

export const SEED_EVENTS: AvaEvent[] = [email("e-k1")({} as State)!].map((e) => ({ ...e, tag: "seed" }));

export const SCENARIO_A: Step[] = [
  { id: "A1", pulse: "ava-read", at: t("2026-11-12", "10:12"), label: "Thu 10:12", focus: "/mail?email=e-a1", caption: "Rahul sends a normal email. He fills in nothing. Ava reads it, starts the request and plans the work.",
    events: [email("e-a1"), read("a1", t("2026-11-12", "10:12"), "t-sfm", A_READ.A1), plan("a1", t("2026-11-12", "10:12"), "t-sfm", A_PLAN.A1)] },
  { id: "A2", pulse: "plan", at: t("2026-11-12", "10:13"), label: "Thu 10:13", focus: "/requests/{sfm}", caption: "Ava adds up 90 days of spend with this supplier. ₹38L is over the ₹25L limit, so the VP must approve. Policy steps carry a badge; Ava's own steps carry a reason.", events: [tick("a2", t("2026-11-12", "10:13"))] },
  { id: "A3", pulse: "problems", at: t("2026-11-12", "11:40"), label: "Thu 11:40", focus: "/requests/{sfm}", caption: "Ava reads the attachments, checks them against the contracts, and re-plans: the clean-up report is 35 days late and two rates break the MSA cap.",
    events: [email("e-a2"), read("a3", t("2026-11-12", "11:40"), "t-sfm", A_READ.A3), plan("a3", t("2026-11-12", "11:40"), "t-sfm", A_PLAN.A3),
      rec("a3d", t("2026-11-12", "11:40"), "t-sfm", cf(":contract:delivery:"), A_REC.delivery), rec("a3r", t("2026-11-12", "11:40"), "t-sfm", cf(":contract:rates:"), A_REC.rates), rec("a3a", t("2026-11-12", "11:40"), "t-sfm", cf(":hidden_scope:"), A_REC.data)] },
  { id: "A4", pulse: "items", at: t("2026-11-12", "12:05"), label: "Thu 12:05", focus: "/today", caption: "Rahul confirms data access. Karan sends Ava's rate draft. Each person sees only what is waiting on them.",
    events: [act("a4", t("2026-11-12", "12:05"), "rahul", (s) => sfm(s) ? { type: "answer_flag", requestId: sfm(s), flagId: `flag:${sfm(s)}:data_access`, answer: "yes" } : null),
      act("a4b", t("2026-11-12", "12:09"), "rahul", (s) => { const d = s.drafts.find((d) => d.requestId === sfm(s) && d.status === "draft" && d.id.includes("docs:")); return d ? { type: "mark_sent", draftId: d.id } : null; }),
      act("a4c", t("2026-11-12", "12:18"), "karan", (s) => { const k = cf(":contract:rates:")(s, sfm(s)); return k ? { type: "rec_use", recKey: k, requestId: sfm(s) } : null; }),
      act("a4d", t("2026-11-12", "12:20"), "karan", (s) => { const k = cf(":contract:rates:")(s, sfm(s)); const d = s.drafts.find((d) => d.conflictId === k && d.status === "draft"); return d ? { type: "mark_sent", draftId: d.id } : null; }),
      read("a4", t("2026-11-12", "12:20"), "t-sfm", A_READ.A4), plan("a4", t("2026-11-12", "12:20"), "t-sfm", A_PLAN.A4)] },
  { id: "A5", pulse: "approvals", at: t("2026-11-12", "16:30"), label: "Thu 16:30", focus: "/requests/{sfm}", caption: "Ananya approves ₹20L and Vikram approves ₹38L. Each receipt opens with Ava's summary of what they are approving.",
    events: [rec("a5s1", t("2026-11-12", "16:25"), "t-sfm", (_s, r) => `receipt:${r}:budget_owner`, A_REC.receipt_budget), rec("a5s2", t("2026-11-12", "16:25"), "t-sfm", (_s, r) => `receipt:${r}:vp`, A_REC.receipt_vp),
      act("a5", t("2026-11-12", "16:30"), "ananya", (s) => ({ type: "approve", requestId: sfm(s), key: "budget_owner" })), act("a5b", t("2026-11-12", "16:30"), "vikram", (s) => ({ type: "approve", requestId: sfm(s), key: "vp" }))] },
  { id: "A6", pulse: "change-banner", reveal: revealA6, at: t("2026-11-13", "09:48"), label: "Fri 09:48", focus: "/mail?email=e-a3", caption: "The email says nothing about price. The PDF says ₹1.5L more. Ava catches it and suggests asking Rahul first.",
    events: [email("e-a3"), read("a6", t("2026-11-13", "09:48"), "t-sfm", A_READ.A6), rec("a6u", t("2026-11-13", "09:48"), "t-sfm", cf(":said_vs_written:amount"), A_REC.uat), plan("a6", t("2026-11-13", "09:48"), "t-sfm", A_PLAN.A7)] },
  { id: "A7", pulse: "plan", at: t("2026-11-13", "10:30"), label: "Fri 10:30", focus: "/requests/{sfm}", caption: "Approvals reopen and handoff is blocked. Ava re-plans. Rahul answers the one-click question: keep UAT.",
    events: [tick("a7", t("2026-11-13", "09:49")),
      act("a7a", t("2026-11-13", "09:55"), "karan", (s) => { const k = cf(":said_vs_written:amount")(s, sfm(s)); return k ? { type: "rec_use", recKey: k, requestId: sfm(s) } : null; }),
      act("a7b", t("2026-11-13", "10:30"), "rahul", (s) => ({ type: "answer_flag", requestId: sfm(s), flagId: `flag:${sfm(s)}:keep_line`, answer: "yes", note: "Keep UAT, our team is short-staffed." }))] },
  { id: "A8", pulse: "approvals", at: t("2026-11-16", "12:15"), label: "Mon 16 Nov", focus: "/requests/{sfm}", caption: "Trivenika reissues the rates within the cap: ₹21,10,800. Approvals are reconfirmed and Karan requires a change request for the late report.",
    events: [email("e-a4"), email("e-a6"),
      act("a8a", t("2026-11-16", "11:00"), "ananya", (s) => ({ type: "approve", requestId: sfm(s), key: "budget_owner" })),
      act("a8b", t("2026-11-16", "11:30"), "karan", (s) => ({ type: "record_exception", requestId: sfm(s), kind: "sole_supplier", reason: "Sole supplier: Trivenika already runs our Salesforce support (SOW-0412)." })),
      act("a8c", t("2026-11-16", "11:30"), "karan", (s) => { const k = cf(":contract:delivery:")(s, sfm(s)); return k ? { type: "require_cr", conflictId: k, note: "Delay credit of up to ₹90,000 (MSA 9.1) for Legal to confirm." } : null; }),
      act("a8d", t("2026-11-16", "12:15"), "vikram", (s) => ({ type: "approve", requestId: sfm(s), key: "vp" })),
      read("a8", t("2026-11-16", "12:15"), "t-sfm", A_READ.A8), plan("a8", t("2026-11-16", "12:15"), "t-sfm", A_PLAN.A8)] },
  { id: "A9", pulse: "handoff", at: t("2026-11-17", "11:05"), label: "Tue 11:05", focus: "/requests/{sfm}", caption: "Intake is complete and correct. Ava predicted this date on Thursday. The banner counts what Ava did and what people decided.",
    events: [email("e-a5"), act("a9", t("2026-11-17", "11:05"), "meera", (s) => ({ type: "approve", requestId: sfm(s), key: "infosec" })), read("a9", t("2026-11-17", "11:05"), "t-sfm", A_READ.A9)] },
];

export const SCENARIO_B: Step[] = [
  { id: "B1", pulse: "change-banner", reveal: revealB1, at: t("2026-11-23", "10:00"), label: "Mon 23 Nov 10:00", focus: "/mail?email=e-b1", caption: "The email says nothing changes. The order form says 12% more, 3 years, and auto-renewal. The contract caps increases at 7%.",
    events: [email("e-b1"), read("b1", t("2026-11-23", "10:00"), "t-kosha", B_READ.B1), plan("b1", t("2026-11-23", "10:00"), "t-kosha", B_PLAN.B1), rec("b1r", t("2026-11-23", "10:00"), "t-kosha", cf(":renewal_terms_changed:"), B_REC.renewal)] },
  { id: "B2", pulse: "problems", at: t("2026-11-23", "10:20"), label: "Mon 10:20", focus: "/requests/{kosha}", caption: "Ava drafts the counter at 5% for 1 year. Suresh sends it.",
    events: [act("b2", t("2026-11-23", "10:19"), "suresh", (s) => { const k = cf(":renewal_terms_changed:")(s, kosha(s)); return k ? { type: "rec_use", recKey: k, requestId: kosha(s) } : null; }),
      act("b2b", t("2026-11-23", "10:20"), "suresh", (s) => { const d = s.drafts.find((d) => d.requestId === kosha(s) && d.status === "draft" && d.conflictId); return d ? { type: "mark_sent", draftId: d.id } : null; })] },
  { id: "B3", pulse: "problems", at: t("2026-11-30", "09:15"), label: "Mon 30 Nov 09:15", focus: "/requests/{kosha}", caption: "The invoice arrived before anyone approved the module. Ava links it to the renewal and suggests one PO.",
    events: [email("e-b3"), read("b3", t("2026-11-30", "09:15"), "t-kosha", B_READ.B3), plan("b3", t("2026-11-30", "09:15"), "t-kosha", B_PLAN.B3), rec("b3r", t("2026-11-30", "09:15"), "t-kosha", cf(":started_before_approval:"), B_REC.invoice)] },
  { id: "B4", pulse: "contract", at: t("2026-12-01", "14:30"), label: "Tue 1 Dec 14:30", focus: "/requests/{kosha}", caption: "The supplier corrects the form. Ava checks it against the contract: within the 7% cap. The conflict closes.",
    events: [email("e-b4"), read("b4", t("2026-12-01", "14:30"), "t-kosha", B_READ.B4), plan("b4", t("2026-12-01", "14:30"), "t-kosha", B_PLAN.B4)] },
  { id: "B5", pulse: "status", at: t("2026-12-01", "16:00"), label: "Tue 1 Dec 16:00", focus: "/requests/{kosha}", caption: "Renewal approved at 5%, not 12%, for 1 year, not 3: ₹1,26,000 saved a year. The early start is recorded, not hidden.",
    events: [act("b5", t("2026-12-01", "16:00"), "karan", (s) => ({ type: "record_exception", requestId: kosha(s), kind: "retro", reason: "Module used during free trial without a request; Finance confirms it is needed." })),
      act("b5b", t("2026-12-01", "16:02"), "deepa", (s) => ({ type: "approve", requestId: kosha(s), key: "budget_owner" })),
      read("b5", t("2026-12-01", "16:02"), "t-kosha", B_READ.B5), plan("b5", t("2026-12-01", "16:02"), "t-kosha", B_PLAN.B5)] },
];

export function resolveFocus(focus: string, s: State) {
  return focus.replace("{sfm}", sfm(s) ?? "").replace("{kosha}", kosha(s) ?? "");
}
