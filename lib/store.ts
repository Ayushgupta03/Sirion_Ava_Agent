"use client";
// Client store: an event log persisted to localStorage. Every screen reads state computed by the engine.
import { create } from "zustand";
import type { Action, AvaEvent, Email, Extraction, ExtractionSource, Source, State, ViewerTarget } from "./types";
import { applyEvent, initialState, replay } from "./engine/pipeline";
import { SCENARIO_A, SCENARIO_B, SEED_EVENTS, type Step } from "./story";
import { contrastEmails } from "./scripted";
import { EXTRACTION_CACHE } from "./cache";
import { addMinutes, uid } from "./format";

const KEY = "ava-prototype-v1";
type Scn = "A" | "B";

export type { ViewerTarget };

interface Store {
  hydrated: boolean;
  events: AvaEvent[];
  state: State;
  viewAs: string;
  scenario: Scn;
  pos: Record<Scn, number>;
  checkpoints: Record<Scn, number[]>;
  caption?: string;
  focus?: string;
  viewer: ViewerTarget | null;
  aiAvailable?: boolean;
  pulse: { target?: string; n: number };
  toast: { actors: string[]; n: number } | null;
  firePulse: (target?: string) => void;
  dismissToast: () => void;
  hydrate: () => void;
  act: (action: Action, actor?: string) => void;
  addEmail: (email: Email, extraction: Extraction | null, source: ExtractionSource) => void;
  tick: (minutes: number) => void;
  next: () => string | undefined;
  prev: () => void;
  reset: () => void;
  setScenario: (s: Scn) => void;
  runContrast: () => void;
  jumpTo: (sc: Scn, step: number) => string | undefined;
  setViewAs: (id: string) => void;
  openSource: (s: Source | ViewerTarget) => void;
  closeViewer: () => void;
  setAi: (v: boolean) => void;
}

export const STEPS: Record<Scn, Step[]> = { A: SCENARIO_A, B: SCENARIO_B };

function seedState() { return SEED_EVENTS.reduce(applyEvent, initialState()); }

function save(s: Pick<Store, "events" | "viewAs" | "scenario" | "pos" | "checkpoints" | "caption">) {
  try { localStorage.setItem(KEY, JSON.stringify({ events: s.events, viewAs: s.viewAs, scenario: s.scenario, pos: s.pos, checkpoints: s.checkpoints, caption: s.caption })); } catch { /* storage full or blocked */ }
}

function runStep(state: State, events: AvaEvent[], step: Step) {
  const actors: string[] = [];
  for (const b of step.events) { const ev = b(state); if (ev) { state = applyEvent(state, ev); events = [...events, ev]; if (ev.kind === "action" && ev.actor !== "system" && !actors.includes(ev.actor)) actors.push(ev.actor); } }
  return { state, events, actors };
}
function afterStep(get: () => Store, step: Step, state: State, actors: string[]) {
  const others = actors.filter((a) => a !== get().viewAs);
  return { pulse: { target: step.pulse, n: get().pulse.n + 1 }, viewer: step.reveal?.(state) ?? null, toast: others.length ? { actors: others, n: get().pulse.n + 1 } : null };
}

export const useAva = create<Store>((set, get) => ({
  hydrated: false,
  events: [...SEED_EVENTS],
  state: initialState(),
  viewAs: "karan",
  scenario: "A",
  pos: { A: 0, B: 0 },
  checkpoints: { A: [], B: [] },
  viewer: null,
  pulse: { n: 0 },
  toast: null,
  firePulse: (target) => set({ pulse: { target, n: get().pulse.n + 1 } }),
  dismissToast: () => set({ toast: null }),
  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        set({ ...d, state: replay(d.events), hydrated: true });
        return;
      }
    } catch { /* fall through to seed */ }
    set({ events: [...SEED_EVENTS], state: seedState(), hydrated: true });
  },
  act: (action, actor) => {
    const { state, events, viewAs } = get();
    const at = addMinutes(state.now, 1);
    const ev: AvaEvent = { id: uid("ev"), at, kind: "action", actor: actor ?? viewAs, action };
    const next = applyEvent(state, ev);
    set({ state: next, events: [...events, ev] }); save(get());
  },
  addEmail: (email, extraction, source) => {
    const { state, events } = get();
    const ev: AvaEvent = { id: uid("ev"), at: email.sentAt, kind: "email", email, extraction, extractionSource: source };
    set({ state: applyEvent(state, ev), events: [...events, ev] }); save(get());
  },
  tick: (minutes) => {
    const { state, events } = get();
    const ev: AvaEvent = { id: uid("ev"), at: addMinutes(state.now, minutes), kind: "action", actor: "system", action: { type: "tick" } };
    set({ state: applyEvent(state, ev), events: [...events, ev] }); save(get());
  },
  next: () => {
    const { scenario, pos, checkpoints } = get();
    const steps = STEPS[scenario]; const i = pos[scenario];
    if (i >= steps.length) return;
    let { state, events } = get();
    const cp = { ...checkpoints, [scenario]: [...checkpoints[scenario].slice(0, i), events.length] };
    const r = runStep(state, events, steps[i]); state = r.state; events = r.events;
    set({ state, events, pos: { ...pos, [scenario]: i + 1 }, checkpoints: cp, caption: steps[i].caption, focus: steps[i].focus, ...afterStep(get, steps[i], state, r.actors) });
    save(get());
    return steps[i].focus;
  },
  prev: () => {
    const { scenario, pos, checkpoints, events } = get();
    const i = pos[scenario]; if (i <= 0) return;
    const cut = checkpoints[scenario][i - 1] ?? events.length;
    const kept = events.slice(0, cut);
    const steps = STEPS[scenario];
    set({ events: kept, state: replay(kept), pos: { ...pos, [scenario]: i - 1 }, caption: i - 2 >= 0 ? steps[i - 2].caption : undefined, focus: i - 2 >= 0 ? steps[i - 2].focus : undefined });
    save(get());
  },
  reset: () => {
    set({ events: [...SEED_EVENTS], state: seedState(), pos: { A: 0, B: 0 }, checkpoints: { A: [], B: [] }, caption: "Reset complete. Every composed email and action is cleared. Press Start to begin.", focus: undefined, scenario: "A", viewer: null, toast: null });
    save(get());
  },
  setScenario: (sc) => {
    if (sc === get().scenario) return;
    if (sc === "B") {
      // Scenario B happens after Scenario A in the same world. Finish A first so the timeline stays in order.
      let { state, events, pos, checkpoints } = get();
      const cpA = [...checkpoints.A];
      for (let i = pos.A; i < SCENARIO_A.length; i++) { cpA[i] = events.length; ({ state, events } = runStep(state, events, SCENARIO_A[i])); }
      set({ state, events, scenario: "B", pos: { ...pos, A: SCENARIO_A.length }, checkpoints: { ...checkpoints, A: cpA }, caption: get().pos.B ? SCENARIO_B[get().pos.B - 1].caption : "Scenario A is complete. Press Next to start the Kosha renewal." });
    } else set({ scenario: "A", caption: get().pos.A ? SCENARIO_A[get().pos.A - 1].caption : undefined });
    save(get());
  },
  jumpTo: (sc, step) => {
    // Replay from the seed up to a step, through the same engine. Scenario B runs after all of A.
    let state = seedState(); let events = [...SEED_EVENTS];
    const cp: Record<Scn, number[]> = { A: [], B: [] };
    const run = (k: Scn, n: number) => { for (let i = 0; i < n; i++) { cp[k][i] = events.length; ({ state, events } = runStep(state, events, STEPS[k][i])); } };
    if (sc === "A") run("A", step); else { run("A", SCENARIO_A.length); run("B", step); }
    const st = STEPS[sc][step - 1];
    set({ state, events, scenario: sc, pos: { A: sc === "A" ? step : SCENARIO_A.length, B: sc === "B" ? step : 0 }, checkpoints: cp, caption: st?.caption, focus: st?.focus, ...(st ? { pulse: { target: st.pulse, n: get().pulse.n + 1 }, viewer: st.reveal?.(state) ?? null } : {}) });
    save(get());
    return st?.focus;
  },
  runContrast: () => {
    let { state, events } = get();
    if (!state.threadRequest["t-mkt"]) {
      for (const e of contrastEmails(state.now)) {
        const ev: AvaEvent = { id: `ev-${e.id}`, at: e.sentAt, kind: "email", email: e, extraction: EXTRACTION_CACHE[e.id] ?? null, extractionSource: "cached", tag: "contrast" };
        state = applyEvent(state, ev); events = [...events, ev];
      }
    }
    set({ state, events, viewAs: "ritu", caption: "Repeat work under an existing agreement: one approval, done in minutes. Asking first is faster than signing first." });
    save(get());
  },
  setViewAs: (id) => { set({ viewAs: id }); save(get()); },
  openSource: (s) => set({ viewer: { emailId: s.emailId, attachmentId: (s as any).attachmentId, quote: (s as any).quote, quotes: (s as any).quotes, page: (s as any).page, compareWith: (s as any).compareWith, title: (s as any).title } }),
  closeViewer: () => set({ viewer: null }),
  setAi: (v) => set({ aiAvailable: v }),
}));
