-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "plannedDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ClientSupervisor" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "supervisorName" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "endDate" DATE,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientSupervisor_clientId_effectiveDate_idx" ON "ClientSupervisor"("clientId", "effectiveDate");

-- CreateIndex
CREATE INDEX "ClientSupervisor_supervisorName_idx" ON "ClientSupervisor"("supervisorName");

-- CreateIndex
CREATE INDEX "ClientSupervisor_effectiveDate_idx" ON "ClientSupervisor"("effectiveDate");

-- AddForeignKey
ALTER TABLE "ClientSupervisor" ADD CONSTRAINT "ClientSupervisor_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
