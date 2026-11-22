"use client";
// Help in the top bar: what this page is for, six things to try yourself (ticked from the event log), the glossary and the shortcuts.
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAva, STEPS } from "@/lib/store";
import { useGuide } from "@/lib/guideStore";
import { GLOSSARY, TASKS, pageHelpFor, taskStatus } from "@/lib/guide";
import { cx } from "../ui";
import { Icon } from "../icons";

export function useTasks() {
  const state = useAva((s) => s.state); const events = useAva((s) => s.events); const pos = useAva((s) => s.pos); const viewedAs = useGuide((g) => g.viewedAs);
  return useMemo(() => taskStatus(state, events, pos, { A: STEPS.A.length, B: STEPS.B.length }, viewedAs), [state, events, pos, viewedAs]);
}

export default function HelpMenu() {
  const open = useGuide((g) => g.helpOpen); const setOpen = useGuide((g) => g.setHelp); const startTour = useGuide((g) => g.startTour); const forgetAll = useGuide((g) => g.forgetAll);
  const path = usePathname(); const help = pageHelpFor(path); const status = useTasks(); const ref = useRef<HTMLDivElement>(null);
  const doneN = TASKS.filter((t) => status[t.id]).length;
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [open, setOpen]);
  return (
    <div ref={ref} className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button data-tour="help" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" aria-label={`Help and guide, ${doneN} of ${TASKS.length} things tried`} className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] font-medium hover:bg-slate-50">
        <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-accent text-[11px] font-bold text-white">?</span>
        <span className="hidden sm:inline">Help</span>
        <span className="hidden rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold tabular text-slate-600 md:inline">{doneN}/{TASKS.length}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Help and guide" className="absolute right-0 top-11 z-[60] max-h-[calc(100dvh-80px)] w-[min(380px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          {help && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">On this page</p>
              <h2 className="mt-0.5 text-[15px] font-semibold text-slate-900">{help.title}</h2>
              <p className="mt-1 text-[13px] text-slate-700">{help.purpose}</p>
              <ul className="mt-2 space-y-1 text-[13px] text-slate-700">{help.howTo.map((h) => <li key={h} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />{h}</li>)}</ul>
            </section>)}

          <section className={cx(help && "mt-4 border-t border-slate-100 pt-4")}>
            <div className="flex items-baseline justify-between"><h2 className="text-[13px] font-semibold text-slate-900">Try it yourself</h2><span className="text-[12px] tabular text-slate-500">{doneN} of {TASKS.length}</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={TASKS.length} aria-valuenow={doneN} aria-label="Things tried"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(doneN / TASKS.length) * 100}%` }} /></div>
            <ul className="mt-2 space-y-0.5">
              {TASKS.map((t) => {
                const done = status[t.id];
                const body = <><span className={cx("mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border", done ? "border-accent bg-accent text-white" : "border-slate-300")}>{done && <Icon name="check" size={11} strokeWidth={3} />}</span><span className="leading-snug"><span className={cx("block text-[13px]", done ? "text-slate-500 line-through" : "font-medium text-slate-900")}>{t.label}</span>{!done && <span className="block text-[12px] text-slate-500">{t.hint}</span>}</span></>;
                return <li key={t.id}>{t.href && !done ? <Link href={t.href} onClick={() => setOpen(false)} className="flex gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-50">{body}</Link> : <div className="flex gap-2.5 px-1.5 py-1.5">{body}</div>}</li>;
              })}
            </ul>
          </section>

          <section className="mt-4 border-t border-slate-100 pt-4">
            <h2 className="text-[13px] font-semibold text-slate-900">Words used here</h2>
            <div className="mt-1.5 divide-y divide-slate-100">
              {GLOSSARY.map((t) => <details key={t.id} className="group py-1.5"><summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-slate-800"><span>{t.term}</span><Icon name="chevronDown" size={14} className="text-slate-400 group-open:rotate-180" /></summary><p className="mt-1 text-[12.5px] leading-snug text-slate-600">{t.def}</p></details>)}
            </div>
          </section>

          <section className="mt-4 border-t border-slate-100 pt-4 text-[12.5px] text-slate-600">
            <p><kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono">→</kbd> next step · <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono">←</kbd> back · <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono">Esc</kbd> close menus (while a demo is running)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => startTour()} className="rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-800 hover:bg-slate-50">Replay the orientation</button>
              <button onClick={() => { forgetAll(); setOpen(false); }} className="rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-800 hover:bg-slate-50">Show all tips again</button>
            </div>
          </section>
        </div>)}
    </div>
  );
}
