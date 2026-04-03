"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: Route; children: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`rounded-full px-3 py-2 ${
        isActive
          ? "bg-amber-100 font-medium text-amber-950 underline decoration-2 underline-offset-4"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}
