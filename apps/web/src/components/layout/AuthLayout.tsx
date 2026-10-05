import React from "react";
import { BrandMark } from "../shared/BrandMark";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--canvas)]">
      <div className="flex w-full max-w-md flex-col items-center px-4 py-8 sm:px-8">
        <div className="mb-4">
          <BrandMark />
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-widest text-[var(--ink)]">NEXUS</h1>
        <p className="mb-8 text-sm text-[var(--ink-disabled)] tracking-widest">
          INCIDENT CONTROL
        </p>
        <div className="w-full rounded-lg border border-[var(--border)] bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
