-- Migration: Add User table for authentication
-- Run this manually on Render database

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
);

-- Create unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Create index on email for performance
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- Add User relation columns to ChangeLog table (optional fields)
ALTER TABLE "ChangeLog" 
ADD COLUMN IF NOT EXISTS "reviewedByUserId" INTEGER,
ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER;

-- Insert default admin user
INSERT INTO "User" ("email", "password", "name", "role", "isActive") 
VALUES (
    'admin@sebs.com', 
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: admin123
    'Admin User', 
    'admin', 
    true
) ON CONFLICT ("email") DO NOTHING;

-- Verify the user was created
SELECT id, email, name, role, "isActive", "createdAt" FROM "User" WHERE email = 'admin@sebs.com';