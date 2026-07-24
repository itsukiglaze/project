import type { LucideIcon } from "lucide-react";

export function ComingSoon({
  Icon,
  title,
  description,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-24 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-contrast text-background">
        <Icon size={28} />
        <span className="absolute -right-1 -top-1 h-3 w-3 rotate-45 rounded-[3px] bg-accent-yellow" />
      </div>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-xs text-sm text-muted">{description}</p>
      <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wide text-muted">
        В разработке
      </span>
    </div>
  );
}
