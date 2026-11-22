"use client";
// The payoff at the end of a scenario: what it proved, in numbers from the engine, and where to go next.
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAva } from "@/lib/store";
import { useGuide } from "@/lib/guideStore";
import { resolveFocus } from "@/lib/story";
import { debriefFor, SCENARIO_BLURB } from "@/lib/guide";
import { Icon, type IconName } from "../icons";
import { Chip } from "../ui";
import { Rich } from "./Term";

/** An impact line that only repeats the amounts already in the title adds nothing. */
const restates = (text: string, impact: string) => { const amts = impact.match(/₹[\d,]+/g); return !!amts && amts.every((a) => text.includes(a)); };

export default function Debrief() {
  const sc = useGuide((g) => g.debrief); const close = useGuide((g) => g.openDebrief);
  const state = useAva((s) => s.state); const router = useRouter(); const closeRef = useRef<HTMLButtonElement>(null);
  const d = useMemo(() => (sc ? debriefFor(state, sc) : null), [state, sc]);
  useEffect(() => {
    if (!sc) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(null); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [sc, close]);
  if (!sc || !d) return null;

  const watchB = () => { close(null); const f = useAva.getState().jumpTo("B", 1); if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  const replayA = () => { close(null); useAva.getState().reset(); const f = useAva.getState().next(); if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  const NEXT: { icon: IconName; label: string; sub: string; onClick?: () => void; href?: string }[] = [
    sc === "A" ? { icon: "play", label: "Watch Scenario B: renewal", sub: SCENARIO_BLURB.B.line, onClick: watchB } : { icon: "reset", label: "Replay Scenario A", sub: SCENARIO_BLURB.A.line, onClick: replayA },
    { icon: "spark", label: "Start a request in Ask Ava", sub: "Describe a need in one sentence and see what it will take.", href: "/new" },
    { icon: "mail", label: "Send your own email to Ava", sub: "Write any email, as anyone, in the test lab.", href: "/mail?compose=1" },
    { icon: "chart", label: "See the dashboard", sub: "Pipeline, what Ava caught and the north-star metric.", href: "/dashboard" },
  ];
  const item = "flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-accent hover:bg-accent-50/40";
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="debrief-title" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => close(null)}>
      <div className="max-h-[92dvh] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500"><Chip tone="green"><Icon name="check" size={12} strokeWidth={2.5} />{d.outcome}</Chip><span>Scenario {sc} · {d.reqId}</span></div>
            <h2 id="debrief-title" className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-slate-900">{sc === "A" ? "From one email to a request Legal can pick up" : "A renewal that nearly cost ₹1,26,000 a year more"}</h2>
            <p className="mt-1 text-[14px] text-slate-600">{d.title}</p>
          </div>
          <button ref={closeRef} onClick={() => close(null)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Icon name="x" /></button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {[["On the calendar", d.total, "first email to ready"], ["Prayaan's own time", d.own, "what Ava and our people control"], ["Waiting on the supplier", d.supplier, "no one here can speed this up"]].map(([l, v, s], k) => (
            <div key={l} className={`rounded-xl border px-3 py-2.5 ${k === 1 ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
              <div className="text-[11.5px] font-medium text-slate-600">{l}</div>
              <div className={`mt-0.5 text-[20px] font-semibold tabular sm:text-[24px] ${k === 1 ? "text-emerald-800" : "text-slate-900"}`}>{v}</div>
              <div className="text-[11.5px] leading-tight text-slate-500">{s}</div>
            </div>))}
        </div>
        <p className="mt-2 text-[12.5px] text-slate-600"><Rich text="Supplier replies are left out of {{own-time|Prayaan's own time}}, because waiting for them is not something intake can fix." /> Ava did {d.avaActions} actions. People made {d.decisions} decisions.</p>

        {d.problems.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[13px] font-semibold text-slate-900">What Ava caught before anyone signed</h3>
            <ul className="mt-2 space-y-1.5">
              {d.problems.map((p) => <li key={p.text} className="flex gap-2 text-[13.5px] text-slate-800"><Icon name="alert" size={15} className="mt-0.5 shrink-0 text-amber-600" /><span>{p.text}{p.impact && !restates(p.text, p.impact) && <span className="text-slate-500"> · {p.impact}</span>}</span></li>)}
            </ul>
          </div>)}

        <h3 className="mt-6 text-[13px] font-semibold text-slate-900">What to try next</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {NEXT.map((n) => {
            const inner = <><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent"><Icon name={n.icon} size={16} /></span><span className="leading-snug"><span className="block text-[13.5px] font-semibold text-slate-900">{n.label}</span><span className="block text-[12.5px] text-slate-600">{n.sub}</span></span></>;
            return n.href ? <Link key={n.label} href={n.href} onClick={() => close(null)} className={item}>{inner}</Link> : <button key={n.label} onClick={n.onClick} className={item}>{inner}</button>;
          })}
        </div>
        <p className="mt-4 text-[12.5px] text-slate-500">Want the reasoning behind it? <Link href="/story/why" onClick={() => close(null)} className="font-medium text-accent hover:underline">Read why intake comes first</Link>. All people and numbers are fictional.</p>
      </div>
    </div>
  );
}
