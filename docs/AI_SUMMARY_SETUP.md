# AI Summary Feature Setup Guide

This guide explains how to set up and use the AI-powered summary feature in UnifiedHQ.

## Overview

The AI Summary feature uses OpenRouter to provide intelligent insights from your team's GitHub and Slack activity. It generates daily summaries with key highlights, action items, and insights to help teams stay informed and productive.

## Prerequisites

1. A GitHub account with repositories
2. A Slack workspace (optional but recommended)
3. An OpenRouter account and API key

## Setup Instructions

### 1. OpenRouter API Key Setup

1. **Create an OpenRouter Account**
   - Go to [https://openrouter.ai/](https://openrouter.ai/)
   - Sign up or log in to your account

2. **Generate an API Key**
   - Navigate to your API Keys section
   - Create a new API key
   - Copy the API key (starts with `sk-or-v1-`)

3. **Configure Environment Variables**
   - Add the following to your `.env.local` file:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
   ```

### 2. Database Migration

Run the following commands to update your database schema:

```bash
npx prisma generate
npx prisma db push
```

### 3. Automated Setup (Optional)

You can use the provided setup script:

```bash
node scripts/setup-ai-summary.js
```

This script will:
- Check your environment configuration
- Guide you through API key setup
- Run database migrations
- Provide testing instructions

## Features

### AI Summary Card

The AI Summary card displays:
- **Key Highlights**: Most important accomplishments and events
- **Action Items**: Tasks that need attention or follow-up
- **Additional Insights**: Patterns, trends, and observations
- **Time Range Selection**: Today, This Week, or This Month
- **Real-time Generation**: Manual refresh and automatic updates

### Smart Summarization

The AI analyzes:
- GitHub commits, pull requests, and issues
- Slack messages, channels, and team activity
- Team context (repositories, channels, team size)
- Activity patterns and trends

### Caching and Performance

- **Persistent Storage**: Summaries are stored in the database and persist across page refreshes
- **Daily Schedule**: Summaries are generated every 24 hours from account creation
- **Automatic Generation**: Summaries are automatically generated when users visit the dashboard
- **Background Processing**: Automated summaries every 24 hours for all users with activity
- **Rate Limiting**: Respects OpenRouter API limits
- **Error Handling**: Graceful fallbacks and user-friendly errors

## API Endpoints

### Get AI Summaries
```http
GET /api/ai-summary?timeRange=24h&limit=5
```

**Parameters:**
- `timeRange`: `24h`, `7d`, or `30d` (default: `24h`)
- `limit`: Number of summaries to return (default: `5`)

### Generate New Summary
```http
POST /api/ai-summary
Content-Type: application/json

{
  "timeRange": "24h",
  "forceRegenerate": false
}
```

### Health Check
```http
GET /api/ai-summary/cron
```

### Automated Generation
```http
POST /api/ai-summary/cron
Authorization: Bearer YOUR_CRON_SECRET_TOKEN
```

## Configuration

### Environment Variables

```env
# Required
OPENROUTER_API_KEY=sk-or-v1-your-api-key

# Optional (for automated generation)
CRON_SECRET_TOKEN=your-secret-token-for-cron-jobs
```

### AI Model Configuration

The feature uses `openai/gpt-4o-mini` by default. You can modify this in `src/lib/ai-summary-service.ts`:

```typescript
private static readonly DEFAULT_MODEL = 'openai/gpt-4o-mini';
```

Available models on OpenRouter:
- `openai/gpt-4o-mini` (recommended, cost-effective)
- `openai/gpt-4o`
- `anthropic/claude-3-haiku`
- `anthropic/claude-3-sonnet`

## Usage

### Manual Summary Generation

1. **Via Dashboard**: Click the refresh button on the AI Summary card
2. **Via API**: Send a POST request to `/api/ai-summary`
3. **Force Regeneration**: Set `forceRegenerate: true` to bypass cache

### Automated Generation

Set up a cron job to generate daily summaries automatically:

```bash
# Every 24 hours (daily at midnight)
0 0 * * * curl -X POST http://localhost:3001/api/ai-summary/cron \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN"
```

**Note**: The system automatically generates summaries when users visit the dashboard, so cron jobs are optional for basic functionality. Daily summaries are generated every 24 hours from account creation.

### Production Deployment

For production environments:

1. **Vercel Cron Jobs**: Use Vercel's cron job feature
2. **External Cron Service**: Use services like cron-job.org
3. **Server Cron**: Set up cron jobs on your server

## Troubleshooting

### Common Issues

1. **"AI service is not available"**
   - Check your OpenRouter API key
   - Verify the key has sufficient credits
   - Check your internet connection

2. **"No activities found"**
   - Ensure you have connected GitHub and/or Slack
   - Check if you have recent activity in the selected time range
   - Verify your integrations are working

3. **"Failed to generate AI summary"**
   - Check the server logs for detailed error messages
   - Verify your OpenRouter account has sufficient credits
   - Try reducing the number of activities (limit to 50-100)

### Debug Mode

Enable debug logging by setting:

```env
NODE_ENV=development
```

This will provide detailed logs in the console.

### Testing the Integration

1. **Health Check**: Visit `/api/ai-summary/cron` to test connectivity
2. **Manual Generation**: Use the dashboard refresh button
3. **API Testing**: Use tools like Postman or curl to test endpoints

## Best Practices

### Data Quality

- **Connect Multiple Integrations**: GitHub + Slack provides richer summaries
- **Select Relevant Repositories**: Choose active repositories for better insights
- **Monitor Channel Activity**: Include important Slack channels

### Performance

- **Limit Activity Count**: The AI processes up to 100 activities per summary
- **Use Appropriate Time Ranges**: 24h summaries are most relevant
- **Cache Effectively**: Don't regenerate summaries unnecessarily

### Cost Management

- **Monitor Usage**: Track your OpenRouter API usage
- **Optimize Prompts**: The current prompts are optimized for cost-effectiveness
- **Use Appropriate Models**: GPT-4o-mini provides good results at lower cost

## Security

### API Key Security

- **Never commit API keys**: Use environment variables
- **Rotate Keys Regularly**: Change your OpenRouter API key periodically
- **Use Scoped Access**: Limit API key permissions when possible

### Data Privacy

- **Activity Data**: Only recent activity is sent to OpenRouter
- **No Sensitive Information**: Avoid including sensitive data in activity titles
- **Local Storage**: Summaries are stored locally in your database

## Support

### Getting Help

1. **Check Logs**: Review server logs for error details
2. **Test Connectivity**: Use the health check endpoint
3. **Verify Configuration**: Ensure all environment variables are set correctly

### Contributing

To improve the AI Summary feature:

1. **Prompt Engineering**: Modify prompts in `ai-summary-service.ts`
2. **UI Improvements**: Update the `AISummaryCard` component
3. **New Integrations**: Add support for additional data sources

## Changelog

### Version 1.0.0
- Initial AI Summary feature implementation
- OpenRouter integration
- GitHub and Slack data analysis
- Automated summary generation
- Dashboard integration
