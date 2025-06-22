-- CreateTable
CREATE TABLE "ScheduleGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "timeBlock" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "staffId" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "maxClients" INTEGER NOT NULL DEFAULT 6,
    "createdBy" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleGroupMember" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "originalStaffId" INTEGER,
    "originalSessionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleGroup_date_timeBlock_idx" ON "ScheduleGroup"("date", "timeBlock");

-- CreateIndex
CREATE INDEX "ScheduleGroup_staffId_idx" ON "ScheduleGroup"("staffId");

-- CreateIndex
CREATE INDEX "ScheduleGroup_date_location_idx" ON "ScheduleGroup"("date", "location");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleGroupMember_groupId_clientId_key" ON "ScheduleGroupMember"("groupId", "clientId");

-- CreateIndex
CREATE INDEX "ScheduleGroupMember_groupId_idx" ON "ScheduleGroupMember"("groupId");

-- CreateIndex
CREATE INDEX "ScheduleGroupMember_clientId_idx" ON "ScheduleGroupMember"("clientId");

-- AddForeignKey
ALTER TABLE "ScheduleGroupMember" ADD CONSTRAINT "ScheduleGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ScheduleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;