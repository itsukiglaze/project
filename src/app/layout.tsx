import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { BottomNav } from "@/components/navigation/bottom-nav";

export const metadata: Metadata = {
  title: "Proxy Pull Planner",
  description: "Планировщик круток для Zenless Zone Zero",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {/* beforeInteractive: downloaded and executed before any Next.js
            module runs, so window.Telegram.WebApp exists (or is at least
            in the process of being set up) as early as possible, ahead of
            AuthProvider's own bounded wait (waitForTelegramLaunch) — that
            wait is still the actual robustness mechanism (this script tag
            alone can't guarantee WebApp.initData is *populated* yet, only
            that the script itself has run), but loading it this early
            minimizes how much of that bounded window gets used. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <ThemeProvider>
          <AuthProvider>
            <main className="mx-auto w-full max-w-lg flex-1 pb-24">{children}</main>
            <BottomNav />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
