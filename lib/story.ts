// The story player: a list of timed events fed to the same pipeline, with captions on top.
import type { Action, AvaEvent, State, ViewerTarget } from "./types";
import { analyze } from "./engine/rules";
import { SCRIPTED } from "./scripted";
import { EXTRACTION_CACHE } from "./cache";

type Builder = (s: State) => AvaEvent | null;
export interface Step { id: string; at: string; label: string; caption: string; focus: string; events: Builder[]; pulse?: string; reveal?: (s: State) => ViewerTarget | null }

const t = (d: string, hm: string) => `${d}T${hm}:00+05:30`;
const email = (id: string): Builder => () => ({ id: `ev-${id}`, at: SCRIPTED[id].sentAt, kind: "email", email: SCRIPTED[id], extraction: EXTRACTION_CACHE[id] ?? null, extractionSource: EXTRACTION_CACHE[id] ? "cached" : "basic", tag: "story" });
const act = (id: string, at: string, actor: string, f: (s: State) => Action | null): Builder => (s) => { const a = f(s); return a ? { id: `ev-${id}`, at, kind: "action", actor, action: a, tag: "story" } : null; };
const tick = (id: string, at: string): Builder => () => ({ id: `ev-${id}`, at, kind: "action", actor: "system", action: { type: "tick" }, tag: "story" });

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
  { id: "A1", pulse: "ava-recorded", at: t("2026-11-12", "10:12"), label: "Thu 10:12", focus: "/inbox?email=e-a1", caption: "Rahul sends a normal email. He fills in nothing. Ava starts the request.", events: [email("e-a1")] },
  { id: "A2", pulse: "routing", at: t("2026-11-12", "10:13"), label: "Thu 10:13", focus: "/requests/{sfm}", caption: "Ava adds up 90 days of spend with this supplier. ₹38L is over the ₹25L limit, so the VP must approve.", events: [tick("a2", t("2026-11-12", "10:13"))] },
  { id: "A3", pulse: "change-banner", at: t("2026-11-12", "11:40"), label: "Thu 11:40", focus: "/inbox?email=e-a2", caption: "Ava reads the attachments, not just the email, and spots that the supplier will touch customer data.", events: [email("e-a2")] },
  { id: "A4", pulse: "items", at: t("2026-11-12", "12:05"), label: "Thu 12:05", focus: "/items", caption: "Each department sees only what is waiting on it, with one question each.",
    events: [act("a4", t("2026-11-12", "12:05"), "rahul", (s) => sfm(s) ? { type: "answer_flag", requestId: sfm(s), flagId: `flag:${sfm(s)}:data_access`, answer: "yes" } : null),
      act("a4b", t("2026-11-12", "12:09"), "rahul", (s) => { const d = s.drafts.find((d) => d.requestId === sfm(s) && d.status === "draft"); return d ? { type: "mark_sent", draftId: d.id } : null; })] },
  { id: "A5", pulse: "approvals", at: t("2026-11-12", "16:30"), label: "Thu 16:30", focus: "/requests/{sfm}", caption: "The budget owner and the VP approve, each on a receipt that records exactly what they approved.",
    events: [act("a5", t("2026-11-12", "16:30"), "ananya", (s) => ({ type: "approve", requestId: sfm(s), key: "budget_owner" })), act("a5b", t("2026-11-12", "16:30"), "vikram", (s) => ({ type: "approve", requestId: sfm(s), key: "vp" }))] },
  { id: "A6", pulse: "change-banner", reveal: revealA6, at: t("2026-11-13", "09:48"), label: "Fri 09:48", focus: "/inbox?email=e-a3", caption: "The email says nothing about price. The PDF says ₹1.5L more. Ava catches it.", events: [email("e-a3")] },
  { id: "A7", pulse: "status", at: t("2026-11-13", "09:49"), label: "Fri 09:49", focus: "/requests/{sfm}", caption: "An approval belongs to the facts it was given for. When the facts change, it reopens.", events: [tick("a7", t("2026-11-13", "09:49"))] },
  { id: "A8", pulse: "approvals", at: t("2026-11-16", "10:20"), label: "Mon 10:20", focus: "/requests/{sfm}", caption: "Approvals are reconfirmed on the new amount. One item still waits on the supplier.",
    events: [email("e-a4"),
      act("a8a", t("2026-11-16", "11:00"), "ananya", (s) => ({ type: "approve", requestId: sfm(s), key: "budget_owner" })),
      act("a8b", t("2026-11-16", "11:30"), "karan", (s) => ({ type: "record_exception", requestId: sfm(s), kind: "sole_supplier", reason: "Sole supplier: Trivenika already runs our Salesforce support (SOW-0412)." })),
      act("a8c", t("2026-11-16", "12:15"), "vikram", (s) => ({ type: "approve", requestId: sfm(s), key: "vp" }))] },
  { id: "A9", pulse: "timing", at: t("2026-11-17", "11:05"), label: "Tue 11:05", focus: "/dashboard", caption: "Intake is complete and correct. It missed the 1-day target, and the dashboard shows exactly why.",
    events: [email("e-a5"), act("a9", t("2026-11-17", "11:05"), "meera", (s) => ({ type: "approve", requestId: sfm(s), key: "infosec" }))] },
];

export const SCENARIO_B: Step[] = [
  { id: "B1", pulse: "change-banner", reveal: revealB1, at: t("2026-11-23", "10:00"), label: "Mon 23 Nov 10:00", focus: "/inbox?email=e-b1", caption: "The email says nothing changes. The order form says 12% more, 3 years, and auto-renewal.", events: [email("e-b1")] },
  { id: "B2", pulse: "conflicts", at: t("2026-11-23", "10:20"), label: "Mon 10:20", focus: "/requests/{kosha}", caption: "Ava drafts the question. A person sends it.",
    events: [act("b2", t("2026-11-23", "10:20"), "suresh", (s) => { const c = Object.values(s.conflicts).find((c) => c.requestId === kosha(s) && c.type === "renewal_terms_changed"); return { type: "ask_supplier", requestId: kosha(s), conflictId: c?.id }; }),
      act("b2b", t("2026-11-23", "10:20"), "suresh", (s) => { const d = s.drafts.find((d) => d.requestId === kosha(s) && d.status === "draft" && d.conflictId); return d ? { type: "mark_sent", draftId: d.id } : null; })] },
  { id: "B3", pulse: "conflicts", at: t("2026-11-30", "09:15"), label: "Mon 30 Nov 09:15", focus: "/requests/{kosha}", caption: "The invoice arrived before anyone approved the module. Ava links it to the renewal instead of letting it slip through.", events: [email("e-b3")] },
  { id: "B4", pulse: "documents", at: t("2026-12-01", "14:30"), label: "Tue 1 Dec 14:30", focus: "/requests/{kosha}", caption: "The supplier corrects the form. Ava checks it against what was agreed and closes the conflict.", events: [email("e-b4")] },
  { id: "B5", pulse: "status", at: t("2026-12-01", "16:00"), label: "Tue 1 Dec 16:00", focus: "/requests/{kosha}", caption: "Renewal approved at 5%, not 12%, for 1 year, not 3. The early start is recorded, not hidden.",
    events: [act("b5", t("2026-12-01", "16:00"), "karan", (s) => ({ type: "record_exception", requestId: kosha(s), kind: "retro", reason: "Module used during free trial without a request; Finance confirms it is needed." })),
      act("b5b", t("2026-12-01", "16:02"), "deepa", (s) => ({ type: "approve", requestId: kosha(s), key: "budget_owner" }))] },
];

export function resolveFocus(focus: string, s: State) {
  return focus.replace("{sfm}", sfm(s) ?? "").replace("{kosha}", kosha(s) ?? "");
}
