const axios = require('axios');

const API_URL = 'https://sebs-schedule-api.onrender.com';

async function testServerEndpoints() {
  console.log('=== TESTING SERVER ENDPOINTS TO CHECK DEPLOYMENT STATUS ===\n');
  
  // Test a known working endpoint
  try {
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log('✅ Health endpoint working:', healthResponse.data);
  } catch (error) {
    console.log('❌ Health endpoint failed:', error.message);
  }
  
  // Test the main lunch schedule endpoint
  try {
    const lunchResponse = await axios.get(`${API_URL}/api/enhanced-lunch-schedule?date=2025-06-18&location=Navarre`);
    console.log('✅ Main lunch schedule endpoint working');
  } catch (error) {
    console.log('❌ Main lunch schedule endpoint failed:', error.message);
  }
  
  // Test if the available-clients endpoint exists
  try {
    const availableResponse = await axios.get(`${API_URL}/api/enhanced-lunch-schedule/available-clients?date=2025-06-18&location=Navarre`);
    console.log('✅ Available clients endpoint working - NEW CODE IS DEPLOYED!');
    console.log('Response:', availableResponse.data);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('❌ Available clients endpoint returns 401 - this suggests the endpoint exists but has auth issues');
    } else if (error.response?.status === 404) {
      console.log('❌ Available clients endpoint returns 404 - NEW CODE NOT YET DEPLOYED');
    } else {
      console.log('❌ Available clients endpoint failed:', error.message, error.response?.status);
    }
  }
  
  // Test debug endpoints to see what the server has
  try {
    const debugResponse = await axios.get(`${API_URL}/api/debug-lunch-data`);
    console.log('✅ Debug endpoint working - checking for data');
    console.log('Schedules found:', debugResponse.data.schedules?.length || 0);
    console.log('Time blocks found:', debugResponse.data.timeBlocks?.length || 0);
    console.log('Groups found:', debugResponse.data.groups?.length || 0);
  } catch (error) {
    console.log('❌ Debug endpoint failed:', error.message);
  }
}

testServerEndpoints().catch(console.error);