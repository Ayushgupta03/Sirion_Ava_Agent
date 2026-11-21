"use client";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { analyze } from "@/lib/engine/rules";
import { personName } from "@/lib/engine/world";
import { fmtShort, lakh } from "@/lib/format";
import { Card, Chip, Empty, PageTitle, StateChip } from "@/components/ui";

export default function RequestsPage() {
  const state = useAva((s) => s.state);
  const ids = [...state.requestOrder].reverse();
  return (
    <div>
      <PageTitle title="Requests" sub="Every request Ava opened from supplier email. Procurement (Karan Shah) owns each one until handoff." />
      {!ids.length ? <Empty>No requests yet. Press Start in the story bar, or send an email from the Inbox.</Empty> : (
        <Card><div className="overflow-x-auto"><table className="w-full text-[13px]">
          <thead><tr className="border-b border-slate-100 text-left text-[12px] text-slate-500">{["Request", "Supplier › Project", "Requester", "Value", "90-day total", "Routing", "Status", "Waiting on", "Opened"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{ids.map((id) => { const a = analyze(state, id); const r = state.requests[id]; const sup = state.suppliers.find((s) => s.id === r.supplierId); return (
            <tr key={id} className="border-b border-slate-50 align-top">
              <td className="px-3 py-2"><Link className="font-medium text-accent hover:underline" href={`/requests/${id}`}>{id}</Link><div className="text-slate-600">{r.title}</div></td>
              <td className="px-3 py-2">{sup?.name ?? `New: ${r.supplierGuess?.name}`} › {r.project}<div className="text-[12px] text-slate-500">filing confidence {r.filing.confidence}</div></td>
              <td className="px-3 py-2">{personName(r.requesterId)}<div className="text-[12px] text-slate-500">{r.costCentre}</div></td>
              <td className="px-3 py-2 tabular">{lakh(a.requestAmount)}</td><td className="px-3 py-2 tabular">{lakh(a.spend.total)}</td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{a.routing.approvals.map((x) => <Chip key={x.key} tone="blue">{x.key === "budget_owner" ? "Budget" : x.key === "vp" ? "VP" : "InfoSec"}</Chip>)}</div></td>
              <td className="px-3 py-2"><StateChip state={a.handoff.state} /></td><td className="px-3 py-2 text-slate-600">{a.waitingOn ?? "—"}</td><td className="px-3 py-2 text-slate-500">{fmtShort(r.createdAt)}</td>
            </tr>); })}</tbody></table></div></Card>
      )}
    </div>
  );
}
