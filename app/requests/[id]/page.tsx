"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAva } from "@/lib/store";
import { analyze, type Analysis } from "@/lib/engine/rules";
import { personName } from "@/lib/engine/world";
import { timingFor } from "@/lib/engine/timing";
import { fmtDT, lakh } from "@/lib/format";
import { ApprovalsView, ChecklistView, DocumentsPanel, DraftBox, FactsTable, HandoffPacket, RoutingPanel, TimelineView } from "@/components/request";
import ConflictCard from "@/components/ConflictCard";
import { Card, CardHead, Chip, cx, Empty, StateChip } from "@/components/ui";
import { Icon } from "@/components/icons";

type Tab = "overview" | "facts" | "checks" | "documents" | "timeline" | "packet";
const HASH_TAB: Record<string, Tab> = { routing: "overview", conflicts: "overview", approvals: "checks", checklist: "checks", documents: "documents", timeline: "timeline", packet: "packet", facts: "facts" };

type StageState = "done" | "current" | "blocked" | "todo";
function stages(a: Analysis) {
  const req = a.requiredFacts.map((k) => a.facts[k]);
  const factsOk = req.filter((f) => f.displayState === "confirmed").length;
  const checks = a.checklist.filter((c) => !["budget", "vp"].includes(c.key));
  const checksOk = checks.filter((c) => ["done", "excepted", "legal_review"].includes(c.status)).length;
  const apOk = a.approvals.filter((x) => x.status === "approved" || x.status === "reconfirmed").length;
  const stale = a.approvals.some((x) => x.status === "needs_reconfirmation");
  const contradicted = req.some((f) => f.displayState === "contradicted");
  const ready = a.handoff.state === "ready_legal" || a.handoff.state === "ready_po";
  const s: { label: string; detail: string; state: StageState; tab: Tab }[] = [
    { label: "Captured", detail: `${a.req.emailIds.length} email${a.req.emailIds.length === 1 ? "" : "s"}`, state: "done", tab: "timeline" },
    { label: "Facts", detail: `${factsOk} of ${req.length} confirmed`, state: contradicted ? "blocked" : factsOk === req.length ? "done" : "todo", tab: "facts" },
    { label: "Checks", detail: `${checksOk} of ${checks.length} closed`, state: checksOk === checks.length ? "done" : "todo", tab: "checks" },
    { label: "Approvals", detail: stale ? "Reopened by a change" : `${apOk} of ${a.approvals.length} signed`, state: stale ? "blocked" : apOk === a.approvals.length ? "done" : "todo", tab: "checks" },
    { label: a.routing.endState === "legal" ? "Legal Review" : "Issue PO", detail: ready ? "Handed off" : a.handoff.state === "blocked" ? "Blocked" : "Not yet", state: ready ? "done" : a.handoff.state === "blocked" ? "blocked" : "todo", tab: ready ? "packet" : "overview" },
  ];
  const firstOpen = s.findIndex((x) => x.state !== "done");
  if (firstOpen >= 0 && s[firstOpen].state === "todo") s[firstOpen].state = "current";
  return s;
}

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAva((s) => s.state);
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    const sync = () => { const h = window.location.hash.slice(1); if (HASH_TAB[h]) setTab(HASH_TAB[h]); };
    sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync);
  }, [id]);
  const req = state.requests[id];
  if (!req) return <Empty>Request {id} does not exist in this session yet. <Link className="text-accent underline" href="/requests">See all requests</Link></Empty>;
  const a = analyze(state, id);
  const sup = state.suppliers.find((s) => s.id === req.supplierId);
  const conflicts = Object.values(state.conflicts).filter((c) => c.requestId === id).sort((x, y) => (x.status === y.status ? y.openedAt.localeCompare(x.openedAt) : x.status === "open" ? -1 : 1));
  const openConf = conflicts.filter((c) => c.status === "open");
  const drafts = state.drafts.filter((d) => d.requestId === id && !d.conflictId);
  const t = timingFor(state, id);
  const ready = a.handoff.state === "ready_legal" || a.handoff.state === "ready_po";
  const st = stages(a);
  const TABS: { k: Tab; label: string; badge?: number }[] = [
    { k: "overview", label: "Overview", badge: openConf.length || undefined }, { k: "facts", label: "Facts" }, { k: "checks", label: "Checks and approvals", badge: a.approvals.filter((x) => x.status === "needs_reconfirmation").length || undefined },
    { k: "documents", label: "Documents" }, { k: "timeline", label: "Timeline" }, ...(ready ? [{ k: "packet" as Tab, label: "Handoff packet" }] : []),
  ];
  return (
    <div className="space-y-5">
      <header>
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-slate-500"><Link href="/requests" className="hover:underline">Requests</Link> › {sup ? <Link className="hover:underline" href={`/suppliers/${sup.id}`}>{sup.name}</Link> : `Possible new supplier: ${req.supplierGuess?.name}`} › {req.project}</nav>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5"><h1 className="text-[22px] font-semibold tracking-[-0.01em]"><span className="font-mono text-slate-500">{req.id}</span> {req.title}</h1><StateChip state={a.handoff.state} />{req.startedBeforeApproval && <Chip tone="red">Started before approval</Chip>}</div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3 lg:grid-cols-6">
          {[["Value (before GST)", lakh(a.requestAmount)], ["90-day total", lakh(a.spend.total)], ["Requester", personName(req.requesterId)], ["Cost centre", req.costCentre], ["Owner", `${personName("karan")} (Procurement)`], ["First email", fmtDT(t.firstAt)]].map(([k, v]) => (
            <div key={k}><dt className="text-[11.5px] text-slate-500">{k}</dt><dd className={cx("font-medium", k === "90-day total" && a.spend.overLimit && "text-red-700", (k.startsWith("Value") || k.startsWith("90")) && "font-mono")}>{v}</dd></div>
          ))}
        </dl>
      </header>

      {/* Progress through intake */}
      <ol aria-label="Intake progress" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {st.map((s, i) => (
          <li key={s.label}><button onClick={() => setTab(s.tab)} className={cx("flex w-full items-start gap-2.5 rounded-lg border bg-white p-3 text-left", s.state === "blocked" ? "border-red-300 bg-red-50/50" : s.state === "current" ? "border-accent" : "border-slate-200")}>
            <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", s.state === "done" ? "bg-emerald-600 text-white" : s.state === "blocked" ? "bg-red-600 text-white" : s.state === "current" ? "bg-accent text-white" : "bg-slate-200 text-slate-600")}>
              {s.state === "done" ? <Icon name="check" size={13} strokeWidth={3} /> : s.state === "blocked" ? "!" : i + 1}
            </span>
            <span className="leading-tight"><span className="block text-[13.5px] font-semibold">{s.label}</span><span className={cx("block text-[12px]", s.state === "blocked" ? "text-red-700" : "text-slate-500")}>{s.detail}</span></span>
          </button></li>
        ))}
      </ol>

      {/* One clear status line: what is happening and who acts next */}
      {a.handoff.banner ? (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3">
          <p className="text-[15px] font-semibold text-red-800">{a.handoff.banner}</p>
          <p className="mt-0.5 text-[13px] text-red-800">{a.handoff.reasons.filter((r) => /reconfirmation|conflict/i.test(r)).join(" · ")}</p>
        </div>
      ) : ready ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
          <p className="text-[15px] font-semibold">{a.handoff.state === "ready_legal" ? "Ready for Legal Review" : "Ready to issue PO"} since {fmtDT(req.readyAt!)}.</p>
          <p className="text-[13px]">Took {t.days} business day{t.days === 1 ? "" : "s"} against a 1-day target.{t.longest && ` Longest wait: ${t.longest}.`}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Icon name="clock" className="text-amber-700" />
          <p className="text-[14px] font-semibold text-amber-900">Next: {a.waitingOn ?? "more information"}</p>
          <p className="text-[13px] text-amber-900">Still open: {a.handoff.reasons.slice(0, 3).join(" · ")}{a.handoff.reasons.length > 3 ? ` · and ${a.handoff.reasons.length - 3} more` : ""}</p>
        </div>
      )}

      <div role="tablist" aria-label="Request sections" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((x) => (
          <button key={x.k} role="tab" aria-selected={tab === x.k} onClick={() => { setTab(x.k); history.replaceState(null, "", `#${x.k === "checks" ? "approvals" : x.k}`); }} className={cx("-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px]", tab === x.k ? "border-accent font-semibold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900")}>
            {x.label}{x.badge ? <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{x.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-5">
            {openConf.length > 0 ? <section id="conflicts" className="space-y-3"><h2 className="text-[15px] font-semibold">Open conflicts · Ava never picks a side</h2>{openConf.map((c) => <ConflictCard key={c.id} c={c} />)}</section>
              : <Card><CardHead title="No open conflicts" sub="Every source agrees. Resolved conflicts are in the Timeline." /></Card>}
            <ApprovalsView a={a} />
            {drafts.length > 0 && <Card><CardHead title="Drafts for the requester" sub="Ava never emails suppliers. The requester reviews and sends." /><div className="space-y-2 p-3">{drafts.map((d) => <DraftBox key={d.id} d={d} />)}</div></Card>}
            {conflicts.filter((c) => c.status === "resolved").length > 0 && <details className="rounded-lg border border-slate-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-[13.5px] font-medium">Resolved conflicts ({conflicts.filter((c) => c.status === "resolved").length})</summary><div className="space-y-3 p-3">{conflicts.filter((c) => c.status === "resolved").map((c) => <ConflictCard key={c.id} c={c} />)}</div></details>}
          </div>
          <RoutingPanel a={a} />
        </div>
      )}
      {tab === "facts" && <FactsTable a={a} />}
      {tab === "checks" && <div className="grid gap-5 xl:grid-cols-2"><ApprovalsView a={a} /><ChecklistView a={a} /></div>}
      {tab === "documents" && <DocumentsPanel a={a} state={state} />}
      {tab === "timeline" && <TimelineView a={a} />}
      {tab === "packet" && ready && <HandoffPacket a={a} state={state} />}
    </div>
  );
}
