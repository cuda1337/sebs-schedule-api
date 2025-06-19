const axios = require('axios');

const API_URL = 'https://sebs-schedule-api.onrender.com';

async function testUpdatedAPI() {
  console.log('=== TESTING UPDATED API WITH AVAILABLE-CLIENTS ENDPOINT ===\n');
  
  const testCases = [
    { date: '2025-06-18', location: 'Navarre' },
    { date: '2025-06-17', location: 'Navarre' },
  ];
  
  for (const testCase of testCases) {
    console.log(`Testing enhanced lunch schedule: ${testCase.date} - ${testCase.location}`);
    
    try {
      // Test main endpoint
      const mainResponse = await axios.get(
        `${API_URL}/api/enhanced-lunch-schedule?date=${testCase.date}&location=${testCase.location}`,
        { timeout: 10000 }
      );
      
      console.log(`  ✅ Main endpoint: ${JSON.stringify(mainResponse.data).length} bytes`);
      
      // Test available clients endpoint
      const clientsResponse = await axios.get(
        `${API_URL}/api/enhanced-lunch-schedule/available-clients?date=${testCase.date}&location=${testCase.location}`,
        { timeout: 10000 }
      );
      
      console.log(`  ✅ Available clients endpoint: ${JSON.stringify(clientsResponse.data).length} bytes`);
      console.log(`  Available clients: ${clientsResponse.data.availableClients?.length || 0}`);
      console.log(`  Stay with staff: ${clientsResponse.data.shouldStayWithStaff?.length || 0}`);
      
      if (clientsResponse.data.availableClients?.length > 0) {
        console.log(`  Sample client: ${clientsResponse.data.availableClients[0].name}`);
      }
      
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      if (error.response) {
        console.log(`    Status: ${error.response.status}`);
        console.log(`    Data: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    console.log('');
  }
}

async function testBrowserSimulation() {
  console.log('=== TESTING BROWSER-LIKE REQUEST ===\n');
  
  try {
    // Simulate exactly what the browser would send
    const axiosClient = axios.create({
      baseURL: API_URL,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://sebs-schedule-app.vercel.app/',
        'Origin': 'https://sebs-schedule-app.vercel.app'
      },
    });

    // Add authorization header like the frontend does
    const token = 'fake-browser-token'; // This will be ignored since no auth is required
    axiosClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const response = await axiosClient.get('/api/enhanced-lunch-schedule/available-clients?date=2025-06-18&location=Navarre');
    
    console.log('✅ Browser simulation successful!');
    console.log(`Response size: ${JSON.stringify(response.data).length} bytes`);
    console.log(`Available clients: ${response.data.availableClients?.length || 0}`);
    console.log(`Stay with staff: ${response.data.shouldStayWithStaff?.length || 0}`);
    
  } catch (error) {
    console.log(`❌ Browser simulation failed: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

async function runTests() {
  await testUpdatedAPI();
  await testBrowserSimulation();
  
  console.log('\n=== SUMMARY ===');
  console.log('The available-clients endpoint has been added to the enhanced-lunch-schedule routes.');
  console.log('This should resolve the 401 error the browser was experiencing.');
  console.log('The endpoint is mounted BEFORE authentication middleware, so no auth is required.');
}

runTests().catch(console.error);