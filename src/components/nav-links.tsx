"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks() {
  const path = usePathname();
  return (
    <>
      <Link href="/" aria-current={path === "/" ? "page" : undefined}>Pipeline</Link>
      <Link href="/activity" aria-current={path.startsWith("/activity") ? "page" : undefined}>Activity</Link>
    </>
  );
}
