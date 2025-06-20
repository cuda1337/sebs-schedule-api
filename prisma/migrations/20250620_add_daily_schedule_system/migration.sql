-- CreateTable
CREATE TABLE IF NOT EXISTS "DailyScheduleState" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "staffPositions" JSONB NOT NULL,
    "sessions" JSONB NOT NULL,
    "clientStates" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyScheduleState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SessionReview" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "sessionStateAtReview" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DailyScheduleState_date_key" ON "DailyScheduleState"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DailyScheduleState_date_idx" ON "DailyScheduleState"("date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SessionReview_date_sessionId_key" ON "SessionReview"("date", "sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SessionReview_date_idx" ON "SessionReview"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SessionReview_reviewedAt_idx" ON "SessionReview"("reviewedAt");