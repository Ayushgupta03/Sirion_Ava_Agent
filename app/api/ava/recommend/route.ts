import { NextResponse } from "next/server";
import { PROMPT_VERSION, modelName, runLayer } from "@/lib/aiLayers";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST request context → validated output, or 503/502 so the client falls back to rules.
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI unavailable: no ANTHROPIC_API_KEY set" }, { status: 503 });
  try { return NextResponse.json({ source: "live", promptVersion: PROMPT_VERSION, model: modelName(), result: await runLayer("recommend", await req.json()) }); }
  catch (e: any) { return NextResponse.json({ error: `AI unavailable: ${e?.message ?? "error"}` }, { status: 502 }); }
}
