"use client";
// The four AI layers on screen: Ava's read, Ava's plan, Ava recommends, Ava did.
import type { AiMeta } from "@/lib/promptVersion";
import { useEffect, useState } from "react";
import type { Cite, AiRec, Versioned } from "@/lib/aiTypes";
import type { Request, State } from "@/lib/types";
import { useAva } from "@/lib/store";
import { actionsOf, currentPlan, currentRead, currentRec, fingerprint, ownerName, planContext, predictionHit } from "@/lib/engine/ai";
import { analyze, type Analysis } from "@/lib/engine/rules";
import { clauseOf, contractDoc } from "@/lib/engine/contracts";
import { requestContext, conflictContext } from "@/lib/aiContext";
import { fmtDT } from "@/lib/format";
import { Button, Chip, cx } from "./ui";

// ── Labels and citation chips ──
/** Shown beside a live answer that failed an output check (lib/evals.ts). */
export function EvalBadge({ issues }: { issues?: { severity: string; check: string; detail: string }[] }) {
  const f = issues?.filter((i) => i.severity === "fail") ?? [];
  if (!f.length) return null;
  return <span title={f.map((i) => `${i.check}: ${i.detail}`).join("\n")} className="inline-flex h-5 items-center rounded bg-red-100 px-1.5 text-[10.5px] font-semibold text-red-800">{f.length} check{f.length > 1 ? "s" : ""} failed</span>;
}
export function AiLabel({ source, meta }: { source: "live" | "cached" | "rules"; meta?: AiMeta }) {
  const t = source === "live" ? "Live AI" : source === "cached" ? "Cached" : "Simulated";
  const tip = source === "rules" ? "Written by code from the facts and the contract checks, with no model. In live use a model would write this." : source === "cached" ? "Written for this scripted step and stored. Same shape as a live answer." : source === "live" && meta?.promptVersion ? `Live answer. Prompt version ${meta.promptVersion}${meta.model ? `, model ${meta.model}` : ""}.` : undefined;
  return <span title={tip} className={cx("inline-flex h-5 items-center rounded px-1.5 text-[10.5px] font-semibold uppercase tracking-wide", source === "live" ? "bg-emerald-100 text-emerald-800" : source === "cached" ? "bg-violet-100 text-violet-800" : "bg-slate-200 text-slate-700")}>{t}</span>;
}

const shortDoc = (docId: string) => docId === "TV-MSA-2024" ? "MSA" : docId;
export function citeLabel(c: Cite, state: State) {
  if (c.type === "clause") { const i = c.id.lastIndexOf(" "); return `${shortDoc(c.id.slice(0, i))} ${c.id.slice(i + 1)}`; }
  if (c.type === "email") { const e = state.emails.find((x) => x.id === c.id); return e ? `Email, ${fmtDT(e.sentAt).split(", ")[0].split(" ")[0]} ${fmtDT(e.sentAt).split(", ")[1]}` : "Email"; }
  const att = state.emails.flatMap((e) => e.attachments).find((a) => a.id === c.id);
  return att ? att.name.replace(/_/g, " ").replace(/\.(pdf|xlsx)$/, "") : c.id;
}
export function CiteChip({ c }: { c: Cite }) {
  const state = useAva((s) => s.state); const open = useAva((s) => s.openSource);
  const label = citeLabel(c, state);
  let onClick: (() => void) | undefined;
  if (c.type === "clause") { const i = c.id.lastIndexOf(" "); const docId = c.id.slice(0, i), clause = c.id.slice(i + 1); if (clauseOf(docId, clause)) onClick = () => open({ emailId: "", file: c.id, docId, clause, quote: "" }); }
  else if (c.type === "email") { if (state.emails.some((e) => e.id === c.id)) onClick = () => open({ emailId: c.id, file: "email", quote: c.quote ?? "" }); }
  else if (contractDoc(c.id)) onClick = () => open({ emailId: "", file: c.id, docId: c.id, quote: "" });
  else { const e = state.emails.find((x) => x.attachments.some((a) => a.id === c.id)); if (e) onClick = () => open({ emailId: e.id, file: label, attachmentId: c.id, quote: c.quote ?? "" }); }
  const cls = "ml-1 inline-flex h-[19px] items-center gap-1 rounded border px-1.5 align-[1px] text-[11px] font-medium";
  if (!onClick) return <span className={cx(cls, "border-slate-200 bg-slate-50 text-slate-500")}>{label}</span>;
  return <button onClick={onClick} title={c.quote ? `“${c.quote}”` : "Open the source"} className={cx(cls, c.type === "clause" ? "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100" : "border-slate-300 bg-white text-slate-700 hover:border-accent hover:text-accent")}>{c.type === "clause" ? "§" : c.type === "email" ? "✉" : "▤"} {label}</button>;
}

// ── Live calls when an output is stale and a key is set (Part 7). Otherwise the rules fallback shows. ──
const inflight = new Set<string>();
async function post(path: string, body: unknown) {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  return { output: j.result, meta: { promptVersion: j.promptVersion, model: j.model } as AiMeta };
}
export function useLiveAi(reqId: string) {
  const state = useAva((s) => s.state); const ai = useAva((s) => s.aiAvailable); const addAi = useAva((s) => s.addAi);
  const fp = state.requests[reqId] ? fingerprint(state, reqId) : "";
  const ctx = state.requests[reqId] ? planContext(state, reqId) : "";
  useEffect(() => {
    if (!ai || !fp) return;
    const s = useAva.getState().state;
    const ctx = requestContext(s, reqId);
    const r = currentRead(s, reqId), p = currentPlan(s, reqId);
    const k1 = `${reqId}:read:${fp}`, k2 = `${reqId}:plan:${fp}:${ctx}`;
    if (r.v.source === "rules" && !inflight.has(k1)) { inflight.add(k1); post("/api/ava/read", ctx).then((o) => addAi(reqId, "read", "read", o.output, "live", o.meta)).catch(() => {}); }
    if ((p.v.source === "rules" || p.refresh) && !inflight.has(k2)) { inflight.add(k2); post("/api/ava/plan", ctx).then((o) => addAi(reqId, "plan", "plan", o.output, "live", o.meta)).catch(() => {}); }
    for (const c of Object.values(s.conflicts).filter((c) => c.requestId === reqId && c.status === "open" && !s.ai.recs[c.id])) {
      const k = `${c.id}:rec`; if (inflight.has(k)) continue; inflight.add(k);
      post("/api/ava/recommend", conflictContext(s, c.id)).then((o) => addAi(reqId, "rec", c.id, o.output, "live", o.meta)).catch(() => {});
    }
  }, [ai, fp, ctx, reqId, addAi]);
}

// ── 3.1 Ava's read ──
export function AvaRead({ reqId, compact }: { reqId: string; compact?: boolean }) {
  const state = useAva((s) => s.state);
  const [prev, setPrev] = useState(false);
  const { v, prev: p, stale } = currentRead(state, reqId);
  const list = state.ai.reads[reqId] ?? [];
  if (compact) return (
    <p className="text-[13.5px] leading-relaxed text-slate-800"><span className="mr-1.5 font-semibold text-accent-700">Ava’s read:</span>{v.output.sentences[0]?.text}{v.output.sentences[0]?.citations.slice(0, 2).map((c, i) => <CiteChip key={i} c={c} />)} <AiLabel source={v.source} meta={v} /></p>
  );
  return (
    <section data-pulse="ava-read" aria-label="Ava's read" className="rounded-xl border border-accent/25 bg-gradient-to-b from-accent-50/70 to-white px-4 py-3.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h2 className="text-[14px] font-semibold text-slate-900">Ava’s read</h2><AiLabel source={v.source} meta={v} /><EvalBadge issues={v.evalIssues} />
        {list.length > 1 && !stale && <span className="text-[12px] text-slate-500">Updated {fmtDT(v.at)} · <button className="text-accent underline" onClick={() => setPrev(!prev)}>{prev ? "hide previous" : "see previous"}</button></span>}
        {stale && <span className="text-[12px] text-amber-700">Facts changed since Ava’s last read ({fmtDT(list.at(-1)!.at)}). Showing a simulated summary from the facts.</span>}
      </div>
      <p className="max-w-[78ch] text-[14.5px] leading-[1.6] text-slate-900">{v.output.sentences.map((s, i) => <span key={i}>{s.text}{s.citations.map((c, j) => <CiteChip key={j} c={c} />)}{" "}</span>)}</p>
      {prev && p && <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600"><div className="mb-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">Previous read, {fmtDT(p.at)}</div>{p.output.sentences.map((s) => s.text).join(" ")}</div>}
    </section>
  );
}

// ── 3.2 Ava's plan ──
const ST_ICON: Record<string, [string, string]> = { done: ["✓", "bg-emerald-600 text-white"], in_progress: ["•", "bg-accent text-white"], blocked: ["!", "bg-red-600 text-white"], todo: ["", "border-2 border-slate-300 bg-white"] };
export function AvaPlan({ reqId }: { reqId: string }) {
  const state = useAva((s) => s.state);
  const { v, refresh } = currentPlan(state, reqId);
  const a = analyze(state, reqId);
  const plan = v.output; const crit = new Set(plan.criticalPath);
  const hit = predictionHit(state, reqId);
  const order = [...plan.steps].sort((x, y) => (x.status === "done" ? 1 : 0) - (y.status === "done" ? 1 : 0));
  const done = plan.steps.filter((s) => s.status === "done").length;
  // Finished steps fold away by default so the page shows what is still open.
  const [showDone, setShowDone] = useState(false);
  const shown = order.filter((s) => showDone || s.status !== "done" || done <= 2);
  return (
    <section data-pulse="plan" aria-label="Ava's plan" className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div><div className="flex items-center gap-2"><h2 className="text-[14px] font-semibold">Ava’s plan</h2><AiLabel source={v.source} meta={v} /><EvalBadge issues={v.evalIssues} /><span className="text-[12px] text-slate-500">{done} of {plan.steps.length} steps done</span>{refresh && <span role="status" className="text-[12px] text-amber-700">Re-planning after the latest approval or reply…</span>}</div>
          <p className="mt-0.5 text-[12px] text-slate-500">Policy steps come from the rules engine. Ava adds the rest. The rules engine still decides handoff.</p></div>
        <div className="max-w-sm text-right">
          {a.req.readyAt ? <><div className="text-[12px] text-slate-500">Ready</div><div className="text-[15px] font-semibold text-emerald-700">{fmtDT(a.req.readyAt)}</div>{hit && <div className="text-[12px] text-slate-600">{hit}</div>}</> :
            plan.predictedReady ? <><div className="text-[12px] text-slate-500">Predicted ready</div><div className="text-[15px] font-semibold">{plan.predictedReady}</div><div className="text-[12px] text-slate-600">{plan.predictionReason}</div></> : <div className="text-[12px] text-slate-500">{plan.predictionReason}</div>}
        </div>
      </header>
      {v.changes && v.changes.length > 0 && !a.req.readyAt && (
        <div className="border-b border-amber-100 bg-amber-50/60 px-4 py-2 text-[12.5px] text-amber-950"><span className="font-semibold">What changed in the plan ({fmtDT(v.at)}):</span> {v.changes.join(" · ")}</div>
      )}
      <ol className="px-4 py-2">
        {shown.map((s) => {
          const [ic, cls] = ST_ICON[s.status];
          return (
            <li key={s.id} className={cx("relative flex gap-3 border-l-2 py-2 pl-3", crit.has(s.id) && s.status !== "done" ? "border-accent" : "border-transparent")}>
              <span aria-label={s.status.replace("_", " ")} className={cx("mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold", cls)}>{ic}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cx("text-[13.5px] font-medium", s.status === "done" ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900")}>{s.title}</span>
                  {s.source === "policy" ? <span className="rounded bg-blue-100 px-1.5 text-[10.5px] font-semibold text-blue-800">Required by policy</span> : <span className="rounded bg-violet-100 px-1.5 text-[10.5px] font-semibold text-violet-800">Added by Ava</span>}
                  {crit.has(s.id) && s.status !== "done" && <span className="text-[10.5px] font-semibold uppercase tracking-wide text-accent-700">Critical path</span>}
                  {s.status === "blocked" && <span className="text-[11.5px] font-semibold text-red-700">{s.id === "handoff" ? "Blocked" : "Reopened"}</span>}
                </div>
                <div className="text-[12px] text-slate-500">{ownerName(s.ownerId, state)}{s.eta && s.status !== "done" ? ` · by ${s.eta}` : ""}{s.reason ? ` · ${s.reason}` : ""}</div>
              </div>
            </li>
          );
        })}
      </ol>
      {done > 2 && <button onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="w-full border-t border-slate-100 px-4 py-2 text-left text-[12.5px] font-medium text-accent hover:bg-slate-50">{showDone ? "Hide finished steps" : `Show ${done} finished steps`}</button>}
    </section>
  );
}

// ── 3.4 Ava recommends ──
export function recFallback(state: State, key: string): Versioned<AiRec> | undefined {
  if (state.ai.recs[key]) return state.ai.recs[key];
  if (state.conflicts[key]) return currentRec(state, key);
  return undefined;
}
export function AvaRecommends({ recKey, requestId, readOnly }: { recKey: string; requestId: string; readOnly?: boolean }) {
  const state = useAva((s) => s.state); const act = useAva((s) => s.act);
  const [mode, setMode] = useState<null | "edit" | "dismiss">(null);
  const [text, setText] = useState("");
  const v = recFallback(state, recKey); if (!v) return null;
  const r = v.output;
  // The plain "review it" stub has nothing to use, dismiss or edit. Say so quietly instead of showing a primary button.
  if (v.source === "rules" && r.action === "review") return <p aria-label="No recommendation from Ava" className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[12.5px] text-slate-600">Ava has no advice for this kind of conflict in the simulation. Compare both sources and decide.</p>;
  const done = v.used ? `Used by ${ownerName(v.used.by, state)}, ${fmtDT(v.used.at)}` : v.dismissed ? `Dismissed by ${ownerName(v.dismissed.by, state)}: ${v.dismissed.reason}` : null;
  const conf = r.confidence === "high" ? "bg-emerald-100 text-emerald-800" : r.confidence === "medium" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700";
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3.5 py-3" aria-label="Ava recommends">
      <div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-[12px] font-semibold uppercase tracking-wide text-violet-900">Ava recommends</span><span className={cx("rounded px-1.5 text-[10.5px] font-semibold", conf)}>{r.confidence} confidence</span><AiLabel source={v.source} meta={v} /><EvalBadge issues={v.evalIssues} /></div>
      {r.bullets ? <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-slate-900">{r.bullets.map((b) => <li key={b}>{b}</li>)}</ul> : <p className="text-[13.5px] font-medium text-slate-900">{r.recommendation}</p>}
      {!r.bullets && <p className="mt-0.5 text-[12.5px] text-slate-700">{r.reasoning}{r.citations.map((c, i) => <CiteChip key={i} c={c} />)}</p>}
      {r.draft && !v.used && mode !== "edit" && <details className="mt-1.5 text-[12.5px]"><summary className="cursor-pointer text-violet-900">{r.action === "ask_requester" ? "See the question" : "See the ready draft"}</summary><pre className="mt-1 whitespace-pre-wrap rounded border border-violet-100 bg-white px-2.5 py-2 font-sans text-[12.5px] text-slate-800">{r.draft}</pre></details>}
      {done ? <p className="mt-1.5 text-[12px] text-slate-600">{done}</p> : !readOnly && !r.bullets && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button small variant="primary" onClick={() => act({ type: "rec_use", recKey, requestId })}>{r.action === "draft_supplier" ? "Use this draft" : r.action === "ask_requester" ? "Ask with one click" : "Use this"}</Button>
          {r.draft && <Button small onClick={() => { setMode("edit"); setText(r.draft!); }}>Edit</Button>}
          <Button small variant="ghost" onClick={() => { setMode("dismiss"); setText(""); }}>Dismiss with a reason</Button>
        </div>
      )}
      {mode && <form className="mt-2 space-y-1.5" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; act(mode === "edit" ? { type: "rec_use", recKey, requestId, draft: text } : { type: "rec_dismiss", recKey, requestId, reason: text }); setMode(null); }}>
        {mode === "edit" ? <textarea aria-label="Edit the draft" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full rounded border border-slate-300 px-2 py-1.5 text-[13px]" /> : <input aria-label="Reason" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Why not?" className="w-full rounded border border-slate-300 px-2 py-1 text-[13px]" />}
        <div className="flex gap-1.5"><Button small variant="primary" type="submit">{mode === "edit" ? "Use edited draft" : "Dismiss"}</Button><Button small variant="ghost" onClick={() => setMode(null)}>Cancel</Button></div>
      </form>}
    </div>
  );
}

// ── 3.3 Ava did ──
export function AvaDid({ req }: { req: Request }) {
  const { ava, people } = actionsOf(req);
  return (
    <details className="rounded-xl border border-slate-200 bg-white" aria-label="Ava did">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-[14px] font-semibold">Ava did {ava.length} things <span className="text-[12.5px] font-normal text-slate-500">· people made {people.length} decisions · newest first</span></summary>
      <ol className="max-h-[420px] space-y-1 overflow-auto border-t border-slate-100 px-4 py-3 text-[12.5px]">
        {[...req.timeline].reverse().map((t, i) => (
          <li key={i} className="flex gap-3"><span className="w-[92px] shrink-0 tabular-nums text-slate-500">{fmtDT(t.at)}</span>
            <span className={cx("shrink-0 rounded px-1.5 text-[10.5px] font-semibold leading-[18px]", t.actor && t.actor !== "ava" && t.actor !== "system" ? "bg-slate-200 text-slate-700" : "bg-violet-100 text-violet-800")}>{t.actor && t.actor !== "ava" && t.actor !== "system" ? ownerName(t.actor, useAva.getState().state).split(" ")[0] : "Ava"}</span>
            <span className="min-w-0 text-slate-800 [overflow-wrap:anywhere]">{t.text}</span></li>
        ))}
      </ol>
    </details>
  );
}
export function ActsBanner({ req }: { req: Request }) {
  const { ava, people } = actionsOf(req);
  return <span>Ava did {ava.length} actions; people made {people.length} decisions.</span>;
}

// ── What the contract says about this deal ──
export function ContractCard({ a }: { a: Analysis }) {
  const state = useAva((s) => s.state); const open = useAva((s) => s.openSource);
  const conf = Object.values(state.conflicts).filter((c) => c.requestId === a.req.id && c.clauses?.length);
  const ids: string[] = [];
  const push = (x?: string) => { if (x && !ids.includes(x)) ids.push(x); };
  conf.forEach((c) => push(c.clauses![0]));
  a.contractClauses.filter((x) => / (8\.1|9\.1|12\.1)$/.test(x)).forEach(push);
  a.contractClauses.forEach(push);
  conf.forEach((c) => c.clauses!.forEach(push));
  a.checks.forEach((k) => push(`${k.docId} ${k.clause}`));
  const list = ids.slice(0, 5).map((id) => { const i = id.lastIndexOf(" "); const docId = id.slice(0, i), clause = id.slice(i + 1); return { id, docId, clause, c: clauseOf(docId, clause) }; }).filter((x) => x.c);
  if (!list.length) return null;
  return (
    <section data-pulse="contract" aria-label="What the contract says" className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3"><h2 className="text-[14px] font-semibold">What the contract says about this deal</h2><p className="text-[12px] text-slate-500">The clauses that matter here. Ava checked every email against them; code computed every amount.</p></header>
      <ul className="divide-y divide-slate-100">
        {list.map(({ id, docId, clause, c }) => {
          const ks = a.checks.filter((k) => k.docId === docId && k.clause === clause);
          const against = ks.some((k) => k.status === "conflict");
          const bad = against && conf.some((x) => x.status === "open" && x.clauses!.includes(id));
          const handled = against && !bad;
          const ok = ks.length > 0 && !against;
          return (
            <li key={id} className="flex gap-3 px-4 py-2.5 text-[13px]">
              <button onClick={() => open({ emailId: "", file: id, docId, clause, quote: "" })} className="w-[112px] shrink-0 text-left font-mono text-[12px] font-semibold text-blue-800 underline decoration-blue-200 underline-offset-2">{shortDoc(docId)} {clause}</button>
              <div className="min-w-0"><span className="font-medium">{c!.title}.</span> <span className="text-slate-700">{c!.text}</span>
                {ks.length > 0 && <div className={cx("mt-0.5 text-[12px]", against ? "text-red-700" : "text-emerald-700")}>{against ? "✗ " : "✓ "}{(against ? ks.filter((k) => k.status === "conflict") : ks).map((k) => k.text).slice(0, 2).join(" ")}</div>}
                {!ks.length && <div className="mt-0.5 text-[12px] text-slate-500">Applies to this deal.</div>}
              </div>
              <span className="ml-auto shrink-0">{bad ? <Chip tone="red">Goes against</Chip> : handled ? <Chip tone="amber">Raised, handled</Chip> : ok ? <Chip tone="green">Checked</Chip> : null}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Contract checks for one email (Captured mail panel). */
export function EmailChecks({ a, emailId }: { a: Analysis; emailId: string }) {
  const ks = a.checks.filter((k) => k.emailId === emailId);
  const open = useAva((s) => s.openSource);
  if (!ks.length) return null;
  return (
    <ul className="space-y-1 text-[12.5px]">
      {ks.map((k) => <li key={k.id} className="flex gap-2"><span className={cx("font-bold", k.status === "conflict" ? "text-red-600" : k.status === "note" ? "text-slate-500" : "text-emerald-600")}>{k.status === "conflict" ? "✗" : k.status === "note" ? "•" : "✓"}</span>
        <span><button className="font-mono text-[11.5px] font-semibold text-blue-800 underline decoration-blue-200" onClick={() => open({ emailId: "", file: k.docId, docId: k.docId, clause: k.clause, quote: "" })}>{shortDoc(k.docId)} {k.clause}</button> {k.status === "consistent" ? "consistent. " : k.status === "conflict" ? "goes against the contract. " : ""}{k.text}</span></li>)}
    </ul>
  );
}
