const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function initDatabase() {
  try {
    console.log('🔧 Checking database schema...');
    
    // Try to create the User table if it doesn't exist
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" SERIAL NOT NULL,
        "email" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'staff',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "lastLogin" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id")
      )
    `;
    
    // Create unique index on email
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")
    `;
    
    // Add optional user tracking columns to ChangeLog if they don't exist
    try {
      await prisma.$executeRaw`
        ALTER TABLE "ChangeLog" 
        ADD COLUMN IF NOT EXISTS "reviewedByUserId" INTEGER,
        ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER
      `;
    } catch (e) {
      // Ignore if columns already exist
    }
    
    console.log('✅ Database schema updated');
    
    // Check if admin user exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@sebs.com' }
    });
    
    if (!existingAdmin) {
      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await prisma.user.create({
        data: {
          email: 'admin@sebs.com',
          password: hashedPassword,
          name: 'Admin User',
          role: 'admin',
          isActive: true
        }
      });
      
      console.log('👤 Created admin user: admin@sebs.com / admin123');
    } else {
      console.log('👤 Admin user already exists');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
}

module.exports = { initDatabase };