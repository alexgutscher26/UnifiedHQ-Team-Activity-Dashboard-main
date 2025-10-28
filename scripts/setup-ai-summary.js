#!/usr/bin/env node

/**
 * AI Summary Setup Script
 * Helps users configure OpenRouter API key and set up the AI summary feature
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const ENV_FILE = '.env'
const ENV_EXAMPLE_FILE = '.env.example'

console.log('🤖 AI Summary Feature Setup')
console.log('============================\n')

// Check if .env.local exists
if (!existsSync(ENV_FILE)) {
  console.log('❌ .env.local file not found. Please create it first.')
  console.log('   You can copy from .env.example if it exists.\n')
  process.exit(1)
}

// Read current .env.local
let envContent = readFileSync(ENV_FILE, 'utf8')

// Check if OpenRouter API key is already configured
if (envContent.includes('OPENROUTER_API_KEY=')) {
  const hasKey = envContent.match(/OPENROUTER_API_KEY=(.+)/)
  if (hasKey && hasKey[1] && hasKey[1] !== 'your-openrouter-api-key') {
    console.log('✅ OpenRouter API key is already configured')
  } else {
    console.log(
      '⚠️  OpenRouter API key placeholder found, but no actual key configured'
    )
  }
} else {
  console.log('📝 Adding OpenRouter API key configuration...')
  envContent +=
    '\n# AI Summary (OpenRouter)\nOPENROUTER_API_KEY=your-openrouter-api-key\n'
  writeFileSync(ENV_FILE, envContent)
  console.log('✅ Added OpenRouter API key placeholder to .env.local')
}

console.log('\n🔑 OpenRouter API Key Setup')
console.log('============================')
console.log('1. Go to https://openrouter.ai/')
console.log('2. Sign up or log in to your account')
console.log('3. Go to your API Keys section')
console.log('4. Create a new API key')
console.log('5. Copy the API key')
console.log(
  '6. Replace "your-openrouter-api-key" in your .env.local file with your actual key'
)
console.log('\nExample:')
console.log('OPENROUTER_API_KEY=sk-or-v1-abc123...\n')

// Database migration
console.log('🗄️  Database Migration')
console.log('======================')
try {
  console.log('Running Prisma database migration...')
  execSync('npx prisma generate', { stdio: 'inherit' })
  execSync('npx prisma db push', { stdio: 'inherit' })
  console.log('✅ Database migration completed successfully')
} catch (error) {
  console.error('❌ Database migration failed:', error)
  console.log('\nPlease run the following commands manually:')
  console.log('npx prisma generate')
  console.log('npx prisma db push')
}

// Test AI service connection
console.log('\n🧪 Testing AI Service Connection')
console.log('==================================')
console.log('To test if your OpenRouter API key is working:')
console.log('1. Make sure you have set your OPENROUTER_API_KEY in .env.local')
console.log('2. Start your development server: bun run dev')
console.log('3. Visit: http://localhost:3000/api/ai-summary/cron')
console.log('4. You should see a health check response\n')

// Cron job setup
console.log('⏰ Automated Summary Generation')
console.log('===============================')
console.log('To set up automated AI summary generation every 30 minutes:')
console.log('1. Add this to your cron jobs (crontab -e):')
console.log(
  '   */30 * * * * curl -X POST http://localhost:3000/api/ai-summary/cron \\'
)
console.log('     -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN"')
console.log('\n2. Or use a service like Vercel Cron Jobs for production')
console.log('3. Set CRON_SECRET_TOKEN in your environment variables\n')

console.log('🎉 Setup Complete!')
console.log('==================')
console.log('Your AI Summary feature is now configured.')
console.log('Next steps:')
console.log('1. Set your OpenRouter API key in .env.local')
console.log('2. Start your development server: bun run dev')
console.log('3. Visit your dashboard to see the AI Summary card')
console.log(
  '4. Connect your GitHub and Slack integrations for better summaries'
)
console.log(
  '\nFor more information, check the documentation in docs/AI_SUMMARY_SETUP.md\n'
)
