// Shapes of the AI layers (Part 3 and Part 7). The same shapes come from the live model, the cache, or the rules fallback.
export type AiSource = "live" | "cached" | "rules";
export interface Cite { type: "email" | "doc" | "clause"; id: string; quote?: string }
export interface AiRead { sentences: { text: string; citations: Cite[] }[]; risks: string[] }
export type StepStatus = "done" | "in_progress" | "blocked" | "todo";
export interface PlanStep { id: string; title: string; ownerId: string; source: "policy" | "ava"; reason?: string; dependsOn: string[]; status: StepStatus; eta?: string }
export interface AiPlan { steps: PlanStep[]; criticalPath: string[]; predictedReady: string; predictionReason: string; changesSinceLast: string[] }
export type RecAction = "draft_supplier" | "ask_requester" | "require_cr" | "ask_legal" | "approve" | "review";
export interface AiRec { recommendation: string; reasoning: string; citations: Cite[]; confidence: "high" | "medium" | "low"; draft?: string; action?: RecAction; bullets?: string[] }
export interface Versioned<T> { at: string; source: AiSource; fingerprint: string; output: T; changes?: string[]; used?: { by: string; at: string }; dismissed?: { by: string; at: string; reason: string } }
export interface AiState { reads: Record<string, Versioned<AiRead>[]>; plans: Record<string, Versioned<AiPlan>[]>; recs: Record<string, Versioned<AiRec>> }
