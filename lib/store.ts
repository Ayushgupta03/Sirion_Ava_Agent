"use client";
// Client store: an event log persisted to localStorage. Every screen reads state computed by the engine.
import { create } from "zustand";
import type { AiMeta } from "./promptVersion";
import type { Action, AvaEvent, Email, Extraction, ExtractionSource, Source, State, ViewerTarget } from "./types";
import { applyEvent, initialState, replay } from "./engine/pipeline";
import { deriveItems, type ItemKind } from "./engine/items";
import { SCENARIO_A, SCENARIO_B, SEED_EVENTS, type Step } from "./story";
import { contrastEmails } from "./scripted";
import { EXTRACTION_CACHE } from "./cache";
import { addMinutes, uid } from "./format";

const KEY = "ava-prototype-v1";
// Who you are is per window (sessionStorage); the event log is shared by every window of this browser (localStorage).
const VIEW_KEY = "ava-view-as";
const readView = () => { try { return sessionStorage.getItem(VIEW_KEY) ?? undefined; } catch { return undefined; } };
const writeView = (id: string) => { try { sessionStorage.setItem(VIEW_KEY, id); } catch { /* blocked */ } };

export interface RippleRow { personId: string; opened: { kind: ItemKind; text: string }[]; closed: { kind: ItemKind; text: string }[] }
export interface Ripple { n: number; actor: string; label: string; rows: RippleRow[] }

/** Who a change reached: the difference in each person's open items before and after. This is the stakeholder connection, made visible. */
export function rippleBetween(prev: State, next: State, actor: string, label: string, n: number): Ripple | null {
  const a = new Map(deriveItems(prev).map((i) => [i.key, i])); const b = new Map(deriveItems(next).map((i) => [i.key, i]));
  const rows = new Map<string, RippleRow>();
  const row = (id: string) => { let r = rows.get(id); if (!r) rows.set(id, (r = { personId: id, opened: [], closed: [] })); return r; };
  for (const [k, it] of b) if (!a.has(k)) row(it.personId).opened.push({ kind: it.kind, text: it.question });
  for (const [k, it] of a) if (!b.has(k)) row(it.personId).closed.push({ kind: it.kind, text: it.question });
  const list = [...rows.values()].filter((r) => r.personId !== actor);
  return list.length ? { n, actor, label, rows: list } : null;
}
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
  ripple: Ripple | null;
  dismissRipple: () => void;
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
  addAi: (requestId: string, layer: "read" | "plan" | "rec", key: string, output: unknown, source: "live" | "cached" | "rules", meta?: AiMeta) => void;
}

export const STEPS: Record<Scn, Step[]> = { A: SCENARIO_A, B: SCENARIO_B };

const LABEL: Partial<Record<Action["type"], string>> = {
  approve: "approved", answer_flag: "answered a question", resolve_conflict: "resolved a conflict", mark_sent: "sent a draft", rec_use: "used Ava's recommendation",
  require_cr: "required a change request", ask_legal: "asked Legal", ask_supplier: "asked for a supplier draft", record_exception: "recorded an exception", competing_quote: "attached a competing quote",
  escalate: "escalated", orphan_confirm: "confirmed an invoice", comment: "commented", reassign: "reassigned an item",
};
const labelOf = (a: Action) => LABEL[a.type] ?? a.type.replace(/_/g, " ");

/** Another window of this browser changed the shared event log: follow it, but stay as the person this window is viewing. */
let listening = false;
function listen(get: () => Store, set: (p: Partial<Store>) => void) {
  if (listening || typeof window === "undefined") return; listening = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const d = JSON.parse(e.newValue); const prev = get().state; const next = replay(d.events);
      const rp = rippleBetween(prev, next, "none", "Changed in another window", get().pulse.n + (get().ripple?.n ?? 0) + 1);
      set({ events: d.events, state: next, pos: d.pos, checkpoints: d.checkpoints, scenario: d.scenario, caption: d.caption, ...(rp ? { ripple: rp } : {}) });
    } catch { /* ignore a half-written value */ }
  });
}

function seedState() { return SEED_EVENTS.reduce(applyEvent, initialState()); }

function save(s: Pick<Store, "events" | "scenario" | "pos" | "checkpoints" | "caption">) {
  try { localStorage.setItem(KEY, JSON.stringify({ events: s.events, scenario: s.scenario, pos: s.pos, checkpoints: s.checkpoints, caption: s.caption })); } catch { /* storage full or blocked */ }
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
  ripple: null,
  dismissRipple: () => set({ ripple: null }),
  firePulse: (target) => set({ pulse: { target, n: get().pulse.n + 1 } }),
  dismissToast: () => set({ toast: null }),
  hydrate: () => {
    if (get().hydrated) return;
    const view = readView();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        set({ ...d, viewAs: view ?? d.viewAs ?? "karan", state: replay(d.events), hydrated: true });
        listen(get, set);
        return;
      }
    } catch { /* fall through to seed */ }
    set({ events: [...SEED_EVENTS], state: seedState(), viewAs: view ?? "karan", hydrated: true });
    listen(get, set);
  },
  act: (action, actor) => {
    const { state, events, viewAs } = get();
    const at = addMinutes(state.now, 1);
    const ev: AvaEvent = { id: uid("ev"), at, kind: "action", actor: actor ?? viewAs, action };
    const next = applyEvent(state, ev);
    const rp = ev.actor !== "system" ? rippleBetween(state, next, ev.actor, labelOf(action), get().pulse.n + (get().ripple?.n ?? 0) + 1) : null;
    set({ state: next, events: [...events, ev], ...(rp ? { ripple: rp } : {}) }); save(get());
  },
  addEmail: (email, extraction, source) => {
    const { state, events } = get();
    const ev: AvaEvent = { id: uid("ev"), at: email.sentAt, kind: "email", email, extraction, extractionSource: source };
    const next = applyEvent(state, ev);
    const rp = rippleBetween(state, next, email.origin === "intake" ? get().viewAs : "none", email.origin === "intake" ? "started a request in Ask Ava" : `Email arrived: ${email.subject}`, get().pulse.n + (get().ripple?.n ?? 0) + 1);
    set({ state: next, events: [...events, ev], ...(rp ? { ripple: rp } : {}) }); save(get());
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
    const before = state;
    const r = runStep(state, events, steps[i]); state = r.state; events = r.events;
    const rp = rippleBetween(before, state, "none", steps[i].caption, get().pulse.n + (get().ripple?.n ?? 0) + 1);
    set({ ...(rp ? { ripple: rp } : {}), state, events, pos: { ...pos, [scenario]: i + 1 }, checkpoints: cp, caption: steps[i].caption, focus: steps[i].focus, ...afterStep(get, steps[i], state, r.actors) });
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
    writeView("ritu"); set({ state, events, viewAs: "ritu", caption: "Repeat work under an existing agreement: one approval, done in minutes. Asking first is faster than signing first." });
    save(get());
  },
  setViewAs: (id) => { writeView(id); set({ viewAs: id }); },
  openSource: (s) => set({ viewer: { docId: (s as any).docId, clause: (s as any).clause, emailId: s.emailId, attachmentId: (s as any).attachmentId, quote: (s as any).quote, quotes: (s as any).quotes, page: (s as any).page, compareWith: (s as any).compareWith, title: (s as any).title } }),
  closeViewer: () => set({ viewer: null }),
  setAi: (v) => set({ aiAvailable: v }),
  addAi: (requestId, layer, key, output, source, meta) => {
    const { state, events } = get();
    const ev: AvaEvent = { id: uid("ev"), at: state.now, kind: "ai", requestId, layer, key, output, source, promptVersion: meta?.promptVersion, model: meta?.model };
    set({ state: applyEvent(state, ev), events: [...events, ev] }); save(get());
  },
}));
