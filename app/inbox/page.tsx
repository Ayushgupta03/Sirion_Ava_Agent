import { redirect } from "next/navigation";

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = new URLSearchParams(await searchParams);
  redirect(`/mail${sp.size ? `?${sp}` : ""}`);
}
