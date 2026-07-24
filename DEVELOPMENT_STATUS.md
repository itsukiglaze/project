# DEVELOPMENT_STATUS.md — Proxy Pull Planner

Snapshot as of end of Stage 6 (Statistics), fully verified. This document
is the authoritative "where things stand" reference for continuing this
project in Claude Code.

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
| **5D** | Calendar UI: month grid, day-detail sheet, series/exception/split flows, forecast panel, client API layer, lightweight query-cache + mutation hooks, idempotency-key management, modal focus trap, ~150 component/hook tests | Done, fully verified |
| **6A** | Statistics domain math: shared generic query hook extracted to `src/lib/query/`, currency-safe aggregation (`src/lib/statistics-math/*`), timezone-correct "today" util (`src/server/local-date.ts`) | Done |
| **6B** | `GET /api/statistics/overview`: read-only, auth-gated, range-validated, composes existing Stage 5 repositories/services — no new write paths | Done |
| **6C** | Statistics UI: resource balance (per-currency), banner pity/guarantee summary, actual/scheduled/expected totals, continuous actual-to-projected trajectory chart, transaction trends, date-range picker, chart/table toggles | Done |
| **6D** | Full-repo verification (706/706 tests, lint, typecheck, build) | Done |

## 2. Current stage

**Stage 6: complete and fully verified.** The Statistics tab
(`src/app/statistics/page.tsx`) is a real feature now, not a stub — see
Section 6 for the metric definitions and currency-safety rules it follows,
and Section 5 for what it deliberately does not attempt.

**Stage 5D: complete and fully verified**, including the verification-tail
items that were still open as of the previous snapshot:

- `SeriesForm` direct tests (`series-form.test.tsx`, 19 cases): create/edit/split mode, INCOME/EXPENSE toggling + source field visibility, DAILY/WEEKLY/MONTHLY conditional fields, end-condition switching, validation-blocked submit, and the start-date field being editable only in create mode (edit/split show it as frozen text instead).
- End-to-end "this and future" split-flow component test (`calendar-page.test.tsx`): drives the real UI — day cell -> `DayDetailSheet` -> edit-scope -> "это и будущие вхождения" -> pre-filled `SeriesForm` (split mode) -> submit — and asserts the exact `splitSeries()` call args, that series-list/occurrences/forecast queries are all refetched afterward, that the dialog closes on success, and that a `STALE_STATE` response leaves the dialog open and retryable without looping the request.
- A modal focus trap + focus restoration (`use-focus-trap.ts`, applied to every dialog — `ConfirmDialog`, `EditScopeDialog`, `DayDetailSheet`, and the series-form/split/override-occurrence dialogs in `calendar-page.tsx`): Tab/Shift+Tab now wrap within the open dialog instead of reaching background content, Escape closes it, and focus returns to whatever triggered it on close. A nested dialog (e.g. the delete-confirmation `ConfirmDialog` opened from inside `DayDetailSheet`) suspends its parent's trap via an `active` flag so the two don't double-handle Escape.
- A systematic accessibility pass across every dialog reachable from `CalendarPage` (`modal-accessibility.test.tsx`, 8 cases): role="dialog" + `aria-modal="true"` + an accessible name, focus moving inside on open, Escape closing without triggering any mutation, and focus returning to the exact trigger where that trigger stays mounted.
- Mobile touch-target tests (`mobile-interactions.test.tsx`): every interactive control in the calendar dialogs/forms (type toggles, weekday picker, Cancel/Save, month navigation, day cells) carries the `min-h-11`/`h-11` (44px) sizing convention already established elsewhere in the codebase.
- Full-repo `npm run test` (623/623), `npm run lint`, `npm run typecheck`, and `npm run build` all pass cleanly — see Section 8 for what else had to be fixed to get typecheck/build unblocked (a Prisma 7 config-format change, unrelated to Stage 5D itself).

`CalendarPage` still has no *dedicated, exhaustive* unit-test file for every
prop/branch — its wiring is now covered end-to-end via
`calendar-page.test.tsx` and `modal-accessibility.test.tsx` for the split
flow and every modal transition, which was the specific gap called out
below in Section 3 (superseded) and Section 8.

### Stage 6 summary

- **Shared query hook extracted first** (`src/lib/query/{use-query,query-cache}.ts`), per an explicit requirement to reuse rather than duplicate: `useCalendarQuery` -> generic `useQuery`, generalized over whatever discriminated-union result type a fetcher returns (both the success-data type and the error-branch type are inferred via a conditional type) instead of hardcoding `CalendarApiResult<T>`. All calendar call sites updated; behavior unchanged (verified with a full test run before writing any statistics code).
- **`src/lib/statistics-math/*`** (pure, unit-tested): currency-grouped aggregation (`sumByCurrency`, `sumBySource`, `countPullsByBannerFamily`, `sumByTransactionType`) that never sums Polychrome/Monochrome/Encrypted Master Tape/Master Tape/Boopon together, and `buildStatisticsTimeline`, which reuses the existing `calculateDailyBalances` in a single Polychrome-filtered pass so the actual/projected cumulative-net trajectory is one continuous line (both fields populated with the same value exactly at "today"), not two independently-anchored series.
- **`src/server/local-date.ts`**: `getTodayInTimezone`/`getTodayInTimezoneOrUtc` extracted out of the forecast route's private copy so the new statistics route computes "today" from the user's own stored timezone the same verified way, not a second reimplementation.
- **`GET /api/statistics/overview`**: composes the existing `getMergedOccurrences` (Stage 5) for the timeline and the "scheduled" (future-only virtual) bucket, plus a direct `listActualOccurrencesInRange` read for the "actual" bucket and breakdowns (documented tradeoff — see the service's own comment for why).
- **UI**: `src/features/statistics/*` — resource balances shown independently (no percentage/distribution chart), banner pity/guarantee reusing the Calculator's own pure functions, "Actual through today" / "Scheduled ahead" / "Expected range total" (never "actual vs forecast"), the continuous trajectory chart, and actual-only transaction trends — every chart has a table alternative, every interactive control meets the 44px touch-target convention.
- 83 new tests across 6A/6B/6C (623 -> 706); full suite (706/706), lint, typecheck, and build all pass.

## 3. Known-incomplete test coverage (explicit, not hidden)

All four items previously listed here (`SeriesForm` direct tests, the
end-to-end split-flow test, `CalendarPage`'s edit-scope wiring, and the
modal focus trap) were closed out — see Section 2. What's left, by design
rather than oversight:

- `CalendarPage` is covered by targeted flow/wiring tests
  (`calendar-page.test.tsx`, `modal-accessibility.test.tsx`), not an
  exhaustive prop/branch unit-test file — every modal transition and the
  split flow are exercised end-to-end through the real component tree
  instead.

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
15. **Stage 5D**: the cancel/override-occurrence flows hardcoded `expectedVersion=0` when calling the exception upsert — wrong whenever an exception already existed for that occurrence, which would silently surface `STALE_STATE` with no user-visible feedback. Fixed in `use-exception-mutation.ts`: on a `STALE_STATE` response to an `expectedVersion===0` guess, automatically retries once using the server-reported `current.version`, reusing the same idempotency key (derived from `{seriesId, occurrenceDate, input}`, deliberately excluding `expectedVersion`). A second conflict on the retry is surfaced as the final error, not hidden or looped.
16. **Stage 5D verification (this session)**: reconstructing the project from an archive export and running `npx prisma generate` for real (not just reasoning about it) surfaced that Prisma 7.9.0 rejects `datasource { url / directUrl }` inside `schema.prisma` — a breaking config-format change, not the sandbox-egress block Section 8 previously assumed. Fixed by moving the connection URLs into a new `prisma.config.ts` (read via `DIRECT_URL`, needed only by the CLI — the runtime `PrismaClient` was already unaffected, since it gets its connection string from `@prisma/adapter-pg` directly). Added `dotenv` as an explicit devDependency since `prisma.config.ts` needs it to read `.env` and it was previously only a transitive one.
17. **Stage 5D verification (this session)**: six calendar test files (`api.test.ts`, `day-detail-sheet.test.tsx`, `day-summary.test.ts`, `transaction-form.test.tsx`, `use-series-mutations.test.ts`, `use-transaction-mutations.test.ts`) used raw string literals (`"INCOME"`, `"POLYCHROME"`, etc.) as fixture values where the actual domain types are real TS string enums — `vitest run` never caught this because it type-strips rather than type-checks, and `tsc --noEmit` had never completed a clean run against the generated Prisma client until now. Fixed by importing and using the actual enum members.
18. **Stage 5D (this session)**: implemented the modal focus trap that Section 5 previously listed as missing — see `use-focus-trap.ts` and Section 2.
19. **Stage 6 (discovered, NOT fixed — see Section 5's flagged item)**: while designing the statistics API response, tracing exactly how `LocalDate` serializes over the wire surfaced that every existing calendar route (`/api/calendar/occurrences`, `/api/calendar/forecast`, the transaction/series/exception write routes) returns `LocalDate` fields as raw `{year,month,day}` objects — nobody calls `formatLocalDate()` before `NextResponse.json()` — while every CLIENT-side type (`MergedOccurrenceDto.localDate: string`, etc.) declares them as ISO strings. This mismatch is invisible in the existing test suite because every calendar component/hook test builds its own in-memory fixtures matching the (wrong) client type, never round-tripping through real `NextResponse.json()`/`fetch()` serialization. The new `GET /api/statistics/overview` explicitly calls `formatLocalDate()` on every date field before responding, so it does not repeat this. The pre-existing Stage 5 routes were left untouched — fixing them was out of scope for Stage 6 and needs an explicit decision (see Section 5).

## 5. Technical debt / deliberate simplifications

- **Suspected pre-existing bug, not yet fixed (found during Stage 6, see history item 19): calendar API routes likely send `LocalDate` date fields as `{year,month,day}` objects, not the ISO strings the client types declare.** If confirmed against a real running server, this would break anything that treats a returned `localDate`/`occurrenceDate` as a string (e.g. `day-summary.ts`'s day-keyed grouping, which would silently stop grouping by date correctly). Worth a dedicated verification + fix pass before relying on the calendar UI's real-server behavior.
- **No React Query / SWR** — a hand-rolled `query-cache.ts` (subscribe/invalidate-by-prefix) + a shared generic `useQuery` (`src/lib/query/use-query.ts`, used by both `calendar` and `statistics`) stand in for a real query library, matching this project's established "no extra dependencies for what a small hook can do" convention. Query-key strings (`CALENDAR_QUERY_KEYS`) are structured compatibly if you later want to migrate to a real library. There is no request-level deduplication — e.g. `ResourceBalancePanel` and `BannerPityPanel` each independently call `fetchResourceSnapshot()`, issuing two HTTP requests for the same data on the Statistics page. Accepted as consistent with the existing pattern (Stage 5 has similar cases) rather than introducing a caching layer for Stage 6 alone.
- **Statistics' "actual" bucket re-reads `CalendarTransaction` a second time.** `getStatisticsOverview` calls the existing `getMergedOccurrences` (which itself calls `listActualOccurrencesInRange` internally) AND calls `listActualOccurrencesInRange` again directly, because `merge.ts`'s `ActualOccurrence` type strips `source`/`bannerFamily`/`note` (fields the statistics breakdowns need) for its own unrelated reasons. Deliberate: widening a Stage 5 calendar-math type just for this one Stage 6 read was judged riskier than one extra cheap read of the same table for a low-traffic reporting endpoint.
- **The Statistics trajectory chart and the "actual"/"scheduled" per-currency totals answer different questions on purpose.** The chart is Polychrome-only (matching the one existing precedent — Stage 5's forecast panel already scopes its own running balance to Polychrome). The totals cards are per-currency and include PULL as a separate count. Do not "fix" the chart to include other currencies by summing them in — that would recreate exactly the currency-mixing mistake Stage 6 was built to avoid.
- **Calendar net flow (Statistics) is not reconciled with the Settings-page wallet balance (`ResourceBalance`).** They are two independent, unlinked data-entry surfaces (Settings edits `ResourceBalance` directly; Calendar logs `CalendarTransaction` rows) — saving one never updates the other. Statistics' trajectory chart is explicitly a relative net-flow-over-the-period view (starts at 0), never anchored to or compared against the real absolute balance. Don't build a feature that assumes they agree without first building the reconciliation itself.
- **No retrospective forecast-accuracy metric exists, and none should be added without first persisting historical forecast snapshots.** Every "scheduled"/forecast number in Statistics (and in the original Stage 5 forecast panel) is computed live, from currently-active series, at request time. There is no record of what a forecast said a week or a month ago, so nothing can honestly claim to check whether a past prediction was right.
- **`PullEvent` and `Goal` (Prisma schema models) remain completely inactive** — confirmed zero repository/service code references either one anywhere in the codebase. Do not present pull-by-pull history, win-rate trends, streaks, or goal progress as working statistics; all of that needs a real write path built first, which hasn't happened on any stage so far. `UserSettings.includeMonochromeAsPolychrome` is in the same unused state — the Monochrome-fold toggle in both the Calculator and the new Statistics banner-pity panel is local, unpersisted UI state, not a saved preference.
- **Series-form / day-detail error surfacing is inconsistent with the Settings-page profile forms.** The Stage 4B profile forms show phase-based inline error banners (stale-state, network error, etc.) inside the form itself. The Stage 5D calendar forms do not yet surface `seriesMutations.state`/`exceptionMutation.state` failures inline — a failed submit just leaves the modal open with no visible explanation (the mutation is not stuck, and a retry works — see `calendar-page.test.tsx`'s STALE_STATE case — there's just no visible banner explaining why the first attempt didn't close the dialog). This was explicitly flagged during Stage 5D as a known, accepted simplification, not an oversight, and remains untouched.
- **`edit-scope` UX edge case**: if the user picks "this and future" or "entire series" from `EditScopeDialog` before the series list has finished loading, `findLoadedSeries()` returns `null` and the handler just returns — the dialog stays open with no error message.
- **PULL is intentionally not recurring-eligible.** `CalendarEventSeries.type` only accepts `INCOME | EXPENSE` (enforced at the Zod layer and the service layer). One-time `CalendarTransaction` rows can still be `PULL`.
- **`purgeStaleSessions()` / `purgeExpiredIdempotencyRecords()` exist but are not scheduled anywhere.** No cron/Vercel Cron job wiring exists yet.

## 6. Implementation decisions worth knowing about

- **Rust-free Prisma client**: `generator client { provider = "prisma-client"; output = "../src/generated/prisma"; engineType = "client" }` + `@prisma/adapter-pg` + `pg`. Confirmed working end-to-end against the installed Prisma 7.9.0 (`npx prisma generate` succeeds; `src/generated/prisma` is `.gitignore`d and must be regenerated after `npm install`).
- **Connection URLs live in `prisma.config.ts`, not `schema.prisma`.** Prisma 7.9.0 rejects `datasource { url / directUrl }` in the schema file outright (`P1012`); the CLI (generate/migrate/validate) now reads `DIRECT_URL` from `prisma.config.ts` instead, while the runtime `PrismaClient` (`src/lib/db/prisma.ts`) is unaffected — it already got its (pooled) `DATABASE_URL` via `@prisma/adapter-pg` directly, independent of the schema's datasource block.
- **Every write endpoint uses the same shape**: Zod `.strict()` validation -> request-bound idempotency lookup (hash of the normalized payload) -> atomic `updateMany({ where: { id, userId, version: expectedVersion } })` for optimistic concurrency -> transactional audit log -> transactional idempotency-record write -> P2002-on-idempotency-record catch-and-replay for concurrent identical requests. Repeated intentionally across banner-state, resource-balance, calendar-series, calendar-exception, and calendar-transaction.
- **`LocalDate` (`{year, month, day}`) is the only calendar-date representation in all math/domain/service code — it is formatted to a "YYYY-MM-DD" string ONLY at the final JSON-response boundary.** JS `Date` appears in exactly two places (both mechanical serialization boundaries): `src/server/repositories/calendar-local-date.ts` (Prisma `@db.Date`, via `Date.UTC(...)`) and `src/server/local-date.ts` / `src/features/calendar/local-date-client.ts` (`Intl.DateTimeFormat` to read "today", parsed back through `parseLocalDate`). `new Date(year, month, day)` is never used anywhere. The Stage 6 statistics route explicitly calls `formatLocalDate()` on every date field before `NextResponse.json()` — the pre-existing Stage 5 calendar routes do NOT do this consistently; see Section 5's flagged item.
- **Domain enums mirror Prisma enums by value, not by import.** `config/gacha.ts` and `lib/calendar-math/types.ts` define their own TS enums (BannerFamily, TransactionType, CurrencyType, IncomeSource, RecurrenceFrequency, RecurrenceEndType) matching the Prisma schema's string values, so pure math code stays fully Prisma-free and unit-testable without a generated client. The repository layer bridges the two via small cast functions, documented inline.
- **Idempotency keys are client-generated (`crypto.randomUUID()`), format-validated server-side** (`^[A-Za-z0-9_-]{8,200}$`), managed client-side via `useIdempotencyKey()`. `expectedVersion` is deliberately excluded from the exception mutation's key-derivation payload since it's a concurrency mechanism detail, not part of the user's action identity.
- **Split algorithm**: splitting exactly at a series' own first occurrence collapses to an in-place edit (no zero-length predecessor, no split history). Otherwise: the old series is closed (`endType=UNTIL_DATE`, `endDate = splitDate - 1 day`), a new series is created (`splitFromSeriesId` set, inheriting the OLD series' frozen timezone), exceptions dated `>= splitDate` are reassigned to the new series, and materialized `CalendarTransaction` rows are never touched (the series service doesn't even import the transaction repository).
- **No lazy-on-read materialization anywhere.** GET endpoints are 100% read-only and side-effect-free; virtual occurrences stay virtual until an explicit one-time transaction is recorded.
- **Forecast horizon hard-capped at 90 days** (`MAX_FORECAST_HORIZON_DAYS` in `lib/calendar-math/forecast.ts`), enforced in exactly one place. Statistics uses a separate, more permissive 366-day range cap (`statisticsOverviewQuerySchema`, matching `occurrencesQuerySchema`'s existing bound) since it needs to look at long historical windows, not just a bounded forecast.
- **Currency-safety rule, applied uniformly across all of `lib/statistics-math/*`**: Polychrome, Monochrome, Encrypted Master Tape, Master Tape, and Boopon are never summed together. Every total is grouped by currency (`CurrencyAmount[]`); the one scalar cross-item number (`netFlowPolychrome`) is explicitly Polychrome-only by construction (PULL items, whose currency is never Polychrome in practice, structurally cannot contribute to it) and is named/documented as such everywhere it appears, rather than being a bare `netFlow` that silently assumes one currency.
- **"Scheduled" excludes virtual occurrences dated on or before today.** An unmaterialized series occurrence scheduled for a past date (the user never logged a matching actual transaction) is neither a real "actual" nor a genuine "still ahead" projection — it is deliberately excluded from both `actual` and `scheduled` rather than miscounted into either.

## 7. Assumptions

- Deployment target is Vercel + Supabase Postgres, reachable via `DATABASE_URL` (pooled) + `DIRECT_URL` (direct, for migrations).
- The Telegram bot integration (BotFather registration, Menu Button, domain wiring) was never actually performed — only the server-side `initData` HMAC verification code exists and is unit-tested against synthetic signed payloads. No real bot token has ever been used.
- Local dev outside Telegram relies on `DEV_AUTH_ENABLED=true` + `DEV_TELEGRAM_USER_ID=<id>`, hard double-gated to `NODE_ENV=development`.
- This project has still never been migrated against a *real* Postgres database — `DATABASE_URL`/`DIRECT_URL` in `.env` are placeholders wherever this was verified, sufficient for `prisma generate`/`typecheck`/`build` (which don't open a connection) but not for `prisma migrate dev` or actually running the app.

## 8. Remaining roadmap

**Stage 5D and Stage 6 are both complete** — see Section 2. Nothing
outstanding from either "finish properly" list remains.

**Stage 5E (not started):** scope not yet defined in this conversation.

**Stage 7 (not started, explicitly out of scope so far):** anything needing real pull-by-pull history or goal tracking — requires building a `PullEvent`/`Goal` write path first (both are currently inactive schema models, see Section 5). Not yet scoped.

**Priority follow-up (not part of any numbered stage yet, discovered during Stage 6):**
- Verify and, if confirmed, fix the suspected `LocalDate` wire-serialization gap in the existing Stage 5 calendar routes (Section 4 item 19, Section 5's flagged item) — this needs a real running server or an end-to-end test that exercises actual `NextResponse.json()`/`fetch()` serialization, since the current unit/component test suite can't see it.

**Always-outstanding infra tasks:**
- Run `npx prisma migrate dev --name init` against a real Supabase/Postgres `DATABASE_URL`/`DIRECT_URL` — this project's schema has never been migrated against a real database.
- Wire `purgeStaleSessions()` and `purgeExpiredIdempotencyRecords()` to an actual schedule.
- Real Telegram bot registration + Mini App domain/menu-button setup (BotFather).

### Exact commands to run, in order, on a normal machine

```bash
npm install
cp .env.example .env        # fill in real DATABASE_URL/DIRECT_URL before migrating
npx prisma generate         # generates src/generated/prisma — no DB connection needed
npx prisma migrate dev --name init   # needs a real DATABASE_URL/DIRECT_URL
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```
