-- CreateTable
CREATE TABLE "LunchSchedule" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "location" TEXT NOT NULL,
    "timePeriod" TEXT NOT NULL DEFAULT '12:30-1:00',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedBy" TEXT,
    "modifiedAt" TIMESTAMP(3),

    CONSTRAINT "LunchSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LunchGroup" (
    "id" SERIAL NOT NULL,
    "lunchScheduleId" INTEGER NOT NULL,
    "primaryStaff" TEXT NOT NULL,
    "helpers" JSONB NOT NULL DEFAULT '[]',
    "clientIds" JSONB NOT NULL DEFAULT '[]',
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LunchGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LunchSchedule_date_location_key" ON "LunchSchedule"("date", "location");

-- CreateIndex
CREATE INDEX "LunchSchedule_date_idx" ON "LunchSchedule"("date");

-- CreateIndex
CREATE INDEX "LunchSchedule_location_idx" ON "LunchSchedule"("location");

-- CreateIndex
CREATE INDEX "LunchGroup_lunchScheduleId_idx" ON "LunchGroup"("lunchScheduleId");

-- AddForeignKey
ALTER TABLE "LunchGroup" ADD CONSTRAINT "LunchGroup_lunchScheduleId_fkey" FOREIGN KEY ("lunchScheduleId") REFERENCES "LunchSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;