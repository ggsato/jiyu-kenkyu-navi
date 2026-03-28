import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">{children}</main>;
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("rounded-3xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</section>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-slate-900">{children}</h2>;
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">{children}</span>;
}
