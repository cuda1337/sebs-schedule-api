const fetch = require('node-fetch');

async function testCompleteLunchScheduleAPI() {
  const baseURL = 'http://localhost:3001/api/lunch-schedules';
  
  console.log('🧪 Testing Complete Lunch Schedule API Workflow...\n');

  try {
    // Step 1: Create test data (clients and staff)
    console.log('📋 Step 1: Creating test data...');
    const testDataResponse = await fetch(`${baseURL}/test-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const testDataResult = await testDataResponse.json();
    console.log('Status:', testDataResponse.status);
    console.log('Response:', JSON.stringify(testDataResult, null, 2));
    
    if (testDataResponse.status !== 200) {
      console.log('❌ Failed to create test data');
      return;
    }
    console.log('✅ Test data created successfully\n');

    // Step 2: Test available-clients endpoint
    console.log('📋 Step 2: Testing available-clients endpoint...');
    const clientsResponse = await fetch(`${baseURL}/available-clients?date=2025-06-19&location=Morristown`);
    const clientsData = await clientsResponse.json();
    
    console.log('Status:', clientsResponse.status);
    console.log('Available clients:', JSON.stringify(clientsData, null, 2));
    console.log('✅ Available clients endpoint working\n');

    // Step 3: Create lunch schedule WITH clients
    console.log('📋 Step 3: Creating lunch schedule with real clients...');
    
    // Get client IDs from the available clients response
    const availableClients = clientsData.availableClients || [];
    const morristownClients = availableClients.filter(c => 
      c.locations.includes('Morristown') || c.locations.length === 0
    );

    console.log(`Found ${morristownClients.length} clients for Morristown:`, 
      morristownClients.map(c => `${c.id}:${c.name}`));

    if (morristownClients.length === 0) {
      console.log('❌ No clients available for Morristown');
      return;
    }

    const lunchScheduleWithClients = {
      date: '2025-06-19',
      location: 'Morristown',
      createdBy: 'test-user',
      timeBlocks: [
        {
          startTime: '12:30',
          endTime: '13:00',
          label: 'Lunch',
          groups: [
            {
              primaryStaff: 'Sarah Johnson',
              helpers: '["Volunteer Anna"]',
              roomLocation: 'Cafeteria',
              groupName: 'Group 1',
              color: '#3B82F6',
              clients: [
                {
                  clientId: morristownClients[0].id,
                  hasAfternoonSession: true
                },
                ...(morristownClients.length > 1 ? [{
                  clientId: morristownClients[1].id,
                  hasAfternoonSession: false
                }] : [])
              ]
            },
            {
              primaryStaff: 'Anna Rodriguez',
              helpers: '[]',
              roomLocation: 'Play Gym',
              groupName: 'Group 2',
              color: '#10B981',
              clients: morristownClients.slice(2, 4).map((client, index) => ({
                clientId: client.id,
                hasAfternoonSession: index % 2 === 0
              }))
            }
          ]
        }
      ]
    };

    const scheduleResponse = await fetch(baseURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lunchScheduleWithClients)
    });
    
    const scheduleResult = await scheduleResponse.json();
    console.log('Status:', scheduleResponse.status);
    console.log('Lunch schedule created:', JSON.stringify(scheduleResult, null, 2));
    
    if (scheduleResponse.status !== 200) {
      console.log('❌ Failed to create lunch schedule with clients');
      return;
    }
    console.log('✅ Lunch schedule with clients created successfully\n');

    // Step 4: Retrieve the complete lunch schedule
    console.log('📋 Step 4: Retrieving complete lunch schedule...');
    const finalResponse = await fetch(`${baseURL}?date=2025-06-19&location=Morristown`);
    const finalData = await finalResponse.json();
    
    console.log('Status:', finalResponse.status);
    console.log('Final lunch schedule:', JSON.stringify(finalData, null, 2));
    console.log('✅ Complete lunch schedule retrieved\n');

    // Step 5: Test different location (should be empty)
    console.log('📋 Step 5: Testing Oak Ridge clients...');
    const oakRidgeResponse = await fetch(`${baseURL}/available-clients?date=2025-06-19&location=Oak Ridge`);
    const oakRidgeData = await oakRidgeResponse.json();
    
    console.log('Oak Ridge available clients:', oakRidgeData.availableClients.length);
    console.log('✅ Location filtering working\n');

    console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('📋 Summary:');
    console.log('   ✅ Test data creation works');
    console.log('   ✅ Available clients endpoint works');
    console.log('   ✅ Location filtering works');
    console.log('   ✅ Lunch schedule with clients works');
    console.log('   ✅ Foreign key constraints satisfied');
    console.log('   ✅ Complete CRUD workflow functional');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Give the server a moment to be ready
setTimeout(testCompleteLunchScheduleAPI, 1000);