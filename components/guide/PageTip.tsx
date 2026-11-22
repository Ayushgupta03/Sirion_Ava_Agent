"use client";
// A one-time note the first time someone opens a page: what it is for and how to use it. Quiet while a demo step is being explained.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useGuide } from "@/lib/guideStore";
import { pageHelpFor } from "@/lib/guide";
import { Icon } from "../icons";
import { useCoachVisible } from "./state";

export default function PageTip() {
  const path = usePathname(); const help = pageHelpFor(path);
  const hydrated = useGuide((g) => g.hydrated); const seen = useGuide((g) => g.tipsSeen); const seeTip = useGuide((g) => g.seeTip); const setHelp = useGuide((g) => g.setHelp);
  const tour = useGuide((g) => g.tour); const debrief = useGuide((g) => g.debrief); const helpOpen = useGuide((g) => g.helpOpen);
  const coaching = useCoachVisible();
  const [ready, setReady] = useState(false);
  // Wait a moment after arriving, so the tip does not flash while the page is still settling or a demo step is scrolling.
  useEffect(() => { setReady(false); const t = setTimeout(() => setReady(true), 1200); return () => clearTimeout(t); }, [path]);
  if (!hydrated || !ready || !help || help.id === "landing" || seen.includes(help.id) || coaching || tour || debrief || helpOpen) return null;
  return (
    <aside role="note" aria-label={`About ${help.title}`} className="coach-in fixed bottom-[calc(var(--dock-h,0px)+16px)] left-2 z-[45] w-[min(340px,calc(100vw-16px))] rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.14)] md:left-[80px] lg:left-[248px]">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent"><Icon name="book" size={15} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">New here? {help.title}</p>
          <p className="mt-0.5 text-[13.5px] font-medium leading-snug text-slate-900">{help.purpose}</p>
          <ul className="mt-1.5 hidden space-y-1 text-[12.5px] sm:block leading-snug text-slate-700">{help.howTo.slice(0, 2).map((h) => <li key={h} className="flex gap-2"><Icon name="check" size={13} className="mt-[3px] shrink-0 text-accent" />{h}</li>)}</ul>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => seeTip(help.id)} className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-700">Got it</button>
            <button onClick={() => { seeTip(help.id); setHelp(true); }} className="rounded-md px-2 py-1.5 text-[13px] font-medium text-accent-700 hover:bg-accent-50">More help</button>
          </div>
        </div>
        <button onClick={() => seeTip(help.id)} aria-label="Dismiss" className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100"><Icon name="x" size={14} /></button>
      </div>
    </aside>
  );
}
