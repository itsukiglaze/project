import { CurrencyType, IncomeSource, RecurrenceFrequency, TransactionType } from "@/lib/calendar-math";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.INCOME]: "Доход",
  [TransactionType.EXPENSE]: "Расход",
  [TransactionType.PULL]: "Крутка",
};

export const CURRENCY_TYPE_LABELS: Record<CurrencyType, string> = {
  [CurrencyType.POLYCHROME]: "Полихромы",
  [CurrencyType.ENCRYPTED_MASTER_TAPE]: "Шифр-кассеты",
  [CurrencyType.MASTER_TAPE]: "Обычные кассеты",
  [CurrencyType.BOOPON]: "Boopon",
  [CurrencyType.MONOCHROME]: "Монокромы",
};

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  [IncomeSource.DAILY]: "Ежедневные задания",
  [IncomeSource.EVENT]: "Событие",
  [IncomeSource.QUEST]: "Задание",
  [IncomeSource.ENDGAME]: "Эндгейм-контент",
  [IncomeSource.MAIL]: "Почта",
  [IncomeSource.PROMO_CODE]: "Промокод",
  [IncomeSource.BATTLE_PASS]: "Боевой пропуск",
  [IncomeSource.MEMBERSHIP]: "Подписка",
  [IncomeSource.PURCHASE]: "Покупка",
  [IncomeSource.OTHER]: "Другое",
};

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  [RecurrenceFrequency.DAILY]: "Ежедневно",
  [RecurrenceFrequency.WEEKLY]: "Еженедельно",
  [RecurrenceFrequency.MONTHLY]: "Ежемесячно",
};

export const WEEKDAY_SHORT_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
export const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

/** Genitive case ("25 июля", not "25 Июль") — for plain-Russian date headings, see date-format.ts. */
export const MONTH_LABELS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
