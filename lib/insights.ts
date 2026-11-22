// Dashboard insights (Part 3.5, 4.4): at risk, catches with impact, and counters. All numbers come from code.
import type { State } from "./types";
import { analyze } from "./engine/rules";
import { actionsOf, currentPlan } from "./engine/ai";
import { BACKGROUND, BG_CONFLICTS, BG_TOTALS } from "./background";
import { inr, istYmd, parseAmount, parseDate } from "./format";
import { waitSplit } from "./engine/timing";

export interface Catch { reqId: string; live: boolean; text: string; impact?: number; impactText: string; status: "open" | "resolved"; supplier: string }
export interface Risk { reqId: string; live: boolean; title: string; reason: string; predicted?: string }

function nextBusinessDay(iso: string) {
  const d = new Date(istYmd(iso) + "T00:00:00Z");
  do d.setUTCDate(d.getUTCDate() + 1); while ([0, 6].includes(d.getUTCDay()));
  return d.toISOString().slice(0, 10);
}

export function renewalSaving(state: State, reqId: string) {
  const a = analyze(state, reqId); const base = a.baseline?.amount; const f = a.facts.amount;
  if (!base || !f?.num || f.versions.length < 2) return undefined;
  const first = f.versions.find((v) => v.num != null)!.num!; const now = f.num;
  if (first <= now) return undefined;
  const pct = (x: number) => Math.round(((x - base) / base) * 100);
  return { first, now, saved: first - now, firstPct: pct(first), nowPct: pct(now) };
}

export function catches(state: State): Catch[] {
  const out: Catch[] = [];
  for (const c of Object.values(state.conflicts)) {
    const sup = (state.suppliers.find((s) => s.id === state.requests[c.requestId]?.supplierId)?.name ?? "").split(" ")[0];
    if (c.type === "renewal_terms_changed") {
      const sv = renewalSaving(state, c.requestId);
      const cap = analyze(state, c.requestId).checks.find((k) => k.clause === "4.2" && /cap/.test(k.text));
      const capPct = cap?.text.match(/(\d+)% cap/)?.[1];
      out.push({ reqId: c.requestId, live: true, supplier: sup, status: c.status, impact: sv?.saved, text: sv ? `Renewal at ${sv.firstPct}% against a ${capPct ?? 7}% cap, agreed ${sv.nowPct}%` : "Renewal terms changed while the email said nothing changes", impactText: sv ? `${inr(sv.saved)} saved a year` : "12% increase, 3 years and auto-renewal" });
    } else if (c.impact || c.impactText) out.push({ reqId: c.requestId, live: true, supplier: sup, status: c.status, impact: c.impact, text: c.title, impactText: c.impactText ?? "" });
    else if (c.type === "hidden_scope") out.push({ reqId: c.requestId, live: true, supplier: sup, status: c.status, text: c.title, impactText: "Customer data: InfoSec and a DPA" });
  }
  for (const { req, c } of BG_CONFLICTS) out.push({ reqId: req.id, live: false, supplier: req.supplier.split(" ")[0], status: "open", impact: c.impact, text: c.title, impactText: c.impactText });
  return out.sort((x, y) => (y.impact ?? 0) - (x.impact ?? 0));
}

export function atRisk(state: State): Risk[] {
  const out: Risk[] = [];
  for (const id of state.requestOrder) {
    const r = state.requests[id]; if (r.readyAt) continue;
    const p = currentPlan(state, id).v.output;
    const pred = p.predictedReady ? parseDate(p.predictedReady.replace(/^[A-Za-z]{3}\s+/, "")) : undefined;
    const target = nextBusinessDay(r.createdAt);
    const blocked = analyze(state, id).handoff.state === "blocked";
    if ((pred && pred > target) || blocked) out.push({ reqId: id, live: true, title: r.title, predicted: p.predictedReady, reason: blocked && !(pred && pred > target) ? "Handoff is blocked until approvals match the facts." : p.predictionReason });
  }
  for (const b of BACKGROUND.filter((b) => b.atRisk)) out.push({ reqId: b.id, live: false, title: `${b.supplier.split(" ")[0]}: ${b.project}`, predicted: b.plan.predictedReady, reason: b.atRisk! });
  return out;
}

export function counters(state: State) {
  const live = state.requestOrder.map((id) => ({ id, ...actionsOf(state.requests[id]), checks: analyze(state, id).checks.length }));
  const cs = catches(state).filter((c) => c.live);
  return {
    atStake: cs.reduce((s, c) => s + (c.impact ?? 0), 0) + BG_TOTALS.atStake,
    avaActions: live.reduce((s, x) => s + x.ava.length, 0) + BG_TOTALS.avaActions,
    decisions: live.reduce((s, x) => s + x.people.length, 0) + BG_TOTALS.decisions,
    checks: live.reduce((s, x) => s + x.checks, 0) + BG_TOTALS.checks,
    formsFilled: 0,
  };
}
export { parseAmount };

/** The north star and its drivers, computed from the event log. Live requests only: background requests are labelled sample data. */
export function northStar(state: State) {
  const ids = state.requestOrder.filter((id) => state.requests[id].type !== "invoice");
  const ready = ids.filter((id) => state.requests[id].readyAt);
  const rows = ids.map((id) => { const r = state.requests[id]; const w = waitSplit(state, id); const clean = !!r.readyAt && !(r.withdrawals?.length); return { id, ready: !!r.readyAt, clean, ...w, good: clean && w.ownMet }; });
  const good = rows.filter((r) => r.good);
  const decisions = ids.reduce((n, id) => n + actionsOf(state.requests[id]).people.length, 0);
  const autoSent = state.emails.filter((e) => e.autoSent).length;
  const fromAsk = ids.filter((id) => state.emails.find((e) => e.id === state.requests[id].emailIds[0])?.origin === "intake").length;
  return {
    rows, ready: ready.length, total: ids.length, good: good.length,
    own: rows.filter((r) => r.ready).reduce((n, r) => n + r.own, 0), supplier: rows.filter((r) => r.ready).reduce((n, r) => n + r.supplier, 0), // the split covers finished requests; open ones are listed beside it
    touches: ids.length ? decisions / ids.length : 0, reopened: state.counters.approvalsReopened, autoSent,
    fromAsk, withdrawn: ids.filter((id) => state.requests[id].withdrawals?.length).length,
    cleanReady: rows.filter((r) => r.clean).length,
  };
}
