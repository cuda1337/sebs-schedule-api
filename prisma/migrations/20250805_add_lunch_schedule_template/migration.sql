-- CreateTable
CREATE TABLE "LunchScheduleTemplate" (
    "id" SERIAL NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "dayOfWeek" VARCHAR(20) NOT NULL,
    "groups" JSONB NOT NULL DEFAULT '[]',
    "unassignedClientIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "timeStart" VARCHAR(10) NOT NULL DEFAULT '12:30',
    "timeEnd" VARCHAR(10) NOT NULL DEFAULT '1:00',
    "createdBy" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LunchScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "LunchSchedule" ADD COLUMN "fromTemplateId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "LunchScheduleTemplate_location_dayOfWeek_key" ON "LunchScheduleTemplate"("location", "dayOfWeek");

-- CreateIndex
CREATE INDEX "LunchScheduleTemplate_location_idx" ON "LunchScheduleTemplate"("location");

-- CreateIndex
CREATE INDEX "LunchScheduleTemplate_dayOfWeek_idx" ON "LunchScheduleTemplate"("dayOfWeek");