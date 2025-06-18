const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Production-only migration endpoint
router.post('/lunch-schedule-overhaul', async (req, res) => {
  try {
    console.log('🚀 Starting lunch schedule database overhaul...');

    // Check if we're in production environment
    const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com');
    
    if (!isProduction) {
      return res.status(403).json({ 
        error: 'Migration can only be run in production environment',
        environment: process.env.NODE_ENV || 'development'
      });
    }

    // Check if new tables already exist
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('LunchTimeBlock', 'LunchGroupClient')
    `;

    if (tableCheck.length > 0) {
      return res.json({
        success: true,
        message: 'Enhanced lunch schedule schema already exists',
        tablesFound: tableCheck.map(t => t.table_name)
      });
    }

    console.log('📊 Creating new lunch schedule schema...');
    
    // Drop existing lunch schedule tables
    await prisma.$executeRaw`DROP TABLE IF EXISTS "LunchGroup" CASCADE`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS "LunchSchedule" CASCADE`;

    // Create new LunchSchedule table
    await prisma.$executeRaw`
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
      )
    `;

    // Create LunchTimeBlock table
    await prisma.$executeRaw`
      CREATE TABLE "LunchTimeBlock" (
        id SERIAL PRIMARY KEY,
        "lunchScheduleId" INTEGER NOT NULL REFERENCES "LunchSchedule"(id) ON DELETE CASCADE,
        "startTime" VARCHAR(10) NOT NULL,
        "endTime" VARCHAR(10) NOT NULL,
        label VARCHAR(50),
        
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create new LunchGroup table
    await prisma.$executeRaw`
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
      )
    `;

    // Create LunchGroupClient table
    await prisma.$executeRaw`
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
      )
    `;

    // Create indexes
    await prisma.$executeRaw`CREATE INDEX "idx_lunch_schedule_date" ON "LunchSchedule"(date)`;
    await prisma.$executeRaw`CREATE INDEX "idx_lunch_schedule_location" ON "LunchSchedule"(location)`;
    await prisma.$executeRaw`CREATE INDEX "idx_lunch_schedule_finalized" ON "LunchSchedule"("isFinalized")`;
    await prisma.$executeRaw`CREATE INDEX "idx_lunch_time_block_schedule" ON "LunchTimeBlock"("lunchScheduleId")`;
    await prisma.$executeRaw`CREATE INDEX "idx_lunch_group_time_block" ON "LunchGroup"("timeBlockId")`;
    await prisma.$executeRaw`CREATE INDEX "idx_lunch_group_client_group" ON "LunchGroupClient"("lunchGroupId")`;
    await prisma.$executeRaw`CREATE INDEX "idx_lunch_group_client_client" ON "LunchGroupClient"("clientId")`;

    console.log('✅ New lunch schedule schema created successfully');

    // Generate Prisma client to recognize new schema
    console.log('🔄 Regenerating Prisma client...');
    const { exec } = require('child_process');
    try {
      await new Promise((resolve, reject) => {
        exec('npx prisma generate', (error, stdout, stderr) => {
          if (error) {
            console.error('Warning: Could not regenerate Prisma client:', error.message);
            resolve(); // Don't fail the migration for this
          } else {
            console.log('✅ Prisma client regenerated');
            resolve();
          }
        });
      });
    } catch (error) {
      console.warn('Prisma client regeneration failed, but continuing...', error.message);
    }

    // Verify tables were created
    const verifyTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('LunchSchedule', 'LunchTimeBlock', 'LunchGroup', 'LunchGroupClient')
      ORDER BY table_name
    `;

    res.json({
      success: true,
      message: 'Lunch schedule overhaul completed successfully!',
      tablesCreated: verifyTables.map(t => t.table_name),
      nextSteps: [
        'Enhanced lunch schedule is now available in the daily schedule page',
        'Old lunch schedule data has been cleared (fresh start)',
        'BCBAs can now use the finalization features',
        'Configurable time blocks and room locations are ready'
      ]
    });

  } catch (error) {
    console.error('❌ Error during lunch schedule migration:', error);
    res.status(500).json({ 
      success: false,
      error: 'Migration failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get migration status
router.get('/status', async (req, res) => {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%Lunch%'
      ORDER BY table_name
    `;

    const hasEnhancedTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('LunchTimeBlock', 'LunchGroupClient')
    `;

    res.json({
      currentTables: tables.map(t => t.table_name),
      hasEnhancedSchema: hasEnhancedTables.length === 2,
      environment: process.env.NODE_ENV || 'development',
      databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured'
    });

  } catch (error) {
    console.error('Error checking migration status:', error);
    res.status(500).json({ error: 'Failed to check migration status' });
  }
});

// Regenerate Prisma client
router.post('/regenerate-prisma', async (req, res) => {
  try {
    console.log('🔄 Regenerating Prisma client...');
    const { exec } = require('child_process');
    
    await new Promise((resolve, reject) => {
      exec('npx prisma generate', (error, stdout, stderr) => {
        if (error) {
          console.error('Error regenerating Prisma client:', error);
          reject(error);
        } else {
          console.log('✅ Prisma client regenerated successfully');
          console.log(stdout);
          resolve(stdout);
        }
      });
    });

    res.json({
      success: true,
      message: 'Prisma client regenerated successfully. Server restart recommended.',
      recommendation: 'POST /api/admin/restart-server to apply changes'
    });

  } catch (error) {
    console.error('❌ Error regenerating Prisma client:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to regenerate Prisma client',
      details: error.message
    });
  }
});

module.exports = router;