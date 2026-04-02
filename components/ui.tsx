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

export function LoadingBlock({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-slate-50 p-4", className)}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-1 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500"
        />
        <div>
          <p className="text-sm font-medium text-slate-900">{title}</p>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
