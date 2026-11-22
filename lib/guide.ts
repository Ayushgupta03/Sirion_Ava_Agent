// Guidance content and pure logic for the guided demo: step coaching, glossary, page help, the "try it yourself" list and the end-of-scenario debrief.
// No React here, so every rule can be tested. Copy follows docs/14-design-system.md (plain words, names, numbers, no banned words).
import type { State } from "./types";
import { analyze } from "./engine/rules";
import { actionsOf } from "./engine/ai";
import { waitSplit } from "./engine/timing";
import { northStar } from "./insights";

export type Scn = "A" | "B";

/** What the viewer should look at in a step. The element to point at is the step's `pulse` target (data-pulse="..."). */
export interface StepGuide { title: string; where: string; notice: string[]; why: string }

export const STEP_GUIDE: Record<string, StepGuide> = {
  A1: { title: "Rahul sends a normal email", where: "Ava's read, top right",
    notice: ["Rahul filled in no form. The request exists because Ava read his email.", "Ava filed it under Trivenika › Salesforce migration (REQ-1047) and checked the NDA on file."],
    why: "Today this email would sit in Rahul's outbox until someone remembered to raise a request." },
  A2: { title: "Policy sets the approvers", where: "Ava's plan",
    notice: ["₹38L of spend with Trivenika in {{ninety-day|90 days}} is over the ₹25L limit, so Vikram (VP) must approve.", "Steps marked “{{policy-step|Required by policy}}” come from the rules. Steps marked “Added by Ava” carry a reason."],
    why: "The limit is added up by code from the contract history, not guessed by the AI." },
  A3: { title: "Ava reads the attachments and finds problems", where: "Problems Ava found",
    notice: ["The proposal asks for customer data. Rahul's email never mentioned it.", "Two rates break the MSA rate cap, and the clean-up report is 35 days late."],
    why: "Each problem shows both sources side by side. Ava recommends a next step. A person decides." },
  A4: { title: "Each person sees only their own queue", where: "Needs your decision",
    notice: ["Rahul confirmed data access, so InfoSec and Legal now have work.", "Karan used Ava's recommendation and sent the rate question to Trivenika."],
    why: "Nobody is chased by email. Work lands in the queue of the person it belongs to." },
  A5: { title: "Approvers get a receipt, not a form", where: "Approvals",
    notice: ["Ananya approves ₹20L and Vikram approves ₹38L.", "Each {{decision-receipt|Decision Receipt}} lists exactly the facts being approved, with Ava's summary."],
    why: "An approval belongs to the facts it was given for. If those facts go up, it reopens." },
  A6: { title: "The PDF says ₹1.5L more than the email", where: "What changed banner",
    notice: ["The email body says nothing about price.", "Ava put proposal v2 beside v1 and found a new ₹1,50,000 line for UAT."],
    why: "Someone skimming the email would have signed off on the old price." },
  A7: { title: "Approvals reopen and handoff stops", where: "Ava's plan",
    notice: ["Both approvals {{reconfirm|reopen}} because the amount went up.", "Ava re-plans and asks Rahul one question: keep the UAT line?"],
    why: "Only increases reopen an approval. A price drop would not." },
  A8: { title: "The supplier fixes the rates and people reconfirm", where: "Approvals",
    notice: ["Trivenika reissues the rates within the cap: ₹21,10,800.", "Ananya and Vikram reconfirm. Karan requires a change request for the late report."],
    why: "Every exception and credit is recorded with a reason and the person who decided." },
  A9: { title: "Intake is complete and correct", where: "Handoff banner",
    notice: ["Ava predicted this date on Thursday.", "The banner counts what Ava did and what people decided."],
    why: "Legal receives a {{handoff|packet}} with facts, sources and receipts, not an email thread to read." },
  B1: { title: "The email says no change. The form says 12% more", where: "What changed banner",
    notice: ["The order form shows 12% more, 3 years and auto-renewal.", "The contract caps increases at 7% and allows no auto-renewal without written agreement."],
    why: "A renewal that quietly adds terms is the failure Ava is built to catch." },
  B2: { title: "Ava drafts the counter and Suresh sends it", where: "Problems Ava found",
    notice: ["The counter is 5% for 1 year, drafted from the contract clause.", "Suresh sent it. Ava does not send price messages by herself."],
    why: "Ava drafts and a person sends. Only routine messages can be switched to auto-send in Settings." },
  B3: { title: "An invoice arrives before anyone approved", where: "Problems Ava found",
    notice: ["Ava linked the Kosha invoice to the renewal.", "She suggests one PO instead of two separate payments."],
    why: "Work that starts before approval is the other way spend slips past a budget owner." },
  B4: { title: "The corrected form is within the cap", where: "What the contract says",
    notice: ["Ava checked the corrected order form against the contract.", "The {{conflict|conflict}} closed because the new facts match the clause."],
    why: "Code closes a conflict only when the facts agree with the contract." },
  B5: { title: "Approved at 5%, not 12%", where: "Request status",
    notice: ["One year at 5% saves ₹1,26,000 a year.", "The early start is recorded as an exception with a reason, not hidden."],
    why: "The saving and the exception are both on record for the next renewal." },
};

export const SCENARIO_BLURB: Record<Scn, { name: string; line: string; moments: string[] }> = {
  A: { name: "New project", line: "Rahul emails a supplier. Ava finds three problems before anyone signs.", moments: ["Step 1: a normal email opens the request", "Step 6: the PDF says ₹1.5L more", "Step 7: approvals reopen, handoff stops"] },
  B: { name: "Renewal", line: "A software renewal where the email and the order form disagree.", moments: ["Step 1: the email and the order form disagree", "Step 3: an invoice arrives before approval", "Step 5: approved at 5%, not 12%"] },
};

// ---------------------------------------------------------------- glossary

export interface Term { id: string; term: string; def: string }
export const GLOSSARY: Term[] = [
  { id: "decision-receipt", term: "Decision Receipt", def: "The page an approver signs. It lists exactly which facts they approve, Ava's summary and any open risks. If those facts later go up, the approval reopens." },
  { id: "ninety-day", term: "90-day spend", def: "Everything Prayaan spent or committed with one supplier for one cost centre over a rolling 90 days. Over ₹25L, the VP must approve. Code adds it up, not the AI." },
  { id: "conflict", term: "Conflict", def: "Two sources that disagree, for example the email and the PDF. Ava shows both with quotes and never picks a side. A named person resolves it." },
  { id: "critical-path", term: "Critical path", def: "The chain of steps that sets the ready date. A delay on any step marked critical delays the whole request." },
  { id: "policy-step", term: "Required by policy", def: "A step the rules engine adds because company policy demands it, such as VP approval over ₹25L. Steps “Added by Ava” are Ava's own, each with a reason." },
  { id: "reconfirm", term: "Reconfirmation", def: "When a material fact goes up after someone approved, they approve again. A decrease does not reopen an approval." },
  { id: "handoff", term: "Handoff packet", def: "What Legal receives when intake is complete: facts with sources, approval receipts, contract issues raised and open notes." },
  { id: "cached", term: "Cached", def: "This text was written ahead of time in the model's output shape, so the demo is repeatable. With an API key, the same screens show Live AI." },
  { id: "view-as", term: "View as", def: "Switch to any person to see what only they see and to act as them. Each person has their own queue." },
  { id: "own-time", term: "Prayaan's own time", def: "The part of the clock Prayaan controls. Waiting for a supplier's reply is excluded, because no one here can speed it up." },
  { id: "mail-rule", term: "Mail rule", def: "An Outlook or Gmail rule that copies supplier email to Ava. In this prototype, supplier email is simulated." },
];
export const termById = (id: string) => GLOSSARY.find((t) => t.id === id);

/** Strip {{id|text}} markers to plain text (for aria labels, tests and the copy rules). */
export const plain = (t: string) => t.replace(/\{\{[a-z-]+\|([^}]+)\}\}/g, "$1");

// ---------------------------------------------------------------- page help

export interface PageHelp { id: string; title: string; purpose: string; howTo: string[] }
const HELP: PageHelp[] = [
  { id: "landing", title: "Start here", purpose: "Pick a story to watch, or try Ava yourself.", howTo: ["Watch Scenario A for the full lifecycle of a new project.", "Watch Scenario B for a renewal where the email and the order form disagree.", "Or start a request in Ask Ava, or send your own email."] },
  { id: "mail", title: "Captured mail", purpose: "Supplier email that Ava received through a mail rule, and what she recorded from it.", howTo: ["Click an email to see what Ava read, checked and filed.", "The amber banner shows what changed against the last version.", "Use “Test lab” to write any email as anyone."] },
  { id: "today", title: "Today", purpose: "One person's queue: the decisions that wait on them, nothing else.", howTo: ["Use “View as” in the top bar to see another person's queue.", "Each card has Ava's recommendation. Use it, edit it or dismiss it.", "Approvals open a Decision Receipt first."] },
  { id: "requests", title: "Requests", purpose: "Every request in one list, with who each one waits on.", howTo: ["Filter to requests with an open conflict.", "Group by supplier to see all work with one company.", "Open a request for its case file."] },
  { id: "request", title: "Request case file", purpose: "Everything about one request: Ava's read, plan, problems, contract checks and log.", howTo: ["Use “On this page” to jump to a section.", "Click any citation to open the exact sentence or clause.", "Problems show both sources. Ava recommends and a person decides."] },
  { id: "dashboard", title: "Dashboard", purpose: "How intake is doing across all requests, including sample requests from other teams.", howTo: ["“At risk” lists requests whose plan date is late.", "The pipeline shows where every request sits.", "“Clean and fast” is the north-star metric, on Prayaan's own time."] },
  { id: "new", title: "Ask Ava", purpose: "Start a request before any supplier is contacted, by describing the need in a sentence.", howTo: ["Pick an example, or type your own sentence.", "Check what Ava understood and fix any field.", "The preview shows approvers and the 90-day total before anything is saved."] },
  { id: "settings", title: "Settings", purpose: "What Ava may do by herself.", howTo: ["Routine messages, such as a request for a written quote, can be sent by Ava.", "Chasers for documents stay as drafts until you switch them on.", "Ava never approves, rejects or accepts a price."] },
  { id: "story", title: "About the case", purpose: "The reasoning behind the prototype, in six short pages.", howTo: ["Each page opens with one question and a one-line answer.", "Buttons marked with a play icon replay the live demo at that step."] },
];
export function pageHelpFor(path: string): PageHelp | undefined {
  if (path === "/") return HELP.find((h) => h.id === "landing");
  const seg = path.split("/")[1];
  if (seg === "requests" && path.split("/").length > 2) return HELP.find((h) => h.id === "request");
  if (seg === "suppliers" || seg === "supplier" || seg === "conflicts" || seg === "items" || seg === "inbox") return undefined;
  return HELP.find((h) => h.id === seg);
}

// ---------------------------------------------------------------- try it yourself

export interface Task { id: string; label: string; hint: string; href?: string }
export const TASKS: Task[] = [
  { id: "watchA", label: "Watch Scenario A to the end", hint: "9 steps, about 3 minutes", href: "/" },
  { id: "watchB", label: "Watch Scenario B to the end", hint: "5 steps, about 2 minutes", href: "/" },
  { id: "viewAs", label: "View as another person", hint: "Top bar, “Viewing as”" },
  { id: "decide", label: "Decide something yourself", hint: "Approve, answer a question or use a recommendation", href: "/today" },
  { id: "ask", label: "Start a request in Ask Ava", hint: "Describe a need in one sentence", href: "/new" },
  { id: "email", label: "Send your own email to Ava", hint: "Test lab in Captured mail", href: "/mail?compose=1" },
];

/** Which tasks are done, worked out from the event log (not from clicks) plus one flag the log cannot hold. */
export function taskStatus(state: State, events: { kind: string; tag?: string; actor?: string; action?: { type: string }; email?: { origin: string } }[], pos: Record<Scn, number>, stepsLen: Record<Scn, number>, viewedAs: boolean): Record<string, boolean> {
  const mine = events.filter((e) => !e.tag);
  return {
    watchA: pos.A >= stepsLen.A,
    watchB: pos.B >= stepsLen.B,
    viewAs: viewedAs,
    decide: mine.some((e) => e.kind === "action" && e.actor && e.actor !== "system" && e.action?.type !== "tick"),
    ask: northStar(state).fromAsk > 0,
    email: mine.some((e) => e.kind === "email" && e.email?.origin === "composed"),
  };
}

// ---------------------------------------------------------------- debrief

export function fmtSpan(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)} hours`;
  return `${(hours / 24).toFixed(1).replace(/\.0$/, "")} days`;
}

export interface Debrief { reqId: string; title: string; outcome: string; ready: boolean; total: string; own: string; supplier: string; avaActions: number; decisions: number; problems: { text: string; impact?: string }[] }

/** What a finished scenario proved, from the event log. Numbers are code's, never the AI's. */
export function debriefFor(state: State, sc: Scn): Debrief | null {
  const reqId = state.threadRequest[sc === "A" ? "t-sfm" : "t-kosha"];
  const req = reqId && state.requests[reqId]; if (!req) return null;
  const w = waitSplit(state, reqId); const a = actionsOf(req); const an = analyze(state, reqId);
  const ready = !!req.readyAt;
  const outcome = an.handoff.state === "ready_po" ? "Ready to issue PO" : an.handoff.state === "ready_legal" ? "Ready for Legal Review" : "Still in intake";
  const problems = Object.values(state.conflicts).filter((c) => c.requestId === reqId).map((c) => ({ text: c.title, impact: c.impactText }));
  return { reqId, title: req.title, outcome, ready, total: fmtSpan(w.total), own: fmtSpan(w.own), supplier: fmtSpan(w.supplier), avaActions: a.ava.length, decisions: a.people.length, problems };
}
