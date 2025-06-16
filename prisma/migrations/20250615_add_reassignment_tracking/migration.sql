-- CreateTable
CREATE TABLE "ReassignmentNeeded" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "originalStaffId" INTEGER,
    "originalStaffName" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "plannedStaffId" INTEGER,
    "plannedDate" DATE,
    "dismissedAt" TIMESTAMP(3),
    "dismissedBy" TEXT,
    "dismissalReason" TEXT,

    CONSTRAINT "ReassignmentNeeded_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReassignmentNeeded_status_location_idx" ON "ReassignmentNeeded"("status", "location");

-- CreateIndex
CREATE INDEX "ReassignmentNeeded_status_day_block_idx" ON "ReassignmentNeeded"("status", "day", "block");

-- CreateIndex
CREATE INDEX "ReassignmentNeeded_clientId_idx" ON "ReassignmentNeeded"("clientId");

-- CreateIndex
CREATE INDEX "ReassignmentNeeded_deletedAt_idx" ON "ReassignmentNeeded"("deletedAt");

-- AddForeignKey
ALTER TABLE "ReassignmentNeeded" ADD CONSTRAINT "ReassignmentNeeded_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentNeeded" ADD CONSTRAINT "ReassignmentNeeded_originalStaffId_fkey" FOREIGN KEY ("originalStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReassignmentNeeded" ADD CONSTRAINT "ReassignmentNeeded_plannedStaffId_fkey" FOREIGN KEY ("plannedStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;