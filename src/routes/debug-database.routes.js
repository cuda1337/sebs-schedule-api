const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Debug endpoint to check database schema
router.get('/lunch-schedule-schema', async (req, res) => {
  try {
    console.log('Checking LunchSchedule table schema...');
    
    // Query to get column information
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'LunchSchedule'
      ORDER BY ordinal_position;
    `;

    console.log('LunchSchedule columns:', columns);

    // Also check related tables
    const timeBlockColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'LunchTimeBlock'
      ORDER BY ordinal_position;
    `;

    const groupColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'LunchGroup'
      ORDER BY ordinal_position;
    `;

    // Check what migrations have been applied
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at
      FROM _prisma_migrations 
      ORDER BY finished_at;
    `;

    res.json({
      lunchScheduleColumns: columns,
      lunchTimeBlockColumns: timeBlockColumns,
      lunchGroupColumns: groupColumns,
      appliedMigrations: migrations
    });

  } catch (error) {
    console.error('Error checking database schema:', error);
    res.status(500).json({ 
      error: 'Failed to check database schema',
      details: error.message 
    });
  }
});

module.exports = router;