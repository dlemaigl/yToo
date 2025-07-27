const io = require('socket.io-client');
const axios = require('axios');

// Test configuration
const API_BASE = 'http://localhost:3001/api';
const WS_URL = 'http://localhost:3001';

// Test data
let authToken = '';
let groupId = '';
let activityId = '';
let userId = '';

async function testVotingWebSocket() {
  console.log('🚀 Starting voting WebSocket test...\n');

  try {
    // Step 1: Register and login
    console.log('1. Registering test user...');
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, {
      username: 'testuser' + timestamp,
      email: 'test' + timestamp + '@example.com',
      password: 'TestPassword123'
    });
    
    console.log('Registration response:', registerResponse.data);
    authToken = registerResponse.data.accessToken || registerResponse.data.token;
    userId = registerResponse.data.user.id;
    console.log('✅ User registered and logged in, token:', authToken ? 'present' : 'missing');

    // Step 2: Create a group
    console.log('2. Creating test group...');
    const groupResponse = await axios.post(`${API_BASE}/groups`, {
      name: 'Test Group ' + Date.now(),
      description: 'Test group for voting'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    groupId = groupResponse.data.group.id;
    console.log('✅ Group created:', groupId);

    // Step 3: Create an activity
    console.log('3. Creating test activity...');
    const activityResponse = await axios.post(`${API_BASE}/groups/${groupId}/activities`, {
      title: 'Test Activity ' + Date.now(),
      description: 'Test activity for voting'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    activityId = activityResponse.data.activity.id;
    console.log('✅ Activity created:', activityId);

    // Step 4: Connect to WebSocket
    console.log('4. Connecting to WebSocket...');
    const socket = io(WS_URL, {
      auth: {
        token: authToken
      }
    });

    // Set up WebSocket event listeners
    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      
      // Join the group room
      socket.emit('join_group', groupId);
    });

    socket.on('group:vote_updated', (data) => {
      console.log('🔔 Received vote_updated event:', data);
    });

    socket.on('group:activity_chosen', (data) => {
      console.log('🎉 Received activity_chosen event:', data);
    });

    socket.on('group:activity_unchosen', (data) => {
      console.log('🔄 Received activity_unchosen event:', data);
    });

    socket.on('joined_group', (data) => {
      console.log('✅ Successfully joined group:', data);
    });

    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    // Wait for connection
    await new Promise(resolve => {
      socket.on('connect', resolve);
    });

    // Step 5: Cast a vote and check for WebSocket notifications
    console.log('5. Casting vote...');
    const voteResponse = await axios.post(`${API_BASE}/activities/${activityId}/vote`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Vote cast successfully:', voteResponse.data);

    // Wait a bit to see if WebSocket events are received
    console.log('6. Waiting for WebSocket notifications...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Remove the vote
    console.log('7. Removing vote...');
    const removeVoteResponse = await axios.delete(`${API_BASE}/activities/${activityId}/vote`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Vote removed successfully:', removeVoteResponse.data);

    // Wait a bit more for WebSocket events
    await new Promise(resolve => setTimeout(resolve, 2000));

    socket.disconnect();
    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testVotingWebSocket();