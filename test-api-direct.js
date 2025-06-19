const axios = require('axios');

const API_URL = 'https://sebs-schedule-api.onrender.com';

async function testDifferentDatesAndLocations() {
  console.log('=== TESTING DIFFERENT DATES AND LOCATIONS ===\n');
  
  const testCases = [
    // Different dates
    { date: '2025-06-17', location: 'Navarre' },
    { date: '2025-06-16', location: 'Navarre' },
    { date: '2025-06-15', location: 'Navarre' },
    { date: '2025-06-14', location: 'Navarre' },
    { date: '2025-06-13', location: 'Navarre' },
    
    // Different locations
    { date: '2025-06-18', location: 'Pensacola' },
    { date: '2025-06-18', location: 'Gulf Breeze' },
    { date: '2025-06-18', location: 'Pace' },
    
    // Recent dates with different locations
    { date: '2025-06-17', location: 'Pensacola' },
    { date: '2025-06-16', location: 'Gulf Breeze' },
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.date} - ${testCase.location}`);
      
      const response = await axios.get(
        `${API_URL}/api/enhanced-lunch-schedule?date=${testCase.date}&location=${testCase.location}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000
        }
      );
      
      const data = response.data;
      const hasData = data.id !== null || 
                     (data.timeBlocks && data.timeBlocks.length > 1) ||
                     (data.timeBlocks && data.timeBlocks[0] && data.timeBlocks[0].groups && data.timeBlocks[0].groups.length > 0);
      
      if (hasData) {
        console.log(`  ✅ FOUND DATA! Response size: ${JSON.stringify(data).length} bytes`);
        console.log(`  Schedule ID: ${data.id}`);
        console.log(`  Time blocks: ${data.timeBlocks.length}`);
        if (data.timeBlocks.length > 0) {
          data.timeBlocks.forEach((tb, i) => {
            console.log(`    Block ${i}: ${tb.startTime}-${tb.endTime}, ${tb.groups?.length || 0} groups`);
            if (tb.groups && tb.groups.length > 0) {
              tb.groups.forEach((group, j) => {
                console.log(`      Group ${j}: ${group.primaryStaff}, ${group.clients?.length || 0} clients`);
              });
            }
          });
        }
        console.log('');
        
        // Full response for this successful case
        console.log('Full response:');
        console.log(JSON.stringify(data, null, 2));
        console.log('\n' + '='.repeat(50) + '\n');
        
      } else {
        console.log(`  ❌ No data (default empty response)`);
      }
      
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      if (error.response) {
        console.log(`    Status: ${error.response.status}`);
        console.log(`    Data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
}

async function testAvailableClientsEndpoint() {
  console.log('\n=== TESTING AVAILABLE CLIENTS ENDPOINT ===\n');
  
  const testCases = [
    { date: '2025-06-18', location: 'Navarre' },
    { date: '2025-06-17', location: 'Navarre' },
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`Testing available clients: ${testCase.date} - ${testCase.location}`);
      
      const response = await axios.get(
        `${API_URL}/api/enhanced-lunch-schedule/available-clients?date=${testCase.date}&location=${testCase.location}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000
        }
      );
      
      const data = response.data;
      console.log(`  Response size: ${JSON.stringify(data).length} bytes`);
      console.log(`  Available clients: ${data.availableClients?.length || 'N/A'}`);
      console.log(`  Stay with staff: ${data.shouldStayWithStaff?.length || 'N/A'}`);
      
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      if (error.response) {
        console.log(`    Status: ${error.response.status}`);
        console.log(`    Data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
}

async function runTests() {
  await testDifferentDatesAndLocations();
  await testAvailableClientsEndpoint();
}

runTests().catch(console.error);