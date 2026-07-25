-- CreateEnum
CREATE TYPE "BannerFamily" AS ENUM ('EXCLUSIVE_AGENT', 'W_ENGINE', 'STABLE', 'BANGBOO');

-- CreateEnum
CREATE TYPE "CurrencyType" AS ENUM ('POLYCHROME', 'ENCRYPTED_MASTER_TAPE', 'MASTER_TAPE', 'BOOPON', 'MONOCHROME');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'PULL');

-- CreateEnum
CREATE TYPE "IncomeSource" AS ENUM ('DAILY', 'EVENT', 'QUEST', 'ENDGAME', 'MAIL', 'PROMO_CODE', 'BATTLE_PASS', 'MEMBERSHIP', 'PURCHASE', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalTargetType" AS ENUM ('AGENT_COPIES', 'W_ENGINE_COPIES', 'AGENT_AND_W_ENGINE', 'PULL_AMOUNT', 'RESOURCE_AMOUNT');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RecurrenceEndType" AS ENUM ('NEVER', 'UNTIL_DATE', 'AFTER_COUNT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "languageCode" TEXT,
    "photoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "language" TEXT NOT NULL DEFAULT 'ru',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "includeMonochromeAsPolychrome" BOOLEAN NOT NULL DEFAULT false,
    "defaultBannerFamily" "BannerFamily" NOT NULL DEFAULT 'EXCLUSIVE_AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_balances" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "polychrome" INTEGER NOT NULL DEFAULT 0,
    "encryptedMasterTape" INTEGER NOT NULL DEFAULT 0,
    "masterTape" INTEGER NOT NULL DEFAULT 0,
    "boopon" INTEGER NOT NULL DEFAULT 0,
    "monochrome" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner_states" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bannerFamily" "BannerFamily" NOT NULL,
    "sRankPity" INTEGER NOT NULL DEFAULT 0,
    "aRankPity" INTEGER NOT NULL DEFAULT 0,
    "guaranteeActive" BOOLEAN NOT NULL DEFAULT false,
    "lastSRankWasFeatured" BOOLEAN,
    "selectedBangbooId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banner_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_series" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "currencyType" "CurrencyType",
    "amount" INTEGER NOT NULL,
    "source" "IncomeSource",
    "bannerFamily" "BannerFamily",
    "note" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "daysOfWeek" INTEGER[],
    "dayOfMonth" INTEGER,
    "startDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "endType" "RecurrenceEndType" NOT NULL DEFAULT 'NEVER',
    "endDate" DATE,
    "occurrenceCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "splitFromSeriesId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_exceptions" (
    "id" UUID NOT NULL,
    "seriesId" UUID NOT NULL,
    "occurrenceDate" DATE NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "amountOverride" INTEGER,
    "currencyTypeOverride" "CurrencyType",
    "sourceOverride" "IncomeSource",
    "bannerFamilyOverride" "BannerFamily",
    "noteOverride" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_transactions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "currencyType" "CurrencyType",
    "amount" INTEGER NOT NULL,
    "source" "IncomeSource",
    "bannerFamily" "BannerFamily",
    "note" TEXT,
    "seriesId" UUID,
    "occurrenceDate" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bannerFamily" "BannerFamily" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pullsInSeries" INTEGER NOT NULL,
    "sRankPosition" INTEGER NOT NULL,
    "wasFeatured" BOOLEAN NOT NULL,
    "pullsAfter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pull_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "bannerFamily" "BannerFamily" NOT NULL,
    "targetType" "GoalTargetType" NOT NULL,
    "targetCopies" INTEGER NOT NULL DEFAULT 1,
    "targetPulls" INTEGER,
    "targetDate" DATE,
    "includeCurrentResources" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "resource_balances_userId_key" ON "resource_balances"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "banner_states_userId_bannerFamily_key" ON "banner_states"("userId", "bannerFamily");

-- CreateIndex
CREATE INDEX "calendar_event_series_userId_idx" ON "calendar_event_series"("userId");

-- CreateIndex
CREATE INDEX "calendar_event_series_splitFromSeriesId_idx" ON "calendar_event_series"("splitFromSeriesId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_exceptions_seriesId_occurrenceDate_key" ON "calendar_event_exceptions"("seriesId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "calendar_entries_userId_idx" ON "calendar_entries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_entries_userId_localDate_key" ON "calendar_entries"("userId", "localDate");

-- CreateIndex
CREATE INDEX "calendar_transactions_userId_idx" ON "calendar_transactions"("userId");

-- CreateIndex
CREATE INDEX "calendar_transactions_localDate_idx" ON "calendar_transactions"("localDate");

-- CreateIndex
CREATE INDEX "calendar_transactions_bannerFamily_idx" ON "calendar_transactions"("bannerFamily");

-- CreateIndex
CREATE INDEX "calendar_transactions_createdAt_idx" ON "calendar_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "calendar_transactions_seriesId_idx" ON "calendar_transactions"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_transactions_seriesId_occurrenceDate_key" ON "calendar_transactions"("seriesId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "pull_events_userId_idx" ON "pull_events"("userId");

-- CreateIndex
CREATE INDEX "pull_events_bannerFamily_idx" ON "pull_events"("bannerFamily");

-- CreateIndex
CREATE INDEX "goals_userId_idx" ON "goals"("userId");

-- CreateIndex
CREATE INDEX "idempotency_records_userId_idx" ON "idempotency_records"("userId");

-- CreateIndex
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_userId_action_idempotencyKey_key" ON "idempotency_records"("userId", "action", "idempotencyKey");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_balances" ADD CONSTRAINT "resource_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner_states" ADD CONSTRAINT "banner_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_series" ADD CONSTRAINT "calendar_event_series_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_series" ADD CONSTRAINT "calendar_event_series_splitFromSeriesId_fkey" FOREIGN KEY ("splitFromSeriesId") REFERENCES "calendar_event_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_exceptions" ADD CONSTRAINT "calendar_event_exceptions_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "calendar_event_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_transactions" ADD CONSTRAINT "calendar_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_transactions" ADD CONSTRAINT "calendar_transactions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "calendar_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_transactions" ADD CONSTRAINT "calendar_transactions_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "calendar_event_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_events" ADD CONSTRAINT "pull_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
