# DEVELOPMENT_STATUS.md — Proxy Pull Planner

Snapshot as of end of Stage 5D (calendar UI). This document is the
authoritative "where things stand" reference for continuing this project
in Claude Code.

---

## 1. Completed stages

| Stage | Scope | Status |
|---|---|---|
| **2** | Telegram auth (initData HMAC verification), opaque hashed sessions, dev-auth (double-gated), base layout + bottom nav, Prisma schema v1 | Done |
| **3** | Gacha calculator domain: `config/gacha.ts`, `lib/gacha-math/*` (pure), 94 unit tests, calculator service + `POST /api/calculator` | Done |
| **4A** | Calculator UI: family selector, resource/pity/goal fields, result/error cards, stale-result marking, double-submit guard, abort/race safety | Done |
| **4B** | Resource/pity persistence: optimistic concurrency (`version` + atomic `updateMany`), request-bound idempotency (`IdempotencyRecord` + `requestHash`), P2002 race recovery, transactional audit log, Settings-page profile forms with diff-preview | Done |
| **5A** | Calendar domain model: Prisma schema for `CalendarEventSeries` / `CalendarEventException` / extended `CalendarTransaction`; pure `lib/calendar-math/*` (LocalDate arithmetic with zero JS `Date` in recurrence logic, recurrence expansion, exception application, actual/virtual merge, bounded forecast) | Done |
| **5B** | Calendar repositories + services: series CRUD, split ("this and future"), exception upsert, one-time transaction CRUD, read-only occurrence/forecast services — same optimistic-concurrency + idempotency + audit pattern as 4B | Done |
| **5C** | Calendar API routes (10 endpoints) + Zod schemas + uniform error mapping (`NOT_FOUND->404`, `STALE_STATE->409`, `IDEMPOTENCY_KEY_REUSED->409`, `INVALID_OCCURRENCE->422`, `VALIDATION_ERROR->400`) | Done |
| **5D** | Calendar UI: month grid, day-detail sheet, series/exception/split flows, forecast panel, client API layer, lightweight query-cache + mutation hooks, idempotency-key management, ~110 component/hook tests | Done, verification tail-end in progress (see Section 3) |

## 2. Current stage

**Stage 5D, tail end of verification.** The last in-progress work item was
fixing and testing the exception auto-retry-with-corrected-version
behavior in `src/features/calendar/use-exception-mutation.ts` (same
idempotency key across the guess + retry, retries at most once, does not
hide a second conflict). New test cases were added to
`use-exception-mutation.test.ts` for this. **At the point this export was
requested, the following had not yet been completed:**

- `SeriesForm` direct tests (create/edit mode, INCOME/EXPENSE, DAILY/WEEKLY/MONTHLY, end conditions, validation, timezone-present-on-create-absent-on-edit) — not yet written.
- End-to-end split-flow component test (select "this and future" -> submit -> verify the split call's exact args + cache invalidation + dialog close + STALE_STATE stays visible/retryable) — not yet written.
- Explicit mobile/accessibility test pass (touch targets, dialog focus-in/focus-return, Escape, aria labels, no background interaction while modal open) — partially covered (ConfirmDialog has focus/Escape tests; a systematic pass across all dialogs was requested but not completed).
- Full-repo `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build` — the last confirmed clean full-suite run was before the final `use-exception-mutation.ts` edit in this session. That file's tests were extended but a full-suite re-run had not completed before this export was requested.

**Action needed immediately upon resuming:** re-run the full verification
sequence below and treat anything it surfaces as the first priority.

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 3. Known-incomplete test coverage (explicit, not hidden)

- `SeriesForm` (`src/features/calendar/series-form.tsx`) has no dedicated test file. It's exercised indirectly through `calendar-page.tsx`'s modals but not directly unit-tested for: create vs edit vs split mode, INCOME/EXPENSE toggling, DAILY/WEEKLY/MONTHLY field visibility, end-condition switching, validation-blocked submit, and the timezone field being present only in create mode.
- No end-to-end "select this-and-future -> submit -> verify exact split() args" test exists yet.
- `CalendarPage` itself (the orchestrator) has no dedicated test file — only its constituent pieces (`DayDetailSheet`, `EditScopeDialog`, `SeriesListPanel`, the mutation/query hooks) are unit-tested in isolation. The wiring between "edit-scope selection -> correct modal opens with correct pre-filled series" is therefore not directly verified by an automated test, only by code inspection (documented in the Stage 5D conversation as manually inspected).
- Systematic "no interaction with background content while a modal is open" (focus trap / inert background) is not implemented or tested — the modals here are visually overlaid (`fixed inset-0` + backdrop) but there is no focus trap; a keyboard user tabbing through a page with `DayDetailSheet` or `SeriesForm` open could tab into background content. This is a real accessibility gap, not just a missing test.

## 4. Known bugs fixed during development (for history/context — don't reintroduce these)

1. **Stage 2**: `react-hooks/set-state-in-effect` violation in `auth-provider.tsx` (synchronous `setState` at top of a `useEffect`) — fixed by moving the reset into the `retry()` event handler instead.
2. **Stage 2**: BigInt literals required bumping `tsconfig.json` `target` from `ES2017` to `ES2020`.
3. **Stage 2**: `server-only` package resolution inside Vitest — fixed via a scoped alias in `vitest.config.ts` (`resolve.alias["server-only"] -> node_modules/server-only/empty.js`), deliberately NOT a global `resolve.conditions: ["react-server"]` (that broke `react-dom/client` resolution for component tests).
4. **Stage 3->4A**: React 19 + Testing Library needs `globalThis.IS_REACT_ACT_ENVIRONMENT = true` — centralized once in `vitest.setup.ts`.
5. **Stage 4A**: `isSubmittingRef` in the calculator's `use-calculator-form.ts` was never reset when a request resolved as `"aborted"` — fixed with `try/finally`; also added a monotonic `requestSequenceRef` as a second, independent guard alongside `AbortController` against stale-response races.
6. **Stage 4A**: `CalculationResult` only null-checked `missingPolychrome`, not family — a malformed API response could in principle leak a non-null value for Bangboo (which must never show Polychrome shortfall). Fixed with an explicit `config.currency !== BOOPON` gate, defense-in-depth beyond the (already-correct) server contract.
7. **Stage 4A**: Telegram haptic feedback calls could throw if `window.Telegram.WebApp.HapticFeedback` was partially implemented — hardened with full `try/catch` + optional chaining.
8. **Stage 4B**: an earlier idempotency version replayed the stored response for any matching idempotency key regardless of payload — reworked to hash the (normalized) request and require an exact hash match (`lookupIdempotencyRecord` returns `missing | match | mismatch`); a mismatched key now returns a distinct `IDEMPOTENCY_KEY_REUSED` (409), not a silent wrong-payload replay.
9. **Stage 5A**: `MergedOccurrence`'s discriminant field was originally named `source`, colliding with `VirtualOccurrence.source` (an `IncomeSource`) — renamed to `kind`.
10. **Stage 5B**: `SeriesRecord`/`SeriesWriteFields` initially omitted `timezone`, causing a real type error at the split call site once `oldSeries.timezone` was needed — added `timezone` to the repository's `SeriesRecord` type.
11. **Stage 5C**: `localDateSchema`'s explicit `z.ZodType<LocalDate, z.ZodTypeDef, string>` annotation didn't match the installed Zod v4's actual internals — was silently degrading every downstream schema's inferred type to `unknown`. Fixed by removing the annotation and letting inference work.
12. **Stage 5C**: `seriesTemplateSchema.type` used `z.enum(["INCOME","EXPENSE"])`, producing a plain string-literal type incompatible with the service's actual `RecurringTransactionType` enum members — fixed via `z.union([z.literal(TransactionType.INCOME), z.literal(TransactionType.EXPENSE)])`.
13. **Stage 5D**: `calendar-page.tsx` initially used a `requireSeries()` helper that re-fetched the entire series list from the network just to resolve one series by id for the edit-scope flow — removed; `CalendarPage` now lifts a single `useSeriesListQuery()` call and reuses that already-loaded array everywhere it needs a series lookup.
14. **Stage 5D**: `use-calendar-query.ts` had two React-Compiler-flagged violations (mutating a ref during render; calling `setState` synchronously inside a `useEffect`) — fixed by moving the ref sync into its own effect and switching to a stale-while-revalidate pattern where `load()` never calls `setState` outside of the resolved-promise callback.
15. **Stage 5D (last fix in this session)**: the cancel/override-occurrence flows hardcoded `expectedVersion=0` when calling the exception upsert — wrong whenever an exception already existed for that occurrence, which would silently surface `STALE_STATE` with no user-visible feedback. Fixed in `use-exception-mutation.ts`: on a `STALE_STATE` response to an `expectedVersion===0` guess, automatically retries once using the server-reported `current.version`, reusing the same idempotency key (derived from `{seriesId, occurrenceDate, input}`, deliberately excluding `expectedVersion`). A second conflict on the retry is surfaced as the final error, not hidden or looped.

## 5. Technical debt / deliberate simplifications

- **No React Query / SWR** — a hand-rolled `query-cache.ts` (subscribe/invalidate-by-prefix) + `use-calendar-query.ts` generic hook stands in for a real query library, matching this project's established "no extra dependencies for what a small hook can do" convention. Query-key strings (`CALENDAR_QUERY_KEYS`) are structured compatibly if you later want to migrate to a real library.
- **No focus trap in modals.** Dialogs (`DayDetailSheet`, the `SeriesForm` sheet, `EditScopeDialog`, `ConfirmDialog`) are visually modal (backdrop + `fixed inset-0`) but do not prevent Tab from reaching background content. `ConfirmDialog` autofocuses its confirm button and closes on Escape; the others do not.
- **Series-form / day-detail error surfacing is inconsistent with the Settings-page profile forms.** The Stage 4B profile forms show phase-based inline error banners (stale-state, network error, etc.) inside the form itself. The Stage 5D calendar forms do not yet surface `seriesMutations.state`/`exceptionMutation.state` failures inline — a failed submit just leaves the modal open with no visible explanation. This was explicitly flagged during Stage 5D as a known, accepted simplification, not an oversight.
- **`edit-scope` UX edge case**: if the user picks "this and future" or "entire series" from `EditScopeDialog` before the series list has finished loading, `findLoadedSeries()` returns `null` and the handler just returns — the dialog stays open with no error message.
- **PULL is intentionally not recurring-eligible.** `CalendarEventSeries.type` only accepts `INCOME | EXPENSE` (enforced at the Zod layer and the service layer). One-time `CalendarTransaction` rows can still be `PULL`.
- **`purgeStaleSessions()` / `purgeExpiredIdempotencyRecords()` exist but are not scheduled anywhere.** No cron/Vercel Cron job wiring exists yet.
- **The generated Prisma Client (`src/generated/prisma`) does not exist in the sandbox this project was built in**, because that sandbox's egress allowlist blocks `binaries.prisma.sh` (confirmed via direct `curl -v`, header `x-deny-reason: host_not_allowed`). `npm run typecheck` and `npm run build` are BLOCKED there on ~17 errors all traced to this one root cause — 5 direct `Cannot find module '@/generated/prisma/client'` + ~12 `tx` implicit-`any` cascades in every `prisma.$transaction(async (tx) => ...)` call site. This is almost certainly not a problem in a normal environment with internet access. See Section 8 for exact commands.

## 6. Implementation decisions worth knowing about

- **Rust-free Prisma client**: `generator client { provider = "prisma-client"; output = "../src/generated/prisma"; engineType = "client" }` + `@prisma/adapter-pg` + `pg`. Confirmed supported by the installed Prisma 7.9.0 via inspecting `node_modules/prisma/build/cli.js`. Note: `prisma generate` still needs the schema-engine binary regardless of `engineType` — that's what's blocked in the sandbox, not a Rust-vs-WASM query-engine issue.
- **Every write endpoint uses the same shape**: Zod `.strict()` validation -> request-bound idempotency lookup (hash of the normalized payload) -> atomic `updateMany({ where: { id, userId, version: expectedVersion } })` for optimistic concurrency -> transactional audit log -> transactional idempotency-record write -> P2002-on-idempotency-record catch-and-replay for concurrent identical requests. Repeated intentionally across banner-state, resource-balance, calendar-series, calendar-exception, and calendar-transaction.
- **`LocalDate` (`{year, month, day}`) is the only calendar-date representation in all math/domain code.** JS `Date` appears in exactly two places, both documented as mechanical serialization boundaries: `src/server/repositories/calendar-local-date.ts` (Prisma `@db.Date` boundary, using `Date.UTC(...)` explicitly) and `src/features/calendar/local-date-client.ts` / the forecast API route (`Intl.DateTimeFormat` to read "today" in a given timezone, then parsed back through `parseLocalDate`). `new Date(year, month, day)` is never used anywhere.
- **Domain enums mirror Prisma enums by value, not by import.** `config/gacha.ts` and `lib/calendar-math/types.ts` define their own TS enums (BannerFamily, TransactionType, CurrencyType, IncomeSource, RecurrenceFrequency, RecurrenceEndType) matching the Prisma schema's string values, so pure math code stays fully Prisma-free and unit-testable without a generated client. The repository layer bridges the two via small cast functions, documented inline.
- **Idempotency keys are client-generated (`crypto.randomUUID()`), format-validated server-side** (`^[A-Za-z0-9_-]{8,200}$`), managed client-side via `useIdempotencyKey()`. `expectedVersion` is deliberately excluded from the exception mutation's key-derivation payload since it's a concurrency mechanism detail, not part of the user's action identity.
- **Split algorithm**: splitting exactly at a series' own first occurrence collapses to an in-place edit (no zero-length predecessor, no split history). Otherwise: the old series is closed (`endType=UNTIL_DATE`, `endDate = splitDate - 1 day`), a new series is created (`splitFromSeriesId` set, inheriting the OLD series' frozen timezone), exceptions dated `>= splitDate` are reassigned to the new series, and materialized `CalendarTransaction` rows are never touched (the series service doesn't even import the transaction repository).
- **No lazy-on-read materialization anywhere.** GET endpoints are 100% read-only and side-effect-free; virtual occurrences stay virtual until an explicit one-time transaction is recorded.
- **Forecast horizon hard-capped at 90 days** (`MAX_FORECAST_HORIZON_DAYS` in `lib/calendar-math/forecast.ts`), enforced in exactly one place.

## 7. Assumptions

- Deployment target is Vercel + Supabase Postgres, reachable via `DATABASE_URL` (pooled) + `DIRECT_URL` (direct, for migrations).
- The Telegram bot integration (BotFather registration, Menu Button, domain wiring) was never actually performed — only the server-side `initData` HMAC verification code exists and is unit-tested against synthetic signed payloads. No real bot token has ever been used.
- Local dev outside Telegram relies on `DEV_AUTH_ENABLED=true` + `DEV_TELEGRAM_USER_ID=<id>`, hard double-gated to `NODE_ENV=development`.
- `binaries.prisma.sh` being blocked is a sandbox-specific egress-allowlist limitation, not a property of Prisma or this codebase — re-verify this the moment the project runs somewhere with normal internet access.

## 8. Remaining roadmap

**Immediate (finish Stage 5D properly):**
1. Add `SeriesForm` direct tests (create/edit/split mode; INCOME/EXPENSE; DAILY/WEEKLY/MONTHLY; end conditions; validation; timezone shown only on create).
2. Add an end-to-end "this and future" split-flow test asserting the exact `splitSeries()` call args, targeted cache invalidation, dialog close on success, and that `STALE_STATE` stays visible and retryable.
3. Add a focus-trap (or at minimum a documented decision not to) for the modal dialogs; add the explicit mobile/accessibility test pass (touch targets, focus-in/focus-return, Escape everywhere, aria labels, background-inert-while-open).
4. Re-run the full verification sequence (`lint`, `typecheck`, `test`, `build`) and resolve anything beyond the confirmed Prisma-generation blocker.

**Stage 5E (not started):** scope not yet defined in this conversation.

**Stage 6 (not started, explicitly out of scope so far):** analytics, trends, averages, charts, goals, statistics tab (`src/app/statistics/page.tsx` is still the original stub).

**Always-outstanding infra tasks:**
- Run the Prisma commands below on a machine with real internet access — this project's schema has never been migrated against a real database.
- Wire `purgeStaleSessions()` and `purgeExpiredIdempotencyRecords()` to an actual schedule.
- Real Telegram bot registration + Mini App domain/menu-button setup (BotFather).
- Decide on and implement the modal focus-trap approach.

### Exact commands to run first, in order, on a normal machine

```bash
npm install
cp .env.example .env
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name init
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```

If `prisma generate` succeeds (expected outside this sandbox), `typecheck`
and `build` should go from "blocked" to fully passing with no further code
changes needed — every blocked error in this project has been
individually traced back to that single missing generated client.
