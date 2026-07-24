# Proxy Pull Planner

Telegram Mini App для игроков Zenless Zone Zero: калькулятор круток, календарь
доходов, статистика накоплений и цели с прогнозом.

**Статус:** Stage 5D завершён и проверен (авторизация, калькулятор,
календарь с повторяющимися сериями/исключениями/split-флоу). Статистика
(`src/app/statistics/page.tsx`) — всё ещё заглушка, Stage 6. Подробная
история этапов и известные ограничения — в `DEVELOPMENT_STATUS.md`
(авторитетный источник, синхронизируйте с ним при расхождениях).

## Стек

- Next.js 16 (App Router) + TypeScript strict
- Tailwind CSS v4
- Prisma (Rust-free `prisma-client` generator, `engineType = "client"`) +
  `@prisma/adapter-pg` поверх `pg`, база — Supabase Postgres
- Zod, Vitest

## Быстрый старт

```bash
npm install
cp .env.example .env        # заполните значения, см. ниже
npx prisma generate         # генерирует src/generated/prisma — требует сеть
npx prisma migrate dev      # применяет миграции к DATABASE_URL
npm run dev
```

## Переменные окружения

См. `.env.example`. Коротко:

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | Pooled-строка подключения Supabase Postgres |
| `DIRECT_URL` | Прямая (non-pooled) строка — нужна Prisma для миграций |
| `TELEGRAM_BOT_TOKEN` | Токен бота из @BotFather. Никогда не уходит на клиент |
| `SESSION_SECRET` | Зарезервировано, сейчас не используется (токены сессий — случайные, см. ниже) |
| `NEXT_PUBLIC_APP_URL` | Публичный URL задеплоенного Mini App |
| `DEV_AUTH_ENABLED` / `DEV_TELEGRAM_USER_ID` | Dev-режим авторизации вне Telegram, см. `src/lib/auth/dev-auth.ts` |

## Авторизация и сессии

- `window.Telegram.WebApp.initData` передаётся на сервер как есть и
  проверяется по официальному алгоритму Telegram
  (`src/lib/telegram/verify.ts`) через `TELEGRAM_BOT_TOKEN`.
  `initDataUnsafe` нигде не используется как источник доверия.
- Часовой пояс определяется на клиенте через
  `Intl.DateTimeFormat().resolvedOptions().timeZone` (Telegram его не
  передаёт) и валидируется на сервере; при некорректном значении — fallback
  на UTC.
- Сессия — непрозрачный случайный токен (32 байта) в HttpOnly-cookie;
  в базе хранится только его SHA-256 хеш (`src/lib/auth/session-token.ts`,
  `src/server/repositories/session-repository.ts`).
- Dev-режим (`src/lib/auth/dev-auth.ts`) требует одновременно
  `NODE_ENV=development` и `DEV_AUTH_ENABLED=true`, Telegram ID берётся
  только из `DEV_TELEGRAM_USER_ID` на сервере — из запроса он не
  принимается ни в каком виде.
- Очистка истёкших/отозванных сессий — `purgeStaleSessions()` в
  `session-repository.ts`. Не вызывается на каждый запрос; предполагается
  запуск по расписанию (см. Stage 3 ниже).

## Prisma 7 конфигурация

Начиная с Prisma 7.9.0, `datasource { url / directUrl }` в `schema.prisma`
больше не поддерживается (`P1012`) — строки подключения для CLI-команд
(`generate`/`migrate`/`validate`) заданы в `prisma.config.ts` (читает
`DIRECT_URL`). Runtime `PrismaClient` (`src/lib/db/prisma.ts`) это не
затрагивает — он получает `DATABASE_URL` напрямую через
`@prisma/adapter-pg`.

Текущий статус проверок (полный прогон, включая `prisma generate`):

| Проверка | Статус |
|---|---|
| `npx prisma generate` | **PASSED** |
| `npm run lint` | **PASSED** |
| `npm run test` | **PASSED** |
| `npm run typecheck` | **PASSED** |
| `npm run build` | **PASSED** |

`src/generated/prisma` — сгенерированный клиент, в `.gitignore`;
регенерируйте его после каждого `npm install` командой
`npx prisma generate`.

## Команды

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Структура

```
src/
  app/                  # страницы и API-роуты (App Router)
  components/
    navigation/         # нижняя навигация
    providers/           # ThemeProvider, AuthProvider
    ui/                  # общие UI-примитивы
  config/               # gacha.ts — константы баннеров
  features/
    calculator/         # UI калькулятора круток
    calendar/           # UI календаря: month-grid, day-detail, series/exception/split формы
    profile/            # формы Settings-страницы (pity/ресурсы) с diff-preview
  lib/
    auth/                # сессии, dev-auth
    calendar-math/        # чистая арифметика LocalDate, recurrence, forecast
    gacha-math/           # чистые формулы pity/гарантии/прогноза
    telegram/             # верификация initData, клиентская обёртка
    validation/           # Zod-схемы
    db/                  # Prisma client singleton
    api/                 # общий формат ошибок
  server/
    repositories/        # доступ к БД
    services/            # бизнес-оркестрация (auth, calculator, calendar, banner-state, resource)
  types/                 # окружающие типы (Telegram WebApp)
prisma/
  schema.prisma
```
