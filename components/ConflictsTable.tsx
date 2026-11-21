"use client";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { personName } from "@/lib/engine/world";
import { fmtShort, hoursBetween } from "@/lib/format";
import { CONFLICT_TYPE } from "./ConflictCard";
import { Card, Empty, StateChip } from "./ui";

export function ConflictsTable() {
  const state = useAva((s) => s.state);
  const list = Object.values(state.conflicts).sort((a, b) => (a.status === b.status ? b.openedAt.localeCompare(a.openedAt) : a.status === "open" ? -1 : 1));
  if (!list.length) return <Empty>No conflicts yet.</Empty>;
  return (
    <Card>
      <div className="overflow-x-auto"><table className="w-full text-[13px]">
        <thead><tr className="border-b border-slate-100 text-left text-[12px] text-slate-500"><th className="px-4 py-2 font-medium">Conflict</th><th className="px-2 py-2 font-medium">Type</th><th className="px-2 py-2 font-medium">Request</th><th className="px-2 py-2 font-medium">Owner</th><th className="px-2 py-2 font-medium">Severity</th><th className="px-2 py-2 font-medium">Status</th><th className="px-2 py-2 font-medium">Age</th></tr></thead>
        <tbody>{list.map((c) => (
          <tr key={c.id} className="border-b border-slate-50">
            <td className="px-4 py-2"><Link className="font-medium text-accent hover:underline" href={`/requests/${c.requestId}#conflicts`}>{c.title}</Link></td>
            <td className="px-2 py-2">{CONFLICT_TYPE[c.type]}</td><td className="px-2 py-2">{c.requestId}</td><td className="px-2 py-2">{personName(c.ownerId)}</td>
            <td className="px-2 py-2"><StateChip state={c.severity} /></td><td className="px-2 py-2"><StateChip state={c.status} /></td>
            <td className="px-2 py-2 tabular text-slate-600">{Math.round(hoursBetween(c.openedAt, c.resolvedAt ?? state.now))}h{c.resolvedAt ? ` (closed ${fmtShort(c.resolvedAt)})` : ""}</td>
          </tr>))}</tbody>
      </table></div>
    </Card>
  );
}
