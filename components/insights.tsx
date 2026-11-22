"use client";
// Dashboard cards that measure Ava herself: whether people take her advice (N6) and whether her dates hold (N7).
import Link from "next/link";
import { useAva } from "@/lib/store";
import { adviceOutcomes, predictionAccuracy } from "@/lib/insights";
import { personName } from "@/lib/engine/world";
import { fmtDay } from "@/lib/format";
import { Card, CardHead, Empty } from "./ui";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const bd = (n: number) => (n === 0 ? "on the day" : `${n} business day${n === 1 ? "" : "s"} off`);

export function AdviceCard() {
  const state = useAva((s) => s.state); const a = adviceOutcomes(state);
  const decided = a.used + a.edited + a.dismissed;
  return (
    <Card><CardHead title="Ava’s advice" sub="What people did with her recommendations on this session’s requests. Cached sample advice counts too." />
      {a.total === 0 ? <div className="p-4"><Empty>No recommendations yet.</Empty></div> : (
        <div className="space-y-3 p-4 text-[13px]">
          <p className="text-[15px] font-semibold">Used {a.used}, edited {a.edited}, dismissed {a.dismissed}{a.open > 0 && <span className="font-normal text-slate-500">, {a.open} still open</span>}</p>
          <p className="text-slate-600">{a.adoption === undefined ? "Nobody has decided on any yet." : `${pct(a.adoption)} of the ${decided} that were decided were taken, as written or edited.`}</p>
          <table className="w-full tabular text-[12.5px]"><thead><tr className="text-left text-[11.5px] text-slate-500"><th className="py-1 font-medium">Confidence</th><th className="font-medium">Used</th><th className="font-medium">Edited</th><th className="font-medium">Dismissed</th><th className="font-medium">Open</th></tr></thead>
            <tbody>{(["high", "medium", "low"] as const).map((c) => <tr key={c} className="border-t border-slate-100"><td className="py-1 capitalize">{c}</td><td>{a.byConfidence[c].used}</td><td>{a.byConfidence[c].edited}</td><td>{a.byConfidence[c].dismissed}</td><td>{a.byConfidence[c].open}</td></tr>)}</tbody></table>
          {a.reasons.length > 0 && <details><summary className="cursor-pointer font-medium text-accent">Why people dismissed ({a.reasons.length})</summary>
            <ul className="mt-1.5 space-y-1.5">{a.reasons.map((r) => <li key={r.key} className="rounded bg-slate-50 px-2.5 py-1.5"><b>{personName(r.by)}</b> on a {r.confidence}-confidence {r.action?.replace("_", " ")}: “{r.reason}”</li>)}</ul></details>}
        </div>)}
    </Card>
  );
}

export function PredictionCard() {
  const state = useAva((s) => s.state); const p = predictionAccuracy(state);
  return (
    <Card><CardHead title="Predicted dates" sub="Intake is predicted when the first plan is made and again each time Ava re-plans. Within a day means one business day or less." />
      {p.total === 0 ? <div className="p-4"><Empty>No request has reached Ready yet, so there is nothing to compare.</Empty></div> : (
        <div className="space-y-3 p-4 text-[13px]">
          <p className="text-[15px] font-semibold">First prediction: {p.firstWithin} of {p.total} within a day <span className="font-normal text-slate-500">· final prediction: {p.finalWithin} of {p.total}</span></p>
          <ul className="divide-y divide-slate-100">{p.rows.map((r) => (
            <li key={r.reqId} className="py-2"><Link className="font-mono text-[12.5px] font-medium text-accent hover:underline" href={`/requests/${r.reqId}`}>{r.reqId}</Link> <span className="font-medium">{r.title}</span>
              <div className="text-[12.5px] text-slate-600">First predicted {fmtDay(r.first)} ({bd(r.firstOff)}). Final prediction {fmtDay(r.final)} ({bd(r.finalOff)}). Ready {fmtDay(r.actual)}.</div></li>))}</ul>
          <p className="text-[12px] text-slate-500">Sample history in this prototype, not real accuracy. Misses are shown on purpose.</p>
        </div>)}
    </Card>
  );
}
