"use client";
// The coach mark for the current guided step: points at the element the step changed, says what to notice and why it matters,
// and folds in who acted and who was reached (which used to arrive as two separate toasts on top of the page).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAva } from "@/lib/store";
import { useGuide } from "@/lib/guideStore";
import { resolveFocus } from "@/lib/story";
import { STEP_GUIDE } from "@/lib/guide";
import { person } from "@/lib/engine/world";
import { fmtDT } from "@/lib/format";
import { cx } from "../ui";
import { Icon } from "../icons";
import { Rich } from "./Term";
import { useAnchorRect, useCoachVisible, useDemoState } from "./state";
import { initials, roleOf } from "../Shell";

const NOUN: Record<string, string> = { question: "question", info: "note", draft: "draft to send", approval: "approval", reconfirm: "reconfirmation", conflict: "conflict", competing: "quote task", retro: "reason to record", legal: "legal item", packet: "handoff packet", supplier: "supplier check", orphan: "invoice to confirm", unsorted: "unsorted invoice", finance: "finance task", mention: "mention" };
const tally = (xs: { kind: string }[]) => { const m = new Map<string, number>(); xs.forEach((x) => m.set(x.kind, (m.get(x.kind) ?? 0) + 1)); return [...m].map(([k, n]) => `${n} ${NOUN[k] ?? k}${n > 1 ? "s" : ""}`).join(", "); };
const first = (id: string) => person(id)?.name.split(" ")[0] ?? id;

export default function StepCoach() {
  const visible = useCoachVisible();
  const { scenario, step, steps, i, done, path } = useDemoState();
  if (!visible || !step) return null;
  return <Card key={`${scenario}-${i}`} scenario={scenario} step={step} index={i} total={steps.length} done={done} path={path} />;
}

function Card({ scenario, step, index, total, done, path }: { scenario: "A" | "B"; step: NonNullable<ReturnType<typeof useDemoState>["step"]>; index: number; total: number; done: boolean; path: string }) {
  const router = useRouter(); const g = STEP_GUIDE[step.id];
  const { toast, ripple, setViewAs, dismissToast, dismissRipple, firePulse } = useAva(); const state = useAva((s) => s.state);
  const setCoach = useGuide((s) => s.setCoach); const min = useGuide((s) => s.coachMin); const setMin = useGuide((s) => s.setCoachMin); const openDebrief = useGuide((s) => s.openDebrief);
  const sel = step.pulse ? `[data-pulse="${step.pulse}"]` : null;
  const rect = useAnchorRect(sel);
  const focus = resolveFocus(step.focus, state); const away = path !== focus.split("?")[0];
  const ref = useRef<HTMLElement>(null); const [side, setSide] = useState<"right" | "left">("right");

  // While the card is open the element it talks about keeps a steady ring (the 2-second pulse alone is easy to miss).
  useEffect(() => {
    if (!sel || away) return;
    let el: HTMLElement | null = null; const t = setInterval(() => { el = document.querySelector<HTMLElement>(sel); if (el) { el.classList.add("coach-target"); clearInterval(t); } }, 100);
    return () => { clearInterval(t); document.querySelectorAll(".coach-target").forEach((n) => n.classList.remove("coach-target")); };
  }, [sel, away]);

  // Sit on the side of the screen that covers the highlighted element least.
  useEffect(() => {
    const card = ref.current; if (!card || !rect || window.innerWidth < 640) return;
    const w = card.offsetWidth; const h = card.offsetHeight; const vw = window.innerWidth; const vh = window.innerHeight;
    const dock = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--dock-h")) || 64; const top = vh - dock - 12 - h;
    const overlap = (l: number) => Math.max(0, Math.min(rect.right, l + w) - Math.max(rect.left, l)) * Math.max(0, Math.min(rect.bottom, top + h) - Math.max(rect.top, top));
    const sidebar = vw >= 1024 ? 248 : vw >= 768 ? 80 : 8;
    const right = overlap(vw - 16 - w); const left = overlap(sidebar);
    setSide(right > 0.25 * w * h && left < right ? "left" : "right");
  }, [rect, scenario, index]);

  const onScreen = !!rect && rect.bottom > 56 && rect.top < window.innerHeight - 80 && !away;
  const acting = toast?.actors ?? [];
  const reach = ripple && ripple.label === step.caption ? ripple : null;
  const viewer = useAva((s) => s.viewer);
  const label = rect && onScreen && !viewer ? { left: Math.min(Math.max(rect.left, 8), window.innerWidth - 150), top: Math.max(rect.top - 30, 62) } : null;

  return (
    <>
      {label && <div aria-hidden className="pointer-events-none fixed z-[15] flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11.5px] font-semibold text-white shadow" style={{ left: label.left, top: label.top }}><Icon name="eye" size={12} />Look here: {g.where}</div>}
      <section ref={ref} role="region" aria-label="What to notice in this step" aria-live="polite"
        className={cx("coach-in fixed z-[55] max-h-[46dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.18)] bottom-[calc(var(--dock-h,64px)+12px)] inset-x-2 sm:inset-x-auto sm:w-[380px]", side === "right" ? "sm:right-4" : "sm:left-2 md:left-[80px] lg:left-[248px]")}>
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span className="rounded bg-accent-50 px-1.5 py-0.5 font-semibold text-accent-700">Step {index} of {total}</span>
          <span className="font-mono">{fmtDT(step.at)}</span>
          <button onClick={() => setMin(!min)} aria-expanded={!min} aria-label={min ? "Show the step notes" : "Fold the step notes down to the title"} title={min ? "Show notes" : "Fold down"} className="-mr-1 ml-auto grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name={min ? "chevronUp" : "chevronDown"} size={14} /></button>
          <button onClick={() => setCoach(false)} aria-label="Hide step tips" title="Hide tips. Turn them back on from the demo bar." className="-mr-1 grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name="x" size={14} /></button>
        </div>
        <h2 className="mt-1.5 text-[16px] font-semibold leading-snug text-slate-900">{g.title}</h2>
        {!min && <>
        <ul className="mt-2 space-y-1.5 text-[13.5px] leading-snug text-slate-700">
          {g.notice.map((n) => <li key={n} className="flex gap-2"><Icon name="check" size={14} className="mt-[3px] shrink-0 text-accent" /><span><Rich text={n} /></span></li>)}
        </ul>
        <p className="mt-3 hidden rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] leading-snug text-slate-700 sm:block"><b className="font-semibold text-slate-900">Why it matters. </b><Rich text={g.why} /></p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {away && <button onClick={() => { router.push(focus); setTimeout(() => firePulse(step.pulse), 150); }} className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-700">Take me back to this step</button>}
          {!away && !onScreen && <button onClick={() => firePulse(step.pulse)} className="rounded-md border border-accent px-3 py-1.5 text-[13px] font-semibold text-accent-700 hover:bg-accent-50">Show me where</button>}
          {done && <button onClick={() => openDebrief(scenario)} className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-700">See what this proved</button>}
          <span className="ml-auto hidden text-[11.5px] text-slate-500 md:inline"><kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono">←</kbd> <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono">→</kbd> move between steps</span>
        </div>
        {(acting.length > 0 || reach) && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-[12.5px]">
            {acting.length > 0 && (
              <div>
                <p className="font-semibold text-slate-800">Done as {acting.map((a) => `${first(a)} (${roleOf(a).split(",")[0].toLowerCase()})`).join(" and ")}</p>
                <p className="text-slate-500">Your own view has not changed.</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{acting.map((a) => <button key={a} onClick={() => { setViewAs(a); dismissToast(); router.push("/today"); }} className="rounded-md border border-slate-300 px-2 py-1 text-[12px] font-medium hover:bg-slate-50">View as {first(a)}</button>)}</div>
              </div>)}
            {reach && (
              <div>
                <p className="font-semibold text-slate-800">What this reached</p>
                <ul className="mt-1 space-y-1">
                  {reach.rows.slice(0, 4).map((r) => (
                    <li key={r.personId} className="flex items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10.5px] font-semibold text-slate-700">{initials(r.personId)}</span>
                      <span className="min-w-0 flex-1 leading-snug"><b>{first(r.personId)}</b>{r.opened.length > 0 && <span> now has {tally(r.opened)}</span>}{r.closed.length > 0 && <span className="text-slate-500">{r.opened.length ? "; " : " "}{tally(r.closed)} cleared</span>}</span>
                      <button onClick={() => { setViewAs(r.personId); dismissRipple(); router.push("/today"); }} className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[11.5px] font-medium hover:bg-slate-50">View as</button>
                    </li>))}
                </ul>
              </div>)}
          </div>)}

        </>}
      </section>
    </>
  );
}
