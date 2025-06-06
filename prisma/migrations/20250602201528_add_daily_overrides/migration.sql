-- AlterTable
ALTER TABLE "Assignment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GroupSession" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScheduleVersion" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "DailyOverride" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "originalStaffId" INTEGER,
    "originalClientId" INTEGER,
    "newStaffId" INTEGER,
    "newClientId" INTEGER,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyOverride_date_status_idx" ON "DailyOverride"("date", "status");

-- CreateIndex
CREATE INDEX "DailyOverride_createdAt_idx" ON "DailyOverride"("createdAt");

-- AddForeignKey
ALTER TABLE "DailyOverride" ADD CONSTRAINT "DailyOverride_originalStaffId_fkey" FOREIGN KEY ("originalStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyOverride" ADD CONSTRAINT "DailyOverride_originalClientId_fkey" FOREIGN KEY ("originalClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyOverride" ADD CONSTRAINT "DailyOverride_newStaffId_fkey" FOREIGN KEY ("newStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyOverride" ADD CONSTRAINT "DailyOverride_newClientId_fkey" FOREIGN KEY ("newClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
