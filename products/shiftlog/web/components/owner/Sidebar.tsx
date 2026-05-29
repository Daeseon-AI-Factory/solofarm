"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/owner/dashboard", label: "대시보드", emoji: "📊" },
  { href: "/owner/workflows", label: "작업지시서", emoji: "📋" },
  { href: "/owner/history", label: "진행 이력", emoji: "🕒" },
  { href: "/owner/team", label: "알바 관리", emoji: "👥" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] min-h-screen flex flex-col">
      <Link href="/" className="px-6 py-5 flex items-center gap-2 border-b border-[var(--color-border)]">
        <span className="text-2xl">☕</span>
        <span className="text-xl font-semibold tracking-tight">ShiftLog</span>
      </Link>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[var(--color-border)]">
        <Link
          href="/owner/new"
          className="block px-3 py-2.5 rounded-lg bg-[var(--color-accent)] text-white text-sm font-semibold text-center hover:bg-[var(--color-primary-light)] transition-colors"
        >
          + 새 작업지시서
        </Link>
        <div className="mt-3 px-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
          빈조커피 사천점<br />
          <span className="text-[var(--color-text-secondary)]">사장님 모드</span>
        </div>
      </div>
    </aside>
  );
}
