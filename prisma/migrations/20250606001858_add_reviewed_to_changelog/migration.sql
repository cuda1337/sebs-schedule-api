-- AlterTable
ALTER TABLE "ChangeLog" ADD COLUMN     "reviewed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;
