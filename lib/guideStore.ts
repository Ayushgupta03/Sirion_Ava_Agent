"use client";
// Guide state: what this browser has already been shown. Separate from the engine's event log, so "Reset demo" never re-shows the tour
// and the guide never changes a number. Persisted to localStorage; every read and write is wrapped because storage can be blocked.
import { create } from "zustand";
import type { Scn } from "./guide";

const KEY = "ava-guide-v1";
interface Saved { tourSeen: boolean; coach: boolean; tipsSeen: string[]; viewedAs: boolean }
const DEFAULTS: Saved = { tourSeen: false, coach: true, tipsSeen: [], viewedAs: false };

interface Guide extends Saved {
  hydrated: boolean;
  /** The first-run tour of the screen controls is running. */
  tour: boolean;
  /** Which scenario's debrief card is open. */
  debrief: Scn | null;
  helpOpen: boolean;
  /** The demo bar is minimised to a pill. Not saved: each visit starts open on a desktop and minimised on a phone. */
  collapsed: boolean;
  /** The coach card is folded down to its title. Kept across steps, not saved. */
  coachMin: boolean;
  hydrate: () => void;
  startTour: () => void;
  endTour: () => void;
  setCoach: (on: boolean) => void;
  seeTip: (id: string) => void;
  markViewedAs: () => void;
  openDebrief: (sc: Scn | null) => void;
  setHelp: (open: boolean) => void;
  setCollapsed: (c: boolean) => void;
  setCoachMin: (m: boolean) => void;
  forgetAll: () => void;
}

function save(g: Saved) { try { localStorage.setItem(KEY, JSON.stringify({ tourSeen: g.tourSeen, coach: g.coach, tipsSeen: g.tipsSeen, viewedAs: g.viewedAs })); } catch { /* blocked */ } }

export const useGuide = create<Guide>((set, get) => ({
  ...DEFAULTS, hydrated: false, tour: false, debrief: null, helpOpen: false, collapsed: false, coachMin: false,
  hydrate: () => {
    if (get().hydrated) return;
    try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw) as Partial<Saved>; set({ ...DEFAULTS, ...d, tipsSeen: Array.isArray(d.tipsSeen) ? d.tipsSeen : [], hydrated: true }); return; } } catch { /* use defaults */ }
    set({ hydrated: true });
  },
  startTour: () => set({ tour: true, helpOpen: false }),
  endTour: () => { set({ tour: false, tourSeen: true }); save(get()); },
  setCoach: (on) => { set({ coach: on }); save(get()); },
  seeTip: (id) => { if (get().tipsSeen.includes(id)) return; set({ tipsSeen: [...get().tipsSeen, id] }); save(get()); },
  markViewedAs: () => { if (get().viewedAs) return; set({ viewedAs: true }); save(get()); },
  openDebrief: (sc) => set({ debrief: sc }),
  setHelp: (open) => set({ helpOpen: open }),
  setCollapsed: (c) => set({ collapsed: c }),
  setCoachMin: (m) => set({ coachMin: m }),
  forgetAll: () => { set({ ...DEFAULTS, tour: false, debrief: null, collapsed: get().collapsed }); save(get()); },
}));
