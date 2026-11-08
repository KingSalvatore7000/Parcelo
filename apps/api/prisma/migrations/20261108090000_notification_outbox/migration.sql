-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('NEW_PARCEL', 'REMINDER');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "NotificationKind" NOT NULL DEFAULT 'NEW_PARCEL',
ADD COLUMN     "lastError" TEXT;

-- CreateIndex
CREATE INDEX "notifications_status_createdAt_idx" ON "notifications"("status", "createdAt");

