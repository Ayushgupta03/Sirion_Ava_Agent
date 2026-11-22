"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAva } from "@/lib/store";
import { analyze } from "@/lib/engine/rules";
import { personName } from "@/lib/engine/world";
import { BACKGROUND, bgState, bgTotal90 } from "@/lib/background";
import { scenarioTag } from "@/lib/summary";
import { hoursBetween, lakh, opened, span } from "@/lib/format";
import { Card, Chip, cx, Empty, PageTitle, StateChip, supplierShort } from "@/components/ui";
import Board from "@/components/Board";

type Row = { id: string; live: boolean; supplier: string; supplierId?: string; title: string; requester: string; cc: string; value?: number; total?: number; routes: string[]; state: string; waiting: string; age: string; conflicts: number; tag: string };

export default function RequestsPage() { return <Suspense><Requests /></Suspense>; }

function Requests() {
  const state = useAva((s) => s.state);
  const sp = useSearchParams();
  const [filter, setFilter] = useState<"all" | "conflict">(sp.get("filter") === "conflict" ? "conflict" : "all");
  const [group, setGroup] = useState<"list" | "supplier">("list");
  const [view, setView] = useState<"table" | "board">("table");
  const live: Row[] = [...state.requestOrder].reverse().map((id) => {
    const a = analyze(state, id); const r = state.requests[id]; const sup = state.suppliers.find((s) => s.id === r.supplierId);
    return { id, live: true, supplier: supplierShort(sup?.name ?? r.supplierGuess?.name), supplierId: sup?.id, title: r.title, requester: personName(r.requesterId), cc: r.costCentre, value: a.requestAmount, total: a.spend.total,
      routes: a.routing.approvals.map((x) => x.key === "budget_owner" ? "Budget" : x.key === "vp" ? "VP" : "InfoSec"), state: a.handoff.state, waiting: a.waitingOn ?? "—",
      age: opened(hoursBetween(r.createdAt, r.readyAt ?? state.now)), conflicts: Object.values(state.conflicts).filter((c) => c.requestId === id && c.status === "open").length, tag: scenarioTag(state, id) };
  });
  const bg: Row[] = BACKGROUND.map((b) => ({ id: b.id, live: false, supplier: b.supplier, title: b.project, requester: b.requester, cc: b.dept, value: b.amount, total: bgTotal90(b, state.now), routes: ["Budget", ...b.routes], state: bgState(b), waiting: b.waitingOn, age: opened(hoursBetween(b.createdAt, state.now)), conflicts: b.conflict ? 1 : 0, tag: "Background" }));
  const rows = [...live, ...bg].filter((r) => filter === "all" || r.conflicts > 0);
  const groups = group === "supplier" ? [...new Set(rows.map((r) => r.supplier))].sort().map((s) => ({ name: s, id: rows.find((r) => r.supplier === s)?.supplierId, rows: rows.filter((r) => r.supplier === s) })) : [{ name: "", id: undefined, rows }];
  const openCount = [...live, ...bg].filter((r) => r.conflicts > 0).length;
  return (
    <div>
      <PageTitle title="Requests" sub="Every request Ava built from email." />
      <div className="mb-3 flex rounded-md bg-slate-100 p-0.5 text-[13px] w-fit" role="tablist" aria-label="View">
        {([["table", "Table"], ["board", "Board"]] as const).map(([v, l]) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cx("rounded px-3 py-1", view === v ? "bg-white font-semibold shadow-sm" : "text-slate-600")}>{l}</button>)}
      </div>
      {view === "board" ? <Board /> : <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Filter" className="flex rounded-md bg-slate-100 p-0.5 text-[13px]">
          <button role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")} className={cx("rounded px-3 py-1", filter === "all" ? "bg-white font-semibold shadow-sm" : "text-slate-600")}>All ({live.length + bg.length})</button>
          <button role="tab" aria-selected={filter === "conflict"} onClick={() => setFilter("conflict")} className={cx("rounded px-3 py-1", filter === "conflict" ? "bg-white font-semibold shadow-sm" : "text-slate-600")}>Has open conflict ({openCount})</button>
        </div>
        <div role="tablist" aria-label="Group" className="flex rounded-md bg-slate-100 p-0.5 text-[13px]">
          <button role="tab" aria-selected={group === "list"} onClick={() => setGroup("list")} className={cx("rounded px-3 py-1", group === "list" ? "bg-white font-semibold shadow-sm" : "text-slate-600")}>List</button>
          <button role="tab" aria-selected={group === "supplier"} onClick={() => setGroup("supplier")} className={cx("rounded px-3 py-1", group === "supplier" ? "bg-white font-semibold shadow-sm" : "text-slate-600")}>By supplier</button>
        </div>
        {filter === "conflict" && <Link href="/conflicts" className="text-[13px] font-medium text-accent hover:underline">Open every conflict card →</Link>}
      </div>
      {rows.length === 0 ? <Empty>No requests match.</Empty> : groups.map((g) => (
        <div key={g.name || "all"} className="mb-5">
          {g.name && <h2 className="mb-2 text-[15px] font-semibold">{g.id ? <Link href={`/suppliers/${g.id}`} className="hover:underline">{g.name}</Link> : g.name} <span className="font-normal text-slate-500">· {g.rows.length}</span></h2>}
          <Card><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-[13px]">
            <thead><tr className="border-b border-slate-100 text-left text-[12px] text-slate-500">{["Request", "Supplier › Project", "Requester", "Value", "90-day total", "Routing", "Status", "Waiting on", "Opened"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{g.rows.map((r) => (
              <tr key={r.id} className={cx("border-b border-slate-50 align-top", !r.live && "text-slate-500")}>
                <td className="whitespace-nowrap px-3 py-2"><Link className={cx("font-medium hover:underline", r.live ? "text-accent" : "text-slate-600")} href={`/requests/${r.id}`} title={r.live ? undefined : "Background request, not part of the guided demo"}>{r.id}</Link><div className="mt-0.5"><Chip tone={r.live ? "blue" : "grey"}>{r.tag}</Chip></div></td>
                <td className="px-3 py-2">{r.supplierId ? <Link href={`/suppliers/${r.supplierId}`} className="hover:underline">{r.supplier}</Link> : r.supplier} › {r.title}{r.conflicts > 0 && <div className="text-[12px] text-red-700">{r.conflicts} open conflict{r.conflicts > 1 ? "s" : ""}</div>}</td>
                <td className="px-3 py-2">{r.requester}<div className="text-[12px] text-slate-500">{r.cc}</div></td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">{lakh(r.value)}</td><td className="whitespace-nowrap px-3 py-2 font-mono">{r.total != null ? lakh(r.total) : "—"}</td>
                <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{r.routes.map((x) => <Chip key={x} tone="grey">{x}</Chip>)}</div></td>
                <td className="px-3 py-2"><StateChip state={r.state} /></td><td className="px-3 py-2">{r.waiting}</td><td className="whitespace-nowrap px-3 py-2">{r.age}</td>
              </tr>))}</tbody></table></div></Card>
        </div>
      ))}
      <p className="text-[12px] text-slate-500">Background requests are other teams&apos; work in the same week. They are not part of the guided demo.</p>
      </>}
    </div>
  );
}
