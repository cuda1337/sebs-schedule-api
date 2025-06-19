const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Add time fields to LunchGroup table
router.post('/add-lunch-group-time-fields', async (req, res) => {
  console.log('🔄 Running migration: Add time fields to LunchGroup table');
  
  try {
    // Check if fields already exist by trying to query them
    let fieldsExist = false;
    try {
      await prisma.$queryRaw`SELECT "startTime", "endTime" FROM "LunchGroup" LIMIT 1`;
      fieldsExist = true;
      console.log('✅ Time fields already exist in LunchGroup table');
    } catch (error) {
      console.log('ℹ️  Time fields do not exist yet, adding them...');
    }

    if (!fieldsExist) {
      // Add the new columns
      await prisma.$executeRaw`ALTER TABLE "LunchGroup" ADD COLUMN "startTime" TEXT`;
      await prisma.$executeRaw`ALTER TABLE "LunchGroup" ADD COLUMN "endTime" TEXT`;
      console.log('✅ Added startTime and endTime columns to LunchGroup table');

      // Update existing groups with default times
      const updateResult = await prisma.$executeRaw`
        UPDATE "LunchGroup" SET "startTime" = '12:30', "endTime" = '13:00' 
        WHERE "startTime" IS NULL OR "endTime" IS NULL
      `;
      console.log(`✅ Updated ${updateResult} existing groups with default times`);
    }

    // Regenerate Prisma client to include new fields
    console.log('🔄 Regenerating Prisma client...');
    const { spawn } = require('child_process');
    const generateProcess = spawn('npx', ['prisma', 'generate'], { 
      cwd: process.cwd(),
      stdio: 'inherit' 
    });

    generateProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Prisma client regenerated successfully');
      } else {
        console.log('⚠️ Prisma generate had exit code:', code);
      }
    });

    res.json({
      success: true,
      message: 'Time fields migration completed successfully',
      fieldsExisted: fieldsExist
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  }
});

module.exports = router;