#!/usr/bin/env node

/**
 * Daily Summary Setup Script
 * Sets up environment variables and cron job configuration for automated daily summary generation
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

console.log('🚀 Setting up Daily Summary automation...\n')

// Generate a secure CRON_SECRET_TOKEN
const cronSecretToken = crypto.randomBytes(32).toString('base64')

console.log('📋 Environment Variables Setup:')
console.log('=====================================')
console.log('')
console.log('Add these environment variables to your deployment:')
console.log('')
console.log('# Required for AI Summary Generation')
console.log('OPENROUTER_API_KEY=sk-or-v1-your-api-key-here')
console.log(`CRON_SECRET_TOKEN=${cronSecretToken}`)
console.log('')
console.log('# Database (if not already set)')
console.log('DATABASE_URL=your-database-connection-string')
console.log('')
console.log('# GitHub Integration (if using GitHub)')
console.log('GITHUB_APP_ID=your-github-app-id')
console.log('GITHUB_PRIVATE_KEY=your-github-private-key')
console.log('GITHUB_CLIENT_ID=your-github-client-id')
console.log('GITHUB_CLIENT_SECRET=your-github-client-secret')
console.log('')
console.log('# Slack Integration (if using Slack)')
console.log('SLACK_CLIENT_ID=your-slack-client-id')
console.log('SLACK_CLIENT_SECRET=your-slack-client-secret')
console.log('SLACK_BOT_TOKEN=xoxb-your-slack-bot-token')
console.log('')
console.log('=====================================')
console.log('')

// Check if vercel.json exists
const vercelConfigPath = path.join(process.cwd(), 'vercel.json')
if (fs.existsSync(vercelConfigPath)) {
  console.log('✅ Vercel cron job configuration found')
  console.log('   - Daily summaries will run at midnight UTC')
  console.log('   - Cache cleanup will run at 2 AM UTC')
} else {
  console.log('❌ Vercel cron job configuration not found')
  console.log(
    '   Please ensure vercel.json exists with cron job configuration'
  )
}

console.log('')
console.log('🔧 Manual Testing:')
console.log('==================')
console.log('')
console.log('1. Test the cron endpoint:')
console.log('   curl -X POST http://localhost:3000/api/ai-summary/cron \\')
console.log(`     -H "Authorization: Bearer ${cronSecretToken}"`)
console.log('')
console.log('2. Test health check:')
console.log('   curl http://localhost:3000/api/ai-summary/cron')
console.log('')
console.log('3. Check environment variables:')
console.log('   curl http://localhost:3000/api/debug/env')
console.log('')

console.log('📊 Monitoring:')
console.log('==============')
console.log('')
console.log('Monitor daily summary generation:')
console.log('1. Check Vercel function logs')
console.log('2. Monitor database for new AI summaries')
console.log('3. Set up alerts for failed cron jobs')
console.log('')

console.log('🎉 Setup Complete!')
console.log('')
console.log('Next steps:')
console.log('1. Add environment variables to your deployment platform')
console.log('2. Deploy the application')
console.log('3. Test the cron endpoint manually')
console.log('4. Monitor the logs for successful execution')
console.log('')

// Create a test script
const testScript = `#!/bin/bash

# Test Daily Summary Cron Job
echo "Testing Daily Summary Cron Job..."

# Test health check
echo "1. Testing health check..."
curl -s http://localhost:3000/api/ai-summary/cron | jq '.'

# Test cron endpoint (replace with your actual token)
echo "2. Testing cron endpoint..."
curl -X POST http://localhost:3000/api/ai-summary/cron \\
  -H "Authorization: Bearer ${cronSecretToken}" \\
  -H "Content-Type: application/json" | jq '.'

echo "Test completed!"
`

fs.writeFileSync(path.join(process.cwd(), 'test-daily-summary.sh'), testScript)
fs.chmodSync(path.join(process.cwd(), 'test-daily-summary.sh'), '755')

console.log('📝 Created test script: test-daily-summary.sh')
console.log('   Run: ./test-daily-summary.sh')
console.log('')
