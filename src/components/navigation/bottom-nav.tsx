"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calculator, CalendarDays, BarChart3, Settings } from "lucide-react";
import { triggerHapticImpact } from "@/lib/telegram/webapp";
import { onboardingTargetAttr } from "@/components/onboarding/target-attach";
import type { OnboardingTargetId } from "@/lib/onboarding/targets";

const TABS: ReadonlyArray<{
  href: string;
  label: string;
  Icon: typeof Home;
  onboardingTarget?: OnboardingTargetId;
}> = [
  { href: "/", label: "Главная", Icon: Home },
  { href: "/calculator", label: "Калькулятор", Icon: Calculator, onboardingTarget: "calculator-tab" },
  { href: "/calendar", label: "Календарь", Icon: CalendarDays, onboardingTarget: "calendar-tab" },
  { href: "/statistics", label: "Статистика", Icon: BarChart3, onboardingTarget: "statistics-tab" },
  { href: "/settings", label: "Настройки", Icon: Settings, onboardingTarget: "settings-tab" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80"
      // --tg-safe-area-inset-bottom (ThemeProvider, via WebApp.safeAreaInset)
      // is Telegram's own reported inset, preferred when present since it
      // accounts for Telegram's in-app chrome, not just the OS's. Falls
      // back to the plain CSS env() value outside Telegram or on older
      // clients that don't report it.
      style={{ paddingBottom: "var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom))" }}
      aria-label="Основная навигация"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {TABS.map(({ href, label, Icon, onboardingTarget }) => {
          const isActive = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => triggerHapticImpact("light")}
                className="flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors"
                aria-current={isActive ? "page" : undefined}
                {...(onboardingTarget ? onboardingTargetAttr(onboardingTarget) : {})}
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
