# DEVELOPMENT_STATUS.md — Proxy Pull Planner

Snapshot as of Stage 7 (Production Readiness), fully verified. This
document is the authoritative "where things stand" reference for
continuing this project in Claude Code.

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
| **6E** | LocalDate wire-serialization audit and fix (the Section 5/item-19 flagged gap): centralized `src/lib/api/calendar-dto.ts` DTO/serializer module; every calendar route now explicitly serializes `LocalDate` fields to "YYYY-MM-DD" before `NextResponse.json()`; widened `merge.ts`'s `ActualOccurrence` (id/source/bannerFamily/note/version) so a displayed one-time transaction returned via `/api/calendar/occurrences` is actually editable/deletable (statistics-service.ts's separate `listActualOccurrencesInRange` read was left as-is — see Section 5, still a deliberate tradeoff, not something this fix removed) | Done |
| **7** | Production readiness: first real Prisma migration (this project had never been migrated before — see Section 9), a real Telegram-login bug found and fixed (empty `initData` was rejected by Zod before ever reaching the dev-auth fallback, making local dev outside Telegram completely unreachable), startup env-var validation (`src/instrumentation.ts`), a scheduled housekeeping endpoint for the two purge routines that existed but were never wired up, Docker + Vercel deployment configs, baseline security headers, one composite DB index, a real production auth 500 found and fixed (Prisma never negotiated TLS to Supabase), and a full live end-to-end verification pass against a real Postgres database — see Section 9 for the complete writeup | Done |
| **9** | Alternative Telegram client compatibility: bounded-wait launch detection (handles clients like AyuGram that populate `initData` late or not at all), a typed diagnostics/capability detector, a secure Telegram Login Widget web-login fallback (separate protocol + CSRF nonce, never a bypass of Telegram's own signature check), Telegram theme/viewport/safe-area CSS integration, privacy-safe structured launch diagnostics — see Section 10 for the complete writeup | Done |

## 2. Current stage

**Stage 9: complete and fully verified.** The app now degrades gracefully
on Telegram clients that don't populate Mini App `initData` reliably
(e.g. AyuGram), with a secure web-login fallback — see Section 10 for the
full writeup, the exact BotFather configuration this adds, and what
fundamentally can't be fixed client-side no matter what code does.

**Stage 7: complete and fully verified.** The app is deployable as a
real production Telegram Mini App — see Section 9 for the full production
readiness report, deployment checklist, and BotFather configuration steps.

**Stage 6 (including 6E): complete and fully verified.** The Statistics tab
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

### Stage 6E summary (LocalDate serialization audit and fix)

- **Root cause**: `LocalDate` is a plain `{year,month,day}` object throughout calendar-math/server code; `NextResponse.json()`/`JSON.stringify` serialize it as that object, not as the "YYYY-MM-DD" string every client-facing type declared. None of the Stage 5 calendar routes ever called `formatLocalDate()` before responding (only the Stage 6 statistics route did this correctly from the start). Invisible in the existing test suite because every calendar component/hook test built in-memory fixtures matching the (wrong) client type directly, never round-tripping through real `Response.json()`/`fetch()` serialization.
- **Canonical wire format**: ISO local-date string `"YYYY-MM-DD"`, produced only by `formatLocalDate()`. Internal domain/service code keeps using `LocalDate` objects; the wire boundary is the only place that formats.
- **Fix**: new `src/lib/api/calendar-dto.ts` — one framework-free module (no `next/server`, no `server-only`) defining every calendar wire-format DTO type (`RecurrenceRuleDto`, `SeriesRecordDto`, `ExceptionRecordDto`, `TransactionRecordDto`, `MergedOccurrenceDto`, `ForecastDto`) plus a matching `serialize*` function for each, using structural `*Like` input types so it never needs to import a `server-only`-marked repository type. `src/features/calendar/api.ts` now imports these same DTO types instead of maintaining an independent (and previously incorrect) client-side copy.
- **Routes updated** (all 8 that return a `LocalDate`-bearing value): `GET /api/calendar/occurrences`, `GET /api/calendar/forecast`, `GET`+`POST /api/calendar/series`, `PUT`+`DELETE /api/calendar/series/[id]`, `POST /api/calendar/series/[id]/split`, `PUT /api/calendar/series/[id]/exceptions/[date]`, `POST /api/calendar/transactions`, `PUT`+`DELETE /api/calendar/transactions/[id]`. Each now runs its response (including the `current` field of a `STALE_STATE` error body) through the matching `serialize*` function before calling `NextResponse.json()`. `GET /api/statistics/overview` already did this correctly (Stage 6B) and needed no change.
- **A second, related bug found and fixed in the same pass** (explicit decision: fix both together rather than defer): `merge.ts`'s `ActualOccurrence` type — the "actual" half of `MergedOccurrence`, returned by `/api/calendar/occurrences` — was missing `id`, `source`, `bannerFamily`, `note`, and `version`, even though every one of these already exists on the underlying `CalendarTransaction` row. A displayed one-time transaction was therefore silently un-editable and un-deletable from the calendar UI in a real deployment (its edit/delete actions would send `undefined` for `id`/`version`). Fixed by widening `ActualOccurrence` and the one repository mapping function that builds it (`toActualOccurrence()` in `calendar-transaction-repository.ts`) to pass all of these through; no field was invented, all were already on the record.
- **Tests added**: a dedicated `src/lib/api/calendar-dto.test.ts` (13 cases) — true JSON round-trip tests for every serializer (`JSON.stringify` -> `JSON.parse`, asserting the exact ISO string, not `{year,month,day}`). Every affected route's test file got a realistic `*RecordFixture()` helper (real `LocalDate` objects, matching what the real service/repository layer actually returns) plus explicit round-trip assertions (`typeof body.record.localDate === "string"`, exact ISO values) for occurrence date, forecast date, series start/end dates, exception `occurrenceDate`, and transaction date. `merge.test.ts` gained a case asserting `id`/`source`/`note`/`version` survive the actual/virtual merge.
- 25 new tests (706 -> 731); full suite (731/731), lint, typecheck, and build all pass.

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
19. **Stage 6 (discovered, fixed in Stage 6E — see Section 2's Stage 6E summary)**: while designing the statistics API response, tracing exactly how `LocalDate` serializes over the wire surfaced that every existing calendar route (`/api/calendar/occurrences`, `/api/calendar/forecast`, the transaction/series/exception write routes) returns `LocalDate` fields as raw `{year,month,day}` objects — nobody calls `formatLocalDate()` before `NextResponse.json()` — while every CLIENT-side type (`MergedOccurrenceDto.localDate: string`, etc.) declares them as ISO strings. This mismatch was invisible in the existing test suite because every calendar component/hook test builds its own in-memory fixtures matching the (wrong) client type, never round-tripping through real `NextResponse.json()`/`fetch()` serialization. The new `GET /api/statistics/overview` explicitly called `formatLocalDate()` on every date field before responding from the start, so it never had this bug. Fixed in Stage 6E via the centralized `src/lib/api/calendar-dto.ts` serializer module applied at every route boundary.
20. **Stage 6E**: fixing the above surfaced a second, more severe bug in the same code path — `merge.ts`'s `ActualOccurrence` (the "actual" half of a merged occurrence returned by `/api/calendar/occurrences`) was missing `id`/`source`/`bannerFamily`/`note`/`version`, all of which already exist on the underlying `CalendarTransaction` row. This silently broke edit/delete for any one-time transaction shown via the occurrences endpoint (its `id`/`version` would be `undefined`). Fixed by widening `ActualOccurrence` and `toActualOccurrence()` (`calendar-transaction-repository.ts`) to pass all fields through.

## 5. Technical debt / deliberate simplifications

- ~~Suspected pre-existing bug: calendar API routes likely send `LocalDate` date fields as `{year,month,day}` objects, not ISO strings.~~ **Fixed in Stage 6E** (history items 19-20) — confirmed and fixed via `src/lib/api/calendar-dto.ts`; every calendar route now explicitly serializes before responding.
- **No React Query / SWR** — a hand-rolled `query-cache.ts` (subscribe/invalidate-by-prefix) + a shared generic `useQuery` (`src/lib/query/use-query.ts`, used by both `calendar` and `statistics`) stand in for a real query library, matching this project's established "no extra dependencies for what a small hook can do" convention. Query-key strings (`CALENDAR_QUERY_KEYS`) are structured compatibly if you later want to migrate to a real library. There is no request-level deduplication — e.g. `ResourceBalancePanel` and `BannerPityPanel` each independently call `fetchResourceSnapshot()`, issuing two HTTP requests for the same data on the Statistics page. Accepted as consistent with the existing pattern (Stage 5 has similar cases) rather than introducing a caching layer for Stage 6 alone.
- **Statistics' "actual" bucket re-reads `CalendarTransaction` a second time.** `getStatisticsOverview` calls the existing `getMergedOccurrences` (which itself calls `listActualOccurrencesInRange` internally) AND calls `listActualOccurrencesInRange` again directly. Originally this was because `merge.ts`'s `ActualOccurrence` stripped `source`/`bannerFamily`/`note`; Stage 6E widened `ActualOccurrence` to carry these fields for an unrelated reason (fixing edit/delete on the occurrences endpoint), so the type-level reason for the second read no longer applies. Left as-is anyway — deduplicating this is a real but separate optimization, out of scope for the Stage 6E fix, and one extra cheap read on a low-traffic reporting endpoint remains an acceptable cost.
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
- **`LocalDate` (`{year, month, day}`) is the only calendar-date representation in all math/domain/service code — it is formatted to a "YYYY-MM-DD" string ONLY at the final JSON-response boundary, via the centralized `src/lib/api/calendar-dto.ts` serializers (Stage 6E).** JS `Date` appears in exactly two places (both mechanical serialization boundaries): `src/server/repositories/calendar-local-date.ts` (Prisma `@db.Date`, via `Date.UTC(...)`) and `src/server/local-date.ts` / `src/features/calendar/local-date-client.ts` (`Intl.DateTimeFormat` to read "today", parsed back through `parseLocalDate`). `new Date(year, month, day)` is never used anywhere. Every calendar and statistics route now explicitly serializes every `LocalDate` field before `NextResponse.json()` — no route relies on `JSON.stringify` producing the right shape implicitly.
- **Domain enums mirror Prisma enums by value, not by import.** `config/gacha.ts` and `lib/calendar-math/types.ts` define their own TS enums (BannerFamily, TransactionType, CurrencyType, IncomeSource, RecurrenceFrequency, RecurrenceEndType) matching the Prisma schema's string values, so pure math code stays fully Prisma-free and unit-testable without a generated client. The repository layer bridges the two via small cast functions, documented inline.
- **Idempotency keys are client-generated (`crypto.randomUUID()`), format-validated server-side** (`^[A-Za-z0-9_-]{8,200}$`), managed client-side via `useIdempotencyKey()`. `expectedVersion` is deliberately excluded from the exception mutation's key-derivation payload since it's a concurrency mechanism detail, not part of the user's action identity.
- **Split algorithm**: splitting exactly at a series' own first occurrence collapses to an in-place edit (no zero-length predecessor, no split history). Otherwise: the old series is closed (`endType=UNTIL_DATE`, `endDate = splitDate - 1 day`), a new series is created (`splitFromSeriesId` set, inheriting the OLD series' frozen timezone), exceptions dated `>= splitDate` are reassigned to the new series, and materialized `CalendarTransaction` rows are never touched (the series service doesn't even import the transaction repository).
- **No lazy-on-read materialization anywhere.** GET endpoints are 100% read-only and side-effect-free; virtual occurrences stay virtual until an explicit one-time transaction is recorded.
- **Forecast horizon hard-capped at 90 days** (`MAX_FORECAST_HORIZON_DAYS` in `lib/calendar-math/forecast.ts`), enforced in exactly one place. Statistics uses a separate, more permissive 366-day range cap (`statisticsOverviewQuerySchema`, matching `occurrencesQuerySchema`'s existing bound) since it needs to look at long historical windows, not just a bounded forecast.
- **Currency-safety rule, applied uniformly across all of `lib/statistics-math/*`**: Polychrome, Monochrome, Encrypted Master Tape, Master Tape, and Boopon are never summed together. Every total is grouped by currency (`CurrencyAmount[]`); the one scalar cross-item number (`netFlowPolychrome`) is explicitly Polychrome-only by construction (PULL items, whose currency is never Polychrome in practice, structurally cannot contribute to it) and is named/documented as such everywhere it appears, rather than being a bare `netFlow` that silently assumes one currency.
- **"Scheduled" excludes virtual occurrences dated on or before today.** An unmaterialized series occurrence scheduled for a past date (the user never logged a matching actual transaction) is neither a real "actual" nor a genuine "still ahead" projection — it is deliberately excluded from both `actual` and `scheduled` rather than miscounted into either.

## 7. Assumptions

- Deployment target is Vercel + Supabase Postgres, reachable via `DATABASE_URL` (pooled) + `DIRECT_URL` (direct, for migrations) — or a Docker/VPS deployment using the same two connection strings (see Section 9).
- The Telegram bot integration (BotFather registration, Menu Button, domain wiring) has still never actually been performed against a real bot — only the server-side `initData` HMAC verification code exists, unit-tested against synthetic signed payloads AND (Stage 7) verified live end-to-end via the dev-auth path against a real Postgres database. No real `TELEGRAM_BOT_TOKEN` has ever been used. See Section 9's BotFather checklist for exactly what's left to go live for real.
- Local dev outside Telegram relies on `DEV_AUTH_ENABLED=true` + `DEV_TELEGRAM_USER_ID=<id>`, hard double-gated to `NODE_ENV=development` — and, as of Stage 7, this path is now actually reachable (see Section 9, "Bugs fixed").
- **This project HAS now been migrated against a real Postgres database** (Stage 7, a local instance, not Supabase specifically — see Section 9). `prisma/migrations/` is real and verified to apply cleanly to an empty database via `prisma migrate deploy`. The previous assumption here ("never migrated") is stale; do not reintroduce it.

## 8. Remaining roadmap

**Stage 5D, Stage 6, Stage 6E, Stage 7, and Stage 9 are all complete** —
see Section 2. Nothing outstanding from any "finish properly" list remains.

**Stage 5E (not started):** scope not yet defined in this conversation.

**Stage 8 (not started, explicitly out of scope so far):** anything needing real pull-by-pull history or goal tracking — requires building a `PullEvent`/`Goal` write path first (both are currently inactive schema models, see Section 5). Not yet scoped. (Previously mislabeled "Stage 7" in this document before Stage 7 was claimed by the production-readiness pass — renumbered here, no work was done under the old label.)

**No priority follow-up remains from Stage 6** — the `LocalDate` wire-serialization gap flagged there was verified and fixed in Stage 6E (Section 2, Section 4 items 19-20).

**No priority follow-up remains from Stage 7** — see Section 9 for the full list of what was verified/fixed/documented. The only genuinely-open items are external, one-time, human actions that no code change can complete: real BotFather bot registration (Section 9 checklist) and provisioning a real production Postgres instance (Supabase or otherwise) to run `prisma migrate deploy` against.

**No priority follow-up remains from Stage 9** — see Section 10 for the full writeup, including the one new BotFather step it adds (`/setdomain` for the Login Widget fallback) and what genuinely cannot be fixed client-side (Section 10.6).

**Always-outstanding infra tasks:**
- Real Telegram bot registration + Mini App domain/menu-button setup (BotFather) — see Section 9 checklist, plus Section 10's `/setdomain` addition for the web-login fallback.
- Provision a real production Postgres database and run `npx prisma migrate deploy` against it (migrations themselves are done and verified — see Section 9 — this is just "point them at the real prod DB instead of the local one Stage 7 verified against").
- Schedule `GET /api/internal/maintenance` (Section 9) — the code and docs are done; an operator still has to actually turn on the Vercel Cron / VPS crontab entry post-deploy.
- Set `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` and `SESSION_SECRET` (Section 10) if the web-login fallback should be available — both optional; the primary Mini App path works without them.

### Exact commands to run, in order, on a normal machine

```bash
npm install
cp .env.example .env        # fill in real DATABASE_URL/DIRECT_URL before migrating
npx prisma generate         # generates src/generated/prisma — no DB connection needed
npx prisma migrate deploy   # applies the existing prisma/migrations/ — needs a real DATABASE_URL/DIRECT_URL
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```

`prisma migrate deploy` (not `migrate dev --name init`) is correct here now that
`prisma/migrations/` is checked into the repo (Stage 7) — `migrate dev` is only
for authoring a *new* migration from a schema change during development; a
fresh clone should just apply the migrations that already exist.

## 9. Stage 7 — Production Readiness

Full audit + fixes across code, database, auth, environment, deployment,
security, and performance, plus a live end-to-end verification pass
against a real local Postgres database (dev-auth session -> resource edit
-> calculator -> recurring series -> split -> occurrence override -> both
occurrence-cancel and one-time-transaction delete -> forecast/statistics ->
logout, plus idempotency replay/mismatch) — not just unit tests. No
user-facing features were added.

### 9.1 Bugs found and fixed

1. **`initData` empty string rejected by Zod before reaching dev-auth (real, previously-undetected bug).** `telegramAuthRequestSchema` (`src/lib/validation/auth.ts`) required `initData` to be non-empty (`.min(1)`). `getRawInitData()` (`src/lib/telegram/webapp.ts`) returns `""` whenever the app isn't running inside Telegram — exactly the signal `resolveTelegramUser` (`auth-service.ts`) uses to route to the dev-auth fallback (or a clean `MISSING_INIT_DATA`/401 in production). The Zod schema rejected that empty string with a generic 400 before the request ever reached the service layer, meaning **the documented dev-auth bypass was completely unreachable through the real endpoint** — `npm run dev` outside Telegram could never actually log in. Found by attempting the Stage 7 live E2E verification itself (the first scenario, "first login", failed). Fixed by removing `.min(1)` (kept `.max(8192)` as the DoS guard); added a regression test (`auth.test.ts`) asserting an empty string is accepted. Verified live afterward: dev-auth login now works end-to-end against a real session/database.
2. **No migrations existed anywhere in the repo.** `prisma/migrations/` did not exist — this was previously an open, explicitly-documented gap ("this project's schema has never been migrated against a real database"). Generated the real initial migration (`20260725074203_init`) by running `prisma migrate dev --name init` against a genuinely empty local Postgres 16 database, then verified `prisma migrate deploy` applies it cleanly to a second, independent empty database with zero manual intervention.
3. **`prisma/schema.prisma`'s `CalendarTransaction` had no composite index covering its actual hot read path.** `listActualOccurrencesInRange` (called by every calendar view, every forecast, and every statistics load) filters on exactly `{userId, localDate: {gte, lte}}`, but only independent single-column `@@index([userId])` and `@@index([localDate])` existed. Added `@@index([userId, localDate])` (migration `20260725075446_add_calendar_transaction_user_localdate_index`), verified it applies cleanly on top of the init migration from an empty database.
4. **`purgeStaleSessions()`/`purgeExpiredIdempotencyRecords()` existed but were never callable from anywhere.** Both were pure repository functions with zero call sites, flagged in this document since Stage 4B/5B as "not scheduled anywhere." Added `GET /api/internal/maintenance` (bearer-secret-protected via `CRON_SECRET`, 503s if the secret isn't configured — never falls open) that runs both and reports counts; wired a daily Vercel Cron entry (`vercel.json`) calling it. A VPS deployment schedules the same endpoint via crontab/systemd timer instead (see 9.4).
5. **Dead code**: `src/components/ui/coming-soon.tsx` (`ComingSoon` component) had zero import sites anywhere — every page it was presumably a placeholder for (`calculator`, `calendar`, `statistics`) now renders its real Stage 3/5/6 feature component. Removed.
6. **No startup validation of required environment variables.** A missing `DATABASE_URL` or (in production) `TELEGRAM_BOT_TOKEN` previously only surfaced as a 500 on whichever request happened to touch it first. Added `src/instrumentation.ts` (`register()`, runs once when a Next.js server instance starts, before any request is handled) — throws a clear, explicit error naming exactly which variable is missing. Verified live: `next start` under `NODE_ENV=production` with `TELEGRAM_BOT_TOKEN` unset crashed immediately with `Missing required environment variable(s): TELEGRAM_BOT_TOKEN. See .env.example.`; setting it let the server start and serve real requests correctly.
7. **`output: "standalone"` (added for the Docker build) silently breaks `next start`.** Next.js explicitly warns `"next start" does not work with "output: standalone" configuration` — this would have broken the project's own default `npm run start` for every non-Docker use (local prod testing, a plain VPS without Docker) the moment `output: standalone` was added globally. Fixed by gating it behind a `BUILD_STANDALONE=true` env var, set only by the Dockerfile's build stage; `npm run build && npm run start` is unaffected (verified live, both with and without the flag).
8. **`next build` requires `DATABASE_URL` to be set even to a syntactically-valid placeholder** (not a newly-introduced bug — pre-existing behavior, but undocumented and would have silently broken a naive Docker build). `next build`'s page-data-collection step statically imports every route module, which imports `src/lib/db/prisma.ts`, whose module-level `PrismaClient` constructor throws if `DATABASE_URL` is unset. No live DB connection is actually opened at build time — a placeholder string is sufficient (confirmed live: build succeeds with a fake, unreachable `DATABASE_URL`/`DIRECT_URL`, and `prisma generate` needs no env vars at all). Documented in the Dockerfile itself and in 9.4 below; did not change `prisma.ts` (would be a real behavior change to a working, deliberately-eager singleton-caching pattern — see Section 6 — for no benefit).
9. **Real Vercel deployment failure (post-Stage-7): `Module not found: Can't resolve '@/generated/prisma/client'`.** `src/generated/prisma` is gitignored, and nothing in the build pipeline ever ran `prisma generate` on Vercel — locally this was always done by hand (item 8's own note above says as much: "must be regenerated after `npm install`" was true but not automated). Fixed with two layers, both verified independently against a truly clean state (`rm -rf node_modules src/generated .next`, no manual `prisma generate` anywhere): `"postinstall": "prisma generate"` in `package.json` (the standard Prisma-recommended fix — runs whenever `npm install`/`npm ci` runs, which Vercel always does) and `"build": "prisma generate && next build"` (a second, independent guarantee at build time, in case an install step's lifecycle scripts are ever skipped by some other environment). The Dockerfile's `deps` stage now also copies `prisma/` + `prisma.config.ts` in before `npm ci`, since that stage's `npm ci` now runs the same `postinstall` and needs the schema present to succeed.
10. **Real Vercel deployment failure (post-Stage-7, real Telegram auth): `POST /api/auth/telegram` 500s on the first request that actually touches the database; nothing before it does.** Root cause: `src/lib/db/prisma.ts`'s `createPrismaClient()` passed `new PrismaPg({ connectionString })` with no `ssl` option at all. `pg` only negotiates TLS if the connection string itself carries `sslmode=require`; without it, `pg` attempts a plaintext handshake. Managed Postgres providers — Supabase, this project's documented deployment target — enforce TLS on both their pooled and direct endpoints and reject a plaintext connection outright, which surfaces as a raw `PrismaClientKnownRequestError` (`code: "P1001"`, "Can't reach database server") at query time, not at import time — so routing, Zod validation, and the real Telegram HMAC check all succeed first, and only the DB write (user upsert / session create) fails. Since it isn't an `AuthError`, it fell into the route's generic catch-all, which only logged `console.error("...", err)` — Vercel's collapsed log view showed just the message text, not the code/meta/stack needed to diagnose it. **Verification method**: could not reach the actual deployed Vercel instance or real Supabase database directly, so this was reproduced as faithfully as possible instead — a genuinely realistic, correctly HMAC-signed `initData` payload (matching real Telegram's shape: `is_premium`, `chat_instance`, `signature`, `start_param`, etc.) driven through the exact production configuration (`NODE_ENV=production`, `next start`, a real — local — Postgres). This confirmed the auth/verification/session-creation logic itself is correct (200 OK, real session cookie, real DB rows) and narrowed the fix to the one genuinely production-only gap: TLS negotiation, which a local trust-auth Postgres never exercises. **Fix, two parts**: (a) `resolveSslConfig()` in `prisma.ts` now forces `ssl: { rejectUnauthorized: false }` (Prisma's own documented guidance for Supabase) for any non-`localhost` host, so this no longer depends on the operator remembering a query param — verified this doesn't affect local dev (still connects to `localhost:5432` with no TLS, confirmed live). (b) The auth route's catch-all now logs a fully expanded `describeError()` (name, message, stack, and any Prisma `code`/`errorCode`/`meta`/`clientVersion`/`cause`) instead of the raw error object — verified live by pointing `DATABASE_URL` at a closed port and confirming the log line now shows the exact Prisma error code and stack trace instead of a bare message. If the real Vercel deployment's DB is reachable over TLS but the 500 persists, these logs will now name the actual cause (most likely candidates if so: migrations never applied to the real production DB — see 9.4/9.5's checklist — or a malformed `DATABASE_URL`/`DIRECT_URL`).

### 9.2 Security audit

- **Authentication**: `verifyTelegramInitData` (`src/lib/telegram/verify.ts`) implements Telegram's documented HMAC-SHA256 algorithm correctly, with a constant-time hash comparison (`timingSafeEqualHex`) and a bounded `auth_date` freshness window (24h + 5s clock-skew tolerance). Session tokens are 256-bit `crypto.randomBytes`, stored only as a SHA-256 hash (`sessions.tokenHash`) — a DB leak alone cannot be replayed as a usable session. Cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`, 30-day expiry. Dev-auth is triple-gated (`NODE_ENV=development` AND `DEV_AUTH_ENABLED=true` AND a caller-uncontrollable server-side `DEV_TELEGRAM_USER_ID`) and dynamically imported only inside that already-guarded branch, so it is not reachable at all in a production build. See 9.1 item 1 for the one real bug found in this path.
- **Authorization / IDOR**: every route except the two auth routes themselves (`login`, `logout` — correctly unauthenticated/self-scoped) calls `getCurrentUser()`, which resolves strictly from the server-side session cookie, never from client-supplied input (verified: zero routes read a `userId` from the request body/query — Zod schemas have no such field, and `.strict()` rejects one if a client tries to smuggle it in, e.g. `auth.test.ts`'s and `series/route.test.ts`'s explicit smuggling-rejection tests). Every mutating repository call scopes its `where` by `userId` (spot-checked: `calendar-transaction-repository.ts`, `calendar-event-series-repository.ts`, `banner-state-repository.ts`, `resource-balance-repository.ts` — all `updateMany`/`deleteMany`/`findFirst` calls include `userId`). One repository function (`upsertExceptionWithVersion`) scopes by `{seriesId, occurrenceDate, version}` without `userId` in that specific call — verified safe because its only caller (`upsertOccurrenceException`, `calendar-event-exception-service.ts`) already resolves and ownership-checks the series via `getSeriesById(userId, seriesId)` first, and a series' `userId` is never reassigned after creation, so there's no TOCTOU window.
- **Input validation**: every write endpoint uses a Zod `.strict()` schema (rejects unknown fields outright — verified via dedicated tests at multiple routes). Found and fixed the one real gap (9.1 item 1).
- **Optimistic concurrency**: `resource_balances`, `banner_states`, `calendar_event_series`, `calendar_event_exceptions`, and `calendar_transactions` all use the same `version` + atomic `updateMany({where: {..., version: expectedVersion}})` pattern — a stale write affects zero rows, detected via `result.count === 0`, mapped to a typed `STALE_STATE` (409) response carrying the current server-side record so the client can re-diff rather than blindly retry. Verified live in Stage 7's E2E pass (the split-then-edit sequence exercises version increments correctly).
- **Idempotency**: `IdempotencyRecord` (userId, action, idempotencyKey, requestHash) — a retried request with the *same* key and *same* (canonicalized, hashed) payload replays the original response (`replay: true`); the *same* key with a *different* payload is rejected as `IDEMPOTENCY_KEY_REUSED` (409), never silently replays the wrong result. Both paths verified live against a real database in Stage 7 (resubmitting `PUT /api/resources` with an identical key+payload replayed correctly; resubmitting with the same key and a different payload was correctly rejected).
- **CSRF**: cookie is `SameSite=Lax`, and — verified across every route file — no `GET` handler anywhere mutates state, so a cross-site top-level navigation (the one case `SameSite=Lax` still allows) can't trigger a write. Cross-site `fetch()`/XHR `POST`s don't carry the cookie under `Lax` at all. No separate CSRF token is needed given this shape.
- **XSS**: no `dangerouslySetInnerHTML`, `eval`, or `new Function` anywhere in `src/` (verified via full-repo grep). React's default JSX escaping covers all rendered user content (transaction notes, series notes, etc.).
- **Secrets handling**: `TELEGRAM_BOT_TOKEN` is read only in `auth-service.ts` (`server-only`-adjacent, never a `NEXT_PUBLIC_*` var, never returned in any response). `.env*` is gitignored. Session tokens/idempotency keys are hashed or opaque before storage. Added `.dockerignore` (excludes `.env*`) specifically because Next's standalone build output copies whatever `.env` file is present on disk at build time into the deployable bundle (verified live: it does, when one exists) — the Dockerfile's build stage therefore uses placeholder env vars, never a real `.env`, so no real secret can be baked into an image layer.
- **Known, accepted risk — not changed**: Telegram Desktop and `web.telegram.org` embed Mini Apps in an iframe; some browsers' third-party-cookie restrictions (Safari ITP, Chrome's ongoing phase-out) can in principle prevent a `SameSite=Lax` cookie from round-tripping inside that iframe context. This is a known, widely-reported Telegram Mini App gotcha, not something introduced here. No code change was made for it (redesigning session delivery to not depend on cookies is a real architectural change, well beyond an audit-and-fix pass) — flagged in the release checklist (9.5) as something to specifically test against real Telegram Desktop/Web before launch, with a token-in-`initData`-per-request fallback as the documented escape hatch if it's confirmed broken.
- **Rate limiting — recommendation only, not implemented**: no rate limiting exists anywhere (no `middleware.ts`, no dependency on any rate-limit service). Both `/api/auth/telegram` and every write endpoint are unlimited today. Recommend adding IP+session-based limiting (e.g. `@upstash/ratelimit` on Vercel, or a reverse-proxy-level limit on a VPS/Docker deployment) before high-traffic launch — deliberately not implemented here since it requires provisioning an external service, which is infrastructure the app's owner needs to choose and pay for, not something to add silently.
- **Security headers**: added `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (denies camera/microphone/geolocation/payment/usb — none are used), `Strict-Transport-Security` (`next.config.ts`). Deliberately did **not** add `X-Frame-Options` or a `frame-ancestors` CSP directive — either would block Telegram Desktop/Web's iframe embedding and break the app for those clients. Did **not** add a full `Content-Security-Policy` (script-src etc.) — the app loads `https://telegram.org/js/telegram-web-app.js` via a plain `<script>` tag and Next.js itself relies on inline hydration scripts; a CSP tight enough to be meaningful needs nonce wiring and real-browser testing this environment can't do (no live Telegram client to verify against) — recommended as a follow-up, not guessed at blindly here.

### 9.3 Performance audit

Full findings from the dedicated audit pass; only the composite index (9.1
item 3) was acted on — the rest are `find`, not `fix`, per this stage's
scope, ranked by actual impact at realistic Telegram Mini App traffic
(hundreds-to-low-thousands of users, not millions):

- **Real, unaddressed**: `MonthGridView`/`DayCell` (`src/features/calendar/`) re-render every day cell on any calendar page state change (e.g. opening any dialog) — neither is wrapped in `React.memo`, and callbacks passed down aren't `useCallback`-stabilized. Cheap leaf components, bounded to one month grid (~35-42 cells), so the cost is low today; a real, easy fix (`React.memo(DayCell)` + `useCallback`) if the calendar UI ever gets janky.
- **Real, unaddressed, already partly documented**: `ResourceBalancePanel` and `BannerPityPanel` both fetch the same resource-balance endpoint under *different* cache keys (`"statistics:resource-balance"` vs `"statistics:resource-balance-for-pity"`), so even a future request-dedup layer would still miss between them unless the keys are unified first. The Statistics page overall fires 4 independent GETs on mount with zero sharing.
- **Real, unaddressed, already documented** (DEVELOPMENT_STATUS Section 5): `getStatisticsOverview` reads `CalendarTransaction` twice per request (once via `getMergedOccurrences`, once directly) because `ActualOccurrence` used to strip fields the statistics breakdowns needed. Stage 6E's fix (widening `ActualOccurrence`) removed the *original* reason for this, but deduplicating the reads themselves is a separate change, left as-is.
- **Confirmed non-issues** (verified, not just assumed): `lib/query/query-cache.ts`'s invalidation is correctly scoped by key prefix, not global; every pure `lib/*-math/*.ts` hot path (recurrence expansion, merge, forecast, statistics aggregation) already uses single-pass `Map`/`Set` grouping, no `O(n²)` patterns found; no N+1 query pattern found in any repository/service (batch lookups like `listExceptionsForSeriesIds` are already used correctly); every `findMany` without an explicit `take` is bounded indirectly by an existing request-range cap (366 days server-side).
- **Fixed**: the one confirmed missing index (`CalendarTransaction(userId, localDate)`, 9.1 item 3). A second, optional composite (`CalendarEventSeries(userId, isActive)`) was evaluated and skipped — per-user series counts are naturally small, so it's low-impact.

### 9.4 Deployment

**Recommended production settings** (both targets): `NODE_ENV=production`;
real `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) pointing at your
production Postgres; real `TELEGRAM_BOT_TOKEN` from BotFather;
`NEXT_PUBLIC_APP_URL` set to your real HTTPS deployment URL;
`DEV_AUTH_ENABLED` unset or `false` (it's hard-gated to
`NODE_ENV=development` regardless, but leave it explicit); a `CRON_SECRET`
if you wire up the maintenance endpoint (9.1 item 4) — leave it unset to
keep that endpoint disabled (503) if you don't.

**Vercel:**

1. Import the repo, framework preset auto-detects Next.js — no build
   command override needed (do **not** set `BUILD_STANDALONE`; Vercel uses
   its own build pipeline and `output: standalone` is irrelevant to it).
2. Set the environment variables above in the Vercel project settings
   (Production + Preview as appropriate).
3. Run `npx prisma migrate deploy` against the production `DATABASE_URL`/
   `DIRECT_URL` once, out-of-band (a local shell, or a one-off Vercel
   deploy hook/GitHub Action step) — this repo does **not** run migrations
   automatically on deploy, by design, so a bad migration can never block
   or corrupt a live deploy silently.
4. `vercel.json` already declares the daily `GET /api/internal/maintenance`
   cron (03:00 UTC) — Vercel automatically sends
   `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when
   `CRON_SECRET` is set as a project env var, matching this endpoint's
   expectation exactly. No extra wiring needed beyond setting the env var.

**VPS with Docker:**

1. `docker build -t proxy-pull-planner .` — multi-stage build; the build
   stage uses a placeholder `DATABASE_URL`/`DIRECT_URL` (see 9.1 item 8 and
   the Dockerfile's own comments) and never receives real secrets; the
   final image contains only the traced standalone server, no `.env`, no
   full `node_modules`, no source.
2. Run `npx prisma migrate deploy` against the real production DB once,
   from anywhere with network access to it (does not need to be from
   inside the container) — same reasoning as the Vercel step.
3. `docker run -p 3000:3000 -e DATABASE_URL=... -e DIRECT_URL=... -e TELEGRAM_BOT_TOKEN=... -e NEXT_PUBLIC_APP_URL=... [-e CRON_SECRET=...] proxy-pull-planner`
   — real secrets are injected purely at container-run time.
4. Put a reverse proxy (Caddy/nginx/Traefik) in front for TLS termination
   — Telegram requires the Mini App to be served over HTTPS. Caddy is the
   least-config option (automatic Let's Encrypt).
5. Schedule the maintenance sweep yourself — a crontab entry or systemd
   timer running (daily is enough):
   `curl -sf -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/internal/maintenance`

### 9.5 Telegram BotFather / Mini App configuration checklist

Nothing here has been done against a real bot — this is exactly the
external, human, one-time setup that remains before going live:

- [ ] Register a bot with [@BotFather](https://t.me/BotFather) (`/newbot`), copy the token into `TELEGRAM_BOT_TOKEN` (production env, never committed).
- [ ] `/setmenubutton` (or `/newapp` for a full Mini App) pointing at your deployed HTTPS URL (`NEXT_PUBLIC_APP_URL`) — must be HTTPS, Telegram will not launch a Mini App over plain HTTP.
- [ ] `/setdomain` if using the Menu Button + Web App login widget path, matching your deployed domain exactly.
- [ ] Confirm `auth_date` freshness (24h window, `verify.ts`) is acceptable for your expected usage pattern — Telegram refreshes `initData` on every WebApp reopen, so this only matters for a tab left open unusually long.
- [ ] Test the real launch flow from **both** Telegram mobile (iOS/Android) and Telegram Desktop/`web.telegram.org` specifically — the latter runs the Mini App in an iframe (see 9.2's cookie/iframe note); confirm login actually completes there before considering the app launch-ready.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the exact deployed URL and re-check `/setmenubutton` matches it after any domain change.
- [ ] Decide on and set `CRON_SECRET` (Vercel) or configure the crontab/systemd timer (VPS) for `/api/internal/maintenance` (9.1 item 4) — otherwise sessions/idempotency records accumulate forever.
- [ ] Provision a real production Postgres instance (Supabase or otherwise) and run `npx prisma migrate deploy` against it (9.4).
- [ ] Decide on rate limiting before any public/high-traffic launch (9.2) — not implemented, recommendation only.

## 10. Stage 9 — Alternative Telegram Client Compatibility

**Problem this stage fixes**: official Telegram (iOS/Android/Desktop)
populates `Telegram.WebApp.initData` reliably. AyuGram (and potentially
other unofficial clients) opens the Mini App WebView but sometimes leaves
`initData` empty — either never populating it, or populating it a beat
after `WebApp` itself first appears. Before this stage, the app read
`initData` exactly once on first React render and, finding it empty,
showed a generic "must be opened through Telegram" error — with no way
to log in at all, even though the user genuinely had no way to fix it
from their side except switching apps.

**Security invariant preserved throughout**: Telegram authentication is
never bypassed. `initDataUnsafe`, URL params, username, platform,
user-agent, and any client-supplied identifier are never trusted for
auth — every identity claim is independently, cryptographically
re-verified server-side (`verify.ts` for Mini App initData,
`verify-login-widget.ts` for the new web-login fallback — two genuinely
different HMAC algorithms, never conflated). Confirmed by the "uses a
different secret-key derivation" test in `verify-login-widget.test.ts`
and the live E2E CSRF-rejection test below.

### 10.1 What was implemented, per requirement area

1. **Diagnostics** (`src/lib/telegram/diagnostics.ts`): a typed
   `snapshotTelegramEnvironment()` reporting `webAppPresent`,
   `initDataPresent`, `version`, `platform`, and `initDataUnsafePresent`
   (a presence boolean only — its contents are never read for anything).
   `isWebAppVersionAtLeast()` wraps Telegram's own official
   `WebApp.isVersionAtLeast()` feature-detection helper. Deliberately does
   **not** fingerprint specific unofficial clients via `navigator.userAgent`
   — Telegram's own reported `platform`/`version` are the structured,
   official way to distinguish clients, and UA-sniffing a specific
   third-party client name is fragile (breaks the moment that client
   changes its UA string) and wasn't needed for anything this app does
   differently per-client.
2. **Initialization robustness** (`src/lib/telegram/webapp.ts`,
   `waitForTelegramLaunch()`): polls for `WebApp.initData` to become
   non-empty, up to a bounded 1.5s ceiling — resolves immediately if
   already ready (no artificial delay in the common case), and always
   terminates (no infinite retry loop; the deadline is checked every
   iteration). `telegram-web-app.js` was also switched from a plain
   `<script async>` tag to `next/script` with `strategy="beforeInteractive"`
   (`layout.tsx`) — loads before any Next.js code runs, minimizing how
   much of the bounded window actually gets used, though the bounded wait
   remains the real robustness mechanism since script-loaded doesn't
   guarantee `initData`-populated. `ready()`/`expand()` (and
   `BackButton.show()`/`hide()`) now feature-detect the method's presence
   and swallow exceptions before calling — a partial/unofficial `WebApp`
   object missing a method, or one that throws, no longer takes anything
   else down (`initTelegramWebApp`/`showBackButton`/`hideBackButton` in
   `webapp.ts`).
3. **Error states** (`src/components/providers/auth-provider.tsx`):
   `bootstrapSession()` now categorizes every outcome into a typed
   `AuthFailureCategory` — `EMPTY_INIT_DATA` (WebApp present, initData
   never became non-empty), `NO_TELEGRAM` (WebApp never appeared; server
   confirms `MISSING_INIT_DATA`), `INIT_DATA_REJECTED` (server's
   cryptographic check failed — bad/stale/tampered signature),
   `SERVER_MISCONFIGURED` (missing `TELEGRAM_BOT_TOKEN` server-side — not
   the client's fault), `BACKEND_ERROR` (network/500/anything else). The
   `EMPTY_INIT_DATA` case is short-circuited client-side without a wasted
   server round trip — the server can't distinguish "WebApp present but
   empty" from "no WebApp at all" (both send an empty string), and the
   client already has the more specific answer from the bounded wait.
   `src/app/page.tsx` shows the exact required message for
   `EMPTY_INIT_DATA` (localized — the rest of this app's UI is Russian
   throughout; the string is an exact translation, not a paraphrase):
   > Этот клиент Telegram не передал безопасные данные авторизации.
   > Откройте приложение в официальном клиенте Telegram или используйте
   > безопасный вход через браузер.
   > *(This Telegram client did not provide secure authorization data.
   > Open the app in the official Telegram client or use secure web
   > login.)*
4. **Secure fallback authentication** — see 10.2 below, the largest piece.
5. **Client compatibility UI** (`src/components/providers/theme-provider.tsx`,
   `globals.css`, `bottom-nav.tsx`): Telegram's `theme_params` are now
   exposed as `--tg-theme-*` CSS custom properties on `:root` — a
   progressive enhancement layered ON TOP of this app's own branded
   palette (deliberately not a replacement: swapping to an arbitrary
   client theme's colors wholesale would risk breaking this app's
   deliberate ZZZ-styled brand identity depending on the user's Telegram
   theme; `colorScheme` light/dark, already handled before this stage, is
   the one Telegram theme signal this app actually adopts outright).
   `WebApp.viewportStableHeight` is exposed as `--tg-viewport-stable-height`
   and preferred over `100%`/`100vh` for the body's `min-height` (`globals.css`)
   — Telegram recommends this over `viewportHeight` (jitters during
   keyboard/UI animations) and over CSS viewport units (unaware of
   Telegram's own chrome). `WebApp.safeAreaInset`/`contentSafeAreaInset`
   (Bot API 8.0+) are exposed as `--tg-safe-area-inset-*`/
   `--tg-content-safe-area-inset-*` and preferred over the plain CSS
   `env(safe-area-inset-*)` in `BottomNav`, via a CSS `var()` fallback
   chain (`var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom))`)
   — falls back cleanly outside Telegram or on older clients that don't
   report it. All three subscribe to `WebApp.viewportChanged`
   (feature-detected) to stay live. Every new WebApp API call added in
   this stage is feature-detected before use, matching the existing
   `HapticFeedback`/`BackButton` pattern. A real, pre-existing null-safety
   bug in `getThemeParams()` was found and fixed along the way (returned
   `undefined` — mistyped as `Record<string,string>` — whenever a
   `WebApp` object existed but had no `themeParams` field; harmless before
   this stage since nothing actually called it, but would have crashed
   the moment a real caller iterated over the result, which
   `applyThemeParams()` now does).
6. **Diagnostics logging** — see 10.3 below.
7. **Tests** — see 10.4 below.

### 10.2 Secure fallback authentication: the Telegram Login Widget

Researched against Telegram's official Login Widget documentation
(https://core.telegram.org/widgets/login). This is a **completely
separate protocol** from Mini App `initData`, with a **different
secret-key derivation** — mixing the two up would silently break
verification (or worse, invite a cross-protocol confusion bug):

- Mini App initData: `secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)`
- Login Widget: `secret_key = SHA256(bot_token)` — a **plain digest**, used directly as the HMAC key

Implemented as genuinely separate code end-to-end, never sharing a
verification function with the Mini App path:

- `src/lib/telegram/verify-login-widget.ts` — the Login Widget's own HMAC
  check, `auth_date` freshness window, constant-time hash comparison.
  Explicitly tested (`verify-login-widget.test.ts`) to confirm a
  Mini-App-style hash does **not** validate here, and vice versa (proven
  the two protocols can't be confused for each other).
- `src/lib/auth/login-nonce.ts` — the CSRF defense. The Login Widget
  protocol itself has **no state/nonce passthrough** — its callback
  payload is exactly Telegram's own fixed field set (`id`, `first_name`,
  ..., `hash`), nothing app-supplied can ride along with it. So the CSRF
  defense lives one layer up: `GET /api/auth/telegram-login/nonce` mints
  a random nonce, hands the raw value to the client (to echo back in its
  POST body) and a **signed** copy (HMAC'd with `SESSION_SECRET` — this
  is the "reserved for a future signed-cookie/session-secret need" env
  var from Stage 2, now genuinely used for exactly that) to an HttpOnly,
  5-minute-TTL cookie. `POST /api/auth/telegram-login/verify` requires
  the two to match — a cross-origin attacker page can neither read nor
  forge our HttpOnly cookie, nor guess the random nonce, so it cannot
  construct a request that passes. This is the classic double-submit-
  cookie pattern, made self-verifying (no server-side nonce store needed
  for a short-lived, rarely-used fallback path). **Honest security
  property**: this defeats cross-origin CSRF (the actual threat model
  asked for) — it is not a replay-proof single-use token store; a party
  that already has HttpOnly-cookie access (e.g. via XSS) could resubmit
  within the 5-minute TTL, but that's beyond what CSRF protection covers,
  and the underlying Telegram-signed payload's own `auth_date` freshness
  check adds a second, independent time bound regardless.
- `src/server/services/auth-service.ts`,
  `authenticateWithTelegramLoginWidget()` — a distinct function (not a
  branch inside the existing `authenticateWithTelegram`), throwing its
  own `LoginWidgetAuthError` (distinct from `AuthError`), verifying the
  nonce **before** even looking at the Telegram signature (fail fast on
  the cheaper check), then reusing the exact same
  `upsertUserFromTelegram`/`createSession` repository calls the Mini App
  path uses — one real session, one real user row, no parallel/shadow
  user model for "web-login users."
- `src/app/api/auth/telegram-login/nonce/route.ts` and
  `.../verify/route.ts` — fail closed (503) if `SESSION_SECRET` isn't
  configured, never fall open; the verify route always clears the nonce
  cookie (success or failure) so it's never reusable from that browser
  again.
- `src/components/auth/telegram-login-widget.tsx` — renders the official
  widget script (`telegram-widget.js`), wires its `data-onauth` JS
  callback to fetch the nonce first, then POST to the verify endpoint.
  Renders nothing if `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` isn't
  configured — the fallback is simply unavailable, never a broken UI
  element.
- Shown **only** when `authFailureCategory` is `EMPTY_INIT_DATA` or
  `NO_TELEGRAM` (`src/app/page.tsx`) — never for a rejected signature or
  a backend failure, where a second login method wouldn't help and could
  mislead the user into thinking it would.
- **Verified live**, end-to-end, against a real local Postgres database
  (not just unit tests): minted a real nonce, built a genuinely
  HMAC-signed Login Widget payload, verified it creates a real session
  and a real user row; replaying the same request after the nonce cookie
  was cleared → 403; a validly-signed Telegram payload submitted with
  **no** nonce cookie at all (the actual CSRF shape — a forged
  cross-origin request) → 403. The primary Mini App `initData` path was
  re-verified live afterward to confirm zero regression.

### 10.3 Diagnostics logging

`POST /api/diagnostics/auth` (`src/app/api/diagnostics/auth/route.ts`) —
unauthenticated (fires before login can succeed in the failure cases this
exists for), logs one structured line per launch/auth attempt:
`platform`, `webAppVersion`, `initDataPresent`, `launchPath`,
`authFailureCategory`. The Zod schema (`authDiagnosticEventSchema`,
`.strict()`) **is** the privacy guarantee, not a convention to remember:
there is no field for `initData`/`hash`/`token`/user payload/cookies, and
an unlisted field is rejected outright rather than silently dropped —
nothing sensitive can reach this log line even by future-developer
mistake. Verified live: the log line that actually appears in the server
log is exactly the five allow-listed fields, nothing else. Client side,
`reportAuthDiagnostic()` (`src/lib/telegram/diagnostics-log.ts`) is a
fire-and-forget `fetch()` — never throws into the caller, never blocks
the auth flow.

### 10.4 Tests added

66 new tests across 9 new/extended files:
`verify-login-widget.test.ts` (10), `login-nonce.test.ts` (10),
`diagnostics.test.ts` (12), `webapp.test.ts` (+20, bounded polling +
feature-detection hardening), `auth-service.test.ts` (11, new file —
this was the first direct test coverage for `authenticateWithTelegram`
itself, not just its route), `telegram-login/nonce/route.test.ts` (3),
`telegram-login/verify/route.test.ts` (10), `diagnostics/auth/route.test.ts`
(7), `telegram-login-widget.test.tsx` (7), `auth-provider.test.tsx` (10,
new file), `theme-provider.test.tsx` (7, new file), `page.test.tsx` (7,
new file). Every explicitly-requested scenario is covered: delayed
Telegram object initialization, Telegram object present with empty
initData, valid initData, invalid initData, browser fallback login,
state/nonce rejection, session creation after fallback login, and
unsupported methods/old WebApp versions.

### 10.5 Files changed

New: `src/lib/telegram/diagnostics.ts` (+test),
`src/lib/telegram/diagnostics-log.ts`,
`src/lib/telegram/verify-login-widget.ts` (+test),
`src/lib/auth/login-nonce.ts` (+test),
`src/lib/api/error-logging.ts` (extracted from the Stage 7 auth-route fix,
now shared),
`src/app/api/auth/telegram-login/nonce/route.ts` (+test),
`src/app/api/auth/telegram-login/verify/route.ts` (+test),
`src/app/api/diagnostics/auth/route.ts` (+test),
`src/components/auth/telegram-login-widget.tsx` (+test),
`src/server/services/auth-service.test.ts`,
`src/components/providers/auth-provider.test.tsx`,
`src/components/providers/theme-provider.test.tsx`,
`src/app/page.test.tsx`.
Modified: `src/types/telegram.d.ts` (`isVersionAtLeast`, `safeAreaInset`,
`contentSafeAreaInset`), `src/lib/telegram/webapp.ts` (bounded polling,
feature-detection hardening, viewport/safe-area accessors, the
`getThemeParams` null-safety fix), `src/lib/validation/auth.ts` (Login
Widget + diagnostics schemas), `src/server/services/auth-service.ts`
(`authenticateWithTelegramLoginWidget`), `src/app/api/auth/telegram/route.ts`
(now uses the shared `error-logging.ts`), `src/components/providers/auth-provider.tsx`
(full rewrite — bounded wait, categorization, diagnostics, the widget
completion path), `src/components/providers/theme-provider.tsx` (theme/
viewport/safe-area CSS vars), `src/app/page.tsx` (differentiated error UI
+ fallback widget), `src/app/layout.tsx` (`next/script` `beforeInteractive`),
`src/app/globals.css`, `src/components/navigation/bottom-nav.tsx`,
`.env.example`.

### 10.6 What's fundamentally client-dependent (no code fix possible)

- **Whether a given unofficial client populates `initData` at all.**
  Nothing server- or app-side can make a client send data it was never
  built to send — the bounded wait only helps with *timing* (late
  population), not a client that never populates it under any
  circumstance. For those, the web-login fallback is the only path, by
  design.
- **Whether `WebApp.viewportStableHeight`/`safeAreaInset`/
  `isVersionAtLeast`/etc. exist at all** — purely a function of which Bot
  API version a given client implements. Every accessor added in this
  stage degrades gracefully (returns `null`/`false`) rather than throws,
  but a client on an old Bot API version simply doesn't get the improved
  behavior; there's no polyfill for a native platform API that isn't there.
- **The Telegram Desktop/`web.telegram.org` iframe third-party-cookie
  risk** (flagged in Stage 7, Section 9.2) — unrelated to this stage's
  changes, still an open, documented risk for the primary Mini App path
  specifically (not the web-login fallback, which is a normal top-level
  page navigation with no iframe involved).
- **A client that lies about its own platform/version fields** — those
  are read for diagnostics/UI-adaptation only, never for authentication,
  so a dishonest client can at most get a slightly wrong loading-skeleton
  cosmetic treatment, never a security bypass.

### 10.7 BotFather configuration this stage adds

On top of the Section 9.5 checklist, going live with the web-login
fallback specifically needs:

- [ ] `/setdomain` with [@BotFather](https://t.me/BotFather), pointing at the exact HTTPS domain the Login Widget is served from — Telegram validates the widget's origin against this before it will render/authorize anything. (Already listed in 9.5 item 3; this is what it was anticipating.)
- [ ] Set `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (no `@`) to the same bot as `TELEGRAM_BOT_TOKEN`.
- [ ] Set `SESSION_SECRET` to a real random value in production — without it, `GET /api/auth/telegram-login/nonce` 503s and the fallback is simply unavailable (the primary Mini App path is unaffected either way).
- [ ] Both are optional — omit either to leave the fallback disabled entirely if it isn't wanted yet.
