"use client";
// The demo bar. One job: move through the story. What each step means lives in the coach card; tools and reset live in the menu.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAva, STEPS } from "@/lib/store";
import { useGuide } from "@/lib/guideStore";
import { resolveFocus } from "@/lib/story";
import { STEP_GUIDE, SCENARIO_BLURB, type Scn } from "@/lib/guide";
import { fmtDT } from "@/lib/format";
import { cx } from "../ui";
import { Icon } from "../icons";
import { useCoachVisible, useDemoState } from "./state";

export default function DemoBar() {
  const router = useRouter();
  const { scenario, next, prev, reset, runContrast, jumpTo, firePulse, caption } = useAva();
  const { steps, i, step, done, barHidden } = useDemoState();
  const collapsed = useGuide((g) => g.collapsed); const setCollapsed = useGuide((g) => g.setCollapsed);
  const coach = useGuide((g) => g.coach); const setCoach = useGuide((g) => g.setCoach); const startTour = useGuide((g) => g.startTour); const openDebrief = useGuide((g) => g.openDebrief);
  const coaching = useCoachVisible();
  const [menu, setMenu] = useState(false); const [outline, setOutline] = useState(false); const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // On a phone the bar would cover the page, so it starts as a pill.
  useEffect(() => { if (window.matchMedia("(max-width: 639px)").matches) setCollapsed(true); }, [setCollapsed]);
  useEffect(() => {
    const el = ref.current; const root = document.documentElement;
    if (!el) { root.style.setProperty("--dock-h", barHidden ? "0px" : "64px"); return; }
    const ro = new ResizeObserver(() => root.style.setProperty("--dock-h", `${el.offsetHeight}px`)); ro.observe(el); return () => ro.disconnect();
  }, [collapsed, barHidden]);

  const go = (f?: string) => { if (f) router.push(resolveFocus(f, useAva.getState().state)); };
  const forward = () => { if (done) openDebrief(scenario); else go(next()); };

  // Keyboard: → next, ← back, Esc closes the menus. Never while typing, inside a dialog, or on a tab strip that uses the arrows itself.
  useEffect(() => {
    if (barHidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { setMenu(false); setOutline(false); setConfirmReset(false); return; }
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || t.closest('[role="tablist"],[role="menu"],[role="listbox"]'))) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      const st = useAva.getState();
      if (e.key === "ArrowRight") { if (st.pos[st.scenario] < STEPS[st.scenario].length) go(st.next()); }
      else st.prev();
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barHidden]);

  // Close the menus when the pointer goes elsewhere.
  useEffect(() => {
    if (!menu && !outline) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-bar-pop]")) { setMenu(false); setOutline(false); setConfirmReset(false); } };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [menu, outline]);

  if (barHidden) return null;
  if (collapsed) return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-30">
      <button onClick={() => setCollapsed(false)} className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-white shadow-lg">
        <Icon name="play" size={14} /> Guided demo · {scenario === "A" ? "Scenario A" : "Scenario B"} · step {i}/{steps.length}
      </button>
    </div>
  );

  const title = step ? STEP_GUIDE[step.id].title : SCENARIO_BLURB[scenario].line;
  return (
    <section ref={ref} data-tour="demo-bar" aria-label="Guided demo" className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="mx-auto max-w-[1320px] px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 lg:flex-nowrap">
          {/* Where am I in the story */}
          <div className="relative" data-bar-pop>
            <button onClick={() => { setOutline((o) => !o); setMenu(false); }} aria-expanded={outline} aria-haspopup="dialog" className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 text-[13px] font-semibold hover:bg-slate-50">
              <Icon name="list" size={15} className="text-accent" />{scenario === "A" ? "A · New project" : "B · Renewal"}<Icon name="chevronUp" size={14} className="text-slate-400" />
            </button>
            {outline && <Outline scenario={scenario} onJump={(sc, n) => { setOutline(false); go(jumpTo(sc, n)); }} />}
          </div>
          <span className="whitespace-nowrap text-[12.5px] font-semibold text-slate-700">{i === 0 ? "Not started" : `Step ${i} of ${steps.length}`}{step && <span className="ml-2 hidden font-mono font-normal text-slate-500 md:inline">{fmtDT(step.at)}</span>}</span>
          <ol aria-label="Steps" className="hidden gap-1 lg:flex">
            {steps.map((s, k) => (
              <li key={s.id}><button onClick={() => go(jumpTo(scenario, k + 1))} aria-label={`Go to step ${k + 1}: ${STEP_GUIDE[s.id].title}`} aria-current={k + 1 === i ? "step" : undefined} title={`${k + 1}. ${STEP_GUIDE[s.id].title}`} className="group grid h-6 w-6 place-items-center">
                <span className={cx("h-1.5 w-5 rounded-full transition-colors group-hover:bg-accent-700", k < i ? "bg-accent" : "bg-slate-200", k + 1 === i && "ring-2 ring-accent/30")} />
              </button></li>))}
          </ol>
          {/* What this step is, in one line */}
          <p className={cx("order-last min-w-0 basis-full text-[14px] font-semibold leading-snug text-slate-900 lg:order-none lg:block lg:basis-auto lg:flex-1 lg:truncate", coaching && "hidden")} aria-live="polite" title={title}>{title}</p>
          <span className="ml-auto flex items-center gap-1 lg:ml-0">
            <button onClick={() => setCoach(!coach)} role="switch" aria-checked={coach} title="Show or hide the tips that explain each step" className="hidden h-9 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 sm:flex">
              <span className={cx("relative h-4 w-7 rounded-full transition-colors", coach ? "bg-accent" : "bg-slate-300")}><span className={cx("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", coach ? "left-3.5" : "left-0.5")} /></span>Tips
            </button>
            <div className="relative" data-bar-pop>
              <button onClick={() => { setMenu((m) => !m); setOutline(false); setConfirmReset(false); }} aria-expanded={menu} aria-haspopup="menu" aria-label="Demo tools" title="Demo tools" className="grid h-9 w-9 place-items-center rounded-md hover:bg-slate-100"><Icon name="settings" size={16} /></button>
              {menu && (
                <div role="menu" className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  <MenuItem icon="mail" onClick={() => { setMenu(false); router.push(`/mail?compose=1&t=${Date.now()}`); }} hint="Write any email, as anyone, through the same pipeline">Test lab: simulate an incoming email</MenuItem>
                  <MenuItem icon="repeat" onClick={() => { setMenu(false); runContrast(); router.push("/today"); }} hint="Repeat work under an existing agreement: one approval">Show a repeat request</MenuItem>
                  <MenuItem icon="eye" onClick={() => { setMenu(false); startTour(); }} hint="The 4 controls to know, 20 seconds">Replay the orientation</MenuItem>
                  <MenuItem icon="chevronDown" onClick={() => { setMenu(false); setCollapsed(true); }} hint="Shrink the bar to a pill">Minimise the bar</MenuItem>
                  <div className="my-1 h-px bg-slate-100" />
                  {confirmReset
                    ? <div className="px-2.5 py-2 text-[13px]"><p className="text-slate-700">Clears every step, composed email and action.</p><div className="mt-2 flex gap-2"><button role="menuitem" onClick={() => { reset(); setConfirmReset(false); setMenu(false); router.push("/"); }} className="rounded-md border border-red-300 px-2.5 py-1 font-medium text-red-700 hover:bg-red-50">Yes, reset the demo</button><button role="menuitem" onClick={() => setConfirmReset(false)} className="rounded-md px-2.5 py-1 text-slate-600 hover:bg-slate-100">Cancel</button></div></div>
                    : <MenuItem icon="reset" onClick={() => setConfirmReset(true)} hint="Start again from Thu 12 Nov, 09:00">Reset demo…</MenuItem>}
                </div>)}
            </div>
            <button onClick={prev} disabled={i === 0} aria-label="Previous step" className="flex h-10 shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] font-medium hover:bg-slate-50 disabled:opacity-40 sm:px-3"><Icon name="chevronLeft" /><span className="hidden sm:inline">Back</span></button>
            <button onClick={forward} className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-md bg-accent px-4 text-[13.5px] font-semibold text-white hover:bg-accent-700">
              {i === 0 ? "Start" : done ? "What this proved" : "Next step"}{!done && <Icon name="chevronRight" />}
            </button>
          </span>
        </div>
        {i === 0 && <p className="mt-1 hidden text-[12.5px] text-slate-600 sm:block">Watch for: {SCENARIO_BLURB[scenario].moments.join(" · ")}</p>}
        {!coach && step && <p className="mt-1 text-[12.5px] text-slate-600">{caption ?? step.caption} <button onClick={() => { go(step.focus); setTimeout(() => firePulse(step.pulse), 150); }} className="font-medium text-accent hover:underline">Show me where →</button></p>}
      </div>
    </section>
  );
}

function MenuItem({ icon, children, hint, onClick }: { icon: Parameters<typeof Icon>[0]["name"]; children: React.ReactNode; hint: string; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50">
      <Icon name={icon} size={16} className="mt-0.5 shrink-0 text-slate-500" />
      <span className="leading-tight"><span className="block text-[13px] font-medium text-slate-900">{children}</span><span className="block text-[11.5px] text-slate-500">{hint}</span></span>
    </button>
  );
}

/** The whole story as an agenda: where you are, what is done, and a jump to any step (replayed through the engine). */
function Outline({ scenario, onJump }: { scenario: Scn; onJump: (sc: Scn, n: number) => void }) {
  const pos = useAva((s) => s.pos); const [view, setView] = useState<Scn>(scenario);
  const steps = STEPS[view]; const here = view === scenario || pos[view] > 0 ? pos[view] : 0;
  return (
    <div role="dialog" aria-label="Story outline" className="absolute bottom-full left-0 mb-2 w-[min(380px,calc(100vw-32px))] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      <div role="tablist" aria-label="Scenario" className="flex rounded-lg bg-slate-100 p-0.5 text-[12.5px]">
        {(["A", "B"] as const).map((s) => <button key={s} role="tab" aria-selected={view === s} onClick={() => setView(s)} className={cx("flex-1 rounded-md px-2 py-1.5", view === s ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600")}>{s === "A" ? "A · New project" : "B · Renewal"}</button>)}
      </div>
      <p className="px-2 pb-1 pt-2 text-[12px] text-slate-500">{SCENARIO_BLURB[view].line}</p>
      <ol className="max-h-[50dvh] overflow-y-auto">
        {steps.map((s, k) => {
          const n = k + 1; const state = n < here ? "done" : n === here ? "now" : "todo";
          return (
            <li key={s.id}><button onClick={() => onJump(view, n)} aria-current={state === "now" ? "step" : undefined} className={cx("flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50", state === "now" && "bg-accent-50")}>
              <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", state === "done" ? "bg-accent text-white" : state === "now" ? "bg-accent text-white ring-2 ring-accent/30" : "bg-slate-100 text-slate-500")}>{state === "done" ? <Icon name="check" size={12} strokeWidth={2.5} /> : n}</span>
              <span className="min-w-0 flex-1 leading-snug"><span className={cx("block text-[13px]", state === "now" ? "font-semibold text-slate-900" : "text-slate-800")}>{STEP_GUIDE[s.id].title}</span><span className="block font-mono text-[11.5px] text-slate-500">{fmtDT(s.at)}</span></span>
            </button></li>);
        })}
      </ol>
    </div>
  );
}
