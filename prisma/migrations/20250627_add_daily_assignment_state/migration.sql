-- CreateTable
CREATE TABLE "DailyAssignmentState" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "currentStaffId" INTEGER,

    CONSTRAINT "DailyAssignmentState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyAssignmentState_date_idx" ON "DailyAssignmentState"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAssignmentState_date_assignmentId_key" ON "DailyAssignmentState"("date", "assignmentId");

-- AddForeignKey
ALTER TABLE "DailyAssignmentState" ADD CONSTRAINT "DailyAssignmentState_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAssignmentState" ADD CONSTRAINT "DailyAssignmentState_currentStaffId_fkey" FOREIGN KEY ("currentStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;