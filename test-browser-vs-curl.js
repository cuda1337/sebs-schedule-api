const axios = require('axios');
const { spawn } = require('child_process');

const API_URL = 'https://sebs-schedule-api.onrender.com';
const TEST_DATE = '2025-06-18';
const TEST_LOCATION = 'Navarre';

async function testCurlRequest() {
  console.log('\n=== CURL REQUEST ===');
  
  return new Promise((resolve, reject) => {
    const curl = spawn('curl', [
      '-X', 'GET',
      '-H', 'Content-Type: application/json',
      '-v', // verbose to see headers
      `${API_URL}/api/enhanced-lunch-schedule?date=${TEST_DATE}&location=${TEST_LOCATION}`
    ]);

    let stdout = '';
    let stderr = '';

    curl.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    curl.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    curl.on('close', (code) => {
      console.log('CURL Headers and Request Info:');
      console.log(stderr);
      console.log('\nCURL Response Body:');
      console.log(stdout);
      console.log('\nCURL Response Size:', stdout.length, 'bytes');
      
      try {
        const jsonResponse = JSON.parse(stdout);
        console.log('CURL Parsed Response Keys:', Object.keys(jsonResponse));
        if (jsonResponse.timeBlocks) {
          console.log('CURL TimeBlocks Count:', jsonResponse.timeBlocks.length);
          jsonResponse.timeBlocks.forEach((tb, i) => {
            console.log(`  TimeBlock ${i}: ${tb.groups?.length || 0} groups`);
          });
        }
      } catch (e) {
        console.log('CURL Response is not valid JSON or empty');
      }
      
      resolve({ stdout, stderr, code });
    });
  });
}

async function testAxiosRequest() {
  console.log('\n=== AXIOS REQUEST (simulating browser) ===');
  
  try {
    // Test without auth token first
    console.log('Testing without auth token...');
    const axiosClient = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Chrome Browser Simulation)'
      },
    });

    const response = await axiosClient.get(`/api/enhanced-lunch-schedule?date=${TEST_DATE}&location=${TEST_LOCATION}`);
    
    console.log('Axios Response Status:', response.status);
    console.log('Axios Response Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Axios Response Size:', JSON.stringify(response.data).length, 'bytes');
    console.log('Axios Response Keys:', Object.keys(response.data));
    
    if (response.data.timeBlocks) {
      console.log('Axios TimeBlocks Count:', response.data.timeBlocks.length);
      response.data.timeBlocks.forEach((tb, i) => {
        console.log(`  TimeBlock ${i}: ${tb.groups?.length || 0} groups`);
      });
    }
    
    console.log('\nAxios Full Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Axios Error:', error.message);
    if (error.response) {
      console.error('Axios Error Status:', error.response.status);
      console.error('Axios Error Data:', error.response.data);
      console.error('Axios Error Headers:', error.response.headers);
    }
  }
}

async function testWithAuthToken() {
  console.log('\n=== AXIOS REQUEST WITH AUTH TOKEN ===');
  
  try {
    // Simulate browser request with potential auth token
    const axiosClient = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-to-test-auth-behavior',
        'User-Agent': 'Mozilla/5.0 (Chrome Browser Simulation)'
      },
    });

    const response = await axiosClient.get(`/api/enhanced-lunch-schedule?date=${TEST_DATE}&location=${TEST_LOCATION}`);
    
    console.log('Axios WITH AUTH Response Status:', response.status);
    console.log('Axios WITH AUTH Response Size:', JSON.stringify(response.data).length, 'bytes');
    console.log('Axios WITH AUTH Response Keys:', Object.keys(response.data));
    
  } catch (error) {
    console.error('Axios WITH AUTH Error:', error.message);
    if (error.response) {
      console.error('Axios WITH AUTH Error Status:', error.response.status);
      console.error('Axios WITH AUTH Error Data:', error.response.data);
    }
  }
}

async function runComparison() {
  console.log('Testing Enhanced Lunch Schedule API: Browser vs CURL');
  console.log('API URL:', API_URL);
  console.log('Test Date:', TEST_DATE);
  console.log('Test Location:', TEST_LOCATION);
  
  await testCurlRequest();
  await testAxiosRequest();
  await testWithAuthToken();
  
  console.log('\n=== COMPARISON COMPLETE ===');
  console.log('Check the output above to identify differences between curl and browser requests.');
}

runComparison().catch(console.error);