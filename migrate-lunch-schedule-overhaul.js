const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateLunchSchedule() {
  console.log('🚀 Starting lunch schedule database overhaul...');

  try {
    // Check if new tables exist
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('LunchTimeBlock', 'LunchGroupClient')
    `;

    if (tableCheck.length === 0) {
      console.log('📊 Creating new lunch schedule schema...');
      
      // Create the new schema using raw SQL
      await prisma.$executeRaw`
        -- Drop existing tables if they exist
        DROP TABLE IF EXISTS "LunchGroup" CASCADE;
        DROP TABLE IF EXISTS "LunchSchedule" CASCADE;

        -- Create new LunchSchedule table
        CREATE TABLE "LunchSchedule" (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          location VARCHAR(100) NOT NULL,
          
          -- Finalization tracking
          "isFinalized" BOOLEAN NOT NULL DEFAULT false,
          "finalizedBy" VARCHAR(100),
          "finalizedAt" TIMESTAMP,
          
          -- Post-finalization modification tracking
          "modifiedAfterFinalization" BOOLEAN NOT NULL DEFAULT false,
          "lastModifiedBy" VARCHAR(100),
          "lastModifiedAt" TIMESTAMP,
          
          -- Metadata
          "createdBy" VARCHAR(100) NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          
          UNIQUE(date, location)
        );

        -- Create LunchTimeBlock table
        CREATE TABLE "LunchTimeBlock" (
          id SERIAL PRIMARY KEY,
          "lunchScheduleId" INTEGER NOT NULL REFERENCES "LunchSchedule"(id) ON DELETE CASCADE,
          "startTime" VARCHAR(10) NOT NULL,
          "endTime" VARCHAR(10) NOT NULL,
          label VARCHAR(50),
          
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );

        -- Create new LunchGroup table
        CREATE TABLE "LunchGroup" (
          id SERIAL PRIMARY KEY,
          "timeBlockId" INTEGER NOT NULL REFERENCES "LunchTimeBlock"(id) ON DELETE CASCADE,
          
          -- Staff assignments
          "primaryStaff" VARCHAR(100) NOT NULL,
          helpers TEXT[] DEFAULT '{}',
          
          -- Location and identification
          "roomLocation" VARCHAR(100),
          "groupName" VARCHAR(50),
          color VARCHAR(20) DEFAULT '#3B82F6',
          
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );

        -- Create LunchGroupClient table
        CREATE TABLE "LunchGroupClient" (
          id SERIAL PRIMARY KEY,
          "lunchGroupId" INTEGER NOT NULL REFERENCES "LunchGroup"(id) ON DELETE CASCADE,
          "clientId" INTEGER NOT NULL REFERENCES "Client"(id) ON DELETE CASCADE,
          
          -- Afternoon session status
          "hasAfternoonSession" BOOLEAN NOT NULL DEFAULT false,
          "afternoonSessionNote" VARCHAR(200),
          
          -- Order in group for display
          "displayOrder" INTEGER DEFAULT 0,
          
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          
          UNIQUE("lunchGroupId", "clientId")
        );

        -- Create indexes
        CREATE INDEX "idx_lunch_schedule_date" ON "LunchSchedule"(date);
        CREATE INDEX "idx_lunch_schedule_location" ON "LunchSchedule"(location);
        CREATE INDEX "idx_lunch_schedule_finalized" ON "LunchSchedule"("isFinalized");
        CREATE INDEX "idx_lunch_time_block_schedule" ON "LunchTimeBlock"("lunchScheduleId");
        CREATE INDEX "idx_lunch_group_time_block" ON "LunchGroup"("timeBlockId");
        CREATE INDEX "idx_lunch_group_client_group" ON "LunchGroupClient"("lunchGroupId");
        CREATE INDEX "idx_lunch_group_client_client" ON "LunchGroupClient"("clientId");
      `;

      console.log('✅ New lunch schedule schema created successfully');
    } else {
      console.log('ℹ️ New lunch schedule schema already exists');
    }

    // Generate Prisma client to recognize new schema
    console.log('🔄 Generating Prisma client...');
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec('npx prisma generate', (error, stdout, stderr) => {
        if (error) {
          console.error('Error generating Prisma client:', error);
          reject(error);
        } else {
          console.log('✅ Prisma client generated');
          resolve(stdout);
        }
      });
    });

    console.log('🎉 Lunch schedule overhaul completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Restart your development server');
    console.log('2. Test the new enhanced lunch schedule interface');
    console.log('3. The old lunch schedule data has been cleared (fresh start)');

  } catch (error) {
    console.error('❌ Error during lunch schedule migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateLunchSchedule()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });