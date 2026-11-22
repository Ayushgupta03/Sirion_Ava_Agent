"use client";
// First-run coach marks for the four controls a first-time viewer needs. Runs once, replayable from the Help menu or the demo tools.
import { useEffect, useRef, useState } from "react";
import { useGuide } from "@/lib/guideStore";
import { Icon } from "../icons";
import { useAnchorRect } from "./state";

const STOPS = [
  { sel: '[data-tour="demo-bar"]', title: "Step through the story here", body: "Next step plays the next event. The list on the left jumps to any step. The arrow keys work too, and you can switch the tips off." },
  { sel: '[data-tour="clock"]', title: "Time is simulated", body: "Each step moves the clock forward, so ages, deadlines and the 90-day spend window stay consistent. Click it to move time yourself." },
  { sel: '[data-tour="view-as"]', title: "Switch person", body: "Each person sees only what waits on them. Switch to Ananya or Vikram to approve, or to Karan to run the request." },
  { sel: '[data-tour="help"]', title: "Help is always here", body: "A note on every page, six things to try yourself, and a glossary. You can replay this tour from here." },
];

export default function UiTour() {
  const on = useGuide((g) => g.tour); const end = useGuide((g) => g.endTour);
  const [k, setK] = useState(0);
  useEffect(() => { if (on) setK(0); }, [on]);
  if (!on) return null;
  return <Stop key={k} k={k} setK={setK} end={end} />;
}

function Stop({ k, setK, end }: { k: number; setK: (n: number) => void; end: () => void }) {
  const s = STOPS[k]; const rect = useAnchorRect(s.sel); const btn = useRef<HTMLButtonElement>(null);
  const last = k === STOPS.length - 1;
  const advance = () => (last ? end() : setK(k + 1));
  // A control that is not on this screen (for example the bar, minimised on a phone) is skipped, not shown pointing at nothing.
  useEffect(() => { if (rect) return; const t = setTimeout(advance, 900); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [!!rect, k]);
  useEffect(() => { btn.current?.focus(); }, [rect !== null]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") end(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [end]);
  if (!rect) return null;

  const vw = window.innerWidth; const vh = window.innerHeight; const W = Math.min(330, vw - 16);
  const above = rect.top > vh / 2; const pad = 6;
  const left = Math.min(Math.max(rect.left + rect.width / 2 - W / 2, 8), vw - W - 8);
  const arrowX = Math.min(Math.max(rect.left + rect.width / 2 - left - 6, 14), W - 26);
  const pos = above ? { bottom: vh - rect.top + pad + 10 } : { top: rect.bottom + pad + 10 };
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`Orientation, ${k + 1} of ${STOPS.length}: ${s.title}`}>
      <div className="absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute rounded-lg transition-all duration-200" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(15,23,42,0.5), 0 0 0 3px var(--color-accent)" }} />
      <div className="absolute rounded-xl bg-white p-4 shadow-2xl" style={{ left, width: W, ...pos }}>
        <span aria-hidden className="absolute h-3 w-3 rotate-45 bg-white" style={{ left: arrowX, [above ? "bottom" : "top"]: -6 }} />
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-accent">Orientation · {k + 1} of {STOPS.length}</p>
        <h2 className="mt-1 text-[16px] font-semibold text-slate-900">{s.title}</h2>
        <p className="mt-1 text-[13.5px] leading-snug text-slate-700">{s.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={end} className="rounded-md px-2 py-1.5 text-[13px] text-slate-600 hover:bg-slate-100">Skip</button>
          <span className="ml-auto flex gap-2">
            {k > 0 && <button onClick={() => setK(k - 1)} className="rounded-md border border-slate-300 px-3 py-1.5 text-[13px] font-medium hover:bg-slate-50">Back</button>}
            <button ref={btn} onClick={advance} className="flex items-center gap-1 rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-700">{last ? "Done" : "Next"}{!last && <Icon name="chevronRight" size={14} />}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
