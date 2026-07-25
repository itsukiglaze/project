-- CreateTable
CREATE TABLE "resource_snapshots" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT NOT NULL,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_snapshot_items" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "currencyType" "CurrencyType" NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "resource_snapshot_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_snapshots_userId_idx" ON "resource_snapshots"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "resource_snapshots_userId_localDate_key" ON "resource_snapshots"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "resource_snapshot_items_snapshotId_currencyType_key" ON "resource_snapshot_items"("snapshotId", "currencyType");

-- AddForeignKey
ALTER TABLE "resource_snapshots" ADD CONSTRAINT "resource_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_snapshot_items" ADD CONSTRAINT "resource_snapshot_items_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "resource_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
