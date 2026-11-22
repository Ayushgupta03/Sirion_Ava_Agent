"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAva } from "@/lib/store";
import { resolveFocus } from "@/lib/story";
import { deriveItems } from "@/lib/engine/items";
import { counters } from "@/lib/insights";
import { cx } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

const TABS: { k: string; verb: string; img: string; alt: string; line: string; href: string }[] = [
  { k: "reads", verb: "Reads", img: "/screens/reads.png", alt: "Ava's read of REQ-1047: four cited sentences on the deal and its risks.", line: "Ava reads the email and every attachment, then writes four plain sentences on what the deal is and what is risky. Every claim links to its source.", href: "/requests/REQ-1047" },
  { k: "plans", verb: "Plans", img: "/screens/plans.png", alt: "Ava's plan for REQ-1047 with policy badges, the critical path and the predicted ready date of Tue 17 Nov.", line: "Ava plans the work: policy steps from the rules engine, its own steps with a reason, and a predicted ready date from supplier history.", href: "/requests/REQ-1047" },
  { k: "acts", verb: "Acts", img: "/screens/acts.png", alt: "The handoff banner: Ava did the actions; people made the decisions.", line: "Ava does the legwork: reads, files, checks clauses, drafts and re-plans. People make the decisions, and the banner counts both.", href: "/requests/REQ-1047" },
  { k: "advises", verb: "Advises", img: "/screens/advises.png", alt: "Ava recommends asking Rahul about the new ₹1,50,000 UAT line before re-approving. Medium confidence.", line: "On every problem, Ava recommends one next step with its reasons and a ready draft. A person uses it, edits it or dismisses it.", href: "/today" },
];

export default function Landing() {
  const { state, reset, jumpTo } = useAva();
  const router = useRouter();
  const [tab, setTab] = useState("reads");
  const items = useMemo(() => deriveItems(state), [state]);
  const k = useMemo(() => counters(state), [state]);
  const cur = TABS.find((t) => t.k === tab)!;
  const watchA = () => { reset(); const f = useAva.getState().next(); if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  const watchB = () => { const f = jumpTo("B", 1); if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  const TRUST: [IconName, string][] = [["file", "Every fact links to the sentence it came from."], ["shield", "Ava only receives supplier email, through a mail rule your IT team controls."]];
  return (
    <div className="enter mx-auto max-w-[1100px] space-y-8">
      <section className="max-w-3xl">
        <h1 className="text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] text-slate-900 sm:text-[46px]">Supplier email in. Routed request out.</h1>
        <p className="mt-4 text-[18px] leading-relaxed text-slate-700">Ava reads every supplier email, plans the work, does the legwork, and tells each person the one decision that needs them.</p>
        <ul className="mt-4 flex flex-col gap-2 text-[14px] text-slate-700 sm:flex-row sm:gap-6">
          {TRUST.map(([i, t]) => <li key={t} className="flex items-start gap-2"><Icon name={i} className="mt-0.5 shrink-0 text-accent" />{t}</li>)}
        </ul>
      </section>

      <section aria-label="What Ava does" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div role="tablist" aria-label="What Ava does" className="grid grid-cols-4 border-b border-slate-200">
          {TABS.map((t, i) => (
            <button key={t.k} role="tab" id={`tab-${t.k}`} aria-selected={tab === t.k} aria-controls="landing-panel" onClick={() => setTab(t.k)} className={cx("border-b-2 px-2 py-3 text-center text-[14px] sm:text-[15px]", tab === t.k ? "border-accent font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>
              <span className="mr-1.5 hidden font-mono text-[12px] text-slate-400 sm:inline">0{i + 1}</span>{t.verb}
            </button>
          ))}
        </div>
        <div id="landing-panel" role="tabpanel" aria-labelledby={`tab-${cur.k}`} className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] md:items-center md:p-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.img} alt={cur.alt} className="block h-auto w-full" />
          </div>
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{cur.verb}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{cur.line}</p>
            <Link href={cur.href} className="mt-3 inline-block text-[14px] font-medium text-accent hover:underline">Open the real screen →</Link>
            <p className="mt-2 text-[12px] text-slate-500">Screenshots of this prototype. All data is fictional.</p>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <button onClick={watchA} className="flex h-12 items-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-700"><Icon name="play" size={15} />Watch Scenario A: new project (3 min)</button>
        <button onClick={watchB} className="flex h-12 items-center gap-2 rounded-lg border border-accent bg-white px-5 text-[15px] font-semibold text-accent-700 hover:bg-accent-50"><Icon name="play" size={15} />Watch Scenario B: renewal (2 min)</button>
        <Link href="/mail?compose=1" className="text-[14px] font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900">or test with your own email</Link>
      </section>

      <p className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 pt-4 font-mono text-[12.5px] text-slate-500">
        <span>This session: {state.emails.length} email{state.emails.length === 1 ? "" : "s"} recorded</span><span>{state.requestOrder.length} requests</span><span>{items.length} open items</span><span>{state.requestOrder.filter((id) => state.requests[id].readyAt).length} ready</span><span>{k.avaActions} Ava actions : {k.decisions} people decisions</span><span>{k.checks} contract terms checked</span><span>0 forms filled</span>
      </p>
    </div>
  );
}
