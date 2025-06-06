/*
  Warnings:

  - Added the required column `updatedAt` to the `Assignment` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Assignment_day_block_clientId_key";

-- DropIndex
DROP INDEX "Assignment_day_block_staffId_key";

-- CreateTable
CREATE TABLE "ScheduleVersion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3),
    "description" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- Insert initial main schedule version
INSERT INTO "ScheduleVersion" ("name", "type", "status", "createdBy", "updatedAt") VALUES ('Main Schedule', 'main', 'active', 'system', CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "groupSessionId" INTEGER,
ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "versionId" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "GroupSession" (
    "id" SERIAL NOT NULL,
    "day" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "staffId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT NOT NULL,
    "maxSize" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSessionClient" (
    "id" SERIAL NOT NULL,
    "groupSessionId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,

    CONSTRAINT "GroupSessionClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" SERIAL NOT NULL,
    "versionId" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "day" TEXT,
    "block" TEXT,
    "staffId" INTEGER,
    "clientId" INTEGER,
    "previousValue" JSONB,
    "newValue" JSONB,
    "committedToMain" BOOLEAN NOT NULL DEFAULT false,
    "committedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleVersion_type_status_idx" ON "ScheduleVersion"("type", "status");

-- CreateIndex
CREATE INDEX "GroupSession_versionId_day_block_idx" ON "GroupSession"("versionId", "day", "block");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSession_versionId_day_block_staffId_key" ON "GroupSession"("versionId", "day", "block", "staffId");

-- CreateIndex
CREATE INDEX "GroupSessionClient_clientId_idx" ON "GroupSessionClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSessionClient_groupSessionId_clientId_key" ON "GroupSessionClient"("groupSessionId", "clientId");

-- CreateIndex
CREATE INDEX "ChangeLog_versionId_committedToMain_idx" ON "ChangeLog"("versionId", "committedToMain");

-- CreateIndex
CREATE INDEX "ChangeLog_createdAt_idx" ON "ChangeLog"("createdAt");

-- CreateIndex
CREATE INDEX "ChangeLog_staffId_idx" ON "ChangeLog"("staffId");

-- CreateIndex
CREATE INDEX "ChangeLog_clientId_idx" ON "ChangeLog"("clientId");

-- CreateIndex
CREATE INDEX "Assignment_versionId_day_block_staffId_idx" ON "Assignment"("versionId", "day", "block", "staffId");

-- CreateIndex
CREATE INDEX "Assignment_versionId_day_block_clientId_idx" ON "Assignment"("versionId", "day", "block", "clientId");

-- CreateIndex
CREATE INDEX "Assignment_staffId_idx" ON "Assignment"("staffId");

-- CreateIndex
CREATE INDEX "Assignment_clientId_idx" ON "Assignment"("clientId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_groupSessionId_fkey" FOREIGN KEY ("groupSessionId") REFERENCES "GroupSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSessionClient" ADD CONSTRAINT "GroupSessionClient_groupSessionId_fkey" FOREIGN KEY ("groupSessionId") REFERENCES "GroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSessionClient" ADD CONSTRAINT "GroupSessionClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeLog" ADD CONSTRAINT "ChangeLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;