"use client";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { contractsFor } from "@/lib/engine/world";
import { Card, Chip, PageTitle } from "@/components/ui";

export default function SuppliersPage() {
  const state = useAva((s) => s.state);
  return (
    <div>
      <PageTitle title="Suppliers" sub="The supplier list Ava matches email domains against." />
      <div className="grid gap-3 md:grid-cols-3">
        {state.suppliers.map((s) => { const reqs = Object.values(state.requests).filter((r) => r.supplierId === s.id); return (
          <Link key={s.id} href={`/suppliers/${s.id}`}><Card className="h-full p-4 hover:border-accent">
            <div className="flex items-start justify-between gap-2"><div className="font-semibold">{s.name}</div>{s.known ? <Chip tone="green">In supplier list</Chip> : <Chip tone="amber">Not in supplier list</Chip>}</div>
            <div className="text-[12.5px] text-slate-600">{s.category}{s.city ? `, ${s.city}` : ""} · {s.domain}</div>
            <div className="mt-2 text-[12.5px] text-slate-600">{reqs.length} request(s) · {contractsFor(s.id).length} agreements and records on file</div>
          </Card></Link>); })}
      </div>
    </div>
  );
}
