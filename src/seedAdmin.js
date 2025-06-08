const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@sebs.com' }
    });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@sebs.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'admin',
        isActive: true
      }
    });
    
    console.log('Admin user created successfully:');
    console.log('Email: admin@sebs.com');
    console.log('Password: admin123');
    console.log('⚠️  IMPORTANT: Change this password after first login!');
    
  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();