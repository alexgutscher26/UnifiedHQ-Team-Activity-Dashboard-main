#!/usr/bin/env node

/**
 * Test script for AI summary generation
 * This script can be used to manually trigger AI summary generation for testing
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testAISummaryGeneration() {
  console.log('🤖 Testing AI Summary Generation...\n');

  try {
    // Test the trigger endpoint
    console.log('1. Testing trigger endpoint...');
    const triggerResponse = await fetch(`${BASE_URL}/api/ai-summary/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const triggerResult = await triggerResponse.json();
    console.log('Trigger result:', triggerResult);

    if (triggerResponse.ok) {
      console.log('✅ Trigger endpoint working');
    } else {
      console.log('❌ Trigger endpoint failed');
    }

    console.log('\n2. Testing manual generation endpoint...');

    // Note: This would require authentication in a real scenario
    // For testing, you might need to add a test user or bypass auth

    console.log('\n3. Testing cron health check...');
    const healthResponse = await fetch(`${BASE_URL}/api/ai-summary/cron`);
    const healthResult = await healthResponse.json();
    console.log('Health check result:', healthResult);

    if (healthResponse.ok) {
      console.log('✅ Cron endpoint healthy');
    } else {
      console.log('❌ Cron endpoint unhealthy');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAISummaryGeneration();
