// Other teams' requests in the same week. Static sample data with cached AI outputs (Part 5, background).
import data from "@/data/background.json";
import { hoursBetween } from "./format";

export interface BgStep { title: string; ownerId: string; source: "policy" | "ava"; eta?: string | null; status: string; reason?: string | null }
export interface BgSide { label: string; quote: string; clause?: string }
export interface BgConflict { title: string; type?: string; a: BgSide; b: BgSide; clauses: string[]; impactText: string; impact?: number; risk?: boolean; rec: { recommendation: string; reasoning: string; confidence: "high" | "medium" | "low"; draft?: string } }
export interface BgNeed { personId: string; kind: string; question: string; rec?: { recommendation: string; reasoning?: string; confidence: "high" | "medium" | "low"; draft?: string; bullets?: string[] } }
export interface Bg {
  id: string; supplier: string; category: string; project: string; requester: string; dept: string; stage: string; waitingOn: string; amount: number; createdAt: string; routes: string[]; endState?: "legal";
  read: string[]; plan: { predictedReady: string; predictionReason: string; steps: BgStep[] }; conflict?: BgConflict; atRisk?: string; needs: BgNeed[];
  avaDid: { at: string; text: string; for: string[] }[]; checks: number; avaActions: number; decisions: number;
}
export const BACKGROUND = data as unknown as Bg[];

/** 90-day total per supplier and department, computed from the background requests. */
export function bgTotal90(b: Bg, now: string) {
  return BACKGROUND.filter((x) => x.supplier === b.supplier && x.dept === b.dept && hoursBetween(x.createdAt, now) <= 90 * 24).reduce((s, x) => s + x.amount, 0);
}
export const bgState = (b: Bg) => b.stage === "Ready" ? (b.endState === "legal" ? "ready_legal" : "ready_po") : b.stage === "Blocked" ? "blocked" : "in_progress";
export const BG_CONFLICTS = BACKGROUND.filter((b) => b.conflict).map((b) => ({ req: b, c: b.conflict! }));
export const BG_TOTALS = {
  avaActions: BACKGROUND.reduce((s, b) => s + b.avaActions, 0),
  decisions: BACKGROUND.reduce((s, b) => s + b.decisions, 0),
  checks: BACKGROUND.reduce((s, b) => s + b.checks, 0),
  atStake: BG_CONFLICTS.reduce((s, x) => s + (x.c.impact ?? 0), 0),
};
