"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calculator, CalendarDays, BarChart3, Settings } from "lucide-react";
import { triggerHapticImpact } from "@/lib/telegram/webapp";

const TABS = [
  { href: "/", label: "Главная", Icon: Home },
  { href: "/calculator", label: "Калькулятор", Icon: Calculator },
  { href: "/calendar", label: "Календарь", Icon: CalendarDays },
  { href: "/statistics", label: "Статистика", Icon: BarChart3 },
  { href: "/settings", label: "Настройки", Icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Основная навигация"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => triggerHapticImpact("light")}
                className="flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors"
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                    isActive
                      ? "bg-accent-yellow text-black"
                      : "text-muted"
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span className={isActive ? "text-foreground" : "text-muted"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
