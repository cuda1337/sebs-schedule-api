const axios = require('axios');

const API_URL = 'https://sebs-schedule-api.onrender.com';

async function testDebugEndpoint() {
  console.log('=== TESTING DEBUG ENDPOINT ===\n');
  
  try {
    const response = await axios.get(`${API_URL}/api/enhanced-lunch-schedule/test-debug`);
    console.log('✅ Debug endpoint working! Our route is being hit.');
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('❌ Debug endpoint not found - deployment may not have completed yet');
    } else {
      console.log('❌ Debug endpoint error:', error.message, error.response?.status);
      if (error.response?.data) {
        console.log('Error data:', error.response.data);
      }
    }
  }
  
  // Also test if the available-clients endpoint gives us any more info
  console.log('\n=== TESTING AVAILABLE-CLIENTS WITH MORE DETAIL ===\n');
  
  try {
    const response = await axios.get(`${API_URL}/api/enhanced-lunch-schedule/available-clients?date=2025-06-18&location=Navarre`);
    console.log('✅ Available clients working!');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('❌ Available clients error details:');
    console.log('  Status:', error.response?.status);
    console.log('  Status Text:', error.response?.statusText);
    console.log('  Headers:', error.response?.headers);
    console.log('  Data:', error.response?.data);
    
    // Check if it's actually a server error vs auth error
    if (error.response?.status === 401) {
      console.log('\n🔍 This looks like an authentication error.');
      console.log('   Either the endpoint is being caught by auth middleware,');
      console.log('   or there\'s a middleware that\'s requiring auth before our route.');
    }
  }
}

testDebugEndpoint().catch(console.error);