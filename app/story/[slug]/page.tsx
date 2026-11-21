"use client";
import { useParams } from "next/navigation";
import { Assumptions, Metrics, Problem, Sirion, Stakeholders, WhyIntake } from "@/components/casePages";
import { Empty } from "@/components/ui";

const PAGES: Record<string, () => React.JSX.Element> = { why: WhyIntake, problem: Problem, stakeholders: Stakeholders, metrics: Metrics, assumptions: Assumptions, sirion: Sirion };

export default function StoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const P = PAGES[slug];
  return P ? <P /> : <Empty>This chapter does not exist.</Empty>;
}
