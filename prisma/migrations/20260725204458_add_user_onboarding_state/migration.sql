-- CreateEnum
CREATE TYPE "OnboardingOutcome" AS ENUM ('COMPLETED', 'SKIPPED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboardingOutcome" "OnboardingOutcome",
ADD COLUMN     "onboardingUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingVersion" INTEGER;
