import type { ReactNode } from "react";

interface AdminPageProps {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: "medium" | "wide";
}

export default function AdminPage({
  title,
  description,
  eyebrow,
  actions,
  children,
  maxWidth = "medium",
}: AdminPageProps) {
  return (
    <div
      className={`mx-auto w-full p-4 sm:p-6 md:p-8 ${
        maxWidth === "wide" ? "max-w-6xl" : "max-w-4xl"
      }`}
    >
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 md:mb-8">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-bold tracking-[0.14em]" style={{ color: "#9A541B" }}>
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: "#1F3D12" }}>
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "#66705F" }}>
            {description}
          </p>
        </div>
        {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

