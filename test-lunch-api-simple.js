const fetch = require('node-fetch');

async function testLunchScheduleAPI() {
  const baseURL = 'http://localhost:3001/api/lunch-schedules';
  
  console.log('🧪 Testing Lunch Schedule API...\n');

  try {
    // Test 1: GET empty lunch schedule
    console.log('📋 Test 1: GET lunch schedule (should return default empty structure)');
    const getResponse = await fetch(`${baseURL}?date=2025-06-18&location=Morristown`);
    const getData = await getResponse.json();
    
    console.log('Status:', getResponse.status);
    console.log('Response:', JSON.stringify(getData, null, 2));
    console.log('✅ GET test completed\n');

    // Test 2: POST simple lunch schedule
    console.log('📋 Test 2: POST simple lunch schedule');
    const postData = {
      date: '2025-06-18',
      location: 'Morristown',
      createdBy: 'test-user',
      timeBlocks: [
        {
          startTime: '12:30',
          endTime: '13:00',
          label: 'Lunch',
          groups: [
            {
              primaryStaff: 'Test Staff',
              helpers: '[]',
              roomLocation: 'Cafeteria',
              groupName: 'Group 1',
              color: '#3B82F6',
              clients: [
                {
                  clientId: 1,
                  hasAfternoonSession: true
                }
              ]
            }
          ]
        }
      ]
    };

    const postResponse = await fetch(baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });
    
    const postResult = await postResponse.json();
    console.log('Status:', postResponse.status);
    console.log('Response:', JSON.stringify(postResult, null, 2));
    console.log('✅ POST test completed\n');

    // Test 3: GET the created lunch schedule
    console.log('📋 Test 3: GET the created lunch schedule');
    const getResponse2 = await fetch(`${baseURL}?date=2025-06-18&location=Morristown`);
    const getData2 = await getResponse2.json();
    
    console.log('Status:', getResponse2.status);
    console.log('Response:', JSON.stringify(getData2, null, 2));
    console.log('✅ Second GET test completed\n');

    console.log('🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Give the server a moment to start
setTimeout(testLunchScheduleAPI, 2000);