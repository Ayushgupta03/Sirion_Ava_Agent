// Part 3: the AI layers on top of the engine. The AI understands, plans, acts and advises; code enforces policy.
import type { AiPlan, AiRead, AiRec, AiSource, PlanStep, StepStatus, Versioned } from "../aiTypes";
import type { Conflict, Request, State } from "../types";
import { fmtDT, lakh } from "../format";
import { analyze, type Analysis } from "./rules";
import { firstName, PEOPLE, person, personName, POLICY } from "./world";

export const emptyAi = () => ({ reads: {}, plans: {}, recs: {} });

/** What a read or plan depends on. A stored output is current only while this is unchanged. */
export function fingerprint(state: State, reqId: string) {
  const a = analyze(state, reqId);
  const open = Object.values(state.conflicts).filter((c) => c.requestId === reqId && c.status === "open").map((c) => c.id).sort();
  const f = a.facts;
  return JSON.stringify([f.amount?.num, f.scope?.sources[0]?.quote, f.data_access?.num, f.duration?.num, f.auto_renew?.num, open, a.checks.map((c) => `${c.id}:${c.status}`).sort()]);
}

// ── Policy steps the plan must contain (from the rules engine) ──
export function requiredSteps(a: Analysis): PlanStep[] {
  const out: PlanStep[] = [];
  const add = (id: string, title: string, ownerId: string) => out.push({ id, title, ownerId, source: "policy", dependsOn: [], status: "todo" });
  for (const ap of a.approvals) {
    if (ap.key === "budget_owner") add("approve-budget", `Budget approval at ${lakh(a.requestAmount)}`, ap.approverId);
    if (ap.key === "vp") add("approve-vp", `VP approval of the ${lakh(a.spend.total)} 90-day total`, ap.approverId);
    if (ap.key === "infosec") add("approve-infosec", "InfoSec review of customer-data access", ap.approverId);
  }
  const map: Record<string, [string, string]> = { competing: ["competing", "Competing quote or authorized exception"], dpa: ["dpa", "Data processing agreement (Legal review)"], security_cert: ["security-cert", "Security certificate in date"], insurance: ["insurance", "Insurance certificate"], gst_pan: ["gst", "GST and PAN"], renewal_terms: ["renewal-terms", "Renewal terms match what was agreed"], retro: ["retro", "Reason and retrospective approval"] };
  for (const c of a.checklist) { const m = map[c.key]; if (!m) continue; if (c.key === "gst_pan" && c.status === "done") continue; add(m[0], m[1], c.ownerId); }
  return out;
}

/** Live status from engine state, for steps the code knows. Unknown steps keep the AI's status. */
export function stepStatus(state: State, a: Analysis, s: PlanStep): StepStatus {
  const ap = (k: string) => a.approvals.find((x) => x.key === k);
  const apStatus = (k: string): StepStatus => { const x = ap(k); if (!x) return "done"; if (x.status === "approved" || x.status === "reconfirmed") return "done"; if (x.status === "needs_reconfirmation") return "blocked"; return x.gateOpen ? "in_progress" : "todo"; };
  const ck = (k: string): StepStatus => { const c = a.checklist.find((x) => x.key === k); if (!c) return "done"; if (["done", "excepted", "legal_review"].includes(c.status)) return "done"; return c.status === "waiting_supplier" || a.req.exceptions.length ? "in_progress" : "todo"; };
  const conf = (pred: (c: Conflict) => boolean): StepStatus => { const cs = Object.values(state.conflicts).filter((c) => c.requestId === a.req.id && pred(c)); if (!cs.length) return "done"; return cs.some((c) => c.status === "open") ? "in_progress" : "done"; };
  switch (s.id) {
    case "approve-budget": return apStatus("budget_owner");
    case "approve-vp": return apStatus("vp");
    case "approve-infosec": return apStatus("infosec");
    case "competing": return ck("competing");
    case "dpa": return ck("dpa");
    case "security-cert": return ck("security_cert");
    case "insurance": return ck("insurance");
    case "gst": return ck("gst_pan");
    case "renewal-terms": return ck("renewal_terms");
    case "retro": return ck("retro");
    case "get-quote": return a.folded.documents.some((d) => ["quote", "order_form", "sow"].includes(d.docType)) ? "done" : "in_progress";
    case "confirm-data": { const d = a.facts.data_access; return d?.state === "confirmed" ? "done" : d?.num === 1 ? "in_progress" : "todo"; }
    case "check-nda-msa": return "done";
    case "resolve-rates": return conf((c) => c.id.includes(":contract:rates:"));
    case "resolve-delivery": return conf((c) => c.id.includes(":contract:delivery:"));
    case "resolve-uat": { const f = a.req.flags.find((x) => x.question === "keep_line"); return !f ? "todo" : f.status === "open" ? "in_progress" : "done"; }
    case "handoff": return a.handoff.state === "ready_legal" || a.handoff.state === "ready_po" ? "done" : a.handoff.state === "blocked" ? "blocked" : "todo";
    default: return s.status;
  }
}

/** Code validates every plan: policy steps present, owners exist, no cycles. */
export function validatePlan(plan: AiPlan, a: Analysis, state: State): { plan: AiPlan; fixes: string[] } {
  const fixes: string[] = [];
  const req = requiredSteps(a);
  const steps = plan.steps.map((s) => ({ ...s, dependsOn: [...(s.dependsOn ?? [])] }));
  for (const r of req) {
    const s = steps.find((x) => x.id === r.id);
    if (!s) { steps.push({ ...r, reason: "Added by policy check" }); fixes.push(`Added by policy check: ${r.title}`); }
    else { s.source = "policy"; s.ownerId = r.ownerId; }
  }
  const valid = new Set([...PEOPLE.map((p) => p.id), "ava", ...state.suppliers.map((s) => s.id)]);
  for (const s of steps) if (!valid.has(s.ownerId)) { fixes.push(`Owner "${s.ownerId}" not found for "${s.title}"; set to ${personName(POLICY.procurementOwner)}`); s.ownerId = POLICY.procurementOwner; }
  const ids = new Set(steps.map((s) => s.id));
  for (const s of steps) s.dependsOn = s.dependsOn.filter((d) => ids.has(d) && d !== s.id);
  // Remove edges that close a cycle.
  const byId = new Map(steps.map((s) => [s.id, s]));
  const visit = (id: string, stack: Set<string>) => {
    const s = byId.get(id)!; stack.add(id);
    s.dependsOn = s.dependsOn.filter((d) => { if (stack.has(d)) { fixes.push(`Removed a circular dependency: ${s.title} → ${byId.get(d)?.title}`); return false; } visit(d, stack); return true; });
    stack.delete(id);
  };
  for (const s of steps) visit(s.id, new Set());
  for (const s of steps) s.status = stepStatus(state, a, s);
  return { plan: { ...plan, steps, criticalPath: plan.criticalPath.filter((x) => ids.has(x) || steps.some((s) => s.id === x)) }, fixes };
}

const STATUS_WORD: Record<string, string> = { done: "done", blocked: "reopened", in_progress: "in progress", todo: "to do" };
export function planDiff(prev: Versioned<AiPlan> | undefined, next: AiPlan, a: Analysis): string[] {
  if (!prev) return [];
  const out: string[] = [];
  for (const s of next.steps) {
    const p = prev.output.steps.find((x) => x.id === s.id);
    if (!p) out.push(`Added: ${s.title}`);
    else if (p.status !== "blocked" && s.status === "blocked") out.push(s.id === "handoff" ? "Handoff blocked" : `${s.title.replace(/ at .*| of the .*/, "")} reopened`);
    else if (p.status !== s.status && s.status === "done") out.push(`${s.title.replace(/ at .*| of the .*/, "")} ${STATUS_WORD[s.status]}`);
  }
  if (out.some((o) => o.endsWith(" reopened")) && a.handoff.state === "blocked" && !out.includes("Handoff blocked")) out.push("Handoff blocked");
  if (prev.output.predictedReady && next.predictedReady) out.push(prev.output.predictedReady === next.predictedReady ? `Predicted date unchanged: ${next.predictedReady}` : `Predicted ready moved: ${prev.output.predictedReady} → ${next.predictedReady}`);
  for (const c of next.changesSinceLast ?? []) if (!out.some((o) => o.toLowerCase() === c.toLowerCase())) out.push(c);
  return out.slice(0, 6);
}

// ── Rules-only fallbacks (AI unavailable) ──
export function rulesRead(state: State, a: Analysis): AiRead {
  const r = a.req; const sup = state.suppliers.find((s) => s.id === r.supplierId);
  const supName = (sup?.name ?? r.supplierGuess?.name ?? "the supplier").replace(/ (Pvt Ltd|LLP)$/, "");
  const first = state.emails.find((e) => e.id === r.emailIds[0]);
  const s: AiRead["sentences"] = [{ text: `${personName(r.requesterId)} wants ${supName} for ${r.project}${a.requestAmount ? `: ${lakh(a.requestAmount)}` : ""}${a.facts.duration?.value ? `, ${a.facts.duration.value}` : ""}.`, citations: first ? [{ type: "email", id: first.id }] : [] }];
  const open = Object.values(state.conflicts).filter((c) => c.requestId === r.id && c.status === "open");
  if (open.length) s.push({ text: `Open problems: ${open.map((c) => c.title).join("; ")}.`, citations: open.slice(0, 2).map((c) => ({ type: "email" as const, id: c.b.quotes[0]?.emailId || r.emailIds[0], quote: c.b.quotes[0]?.quote })) });
  s.push({ text: `90-day total with ${supName} in ${r.costCentre}: ${lakh(a.spend.total)}, ${a.spend.overLimit ? "over" : "under"} the ₹25L limit.`, citations: [{ type: "doc", id: "Routing rules", quote: a.spend.text }] });
  return { sentences: s, risks: open.map((c) => c.title) };
}
export function rulesPlan(a: Analysis, state: State): AiPlan {
  const { plan } = validatePlan({ steps: [], criticalPath: [], predictedReady: "", predictionReason: "Not predicted: AI unavailable.", changesSinceLast: [] }, a, state);
  plan.steps.forEach((s) => { s.reason = undefined; });
  return plan;
}
export const rulesRec = (): AiRec => ({ recommendation: "Review the conflict.", reasoning: "AI is unavailable right now, so Ava has no recommendation. The card shows both sources.", citations: [], confidence: "low", action: "review" });

// ── Display helpers: the current output, or a labelled fallback ──
export function currentRead(state: State, reqId: string): { v: Versioned<AiRead>; prev?: Versioned<AiRead>; stale: boolean } {
  const list = state.ai.reads[reqId] ?? []; const fp = fingerprint(state, reqId);
  const last = list[list.length - 1];
  if (last && last.fingerprint === fp) return { v: last, prev: list[list.length - 2], stale: false };
  return { v: { at: state.now, source: "rules", fingerprint: fp, output: rulesRead(state, analyze(state, reqId)) }, prev: last, stale: !!last };
}
export function currentPlan(state: State, reqId: string): { v: Versioned<AiPlan>; stale: boolean } {
  const a = analyze(state, reqId); const list = state.ai.plans[reqId] ?? []; const fp = fingerprint(state, reqId);
  const last = list[list.length - 1];
  const base = last && last.fingerprint === fp ? last : { at: state.now, source: "rules" as AiSource, fingerprint: fp, output: rulesPlan(a, state), changes: last?.changes };
  const { plan } = validatePlan(base.output, a, state);
  return { v: { ...base, output: plan }, stale: !!last && last.fingerprint !== fp };
}
export function currentRec(state: State, key: string): Versioned<AiRec> {
  return state.ai.recs[key] ?? { at: state.now, source: "rules", fingerprint: "", output: rulesRec() };
}

/** Ava's actions and people's decisions, both counted from the event log. */
export function actionsOf(req: Request) {
  const ava = req.timeline.filter((t) => !t.actor || t.actor === "ava");
  const people = req.timeline.filter((t) => t.actor && t.actor !== "ava" && t.actor !== "system");
  return { ava, people };
}

/** When the plan first predicted the date intake actually finished. */
export function predictionHit(state: State, reqId: string) {
  const req = state.requests[reqId]; if (!req.readyAt) return undefined;
  const day = fmtDT(req.readyAt).split(",")[0];
  const hit = (state.ai.plans[reqId] ?? []).find((p) => p.output.predictedReady && p.output.predictedReady.startsWith(day));
  const dt = fmtDT(req.readyAt); const p = fmtDT(hit?.at ?? req.readyAt);
  return hit ? `Predicted on ${p.split(" ")[0]} ${p.split(", ")[1]}: ${hit.output.predictedReady}. Actual: ${dt.replace(",", "")}.` : undefined;
}

export const ownerName = (id: string, state: State) => id === "ava" ? "Ava" : person(id)?.name ?? state.suppliers.find((s) => s.id === id)?.name.replace(/ (Pvt Ltd|LLP)$/, "") ?? id;
export { firstName };
