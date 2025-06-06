-- CreateTable
CREATE TABLE "Staff" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "locations" TEXT[],
    "availability" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "locations" TEXT[],
    "authorizedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availability" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" SERIAL NOT NULL,
    "day" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "staffId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyOverride" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "originalAssignmentId" INTEGER,
    "type" TEXT NOT NULL,
    "newStaffId" INTEGER,
    "newClientId" INTEGER,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "notes" TEXT,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_day_block_staffId_key" ON "Assignment"("day", "block", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_day_block_clientId_key" ON "Assignment"("day", "block", "clientId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyOverride" ADD CONSTRAINT "DailyOverride_newStaffId_fkey" FOREIGN KEY ("newStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyOverride" ADD CONSTRAINT "DailyOverride_newClientId_fkey" FOREIGN KEY ("newClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
