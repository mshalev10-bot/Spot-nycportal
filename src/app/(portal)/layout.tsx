import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { currentSession } from "@/lib/current-user";
import { isDemoMode } from "@/lib/mode";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/login");
  return (
    <Shell user={session} mode={isDemoMode() ? "demo" : "live"}>
      {children}
    </Shell>
  );
}
