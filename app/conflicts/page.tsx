"use client";
import { useState } from "react";
import { useAva } from "@/lib/store";
import ConflictCard from "@/components/ConflictCard";
import { ConflictsTable } from "@/components/ConflictsTable";
import { Card, Chip, PageTitle, cx } from "@/components/ui";
import { BG_CONFLICTS } from "@/lib/background";
import { AiLabel, CiteChip } from "@/components/ai";

export default function ConflictsPage() {
  const state = useAva((s) => s.state);
  const [show, setShow] = useState<"open" | "all">("open");
  const list = Object.values(state.conflicts).filter((c) => show === "all" || c.status === "open").sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  return (
    <div className="space-y-5">
      <PageTitle title="Conflicts" sub="Every place two sources disagree. Ava never picks a side." />
      <ConflictsTable />
      <div role="tablist" className="flex gap-1">{(["open", "all"] as const).map((k) => <button key={k} role="tab" aria-selected={show === k} onClick={() => setShow(k)} className={cx("rounded-md px-3 py-1.5 text-[13px]", show === k ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600 hover:bg-slate-100")}>{k === "open" ? "Open cards" : "All cards"}</button>)}</div>
      <div className="space-y-4">{list.map((c) => <ConflictCard key={c.id} c={c} showRequest />)}
        {BG_CONFLICTS.map(({ req, c }) => (
          <Card key={req.id} id={req.id} className="border-red-300">
            <div className="space-y-2.5 px-4 py-3 text-[13px]">
              <div className="flex flex-wrap items-center gap-1.5"><Chip tone="blue">{c.type === "started_before_approval" ? "Started before approval" : "Goes against the contract"}</Chip><Chip>Background</Chip><span className="text-[12.5px] text-slate-600">{req.id} · {req.supplier} › {req.project}</span></div>
              <h3 className="text-[14.5px] font-semibold">{c.title}</h3>{c.impactText && <p className="text-[12.5px] font-medium text-red-800">Impact: {c.impactText}</p>}
              <div className="grid gap-3 md:grid-cols-2">{[c.a, c.b].map((s, i) => <div key={i}><div className="mb-1 text-[12.5px] font-semibold">{s.label}</div><div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">“{s.quote}”{s.clause && <CiteChip c={{ type: "clause", id: s.clause }} />}</div></div>)}</div>
              <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3.5 py-3"><div className="mb-1 flex items-center gap-2"><span className="text-[12px] font-semibold uppercase tracking-wide text-violet-900">Ava recommends</span><span className="rounded bg-emerald-100 px-1.5 text-[10.5px] font-semibold text-emerald-800">{c.rec.confidence} confidence</span><AiLabel source="cached" /></div><p className="text-[13.5px] font-medium">{c.rec.recommendation}</p><p className="text-[12.5px] text-slate-700">{c.rec.reasoning}</p></div>
              <p className="text-[12px] text-slate-500">Background request from another team; its actions are outside the guided demo.</p>
            </div>
          </Card>))}
      </div>
    </div>
  );
}
