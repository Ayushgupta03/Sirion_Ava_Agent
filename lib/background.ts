// Background requests: other teams' work, shown so the dashboard looks like a real week. Not part of the guided demo
// and not fed to the engine, so they never change the scenario numbers.
import data from "@/data/background.json";
export interface BgRequest { id: string; supplier: string; category: string; project: string; requester: string; dept: string; stage: string; waitingOn: string; amount: number; createdAt: string; routes: string[] }
export const BACKGROUND = data as BgRequest[];
