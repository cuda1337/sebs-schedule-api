-- Lunch Schedule Overhaul Schema Update
-- This will replace the existing LunchSchedule and LunchGroup tables

-- Drop existing lunch schedule tables
DROP TABLE IF EXISTS "LunchGroup";
DROP TABLE IF EXISTS "LunchSchedule";

-- New enhanced lunch schedule system
CREATE TABLE "LunchSchedule" (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  location VARCHAR(100) NOT NULL,
  
  -- Finalization tracking
  isFinalized BOOLEAN NOT NULL DEFAULT false,
  finalizedBy VARCHAR(100),
  finalizedAt TIMESTAMP,
  
  -- Post-finalization modification tracking
  modifiedAfterFinalization BOOLEAN NOT NULL DEFAULT false,
  lastModifiedBy VARCHAR(100),
  lastModifiedAt TIMESTAMP,
  
  -- Metadata
  createdBy VARCHAR(100) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(date, location)
);

-- Time blocks for flexible lunch periods
CREATE TABLE "LunchTimeBlock" (
  id SERIAL PRIMARY KEY,
  lunchScheduleId INTEGER NOT NULL REFERENCES "LunchSchedule"(id) ON DELETE CASCADE,
  startTime VARCHAR(10) NOT NULL, -- "12:30"
  endTime VARCHAR(10) NOT NULL,   -- "13:00"
  label VARCHAR(50),              -- "Early Lunch", "Late Lunch"
  
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Enhanced lunch groups
CREATE TABLE "LunchGroup" (
  id SERIAL PRIMARY KEY,
  timeBlockId INTEGER NOT NULL REFERENCES "LunchTimeBlock"(id) ON DELETE CASCADE,
  
  -- Staff assignments
  primaryStaff VARCHAR(100) NOT NULL,
  helpers TEXT[], -- Array of helper names/IDs
  
  -- Location and identification
  roomLocation VARCHAR(100), -- "Play Gym", "Cafeteria"
  groupName VARCHAR(50),     -- "Group 1", "Blue Group"
  color VARCHAR(20) DEFAULT '#3B82F6',
  
  -- Metadata
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Client assignments to lunch groups with afternoon session tracking
CREATE TABLE "LunchGroupClient" (
  id SERIAL PRIMARY KEY,
  lunchGroupId INTEGER NOT NULL REFERENCES "LunchGroup"(id) ON DELETE CASCADE,
  clientId INTEGER NOT NULL REFERENCES "Client"(id) ON DELETE CASCADE,
  
  -- Afternoon session status
  hasAfternoonSession BOOLEAN NOT NULL DEFAULT false,
  afternoonSessionNote VARCHAR(200), -- Optional note about PM session
  
  -- Order in group for display
  displayOrder INTEGER DEFAULT 0,
  
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(lunchGroupId, clientId) -- Prevent duplicate client assignments
);

-- Indexes for performance
CREATE INDEX idx_lunch_schedule_date ON "LunchSchedule"(date);
CREATE INDEX idx_lunch_schedule_location ON "LunchSchedule"(location);
CREATE INDEX idx_lunch_schedule_finalized ON "LunchSchedule"(isFinalized);
CREATE INDEX idx_lunch_time_block_schedule ON "LunchTimeBlock"(lunchScheduleId);
CREATE INDEX idx_lunch_group_time_block ON "LunchGroup"(timeBlockId);
CREATE INDEX idx_lunch_group_client_group ON "LunchGroupClient"(lunchGroupId);
CREATE INDEX idx_lunch_group_client_client ON "LunchGroupClient"(clientId);

-- Default time block for migration
-- This will be handled by the application logic to create default 12:30-1:00 block