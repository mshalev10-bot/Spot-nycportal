import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { getSnapshot } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="skeleton" />}>
      <HomeBody searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeBody({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const snapshot = await getSnapshot();
  return <Dashboard snapshot={snapshot} initialParams={query.toString()} />;
}
