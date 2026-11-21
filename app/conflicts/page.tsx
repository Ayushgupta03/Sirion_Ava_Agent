"use client";
import { useState } from "react";
import { useAva } from "@/lib/store";
import ConflictCard from "@/components/ConflictCard";
import { ConflictsTable } from "@/components/ConflictsTable";
import { PageTitle, cx } from "@/components/ui";

export default function ConflictsPage() {
  const state = useAva((s) => s.state);
  const [show, setShow] = useState<"open" | "all">("open");
  const list = Object.values(state.conflicts).filter((c) => show === "all" || c.status === "open").sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  return (
    <div className="space-y-5">
      <PageTitle title="Conflicts" sub="Ava never silently picks between conflicting sources. Every conflict uses the same card: what conflicts, why it matters, who resolves it, what is blocked, and the actions." />
      <ConflictsTable />
      <div role="tablist" className="flex gap-1">{(["open", "all"] as const).map((k) => <button key={k} role="tab" aria-selected={show === k} onClick={() => setShow(k)} className={cx("rounded-md px-3 py-1.5 text-[13px]", show === k ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600 hover:bg-slate-100")}>{k === "open" ? "Open cards" : "All cards"}</button>)}</div>
      <div className="space-y-4">{list.map((c) => <ConflictCard key={c.id} c={c} showRequest />)}</div>
    </div>
  );
}
