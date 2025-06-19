const fetch = require('node-fetch');

async function testMigration() {
  const baseUrl = 'https://sebs-schedule-api.onrender.com';
  // const baseUrl = 'http://localhost:3001'; // For local testing

  console.log('🔍 Checking migration status...');
  
  try {
    // First check the current status
    const statusResponse = await fetch(`${baseUrl}/api/migrate/status`);
    const status = await statusResponse.json();
    console.log('Current status:', JSON.stringify(status, null, 2));

    // Check current schema
    const schemaResponse = await fetch(`${baseUrl}/api/debug-schema`);
    const schema = await schemaResponse.json();
    console.log('\nCurrent LunchSchedule columns:', JSON.stringify(schema, null, 2));

    // Run the test migration (no production check)
    console.log('\n🚀 Running migration to add override columns...');
    const migrationResponse = await fetch(`${baseUrl}/api/migrate/test-add-lunch-columns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await migrationResponse.json();
    console.log('\nMigration result:', JSON.stringify(result, null, 2));

    // Check schema again after migration
    console.log('\n🔍 Checking schema after migration...');
    const schemaAfterResponse = await fetch(`${baseUrl}/api/debug-schema`);
    const schemaAfter = await schemaAfterResponse.json();
    console.log('Updated LunchSchedule columns:', JSON.stringify(schemaAfter, null, 2));

  } catch (error) {
    console.error('❌ Error during migration test:', error);
  }
}

// Run the test
testMigration();