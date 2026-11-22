"use client";
// The pipeline board. A request's column is worked out by the rules from its facts, approvals and conflicts, so a card
// cannot be dragged to a new stage by hand. Dragging still does two useful things: dropping on a person hands over what
// is waiting on you, and dropping on a column says why the rules put the request where it is.
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useAva } from "@/lib/store";
import { analyze, type Analysis } from "@/lib/engine/rules";
import { COLS, LABEL, HINT, colOf, whyHere, whyNotMove, type Col } from "@/lib/board";
import { deriveItems, type Item } from "@/lib/engine/items";
import { person, personName } from "@/lib/engine/world";
import { BACKGROUND, type Bg } from "@/lib/background";
import { scenarioTag } from "@/lib/summary";
import { hoursBetween, lakh, opened } from "@/lib/format";
import { Chip, cx, StateChip, supplierShort } from "./ui";
import { Icon } from "./icons";
import { initials, VIEW_AS } from "./Shell";

type Notice = { tone: "info" | "ok"; text: string; reqId?: string } | null;

export default function Board() {
  const state = useAva((s) => s.state); const viewAs = useAva((s) => s.viewAs); const act = useAva((s) => s.act);
  const [mineOnly, setMineOnly] = useState(false);
  const [showSample, setShowSample] = useState(true);
  const [active, setActive] = useState<Col>("Waiting on someone");
  const [peek, setPeek] = useState<{ id: string; live: boolean } | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { try { setShowSample(localStorage.getItem("ava.board.sample") !== "0"); } catch { /* storage blocked */ } }, []);
  const toggleSample = () => { const v = !showSample; setShowSample(v); try { localStorage.setItem("ava.board.sample", v ? "1" : "0"); } catch { /* storage blocked */ } };
  const say = (n: Notice) => { setNotice(n); if (timer.current) clearTimeout(timer.current); if (n) timer.current = setTimeout(() => setNotice(null), 9000); };

  const items = useMemo(() => deriveItems(state), [state]);
  const all = useMemo(() => state.requestOrder.map((id) => analyze(state, id)), [state]);
  const mineIds = useMemo(() => new Set(items.filter((i) => i.personId === viewAs && i.requestId).map((i) => i.requestId!)), [items, viewAs]);
  const bgMine = (b: Bg) => b.needs.some((n) => n.personId === viewAs);
  const live = all.filter((a) => !mineOnly || mineIds.has(a.req.id));
  const bg = showSample ? BACKGROUND.filter((b) => !mineOnly || bgMine(b)) : [];
  const hiddenSample = showSample ? 0 : BACKGROUND.length;

  const onDropColumn = (e: DragEvent, col: Col) => {
    e.preventDefault(); setOver(null); const id = drag; setDrag(null); if (!id) return;
    const a = all.find((x) => x.req.id === id); if (!a || colOf(a.pipeline) === col) return;
    say({ tone: "info", text: whyNotMove(a, col), reqId: id });
  };
  const handOver = (reqId: string, to: string) => {
    const mine = items.filter((i) => i.requestId === reqId && i.personId === viewAs);
    if (to === viewAs) return;
    if (!mine.length) { const a = all.find((x) => x.req.id === reqId); say({ tone: "info", text: `You have nothing on ${reqId} to hand over.${a?.waitingOn ? ` It is waiting on ${a.waitingOn}.` : ""}`, reqId }); return; }
    mine.forEach((i) => act({ type: "reassign", itemKey: i.key, to }));
    say({ tone: "ok", text: `Handed ${mine.length} item${mine.length === 1 ? "" : "s"} on ${reqId} to ${personName(to)}. They now appear on their Today page.`, reqId });
  };
  const onDropPerson = (e: DragEvent, to: string) => { e.preventDefault(); setOver(null); const id = drag; setDrag(null); if (id) handOver(id, to); };

  const peekA = peek?.live ? all.find((a) => a.req.id === peek.id) : undefined;
  const peekB = peek && !peek.live ? BACKGROUND.find((b) => b.id === peek.id) : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <div role="group" aria-label="Which requests" className="flex rounded-md bg-slate-100 p-0.5">
          {([[false, "Everything"], [true, "Waiting on me"]] as const).map(([v, l]) => <button key={l} aria-pressed={mineOnly === v} onClick={() => setMineOnly(v)} className={cx("rounded px-3 py-1", mineOnly === v ? "bg-white font-semibold shadow-sm" : "text-slate-600")}>{l}</button>)}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-slate-600"><input type="checkbox" checked={showSample} onChange={toggleSample} /> Sample requests from other teams{hiddenSample > 0 && <span className="text-slate-400">({hiddenSample} hidden)</span>}</label>
        <span className="hidden text-[12.5px] text-slate-500 lg:inline">Click a card for the detail. Drag a card onto a person to hand over what waits on you.</span>
      </div>

      {notice && <div role="status" className={cx("mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]", notice.tone === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-white text-slate-800")}>
        <Icon name={notice.tone === "ok" ? "check" : "spark"} size={15} className="mt-0.5 shrink-0" />
        <span className="flex-1">{notice.text}{notice.reqId && <> <Link className="font-medium text-accent hover:underline" href={`/requests/${notice.reqId}`}>Open {notice.reqId}</Link></>}</span>
        <button onClick={() => say(null)} aria-label="Dismiss" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100"><Icon name="x" size={13} /></button>
      </div>}

      {drag && <div aria-hidden className="mb-3 rounded-lg border border-dashed border-accent/50 bg-accent-50/60 p-2">
        <div className="mb-1.5 text-[12px] font-medium text-accent-700">Drop on a person to hand over what is waiting on you on this request</div>
        <div className="flex flex-wrap gap-1.5">{VIEW_AS.filter((v) => v.id !== viewAs).map((v) => (
          <div key={v.id} onDragOver={(e) => { e.preventDefault(); setOver(`p:${v.id}`); }} onDragLeave={() => setOver(null)} onDrop={(e) => onDropPerson(e, v.id)} className={cx("flex items-center gap-1.5 rounded-full border bg-white py-1 pl-1 pr-2.5 text-[12.5px]", over === `p:${v.id}` ? "border-accent ring-2 ring-accent/30" : "border-slate-300")}>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[10.5px] font-semibold text-slate-700">{initials(v.id)}</span>{person(v.id)?.name.split(" ")[0]}
          </div>))}</div>
      </div>}

      <div role="tablist" aria-label="Stage" className="mb-2 flex gap-1 overflow-x-auto sm:hidden">
        {COLS.map((c) => { const n = live.filter((a) => colOf(a.pipeline) === c).length + bg.filter((b) => b.stage === c).length; return <button key={c} role="tab" aria-selected={active === c} onClick={() => setActive(c)} className={cx("whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px]", active === c ? "bg-accent-50 font-semibold text-accent-700" : "text-slate-600")}>{LABEL[c]} <span className="tabular text-slate-400">{n}</span></button>; })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {COLS.map((col) => {
          const cards = live.filter((a) => colOf(a.pipeline) === col); const sample = bg.filter((b) => b.stage === col);
          return (
            <div key={col} onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(`c:${col}`); } }} onDragLeave={() => setOver(null)} onDrop={(e) => onDropColumn(e, col)}
              className={cx("min-w-0 rounded-xl p-2", active === col ? "block" : "hidden sm:block", over === `c:${col}` ? "bg-accent-50 ring-2 ring-accent/30" : "bg-slate-100/80")}>
              <div className="mb-2 px-1" title={HINT[col]}>
                <div className="flex items-center justify-between text-[12.5px] font-semibold text-slate-700"><span>{LABEL[col]}</span><span className="tabular text-slate-500">{cards.length + sample.length}</span></div>
                <p className="mt-0.5 hidden text-[11.5px] leading-snug text-slate-500 lg:block">{HINT[col]}</p>
              </div>
              <div className="space-y-2">
                {cards.map((a) => <LiveCard key={a.req.id} a={a} col={col} selected={peek?.id === a.req.id} dragging={drag === a.req.id} onOpen={() => setPeek({ id: a.req.id, live: true })} onDragStart={() => { setDrag(a.req.id); setNotice(null); }} onDragEnd={() => { setDrag(null); setOver(null); }} />)}
                {sample.map((b) => <SampleCard key={b.id} b={b} selected={peek?.id === b.id} onOpen={() => setPeek({ id: b.id, live: false })} />)}
                {cards.length + sample.length === 0 && <p className="px-1 py-6 text-center text-[12px] text-slate-400">{mineOnly ? "Nothing here is waiting on you." : "None"}</p>}
              </div>
            </div>);
        })}
      </div>

      {(peekA || peekB) && <Peek a={peekA} b={peekB} items={items} onClose={() => setPeek(null)} onHandOver={handOver} />}
    </div>
  );
}

function LiveCard({ a, col, selected, dragging, onOpen, onDragStart, onDragEnd }: { a: Analysis; col: Col; selected: boolean; dragging: boolean; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const state = useAva((s) => s.state);
  const sup = state.suppliers.find((s) => s.id === a.req.supplierId);
  const openConf = Object.values(state.conflicts).filter((c) => c.requestId === a.req.id && c.status === "open").length;
  return (
    <button type="button" draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.req.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }} onDragEnd={onDragEnd} onClick={onOpen}
      aria-label={`${a.req.id}, ${supplierShort(sup?.name ?? a.req.supplierGuess?.name)}, ${a.req.project}. ${LABEL[col]}. Open the detail.`}
      className={cx("block w-full cursor-grab rounded-lg border bg-white p-2.5 text-left text-[12.5px] shadow-sm hover:border-accent active:cursor-grabbing", dragging && "opacity-40", selected ? "border-accent ring-2 ring-accent/30" : col === "Blocked" ? "border-red-300" : col === "Ready" ? "border-emerald-300" : "border-slate-300")}>
      <div className="truncate font-semibold text-slate-900">{supplierShort(sup?.name ?? a.req.supplierGuess?.name)}</div>
      <div className="truncate text-slate-600">{a.req.project}</div>
      <div className="mt-1 font-mono">{lakh(a.requestAmount)} · 90d {lakh(a.spend.total)}</div>
      <div className="mt-1 flex flex-wrap gap-1">{openConf > 0 && <Chip tone="red">{openConf} conflict{openConf > 1 ? "s" : ""}</Chip>}{a.routing.approvals.some((x) => x.key === "vp") && <Chip tone="grey">VP</Chip>}{a.routing.needsInfosec && <Chip tone="grey">InfoSec</Chip>}{a.req.startedBeforeApproval && <Chip tone="red">Early start</Chip>}</div>
      {a.waitingOn && <div className="mt-1 font-medium text-slate-800">{col === "Ready" ? a.waitingOn : `Waiting on ${a.waitingOn}`}</div>}
      <div className="mt-1 flex items-center justify-between gap-1 text-slate-400"><span className="truncate">{a.req.id} · {opened(hoursBetween(a.req.createdAt, a.req.readyAt ?? state.now))}</span><Chip tone="blue">{scenarioTag(state, a.req.id)}</Chip></div>
    </button>
  );
}

function SampleCard({ b, selected, onOpen }: { b: Bg; selected: boolean; onOpen: () => void }) {
  const now = useAva((s) => s.state.now);
  return (
    <button type="button" onClick={onOpen} aria-label={`Sample request ${b.id}, ${b.supplier}, ${b.project}. Open the detail.`} className={cx("block w-full rounded-lg border bg-white/70 p-2.5 text-left text-[12.5px] text-slate-600 hover:border-accent", selected ? "border-accent ring-2 ring-accent/30" : "border-slate-200")}>
      <div className="truncate font-semibold text-slate-700">{b.supplier}</div>
      <div className="truncate">{b.project}</div>
      <div className="mt-1 font-mono">{lakh(b.amount)}</div>
      <div className="mt-0.5 font-medium text-slate-700">{b.stage === "Ready" ? b.waitingOn : `Waiting on ${b.waitingOn}`}</div>
      <div className="mt-0.5 flex items-center justify-between gap-1 text-slate-400"><span className="truncate">{b.id} · {opened(hoursBetween(b.createdAt, now))}</span><span className="shrink-0 rounded bg-slate-100 px-1 text-[10.5px] text-slate-500">Sample</span></div>
    </button>
  );
}

/** The detail drawer: why the request is here, what is open and who has it, and the way out to the full page. */
function Peek({ a, b, items, onClose, onHandOver }: { a?: Analysis; b?: Bg; items: Item[]; onClose: () => void; onHandOver: (reqId: string, to: string) => void }) {
  const state = useAva((s) => s.state); const viewAs = useAva((s) => s.viewAs);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus(); const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const id = a?.req.id ?? b?.id ?? "";
  const mine = items.filter((i) => i.requestId === id && i.personId === viewAs);
  const open = items.filter((i) => i.requestId === id);
  const conflicts = a ? Object.values(state.conflicts).filter((c) => c.requestId === id && c.status === "open") : [];
  return (
    <>
      <div className="fixed inset-0 z-30 bg-slate-900/20" onClick={onClose} aria-hidden />
      <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${id} detail`} className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[400px] flex-col border-l border-slate-200 bg-white shadow-xl outline-none">
        <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0"><div className="font-mono text-[12.5px] text-slate-500">{id}</div><h2 className="text-[15px] font-semibold leading-snug">{a ? a.req.title : `${b!.supplier}: ${b!.project}`}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{a ? <StateChip state={a.handoff.state} /> : <Chip>Sample request</Chip>}{a && <span className="font-mono text-[12.5px]">{lakh(a.requestAmount)} · 90d {lakh(a.spend.total)}</span>}</div></div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded text-slate-500 hover:bg-slate-100"><Icon name="x" size={16} /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-auto px-4 py-3 text-[13px]">
          {a && <section><h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Why it is in {LABEL[colOf(a.pipeline)]}</h3><p>{whyHere(a)}</p></section>}
          {b && <section><p>{b.stage === "Ready" ? b.waitingOn : `Waiting on ${b.waitingOn}`}. {b.requester}, {b.dept}.</p>{b.atRisk && <p className="mt-1 text-amber-900">{b.atRisk}</p>}<p className="mt-2 text-[12.5px] text-slate-500">Sample request from another team, outside the guided demo.</p></section>}
          {a && <section><h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Who has the next step</h3>
            {open.length === 0 ? <p className="text-slate-600">{a.waitingOn ? `${a.waitingOn}.` : "Nobody. It is moving on its own."}</p> : <ul className="space-y-1.5">{open.map((i) => <li key={i.key} className="rounded-md bg-slate-50 px-2.5 py-1.5"><b>{personName(i.personId)}</b>: {i.question}</li>)}</ul>}</section>}
          {conflicts.length > 0 && <section><h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Open conflicts</h3><ul className="space-y-1">{conflicts.map((c) => <li key={c.id}><Link className="text-accent hover:underline" href={`/requests/${id}#conflicts`}>{c.title}</Link></li>)}</ul></section>}
          {a && mine.length > 0 && <section><h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Hand over</h3>
            <label className="block text-slate-700">You have {mine.length} item{mine.length === 1 ? "" : "s"} on this request. Give {mine.length === 1 ? "it" : "them"} to
              <select aria-label="Hand over to" defaultValue="" onChange={(e) => { if (e.target.value) { onHandOver(id, e.target.value); onClose(); } }} className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-1.5"><option value="">Choose a person…</option>{VIEW_AS.filter((v) => v.id !== viewAs).map((v) => <option key={v.id} value={v.id}>{person(v.id)?.name} · {v.role}</option>)}</select></label></section>}
        </div>
        <footer className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-3">
          <Link href={`/requests/${id}`} className="rounded-md bg-accent px-3 py-2 text-[13px] font-semibold text-white hover:bg-accent-700">Open {id}</Link>
          {mine.length > 0 && <Link href="/today" className="rounded-md border border-slate-300 px-3 py-2 text-[13px] font-medium hover:bg-slate-50">Go to my decisions</Link>}
        </footer>
      </aside>
    </>
  );
}
