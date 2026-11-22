// AI output evals: checks that every read, plan and recommendation keeps the promises in the system prompt.
// Used by `npm run eval` (scripts/eval-ai.ts) and by tests/evals.test.ts. Pure functions; no model calls.
import type { AiPlan, AiRead, AiRec, Cite } from "./aiTypes";
import type { State } from "./types";
import { clauseOf, contractDoc } from "./engine/contracts";
import { analyze } from "./engine/rules";
import { validatePlan } from "./engine/ai";
import { requestContext } from "./aiContext";

export const BANNED = ["seamless", "powerful", "leverage", "unlock", "cutting-edge", "empower", "game-changer", "revolutionary", "intelligent", "smart"];

export interface EvalIssue { severity: "fail" | "warn"; check: string; detail: string }

const sentences = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-Z₹"“])/).filter((s) => s.trim());

/** Every ₹ figure in a text, as rupees. Handles ₹21,10,800, ₹38L, ₹21.5L, ₹2 crore. */
export function moneyIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/₹\s?([\d,]+(?:\.\d+)?)\s*(L\b|lakh|crore|Cr\b)?/gi)) {
    const n = parseFloat(m[1].replace(/,/g, "")); if (isNaN(n)) continue;
    const u = (m[2] ?? "").toLowerCase();
    out.push(Math.round(u === "l" || u === "lakh" ? n * 1e5 : u === "crore" || u === "cr" ? n * 1e7 : n));
  }
  return out;
}

/** Money the AI may use: everything code or a source provides for this request. */
export function allowedMoney(state: State, reqId: string): Set<number> {
  const ctx = JSON.stringify(requestContext(state, reqId));
  const a = analyze(state, reqId);
  const extra = [
    ...a.req.emailIds.flatMap((id) => { const e = state.emails.find((x) => x.id === id); return e ? [e.body, ...e.attachments.flatMap((x) => x.pages.flat())] : []; }),
    ...a.checks.map((k) => k.text),
    ...Object.values(state.conflicts).filter((c) => c.requestId === reqId).flatMap((c) => [c.title, c.whyItMatters, c.impactText ?? "", ...[...c.a.quotes, ...c.b.quotes].map((q) => `${q.quote} ${q.note ?? ""}`)]),
  ].join("\n");
  const set = new Set<number>();
  for (const n of moneyIn(ctx + "\n" + extra)) set.add(n);
  return set;
}
const near = (n: number, set: Set<number>) => [...set].some((m) => Math.abs(m - n) <= Math.max(500, m * 0.006)); // allow lakh rounding (₹21.11L)

export function citeResolves(c: Cite, state: State): boolean {
  if (c.type === "clause") { const i = c.id.lastIndexOf(" "); return !!clauseOf(c.id.slice(0, i), c.id.slice(i + 1)); }
  if (c.type === "email") return state.emails.some((e) => e.id === c.id);
  return !!contractDoc(c.id) || state.emails.some((e) => e.attachments.some((a) => a.id === c.id)) || c.id === "Decision Receipt" || c.id === "Routing rules" || /^(SOW|TV|KA|KO)-/.test(c.id);
}

function common(text: string, issues: EvalIssue[]) {
  for (const w of BANNED) if (new RegExp(`\\b${w}\\b`, "i").test(text)) issues.push({ severity: "fail", check: "banned-word", detail: `"${w}"` });
  for (const s of sentences(text)) if (s.split(/\s+/).length > 40) issues.push({ severity: "warn", check: "long-sentence", detail: s.slice(0, 80) + "…" });
  if (/supplier history|last year|took \d+ business days/i.test(text) && /\b(predict|will|likely|expect)/i.test(text) && !/Based on sample history in this prototype\./.test(text)) issues.push({ severity: "warn", check: "history-label", detail: "Prediction from history without the sample-history label" });
}

function moneyCheck(text: string, state: State, reqId: string, issues: EvalIssue[]) {
  const allowed = allowedMoney(state, reqId);
  for (const n of moneyIn(text)) if (!near(n, allowed)) issues.push({ severity: "fail", check: "number-not-from-code", detail: `₹${n.toLocaleString("en-IN")} is not in the facts, sources or code numbers` });
}

export function evalRead(o: AiRead, state: State, reqId: string): EvalIssue[] {
  const issues: EvalIssue[] = [];
  if (o.sentences.length > 4) issues.push({ severity: "fail", check: "max-4-sentences", detail: `${o.sentences.length} sentences` });
  o.sentences.forEach((s, i) => {
    if (!s.citations.length) issues.push({ severity: "fail", check: "cite-every-claim", detail: `sentence ${i + 1} has no citation` });
    s.citations.filter((c) => !citeResolves(c, state)).forEach((c) => issues.push({ severity: "fail", check: "citation-resolves", detail: `${c.type} ${c.id}` }));
  });
  const text = o.sentences.map((s) => s.text).join(" ");
  common(text, issues); moneyCheck(text, state, reqId, issues);
  return issues;
}

export function evalPlan(o: AiPlan, state: State, reqId: string): EvalIssue[] {
  const issues: EvalIssue[] = [];
  const { fixes } = validatePlan(o, analyze(state, reqId), state);
  fixes.forEach((f) => issues.push({ severity: /policy check/.test(f) ? "fail" : "warn", check: "plan-validation", detail: f }));
  const ids = new Set(o.steps.map((s) => s.id));
  o.criticalPath.filter((x) => !ids.has(x)).forEach((x) => issues.push({ severity: "warn", check: "critical-path-id", detail: x }));
  o.steps.filter((s) => s.source === "ava" && !s.reason).forEach((s) => issues.push({ severity: "fail", check: "ava-step-has-reason", detail: s.title }));
  if (o.predictedReady && !o.predictionReason) issues.push({ severity: "fail", check: "prediction-reason", detail: "Predicted date without a reason" });
  const text = [o.predictionReason, ...o.steps.map((s) => `${s.title}. ${s.reason ?? ""}`)].join(" ");
  common(text, issues); moneyCheck(text, state, reqId, issues);
  return issues;
}

export function evalRec(o: AiRec, state: State, reqId: string): EvalIssue[] {
  const issues: EvalIssue[] = [];
  if (!o.bullets) {
    if (sentences(o.reasoning).length > 2) issues.push({ severity: "fail", check: "reasoning-max-2", detail: `${sentences(o.reasoning).length} sentences` });
    if (!o.citations.length) issues.push({ severity: "fail", check: "cite-every-claim", detail: "no citations" });
  }
  o.citations.filter((c) => !citeResolves(c, state)).forEach((c) => issues.push({ severity: "fail", check: "citation-resolves", detail: `${c.type} ${c.id}` }));
  if (/\b(I|we|Ava) (have )?(approved|rejected|applied the credit)\b/i.test(`${o.recommendation} ${o.reasoning}`)) issues.push({ severity: "fail", check: "never-decides", detail: "Claims to approve, reject or apply a credit" });
  if (/^\s*approve (it|this|the request)\b/i.test(o.recommendation)) issues.push({ severity: "warn", check: "never-decides", detail: "Recommends approval outright" });
  const text = [o.recommendation, o.reasoning, o.draft ?? "", ...(o.bullets ?? [])].join(" ");
  common(text, issues); moneyCheck(text, state, reqId, issues);
  return issues;
}

export interface EvalRow { step: string; requestId: string; layer: string; key: string; source: string; promptVersion?: string; issues: EvalIssue[] }

/** Results per prompt version, so a prompt change shows up as its own row. Scripted outputs have no prompt and group as "cached". */
export function groupByVersion(rows: EvalRow[]) {
  const m = new Map<string, { version: string; outputs: number; failing: number; warnings: number }>();
  for (const r of rows) {
    const version = r.promptVersion ?? (r.source === "cached" ? "cached (hand-written)" : r.source);
    const g = m.get(version) ?? { version, outputs: 0, failing: 0, warnings: 0 };
    g.outputs++; if (r.issues.some((i) => i.severity === "fail")) g.failing++; else if (r.issues.some((i) => i.severity === "warn")) g.warnings++;
    m.set(version, g);
  }
  return [...m.values()];
}
