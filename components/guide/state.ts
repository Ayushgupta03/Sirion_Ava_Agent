"use client";
// Shared reads for the guide layer: where the demo is, whether the bar and coach card are showing, and how to track an element on screen.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAva, STEPS } from "@/lib/store";
import { useGuide } from "@/lib/guideStore";

export function useDemoState() {
  const scenario = useAva((s) => s.scenario); const pos = useAva((s) => s.pos);
  const path = usePathname();
  const steps = STEPS[scenario]; const i = pos[scenario];
  /** Before a demo starts the landing page carries its own Watch buttons, and the supplier view is the supplier's, not Prayaan's. */
  const barHidden = (path === "/" && pos.A === 0 && pos.B === 0) || path.startsWith("/supplier/");
  const step = i > 0 ? steps[i - 1] : undefined;
  return { scenario, pos, path, steps, i, step, done: i >= steps.length, barHidden };
}

/** True while the coach card is on screen. The toasts that narrate the same step stay quiet then, so one voice speaks at a time. */
export function useCoachVisible() {
  const { step, barHidden, path } = useDemoState();
  const coach = useGuide((g) => g.coach); const tour = useGuide((g) => g.tour); const collapsed = useGuide((g) => g.collapsed); const hydrated = useGuide((g) => g.hydrated);
  return hydrated && !!step && coach && !tour && !collapsed && !barHidden && path !== "/";
}

/** The rectangle of the first element matching a selector, kept current while the page scrolls, resizes or re-renders. Null when it is not on the page. */
export function useAnchorRect(selector: string | null) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!selector) { setRect(null); return; }
    let raf = 0; let last = "";
    const measure = () => {
      const el = document.querySelector<HTMLElement>(selector);
      const r = el ? el.getBoundingClientRect() : null;
      const key = r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : "";
      if (key !== last) { last = key; setRect(r); }
    };
    // Measure now, then follow scrolling every frame. The interval covers a pane that pauses animation frames while it is in the background.
    const frame = () => { measure(); raf = requestAnimationFrame(frame); };
    measure(); raf = requestAnimationFrame(frame); const iv = setInterval(measure, 150);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); };
  }, [selector]);
  return rect;
}
