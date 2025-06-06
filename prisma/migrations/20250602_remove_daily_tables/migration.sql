-- DropForeignKey
ALTER TABLE "DailyOverride" DROP CONSTRAINT "DailyOverride_newClientId_fkey";

-- DropForeignKey
ALTER TABLE "DailyOverride" DROP CONSTRAINT "DailyOverride_newStaffId_fkey";

-- DropTable
DROP TABLE "DailyOverride";

-- DropTable
DROP TABLE "ChangeLog";