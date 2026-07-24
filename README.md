# Proxy Pull Planner

Telegram Mini App для игроков Zenless Zone Zero: калькулятор круток, календарь
доходов, статистика накоплений и цели с прогнозом.

**Статус:** Stage 2 (каркас: авторизация через Telegram, безопасные сессии,
базовый layout и нижняя навигация). Калькулятор, календарь и статистика —
заглушки, будут реализованы на следующих этапах.

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

## Известное ограничение текущего sandbox-окружения разработки

`npx prisma format` / `validate` / `generate` (и `migrate`) в этой
sandbox-среде разработки не могут быть выполнены: CLI обращается к
`binaries.prisma.sh` за schema-engine, а исходящий трафик на этот домен
заблокирован политикой sandbox (`x-deny-reason: host_not_allowed`,
подтверждено прямым `curl -v`). Это не связано с содержимым схемы или
кода — на обычной машине/CI с доступом в интернет команды работают
штатно.

Текущий статус проверок в этой sandbox-среде:

| Проверка | Статус |
|---|---|
| `npm run lint` | **PASSED** |
| `npm run test` | **PASSED** |
| Prisma CLI (`format`/`validate`/`generate`) | **BLOCKED BY SANDBOX** |
| `npm run typecheck` | **BLOCKED UNTIL PRISMA CLIENT GENERATION** |
| `npm run build` | **BLOCKED UNTIL PRISMA CLIENT GENERATION** |

`src/generated/prisma` не существует в этой среде, поэтому typecheck/build
не проходят полностью здесь — запустите обе команды локально после
`npx prisma generate`.

## Stage 3 (реализовано)

- `src/config/gacha.ts` — конфигурация баннеров, единственный источник
  игровых констант.
- `src/lib/gacha-math/*` — чистые функции (ресурсы, pity, гарантия,
  прогноз) + 94 unit-теста, без soft pity/вероятностной модели.
- `src/server/services/gacha-calculator-service.ts` — сервисный слой,
  только чтение, не принимает userId от клиента.
- `POST /api/calculator` — API калькулятора.

## Stage 4 (план)

- Полноценные страницы: Калькулятор (UI поверх `/api/calculator`),
  Календарь, Статистика, Настройки.
- Сервисы записи pity/баланса с diff-подтверждением и idempotency.
- Настроить запуск `purgeStaleSessions()` по расписанию.

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
  lib/
    auth/                # сессии, dev-auth
    telegram/             # верификация initData, клиентская обёртка
    validation/           # Zod-схемы
    db/                  # Prisma client singleton
    api/                 # общий формат ошибок
  server/
    repositories/        # доступ к БД
    services/            # бизнес-оркестрация (auth, current user)
  types/                 # окружающие типы (Telegram WebApp)
prisma/
  schema.prisma
```
