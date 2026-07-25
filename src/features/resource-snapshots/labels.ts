import { CurrencyType } from "@/lib/calendar-math";

export { CURRENCY_TYPE_LABELS } from "@/features/calendar/labels";

/** Display order for the snapshot form/cards — Polychrome first (the primary currency), Monochrome last. */
export const SNAPSHOT_CURRENCY_ORDER: CurrencyType[] = [
  CurrencyType.POLYCHROME,
  CurrencyType.ENCRYPTED_MASTER_TAPE,
  CurrencyType.MASTER_TAPE,
  CurrencyType.BOOPON,
  CurrencyType.MONOCHROME,
];

/** "+420" / "−160" / "Без изменений" — never a bare signless number for a nonzero delta. */
export function formatDelta(delta: number): string {
  if (delta === 0) return "Без изменений";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toLocaleString("ru-RU")}`;
}

/** Russian plural form of "день" (day) for a given count. */
export function pluralDays(n: number): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

export function daysAgoLabel(days: number): string {
  return `Прошло ${days} ${pluralDays(days)}`;
}
