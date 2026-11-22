"use client";
// Mounts the guide: hydrates what this browser has seen, starts the first-run orientation once a demo begins, and renders the floating parts.
import { useEffect } from "react";
import { useAva } from "@/lib/store";
import { useGuide } from "@/lib/guideStore";
import StepCoach from "./StepCoach";
import UiTour from "./UiTour";
import Debrief from "./Debrief";
import PageTip from "./PageTip";
import { useDemoState } from "./state";

export default function GuideLayer() {
  const hydrate = useGuide((g) => g.hydrate); const hydrated = useGuide((g) => g.hydrated); const tourSeen = useGuide((g) => g.tourSeen); const tour = useGuide((g) => g.tour); const startTour = useGuide((g) => g.startTour); const markViewedAs = useGuide((g) => g.markViewedAs);
  const { pos, barHidden } = useDemoState();
  useEffect(() => { hydrate(); }, [hydrate]);

  // First time a demo starts in this browser: point at the controls once.
  const started = pos.A > 0 || pos.B > 0;
  useEffect(() => {
    if (!hydrated || tourSeen || tour || !started || barHidden) return;
    const t = setTimeout(startTour, 900); return () => clearTimeout(t);
  }, [hydrated, tourSeen, tour, started, barHidden, startTour]);

  // Switching person is the one "try it yourself" task the event log cannot show.
  useEffect(() => {
    let prev = useAva.getState().viewAs;
    return useAva.subscribe((s) => { if (s.viewAs !== prev) { prev = s.viewAs; if (useGuide.getState().hydrated) markViewedAs(); } });
  }, [markViewedAs]);

  return <><StepCoach /><PageTip /><UiTour /><Debrief /></>;
}
